import type { FamilyEventRepository } from '../family-events/family-event-repository.js';
import type { FamilyMemberRepository } from '../members/member-repository.js';
import type { FamilyQuestRepository } from '../quests/quest-repository.js';
import type { FamilyQuestRecord, FamilyQuestRewardRecord } from '../quests/quest-models.js';
import type { TowerDefenseRepository } from '../tower-defense/tower-defense-repository.js';
import { AchievementError } from './achievement-errors.js';
import type { AchievementRepository } from './achievement-repository.js';
import type {
  MemberAchievementRecord,
  MemberRewardGrantRecord,
  RewardSourceModule,
} from './achievement-models.js';
import type { RewardAllocationRepository } from './reward-allocation-repository.js';

export type RewardProducerInput = {
  familyMemberId: string;
  rewardKey: string;
  sourceModule: RewardSourceModule;
  sourceId: string;
  sourceSubId?: string | null;
  earnedAt: string;
  metadata?: Record<string, unknown>;
};

export type RewardProducerResult = {
  created: MemberRewardGrantRecord[];
  skipped: Array<{ reason: string; sourceId: string; sourceSubId: string | null }>;
};

export class RewardProducerService {
  constructor(
    private readonly rewards: AchievementRepository,
    private readonly members: FamilyMemberRepository,
    private readonly quests: FamilyQuestRepository | null = null,
    private readonly towerDefenses: TowerDefenseRepository | null = null,
    private readonly familyEvents: FamilyEventRepository | null = null,
    private readonly rewardAllocations: RewardAllocationRepository | null = null,
  ) {}

  async produceEarnedReward(input: RewardProducerInput): Promise<MemberRewardGrantRecord> {
    await this.assertMemberCanReceiveReward(input.familyMemberId);
    const reward = await this.rewards.findRewardDefinitionByKey(input.rewardKey);
    if (!reward || !reward.active) throw new AchievementError('REWARD_NOT_FOUND', 'Reward not found.', 404, { rewardKey: input.rewardKey });
    return this.rewards.grantReward({
      familyMemberId: input.familyMemberId,
      rewardKey: input.rewardKey,
      sourceModule: input.sourceModule,
      sourceId: input.sourceId,
      sourceKey: buildRewardSourceKey(input),
      status: 'earned',
      grantedAt: input.earnedAt,
      approvedAt: null,
      approvedByFamilyMemberId: null,
      issuedAt: null,
      issuedByFamilyMemberId: null,
      metadata: {
        ...(input.metadata ?? {}),
        producer: input.sourceModule,
        sourceSubId: input.sourceSubId ?? null,
      },
    });
  }

  async reconcileQuestRewards(questId: string, now = new Date()): Promise<RewardProducerResult> {
    if (!this.quests) throw new AchievementError('ACHIEVEMENT_SERVICE_UNAVAILABLE', 'Quest repository is unavailable.', 503);
    const quest = await this.quests.findQuestById(questId);
    if (!quest) throw new AchievementError('ACHIEVEMENT_NOT_FOUND', 'Quest not found.', 404, { questId });
    const result = emptyResult();
    for (const reward of quest.rewards) {
      const input = this.questRewardToProducerInput(quest, reward, now);
      if (!input) {
        result.skipped.push({ reason: questRewardSkipReason(quest, reward), sourceId: quest.id, sourceSubId: reward.id });
        continue;
      }
      result.created.push(await this.produceEarnedReward(input));
    }
    return dedupeResult(result);
  }

  async reconcileTowerDefenseRewards(defenseId: string, now = new Date()): Promise<RewardProducerResult> {
    if (!this.towerDefenses) throw new AchievementError('ACHIEVEMENT_SERVICE_UNAVAILABLE', 'Tower Defense repository is unavailable.', 503);
    const defense = await this.towerDefenses.findDefenseById(defenseId);
    if (!defense) throw new AchievementError('ACHIEVEMENT_NOT_FOUND', 'Tower Defense not found.', 404, { defenseId });
    const result = emptyResult();
    if (defense.status !== 'completed') return result;
    if (!this.rewardAllocations) return result;
    for (const allocation of await this.rewardAllocations.listAllocations('tower_defense', defense.id)) {
      result.created.push(await this.produceEarnedReward({
        familyMemberId: allocation.familyMemberId,
        rewardKey: allocation.reward.rewardKey,
        sourceModule: 'tower_defense',
        sourceId: defense.id,
        sourceSubId: allocation.id,
        earnedAt: defense.completedAt ?? defense.endedAt ?? now.toISOString(),
        metadata: {
          ...allocation.metadata,
          allocationId: allocation.id,
          allocationReason: allocation.reason,
          allocationQuantity: allocation.quantity,
          defenseId: defense.id,
          towerCode: defense.tower.towerCode,
          towerName: defense.tower.name,
        },
      }));
    }
    return dedupeResult(result);
  }

  async reconcileFamilyEventRewards(eventId: string, now = new Date()): Promise<RewardProducerResult> {
    if (!this.familyEvents) throw new AchievementError('ACHIEVEMENT_SERVICE_UNAVAILABLE', 'Family Event repository is unavailable.', 503);
    const event = await this.familyEvents.findEventById(eventId);
    if (!event) throw new AchievementError('ACHIEVEMENT_NOT_FOUND', 'Family event not found.', 404, { eventId });
    const result = emptyResult();
    if (event.status !== 'completed') return result;
    if (!this.rewardAllocations) return result;
    for (const allocation of await this.rewardAllocations.listAllocations('events', event.id)) {
      result.created.push(await this.produceEarnedReward({
        familyMemberId: allocation.familyMemberId,
        rewardKey: allocation.reward.rewardKey,
        sourceModule: 'events',
        sourceId: event.id,
        sourceSubId: allocation.id,
        earnedAt: event.completedAt ?? now.toISOString(),
        metadata: {
          ...allocation.metadata,
          allocationId: allocation.id,
          allocationReason: allocation.reason,
          allocationQuantity: allocation.quantity,
          eventId: event.id,
          eventTitle: event.title,
        },
      }));
    }
    return dedupeResult(result);
  }

  async produceAchievementLinkedRewards(award: MemberAchievementRecord, now = new Date()): Promise<RewardProducerResult> {
    const result = emptyResult();
    for (const rewardKey of linkedRewardKeys(award.achievement.ruleMetadata, award.metadata)) {
      result.created.push(await this.produceEarnedReward({
        familyMemberId: award.familyMemberId,
        rewardKey,
        sourceModule: 'achievements',
        sourceId: award.id,
        sourceSubId: rewardKey,
        earnedAt: award.awardedAt ?? now.toISOString(),
        metadata: {
          achievementId: award.achievementId,
          achievementKey: award.achievement.achievementKey,
          achievementAwardId: award.id,
        },
      }));
    }
    return dedupeResult(result);
  }

  private async assertMemberCanReceiveReward(familyMemberId: string): Promise<void> {
    const member = await this.members.findById(familyMemberId);
    if (!member || member.deletedAt || member.status !== 'active') {
      throw new AchievementError('ACHIEVEMENT_MEMBER_NOT_FOUND', 'Family member not found.', 404, { familyMemberId });
    }
  }

  private questRewardToProducerInput(quest: FamilyQuestRecord, reward: FamilyQuestRewardRecord, now: Date): RewardProducerInput | null {
    if (reward.status === 'cancelled') return null;
    if (!reward.questPersonId) return null;
    if (reward.rewardType === 'money' && quest.payouts.some((payout) => payout.questPersonId === reward.questPersonId)) return null;
    const rewardKey = stringMetadata(reward.metadata, 'rewardKey') ?? stringMetadata(reward.metadata, 'reward_key');
    if (!rewardKey) return null;
    const person = quest.people.find((item) => item.id === reward.questPersonId);
    if (!person?.familyMemberId || person.leftAt) return null;
    return {
      familyMemberId: person.familyMemberId,
      rewardKey,
      sourceModule: 'quests',
      sourceId: quest.id,
      sourceSubId: reward.id,
      earnedAt: reward.issuedAt ?? quest.report?.createdAt ?? quest.endsAt ?? quest.updatedAt ?? now.toISOString(),
      metadata: {
        questId: quest.id,
        questTitle: quest.title,
        questPersonId: reward.questPersonId,
        questRewardId: reward.id,
        questRewardType: reward.rewardType,
        questRewardStatus: reward.status,
      },
    };
  }
}

export function buildRewardSourceKey(input: Pick<RewardProducerInput, 'sourceModule' | 'sourceId' | 'sourceSubId' | 'familyMemberId' | 'rewardKey'>): string {
  const sourceSubId = input.sourceSubId ?? input.rewardKey;
  return `reward:${input.sourceModule}:${input.sourceId}:${sourceSubId}:member:${input.familyMemberId}:reward:${input.rewardKey}`;
}

function linkedRewardKeys(...metadataBlocks: Array<Record<string, unknown>>): string[] {
  const keys = new Set<string>();
  for (const metadata of metadataBlocks) {
    const single = stringMetadata(metadata, 'rewardKey') ?? stringMetadata(metadata, 'reward_key');
    if (single) keys.add(single);
    for (const key of stringArrayMetadata(metadata, 'rewardKeys')) keys.add(key);
    for (const key of stringArrayMetadata(metadata, 'reward_keys')) keys.add(key);
    const linked = Array.isArray(metadata.linkedRewards) ? metadata.linkedRewards : [];
    for (const item of linked) {
      if (typeof item === 'string') keys.add(item);
      if (isRecord(item) && typeof item.rewardKey === 'string') keys.add(item.rewardKey);
    }
  }
  return [...keys];
}

function questRewardSkipReason(quest: FamilyQuestRecord, reward: FamilyQuestRewardRecord): string {
  if (reward.status === 'cancelled') return 'cancelled';
  if (!reward.questPersonId) return 'no_member_allocation';
  if (reward.rewardType === 'money' && quest.payouts.some((payout) => payout.questPersonId === reward.questPersonId)) return 'quest_payout_finance_path';
  if (!stringMetadata(reward.metadata, 'rewardKey') && !stringMetadata(reward.metadata, 'reward_key')) return 'missing_reward_key';
  const person = quest.people.find((item) => item.id === reward.questPersonId);
  if (!person?.familyMemberId || person.leftAt) return 'missing_active_member';
  return 'not_authoritative';
}

function emptyResult(): RewardProducerResult {
  return { created: [], skipped: [] };
}

function dedupeResult(result: RewardProducerResult): RewardProducerResult {
  return {
    ...result,
    created: [...new Map(result.created.map((item) => [item.id, item])).values()],
  };
}

function stringMetadata(metadata: Record<string, unknown>, key: string): string | null {
  return typeof metadata[key] === 'string' && metadata[key].trim() ? metadata[key] : null;
}

function stringArrayMetadata(metadata: Record<string, unknown>, key: string): string[] {
  const value = metadata[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
