import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DiscordMemberSyncDryRunItem, DiscordMemberSyncDryRunResult, FamilyPermission, FamilyRole } from '../types.js';
import { createTestConfig } from '../test/test-config.js';
import { advisoryLockKeysForGuild, DiscordMemberSyncApplyConflictError, DiscordMemberSyncApplyService } from './member-sync-apply-service.js';
import type { DiscordMemberSyncDryRunService } from './member-sync-dry-run-service.js';

const now = '2026-07-22T10:00:00.000Z';
const expiresAt = '2026-07-22T10:05:00.000Z';
const planId = 'b'.repeat(32);
const planHash = 'a'.repeat(64);
const originalCwd = process.cwd();

type QueryCall = { sql: string; params: unknown[] };

class FakeClient {
  calls: QueryCall[] = [];
  committed = false;
  rolledBack = false;
  failOnSql: string | null = null;
  lockAvailable = true;
  existingIdempotencyReport: Record<string, unknown> | null = null;
  lockedMember = memberRow();

  async query(sql: string, params: unknown[] = []) {
    this.calls.push({ sql, params });
    if (this.failOnSql && sql.includes(this.failOnSql)) throw new Error('planned failure');
    const normalized = sql.toLowerCase();
    if (normalized.includes('pg_try_advisory_xact_lock')) return { rows: [{ locked: this.lockAvailable }] };
    if (normalized.includes('where idempotency_key')) {
      return { rows: this.existingIdempotencyReport ? [{ report: this.existingIdempotencyReport }] : [] };
    }
    if (normalized.includes('select exists')) return { rows: [{ exists: false }] };
    if (normalized.includes('select * from family_members')) return { rows: this.lockedMember ? [this.lockedMember] : [] };
    if (normalized.includes('select report from discord_sync_reports')) return { rows: [{ report: { syncRunId: 'sync-1' } }] };
    if (normalized.trim() === 'commit') this.committed = true;
    if (normalized.trim() === 'rollback') this.rolledBack = true;
    return { rows: [] };
  }

  release() {
    // test fake
  }
}

class FakePool {
  constructor(readonly client: FakeClient) {}

  async connect() {
    return this.client;
  }

  async query(sql: string, params: unknown[] = []) {
    return this.client.query(sql, params);
  }
}

beforeEach(async () => {
  process.chdir(await mkdtemp(join(tmpdir(), 'dragon-house-apply-sync-')));
});

afterEach(() => {
  process.chdir(originalCwd);
});

function memberRow(input: Partial<{
  id: string;
  nickname: string;
  role: FamilyRole;
  rank: number;
  status: 'active' | 'inactive';
  permissions: FamilyPermission[];
  permissions_override: FamilyPermission[];
  permissions_denied: FamilyPermission[];
  permissions_discord: FamilyPermission[];
}> = {}) {
  return {
    id: input.id ?? 'family-1',
    nickname: input.nickname ?? 'Dragon Member',
    role: input.role ?? 'member',
    rank: input.rank ?? 1,
    status: input.status ?? 'active',
    permissions: input.permissions ?? ['view_members'],
    permissions_override: input.permissions_override ?? [],
    permissions_denied: input.permissions_denied ?? [],
    permissions_discord: input.permissions_discord ?? ['view_members'],
  };
}

function dryRunWith(action: DiscordMemberSyncDryRunItem): DiscordMemberSyncDryRunService {
  return {
    run: async () => ({
      generatedAt: now,
      planId,
      planHash,
      planExpiresAt: expiresAt,
      guildId: 'guild-1',
      discordMemberCount: action.discordMember ? 1 : 0,
      familyMemberCount: action.familyMember ? 1 : 0,
      summary: { create: 0, update: 0, unchanged: 0, deactivate_candidate: 0, conflict: 0, ignored_bot: 0, [action.action]: 1 },
      actions: [action],
      warnings: [],
      conflicts: [],
      missingRoleMappings: [],
    }) as DiscordMemberSyncDryRunResult,
  } as DiscordMemberSyncDryRunService;
}

function applyRequest() {
  return {
    confirm: true as const,
    planId,
    planGeneratedAt: now,
    planExpiresAt: expiresAt,
    planHash,
    idempotencyKey: 'test-idempotency-key',
  };
}

function applyService(client: FakeClient, action: DiscordMemberSyncDryRunItem): DiscordMemberSyncApplyService {
  return new DiscordMemberSyncApplyService(
    new FakePool(client) as never,
    dryRunWith(action),
    createTestConfig({
      discord: {
        sync: {
          protectedOwnerMemberId: '62103018-69e7-4baf-844a-2d8b7f2dfc78',
          protectedOwnerDiscordUserId: '906973126783537242',
        },
      },
    }),
  );
}

function syncAction(input: Partial<DiscordMemberSyncDryRunItem> = {}): DiscordMemberSyncDryRunItem {
  const permissions = input.effectivePermissions ?? ['view_members'];
  return {
    action: input.action ?? 'create',
    reason: input.reason ?? 'no_existing_discord_link',
    discordMember: input.discordMember ?? {
      discordUserId: 'discord-1',
      username: 'dragon_user',
      globalName: 'Dragon User',
      serverNickname: 'Dragon Member',
      avatarUrl: 'https://cdn.discordapp.com/avatars/discord-1/avatarhash.png?size=128',
      guildId: 'guild-1',
      roleIds: ['role-member'],
      joinedAt: now,
      bot: false,
    },
    familyMember: input.familyMember,
    matchedBy: input.matchedBy ?? 'none',
    proposedRole: input.primaryRank ?? {
      discordRoleId: 'role-member',
      discordRoleName: 'Member',
      familyRole: 'member',
      rank: 1,
      permissions: ['view_members'],
      priority: 1,
    },
    primaryRank: input.primaryRank ?? {
      discordRoleId: 'role-member',
      discordRoleName: 'Member',
      familyRole: 'member',
      rank: 1,
      permissions: ['view_members'],
      priority: 1,
    },
    promotionRank: input.promotionRank ?? 1,
    primaryDiscordRoleId: input.primaryDiscordRoleId ?? 'role-member',
    primaryDiscordRoleName: input.primaryDiscordRoleName ?? 'Member',
    additionalRoles: input.additionalRoles ?? [],
    effectivePermissions: permissions,
    matchedIgnoredRoles: input.matchedIgnoredRoles ?? [],
    permissionSources: input.permissionSources ?? {
      systemRolePermissions: [],
      discordMappedPermissions: permissions,
      manualGrantedPermissions: [],
      manualDeniedPermissions: [],
      protectedPermissions: [],
    },
    changes: input.changes ?? [],
    warnings: input.warnings ?? [],
    possibleManualLinkFamilyMemberIds: input.possibleManualLinkFamilyMemberIds ?? [],
  };
}

describe('DiscordMemberSyncApplyService', () => {
  it('creates new members and account links transactionally', async () => {
    const client = new FakeClient();
    const service = applyService(client, syncAction());

    const result = await service.apply(applyRequest(), new Date(now));

    expect(result.summary.created).toBe(1);
    expect(client.committed).toBe(true);
    expect(client.calls.some((call) => call.sql.includes('insert into family_members'))).toBe(true);
    expect(client.calls.some((call) => call.sql.includes('insert into discord_account_links'))).toBe(true);
    expect(result.auditEntries).toBeGreaterThanOrEqual(2);
  });

  it('updates existing members while preserving manual permissions in effective permissions', async () => {
    const client = new FakeClient();
    client.lockedMember = memberRow({ permissions: ['view_members'], permissions_override: ['manage_family_map'] });
    const action = syncAction({
      action: 'update',
      familyMember: {
        id: 'family-1',
        nickname: 'Dragon Member',
        staticId: null,
        role: 'member',
        rank: 1,
        status: 'active',
        permissions: ['view_members'],
        deletedAt: null,
        discordUserId: 'discord-1',
      },
      matchedBy: 'discord_user_id',
      effectivePermissions: ['manage_family_map', 'view_members'],
      permissionSources: {
        systemRolePermissions: [],
        discordMappedPermissions: ['view_members'],
        manualGrantedPermissions: ['manage_family_map'],
        manualDeniedPermissions: [],
        protectedPermissions: [],
      },
    });
    const service = applyService(client, action);

    const result = await service.apply(applyRequest(), new Date(now));

    expect(result.summary.updated).toBe(1);
    expect(JSON.stringify(client.calls)).toContain('manage_family_map');
  });

  it('deactivates absent linked members without deleting rows', async () => {
    const client = new FakeClient();
    const action = syncAction({
      action: 'deactivate_candidate',
      reason: 'linked_active_family_member_absent_from_discord',
      discordMember: undefined,
      familyMember: {
        id: 'family-1',
        nickname: 'Dragon Member',
        staticId: null,
        role: 'member',
        rank: 1,
        status: 'active',
        permissions: ['view_members'],
        deletedAt: null,
        discordUserId: 'discord-1',
      },
      matchedBy: 'discord_user_id',
      primaryRank: undefined,
      proposedRole: undefined,
    });
    const service = applyService(client, action);

    const result = await service.apply(applyRequest(), new Date(now));

    expect(result.summary.inactive).toBe(1);
    expect(client.calls.some((call) => call.sql.includes("set status = 'inactive'"))).toBe(true);
    expect(client.calls.some((call) => call.sql.includes('update family_sessions'))).toBe(true);
    expect(client.calls.some((call) => call.sql.toLowerCase().includes('delete from family_members'))).toBe(false);
  });

  it('treats unchanged members as no-op skips', async () => {
    const client = new FakeClient();
    const action = syncAction({
      action: 'unchanged',
      familyMember: {
        id: 'family-1',
        nickname: 'Dragon Member',
        staticId: null,
        role: 'member',
        rank: 1,
        status: 'active',
        permissions: ['view_members'],
        deletedAt: null,
        discordUserId: 'discord-1',
      },
      matchedBy: 'discord_user_id',
    });
    const service = applyService(client, action);

    const result = await service.apply(applyRequest(), new Date(now));

    expect(result.summary.skipped).toBe(1);
    expect(client.calls.some((call) => call.sql.includes('update family_members'))).toBe(false);
    expect(client.calls.some((call) => call.sql.includes('insert into family_audit_log'))).toBe(false);
  });

  it('reactivates inactive linked members instead of creating duplicates', async () => {
    const client = new FakeClient();
    client.lockedMember = memberRow({ status: 'inactive' });
    const action = syncAction({
      action: 'update',
      familyMember: {
        id: 'family-1',
        nickname: 'Dragon Member',
        staticId: null,
        role: 'member',
        rank: 1,
        status: 'inactive',
        permissions: ['view_members'],
        deletedAt: null,
        discordUserId: 'discord-1',
      },
      matchedBy: 'discord_user_id',
    });
    const service = applyService(client, action);

    const result = await service.apply(applyRequest(), new Date(now));

    expect(result.summary.reactivated).toBe(1);
    expect(result.summary.created).toBe(0);
  });

  it('never downgrades the protected owner during apply', async () => {
    const client = new FakeClient();
    client.lockedMember = memberRow({
      id: '62103018-69e7-4baf-844a-2d8b7f2dfc78',
      role: 'owner',
      rank: 10,
      permissions: ['manage_roles', 'view_members'],
    });
    const action = syncAction({
      action: 'update',
      discordMember: {
        ...syncAction().discordMember!,
        discordUserId: '906973126783537242',
      },
      familyMember: {
        id: '62103018-69e7-4baf-844a-2d8b7f2dfc78',
        nickname: 'Anastasia_Dragons',
        staticId: null,
        role: 'owner',
        rank: 10,
        status: 'active',
        permissions: ['manage_roles', 'view_members'],
        deletedAt: null,
        discordUserId: '906973126783537242',
      },
      matchedBy: 'discord_user_id',
      primaryRank: {
        discordRoleId: 'role-member',
        discordRoleName: 'Member',
        familyRole: 'member',
        rank: 1,
        permissions: ['view_members'],
        priority: 1,
      },
    });
    const service = applyService(client, action);

    await service.apply(applyRequest(), new Date(now));

    const update = client.calls.find((call) => call.sql.includes('update family_members'));
    expect(update?.params).toContain('owner');
    expect(update?.params).toContain(10);
  });

  it('keeps conflicts skipped and rolls back on failures', async () => {
    const conflictClient = new FakeClient();
    const conflictService = applyService(
      conflictClient,
      syncAction({ action: 'conflict', reason: 'missing_primary_hierarchy_role', primaryRank: undefined }),
    );

    const conflictResult = await conflictService.apply(applyRequest(), new Date(now));

    expect(conflictResult.summary.conflicts).toBe(1);
    expect(conflictClient.calls.some((call) => call.sql.includes('insert into family_members'))).toBe(false);

    const failingClient = new FakeClient();
    failingClient.failOnSql = 'insert into family_members';
    const failingService = applyService(failingClient, syncAction());

    await expect(failingService.apply(applyRequest(), new Date(now))).rejects.toThrow('planned failure');
    expect(failingClient.rolledBack).toBe(true);
    expect(failingClient.committed).toBe(false);
  });

  it('rejects stale plans before applying writes', async () => {
    const client = new FakeClient();
    const service = applyService(client, syncAction());

    await expect(service.apply({ ...applyRequest(), planHash: 'b'.repeat(64) }, new Date(now))).rejects.toBeInstanceOf(
      DiscordMemberSyncApplyConflictError,
    );

    expect(client.rolledBack).toBe(true);
    expect(client.calls.some((call) => call.sql.includes('insert into family_members'))).toBe(false);
  });

  it('rejects expired plans before applying writes', async () => {
    const client = new FakeClient();
    const service = applyService(client, syncAction());

    await expect(
      service.apply({ ...applyRequest(), planExpiresAt: '2026-07-22T09:59:59.000Z' }, new Date(now)),
    ).rejects.toMatchObject({ code: 'discord_sync_plan_expired' });

    expect(client.rolledBack).toBe(true);
    expect(client.calls.some((call) => call.sql.includes('insert into family_members'))).toBe(false);
  });

  it('rejects concurrent apply attempts with the database lock', async () => {
    const client = new FakeClient();
    client.lockAvailable = false;
    const service = applyService(client, syncAction());

    await expect(service.apply(applyRequest(), new Date(now))).rejects.toMatchObject({ code: 'discord_sync_already_running' });

    expect(client.rolledBack).toBe(true);
    expect(client.calls.some((call) => call.sql.includes('insert into family_members'))).toBe(false);
  });

  it('uses deterministic per-guild advisory lock keys', () => {
    expect(advisoryLockKeysForGuild('guild-1')).toEqual(advisoryLockKeysForGuild('guild-1'));
    expect(advisoryLockKeysForGuild('guild-1')).not.toEqual(advisoryLockKeysForGuild('guild-2'));
  });

  it('rejects reused idempotency keys for different apply requests', async () => {
    const client = new FakeClient();
    client.existingIdempotencyReport = {
      syncRunId: 'previous-sync',
      applyRequest: { ...applyRequest(), planHash: 'c'.repeat(64) },
    };
    const service = applyService(client, syncAction());

    await expect(service.apply(applyRequest(), new Date(now))).rejects.toMatchObject({
      code: 'discord_sync_idempotency_key_conflict',
    });

    expect(client.calls.some((call) => call.sql.toLowerCase().trim() === 'begin')).toBe(false);
  });

  it('returns the original report for duplicate idempotent requests', async () => {
    const client = new FakeClient();
    client.existingIdempotencyReport = {
      syncRunId: 'previous-sync',
      idempotencyKey: applyRequest().idempotencyKey,
      applyRequest: applyRequest(),
    };
    const service = applyService(client, syncAction());

    const result = await service.apply(applyRequest(), new Date(now));

    expect(result.syncRunId).toBe('previous-sync');
    expect(client.calls.some((call) => call.sql.toLowerCase().trim() === 'begin')).toBe(false);
  });
});
