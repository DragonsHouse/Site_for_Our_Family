import { describe, expect, it } from 'vitest';
import { MemoryFamilyEventRepository } from '../family-events/family-event-repository.js';
import type { FamilyEventRecord } from '../family-events/family-event-models.js';
import { MemoryFamilyMemberRepository } from '../members/member-repository.js';
import { MemoryFamilyQuestRepository } from '../quests/quest-repository.js';
import type { FamilyQuestRecord } from '../quests/quest-models.js';
import { MemoryTowerDefenseRepository } from '../tower-defense/tower-defense-repository.js';
import type { TowerDefenseRecord, TowerRecord } from '../tower-defense/tower-defense-models.js';
import type { FamilyAuthContext, FamilyMember } from '../types.js';
import type { FamilyMemberAccrualRecord } from '../accounting/finance-models.js';
import type { RewardFinanceHandoff, RewardFinanceHandoffInput } from '../accounting/reward-finance-service.js';
import { MemoryAchievementRepository } from './achievement-repository.js';
import { AchievementService } from './achievement-service.js';
import type { AchievementDefinitionRecord, RewardDefinitionRecord } from './achievement-models.js';
import { MemoryRewardAllocationRepository } from './reward-allocation-repository.js';

const memberId = 'member-id';
const ownerId = 'owner-id';

describe('AchievementService', () => {
  it('lists achievement and reward catalogs for active members', async () => {
    const { service } = harness();
    await expect(service.listAchievementDefinitions(auth(memberId))).resolves.toHaveProperty('items.length', 7);
    await expect(service.listRewardDefinitions(auth(memberId))).resolves.toHaveProperty('items.length', 4);
  });

  it('awards non-repeatable achievements once even with different source keys', async () => {
    const { service } = harness();
    const first = await service.awardAchievement({
      familyMemberId: memberId,
      achievementKey: 'tower_first_attended',
      sourceModule: 'tower_defense',
      sourceId: 'defense-1',
      sourceKey: 'achievement:tower_first_attended:member-id:defense-1',
    }, auth(ownerId, 'owner'));
    const sameSource = await service.awardAchievement({
      familyMemberId: memberId,
      achievementKey: 'tower_first_attended',
      sourceModule: 'tower_defense',
      sourceId: 'defense-1',
      sourceKey: 'achievement:tower_first_attended:member-id:defense-1',
    }, auth(ownerId, 'owner'));
    const differentSource = await service.awardAchievement({
      familyMemberId: memberId,
      achievementKey: 'tower_first_attended',
      sourceModule: 'tower_defense',
      sourceId: 'defense-2',
      sourceKey: 'achievement:tower_first_attended:member-id:defense-2',
    }, auth(ownerId, 'owner'));
    expect(sameSource.id).toBe(first.id);
    expect(differentSource.id).toBe(first.id);
  });

  it('allows repeatable achievements with stable source idempotency', async () => {
    const { service } = harness();
    const first = await service.awardAchievement({
      familyMemberId: memberId,
      achievementKey: 'quest_best_participant',
      sourceModule: 'quests',
      sourceId: 'quest-person-1',
      sourceKey: 'achievement:quest_best_participant:member-id:quest-person-1',
    }, auth(ownerId, 'owner'));
    const second = await service.awardAchievement({
      familyMemberId: memberId,
      achievementKey: 'quest_best_participant',
      sourceModule: 'quests',
      sourceId: 'quest-person-2',
      sourceKey: 'achievement:quest_best_participant:member-id:quest-person-2',
    }, auth(ownerId, 'owner'));
    const retry = await service.awardAchievement({
      familyMemberId: memberId,
      achievementKey: 'quest_best_participant',
      sourceModule: 'quests',
      sourceId: 'quest-person-2',
      sourceKey: 'achievement:quest_best_participant:member-id:quest-person-2',
    }, auth(ownerId, 'owner'));
    expect(second.id).not.toBe(first.id);
    expect(retry.id).toBe(second.id);
  });

  it('grants rewards, approves, issues, and prevents duplicate grants by source key', async () => {
    const { service } = harness();
    const first = await service.grantReward({
      familyMemberId: memberId,
      rewardKey: 'event_attendance_badge',
      sourceModule: 'events',
      sourceId: 'event-1',
      sourceKey: 'reward:event_attendance_badge:member-id:event-1',
    }, auth(ownerId, 'owner'));
    const retry = await service.grantReward({
      familyMemberId: memberId,
      rewardKey: 'event_attendance_badge',
      sourceModule: 'events',
      sourceId: 'event-1',
      sourceKey: 'reward:event_attendance_badge:member-id:event-1',
    }, auth(ownerId, 'owner'));
    const approved = await service.approveRewardGrant(first.id, auth(ownerId, 'owner'));
    const approvedRetry = await service.approveRewardGrant(first.id, auth(ownerId, 'owner'));
    const issued = await service.issueRewardGrant(first.id, auth(ownerId, 'owner'));
    const issueRetry = await service.issueRewardGrant(first.id, auth(ownerId, 'owner'));
    expect(retry.id).toBe(first.id);
    expect(approved.status).toBe('approved');
    expect(approvedRetry.id).toBe(approved.id);
    expect(issued.status).toBe('issued');
    expect(issued.issuedByFamilyMemberId).toBe(ownerId);
    expect(issueRetry.id).toBe(issued.id);
  });

  it('rejects impossible reward lifecycle transitions and initial non-earned grants', async () => {
    const { service } = harness();
    await expect(service.grantReward({
      familyMemberId: memberId,
      rewardKey: 'event_attendance_badge',
      sourceModule: 'events',
      sourceId: 'event-1',
      sourceKey: 'reward:event_attendance_badge:member-id:event-1',
      status: 'issued',
    }, auth(ownerId, 'owner'))).rejects.toMatchObject({ code: 'REWARD_TRANSITION_INVALID' });

    const grant = await service.grantReward({
      familyMemberId: memberId,
      rewardKey: 'event_attendance_badge',
      sourceModule: 'events',
      sourceId: 'event-2',
      sourceKey: 'reward:event_attendance_badge:member-id:event-2',
    }, auth(ownerId, 'owner'));
    await expect(service.issueRewardGrant(grant.id, auth(ownerId, 'owner'))).rejects.toMatchObject({ code: 'REWARD_TRANSITION_INVALID' });
    const cancelled = await service.cancelRewardGrant(grant.id, auth(ownerId, 'owner'));
    const cancelledRetry = await service.cancelRewardGrant(grant.id, auth(ownerId, 'owner'));
    expect(cancelled.status).toBe('cancelled');
    expect(cancelledRetry.id).toBe(cancelled.id);
    await expect(service.approveRewardGrant(grant.id, auth(ownerId, 'owner'))).rejects.toMatchObject({ code: 'REWARD_TRANSITION_INVALID' });
    await expect(service.issueRewardGrant(grant.id, auth(ownerId, 'owner'))).rejects.toMatchObject({ code: 'REWARD_TRANSITION_INVALID' });
  });

  it('hands money rewards to accrual finance once without creating payout transactions', async () => {
    const finance = new MemoryRewardFinanceHandoff();
    const { service } = harness({ rewardFinance: finance });
    const grant = await service.grantReward({
      familyMemberId: memberId,
      rewardKey: 'family_bonus_money',
      sourceModule: 'manual',
      sourceId: 'manual-1',
      sourceKey: 'reward:family_bonus_money:member-id:manual-1',
    }, auth(ownerId, 'owner'));
    await service.approveRewardGrant(grant.id, auth(ownerId, 'owner'));
    const issued = await service.issueRewardGrant(grant.id, auth(ownerId, 'owner'));
    const retry = await service.issueRewardGrant(grant.id, auth(ownerId, 'owner'));

    expect(issued.status).toBe('issued');
    expect(issued.financeAccrualId).toBe('accrual-grant-1');
    expect(issued.metadata).toMatchObject({ financeStatus: 'accrued' });
    expect(retry.financeAccrualId).toBe('accrual-grant-1');
    expect(finance.calls).toHaveLength(1);
  });

  it('lists pending reward queue with filters for managers only', async () => {
    const { service } = harness();
    const badge = await service.grantReward({
      familyMemberId: memberId,
      rewardKey: 'event_attendance_badge',
      sourceModule: 'events',
      sourceId: 'event-1',
      sourceKey: 'reward:event_attendance_badge:member-id:event-1',
    }, auth(ownerId, 'owner'));
    await service.grantReward({
      familyMemberId: memberId,
      rewardKey: 'family_bonus_money',
      sourceModule: 'manual',
      sourceId: 'manual-1',
      sourceKey: 'reward:family_bonus_money:member-id:manual-1',
    }, auth(ownerId, 'owner'));
    const all = await service.listPendingRewards({ status: 'earned', limit: 10 }, auth(ownerId, 'owner'));
    const money = await service.listPendingRewards({ status: 'earned', rewardType: 'money', limit: 10 }, auth(ownerId, 'owner'));
    const events = await service.listPendingRewards({ status: 'earned', sourceModule: 'events', limit: 10 }, auth(ownerId, 'owner'));

    expect(all.items).toHaveLength(2);
    expect(money.items).toHaveLength(1);
    expect(events.items.map((item) => item.id)).toEqual([badge.id]);
    await expect(service.listPendingRewards({ status: 'earned', limit: 10 }, auth(memberId))).rejects.toMatchObject({ code: 'ACHIEVEMENT_PERMISSION_DENIED' });
  });

  it('reconciles authoritative Quest reward rows into earned grants without touching payout finance rows', async () => {
    const { service } = harness({ quests: [quest({
      rewards: [{
        id: 'quest-reward-1',
        questId: 'quest-1',
        templateId: null,
        questPersonId: 'quest-person-1',
        rewardType: 'custom',
        title: 'Quest XP entitlement',
        amount: null,
        currency: null,
        quantity: 1,
        status: 'prepared',
        issuedAt: null,
        issuedByFamilyMemberId: null,
        metadata: { rewardKey: 'quest_participation_xp_small' },
        createdAt: '2026-08-10T11:00:00.000Z',
        updatedAt: '2026-08-10T11:00:00.000Z',
      }, {
        id: 'quest-money-reward-1',
        questId: 'quest-1',
        templateId: null,
        questPersonId: 'quest-person-1',
        rewardType: 'money',
        title: 'Money payout path',
        amount: 1250,
        currency: 'USD',
        quantity: null,
        status: 'prepared',
        issuedAt: null,
        issuedByFamilyMemberId: null,
        metadata: { rewardKey: 'family_bonus_money' },
        createdAt: '2026-08-10T11:00:00.000Z',
        updatedAt: '2026-08-10T11:00:00.000Z',
      }],
      payouts: [{
        id: 'quest-payout-1',
        questId: 'quest-1',
        reportId: 'report-1',
        questPersonId: 'quest-person-1',
        familyMemberId: memberId,
        displayName: 'Member',
        amount: 1250,
        rewardPercent: null,
        rewardItems: [],
        bonusAmount: 0,
        bonusPercent: 0,
        status: 'pending',
        paidAt: null,
        paidByFamilyMemberId: null,
        idempotencyKey: null,
        accrualId: null,
        accountingTransactionId: null,
        issuedAt: null,
        issuedByFamilyMemberId: null,
        payoutEventKey: null,
        metadata: {},
        createdAt: '2026-08-10T11:00:00.000Z',
        updatedAt: '2026-08-10T11:00:00.000Z',
      }],
    })] });
    const first = await service.reconcileQuestRewards('quest-1', auth(ownerId, 'owner'));
    const retry = await service.reconcileQuestRewards('quest-1', auth(ownerId, 'owner'));
    const history = await service.listMemberRewards(memberId, auth(memberId));

    expect(first.created).toHaveLength(1);
    expect(retry.created.map((grant) => grant.id)).toEqual(first.created.map((grant) => grant.id));
    expect(first.created[0]).toMatchObject({ status: 'earned', sourceModule: 'quests', sourceId: 'quest-1' });
    expect(first.created[0]?.sourceKey).toContain('reward:quests:quest-1:quest-reward-1:member:member-id:reward:quest_participation_xp_small');
    expect(first.skipped.map((item) => item.reason)).toContain('quest_payout_finance_path');
    expect(history.items).toHaveLength(1);
  });

  it('reconciles Tower Defense and Family Event rewards only from explicit backend allocation rows', async () => {
    const { service, allocations } = harness({
      defenses: [defense({ id: 'defense-1', metadata: { rewardGrants: [{ familyMemberId: memberId, rewardKey: 'tower_defense_xp_small', id: 'legacy-metadata' }] } })],
      events: [event({ metadata: { rewardGrants: [{ familyMemberId: memberId, rewardKey: 'event_attendance_badge', id: 'legacy-metadata' }] } })],
    });
    const towerAllocation = await allocations.createAllocation({
      sourceModule: 'tower_defense',
      sourceId: 'defense-1',
      familyMemberId: memberId,
      rewardDefinitionId: 'tower-xp-id',
      reason: 'Present participant',
      createdByFamilyMemberId: ownerId,
      now: '2026-08-11T10:30:00.000Z',
    });
    await allocations.createAllocation({
      sourceModule: 'events',
      sourceId: 'event-1',
      familyMemberId: memberId,
      rewardDefinitionId: 'event-badge-id',
      reason: 'Event attendee',
      createdByFamilyMemberId: ownerId,
      now: '2026-08-12T10:30:00.000Z',
    });
    const tower = await service.reconcileTowerDefenseRewards('defense-1', auth(ownerId, 'owner'));
    const eventRewards = await service.reconcileFamilyEventRewards('event-1', auth(ownerId, 'owner'));
    const retry = await service.reconcileTowerDefenseRewards('defense-1', auth(ownerId, 'owner'));

    expect(tower.created).toHaveLength(1);
    expect(tower.created[0]).toMatchObject({ status: 'earned', sourceModule: 'tower_defense', sourceId: 'defense-1' });
    expect(tower.created[0]?.sourceKey).toContain(`reward:tower_defense:defense-1:${towerAllocation.id}:member:${memberId}:reward:tower_defense_xp_small`);
    expect(tower.created[0]?.metadata).toMatchObject({ allocationId: towerAllocation.id, allocationReason: 'Present participant' });
    expect(eventRewards.created).toHaveLength(1);
    expect(eventRewards.created[0]).toMatchObject({ status: 'earned', sourceModule: 'events', sourceId: 'event-1' });
    expect(retry.created[0]?.id).toBe(tower.created[0]?.id);
  });

  it('does not invent Tower Defense or Event rewards without authoritative allocations', async () => {
    const { service } = harness({ defenses: [defense({ id: 'defense-1' })], events: [event()] });
    await expect(service.reconcileTowerDefenseRewards('defense-1', auth(memberId))).rejects.toMatchObject({ code: 'ACHIEVEMENT_PERMISSION_DENIED' });
    await expect(service.reconcileFamilyEventRewards('event-1', auth(memberId))).rejects.toMatchObject({ code: 'ACHIEVEMENT_PERMISSION_DENIED' });
    await expect(service.reconcileTowerDefenseRewards('defense-1', auth(ownerId, 'owner'))).resolves.toMatchObject({ created: [] });
    await expect(service.reconcileFamilyEventRewards('event-1', auth(ownerId, 'owner'))).resolves.toMatchObject({ created: [] });
  });

  it('creates achievement-linked earned rewards idempotently after an authoritative award', async () => {
    const repository = new MemoryAchievementRepository([
      { ...achievement('tower_first_attended', 'Watchtower Initiate', 'tower_defense', false), ruleMetadata: { rewardKeys: ['tower_defense_xp_small'] } },
    ], rewardDefinitions());
    const { service } = harness({ achievementRepository: repository });
    const award = await service.awardAchievement({
      familyMemberId: memberId,
      achievementKey: 'tower_first_attended',
      sourceModule: 'tower_defense',
      sourceId: 'defense-1',
      sourceKey: 'achievement:tower_first_attended:member-id:defense-1',
    }, auth(ownerId, 'owner'));
    const retry = await service.awardAchievement({
      familyMemberId: memberId,
      achievementKey: 'tower_first_attended',
      sourceModule: 'tower_defense',
      sourceId: 'defense-1',
      sourceKey: 'achievement:tower_first_attended:member-id:defense-1',
    }, auth(ownerId, 'owner'));
    const rewards = await service.listMemberRewards(memberId, auth(memberId));

    expect(retry.id).toBe(award.id);
    expect(rewards.items).toHaveLength(1);
    expect(rewards.items[0]).toMatchObject({ status: 'earned', sourceModule: 'achievements', sourceId: award.id });
    expect(rewards.items[0]?.issuedAt).toBeNull();
  });

  it('evaluates real domain facts into idempotent achievement awards', async () => {
    const { service } = harness({ quests: [quest()], defenses: [defense()], events: [event()] });
    const first = await service.evaluateMemberAchievements(memberId, auth(ownerId, 'owner'));
    const retry = await service.evaluateMemberAchievements(memberId, auth(ownerId, 'owner'));
    expect(first.awarded.map((award) => award.achievement.achievementKey).sort()).toEqual([
      'event_first_attended',
      'event_organizer',
      'quest_best_participant',
      'quest_first_completed',
      'tower_commander',
      'tower_first_attended',
      'tower_first_defended',
    ]);
    expect(retry.awarded.map((award) => award.id).sort()).toEqual(first.awarded.map((award) => award.id).sort());
  });

  it('projects deterministic leaderboard ranks with period filters and tie handling', async () => {
    const { service } = harness({ quests: [quest()], defenses: [defense()], events: [event()] });
    const current = await service.getLeaderboard('current_month', 'overall', auth(memberId), new Date('2026-08-13T00:00:00.000Z'));
    const previous = await service.getLeaderboard('previous_month', 'overall', auth(memberId), new Date('2026-08-13T00:00:00.000Z'));
    expect(current.items[0]).toMatchObject({ familyMemberId: memberId, place: 1, score: 8 });
    expect(current.items.find((item) => item.familyMemberId === ownerId)).toMatchObject({ place: 2, score: 0 });
    expect(previous.items.every((item) => item.score === 0)).toBe(true);
    expect(previous.items.map((item) => item.place)).toEqual([1, 1]);
  });

  it('enforces permissions for other member reads and management', async () => {
    const { service } = harness();
    await expect(service.listMemberAchievements(ownerId, auth(memberId))).rejects.toMatchObject({ code: 'ACHIEVEMENT_PERMISSION_DENIED' });
    await expect(service.awardAchievement({
      familyMemberId: memberId,
      achievementKey: 'tower_first_attended',
      sourceModule: 'tower_defense',
      sourceId: 'defense-1',
      sourceKey: 'achievement:tower_first_attended:member-id:defense-1',
    }, auth(memberId))).rejects.toMatchObject({ code: 'ACHIEVEMENT_PERMISSION_DENIED' });
  });
});

function harness(input: { quests?: FamilyQuestRecord[]; defenses?: TowerDefenseRecord[]; events?: FamilyEventRecord[]; rewardFinance?: RewardFinanceHandoff | null; achievementRepository?: MemoryAchievementRepository } = {}) {
  const members = new MemoryFamilyMemberRepository([member(memberId, 'Member'), member(ownerId, 'Owner', 'owner', 10)]);
  const achievements = input.achievementRepository ?? new MemoryAchievementRepository(achievementDefinitions(), rewardDefinitions());
  const allocations = new MemoryRewardAllocationRepository(rewardDefinitions());
  const quests = new MemoryFamilyQuestRepository([], input.quests ?? []);
  const tower = towerRecord();
  const defenses = new MemoryTowerDefenseRepository([tower], input.defenses ?? [], [memberId, ownerId], []);
  const events = new MemoryFamilyEventRepository(input.events ?? [], [memberId, ownerId]);
  return { service: new AchievementService(achievements, members, quests, defenses, events, input.rewardFinance ?? null, allocations), achievements, allocations };
}

function auth(id: string, role: FamilyAuthContext['role'] = 'member', rank = role === 'owner' ? 10 : 1): FamilyAuthContext {
  return { familyMemberId: id, role, rank, status: 'active', permissions: role === 'owner' ? ['view_members', 'manage_events', 'manage_accounting'] : [] };
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
    permissions: role === 'owner' ? ['view_members', 'manage_events', 'manage_accounting'] : [],
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

function achievementDefinitions(): AchievementDefinitionRecord[] {
  return [
    achievement('quest_first_completed', 'First Flight', 'quests', false),
    achievement('quest_best_participant', 'Best Participant', 'quests', true),
    achievement('tower_first_attended', 'Watchtower Initiate', 'tower_defense', false),
    achievement('tower_first_defended', 'Watchtower Guardian', 'tower_defense', false),
    achievement('tower_commander', 'Tower Commander', 'leadership', false),
    achievement('event_first_attended', 'Council Voice', 'events', false),
    achievement('event_organizer', 'Event Organizer', 'leadership', false),
  ];
}

function achievement(key: string, name: string, category: AchievementDefinitionRecord['category'], repeatable: boolean): AchievementDefinitionRecord {
  return {
    id: `${key}-id`,
    achievementKey: key,
    name,
    description: name,
    category,
    icon: null,
    imageMetadata: {},
    rarity: 'common',
    active: true,
    repeatable,
    hidden: false,
    ruleMetadata: {},
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
    id: 'quest-xp-id',
    rewardKey: 'quest_participation_xp_small',
    name: 'Quest XP',
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
    id: 'money-id',
    rewardKey: 'family_bonus_money',
    name: 'Family Bonus',
    description: 'Money bonus',
    rewardType: 'money',
    amount: 500,
    value: '500',
    currency: 'USD',
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
  }];
}

class MemoryRewardFinanceHandoff implements RewardFinanceHandoff {
  calls: RewardFinanceHandoffInput[] = [];
  private accrual: FamilyMemberAccrualRecord | null = null;

  async createRewardAccrual(input: RewardFinanceHandoffInput): Promise<FamilyMemberAccrualRecord> {
    this.calls.push(input);
    if (this.accrual) return this.accrual;
    this.accrual = {
      id: 'accrual-grant-1',
      familyMemberId: input.familyMemberId,
      sourceType: 'reward',
      sourceId: input.rewardGrantId,
      sourceKey: `family-member-accrual:reward:${input.rewardGrantId}`,
      amount: input.amount,
      currency: input.currency,
      reason: `Reward entitlement: ${input.rewardName}`,
      status: 'accrued',
      approvedAt: input.issuedAt,
      paidAt: null,
      reportingPeriodStart: null,
      reportingPeriodEnd: null,
      metadata: input.metadata ?? {},
      createdAt: input.issuedAt,
      updatedAt: input.issuedAt,
    };
    return this.accrual!;
  }
}

function quest(overrides: Partial<FamilyQuestRecord> = {}): FamilyQuestRecord {
  const record: FamilyQuestRecord = {
    id: 'quest-1',
    templateId: null,
    title: 'Quest',
    description: '',
    category: 'family',
    status: 'completed',
    startsAt: '2026-08-10T10:00:00.000Z',
    endsAt: '2026-08-10T11:00:00.000Z',
    scheduledAt: null,
    organizerFamilyMemberId: ownerId,
    totalReward: 0,
    memberRewardPool: 0,
    familyReward: 0,
    rewardMode: 'equal',
    requiredItems: null,
    bestParticipantFamilyMemberId: memberId,
    bestParticipantReason: 'Best',
    reportId: 'report-1',
    reportSentToAccountingAt: null,
    paidAt: null,
    paidByFamilyMemberId: null,
    metadata: {},
    createdAt: '2026-08-10T09:00:00.000Z',
    updatedAt: '2026-08-10T11:00:00.000Z',
    people: [{
      id: 'quest-person-1',
      questId: 'quest-1',
      familyMemberId: memberId,
      displayName: 'Member',
      role: 'participant',
      joinedAt: '2026-08-10T09:30:00.000Z',
      leftAt: null,
      joinedLate: false,
      participationNote: null,
      addedManually: false,
      addedByFamilyMemberId: null,
      rewardPercent: null,
      rewardAmount: 0,
      bonusAmount: 0,
      bonusPercent: 0,
      isBestParticipant: true,
      bestParticipantReason: 'Best',
      payoutStatus: 'pending',
      paidAt: null,
      paidByFamilyMemberId: null,
      metadata: {},
      createdAt: '2026-08-10T09:30:00.000Z',
      updatedAt: '2026-08-10T11:00:00.000Z',
    }],
    rewards: [],
    report: { id: 'report-1', questId: 'quest-1', title: 'Report', comment: null, confirmedByFamilyMemberId: ownerId, totalReward: 0, memberRewardPool: 0, familyReward: 0, transferredToAccountingAt: null, metadata: {}, createdAt: '2026-08-10T11:00:00.000Z', updatedAt: '2026-08-10T11:00:00.000Z' },
    payouts: [],
    auditTrail: [],
  };
  return { ...record, ...overrides };
}

function towerRecord(): TowerRecord {
  return { id: 'tower-1', towerCode: 'T1', name: 'Tower', locationLabel: 'HQ', mapMetadata: {}, imageAssetId: null, iconAssetId: null, isActive: true, externalSource: null, externalId: null, metadata: {}, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
}

function defense(overrides: Partial<TowerDefenseRecord> = {}): TowerDefenseRecord {
  const record: TowerDefenseRecord = {
    id: 'defense-1',
    tower: towerRecord(),
    title: 'Defense',
    description: '',
    status: 'completed',
    priority: 'normal',
    scheduledAt: null,
    startsAt: '2026-08-11T10:00:00.000Z',
    endedAt: '2026-08-11T11:00:00.000Z',
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
    completedAt: '2026-08-11T11:00:00.000Z',
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
    updatedAt: '2026-08-11T11:00:00.000Z',
    responses: [],
    attendance: [{ id: 'attendance-1', defenseId: 'defense-1', familyMemberId: memberId, displayName: 'Member', status: 'present', confirmedByFamilyMemberId: ownerId, confirmedAt: '2026-08-11T11:00:00.000Z', note: null, score: null, damageBlocked: null, suppliesUsed: null, contributionNotes: null, source: 'api', externalSource: null, externalId: null, idempotencyKey: null, metadata: {}, createdAt: '2026-08-11T11:00:00.000Z', updatedAt: '2026-08-11T11:00:00.000Z' }],
  };
  return { ...record, ...overrides };
}

function event(overrides: Partial<FamilyEventRecord> = {}): FamilyEventRecord {
  const record: FamilyEventRecord = {
    id: 'event-1',
    title: 'Event',
    description: '',
    eventType: 'family_meeting',
    category: 'meeting',
    status: 'completed',
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
    completedByFamilyMemberId: ownerId,
    completedAt: '2026-08-12T11:00:00.000Z',
    cancelledByFamilyMemberId: null,
    cancelledAt: null,
    metadata: {},
    createdAt: '2026-08-12T09:00:00.000Z',
    updatedAt: '2026-08-12T11:00:00.000Z',
    responses: [{ id: 'event-response-1', eventId: 'event-1', familyMemberId: memberId, displayName: 'Member', response: 'confirmed', respondedAt: '2026-08-12T09:30:00.000Z', note: null, metadata: {}, createdAt: '2026-08-12T09:30:00.000Z', updatedAt: '2026-08-12T09:30:00.000Z' }],
    attendance: [{ id: 'event-attendance-1', eventId: 'event-1', familyMemberId: memberId, displayName: 'Member', status: 'present', confirmedByFamilyMemberId: ownerId, confirmedAt: '2026-08-12T11:00:00.000Z', note: null, metadata: {}, createdAt: '2026-08-12T11:00:00.000Z', updatedAt: '2026-08-12T11:00:00.000Z' }],
  };
  return { ...record, ...overrides };
}
