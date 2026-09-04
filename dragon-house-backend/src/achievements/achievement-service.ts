import type { FamilyMemberRepository } from '../members/member-repository.js';
import type { FamilyQuestRepository } from '../quests/quest-repository.js';
import type { TowerDefenseRepository } from '../tower-defense/tower-defense-repository.js';
import type { FamilyEventRepository } from '../family-events/family-event-repository.js';
import type { FamilyAuthContext, FamilyPermission } from '../types.js';
import type { RewardFinanceHandoff } from '../accounting/reward-finance-service.js';
import { AchievementError } from './achievement-errors.js';
import type { AchievementRepository } from './achievement-repository.js';
import type {
  AchievementDefinitionRecord,
  AwardAchievementInput,
  GrantRewardInput,
  LeaderboardCategory,
  LeaderboardEntry,
  LeaderboardMetrics,
  LeaderboardPeriod,
  LeaderboardResponse,
  MemberAchievementRecord,
  MemberRewardGrantRecord,
  RewardGrantHistoryQuery,
  RewardGrantListItem,
  RewardDefinitionRecord,
  RewardGrantStatus,
} from './achievement-models.js';
import { RewardProducerService, type RewardProducerResult } from './reward-producer-service.js';
import type { RewardAllocationRepository } from './reward-allocation-repository.js';

export const LEADERBOARD_SCORING: Record<keyof LeaderboardMetrics, number> = {
  towerDefenseAttended: 1,
  towerDefenseDefended: 1,
  towerDefenseCommanded: 1,
  questsParticipated: 1,
  questsCompleted: 1,
  questBestParticipant: 1,
  eventsAttended: 1,
  eventsOrganized: 1,
};

export class AchievementService {
  private readonly rewardProducer: RewardProducerService;

  constructor(
    private readonly repository: AchievementRepository,
    private readonly members: FamilyMemberRepository,
    private readonly quests: FamilyQuestRepository,
    private readonly towerDefenses: TowerDefenseRepository,
    private readonly familyEvents: FamilyEventRepository,
    private readonly rewardFinance: RewardFinanceHandoff | null = null,
    rewardAllocations: RewardAllocationRepository | null = null,
  ) {
    this.rewardProducer = new RewardProducerService(repository, members, quests, towerDefenses, familyEvents, rewardAllocations);
  }

  async listAchievementDefinitions(auth: FamilyAuthContext): Promise<{ items: AchievementDefinitionRecord[] }> {
    this.assertActive(auth);
    const items = (await this.repository.listAchievementDefinitions(true)).filter((item) => !item.hidden || canManageAchievements(auth));
    return { items };
  }

  async listRewardDefinitions(auth: FamilyAuthContext): Promise<{ items: RewardDefinitionRecord[] }> {
    this.assertActive(auth);
    const canViewSensitive = canManageRewards(auth);
    const items = (await this.repository.listRewardDefinitions(true)).map((reward) =>
      reward.rewardType === 'money' && !canViewSensitive ? { ...reward, amount: null, currency: null, metadata: {} } : reward,
    );
    return { items };
  }

  async listMemberAchievements(memberId: string, auth: FamilyAuthContext): Promise<{ items: MemberAchievementRecord[] }> {
    await this.assertCanViewMember(memberId, auth);
    return { items: await this.repository.listMemberAchievements(memberId) };
  }

  async listMemberRewards(memberId: string, auth: FamilyAuthContext): Promise<{ items: MemberRewardGrantRecord[]; permissions: { canViewSensitiveRewards: boolean } }> {
    await this.assertCanViewMember(memberId, auth);
    const canViewSensitiveRewards = auth.familyMemberId === memberId || canManageRewards(auth);
    const items = (await this.repository.listMemberRewardGrants(memberId)).map((grant) =>
      grant.reward.rewardType === 'money' && !canViewSensitiveRewards
        ? { ...grant, metadata: {}, reward: { ...grant.reward, amount: null, currency: null, metadata: {} } }
        : grant,
    );
    return { items, permissions: { canViewSensitiveRewards } };
  }

  async listPendingRewards(query: Partial<RewardGrantHistoryQuery>, auth: FamilyAuthContext): Promise<{ items: RewardGrantListItem[] }> {
    this.assertCanManageRewards(auth);
    return {
      items: await this.repository.listRewardGrants({
        status: query.status ?? 'earned',
        rewardType: query.rewardType ?? 'all',
        sourceModule: query.sourceModule ?? 'all',
        memberId: query.memberId ?? null,
        from: query.from ?? null,
        to: query.to ?? null,
        limit: clampLimit(query.limit ?? 50),
      }),
    };
  }

  async awardAchievement(input: Omit<AwardAchievementInput, 'awardedAt'> & { awardedAt?: string }, auth: FamilyAuthContext, now = new Date()): Promise<MemberAchievementRecord> {
    this.assertCanManage(auth);
    await this.assertMemberExists(input.familyMemberId);
    const definition = await this.repository.findAchievementDefinitionByKey(input.achievementKey);
    if (!definition || !definition.active) throw new AchievementError('ACHIEVEMENT_NOT_FOUND', 'Achievement not found.', 404);
    const award = await this.repository.awardAchievement({
      ...input,
      awardedAt: input.awardedAt ?? now.toISOString(),
      awardedByFamilyMemberId: input.awardedByFamilyMemberId ?? auth.familyMemberId,
    });
    await this.rewardProducer.produceAchievementLinkedRewards(award, now);
    return award;
  }

  async grantReward(input: Omit<GrantRewardInput, 'grantedAt'> & { grantedAt?: string }, auth: FamilyAuthContext, now = new Date()): Promise<MemberRewardGrantRecord> {
    this.assertCanManageRewards(auth);
    if (input.status && input.status !== 'earned') {
      throw new AchievementError('REWARD_TRANSITION_INVALID', 'Reward grants must start as earned.', 409, { to: input.status });
    }
    return this.rewardProducer.produceEarnedReward({
      familyMemberId: input.familyMemberId,
      rewardKey: input.rewardKey,
      sourceModule: input.sourceModule,
      sourceId: input.sourceId,
      sourceSubId: typeof input.metadata?.sourceSubId === 'string' ? input.metadata.sourceSubId : null,
      earnedAt: input.grantedAt ?? now.toISOString(),
      metadata: input.metadata,
    });
  }

  async reconcileQuestRewards(questId: string, auth: FamilyAuthContext, now = new Date()): Promise<RewardProducerResult> {
    this.assertCanManageRewards(auth);
    return this.rewardProducer.reconcileQuestRewards(questId, now);
  }

  async reconcileTowerDefenseRewards(defenseId: string, auth: FamilyAuthContext, now = new Date()): Promise<RewardProducerResult> {
    this.assertCanManageRewards(auth);
    return this.rewardProducer.reconcileTowerDefenseRewards(defenseId, now);
  }

  async reconcileFamilyEventRewards(eventId: string, auth: FamilyAuthContext, now = new Date()): Promise<RewardProducerResult> {
    this.assertCanManageRewards(auth);
    return this.rewardProducer.reconcileFamilyEventRewards(eventId, now);
  }

  async updateRewardStatus(id: string, status: RewardGrantStatus, auth: FamilyAuthContext, now = new Date()): Promise<MemberRewardGrantRecord> {
    if (status === 'approved') return this.approveRewardGrant(id, auth, now);
    if (status === 'issued') return this.issueRewardGrant(id, auth, now);
    if (status === 'cancelled') return this.cancelRewardGrant(id, auth, now);
    const grant = await this.requireRewardGrant(id);
    if (grant.status === 'earned') return grant;
    throw new AchievementError('REWARD_TRANSITION_INVALID', 'Reward status transition is not allowed.', 409, { from: grant.status, to: status });
  }

  async approveRewardGrant(id: string, auth: FamilyAuthContext, now = new Date()): Promise<MemberRewardGrantRecord> {
    this.assertCanManageRewards(auth);
    const grant = await this.requireRewardGrant(id);
    if (grant.status === 'approved') return grant;
    if (grant.status !== 'earned') {
      throw new AchievementError('REWARD_TRANSITION_INVALID', 'Reward status transition is not allowed.', 409, { from: grant.status, to: 'approved' });
    }
    const approvedAt = now.toISOString();
    return this.updateRewardGrantOrThrow(id, {
      status: 'approved',
      approvedAt,
      approvedByFamilyMemberId: auth.familyMemberId,
      now: approvedAt,
    });
  }

  async cancelRewardGrant(id: string, auth: FamilyAuthContext, now = new Date()): Promise<MemberRewardGrantRecord> {
    this.assertCanManageRewards(auth);
    const grant = await this.requireRewardGrant(id);
    if (grant.status === 'cancelled') return grant;
    if (grant.status === 'issued') {
      throw new AchievementError('REWARD_TRANSITION_INVALID', 'Reward status transition is not allowed.', 409, { from: grant.status, to: 'cancelled' });
    }
    const cancelledAt = now.toISOString();
    return this.updateRewardGrantOrThrow(id, {
      status: 'cancelled',
      metadata: { cancelledAt, cancelledByFamilyMemberId: auth.familyMemberId },
      now: cancelledAt,
    });
  }

  async issueRewardGrant(id: string, auth: FamilyAuthContext, now = new Date()): Promise<MemberRewardGrantRecord> {
    this.assertCanManageRewards(auth);
    const grant = await this.requireRewardGrant(id);
    if (grant.status === 'cancelled' || grant.status === 'earned') {
      throw new AchievementError('REWARD_TRANSITION_INVALID', 'Reward status transition is not allowed.', 409, { from: grant.status, to: 'issued' });
    }
    const issuedAt = grant.issuedAt ?? now.toISOString();
    const finance = await this.ensureMoneyRewardAccrual(grant, auth, issuedAt);
    if (grant.status === 'issued' && (!finance || grant.financeAccrualId)) return grant;
    return this.updateRewardGrantOrThrow(id, {
      status: 'issued',
      issuedAt,
      issuedByFamilyMemberId: grant.issuedByFamilyMemberId ?? auth.familyMemberId,
      financeAccrualId: finance?.id ?? null,
      financeTransferredAt: finance ? issuedAt : null,
      metadata: finance ? { financeSourceKey: finance.sourceKey, financeStatus: finance.status } : undefined,
      now: issuedAt,
    });
  }

  async evaluateMemberAchievements(memberId: string, auth: FamilyAuthContext, now = new Date()): Promise<{ awarded: MemberAchievementRecord[] }> {
    this.assertCanManage(auth);
    await this.assertMemberExists(memberId);
    const definitions = await this.repository.listAchievementDefinitions(true);
    const keys = new Set(definitions.map((item) => item.achievementKey));
    const [quests, defenses, events] = await Promise.all([
      this.quests.listQuests({ status: 'all' }),
      this.towerDefenses.listDefenses({ status: 'all', result: 'all' }),
      this.familyEvents.listEvents({ status: 'all' }),
    ]);
    const awarded: MemberAchievementRecord[] = [];
    const completedQuest = quests.find((quest) => ['completed', 'reported', 'sent_to_accounting', 'paid'].includes(quest.status) && quest.people.some((person) => person.familyMemberId === memberId && !person.leftAt));
    if (completedQuest && keys.has('quest_first_completed')) {
      awarded.push(await this.awardAchievement(buildEvaluationAward(memberId, 'quest_first_completed', 'quests', completedQuest.id, now), auth, now));
    }
    const bestQuestPerson = quests.flatMap((quest) => quest.people.map((person) => ({ quest, person }))).find(({ person }) => person.familyMemberId === memberId && person.isBestParticipant);
    if (bestQuestPerson && keys.has('quest_best_participant')) {
      awarded.push(await this.awardAchievement(buildEvaluationAward(memberId, 'quest_best_participant', 'quests', bestQuestPerson.person.id, now), auth, now));
    }
    const attendedDefense = defenses.find((defense) => defense.statisticsEligible && defense.status === 'completed' && defense.attendance.some((item) => item.familyMemberId === memberId && ['present', 'late'].includes(item.status)));
    if (attendedDefense && keys.has('tower_first_attended')) {
      awarded.push(await this.awardAchievement(buildEvaluationAward(memberId, 'tower_first_attended', 'tower_defense', attendedDefense.id, now), auth, now));
    }
    const defended = defenses.find((defense) => defense.statisticsEligible && defense.status === 'completed' && defense.result === 'defended' && defense.attendance.some((item) => item.familyMemberId === memberId && ['present', 'late'].includes(item.status)));
    if (defended && keys.has('tower_first_defended')) {
      awarded.push(await this.awardAchievement(buildEvaluationAward(memberId, 'tower_first_defended', 'tower_defense', defended.id, now), auth, now));
    }
    const commanded = defenses.find((defense) => defense.commanderFamilyMemberId === memberId);
    if (commanded && keys.has('tower_commander')) {
      awarded.push(await this.awardAchievement(buildEvaluationAward(memberId, 'tower_commander', 'leadership', commanded.id, now), auth, now));
    }
    const attendedEvent = events.find((event) => event.status === 'completed' && event.attendance.some((item) => item.familyMemberId === memberId && ['present', 'late'].includes(item.status)));
    if (attendedEvent && keys.has('event_first_attended')) {
      awarded.push(await this.awardAchievement(buildEvaluationAward(memberId, 'event_first_attended', 'events', attendedEvent.id, now), auth, now));
    }
    const organizedEvent = events.find((event) => event.organizerFamilyMemberId === memberId);
    if (organizedEvent && keys.has('event_organizer')) {
      awarded.push(await this.awardAchievement(buildEvaluationAward(memberId, 'event_organizer', 'leadership', organizedEvent.id, now), auth, now));
    }
    return { awarded: uniqueById(awarded) };
  }

  async getLeaderboard(period: LeaderboardPeriod, category: LeaderboardCategory, auth: FamilyAuthContext, now = new Date()): Promise<LeaderboardResponse> {
    this.assertActive(auth);
    const [memberPage, quests, defenses, events] = await Promise.all([
      this.members.list({ page: 1, pageSize: 1000, status: 'active', role: null, rank: null, sortBy: 'nickname', sortOrder: 'asc', includeDeleted: false }),
      this.quests.listQuests({ status: 'all' }),
      this.towerDefenses.listDefenses({ status: 'all', result: 'all' }),
      this.familyEvents.listEvents({ status: 'all' }),
    ]);
    const range = getPeriodRange(period, now);
    const entries = memberPage.items.map((member) => {
      const metrics = buildMetrics(member.id, quests, defenses, events, range);
      return {
        familyMemberId: member.id,
        displayName: member.nickname,
        rank: 0,
        place: 0,
        score: scoreMetrics(metrics, category),
        metrics,
      };
    }).sort(compareLeaderboardEntries);
    let currentPlace = 0;
    let previousScore: number | null = null;
    return {
      period,
      category,
      scoring: LEADERBOARD_SCORING,
      items: entries.map((entry, index) => {
        if (previousScore === null || entry.score !== previousScore) currentPlace = index + 1;
        previousScore = entry.score;
        return { ...entry, rank: currentPlace, place: currentPlace };
      }),
    };
  }

  private async assertCanViewMember(memberId: string, auth: FamilyAuthContext): Promise<void> {
    this.assertActive(auth);
    const member = await this.members.findById(memberId);
    if (!member || member.deletedAt) throw new AchievementError('ACHIEVEMENT_MEMBER_NOT_FOUND', 'Family member not found.', 404);
    if (member.status === 'inactive' && !canViewOtherMember(auth)) throw new AchievementError('ACHIEVEMENT_PERMISSION_DENIED', 'Permission denied.', 403);
    if (auth.familyMemberId !== memberId && !canViewOtherMember(auth)) throw new AchievementError('ACHIEVEMENT_PERMISSION_DENIED', 'Permission denied.', 403);
  }

  private async assertMemberExists(memberId: string): Promise<void> {
    const member = await this.members.findById(memberId);
    if (!member || member.deletedAt || member.status !== 'active') throw new AchievementError('ACHIEVEMENT_MEMBER_NOT_FOUND', 'Family member not found.', 404);
  }

  private assertActive(auth: FamilyAuthContext): void {
    if (auth.status !== 'active') throw new AchievementError('ACHIEVEMENT_PERMISSION_DENIED', 'Inactive member.', 403);
  }

  private assertCanManage(auth: FamilyAuthContext): void {
    if (canManageAchievements(auth)) return;
    throw new AchievementError('ACHIEVEMENT_PERMISSION_DENIED', 'Permission denied.', 403);
  }

  private assertCanManageRewards(auth: FamilyAuthContext): void {
    if (canManageRewards(auth)) return;
    throw new AchievementError('ACHIEVEMENT_PERMISSION_DENIED', 'Permission denied.', 403);
  }

  private async requireRewardGrant(id: string): Promise<MemberRewardGrantRecord> {
    const grant = await this.repository.findMemberRewardGrantById(id);
    if (!grant) throw new AchievementError('REWARD_GRANT_NOT_FOUND', 'Reward grant not found.', 404);
    return grant;
  }

  private async updateRewardGrantOrThrow(id: string, input: Parameters<AchievementRepository['updateRewardGrantLifecycle']>[1]): Promise<MemberRewardGrantRecord> {
    const updated = await this.repository.updateRewardGrantLifecycle(id, input);
    if (!updated) throw new AchievementError('REWARD_GRANT_NOT_FOUND', 'Reward grant not found.', 404);
    return updated;
  }

  private async ensureMoneyRewardAccrual(grant: MemberRewardGrantRecord, auth: FamilyAuthContext, issuedAt: string) {
    if (grant.reward.rewardType !== 'money') return null;
    if (grant.financeAccrualId) return null;
    if (!this.rewardFinance) throw new AchievementError('REWARD_FINANCE_HANDOFF_FAILED', 'Reward finance handoff failed.', 503);
    const amount = grant.reward.amount;
    if (!amount || amount <= 0) throw new AchievementError('REWARD_AMOUNT_INVALID', 'Reward amount is invalid.', 409);
    try {
      return await this.rewardFinance.createRewardAccrual({
        rewardGrantId: grant.id,
        familyMemberId: grant.familyMemberId,
        amount,
        currency: grant.reward.currency ?? 'USD',
        rewardName: grant.reward.name,
        issuedByFamilyMemberId: auth.familyMemberId,
        issuedAt,
        metadata: {
          rewardKey: grant.reward.rewardKey,
          sourceModule: grant.sourceModule,
          sourceId: grant.sourceId,
          sourceKey: grant.sourceKey,
        },
      });
    } catch (error) {
      throw new AchievementError('REWARD_FINANCE_HANDOFF_FAILED', 'Reward finance handoff failed.', 503, { cause: error instanceof Error ? error.message : 'unknown' });
    }
  }
}

function canManageAchievements(auth: FamilyAuthContext): boolean {
  return auth.role === 'owner' || auth.rank >= 8 || hasPermission(auth, 'manage_events') || hasPermission(auth, 'manage_family_quests');
}

function canManageRewards(auth: FamilyAuthContext): boolean {
  return auth.role === 'owner' || auth.rank >= 8 || hasPermission(auth, 'manage_rewards') || hasPermission(auth, 'manage_accounting') || hasPermission(auth, 'manage_family_economy');
}

function canViewOtherMember(auth: FamilyAuthContext): boolean {
  return auth.role === 'owner' || hasPermission(auth, 'view_members');
}

function hasPermission(auth: FamilyAuthContext, permission: FamilyPermission): boolean {
  return auth.permissions.includes(permission);
}

function buildEvaluationAward(memberId: string, achievementKey: string, sourceModule: AwardAchievementInput['sourceModule'], sourceId: string, now: Date): Omit<AwardAchievementInput, 'awardedAt'> {
  return {
    familyMemberId: memberId,
    achievementKey,
    sourceModule,
    sourceId,
    sourceKey: `achievement:${achievementKey}:${memberId}:${sourceId}`,
    awardedByFamilyMemberId: null,
    metadata: { evaluatedAt: now.toISOString() },
  };
}

type PeriodRange = { from: string | null; to: string | null };

function getPeriodRange(period: LeaderboardPeriod, now: Date): PeriodRange {
  if (period === 'all_time') return { from: null, to: null };
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const start = period === 'current_month' ? new Date(Date.UTC(year, month, 1)) : new Date(Date.UTC(year, month - 1, 1));
  const end = period === 'current_month' ? new Date(Date.UTC(year, month + 1, 1)) : new Date(Date.UTC(year, month, 1));
  return { from: start.toISOString(), to: end.toISOString() };
}

function inRange(value: string | null | undefined, range: PeriodRange): boolean {
  if (!value) return false;
  if (range.from && value < range.from) return false;
  if (range.to && value >= range.to) return false;
  return true;
}

function buildMetrics(memberId: string, quests: Awaited<ReturnType<FamilyQuestRepository['listQuests']>>, defenses: Awaited<ReturnType<TowerDefenseRepository['listDefenses']>>, events: Awaited<ReturnType<FamilyEventRepository['listEvents']>>, range: PeriodRange): LeaderboardMetrics {
  const completedQuestStatuses = ['completed', 'reported', 'sent_to_accounting', 'paid'];
  const towerDefenseAttended = defenses.filter((defense) => defense.statisticsEligible && defense.attendance.some((attendance) => attendance.familyMemberId === memberId && ['present', 'late'].includes(attendance.status) && inRange(attendance.confirmedAt ?? attendance.updatedAt, range))).length;
  const towerDefenseDefended = defenses.filter((defense) => defense.statisticsEligible && defense.result === 'defended' && inRange(defense.completedAt ?? defense.endedAt ?? defense.updatedAt, range) && defense.attendance.some((attendance) => attendance.familyMemberId === memberId && ['present', 'late'].includes(attendance.status))).length;
  const towerDefenseCommanded = defenses.filter((defense) => defense.leaderboardEligible && defense.commanderFamilyMemberId === memberId && inRange(defense.startsAt, range)).length;
  const memberQuestRows = quests.flatMap((quest) => quest.people.map((person) => ({ quest, person }))).filter(({ person }) => person.familyMemberId === memberId && !person.leftAt);
  const questsParticipated = memberQuestRows.filter(({ person }) => person.role === 'participant' && inRange(person.joinedAt, range)).length;
  const questsCompleted = memberQuestRows.filter(({ quest }) => completedQuestStatuses.includes(quest.status) && inRange(quest.endsAt ?? quest.report?.createdAt ?? quest.updatedAt, range)).length;
  const questBestParticipant = memberQuestRows.filter(({ person, quest }) => person.isBestParticipant && inRange(quest.report?.createdAt ?? person.updatedAt, range)).length;
  const eventsAttended = events.filter((event) => event.attendance.some((attendance) => attendance.familyMemberId === memberId && ['present', 'late'].includes(attendance.status) && inRange(attendance.confirmedAt, range))).length;
  const eventsOrganized = events.filter((event) => event.organizerFamilyMemberId === memberId && inRange(event.startsAt, range)).length;
  return { towerDefenseAttended, towerDefenseDefended, towerDefenseCommanded, questsParticipated, questsCompleted, questBestParticipant, eventsAttended, eventsOrganized };
}

function scoreMetrics(metrics: LeaderboardMetrics, category: LeaderboardCategory): number {
  const keys: Array<keyof LeaderboardMetrics> = category === 'tower_defense'
    ? ['towerDefenseAttended', 'towerDefenseDefended', 'towerDefenseCommanded']
    : category === 'quests'
      ? ['questsParticipated', 'questsCompleted', 'questBestParticipant']
      : category === 'events'
        ? ['eventsAttended', 'eventsOrganized']
        : Object.keys(LEADERBOARD_SCORING) as Array<keyof LeaderboardMetrics>;
  return keys.reduce((total, key) => total + metrics[key] * LEADERBOARD_SCORING[key], 0);
}

function compareLeaderboardEntries(left: LeaderboardEntry, right: LeaderboardEntry): number {
  return right.score - left.score || left.displayName.localeCompare(right.displayName) || left.familyMemberId.localeCompare(right.familyMemberId);
}

function uniqueById(items: MemberAchievementRecord[]): MemberAchievementRecord[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function clampLimit(limit: number): number {
  return Math.min(Math.max(Math.trunc(limit), 1), 100);
}
