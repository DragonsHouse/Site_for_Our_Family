import { randomUUID } from 'node:crypto';
import type {
  CreateRewardAllocationInput,
  RewardAllocationRecord,
  RewardAllocationSourceModule,
  UpdateRewardAllocationInput,
} from './reward-allocation-models.js';
import type { RewardDefinitionRecord } from './achievement-models.js';

export interface RewardAllocationRepository {
  listAllocations(sourceModule: RewardAllocationSourceModule, sourceId: string): Promise<RewardAllocationRecord[]>;
  findAllocationById(id: string): Promise<RewardAllocationRecord | null>;
  createAllocation(input: CreateRewardAllocationInput): Promise<RewardAllocationRecord>;
  updateAllocation(id: string, input: UpdateRewardAllocationInput): Promise<RewardAllocationRecord | null>;
  deleteAllocation(id: string): Promise<boolean>;
}

export class MemoryRewardAllocationRepository implements RewardAllocationRepository {
  private readonly allocations: RewardAllocationRecord[] = [];

  constructor(private readonly rewardDefinitions: RewardDefinitionRecord[] = []) {}

  async listAllocations(sourceModule: RewardAllocationSourceModule, sourceId: string): Promise<RewardAllocationRecord[]> {
    return this.allocations
      .filter((item) => item.sourceModule === sourceModule && item.sourceId === sourceId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  }

  async findAllocationById(id: string): Promise<RewardAllocationRecord | null> {
    return this.allocations.find((item) => item.id === id) ?? null;
  }

  async createAllocation(input: CreateRewardAllocationInput): Promise<RewardAllocationRecord> {
    const reward = this.rewardDefinitions.find((item) => item.id === input.rewardDefinitionId);
    if (!reward) throw new Error('reward definition not found');
    const sourceKey = buildAllocationSourceKey(input.sourceModule, input.sourceId, input.familyMemberId, reward.rewardKey);
    const existing = this.allocations.find((item) => item.sourceKey === sourceKey);
    if (existing) return existing;
    const record: RewardAllocationRecord = {
      id: randomUUID(),
      sourceModule: input.sourceModule,
      sourceId: input.sourceId,
      familyMemberId: input.familyMemberId,
      familyMemberDisplayName: input.familyMemberId,
      rewardDefinitionId: input.rewardDefinitionId,
      reward,
      quantity: input.quantity ?? null,
      reason: input.reason ?? null,
      sourceKey,
      createdByFamilyMemberId: input.createdByFamilyMemberId,
      metadata: input.metadata ?? {},
      createdAt: input.now,
      updatedAt: input.now,
    };
    this.allocations.push(record);
    return record;
  }

  async updateAllocation(id: string, input: UpdateRewardAllocationInput): Promise<RewardAllocationRecord | null> {
    const index = this.allocations.findIndex((item) => item.id === id);
    if (index < 0) return null;
    const current = this.allocations[index]!;
    const reward = input.rewardDefinitionId
      ? this.rewardDefinitions.find((item) => item.id === input.rewardDefinitionId) ?? current.reward
      : current.reward;
    const next: RewardAllocationRecord = {
      ...current,
      familyMemberId: input.familyMemberId ?? current.familyMemberId,
      familyMemberDisplayName: input.familyMemberId ?? current.familyMemberDisplayName,
      rewardDefinitionId: input.rewardDefinitionId ?? current.rewardDefinitionId,
      reward,
      quantity: input.quantity !== undefined ? input.quantity : current.quantity,
      reason: input.reason !== undefined ? input.reason : current.reason,
      sourceKey: buildAllocationSourceKey(current.sourceModule, current.sourceId, input.familyMemberId ?? current.familyMemberId, reward.rewardKey),
      metadata: input.metadata ?? current.metadata,
      updatedAt: input.now,
    };
    this.allocations[index] = next;
    return next;
  }

  async deleteAllocation(id: string): Promise<boolean> {
    const index = this.allocations.findIndex((item) => item.id === id);
    if (index < 0) return false;
    this.allocations.splice(index, 1);
    return true;
  }
}

export function buildAllocationSourceKey(sourceModule: RewardAllocationSourceModule, sourceId: string, familyMemberId: string, rewardKey: string): string {
  return `allocation:${sourceModule}:${sourceId}:member:${familyMemberId}:reward:${rewardKey}`;
}
