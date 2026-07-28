import { describe, expect, it } from 'vitest';
import { createTestConfig } from '../test/test-config.js';
import type { DiscordMemberSyncApplyRequest, DiscordMemberSyncApplyService } from './member-sync-apply-service.js';
import type { DiscordMemberSyncDryRunService } from './member-sync-dry-run-service.js';
import type { DiscordRoleMappingRepository } from './role-mapping-repository.js';
import { InMemoryDiscordSyncAuditRepository } from './sync-audit-repository.js';
import { DiscordSyncEngineError, DiscordSyncEngineService, normalizeDiscordSyncPlan } from './sync-engine-service.js';
import type { DiscordMemberSyncDryRunItem, DiscordMemberSyncDryRunResult } from '../types.js';

const GENERATED_AT = '2026-07-28T15:14:00.000Z';
const EXPIRES_AT = '2026-07-28T15:19:00.000Z';
const PLAN_ID = 'c'.repeat(32);
const PLAN_HASH = 'd'.repeat(64);

function dryRunResult(actions: DiscordMemberSyncDryRunItem[] = []): DiscordMemberSyncDryRunResult {
  return {
    planId: PLAN_ID,
    generatedAt: GENERATED_AT,
    planExpiresAt: EXPIRES_AT,
    planHash: PLAN_HASH,
    guildId: 'guild-1',
    discordMemberCount: actions.filter((action) => action.action !== 'deactivate_candidate').length,
    familyMemberCount: 1,
    summary: {
      create: actions.filter((action) => action.action === 'create').length,
      update: actions.filter((action) => action.action === 'update').length,
      unchanged: actions.filter((action) => action.action === 'unchanged').length,
      deactivate_candidate: actions.filter((action) => action.action === 'deactivate_candidate').length,
      conflict: actions.filter((action) => action.action === 'conflict').length,
      ignored_bot: actions.filter((action) => action.action === 'ignored_bot').length,
    },
    actions,
    warnings: [],
    conflicts: [],
    missingRoleMappings: ['unmapped-role'],
  };
}

function syncAction(input: Partial<DiscordMemberSyncDryRunItem> = {}): DiscordMemberSyncDryRunItem {
  return {
    action: 'update',
    reason: 'matched_member_differs',
    discordMember: {
      discordUserId: 'discord-1',
      username: 'discord.user',
      globalName: 'Discord User',
      serverNickname: 'Dragon [100]',
      avatarUrl: null,
      guildId: 'guild-1',
      roleIds: ['role-1'],
      joinedAt: GENERATED_AT,
      bot: false,
    },
    familyMember: {
      id: 'member-1',
      nickname: 'Dragon',
      staticId: '100',
      role: 'member',
      rank: 1,
      status: 'active',
      permissions: [],
      deletedAt: null,
      discordUserId: null,
    },
    matchedBy: 'static_id',
    primaryRank: {
      discordRoleId: 'role-1',
      discordRoleName: 'Guard',
      familyRole: 'member',
      rank: 1,
      permissions: [],
      priority: 10,
    },
    proposedRole: undefined,
    promotionRank: 1,
    primaryDiscordRoleId: 'role-1',
    primaryDiscordRoleName: 'Guard',
    additionalRoles: [],
    effectivePermissions: [],
    matchedIgnoredRoles: [],
    permissionSources: {
      systemRolePermissions: [],
      discordMappedPermissions: [],
      manualGrantedPermissions: [],
      manualDeniedPermissions: [],
      protectedPermissions: [],
    },
    changes: [{ field: 'discord_user_id', current: null, proposed: 'discord-1' }],
    warnings: [],
    possibleManualLinkFamilyMemberIds: [],
    ...input,
  };
}

function dryRunService(result: DiscordMemberSyncDryRunResult): DiscordMemberSyncDryRunService {
  return {
    run: async () => result,
  } as DiscordMemberSyncDryRunService;
}

function applyService(calls: Array<Record<string, unknown>>): DiscordMemberSyncApplyService {
  return {
    apply: async (request: DiscordMemberSyncApplyRequest) => {
      calls.push(request);
      return {
        syncRunId: 'sync-1',
        idempotencyKey: request.idempotencyKey,
        applyRequest: request,
        generatedAt: GENERATED_AT,
        mode: 'apply',
        status: 'succeeded',
        dryRun: dryRunResult([syncAction({ action: 'unchanged', changes: [] })]),
        summary: { created: 0, updated: 0, skipped: 1, inactive: 0, reactivated: 0, conflicts: 0, warnings: 0, errors: 0, auditEntries: 0 },
        created: [],
        updated: [],
        deactivated: [],
        reactivated: [],
        skipped: ['member-1'],
        conflicts: [],
        warnings: [],
        errors: [],
        auditEntries: 0,
        reportPath: '',
      };
    },
    getLatestReport: async () => null,
  } as unknown as DiscordMemberSyncApplyService;
}

function serviceFor(result: DiscordMemberSyncDryRunResult, calls: Array<Record<string, unknown>> = []) {
  const audit = new InMemoryDiscordSyncAuditRepository();
  const roleMappings = {
    list: async () => [
      {
        discordRoleId: 'role-1',
        discordRoleName: 'Guard',
        mappingType: 'primary_hierarchy' as const,
        familyRole: 'member' as const,
        rank: 1,
        permissions: [],
        priority: 10,
        grantsPermissions: false,
        metadata: {},
        enabled: true,
        createdAt: GENERATED_AT,
        updatedAt: GENERATED_AT,
      },
    ],
    getByDiscordRoleId: async () => null,
    save: async () => {
      throw new Error('save is not used by this test');
    },
    deleteByDiscordRoleId: async () => false,
    clear: async () => undefined,
  } as DiscordRoleMappingRepository;
  return {
    audit,
    service: new DiscordSyncEngineService(dryRunService(result), applyService(calls), roleMappings, audit, createTestConfig()),
  };
}

describe('DiscordSyncEngineService', () => {
  it('normalizes existing dry-run output into an auditable synchronization plan', () => {
    const plan = normalizeDiscordSyncPlan(dryRunResult([syncAction()]), createTestConfig());

    expect(plan.planId).toBe(PLAN_ID);
    expect(plan.snapshotFingerprint).toBe(PLAN_HASH);
    expect(plan.items[0]?.match.method).toBe('static-id');
    expect(plan.items[0]?.proposedFieldChanges[0]?.field).toBe('discord_user_id');
    expect(plan.summary.update).toBe(1);
  });

  it('turns nickname-only possible matches into blocking manual-review conflicts', () => {
    const plan = normalizeDiscordSyncPlan(
      dryRunResult([
        syncAction({
          action: 'create',
          matchedBy: 'none',
          familyMember: undefined,
          possibleManualLinkFamilyMemberIds: ['member-1'],
        }),
      ]),
      createTestConfig(),
    );

    expect(plan.summary.create).toBe(0);
    expect(plan.summary.conflict).toBe(1);
    expect(plan.summary.blocked).toBe(1);
    expect(plan.items[0]?.match.method).toBe('nickname-suggestion');
    expect(plan.items[0]?.safeToApply).toBe(false);
  });

  it('saves server-generated dry-run plans and applies by plan ID without trusting client mutations', async () => {
    const calls: Array<Record<string, unknown>> = [];
    const { service } = serviceFor(dryRunResult([syncAction({ action: 'unchanged', changes: [] })]), calls);
    const plan = await service.generateDryRunPlan('owner-1', new Date(GENERATED_AT));
    const result = await service.applyPlan(plan.planId, 'discord-sync-test-key', 'owner-1', new Date(GENERATED_AT));

    expect(result.syncRunId).toBe('sync-1');
    expect(calls[0]).toMatchObject({
      confirm: true,
      planId: PLAN_ID,
      planGeneratedAt: GENERATED_AT,
      planExpiresAt: EXPIRES_AT,
      planHash: PLAN_HASH,
    });
  });

  it('rejects stale, already-applied and blocking-conflict plans', async () => {
    const { service } = serviceFor(dryRunResult([syncAction({ action: 'conflict', reason: 'missing_primary_hierarchy_role' })]));
    const plan = await service.generateDryRunPlan('owner-1', new Date(GENERATED_AT));

    await expect(service.applyPlan(plan.planId, 'discord-sync-test-key', 'owner-1', new Date(GENERATED_AT))).rejects.toMatchObject({
      code: 'discord_sync_plan_has_blocking_conflicts',
    } satisfies Partial<DiscordSyncEngineError>);

    const safe = serviceFor(dryRunResult([syncAction({ action: 'unchanged', changes: [] })]));
    const safePlan = await safe.service.generateDryRunPlan('owner-1', new Date(GENERATED_AT));
    await safe.service.applyPlan(safePlan.planId, 'discord-sync-test-key-1', 'owner-1', new Date(GENERATED_AT));
    await expect(safe.service.applyPlan(safePlan.planId, 'discord-sync-test-key-2', 'owner-1', new Date(GENERATED_AT))).rejects.toMatchObject({
      code: 'discord_sync_plan_already_applied',
    });

    const stale = serviceFor(dryRunResult([syncAction({ action: 'unchanged', changes: [] })]));
    const stalePlan = await stale.service.generateDryRunPlan('owner-1', new Date(GENERATED_AT));
    await expect(stale.service.applyPlan(stalePlan.planId, 'discord-sync-test-key-3', 'owner-1', new Date('2026-07-28T15:20:00.000Z'))).rejects.toMatchObject({
      code: 'discord_sync_plan_stale',
    });
  });

  it('exposes role mapping snapshots and audit history for frontend control surfaces', async () => {
    const { service } = serviceFor(dryRunResult([syncAction({ action: 'unchanged', changes: [] })]));
    await service.generateDryRunPlan('owner-1', new Date(GENERATED_AT));

    const mappings = await service.listRoleMappings();
    const history = await service.listHistory();

    expect(mappings[0]).toMatchObject({ discordRoleId: 'role-1', mappingType: 'primary_hierarchy', priority: 10 });
    expect(history[0]).toMatchObject({ mode: 'dry-run', planId: PLAN_ID, initiatedByMemberId: 'owner-1' });
  });
});
