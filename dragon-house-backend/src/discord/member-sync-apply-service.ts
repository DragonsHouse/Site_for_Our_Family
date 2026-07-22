import { mkdir, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import type pg from 'pg';
import type { AppConfig } from '../config/env.js';
import { createLogger, planHashPrefix, type AppLogger } from '../logging/logger.js';
import type {
  DiscordMemberSyncDryRunItem,
  DiscordMemberSyncDryRunResult,
  FamilyPermission,
  FamilyRole,
  NormalizedDiscordGuildMember,
} from '../types.js';
import type { DiscordMemberSyncDryRunService } from './member-sync-dry-run-service.js';

type ApplySummary = {
  created: number;
  updated: number;
  skipped: number;
  inactive: number;
  reactivated: number;
  conflicts: number;
  warnings: number;
  errors: number;
  auditEntries: number;
};

export type DiscordMemberSyncApplyResult = {
  syncRunId: string;
  idempotencyKey: string;
  applyRequest: DiscordMemberSyncApplyRequest;
  generatedAt: string;
  mode: 'apply';
  status: 'succeeded';
  dryRun: DiscordMemberSyncDryRunResult;
  summary: ApplySummary;
  created: string[];
  updated: string[];
  deactivated: string[];
  reactivated: string[];
  skipped: string[];
  conflicts: string[];
  warnings: string[];
  errors: string[];
  auditEntries: number;
  reportPath: string;
};

export type DiscordMemberSyncApplyRequest = {
  confirm: true;
  planId: string;
  planGeneratedAt: string;
  planExpiresAt: string;
  planHash: string;
  idempotencyKey: string;
};

export class DiscordMemberSyncApplyConflictError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'DiscordMemberSyncApplyConflictError';
  }
}

type MemberRow = {
  id: string;
  nickname: string;
  role: FamilyRole;
  rank: number;
  status: 'active' | 'inactive';
  permissions: FamilyPermission[];
  permissions_override: FamilyPermission[];
  permissions_denied: FamilyPermission[];
  permissions_discord: FamilyPermission[];
};

export class DiscordMemberSyncApplyService {
  private readonly logger: AppLogger;

  constructor(
    private readonly pool: pg.Pool,
    private readonly dryRunService: DiscordMemberSyncDryRunService,
    private readonly config: Pick<AppConfig, 'discord' | 'logLevel' | 'logFormat' | 'nodeEnv'>,
    logger: AppLogger | null = null,
  ) {
    this.logger = logger ?? createLogger(config);
  }

  async apply(request: DiscordMemberSyncApplyRequest, generatedAt = new Date()): Promise<DiscordMemberSyncApplyResult> {
    const existingReport = await this.findReportByIdempotencyKey(request.idempotencyKey);
    if (existingReport) return validateExistingIdempotencyReport(existingReport, request);

    const syncRunId = randomUUID();
    const client = await this.pool.connect();
    const startedAt = Date.now();
    try {
      await client.query('begin');
      await acquireApplyLock(client, this.config.discord.guildId ?? 'unknown-guild', this.logger);
      this.logger.info('discord_sync_apply_started', {
        syncRunId,
        guildId: this.config.discord.guildId,
        planId: request.planId,
        planHashPrefix: planHashPrefix(request.planHash),
      });
      const dryRun = await this.dryRunService.run(new Date(request.planGeneratedAt));
      assertApplyRequestMatchesPlan(request, dryRun, generatedAt);
      assertSnapshotIsCompleteEnough(dryRun, this.config.discord.sync.minHumanMembers);
      const result = emptyApplyResult(syncRunId, generatedAt, dryRun, request, this.config.discord.sync.reportDir);
      for (const action of dryRun.actions) {
        await this.applyAction(client, action, result, generatedAt);
      }
      result.summary.warnings = result.warnings.length;
      result.summary.errors = result.errors.length;
      result.summary.auditEntries = result.auditEntries;
      await saveApplyReport(result);
      await this.insertSyncReport(client, result);
      await client.query('commit');
      this.logger.info('discord_sync_apply_completed', {
        syncRunId,
        guildId: dryRun.guildId,
        planId: dryRun.planId,
        planHashPrefix: planHashPrefix(dryRun.planHash),
        status: 'succeeded',
        durationMs: Date.now() - startedAt,
        summary: result.summary,
      });
      return result;
    } catch (error) {
      await client.query('rollback');
      this.logger.error('discord_sync_apply_failed', {
        syncRunId,
        guildId: this.config.discord.guildId,
        planId: request.planId,
        planHashPrefix: planHashPrefix(request.planHash),
        durationMs: Date.now() - startedAt,
        errorCode: error instanceof DiscordMemberSyncApplyConflictError ? error.code : 'discord_apply_failed',
      });
      throw error;
    } finally {
      client.release();
    }
  }

  async getLatestReport(): Promise<Record<string, unknown> | null> {
    const query = await this.pool.query<{ report: Record<string, unknown> }>(
      `select report from discord_sync_reports
       where mode = 'apply'
       order by created_at desc
       limit 1`,
    );
    return query.rows[0]?.report ?? null;
  }

  private async findReportByIdempotencyKey(idempotencyKey: string): Promise<Record<string, unknown> | null> {
    const query = await this.pool.query<{ report: Record<string, unknown> }>(
      'select report from discord_sync_reports where idempotency_key = $1 limit 1',
      [idempotencyKey],
    );
    return query.rows[0]?.report ?? null;
  }

  private async applyAction(
    client: pg.PoolClient,
    action: DiscordMemberSyncDryRunItem,
    result: DiscordMemberSyncApplyResult,
    generatedAt: Date,
  ): Promise<void> {
    if (action.action === 'ignored_bot') {
      result.summary.skipped += 1;
      result.skipped.push(action.discordMember?.discordUserId ?? 'unknown-bot');
      return;
    }
    if (action.action === 'conflict') {
      result.summary.conflicts += 1;
      result.conflicts.push(conflictLabel(action));
      return;
    }
    if (action.action === 'create') {
      await this.createMember(client, action, result, generatedAt);
      return;
    }
    if (action.action === 'unchanged') {
      result.summary.skipped += 1;
      result.skipped.push(action.familyMember?.id ?? action.discordMember?.discordUserId ?? 'unchanged-member');
      return;
    }
    if (action.action === 'update') {
      await this.updateMember(client, action, result, generatedAt);
      return;
    }
    if (action.action === 'deactivate_candidate') {
      await this.deactivateMember(client, action, result, generatedAt);
    }
  }

  private async createMember(
    client: pg.PoolClient,
    action: DiscordMemberSyncDryRunItem,
    result: DiscordMemberSyncApplyResult,
    generatedAt: Date,
  ): Promise<void> {
    if (!action.discordMember || !action.primaryRank) {
      result.summary.conflicts += 1;
      result.conflicts.push(`Create action is missing Discord member or primary rank: ${conflictLabel(action)}`);
      return;
    }
    if (action.possibleManualLinkFamilyMemberIds.length > 0) {
      result.summary.conflicts += 1;
      result.conflicts.push(`Create action has manual-link candidates and was skipped: ${action.discordMember.discordUserId}`);
      return;
    }
    const nickname = displayName(action.discordMember);
    if (await nicknameExists(client, nickname)) {
      result.summary.conflicts += 1;
      result.conflicts.push(`Nickname already exists; refusing to create by nickname-only match: ${nickname}`);
      return;
    }

    const memberId = randomUUID();
    const now = generatedAt.toISOString();
    await client.query(
      `insert into family_members
        (id, nickname, static_id, role, rank, permissions, permissions_discord, permissions_override,
         permissions_denied, status, joined_at, onboarding_metadata, profile_metadata,
         created_by_family_member_id, updated_by_family_member_id)
       values ($1, $2, null, $3, $4, $5, $6, '[]'::jsonb, '[]'::jsonb, 'active', $7, '{}'::jsonb, $8, null, null)`,
      [
        memberId,
        nickname,
        action.primaryRank.familyRole,
        action.primaryRank.rank,
        JSON.stringify(action.effectivePermissions),
        JSON.stringify(action.permissionSources.discordMappedPermissions),
        action.discordMember.joinedAt ?? now,
        JSON.stringify(discordProfileMetadata(action.discordMember, action)),
      ],
    );
    await upsertAccountLink(client, memberId, action.discordMember, now);
    result.summary.created += 1;
    result.created.push(memberId);
    result.auditEntries += await auditMemberChange(client, {
      action: 'discord_sync_member_created',
      entityId: memberId,
      afterData: { memberId, discordUserId: action.discordMember.discordUserId, nickname },
      metadata: auditMetadata(result.syncRunId, action, 'create_member'),
    });
    result.auditEntries += await auditMemberChange(client, {
      action: 'discord_sync_permissions_changed',
      entityId: memberId,
      beforeData: { permissions: [] },
      afterData: { permissions: action.effectivePermissions, permissionsDiscord: action.permissionSources.discordMappedPermissions },
      metadata: auditMetadata(result.syncRunId, action, 'create_member_permissions'),
    });
  }

  private async updateMember(
    client: pg.PoolClient,
    action: DiscordMemberSyncDryRunItem,
    result: DiscordMemberSyncApplyResult,
    generatedAt: Date,
  ): Promise<void> {
    if (!action.discordMember || !action.familyMember || !action.primaryRank) return;
    const member = await lockMember(client, action.familyMember.id);
    if (!member) {
      result.summary.conflicts += 1;
      result.conflicts.push(`Linked Family Hub member was not found during apply: ${action.familyMember.id}`);
      return;
    }

    const protectedOwner = isProtectedOwner(member.id, action.discordMember.discordUserId, this.config);
    const proposedRole = protectedOwner ? 'owner' : action.primaryRank.familyRole;
    const proposedRank = protectedOwner ? 10 : action.primaryRank.rank;
    const nickname = displayName(action.discordMember);
    if (member.nickname !== nickname && await nicknameExists(client, nickname, member.id)) {
      result.summary.conflicts += 1;
      result.conflicts.push(`Nickname already exists; refusing nickname update by Discord display name: ${nickname}`);
      return;
    }

    const proposedStatus = 'active';
    const wasInactive = member.status === 'inactive';
    const beforeData = {
      nickname: member.nickname,
      role: member.role,
      rank: member.rank,
      status: member.status,
      permissions: member.permissions,
      permissionsDiscord: member.permissions_discord,
    };
    const afterData = {
      nickname,
      role: proposedRole,
      rank: proposedRank,
      status: proposedStatus,
      permissions: action.effectivePermissions,
      permissionsDiscord: action.permissionSources.discordMappedPermissions,
    };

    await client.query(
      `update family_members
       set nickname = $2,
           role = $3,
           rank = $4,
           status = 'active',
           permissions = $5,
           permissions_discord = $6,
           profile_metadata = coalesce(profile_metadata, '{}'::jsonb) || $7::jsonb,
           updated_at = now(),
           version = version + 1
       where id = $1`,
      [
        member.id,
        nickname,
        proposedRole,
        proposedRank,
        JSON.stringify(action.effectivePermissions),
        JSON.stringify(action.permissionSources.discordMappedPermissions),
        JSON.stringify(discordProfileMetadata(action.discordMember, action)),
      ],
    );
    await upsertAccountLink(client, member.id, action.discordMember, generatedAt.toISOString());
    if (wasInactive) {
      result.summary.reactivated += 1;
      result.reactivated.push(member.id);
      result.auditEntries += await auditMemberChange(client, {
        action: 'discord_sync_member_reactivated',
        entityId: member.id,
        beforeData,
        afterData,
        metadata: auditMetadata(result.syncRunId, action, 'reactivate_member'),
      });
    } else if (changed(beforeData, afterData) || action.action === 'update') {
      result.summary.updated += 1;
      result.updated.push(member.id);
      result.auditEntries += await auditMemberChange(client, {
        action: 'discord_sync_member_updated',
        entityId: member.id,
        beforeData,
        afterData,
        metadata: auditMetadata(result.syncRunId, action, 'update_member'),
      });
    } else {
      result.summary.skipped += 1;
      result.skipped.push(member.id);
    }
    await auditFieldChanges(client, result, action, member.id, beforeData, afterData);
  }

  private async deactivateMember(
    client: pg.PoolClient,
    action: DiscordMemberSyncDryRunItem,
    result: DiscordMemberSyncApplyResult,
    generatedAt: Date,
  ): Promise<void> {
    if (!action.familyMember?.id) return;
    const member = await lockMember(client, action.familyMember.id);
    if (!member) return;
    if (member.id === this.config.discord.sync.protectedOwnerMemberId) {
      result.summary.conflicts += 1;
      result.conflicts.push('Protected owner was absent from Discord and was not deactivated automatically.');
      return;
    }
    await client.query(
      `update family_members
       set status = 'inactive',
           updated_at = now(),
           version = version + 1
       where id = $1`,
      [member.id],
    );
    await client.query(
      `update discord_account_links
       set left_at = coalesce(left_at, $2),
           last_synced_at = $2,
           updated_at = $2
       where family_member_id = $1`,
      [member.id, generatedAt.toISOString()],
    );
    await client.query(
      `update family_sessions
       set revoked_at = coalesce(revoked_at, $2),
           updated_at = now()
       where family_member_id = $1
         and revoked_at is null`,
      [member.id, generatedAt.toISOString()],
    );
    this.logger.warn('discord_sync_sessions_revoked', {
      syncRunId: result.syncRunId,
      familyMemberId: member.id,
      discordUserId: action.familyMember.discordUserId,
      reason: 'member_deactivated',
    });
    result.summary.inactive += 1;
    result.deactivated.push(member.id);
    result.auditEntries += await auditMemberChange(client, {
      action: 'discord_sync_member_deactivated',
      entityId: member.id,
      beforeData: { status: member.status },
      afterData: { status: 'inactive' },
      metadata: auditMetadata(result.syncRunId, action, 'member_absent_from_discord'),
    });
  }

  private async insertSyncReport(client: pg.PoolClient, result: DiscordMemberSyncApplyResult): Promise<void> {
    await client.query(
      `insert into discord_sync_reports (id, mode, status, idempotency_key, report)
       values ($1, 'apply', 'succeeded', $2, $3)
       on conflict (idempotency_key) where idempotency_key is not null do nothing`,
      [
        result.syncRunId,
        result.idempotencyKey,
        JSON.stringify({ ...result, dryRun: { ...result.dryRun, actions: result.dryRun.actions } }),
      ],
    );
  }
}

function emptyApplyResult(
  syncRunId: string,
  generatedAt: Date,
  dryRun: DiscordMemberSyncDryRunResult,
  request: DiscordMemberSyncApplyRequest,
  reportDir: string | null,
): DiscordMemberSyncApplyResult & { reportDir: string | null } {
  return {
    syncRunId,
    idempotencyKey: request.idempotencyKey,
    applyRequest: request,
    reportDir,
    generatedAt: generatedAt.toISOString(),
    mode: 'apply',
    status: 'succeeded',
    dryRun,
    summary: { created: 0, updated: 0, skipped: 0, inactive: 0, reactivated: 0, conflicts: 0, warnings: 0, errors: 0, auditEntries: 0 },
    created: [],
    updated: [],
    deactivated: [],
    reactivated: [],
    skipped: [],
    conflicts: [],
    warnings: [...dryRun.warnings],
    errors: [],
    auditEntries: 0,
    reportPath: '',
  };
}

async function acquireApplyLock(client: pg.PoolClient, guildId: string, logger: AppLogger): Promise<void> {
  const [key1, key2] = advisoryLockKeysForGuild(guildId);
  const result = await client.query<{ locked: boolean }>(
    'select pg_try_advisory_xact_lock($1, $2) as locked',
    [key1, key2],
  );
  if (!result.rows[0]?.locked) {
    logger.warn('discord_sync_apply_lock_rejected', { guildId });
    throw new DiscordMemberSyncApplyConflictError('discord_sync_already_running', 'Another Discord apply sync is already running.');
  }
  logger.info('discord_sync_apply_lock_acquired', { guildId });
}

function assertApplyRequestMatchesPlan(request: DiscordMemberSyncApplyRequest, dryRun: DiscordMemberSyncDryRunResult, now: Date): void {
  if (request.confirm !== true) {
    throw new DiscordMemberSyncApplyConflictError('discord_sync_confirmation_required', 'Apply sync requires explicit confirmation.');
  }
  if (new Date(request.planExpiresAt).getTime() <= now.getTime()) {
    throw new DiscordMemberSyncApplyConflictError('discord_sync_plan_expired', 'Dry-run plan has expired. Generate a fresh dry-run before applying.');
  }
  if (
    request.planId !== dryRun.planId ||
    request.planGeneratedAt !== dryRun.generatedAt ||
    request.planExpiresAt !== dryRun.planExpiresAt
  ) {
    throw new DiscordMemberSyncApplyConflictError('discord_sync_plan_changed', 'Dry-run plan identity no longer matches the current Discord snapshot.');
  }
  if (request.planHash !== dryRun.planHash) {
    throw new DiscordMemberSyncApplyConflictError('discord_sync_plan_changed', 'Dry-run plan hash no longer matches the current Discord snapshot.');
  }
}

function validateExistingIdempotencyReport(
  existingReport: Record<string, unknown>,
  request: DiscordMemberSyncApplyRequest,
): DiscordMemberSyncApplyResult {
  const existingRequest = existingReport.applyRequest as Partial<DiscordMemberSyncApplyRequest> | undefined;
  if (
    !existingRequest ||
    existingRequest.planId !== request.planId ||
    existingRequest.planGeneratedAt !== request.planGeneratedAt ||
    existingRequest.planExpiresAt !== request.planExpiresAt ||
    existingRequest.planHash !== request.planHash
  ) {
    throw new DiscordMemberSyncApplyConflictError(
      'discord_sync_idempotency_key_conflict',
      'Idempotency key was already used for a different Discord sync request.',
    );
  }
  return existingReport as DiscordMemberSyncApplyResult;
}

export function advisoryLockKeysForGuild(guildId: string): [number, number] {
  const digest = createHash('sha256').update(`discord-member-sync:${guildId}`).digest();
  return [digest.readInt32BE(0), digest.readInt32BE(4)];
}

function assertSnapshotIsCompleteEnough(dryRun: DiscordMemberSyncDryRunResult, minHumanMembers: number): void {
  const humanMembers = dryRun.discordMemberCount - dryRun.summary.ignored_bot;
  if (humanMembers < minHumanMembers) {
    throw new DiscordMemberSyncApplyConflictError(
      'discord_sync_incomplete_snapshot',
      'Discord member snapshot is below the configured minimum human member count.',
    );
  }
  if (dryRun.discordMemberCount === 0 && dryRun.summary.deactivate_candidate > 0) {
    throw new DiscordMemberSyncApplyConflictError(
      'discord_sync_incomplete_snapshot',
      'Refusing to deactivate members from an empty Discord snapshot.',
    );
  }
}

function displayName(member: NormalizedDiscordGuildMember): string {
  return (member.serverNickname ?? member.globalName ?? member.username).trim();
}

async function nicknameExists(client: pg.PoolClient, nickname: string, excludingId: string | null = null): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `select exists (
      select 1 from family_members
      where lower(nickname) = lower($1)
        and ($2::text is null or id <> $2)
    )`,
    [nickname, excludingId],
  );
  return result.rows[0]?.exists ?? false;
}

async function lockMember(client: pg.PoolClient, memberId: string): Promise<MemberRow | null> {
  const result = await client.query<MemberRow>('select * from family_members where id = $1 for update', [memberId]);
  return result.rows[0] ?? null;
}

async function upsertAccountLink(
  client: pg.PoolClient,
  memberId: string,
  discordMember: NormalizedDiscordGuildMember,
  timestamp: string,
): Promise<void> {
  const avatarHash = parseDiscordAvatarHash(discordMember.avatarUrl);
  await client.query(
    `insert into discord_account_links
      (family_member_id, discord_user_id, discord_username, discord_global_name, discord_server_nickname,
       discord_avatar, discord_avatar_url, guild_id, joined_at, left_at, last_synced_at, verified,
       guild_member_verified, linked_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, null, $10, true, true, $10, $10)
     on conflict (family_member_id) do update
     set discord_username = excluded.discord_username,
         discord_global_name = excluded.discord_global_name,
         discord_server_nickname = excluded.discord_server_nickname,
         discord_avatar = excluded.discord_avatar,
         discord_avatar_url = excluded.discord_avatar_url,
         guild_id = excluded.guild_id,
         joined_at = excluded.joined_at,
         left_at = null,
         last_synced_at = excluded.last_synced_at,
         verified = true,
         guild_member_verified = true,
         updated_at = excluded.updated_at`,
    [
      memberId,
      discordMember.discordUserId,
      discordMember.username,
      discordMember.globalName,
      discordMember.serverNickname,
      avatarHash,
      discordMember.avatarUrl,
      discordMember.guildId,
      discordMember.joinedAt,
      timestamp,
    ],
  );
}

function parseDiscordAvatarHash(avatarUrl: string | null): string | null {
  return avatarUrl?.match(/\/avatars\/[^/]+\/([^/.?]+)/u)?.[1] ?? null;
}

function discordProfileMetadata(discordMember: NormalizedDiscordGuildMember, action: DiscordMemberSyncDryRunItem): Record<string, unknown> {
  return {
    discord: {
      displayName: displayName(discordMember),
      primaryRank: action.primaryDiscordRoleName ?? null,
      promotionRank: action.promotionRank ?? null,
      additionalRoles: action.additionalRoles.map((role) => role.discordRoleName),
      matchedIgnoredRoles: action.matchedIgnoredRoles.map((role) => role.discordRoleName),
      lastSyncedAt: new Date().toISOString(),
    },
  };
}

async function auditMemberChange(
  client: pg.PoolClient,
  entry: {
    action: string;
    entityId: string;
    beforeData?: unknown;
    afterData?: unknown;
    metadata: Record<string, unknown>;
  },
): Promise<number> {
  await client.query(
    `insert into family_audit_log
      (id, actor_family_member_id, action, entity_type, entity_id, before_data, after_data, metadata)
     values ($1, null, $2, 'family_member', $3, $4, $5, $6)`,
    [
      randomUUID(),
      entry.action,
      entry.entityId,
      entry.beforeData === undefined ? null : JSON.stringify(entry.beforeData),
      entry.afterData === undefined ? null : JSON.stringify(entry.afterData),
      JSON.stringify(entry.metadata),
    ],
  );
  return 1;
}

async function auditFieldChanges(
  client: pg.PoolClient,
  result: DiscordMemberSyncApplyResult,
  action: DiscordMemberSyncDryRunItem,
  memberId: string,
  beforeData: Record<string, unknown>,
  afterData: Record<string, unknown>,
): Promise<void> {
  const fields: Array<[string, string]> = [
    ['role', 'discord_sync_role_changed'],
    ['nickname', 'discord_sync_nickname_changed'],
    ['permissions', 'discord_sync_permissions_changed'],
  ];
  for (const [field, auditAction] of fields) {
    if (JSON.stringify(beforeData[field]) === JSON.stringify(afterData[field])) continue;
    result.auditEntries += await auditMemberChange(client, {
      action: auditAction,
      entityId: memberId,
      beforeData: { [field]: beforeData[field] },
      afterData: { [field]: afterData[field] },
      metadata: auditMetadata(result.syncRunId, action, `${field}_changed`),
    });
  }
  const avatarChange = action.changes.find((change) => change.field === 'discord_avatar');
  if (avatarChange) {
    result.auditEntries += await auditMemberChange(client, {
      action: 'discord_sync_avatar_changed',
      entityId: memberId,
      beforeData: { discordAvatar: avatarChange.current },
      afterData: { discordAvatar: avatarChange.proposed },
      metadata: auditMetadata(result.syncRunId, action, 'avatar_changed'),
    });
  }
}

function auditMetadata(syncRunId: string, action: DiscordMemberSyncDryRunItem, reason: string): Record<string, unknown> {
  return {
    syncRunId,
    reason,
    discordUserId: action.discordMember?.discordUserId ?? action.familyMember?.discordUserId ?? null,
    permissionSource: 'discord_sync',
  };
}

function changed(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) !== JSON.stringify(right);
}

function conflictLabel(action: DiscordMemberSyncDryRunItem): string {
  return `${action.reason}:${action.discordMember?.discordUserId ?? action.familyMember?.id ?? 'unknown'}`;
}

function isProtectedOwner(memberId: string, discordUserId: string, config: Pick<AppConfig, 'discord'>): boolean {
  return Boolean(
    config.discord.sync.protectedOwnerMemberId &&
      config.discord.sync.protectedOwnerDiscordUserId &&
      memberId === config.discord.sync.protectedOwnerMemberId &&
      discordUserId === config.discord.sync.protectedOwnerDiscordUserId,
  );
}

async function saveApplyReport(result: DiscordMemberSyncApplyResult): Promise<void> {
  const reportDir = (result as DiscordMemberSyncApplyResult & { reportDir?: string | null }).reportDir;
  if (!reportDir) return;
  const diagnosticsDir = path.resolve(reportDir);
  await mkdir(diagnosticsDir, { recursive: true });
  const reportPath = path.join(diagnosticsDir, `discord-member-apply-sync-${Date.now()}.json`);
  result.reportPath = reportPath;
  await writeFile(reportPath, JSON.stringify(result, null, 2), 'utf8');
}
