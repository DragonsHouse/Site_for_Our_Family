import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { canApplyPlan, createIdempotencyKey, filterPlanItems } from '../entrypoints/dashboard/family/discord-sync-utils.ts';
import type { DiscordSyncPlan } from '../entrypoints/dashboard/family/discord-sync-models.ts';

const modelsSource = readFileSync(new URL('../entrypoints/dashboard/family/discord-sync-models.ts', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../entrypoints/dashboard/family/discord-sync-service.ts', import.meta.url), 'utf8');
const stateSource = readFileSync(new URL('../entrypoints/dashboard/family/discord-sync-state.ts', import.meta.url), 'utf8');
const screenSource = readFileSync(new URL('../entrypoints/dashboard/family/dragon-discord-sync.tsx', import.meta.url), 'utf8');
const clientSource = readFileSync(new URL('../lib/family-discord-sync-client.ts', import.meta.url), 'utf8');
const typesSource = readFileSync(new URL('../lib/family-discord-sync-types.ts', import.meta.url), 'utf8');
const shellSource = readFileSync(new URL('../entrypoints/dashboard/family/family-shell.tsx', import.meta.url), 'utf8');
const tabsSource = readFileSync(new URL('../entrypoints/dashboard/family/family-tabs.tsx', import.meta.url), 'utf8');
const hubSource = readFileSync(new URL('../entrypoints/dashboard/family-hub-app.tsx', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

function plan(overrides: Partial<DiscordSyncPlan> = {}): DiscordSyncPlan {
  return {
    planId: 'plan-1',
    guildId: 'guild-1',
    generatedAt: '2026-07-28T15:14:00.000Z',
    expiresAt: '2026-07-28T15:19:00.000Z',
    snapshotFingerprint: 'hash',
    summary: {
      total: 3,
      create: 1,
      update: 1,
      unchanged: 0,
      deactivate: 0,
      conflict: 1,
      ignoredBot: 0,
      ignoredUnmapped: 0,
      error: 0,
      safeToApply: 2,
      blocked: 1,
      discordMembers: 3,
      humanMembers: 3,
      familyMembers: 2
    },
    items: [
      item('create', 'Mira', false),
      item('update', 'Anastasia', false),
      item('conflict', 'Ambiguous', true)
    ],
    warnings: [],
    conflicts: [],
    missingRoleMappings: [],
    source: 'live-discord',
    stale: false,
    applied: false,
    ...overrides
  };
}

function item(action: DiscordSyncPlan['items'][number]['action'], name: string, blocking: boolean): DiscordSyncPlan['items'][number] {
  return {
    id: `${action}-${name}`,
    action,
    legacyAction: action,
    reason: action,
    discordUserId: `discord-${name}`,
    discordIdentity: { username: name, globalName: name, serverNickname: name, avatarUrl: null, bot: false },
    matchedFamilyMemberId: blocking ? null : `member-${name}`,
    matchedFamilyMember: blocking
      ? null
      : { id: `member-${name}`, nickname: name, staticId: '1', role: 'member', rank: 1, status: 'active' },
    match: { method: blocking ? 'nickname-suggestion' : 'account-link', familyMemberId: blocking ? null : `member-${name}`, confidence: blocking ? 'suggested' : 'exact', reason: action },
    currentValues: {},
    incomingValues: {},
    proposedFieldChanges: [{ field: 'discord_user_id', current: null, proposed: `discord-${name}` }],
    mappedRoles: { primary: null, additional: [], ignored: [] },
    warnings: [],
    conflicts: blocking ? [{ type: 'no-safe-member-match', message: 'Manual review required', blocking: true }] : [],
    blocking,
    safeToApply: !blocking,
    possibleManualLinkFamilyMemberIds: blocking ? ['member-1'] : []
  };
}

describe('Dragon Discord Synchronization Engine frontend', () => {
  it('defines shared typed DTOs and a Phase 3.3 frontend boundary', () => {
    [
      'DiscordSyncIntegrationStatus',
      'DiscordSyncPlan',
      'DiscordSyncPlanItem',
      'DiscordSyncConflict',
      'DiscordSyncSummary',
      'DiscordSyncApplyResult',
      'DiscordSyncAuditRecord',
      'DiscordTowerDefenseRosterMetadata'
    ].forEach((field) => assert.match(typesSource, new RegExp(field)));

    assert.match(modelsSource, /family-discord-sync-types/);
    assert.match(serviceSource, /createDragonDiscordSyncService/);
    assert.match(stateSource, /useDragonDiscordSyncState/);
    assert.match(stateSource, /DragonDiscordSyncStateDependencies/);
  });

  it('keeps React UI away from direct Discord API and mock synchronization logic', () => {
    assert.doesNotMatch(screenSource, /discord\.com\/api|DISCORD_BOT_TOKEN|fetch\(/);
    assert.doesNotMatch(screenSource, /window\.(prompt|alert|confirm)/);
    assert.match(clientSource, /\/api\/discord\/sync\/plans/);
    assert.match(clientSource, /authenticatedFetch/);
  });

  it('filters plans and disables unsafe apply states', () => {
    assert.equal(filterPlanItems(plan(), 'safe', '').length, 2);
    assert.equal(filterPlanItems(plan(), 'blocked', '').length, 1);
    assert.equal(filterPlanItems(plan(), 'all', 'anastasia').length, 1);
    assert.equal(canApplyPlan(plan()), false);
    assert.equal(canApplyPlan(plan({ summary: { ...plan().summary, blocked: 0, conflict: 0 } })), true);
    assert.equal(canApplyPlan(plan({ stale: true })), false);
    assert.match(createIdempotencyKey('plan-1'), /^discord-sync-plan-1-/);
  });

  it('renders required control surface sections with Dragon UI and hardened dialogs', () => {
    [
      'DragonDiscordSyncScreen',
      'DragonDiscordIntegrationStatus',
      'DragonDiscordSummaryCards',
      'DragonDiscordPlanFilters',
      'DragonDiscordPlanList',
      'DragonDiscordConflictDialog',
      'DragonDiscordApplyDialog',
      'DragonDiscordAuditHistory',
      'DragonDiscordSyncLoadingState',
      'DragonDiscordSyncErrorState'
    ].forEach((component) => assert.match(screenSource, new RegExp(`export function ${component}`)));
    assert.match(screenSource, /DragonDialog/);
    assert.match(screenSource, /canManageDiscordIntegration/);
    assert.match(screenSource, /disabled=\{!sync\.canApply/);
  });

  it('adds administration navigation without replacing Events or Fire Guard', () => {
    assert.match(hubSource, /'resources', 'discord-sync', 'family'/);
    assert.match(tabsSource, /key: 'events'/);
    assert.match(tabsSource, /key: 'tower-defense'/);
    assert.match(tabsSource, /key: 'discord-sync'/);
    assert.match(shellSource, /activeTab === 'events' \? <DragonEventEngineScreen \/>/);
    assert.match(shellSource, /activeTab === 'tower-defense' \? <DragonTowerDefenseScreen \/>/);
    assert.match(shellSource, /activeTab === 'discord-sync' \? <DragonDiscordSyncScreen currentUser=\{currentUser\} \/>/);
  });

  it('is included in the source test suite', () => {
    assert.match(packageJson.scripts['test:auth-source'], /tests\/dragon-discord-sync\.test\.ts/);
  });
});
