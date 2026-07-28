import type { AppConfig } from '../config/env.js';
import type { DiscordRoleMappingRepository } from './role-mapping-repository.js';
import type { DiscordMemberSyncApplyService } from './member-sync-apply-service.js';
import type { DiscordMemberSyncDryRunService } from './member-sync-dry-run-service.js';
import type { DiscordMemberSyncDryRunItem, DiscordMemberSyncDryRunResult, DiscordRoleMapping } from '../types.js';
import type { DiscordSyncAuditRepository } from './sync-audit-repository.js';
import type {
  DiscordRoleSnapshot,
  DiscordSyncApplyResult,
  DiscordSyncAuditRecord,
  DiscordSyncConflict,
  DiscordSyncConflictType,
  DiscordSyncIntegrationStatus,
  DiscordSyncMatchMethod,
  DiscordSyncPlan,
  DiscordSyncPlanAction,
  DiscordSyncPlanItem,
  DiscordSyncSummary,
} from './sync-engine-models.js';

export class DiscordSyncEngineError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 409,
  ) {
    super(message);
    this.name = 'DiscordSyncEngineError';
  }
}

export class DiscordSyncEngineService {
  constructor(
    private readonly dryRunService: DiscordMemberSyncDryRunService | null,
    private readonly applyService: DiscordMemberSyncApplyService | null,
    private readonly roleMappings: DiscordRoleMappingRepository,
    private readonly auditRepository: DiscordSyncAuditRepository,
    private readonly config: Pick<AppConfig, 'discord'>,
  ) {}

  async getIntegrationStatus(): Promise<DiscordSyncIntegrationStatus> {
    const [roleMappings, latestApply] = await Promise.all([
      this.roleMappings.list(true),
      this.auditRepository.getLatestSuccessfulApply(),
    ]);
    return {
      guildConfigured: Boolean(this.config.discord.guildId),
      guildId: this.config.discord.guildId,
      guildName: this.config.discord.guildId ? 'Configured Discord Guild' : null,
      botConfigured: Boolean(this.config.discord.botToken),
      botAccessStatus: this.dryRunService ? 'configured' : 'unavailable',
      liveData: Boolean(this.config.discord.guildId && this.config.discord.botToken),
      lastSuccessfulSynchronizationAt: latestApply?.completedAt ?? null,
      linkedMemberCount: latestApply ? countValue(latestApply.counts, 'updated') ?? countValue(latestApply.counts, 'update') : null,
      roleMappingCount: roleMappings.filter((mapping) => mapping.enabled).length,
      planTtlSeconds: this.config.discord.sync.planTtlSeconds,
    };
  }

  async generateDryRunPlan(initiatedByMemberId: string | null, generatedAt = new Date()): Promise<DiscordSyncPlan> {
    if (!this.dryRunService) {
      throw new DiscordSyncEngineError('discord_sync_unavailable', 'Discord synchronization is not configured.', 503);
    }
    const rawDryRun = await this.dryRunService.run(generatedAt);
    const plan = normalizeDiscordSyncPlan(rawDryRun, this.config);
    await this.auditRepository.saveDryRunPlan(plan, initiatedByMemberId);
    return plan;
  }

  async getPlan(planId: string, now = new Date()): Promise<DiscordSyncPlan> {
    const plan = await this.auditRepository.getPlan(planId);
    if (!plan) throw new DiscordSyncEngineError('discord_sync_plan_not_found', 'Discord synchronization plan was not found.', 404);
    return {
      ...plan,
      stale: new Date(plan.expiresAt).getTime() <= now.getTime(),
      applied: await this.auditRepository.hasAppliedPlan(planId),
    };
  }

  async applyPlan(
    planId: string,
    idempotencyKey: string,
    initiatedByMemberId: string | null,
    now = new Date(),
  ): Promise<DiscordSyncApplyResult> {
    if (!this.applyService) {
      throw new DiscordSyncEngineError('discord_apply_sync_unavailable', 'Discord apply synchronization is not configured.', 503);
    }
    const plan = await this.getPlan(planId, now);
    if (plan.applied) {
      throw new DiscordSyncEngineError('discord_sync_plan_already_applied', 'This Discord synchronization plan was already applied.');
    }
    if (plan.stale) {
      throw new DiscordSyncEngineError('discord_sync_plan_stale', 'Generate a fresh Discord synchronization plan before applying.');
    }
    if (plan.summary.blocked > 0) {
      throw new DiscordSyncEngineError('discord_sync_plan_has_blocking_conflicts', 'Resolve blocking Discord synchronization conflicts before applying.');
    }
    const applied = await this.applyService.apply(
      {
        confirm: true,
        planId: plan.planId,
        planGeneratedAt: plan.generatedAt,
        planExpiresAt: plan.expiresAt,
        planHash: plan.snapshotFingerprint,
        idempotencyKey,
      },
      now,
    );
    const result = normalizeApplyResult(applied);
    await this.auditRepository.saveApplyResult(result, initiatedByMemberId);
    return result;
  }

  async listHistory(limit = 20): Promise<DiscordSyncAuditRecord[]> {
    return this.auditRepository.listHistory(limit);
  }

  async getAuditRecord(auditId: string): Promise<DiscordSyncAuditRecord> {
    const record = await this.auditRepository.getAuditRecord(auditId);
    if (!record) throw new DiscordSyncEngineError('discord_sync_audit_not_found', 'Discord synchronization audit record was not found.', 404);
    return record;
  }

  async listRoleMappings(): Promise<DiscordRoleSnapshot[]> {
    return (await this.roleMappings.list(true)).map(toRoleSnapshot);
  }
}

export function normalizeDiscordSyncPlan(
  rawDryRun: DiscordMemberSyncDryRunResult,
  config: Pick<AppConfig, 'discord'>,
): DiscordSyncPlan {
  const items = rawDryRun.actions.map((action, index) => normalizePlanItem(action, index));
  const summary = summarizePlan(rawDryRun, items);
  const generatedAt = rawDryRun.generatedAt;
  const plan: DiscordSyncPlan = {
    planId: rawDryRun.planId,
    guildId: rawDryRun.guildId || config.discord.guildId || '',
    generatedAt,
    expiresAt: rawDryRun.planExpiresAt,
    snapshotFingerprint: rawDryRun.planHash,
    snapshot: {
      guildId: rawDryRun.guildId || config.discord.guildId || '',
      memberCount: rawDryRun.discordMemberCount,
      humanMemberCount: rawDryRun.discordMemberCount - rawDryRun.summary.ignored_bot,
      botCount: rawDryRun.summary.ignored_bot,
      fingerprint: rawDryRun.planHash,
      capturedAt: generatedAt,
    },
    summary,
    items,
    warnings: [...new Set(rawDryRun.warnings)],
    conflicts: [
      ...rawDryRun.conflicts.map((message) => ({ type: conflictTypeForReason(message), message, blocking: true })),
      ...items.flatMap((item) => item.conflicts),
    ],
    missingRoleMappings: rawDryRun.missingRoleMappings,
    source: config.discord.botToken ? 'live-discord' : 'mock',
    stale: false,
    applied: false,
    rawDryRun,
  };
  return plan;
}

function normalizePlanItem(action: DiscordMemberSyncDryRunItem, index: number): DiscordSyncPlanItem {
  const forcedConflict = action.action === 'create' && action.possibleManualLinkFamilyMemberIds.length > 0;
  const blockingWarnings = action.warnings.filter((warning) =>
    /manual safety review|revoke access|protected owner/iu.test(warning),
  );
  const normalizedAction = forcedConflict ? 'conflict' : normalizeAction(action.action);
  const conflicts = buildItemConflicts(action, forcedConflict, blockingWarnings);
  const blocking = normalizedAction === 'conflict' || conflicts.some((conflict) => conflict.blocking);
  const matchMethod = matchMethodFor(action, forcedConflict);
  const discordMember = action.discordMember;
  const changes = action.changes;

  return {
    id: `${action.discordMember?.discordUserId ?? action.familyMember?.id ?? 'sync-item'}-${index}`,
    action: normalizedAction,
    legacyAction: action.action,
    reason: action.reason,
    discordUserId: discordMember?.discordUserId ?? action.familyMember?.discordUserId ?? null,
    discordIdentity: {
      username: discordMember?.username ?? null,
      globalName: discordMember?.globalName ?? null,
      serverNickname: discordMember?.serverNickname ?? null,
      avatarUrl: discordMember?.avatarUrl ?? null,
      bot: discordMember?.bot ?? false,
    },
    matchedFamilyMemberId: action.familyMember?.id ?? null,
    matchedFamilyMember: action.familyMember ?? null,
    match: {
      method: matchMethod,
      familyMemberId: action.familyMember?.id ?? null,
      confidence: matchMethod === 'nickname-suggestion' ? 'suggested' : action.familyMember ? 'exact' : 'none',
      reason: action.reason,
    },
    currentValues: Object.fromEntries(changes.map((change) => [change.field, change.current])),
    incomingValues: Object.fromEntries(changes.map((change) => [change.field, change.proposed])),
    proposedFieldChanges: changes,
    mappedRoles: {
      primary: action.primaryRank
        ? {
            discordRoleId: action.primaryRank.discordRoleId,
            discordRoleName: action.primaryRank.discordRoleName,
            mappedFamilyRole: action.primaryRank.familyRole,
            rank: action.primaryRank.rank,
            permissions: action.primaryRank.permissions,
            priority: action.primaryRank.priority,
            enabled: true,
            mappingType: 'primary_hierarchy',
          }
        : null,
      additional: action.additionalRoles.map((role) => ({
        discordRoleId: role.discordRoleId,
        discordRoleName: role.discordRoleName,
        mappedFamilyRole: null,
        rank: null,
        permissions: role.permissions,
        priority: role.priority,
        enabled: true,
        mappingType: 'additional_functional',
      })),
      ignored: action.matchedIgnoredRoles.map((role) => ({
        discordRoleId: role.discordRoleId,
        discordRoleName: role.discordRoleName,
      })),
    },
    warnings: action.warnings,
    conflicts,
    blocking,
    safeToApply: !blocking && ['create', 'update', 'unchanged', 'deactivate'].includes(normalizedAction),
    possibleManualLinkFamilyMemberIds: action.possibleManualLinkFamilyMemberIds,
  };
}

function buildItemConflicts(
  action: DiscordMemberSyncDryRunItem,
  forcedConflict: boolean,
  blockingWarnings: string[],
): DiscordSyncConflict[] {
  const conflicts: DiscordSyncConflict[] = [];
  if (action.action === 'conflict') {
    conflicts.push({
      type: conflictTypeForReason(action.reason),
      message: action.reason,
      blocking: true,
    });
  }
  if (forcedConflict) {
    conflicts.push({
      type: 'no-safe-member-match',
      message: 'Discord identity has possible manual links; automatic creation is blocked until a leader reviews the match.',
      blocking: true,
    });
  }
  conflicts.push(
    ...blockingWarnings.map((message) => ({
      type: 'blocking-warning' as const,
      message,
      blocking: true,
    })),
  );
  return conflicts;
}

function summarizePlan(rawDryRun: DiscordMemberSyncDryRunResult, items: DiscordSyncPlanItem[]): DiscordSyncSummary {
  return {
    total: items.length,
    create: items.filter((item) => item.action === 'create').length,
    update: items.filter((item) => item.action === 'update').length,
    unchanged: items.filter((item) => item.action === 'unchanged').length,
    deactivate: items.filter((item) => item.action === 'deactivate').length,
    conflict: items.filter((item) => item.action === 'conflict').length,
    ignoredBot: items.filter((item) => item.action === 'ignored-bot').length,
    ignoredUnmapped: items.filter((item) => item.action === 'ignored-unmapped').length,
    error: items.filter((item) => item.action === 'error').length,
    safeToApply: items.filter((item) => item.safeToApply).length,
    blocked: items.filter((item) => item.blocking).length,
    discordMembers: rawDryRun.discordMemberCount,
    humanMembers: rawDryRun.discordMemberCount - rawDryRun.summary.ignored_bot,
    familyMembers: rawDryRun.familyMemberCount,
  };
}

function normalizeAction(action: DiscordMemberSyncDryRunItem['action']): DiscordSyncPlanAction {
  if (action === 'deactivate_candidate') return 'deactivate';
  if (action === 'ignored_bot') return 'ignored-bot';
  return action;
}

function matchMethodFor(action: DiscordMemberSyncDryRunItem, forcedConflict: boolean): DiscordSyncMatchMethod {
  if (forcedConflict) return 'nickname-suggestion';
  if (action.matchedBy === 'discord_user_id') return 'account-link';
  if (action.matchedBy === 'static_id') return 'static-id';
  if (action.matchedBy === 'not_applicable') return 'not-applicable';
  return 'none';
}

function conflictTypeForReason(reason: string): DiscordSyncConflictType {
  if (/static/i.test(reason)) return 'static-id-mismatch';
  if (/duplicate/i.test(reason)) return 'multiple-possible-matches';
  if (/missing_primary_hierarchy_role|mapping/i.test(reason)) return 'missing-required-mapping';
  if (/nickname/i.test(reason)) return 'invalid-nickname-format';
  return 'backend-error';
}

function toRoleSnapshot(mapping: DiscordRoleMapping): DiscordRoleSnapshot {
  return {
    discordRoleId: mapping.discordRoleId,
    discordRoleName: mapping.discordRoleName,
    mappedFamilyRole: mapping.familyRole,
    rank: mapping.rank,
    permissions: mapping.permissions,
    priority: mapping.priority,
    enabled: mapping.enabled,
    mappingType: mapping.mappingType,
  };
}

function normalizeApplyResult(result: Awaited<ReturnType<DiscordMemberSyncApplyService['apply']>>): DiscordSyncApplyResult {
  return {
    syncRunId: result.syncRunId,
    planId: result.applyRequest.planId,
    guildId: result.dryRun.guildId,
    appliedAt: result.generatedAt,
    status: result.status,
    summary: result.summary,
    created: result.created,
    updated: result.updated,
    deactivated: result.deactivated,
    reactivated: result.reactivated,
    skipped: result.skipped,
    conflicts: result.conflicts,
    warnings: result.warnings,
    errors: result.errors,
    auditEntries: result.auditEntries,
  };
}

function countValue(counts: Record<string, number> | Partial<DiscordSyncSummary>, key: string): number | null {
  const value = counts[key as keyof typeof counts];
  return typeof value === 'number' ? value : null;
}
