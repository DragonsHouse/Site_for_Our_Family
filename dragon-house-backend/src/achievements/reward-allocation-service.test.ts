import { describe, expect, it } from 'vitest';
import { MemoryFamilyEventRepository } from '../family-events/family-event-repository.js';
import { MemoryFamilyMemberRepository } from '../members/member-repository.js';
import { MemoryTowerDefenseRepository } from '../tower-defense/tower-defense-repository.js';
import type { FamilyAuthContext, FamilyMember } from '../types.js';
import { MemoryAchievementRepository } from './achievement-repository.js';
import type { RewardDefinitionRecord } from './achievement-models.js';
import { MemoryRewardAllocationRepository } from './reward-allocation-repository.js';
import { RewardAllocationService } from './reward-allocation-service.js';
import type { FamilyEventRecord } from '../family-events/family-event-models.js';
import type { TowerDefenseRecord, TowerRecord } from '../tower-defense/tower-defense-models.js';

const memberId = 'member-id';
const ownerId = 'owner-id';

describe('RewardAllocationService', () => {
  it('creates, updates, lists, and deletes Tower Defense allocations with duplicate protection', async () => {
    const { service } = harness({ defenses: [defense({ status: 'scheduled' })] });
    const created = await service.createAllocation({
      sourceModule: 'tower_defense',
      sourceId: 'defense-1',
      familyMemberId: memberId,
      rewardDefinitionId: 'tower-xp-id',
      reason: 'Present participant',
    }, auth(ownerId, 'owner'));
    const duplicate = await service.createAllocation({
      sourceModule: 'tower_defense',
      sourceId: 'defense-1',
      familyMemberId: memberId,
      rewardDefinitionId: 'tower-xp-id',
      reason: 'Retry',
    }, auth(ownerId, 'owner'));
    const updated = await service.updateAllocationForSource('tower_defense', 'defense-1', created.id, { reason: 'Updated reason' }, auth(ownerId, 'owner'));
    const list = await service.listAllocations('tower_defense', 'defense-1', auth(memberId));
    const deleted = await service.deleteAllocationForSource('tower_defense', 'defense-1', created.id, auth(ownerId, 'owner'));

    expect(duplicate.id).toBe(created.id);
    expect(updated.reason).toBe('Updated reason');
    expect(list.items).toHaveLength(1);
    expect(deleted.deleted).toBe(true);
    await expect(service.listAllocations('tower_defense', 'defense-1', auth(memberId))).resolves.toHaveProperty('items.length', 0);
  });

  it('creates Family Event allocations for organizers and blocks closed sources', async () => {
    const { service } = harness({ events: [event({ status: 'scheduled' })] });
    const created = await service.createAllocation({
      sourceModule: 'events',
      sourceId: 'event-1',
      familyMemberId: memberId,
      rewardDefinitionId: 'event-badge-id',
      reason: 'Attendance',
    }, auth(memberId));

    expect(created.sourceModule).toBe('events');
    const closed = harness({ events: [event({ status: 'completed' })] });
    await expect(closed.service.createAllocation({
      sourceModule: 'events',
      sourceId: 'event-1',
      familyMemberId: memberId,
      rewardDefinitionId: 'event-badge-id',
    }, auth(ownerId, 'owner'))).rejects.toMatchObject({ code: 'REWARD_TRANSITION_INVALID' });
  });

  it('validates reward definitions, members, source ownership, and permissions', async () => {
    const { service } = harness({ defenses: [defense({ status: 'scheduled' })], events: [event({ status: 'scheduled', organizerFamilyMemberId: ownerId })] });
    await expect(service.createAllocation({
      sourceModule: 'tower_defense',
      sourceId: 'defense-1',
      familyMemberId: memberId,
      rewardDefinitionId: 'inactive-reward-id',
    }, auth(ownerId, 'owner'))).rejects.toMatchObject({ code: 'REWARD_NOT_FOUND' });
    await expect(service.createAllocation({
      sourceModule: 'tower_defense',
      sourceId: 'defense-1',
      familyMemberId: 'missing',
      rewardDefinitionId: 'tower-xp-id',
    }, auth(ownerId, 'owner'))).rejects.toMatchObject({ code: 'ACHIEVEMENT_MEMBER_NOT_FOUND' });
    await expect(service.createAllocation({
      sourceModule: 'events',
      sourceId: 'event-1',
      familyMemberId: memberId,
      rewardDefinitionId: 'event-badge-id',
    }, auth(memberId))).rejects.toMatchObject({ code: 'ACHIEVEMENT_PERMISSION_DENIED' });
  });
});

function harness(input: { defenses?: TowerDefenseRecord[]; events?: FamilyEventRecord[] }) {
  const rewards = rewardDefinitions();
  const members = new MemoryFamilyMemberRepository([member(memberId, 'Member'), member(ownerId, 'Owner', 'owner', 10)]);
  const achievements = new MemoryAchievementRepository([], rewards);
  const allocations = new MemoryRewardAllocationRepository(rewards);
  const tower = new MemoryTowerDefenseRepository([towerRecord()], input.defenses ?? [], [memberId, ownerId], []);
  const events = new MemoryFamilyEventRepository(input.events ?? [], [memberId, ownerId]);
  return { service: new RewardAllocationService(allocations, achievements, members, tower, events), allocations };
}

function auth(id: string, role: FamilyAuthContext['role'] = 'member', rank = role === 'owner' ? 10 : 1): FamilyAuthContext {
  return { familyMemberId: id, role, rank, status: 'active', permissions: role === 'owner' ? ['view_members', 'manage_events', 'manage_rewards'] : [] };
}

function member(id: string, nickname: string, role: FamilyMember['role'] = 'member', rank = role === 'owner' ? 10 : 1): FamilyMember {
  return {
    id,
    nickname,
    staticId: id,
    role,
    rank,
    status: 'active',
    avatarAssetId: null,
    notes: null,
    joinedAt: '2026-01-01T00:00:00.000Z',
    permissions: role === 'owner' ? ['view_members', 'manage_events', 'manage_rewards'] : [],
    permissionsOverride: [],
    permissionsDiscord: [],
    permissionsDenied: [],
    onboardingMetadata: {},
    profileMetadata: {},
    deletedAt: null,
    version: 1,
    createdByFamilyMemberId: null,
    updatedByFamilyMemberId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function rewardDefinitions(): RewardDefinitionRecord[] {
  return [{
    id: 'event-badge-id',
    rewardKey: 'event_attendance_badge',
    name: 'Event Attendance Badge',
    description: 'Badge',
    rewardType: 'badge',
    amount: null,
    value: 'event_attendee',
    currency: null,
    metadata: {},
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }, {
    id: 'tower-xp-id',
    rewardKey: 'tower_defense_xp_small',
    name: 'Tower XP',
    description: 'XP',
    rewardType: 'xp',
    amount: 100,
    value: '100',
    currency: null,
    metadata: {},
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }, {
    id: 'inactive-reward-id',
    rewardKey: 'inactive_reward',
    name: 'Inactive',
    description: 'Inactive',
    rewardType: 'custom',
    amount: null,
    value: null,
    currency: null,
    metadata: {},
    active: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }];
}

function towerRecord(): TowerRecord {
  return { id: 'tower-1', towerCode: 'T1', name: 'Tower', locationLabel: 'HQ', mapMetadata: {}, imageAssetId: null, iconAssetId: null, isActive: true, externalSource: null, externalId: null, metadata: {}, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
}

function defense(overrides: Partial<TowerDefenseRecord> = {}): TowerDefenseRecord {
  return {
    id: 'defense-1',
    tower: towerRecord(),
    title: 'Defense',
    description: '',
    status: 'scheduled',
    priority: 'normal',
    scheduledAt: null,
    startsAt: '2026-08-11T10:00:00.000Z',
    endedAt: null,
    timezone: 'Europe/Kiev',
    phase: 'planning',
    wave: 1,
    commanderFamilyMemberId: memberId,
    commanderDisplayName: 'Member',
    createdByFamilyMemberId: ownerId,
    minimumGuardCount: 1,
    recommendedGuardCount: 1,
    maximumGuardCount: 5,
    result: 'pending',
    score: null,
    notes: null,
    failureReason: null,
    completedByFamilyMemberId: null,
    completedAt: null,
    xp: 100,
    leaderboardEligible: true,
    statisticsEligible: true,
    discord: { guildId: null, channelId: null, messageId: null, voiceChannelId: null, syncedAt: null },
    externalSource: null,
    externalId: null,
    syncIdempotencyKey: null,
    eventProjectionKey: 'tower-defense:defense-1',
    metadata: {},
    createdAt: '2026-08-11T09:00:00.000Z',
    updatedAt: '2026-08-11T09:00:00.000Z',
    responses: [],
    attendance: [],
    ...overrides,
  };
}

function event(overrides: Partial<FamilyEventRecord> = {}): FamilyEventRecord {
  return {
    id: 'event-1',
    title: 'Event',
    description: '',
    eventType: 'family_meeting',
    category: 'meeting',
    status: 'scheduled',
    priority: 'normal',
    startsAt: '2026-08-12T10:00:00.000Z',
    endsAt: '2026-08-12T11:00:00.000Z',
    timezone: 'Europe/Kiev',
    allDay: false,
    locationLabel: 'HQ',
    createdByFamilyMemberId: ownerId,
    createdByDisplayName: 'Owner',
    organizerFamilyMemberId: memberId,
    organizerDisplayName: 'Member',
    maxParticipants: null,
    visibility: 'members',
    notes: null,
    completedByFamilyMemberId: null,
    completedAt: null,
    cancelledByFamilyMemberId: null,
    cancelledAt: null,
    metadata: {},
    createdAt: '2026-08-12T09:00:00.000Z',
    updatedAt: '2026-08-12T09:00:00.000Z',
    responses: [],
    attendance: [],
    ...overrides,
  };
}
