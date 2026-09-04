import { randomUUID } from 'node:crypto';
import type {
  AchievementDefinitionRecord,
  AwardAchievementInput,
  GrantRewardInput,
  MemberAchievementRecord,
  MemberRewardGrantRecord,
  RewardGrantHistoryQuery,
  RewardGrantListItem,
  RewardDefinitionRecord,
  RewardGrantStatus,
} from './achievement-models.js';

export interface AchievementRepository {
  listAchievementDefinitions(activeOnly?: boolean): Promise<AchievementDefinitionRecord[]>;
  findAchievementDefinitionByKey(key: string): Promise<AchievementDefinitionRecord | null>;
  listMemberAchievements(memberId: string): Promise<MemberAchievementRecord[]>;
  awardAchievement(input: AwardAchievementInput): Promise<MemberAchievementRecord>;
  listRewardDefinitions(activeOnly?: boolean): Promise<RewardDefinitionRecord[]>;
  findRewardDefinitionByKey(key: string): Promise<RewardDefinitionRecord | null>;
  listMemberRewardGrants(memberId: string): Promise<MemberRewardGrantRecord[]>;
  findMemberRewardGrantById(id: string): Promise<MemberRewardGrantRecord | null>;
  listRewardGrants(query: RewardGrantHistoryQuery): Promise<RewardGrantListItem[]>;
  grantReward(input: GrantRewardInput): Promise<MemberRewardGrantRecord>;
  updateRewardGrantLifecycle(id: string, input: UpdateRewardGrantLifecycleInput): Promise<MemberRewardGrantRecord | null>;
}

export type UpdateRewardGrantLifecycleInput = {
  status: RewardGrantStatus;
  approvedAt?: string | null;
  approvedByFamilyMemberId?: string | null;
  issuedAt?: string | null;
  issuedByFamilyMemberId?: string | null;
  financeAccrualId?: string | null;
  financeTransferredAt?: string | null;
  metadata?: Record<string, unknown>;
  now: string;
};

export class MemoryAchievementRepository implements AchievementRepository {
  private readonly awards: MemberAchievementRecord[] = [];
  private readonly grants: MemberRewardGrantRecord[] = [];

  constructor(
    private readonly achievements: AchievementDefinitionRecord[] = [],
    private readonly rewards: RewardDefinitionRecord[] = [],
  ) {}

  async listAchievementDefinitions(activeOnly = false): Promise<AchievementDefinitionRecord[]> {
    return this.achievements
      .filter((item) => !activeOnly || item.active)
      .sort((left, right) => left.category.localeCompare(right.category) || left.name.localeCompare(right.name));
  }

  async findAchievementDefinitionByKey(key: string): Promise<AchievementDefinitionRecord | null> {
    return this.achievements.find((item) => item.achievementKey === key) ?? null;
  }

  async listMemberAchievements(memberId: string): Promise<MemberAchievementRecord[]> {
    return this.awards.filter((item) => item.familyMemberId === memberId).sort((left, right) => right.awardedAt.localeCompare(left.awardedAt));
  }

  async awardAchievement(input: AwardAchievementInput): Promise<MemberAchievementRecord> {
    const definition = await this.findAchievementDefinitionByKey(input.achievementKey);
    if (!definition) throw new Error('achievement definition not found');
    const existingBySource = this.awards.find((item) => item.sourceKey === input.sourceKey);
    if (existingBySource) return existingBySource;
    if (!definition.repeatable) {
      const existing = this.awards.find((item) => item.familyMemberId === input.familyMemberId && item.achievementId === definition.id);
      if (existing) return existing;
    }
    const record: MemberAchievementRecord = {
      id: randomUUID(),
      familyMemberId: input.familyMemberId,
      achievementId: definition.id,
      sourceModule: input.sourceModule,
      sourceId: input.sourceId,
      sourceKey: input.sourceKey,
      awardedAt: input.awardedAt,
      awardedByFamilyMemberId: input.awardedByFamilyMemberId ?? null,
      metadata: input.metadata ?? {},
      achievement: definition,
      createdAt: input.awardedAt,
    };
    this.awards.push(record);
    return record;
  }

  async listRewardDefinitions(activeOnly = false): Promise<RewardDefinitionRecord[]> {
    return this.rewards
      .filter((item) => !activeOnly || item.active)
      .sort((left, right) => left.rewardType.localeCompare(right.rewardType) || left.name.localeCompare(right.name));
  }

  async findRewardDefinitionByKey(key: string): Promise<RewardDefinitionRecord | null> {
    return this.rewards.find((item) => item.rewardKey === key) ?? null;
  }

  async listMemberRewardGrants(memberId: string): Promise<MemberRewardGrantRecord[]> {
    return this.grants.filter((item) => item.familyMemberId === memberId).sort((left, right) => right.grantedAt.localeCompare(left.grantedAt));
  }

  async findMemberRewardGrantById(id: string): Promise<MemberRewardGrantRecord | null> {
    return this.grants.find((item) => item.id === id) ?? null;
  }

  async listRewardGrants(query: RewardGrantHistoryQuery): Promise<RewardGrantListItem[]> {
    return this.grants
      .filter((item) => !query.memberId || item.familyMemberId === query.memberId)
      .filter((item) => !query.status || query.status === 'all' || item.status === query.status)
      .filter((item) => !query.rewardType || query.rewardType === 'all' || item.reward.rewardType === query.rewardType)
      .filter((item) => !query.sourceModule || query.sourceModule === 'all' || item.sourceModule === query.sourceModule)
      .filter((item) => !query.from || item.grantedAt >= query.from)
      .filter((item) => !query.to || item.grantedAt <= query.to)
      .sort((left, right) => right.grantedAt.localeCompare(left.grantedAt))
      .slice(0, query.limit)
      .map((item) => toListItem(item));
  }

  async grantReward(input: GrantRewardInput): Promise<MemberRewardGrantRecord> {
    const definition = await this.findRewardDefinitionByKey(input.rewardKey);
    if (!definition) throw new Error('reward definition not found');
    const existing = this.grants.find((item) => item.sourceKey === input.sourceKey);
    if (existing) return existing;
    const record: MemberRewardGrantRecord = {
      id: randomUUID(),
      familyMemberId: input.familyMemberId,
      rewardId: definition.id,
      sourceModule: input.sourceModule,
      sourceId: input.sourceId,
      sourceKey: input.sourceKey,
      status: input.status ?? 'earned',
      grantedAt: input.grantedAt,
      approvedAt: input.approvedAt ?? null,
      approvedByFamilyMemberId: input.approvedByFamilyMemberId ?? null,
      issuedAt: input.issuedAt ?? null,
      issuedByFamilyMemberId: input.issuedByFamilyMemberId ?? null,
      financeAccrualId: null,
      financeTransferredAt: null,
      metadata: input.metadata ?? {},
      reward: definition,
      createdAt: input.grantedAt,
      updatedAt: input.grantedAt,
      version: 1,
    };
    this.grants.push(record);
    return record;
  }

  async updateRewardGrantLifecycle(id: string, input: UpdateRewardGrantLifecycleInput): Promise<MemberRewardGrantRecord | null> {
    const index = this.grants.findIndex((item) => item.id === id);
    if (index < 0) return null;
    const current = this.grants[index]!;
    const updated: MemberRewardGrantRecord = {
      ...current,
      status: input.status,
      approvedAt: input.approvedAt !== undefined ? input.approvedAt : current.approvedAt,
      approvedByFamilyMemberId: input.approvedByFamilyMemberId !== undefined ? input.approvedByFamilyMemberId : current.approvedByFamilyMemberId,
      issuedAt: input.issuedAt !== undefined ? input.issuedAt : current.issuedAt,
      issuedByFamilyMemberId: input.issuedByFamilyMemberId !== undefined ? input.issuedByFamilyMemberId : current.issuedByFamilyMemberId,
      financeAccrualId: input.financeAccrualId !== undefined ? input.financeAccrualId : current.financeAccrualId,
      financeTransferredAt: input.financeTransferredAt !== undefined ? input.financeTransferredAt : current.financeTransferredAt,
      metadata: input.metadata ? { ...current.metadata, ...input.metadata } : current.metadata,
      updatedAt: input.now,
      version: current.version + 1,
    };
    this.grants[index] = updated;
    return updated;
  }
}

function toListItem(item: MemberRewardGrantRecord): RewardGrantListItem {
  return {
    ...item,
    member: null,
    finance: {
      accrualId: item.financeAccrualId,
      transferredAt: item.financeTransferredAt,
      status: item.reward.rewardType !== 'money' ? 'not_applicable' : item.financeAccrualId ? 'accrued' : 'not_transferred',
    },
  };
}
