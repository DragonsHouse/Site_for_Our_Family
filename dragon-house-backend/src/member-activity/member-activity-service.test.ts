import { describe, expect, it } from 'vitest';
import { MemoryFamilyMemberRepository } from '../members/member-repository.js';
import { MemoryFamilyQuestRepository } from '../quests/quest-repository.js';
import { MemoryTowerDefenseRepository } from '../tower-defense/tower-defense-repository.js';
import { MemoryFamilyEventRepository } from '../family-events/family-event-repository.js';
import { MemoryAchievementRepository } from '../achievements/achievement-repository.js';
import type { FamilyAuthContext, FamilyMember } from '../types.js';
import type { FamilyQuestRecord } from '../quests/quest-models.js';
import type { TowerDefenseRecord, TowerRecord } from '../tower-defense/tower-defense-models.js';
import type { FamilyEventRecord } from '../family-events/family-event-models.js';
import type { AchievementDefinitionRecord, RewardDefinitionRecord } from '../achievements/achievement-models.js';
import { MemberActivityService, type MemberFinanceSummaryReader } from './member-activity-service.js';

const memberId = 'member-id';
const ownerId = 'owner-id';
const otherId = 'other-id';

describe('MemberActivityService', () => {
  it('projects Tower Defense and Quest facts into deterministic newest-first activity', async () => {
    const { service } = harness();
    const result = await service.listActivity(memberId, { limit: 50 }, auth(memberId));
    expect(result.items.map((item) => item.type)).toEqual([
      'quest_paid',
      'event_completed',
      'event_late',
      'tower_defense_lost',
      'tower_defense_late',
      'tower_defense_defended',
      'tower_defense_attended',
      'tower_defense_commanded',
      'tower_defense_responded',
      'tower_defense_confirmed',
      'quest_reward_earned',
      'quest_best_participant',
      'quest_completed',
      'quest_helped',
      'quest_joined',
      'event_organized',
      'event_joined',
      'event_confirmed',
    ]);
    expect(new Set(result.items.map((item) => item.id)).size).toBe(result.items.length);
    expect(result.items.find((item) => item.type === 'tower_defense_defended')?.xpDelta).toBe(25);
    expect(result.items.find((item) => item.type === 'quest_paid')?.metadata).toMatchObject({ amount: 1250 });
  });

  it('filters activity by module, type and date range', async () => {
    const { service } = harness();
    const byModule = await service.listActivity(memberId, { limit: 20, sourceModule: 'family_quests' }, auth(memberId));
    expect(byModule.items.every((item) => item.sourceModule === 'family_quests')).toBe(true);
    const byType = await service.listActivity(memberId, { limit: 20, type: 'tower_defense_confirmed' }, auth(memberId));
    expect(byType.items).toHaveLength(1);
    expect(byType.items[0]?.type).toBe('tower_defense_confirmed');
    const byDate = await service.listActivity(memberId, {
      limit: 20,
      from: '2026-08-11T00:00:00.000Z',
      to: '2026-08-11T23:59:59.000Z',
    }, auth(memberId));
    expect(byDate.items.map((item) => item.type)).toContain('tower_defense_late');
    expect(byDate.items.map((item) => item.type)).not.toContain('quest_joined');
  });

  it('paginates activity with a cursor and keeps backend empty results honest', async () => {
    const { service } = harness();
    const first = await service.listActivity(memberId, { limit: 2 }, auth(memberId));
    expect(first.items).toHaveLength(2);
    expect(first.pagination.hasMore).toBe(true);
    expect(first.pagination.nextCursor).toBeTruthy();
    const second = await service.listActivity(memberId, { limit: 50, cursor: first.pagination.nextCursor }, auth(memberId));
    expect(second.items[0]?.occurredAt <= first.items[1]!.occurredAt).toBe(true);
    const empty = await service.listActivity('quiet-id', { limit: 10 }, auth('quiet-id'));
    expect(empty.items).toEqual([]);
  });

  it('aggregates reports from authoritative domain data and hides finance without accounting permission', async () => {
    const { service } = harness();
    const report = await service.getReport(memberId, auth(memberId));
    expect(report.quests).toEqual({
      questsParticipated: 1,
      questsHelped: 1,
      questsCompleted: 1,
      bestParticipantCount: 1,
    });
    expect(report.towerDefense).toMatchObject({
      defensesResponded: 1,
      defensesAttended: 2,
      defensesCommanded: 1,
      towersDefended: 1,
      towersLost: 1,
      attendancePresent: 1,
      attendanceLate: 1,
      attendanceAbsent: 0,
      attendanceExcused: 0,
    });
    expect(report.events).toEqual({
      eventsJoined: 1,
      eventsAttended: 1,
      eventsOrganized: 1,
      eventAttendancePresent: 0,
      eventAttendanceLate: 1,
      eventAttendanceAbsent: 0,
      eventAttendanceExcused: 0,
    });
    expect(report.xp).toEqual({ available: true, totalEarned: 55 });
    expect(report.permissions.canViewFinance).toBe(false);
    expect(report.finance).toBeNull();
  });

  it('shows finance totals only to accounting viewers', async () => {
    const { service } = harness();
    const report = await service.getReport(memberId, auth(ownerId, 'owner'));
    expect(report.permissions.canViewFinance).toBe(true);
    expect(report.finance).toEqual({ accruedTotal: 2000, paidTotal: 1250, unpaidTotal: 750, currency: 'USD' });
  });

  it('enforces own and other member permissions and nonexistent member handling', async () => {
    const { service } = harness();
    await expect(service.listActivity(otherId, { limit: 10 }, auth(memberId))).rejects.toMatchObject({ code: 'MEMBER_ACTIVITY_PERMISSION_DENIED' });
    await expect(service.getReport('missing-id', auth(ownerId, 'owner'))).rejects.toMatchObject({ code: 'MEMBER_ACTIVITY_MEMBER_NOT_FOUND' });
    await expect(service.getReport(otherId, auth(ownerId, 'owner'))).resolves.toMatchObject({ memberId: otherId });
  });

  it('returns zero report sections for a member without domain activity', async () => {
    const { service } = harness();
    const report = await service.getReport('quiet-id', auth('quiet-id'));
    expect(report.quests).toEqual({ questsParticipated: 0, questsHelped: 0, questsCompleted: 0, bestParticipantCount: 0 });
    expect(report.towerDefense).toEqual({
      defensesResponded: 0,
      defensesAttended: 0,
      defensesCommanded: 0,
      towersDefended: 0,
      towersLost: 0,
      attendancePresent: 0,
      attendanceLate: 0,
      attendanceAbsent: 0,
      attendanceExcused: 0,
    });
    expect(report.events).toEqual({
      eventsJoined: 0,
      eventsAttended: 0,
      eventsOrganized: 0,
      eventAttendancePresent: 0,
      eventAttendanceLate: 0,
      eventAttendanceAbsent: 0,
      eventAttendanceExcused: 0,
    });
    expect(report.xp).toEqual({ available: false, totalEarned: null });
  });

  it('projects backend achievement and issued reward facts into activity and report aggregates', async () => {
    const achievements = new MemoryAchievementRepository([achievementDefinition()], [rewardDefinition()]);
    await achievements.awardAchievement({
      familyMemberId: memberId,
      achievementKey: 'tower_first_attended',
      sourceModule: 'tower_defense',
      sourceId: 'defense-id',
      sourceKey: 'achievement:tower_first_attended:member-id:defense-id',
      awardedAt: '2026-08-13T10:00:00.000Z',
      awardedByFamilyMemberId: ownerId,
      metadata: {},
    });
    await achievements.grantReward({
      familyMemberId: memberId,
      rewardKey: 'tower_defense_xp_small',
      sourceModule: 'tower_defense',
      sourceId: 'defense-id',
      sourceKey: 'reward:tower_xp:member-id:defense-id',
      status: 'issued',
      grantedAt: '2026-08-13T10:05:00.000Z',
      approvedAt: '2026-08-13T10:05:30.000Z',
      approvedByFamilyMemberId: ownerId,
      issuedAt: '2026-08-13T10:06:00.000Z',
      issuedByFamilyMemberId: ownerId,
      metadata: {},
    });
    const { service } = harness(achievements);
    const activity = await service.listActivity(memberId, { limit: 50 }, auth(memberId));
    expect(activity.items.map((item) => item.type)).toContain('achievement_earned');
    expect(activity.items.map((item) => item.type)).toContain('reward_earned');
    expect(activity.items.map((item) => item.type)).toContain('reward_approved');
    expect(activity.items.map((item) => item.type)).toContain('reward_received');
    expect(activity.items.find((item) => item.type === 'reward_received')?.xpDelta).toBe(100);

    const report = await service.getReport(memberId, auth(memberId));
    expect(report.achievements).toEqual({ achievementsTotal: 1 });
    expect(report.rewards).toEqual({ rewardsEarned: 1, rewardsApproved: 1, rewardsIssued: 1, rewardMoneyEarned: 0 });
  });
});

function harness(achievements?: MemoryAchievementRepository) {
  const members = new MemoryFamilyMemberRepository([
    member({ id: ownerId, role: 'owner', rank: 10 }),
    member({ id: memberId, nickname: 'Member' }),
    member({ id: otherId, nickname: 'Other' }),
    member({ id: 'quiet-id', nickname: 'Quiet' }),
  ]);
  const quests = new MemoryFamilyQuestRepository([], [quest()]);
  const towerDefenses = new MemoryTowerDefenseRepository([tower()], [defendedDefense(), lostDefense()], [ownerId, memberId, otherId, 'quiet-id']);
  const familyEvents = new MemoryFamilyEventRepository([familyEvent()], [ownerId, memberId, otherId, 'quiet-id']);
  const financeReader: MemberFinanceSummaryReader = {
    async getMemberFinanceSummary() {
      return { accruedTotal: 2000, paidTotal: 1250, unpaidTotal: 750, currency: 'USD' };
    },
  };
  return {
    service: new MemberActivityService(members, quests, towerDefenses, financeReader, familyEvents, achievements),
  };
}

function auth(id: string, role: FamilyAuthContext['role'] = 'member'): FamilyAuthContext {
  return {
    familyMemberId: id,
    role,
    rank: role === 'owner' ? 10 : 1,
    status: 'active',
    permissions: role === 'owner' ? ['view_members', 'manage_accounting'] : [],
  };
}

function member(overrides: Partial<FamilyMember>): FamilyMember {
  return {
    id: overrides.id ?? memberId,
    nickname: overrides.nickname ?? overrides.id ?? 'Member',
    staticId: null,
    role: overrides.role ?? 'member',
    rank: overrides.rank ?? 1,
    status: 'active',
    avatarAssetId: null,
    notes: null,
    joinedAt: null,
    permissions: overrides.permissions ?? [],
    permissionsOverride: [],
    permissionsDiscord: [],
    permissionsDenied: [],
    onboardingMetadata: {},
    profileMetadata: {},
    deletedAt: null,
    version: 1,
    createdByFamilyMemberId: null,
    updatedByFamilyMemberId: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function tower(): TowerRecord {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    towerCode: 'LS-01',
    name: 'Legion Square',
    locationLabel: 'Center',
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

function defendedDefense(): TowerDefenseRecord {
  return defense({
    id: '20000000-0000-4000-8000-000000000001',
    title: 'North Tower Defense',
    startsAt: '2026-08-10T10:00:00.000Z',
    completedAt: '2026-08-10T11:00:00.000Z',
    result: 'defended',
    xp: 25,
    responses: [{
      id: '30000000-0000-4000-8000-000000000001',
      defenseId: '20000000-0000-4000-8000-000000000001',
      familyMemberId: memberId,
      displayName: 'Member',
      response: 'confirmed',
      respondedAt: '2026-08-10T09:00:00.000Z',
      note: null,
      source: 'api',
      externalSource: null,
      externalId: null,
      idempotencyKey: null,
      metadata: {},
      createdAt: '2026-08-10T09:00:00.000Z',
      updatedAt: '2026-08-10T09:00:00.000Z',
    }],
    attendance: [{
      id: '40000000-0000-4000-8000-000000000001',
      defenseId: '20000000-0000-4000-8000-000000000001',
      familyMemberId: memberId,
      displayName: 'Member',
      status: 'present',
      confirmedByFamilyMemberId: ownerId,
      confirmedAt: '2026-08-10T10:30:00.000Z',
      note: null,
      score: null,
      damageBlocked: null,
      suppliesUsed: null,
      contributionNotes: null,
      source: 'api',
      externalSource: null,
      externalId: null,
      idempotencyKey: null,
      metadata: {},
      createdAt: '2026-08-10T10:30:00.000Z',
      updatedAt: '2026-08-10T10:30:00.000Z',
    }],
  });
}

function lostDefense(): TowerDefenseRecord {
  return defense({
    id: '20000000-0000-4000-8000-000000000002',
    title: 'South Tower Defense',
    startsAt: '2026-08-11T10:00:00.000Z',
    completedAt: '2026-08-11T11:00:00.000Z',
    result: 'lost',
    commanderFamilyMemberId: otherId,
    xp: 30,
    attendance: [{
      id: '40000000-0000-4000-8000-000000000002',
      defenseId: '20000000-0000-4000-8000-000000000002',
      familyMemberId: memberId,
      displayName: 'Member',
      status: 'late',
      confirmedByFamilyMemberId: ownerId,
      confirmedAt: '2026-08-11T10:45:00.000Z',
      note: null,
      score: null,
      damageBlocked: null,
      suppliesUsed: null,
      contributionNotes: null,
      source: 'api',
      externalSource: null,
      externalId: null,
      idempotencyKey: null,
      metadata: {},
      createdAt: '2026-08-11T10:45:00.000Z',
      updatedAt: '2026-08-11T10:45:00.000Z',
    }],
  });
}

function defense(overrides: Partial<TowerDefenseRecord>): TowerDefenseRecord {
  const id = overrides.id ?? '20000000-0000-4000-8000-000000000099';
  return {
    id,
    tower: tower(),
    title: 'Tower Defense',
    description: '',
    status: 'completed',
    priority: 'normal',
    scheduledAt: null,
    startsAt: '2026-08-10T10:00:00.000Z',
    endedAt: overrides.completedAt ?? '2026-08-10T11:00:00.000Z',
    timezone: 'Europe/Kiev',
    phase: 'closed',
    wave: 1,
    commanderFamilyMemberId: memberId,
    commanderDisplayName: 'Member',
    createdByFamilyMemberId: ownerId,
    minimumGuardCount: 1,
    recommendedGuardCount: 1,
    maximumGuardCount: 5,
    result: 'defended',
    score: null,
    notes: null,
    failureReason: null,
    completedByFamilyMemberId: ownerId,
    completedAt: '2026-08-10T11:00:00.000Z',
    xp: 0,
    leaderboardEligible: true,
    statisticsEligible: true,
    discord: { guildId: null, channelId: null, messageId: null, voiceChannelId: null, syncedAt: null },
    externalSource: null,
    externalId: null,
    syncIdempotencyKey: null,
    eventProjectionKey: `tower-defense:${id}`,
    metadata: {},
    createdAt: '2026-08-10T08:00:00.000Z',
    updatedAt: '2026-08-10T11:00:00.000Z',
    responses: [],
    attendance: [],
    ...overrides,
  };
}

function familyEvent(): FamilyEventRecord {
  return {
    id: 'a0000000-0000-4000-8000-000000000001',
    title: 'Family Training',
    description: '',
    eventType: 'training',
    category: 'training',
    status: 'completed',
    priority: 'normal',
    startsAt: '2026-08-08T18:00:00.000Z',
    endsAt: '2026-08-08T19:00:00.000Z',
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
    completedByFamilyMemberId: ownerId,
    completedAt: '2026-08-11T12:00:00.000Z',
    cancelledByFamilyMemberId: null,
    cancelledAt: null,
    metadata: {},
    createdAt: '2026-08-08T12:00:00.000Z',
    updatedAt: '2026-08-11T12:00:00.000Z',
    responses: [{
      id: 'a1000000-0000-4000-8000-000000000001',
      eventId: 'a0000000-0000-4000-8000-000000000001',
      familyMemberId: memberId,
      displayName: 'Member',
      response: 'confirmed',
      respondedAt: '2026-08-08T13:00:00.000Z',
      note: null,
      metadata: {},
      createdAt: '2026-08-08T13:00:00.000Z',
      updatedAt: '2026-08-08T13:00:00.000Z',
    }],
    attendance: [{
      id: 'a2000000-0000-4000-8000-000000000001',
      eventId: 'a0000000-0000-4000-8000-000000000001',
      familyMemberId: memberId,
      displayName: 'Member',
      status: 'late',
      confirmedByFamilyMemberId: ownerId,
      confirmedAt: '2026-08-11T11:30:00.000Z',
      note: null,
      metadata: {},
      createdAt: '2026-08-11T11:30:00.000Z',
      updatedAt: '2026-08-11T11:30:00.000Z',
    }],
  };
}

function quest(): FamilyQuestRecord {
  return {
    id: '50000000-0000-4000-8000-000000000001',
    templateId: null,
    title: 'Cargo Boom',
    description: '',
    category: 'Business',
    status: 'paid',
    startsAt: '2026-08-09T10:00:00.000Z',
    endsAt: '2026-08-09T12:00:00.000Z',
    scheduledAt: null,
    organizerFamilyMemberId: ownerId,
    totalReward: 2500,
    memberRewardPool: 2500,
    familyReward: 0,
    rewardMode: 'equal',
    requiredItems: null,
    bestParticipantFamilyMemberId: memberId,
    bestParticipantReason: 'Best route',
    reportId: '70000000-0000-4000-8000-000000000001',
    reportSentToAccountingAt: '2026-08-09T13:00:00.000Z',
    paidAt: '2026-08-12T12:00:00.000Z',
    paidByFamilyMemberId: ownerId,
    metadata: {},
    createdAt: '2026-08-09T09:00:00.000Z',
    updatedAt: '2026-08-09T13:00:00.000Z',
    people: [
      questPerson('60000000-0000-4000-8000-000000000001', 'participant'),
      questPerson('60000000-0000-4000-8000-000000000002', 'helper'),
    ],
    rewards: [],
    report: {
      id: '70000000-0000-4000-8000-000000000001',
      questId: '50000000-0000-4000-8000-000000000001',
      title: 'Cargo report',
      comment: null,
      confirmedByFamilyMemberId: ownerId,
      totalReward: 2500,
      memberRewardPool: 2500,
      familyReward: 0,
      transferredToAccountingAt: '2026-08-09T13:00:00.000Z',
      metadata: {},
      createdAt: '2026-08-09T13:00:00.000Z',
      updatedAt: '2026-08-09T13:00:00.000Z',
    },
    payouts: [{
      id: '80000000-0000-4000-8000-000000000001',
      questId: '50000000-0000-4000-8000-000000000001',
      reportId: '70000000-0000-4000-8000-000000000001',
      questPersonId: '60000000-0000-4000-8000-000000000001',
      familyMemberId: memberId,
      displayName: 'Member',
      amount: 1250,
      rewardPercent: null,
      rewardItems: [],
      bonusAmount: 0,
      bonusPercent: 0,
      status: 'paid',
      paidAt: '2026-08-12T12:00:00.000Z',
      paidByFamilyMemberId: ownerId,
      idempotencyKey: 'issue-key-0001',
      accrualId: '90000000-0000-4000-8000-000000000001',
      accountingTransactionId: '91000000-0000-4000-8000-000000000001',
      issuedAt: '2026-08-12T12:00:00.000Z',
      issuedByFamilyMemberId: ownerId,
      payoutEventKey: 'quest-payout:80000000-0000-4000-8000-000000000001',
      metadata: {},
      createdAt: '2026-08-09T13:00:00.000Z',
      updatedAt: '2026-08-12T12:00:00.000Z',
    }],
    auditTrail: [],
  };
}

function questPerson(id: string, role: 'participant' | 'helper') {
  return {
    id,
    questId: '50000000-0000-4000-8000-000000000001',
    familyMemberId: memberId,
    displayName: 'Member',
    role,
    joinedAt: role === 'participant' ? '2026-08-09T09:30:00.000Z' : '2026-08-09T09:45:00.000Z',
    leftAt: null,
    joinedLate: false,
    participationNote: null,
    addedManually: false,
    addedByFamilyMemberId: ownerId,
    rewardPercent: null,
    rewardAmount: role === 'participant' ? 1250 : 0,
    bonusAmount: 0,
    bonusPercent: 0,
    isBestParticipant: role === 'participant',
    bestParticipantReason: role === 'participant' ? 'Best route' : null,
    payoutStatus: role === 'participant' ? 'paid' : 'pending',
    paidAt: role === 'participant' ? '2026-08-12T12:00:00.000Z' : null,
    paidByFamilyMemberId: role === 'participant' ? ownerId : null,
    metadata: {},
    createdAt: '2026-08-09T09:30:00.000Z',
    updatedAt: '2026-08-09T13:00:00.000Z',
  } satisfies FamilyQuestRecord['people'][number];
}

function achievementDefinition(): AchievementDefinitionRecord {
  return {
    id: 'achievement-id',
    achievementKey: 'tower_first_attended',
    name: 'Watchtower Initiate',
    description: 'Attend a completed Tower Defense operation.',
    category: 'tower_defense',
    icon: 'Tower',
    imageMetadata: {},
    rarity: 'common',
    active: true,
    repeatable: false,
    hidden: false,
    ruleMetadata: {},
    createdAt: '2026-08-13T09:00:00.000Z',
    updatedAt: '2026-08-13T09:00:00.000Z',
  };
}

function rewardDefinition(): RewardDefinitionRecord {
  return {
    id: 'reward-id',
    rewardKey: 'tower_defense_xp_small',
    name: 'Tower Defense XP',
    description: 'XP',
    rewardType: 'xp',
    amount: 100,
    value: '100',
    currency: null,
    metadata: {},
    active: true,
    createdAt: '2026-08-13T09:00:00.000Z',
    updatedAt: '2026-08-13T09:00:00.000Z',
  };
}
