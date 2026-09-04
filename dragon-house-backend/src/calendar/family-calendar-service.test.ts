import { describe, expect, it } from 'vitest';
import { MemoryFamilyEventRepository } from '../family-events/family-event-repository.js';
import type { FamilyEventRecord } from '../family-events/family-event-models.js';
import type { FamilyQuestRecord } from '../quests/quest-models.js';
import { MemoryFamilyQuestRepository } from '../quests/quest-repository.js';
import type { TowerDefenseRecord, TowerRecord } from '../tower-defense/tower-defense-models.js';
import { MemoryTowerDefenseRepository } from '../tower-defense/tower-defense-repository.js';
import type { FamilyAuthContext } from '../types.js';
import { FamilyCalendarService } from './family-calendar-service.js';

describe('FamilyCalendarService', () => {
  it('projects standalone events, tower defenses and quests without inserting tower defenses as events', async () => {
    const events = new MemoryFamilyEventRepository([familyEvent()], ['member-id']);
    const towers = new MemoryTowerDefenseRepository([tower()], [defense()], ['member-id']);
    const quests = new MemoryFamilyQuestRepository([], [quest()]);
    const service = new FamilyCalendarService(events, towers, quests);

    const result = await service.listCalendar({ from: '2026-08-01T00:00:00.000Z', to: '2026-08-31T23:59:59.999Z' }, auth());

    expect(result.items.map((item) => item.sourceModule).sort()).toEqual(['family_events', 'family_quests', 'tower_defense']);
    expect(result.items.filter((item) => item.sourceModule === 'family_events')).toHaveLength(1);
    expect(result.items.find((item) => item.sourceModule === 'tower_defense')?.metadata).toMatchObject({ eventProjectionKey: 'tower-defense:key' });
    expect(await events.listEvents({ status: 'all' })).toHaveLength(1);
  });

  it('filters by source module and date range', async () => {
    const service = new FamilyCalendarService(new MemoryFamilyEventRepository([familyEvent()], ['member-id']), new MemoryTowerDefenseRepository([tower()], [defense()], ['member-id']), null);
    const result = await service.listCalendar({ sourceModule: 'family_events', from: '2026-08-18T00:00:00.000Z', to: '2026-08-18T23:59:59.999Z' }, auth());
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.sourceModule).toBe('family_events');
  });
});

function auth(): FamilyAuthContext {
  return { familyMemberId: 'member-id', role: 'member', rank: 1, status: 'active', permissions: [] };
}

function familyEvent(): FamilyEventRecord {
  return {
    id: 'event-id',
    title: 'Standalone Event',
    description: '',
    eventType: 'family_meeting',
    category: 'meeting',
    status: 'scheduled',
    priority: 'normal',
    startsAt: '2026-08-18T18:00:00.000Z',
    endsAt: null,
    timezone: 'Europe/Kiev',
    allDay: false,
    locationLabel: null,
    createdByFamilyMemberId: 'member-id',
    createdByDisplayName: 'Member',
    organizerFamilyMemberId: 'member-id',
    organizerDisplayName: 'Member',
    maxParticipants: null,
    visibility: 'members',
    notes: null,
    completedByFamilyMemberId: null,
    completedAt: null,
    cancelledByFamilyMemberId: null,
    cancelledAt: null,
    metadata: {},
    createdAt: '2026-08-17T18:00:00.000Z',
    updatedAt: '2026-08-17T18:00:00.000Z',
    responses: [],
    attendance: [],
  };
}

function tower(): TowerRecord {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    towerCode: 'LS-01',
    name: 'Tower',
    locationLabel: 'North',
    mapMetadata: {},
    imageAssetId: null,
    iconAssetId: null,
    isActive: true,
    externalSource: null,
    externalId: null,
    metadata: {},
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

function defense(): TowerDefenseRecord {
  return {
    id: 'defense-id',
    tower: tower(),
    title: 'Tower Defense',
    description: '',
    status: 'scheduled',
    priority: 'normal',
    scheduledAt: null,
    startsAt: '2026-08-18T20:00:00.000Z',
    endedAt: null,
    timezone: 'Europe/Kiev',
    phase: 'planning',
    wave: 1,
    commanderFamilyMemberId: 'member-id',
    commanderDisplayName: 'Member',
    createdByFamilyMemberId: 'member-id',
    minimumGuardCount: 1,
    recommendedGuardCount: 1,
    maximumGuardCount: 1,
    result: 'pending',
    score: null,
    notes: null,
    failureReason: null,
    completedByFamilyMemberId: null,
    completedAt: null,
    xp: 0,
    leaderboardEligible: true,
    statisticsEligible: true,
    discord: { guildId: null, channelId: null, messageId: null, voiceChannelId: null, syncedAt: null },
    externalSource: null,
    externalId: null,
    syncIdempotencyKey: null,
    eventProjectionKey: 'tower-defense:key',
    metadata: {},
    createdAt: '2026-08-17T18:00:00.000Z',
    updatedAt: '2026-08-17T18:00:00.000Z',
    responses: [],
    attendance: [],
  };
}

function quest(): FamilyQuestRecord {
  return {
    id: 'quest-id',
    templateId: null,
    title: 'Family Quest',
    description: '',
    category: 'delivery',
    status: 'scheduled',
    startsAt: '2026-08-18T19:00:00.000Z',
    endsAt: null,
    scheduledAt: null,
    organizerFamilyMemberId: 'member-id',
    totalReward: 0,
    memberRewardPool: 0,
    familyReward: 0,
    rewardMode: 'equal',
    requiredItems: null,
    bestParticipantFamilyMemberId: null,
    bestParticipantReason: null,
    reportId: null,
    reportSentToAccountingAt: null,
    paidAt: null,
    paidByFamilyMemberId: null,
    metadata: {},
    createdAt: '2026-08-17T18:00:00.000Z',
    updatedAt: '2026-08-17T18:00:00.000Z',
    people: [],
    rewards: [],
    report: null,
    payouts: [],
    auditTrail: [],
  };
}
