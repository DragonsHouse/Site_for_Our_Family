import type { RewardDefinitionRecord, RewardSourceModule } from './achievement-models.js';

export type RewardAllocationSourceModule = Extract<RewardSourceModule, 'tower_defense' | 'events'>;

export type RewardAllocationRecord = {
  id: string;
  sourceModule: RewardAllocationSourceModule;
  sourceId: string;
  familyMemberId: string;
  familyMemberDisplayName: string | null;
  rewardDefinitionId: string;
  reward: RewardDefinitionRecord;
  quantity: number | null;
  reason: string | null;
  sourceKey: string;
  createdByFamilyMemberId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CreateRewardAllocationInput = {
  sourceModule: RewardAllocationSourceModule;
  sourceId: string;
  familyMemberId: string;
  rewardDefinitionId: string;
  quantity?: number | null;
  reason?: string | null;
  createdByFamilyMemberId: string;
  metadata?: Record<string, unknown>;
  now: string;
};

export type UpdateRewardAllocationInput = {
  familyMemberId?: string;
  rewardDefinitionId?: string;
  quantity?: number | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  now: string;
};
