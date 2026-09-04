import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { DRAGON_EVENT_MOCK_DATA } from '../entrypoints/dashboard/family/dragon-event-mock-data.ts';
import { mapDragonEventsToCalendarEvents } from '../entrypoints/dashboard/family/dragon-event-service.ts';
import { DRAGON_TOWER_DEFENSE_MOCK_DATA } from '../entrypoints/dashboard/family/tower-defense-mock-data.ts';
import {
  DRAGON_TOWER_DEFENSE_TRANSITIONS,
  DragonTowerDefenseDomainError,
  assignDragonDefenseCommander,
  buildDragonFireGuardRoster,
  buildDragonTowerDefenseStableEventKey,
  buildTowerDefenseCompletionOutput,
  buildTowerDefenseProfileTimeline,
  calculateDragonDefenseReadiness,
  cancelDragonDefense,
  completeDragonDefense,
  confirmDragonDefenseAttendance,
  createDragonTowerDefense,
  editDragonTowerDefense,
  getDragonTowerDefenseStatistics,
  preventDuplicateActiveDefenseForEvent,
  projectTowerDefenseToDragonEvent,
  reconcileTowerDefenseEvent,
  respondToDragonDefense,
  startDragonDefense,
  transitionDragonDefense,
  withdrawDragonDefenseResponse
} from '../entrypoints/dashboard/family/tower-defense-service.ts';
import { mapBackendFireGuardRosterEntry, mapBackendTower, mapBackendTowerDefense } from '../lib/family-tower-defense-backend-mapper.ts';
import { assertBackendDefenseListResponse } from '../lib/family-tower-defense-backend-response.ts';
import { loadDragonTowerDefenseReadState } from '../lib/family-tower-defense-read-adapter.ts';

const modelsSource = readFileSync(new URL('../entrypoints/dashboard/family/tower-defense-models.ts', import.meta.url), 'utf8');
const repositorySource = readFileSync(new URL('../entrypoints/dashboard/family/tower-defense-repository.ts', import.meta.url), 'utf8');
const compositionSource = readFileSync(new URL('../entrypoints/dashboard/family/tower-defense-composition.ts', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../entrypoints/dashboard/family/tower-defense-service.ts', import.meta.url), 'utf8');
const stateSource = readFileSync(new URL('../entrypoints/dashboard/family/tower-defense-state.ts', import.meta.url), 'utf8');
const screenSource = readFileSync(new URL('../entrypoints/dashboard/family/dragon-tower-defense.tsx', import.meta.url), 'utf8');
const shellSource = readFileSync(new URL('../entrypoints/dashboard/family/family-shell.tsx', import.meta.url), 'utf8');
const roomNavigationSource = readFileSync(new URL('../entrypoints/dashboard/family/room-navigation.ts', import.meta.url), 'utf8');
const hubSource = readFileSync(new URL('../entrypoints/dashboard/family-hub-app.tsx', import.meta.url), 'utf8');
const calendarStateSource = readFileSync(new URL('../entrypoints/dashboard/family/calendar-state.ts', import.meta.url), 'utf8');
const eventModelsSource = readFileSync(new URL('../entrypoints/dashboard/family/dragon-event-models.ts', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const backendClientSource = readFileSync(new URL('../lib/family-tower-defense-backend-client.ts', import.meta.url), 'utf8');
const backendMapperSource = readFileSync(new URL('../lib/family-tower-defense-backend-mapper.ts', import.meta.url), 'utf8');
const backendReadAdapterSource = readFileSync(new URL('../lib/family-tower-defense-read-adapter.ts', import.meta.url), 'utf8');

const now = new Date('2026-07-28T18:14:00+03:00');
const activeDefense = DRAGON_TOWER_DEFENSE_MOCK_DATA.find((defense) => defense.id === 'defense-vespucci-active')!;
const completedDefense = DRAGON_TOWER_DEFENSE_MOCK_DATA.find((defense) => defense.id === 'defense-paleto-history')!;
const backendTower = {
  id: '00000000-0000-4000-8000-000000000201',
  towerCode: 'VSP-04',
  name: 'Vespucci Signal Tower',
  locationLabel: 'Vespucci / western signal line',
  mapMetadata: { x: 24.4, y: 71.8, zone: 'West Coast', backendMapId: 'map_tower_vespucci' },
  imageAssetId: null,
  iconAssetId: null,
  isActive: true,
  externalSource: 'frontend_mock_seed',
  externalId: 'tower-vespucci',
  metadata: { backendLocationId: 'tower_location_vespucci', visual: { icon: 'Tower', markerColor: 'ember' } },
  createdAt: now.toISOString(),
  updatedAt: now.toISOString()
};
const backendDefense = {
  id: '10000000-0000-4000-8000-000000000001',
  tower: backendTower,
  title: 'Backend Vespucci Defense',
  description: 'Backend source of truth',
  status: 'gathering',
  priority: 'critical',
  scheduledAt: now.toISOString(),
  startsAt: now.toISOString(),
  endedAt: null,
  timezone: 'Europe/Kiev',
  phase: 'forming',
  wave: 2,
  commanderFamilyMemberId: 'member-real-1',
  commanderDisplayName: 'Commander',
  createdByFamilyMemberId: 'member-real-1',
  minimumGuardCount: 2,
  recommendedGuardCount: 3,
  maximumGuardCount: 5,
  result: 'pending',
  score: null,
  notes: null,
  failureReason: null,
  completedByFamilyMemberId: null,
  completedAt: null,
  xp: 150,
  leaderboardEligible: true,
  statisticsEligible: true,
  discord: { guildId: null, channelId: null, messageId: null, voiceChannelId: null, syncedAt: null },
  externalSource: null,
  externalId: null,
  syncIdempotencyKey: null,
  eventProjectionKey: 'tower-defense:backend-vespucci',
  metadata: {},
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  responses: [{
    id: '20000000-0000-4000-8000-000000000001',
    defenseId: '10000000-0000-4000-8000-000000000001',
    familyMemberId: 'member-real-2',
    displayName: 'Guard',
    response: 'confirmed',
    respondedAt: now.toISOString(),
    note: null,
    source: 'manual',
    externalSource: null,
    externalId: null,
    idempotencyKey: null,
    metadata: {},
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  }],
  attendance: [{
    id: '30000000-0000-4000-8000-000000000001',
    defenseId: '10000000-0000-4000-8000-000000000001',
    familyMemberId: 'member-real-2',
    displayName: 'Guard',
    status: 'present',
    confirmedByFamilyMemberId: 'member-real-1',
    confirmedAt: now.toISOString(),
    note: null,
    score: 25,
    damageBlocked: 10,
    suppliesUsed: 1,
    contributionNotes: 'held line',
    source: 'manual',
    externalSource: null,
    externalId: null,
    idempotencyKey: null,
    metadata: {},
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  }],
  participantCount: 1,
  confirmedCount: 1,
  presentCount: 1
};

describe('Dragon Tower Defense and Fire Guard', () => {
  it('defines a repository-driven architecture with explicit composition', () => {
    assert.match(repositorySource, /Repository<\s*DragonTowerDefense/);
    assert.match(repositorySource, /mockDragonTowerDefenseRepository/);
    assert.match(compositionSource, /towerDefenseRepository: DragonTowerDefenseRepository/);
    assert.match(compositionSource, /eventRepository: DragonEventRepository/);
    assert.match(compositionSource, /membersRepository: DragonMembersRepository/);
    assert.match(stateSource, /useDragonCollection/);
    assert.match(stateSource, /useDragonTowerDefenseState\(dependencies: DragonTowerDefenseStateDependencies\)/);
    assert.doesNotMatch(screenSource, /DRAGON_TOWER_DEFENSE_MOCK_DATA/);
    assert.doesNotMatch(screenSource, /tower-defense-mock-data/);
    assert.doesNotMatch(screenSource, /mockDragonTowerDefenseRepository/);
  });

  it('models backend-ready defense, roster, rewards, Discord and future metadata', () => {
    [
      'backendDefenseId',
      'eventId',
      'towerId',
      'towerName',
      'towerCode',
      'commanderMemberId',
      'responses',
      'attendance',
      'participantCount',
      'confirmedCount',
      'leaderboardEligible',
      'statisticsEligible',
      'source',
      'discord',
      'backendMetadata'
    ].forEach((field) => assert.match(modelsSource, new RegExp(field)));

    ['draft', 'scheduled', 'gathering', 'active', 'completed', 'cancelled'].forEach((status) => assert.match(modelsSource, new RegExp(status)));
    ['pending', 'defended', 'lost', 'cancelled'].forEach((result) => assert.match(modelsSource, new RegExp(result)));
    ['no-response', 'available', 'joining', 'confirmed', 'unavailable'].forEach((response) => assert.match(modelsSource, new RegExp(response)));
    ['unconfirmed', 'present', 'late', 'absent', 'excused'].forEach((attendance) => assert.match(modelsSource, new RegExp(attendance)));
  });

  it('enforces valid status transitions and rejects invalid transitions with domain errors', () => {
    assert.deepEqual(DRAGON_TOWER_DEFENSE_TRANSITIONS.draft, ['scheduled', 'cancelled']);
    const scheduled = transitionDragonDefense({ ...activeDefense, status: 'scheduled' }, 'gathering', now);
    assert.equal(scheduled.status, 'gathering');

    assert.throws(
      () => transitionDragonDefense({ ...activeDefense, status: 'scheduled' }, 'completed', now),
      (error) => error instanceof DragonTowerDefenseDomainError && error.code === 'invalid_transition'
    );
  });

  it('validates create/edit time ranges and commander assignment', () => {
    const created = createDragonTowerDefense({
      title: 'Захист вишки: Test',
      description: 'Test defense',
      towerId: 'tower-test',
      towerName: 'Test Tower',
      towerCode: 'TST-01',
      location: { label: 'Test zone' },
      map: {},
      startsAt: '2026-07-28T21:00:00+03:00',
      timezone: 'Europe/Kiev',
      commanderMemberId: 'anastasia',
      createdByMemberId: 'anastasia',
      minimumGuardCount: 2,
      recommendedGuardCount: 4,
      maximumGuardCount: 6
    }, now);
    assert.equal(created.status, 'scheduled');
    assert.equal(created.eventId.startsWith('event-'), true);

    const edited = editDragonTowerDefense(created, { towerName: 'Updated Tower' }, now);
    assert.equal(edited.tower.towerName, 'Updated Tower');
    assert.equal(assignDragonDefenseCommander(edited, 'guardians', now).commanderMemberId, 'guardians');

    assert.throws(
      () => createDragonTowerDefense({ ...created, endedAt: '2026-07-28T20:00:00+03:00' }, now),
      (error) => error instanceof DragonTowerDefenseDomainError && error.code === 'invalid_time_range'
    );
  });

  it('keeps response and attendance separate', () => {
    const responded = respondToDragonDefense(activeDefense, 'new-guard', 'confirmed', now, 'On the way');
    assert.equal(responded.responses.find((entry) => entry.memberId === 'new-guard')?.response, 'confirmed');
    assert.equal(responded.attendance.find((entry) => entry.memberId === 'new-guard'), undefined);

    const attended = confirmDragonDefenseAttendance(responded, 'new-guard', 'present', 'anastasia', now);
    assert.equal(attended.attendance.find((entry) => entry.memberId === 'new-guard')?.status, 'present');

    const withdrawn = withdrawDragonDefenseResponse(attended, 'new-guard', now);
    assert.equal(withdrawn.responses.find((entry) => entry.memberId === 'new-guard')?.response, 'no-response');
    assert.equal(withdrawn.attendance.find((entry) => entry.memberId === 'new-guard')?.status, 'present');
  });

  it('calculates readiness, statistics and history-ready completion output', () => {
    assert.equal(calculateDragonDefenseReadiness(activeDefense), 'insufficient');
    assert.equal(calculateDragonDefenseReadiness({ ...activeDefense, responses: [] }), 'critical');
    assert.equal(calculateDragonDefenseReadiness({ ...activeDefense, responses: [{ memberId: 'a', response: 'confirmed' }] }), 'insufficient');

    const statistics = getDragonTowerDefenseStatistics(DRAGON_TOWER_DEFENSE_MOCK_DATA);
    assert.equal(statistics.totalDefenses, 3);
    assert.equal(statistics.defended, 1);
    assert.equal(statistics.successRate, 100);

    const output = buildTowerDefenseCompletionOutput(completedDefense);
    assert.deepEqual(output.participantIds, ['anastasia', 'guardians', 'war-team']);
    assert.equal(output.commanderMemberId, 'anastasia');
    assert.equal(output.leaderboardEligible, true);
  });

  it('supports start, complete, cancel and duplicate active-defense guards', () => {
    const gathering = { ...activeDefense, status: 'gathering' as const };
    const active = startDragonDefense(gathering, now);
    assert.equal(active.status, 'active');
    assert.equal(active.phase, 'combat');

    const completed = completeDragonDefense(active, 'defended', 'anastasia', now, 'Вишку захищено');
    assert.equal(completed.status, 'completed');
    assert.equal(completed.result, 'defended');

    const cancelled = cancelDragonDefense({ ...activeDefense, status: 'scheduled' }, 'anastasia', now, 'No signal');
    assert.equal(cancelled.result, 'cancelled');

    assert.throws(
      () => preventDuplicateActiveDefenseForEvent([{ ...activeDefense, id: 'existing' }], activeDefense),
      (error) => error instanceof DragonTowerDefenseDomainError && error.code === 'duplicate_active_event'
    );
  });

  it('projects and reconciles linked Dragon Events without duplicates', () => {
    const event = projectTowerDefenseToDragonEvent(activeDefense);
    assert.equal(event.id, activeDefense.eventId);
    assert.equal(event.type, 'tower_defense');
    assert.equal(event.towerDefense?.defenseId, activeDefense.id);
    assert.equal(event.towerDefense?.readiness, 'insufficient');
    assert.equal(event.calendar.stableEventKey, buildDragonTowerDefenseStableEventKey(activeDefense));

    const merged = reconcileTowerDefenseEvent([event], { ...activeDefense, title: 'Захист вишки: Updated' });
    assert.equal(merged.length, 1);
    assert.equal(merged[0].title, 'Захист вишки: Updated');
  });

  it('keeps Calendar as an Event Engine consumer and exposes tower defense calendar fields', () => {
    const projected = projectTowerDefenseToDragonEvent(activeDefense);
    const calendarEvents = mapDragonEventsToCalendarEvents([projected]);
    assert.equal(calendarEvents[0].category, 'war_event');
    assert.match(calendarEvents[0].title, /Vespucci/u);

    assert.match(calendarStateSource, /eventRepository: DragonEventRepository/);
    assert.doesNotMatch(calendarStateSource, /tower-defense-mock-data/);
    assert.equal(DRAGON_EVENT_MOCK_DATA.some((event) => event.type === 'tower_defense'), true);
    assert.match(eventModelsSource, /readiness\?: 'critical' \| 'insufficient' \| 'ready' \| 'reinforced'/);
  });

  it('prepares Profile timeline, Achievement and ranking extension outputs', () => {
    const timeline = buildTowerDefenseProfileTimeline([completedDefense], 'anastasia');
    assert.equal(timeline.some((entry) => entry.action === 'attended'), true);
    assert.equal(timeline.some((entry) => entry.action === 'commanded'), true);
    assert.equal(timeline.some((entry) => entry.action === 'defended'), true);

    assert.match(serviceSource, /buildTowerDefenseCompletionOutput/);
    assert.match(serviceSource, /achievementIds/);
    assert.match(serviceSource, /leaderboardEligible/);
    assert.match(serviceSource, /statisticsEligible/);
  });

  it('renders Fire Guard roster from members and keeps manual mock availability explicit', () => {
    const roster = buildDragonFireGuardRoster(activeDefense, [
      {
        id: 'anastasia',
        discordNickname: 'Anastasia_Dragons',
        dragonTitle: 'Commander',
        role: 'volodarka_predvichnoho_polumia',
        rank: 'Owner',
        rankLevel: 6,
        joinedAt: '2025-01-01',
        status: 'online',
        staticId: '1'
      }
    ]);
    assert.equal(roster[0].currentResponse, 'confirmed');
    assert.match(roster[0].onlineStatus?.label ?? '', /Manual\/mock/u);
  });

  it('maps backend towers, defenses, details, roster and preserves backend ids', () => {
    const tower = mapBackendTower(backendTower);
    assert.equal(tower.id, backendTower.id);
    assert.equal(tower.backendTowerId, backendTower.id);
    assert.equal(tower.towerCode, 'VSP-04');
    assert.equal(tower.map.backendMapId, 'map_tower_vespucci');
    assert.equal(tower.source, 'backend');

    const defense = mapBackendTowerDefense(backendDefense);
    assert.equal(defense.id, backendDefense.id);
    assert.equal(defense.backendDefenseId, backendDefense.id);
    assert.equal(defense.dataSource, 'backend');
    assert.equal(defense.tower.towerId, backendTower.id);
    assert.equal(defense.responses[0].backendResponseId, backendDefense.responses[0].id);
    assert.equal(defense.attendance[0].backendAttendanceId, backendDefense.attendance[0].id);
    assert.equal(defense.participantCount, backendDefense.participantCount);
    assert.equal(defense.confirmedCount, backendDefense.confirmedCount);

    const roster = mapBackendFireGuardRosterEntry({
      id: '40000000-0000-4000-8000-000000000001',
      familyMemberId: 'member-real-2',
      displayName: 'Guard',
      role: 'vanguard',
      status: 'active',
      note: null,
      assignedByFamilyMemberId: 'member-real-1',
      discordUserId: null,
      discordUsername: null,
      guildId: null,
      externalSource: null,
      externalId: null,
      metadata: {},
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    }, defense);
    assert.equal(roster.source, 'backend');
    assert.equal(roster.currentResponse, 'confirmed');
    assert.equal(roster.attendance, 'present');
    assert.equal(roster.onlineStatus?.mode, 'api');
    assert.doesNotMatch(roster.onlineStatus?.label ?? '', /Discord live/u);
  });

  it('treats backend empty defense list as authoritative and does not fallback on production backend failure', async () => {
    const empty = await loadDragonTowerDefenseReadState({}, undefined, {
      listTowers: async () => ({ items: [backendTower] }),
      listDefenses: async () => ({ items: [] }),
      listRoster: async () => ({ items: [] }),
      readLocalDefenses: () => DRAGON_TOWER_DEFENSE_MOCK_DATA
    });
    assert.equal(empty.source, 'backend');
    assert.deepEqual(empty.defenses, []);

    const productionFailure = await loadDragonTowerDefenseReadState({}, undefined, {
      listTowers: async () => { throw new Error('offline'); },
      listDefenses: async () => ({ items: [backendDefense] }),
      listRoster: async () => ({ items: [] }),
      readLocalDefenses: () => DRAGON_TOWER_DEFENSE_MOCK_DATA
    });
    assert.equal(productionFailure.source, 'backend_error');
    assert.deepEqual(productionFailure.defenses, []);
    assert.deepEqual(productionFailure.towers, []);
    assert.deepEqual(productionFailure.roster, []);
    assert.equal(productionFailure.error?.message, 'offline');

    const devFallback = await loadDragonTowerDefenseReadState({}, undefined, {
      listTowers: async () => { throw new Error('offline'); },
      listDefenses: async () => ({ items: [backendDefense] }),
      listRoster: async () => ({ items: [] }),
      readLocalDefenses: () => DRAGON_TOWER_DEFENSE_MOCK_DATA,
      allowDevMockFallback: true
    });
    assert.equal(devFallback.source, 'dev_mock_fallback');
    assert.ok(devFallback.defenses.length > 0);
    assert.equal(devFallback.error?.message, 'offline');
  });

  it('rejects malformed backend JSON and maps unknown enums safely', () => {
    assert.throws(() => assertBackendDefenseListResponse({ items: [{ id: 'bad' }] }), /malformed/u);
    const mapped = mapBackendTowerDefense({
      ...backendDefense,
      status: 'unexpected-status',
      priority: 'urgent',
      result: 'mystery',
      phase: 'unknown-phase',
      responses: [{ ...backendDefense.responses[0], response: 'maybe' }],
      attendance: [{ ...backendDefense.attendance[0], status: 'somewhere' }]
    });
    assert.equal(mapped.status, 'draft');
    assert.equal(mapped.priority, 'normal');
    assert.equal(mapped.result, 'pending');
    assert.equal(mapped.phase, 'planning');
    assert.equal(mapped.responses[0].response, 'no-response');
    assert.equal(mapped.attendance[0].status, 'unconfirmed');
  });

  it('uses authenticated backend routes and prevents backend mutation local fallback', () => {
    [
      '/api/family/towers',
      '/api/family/tower-defenses',
      '/api/family/fire-guard-roster',
      '/responses/me/withdraw',
      '/attendance',
      '/start',
      '/complete',
      '/cancel'
    ].forEach((route) => assert.match(backendClientSource, new RegExp(route.replace(/[/?]/g, '\\$&'))));
    assert.match(backendClientSource, /authenticatedFetch/);
    assert.match(backendReadAdapterSource, /source: 'backend_error'/);
    assert.match(backendReadAdapterSource, /source: 'dev_mock_fallback'/);
    assert.match(backendReadAdapterSource, /isTowerDefenseMockFallbackAllowed/);
    assert.match(backendReadAdapterSource, /env\.prod \|\| env\.mode === 'production'/);
    assert.match(compositionSource, /emptyDragonTowerDefenseRepository/);
    assert.match(stateSource, /'backend_loading'/);
    assert.match(stateSource, /backendError/);
    assert.match(stateSource, /backendReadEnabled \? backendRoster \?\? \[\]/);
    assert.match(stateSource, /Tower Defense request is already in progress/);
    assert.match(stateSource, /if \(isBackendDefense\(defense\)\) \{/);
    assert.match(stateSource, /Tower Defense backend operations are unavailable/);
    assert.doesNotMatch(stateSource, /isBackendDefense\(defense\)[\s\S]{0,120}respondToDragonDefense/);
    assert.match(screenSource, /backendDependencyMode/);
    assert.match(screenSource, /\(backendDependencyMode \? '' : 'anastasia'\)/);
    assert.match(screenSource, /requireCurrentFamilyMemberId/);
    assert.match(screenSource, /Tower Defense backend requires an authenticated family member/);
    assert.match(screenSource, /activeBackendTowers/);
    assert.match(screenSource, /backendSubmitBlocked/);
    assert.match(screenSource, /currentFamilyMemberId/);
    assert.doesNotMatch(screenSource, /state\.respond\(defense, 'anastasia'/);
    assert.match(backendMapperSource, /dataSource: 'backend'/);
    assert.match(backendReadAdapterSource, /source: 'backend'/);
  });

  it('adds the navigation entry without replacing Events and uses Dragon UI dialogs', () => {
    assert.match(hubSource, /DRAGON_ROOM_TAB_KEYS/);
    assert.match(roomNavigationSource, /key: 'events'[\s\S]*key: 'tower-defense'[\s\S]*key: 'achievements'/);
    assert.match(roomNavigationSource, /key: 'events'/);
    assert.match(roomNavigationSource, /key: 'tower-defense'/);
    assert.match(roomNavigationSource, /War Chamber/);
    assert.match(shellSource, /activeTab === 'events' \? <DragonEventEngineScreen \/>/);
    assert.match(shellSource, /activeTab === 'tower-defense' \? <DragonTowerDefenseScreen currentUser=\{currentUser\} \/>/);
    assert.match(screenSource, /DragonDialog/);
    assert.doesNotMatch(screenSource, /window\.(prompt|alert|confirm)/);
  });

  it('exports reusable UI components and is included in the source test suite', () => {
    [
      'DragonTowerDefenseScreen',
      'DragonDefenseHero',
      'DragonDefenseCard',
      'DragonDefenseDetails',
      'DragonDefenseForm',
      'DragonFireGuardRoster',
      'DragonGuardMemberRow',
      'DragonReadinessIndicator',
      'DragonDefenseStatusBadge',
      'DragonDefenseTimeline',
      'DragonDefenseHistory',
      'DragonDefenseStatistics',
      'DragonAttendanceEditor',
      'DragonDefenseResultDialog'
    ].forEach((component) => assert.match(screenSource, new RegExp(`export function ${component}`)));
    assert.match(packageJson.scripts['test:auth-source'], /tests\/dragon-tower-defense\.test\.ts/);
  });
});
