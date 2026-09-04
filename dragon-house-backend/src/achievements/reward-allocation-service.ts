import type { FamilyEventRepository } from '../family-events/family-event-repository.js';
import type { FamilyMemberRepository } from '../members/member-repository.js';
import type { TowerDefenseRepository } from '../tower-defense/tower-defense-repository.js';
import type { FamilyAuthContext, FamilyPermission } from '../types.js';
import { AchievementError } from './achievement-errors.js';
import type { AchievementRepository } from './achievement-repository.js';
import type {
  CreateRewardAllocationInput,
  RewardAllocationRecord,
  RewardAllocationSourceModule,
  UpdateRewardAllocationInput,
} from './reward-allocation-models.js';
import type { RewardAllocationRepository } from './reward-allocation-repository.js';

export class RewardAllocationService {
  constructor(
    private readonly allocations: RewardAllocationRepository,
    private readonly achievements: AchievementRepository,
    private readonly members: FamilyMemberRepository,
    private readonly towerDefenses: TowerDefenseRepository,
    private readonly familyEvents: FamilyEventRepository,
  ) {}

  async listAllocations(sourceModule: RewardAllocationSourceModule, sourceId: string, auth: FamilyAuthContext): Promise<{ items: RewardAllocationRecord[] }> {
    await this.assertCanReadSource(sourceModule, sourceId, auth);
    return { items: await this.allocations.listAllocations(sourceModule, sourceId) };
  }

  async createAllocation(
    input: Omit<CreateRewardAllocationInput, 'createdByFamilyMemberId' | 'now'>,
    auth: FamilyAuthContext,
    now = new Date(),
  ): Promise<RewardAllocationRecord> {
    await this.assertCanManageSource(input.sourceModule, input.sourceId, auth);
    await this.assertSourceMutable(input.sourceModule, input.sourceId);
    await this.assertRewardActive(input.rewardDefinitionId);
    await this.assertActiveMember(input.familyMemberId);
    return this.allocations.createAllocation({
      ...input,
      createdByFamilyMemberId: auth.familyMemberId,
      now: now.toISOString(),
    });
  }

  async updateAllocation(id: string, input: Omit<UpdateRewardAllocationInput, 'now'>, auth: FamilyAuthContext, now = new Date()): Promise<RewardAllocationRecord> {
    const current = await this.requireAllocation(id);
    await this.assertCanManageSource(current.sourceModule, current.sourceId, auth);
    await this.assertSourceMutable(current.sourceModule, current.sourceId);
    if (input.rewardDefinitionId) await this.assertRewardActive(input.rewardDefinitionId);
    if (input.familyMemberId) await this.assertActiveMember(input.familyMemberId);
    const updated = await this.allocations.updateAllocation(id, { ...input, now: now.toISOString() });
    if (!updated) throw new AchievementError('REWARD_ALLOCATION_NOT_FOUND', 'Reward allocation not found.', 404, { id });
    return updated;
  }

  async updateAllocationForSource(sourceModule: RewardAllocationSourceModule, sourceId: string, id: string, input: Omit<UpdateRewardAllocationInput, 'now'>, auth: FamilyAuthContext, now = new Date()): Promise<RewardAllocationRecord> {
    const current = await this.requireAllocation(id);
    if (current.sourceModule !== sourceModule || current.sourceId !== sourceId) {
      throw new AchievementError('REWARD_ALLOCATION_NOT_FOUND', 'Reward allocation not found.', 404, { id, sourceModule, sourceId });
    }
    return this.updateAllocation(id, input, auth, now);
  }

  async deleteAllocation(id: string, auth: FamilyAuthContext): Promise<{ deleted: true }> {
    const current = await this.requireAllocation(id);
    await this.assertCanManageSource(current.sourceModule, current.sourceId, auth);
    await this.assertSourceMutable(current.sourceModule, current.sourceId);
    await this.allocations.deleteAllocation(id);
    return { deleted: true };
  }

  async deleteAllocationForSource(sourceModule: RewardAllocationSourceModule, sourceId: string, id: string, auth: FamilyAuthContext): Promise<{ deleted: true }> {
    const current = await this.requireAllocation(id);
    if (current.sourceModule !== sourceModule || current.sourceId !== sourceId) {
      throw new AchievementError('REWARD_ALLOCATION_NOT_FOUND', 'Reward allocation not found.', 404, { id, sourceModule, sourceId });
    }
    return this.deleteAllocation(id, auth);
  }

  private async requireAllocation(id: string): Promise<RewardAllocationRecord> {
    const allocation = await this.allocations.findAllocationById(id);
    if (!allocation) throw new AchievementError('REWARD_ALLOCATION_NOT_FOUND', 'Reward allocation not found.', 404, { id });
    return allocation;
  }

  private async assertRewardActive(rewardDefinitionId: string): Promise<void> {
    const rewards = await this.achievements.listRewardDefinitions(false);
    const reward = rewards.find((item) => item.id === rewardDefinitionId);
    if (!reward || !reward.active) throw new AchievementError('REWARD_NOT_FOUND', 'Reward not found.', 404, { rewardDefinitionId });
  }

  private async assertActiveMember(familyMemberId: string): Promise<void> {
    const member = await this.members.findById(familyMemberId);
    if (!member || member.deletedAt || member.status !== 'active') {
      throw new AchievementError('ACHIEVEMENT_MEMBER_NOT_FOUND', 'Family member not found.', 404, { familyMemberId });
    }
  }

  private async assertCanReadSource(sourceModule: RewardAllocationSourceModule, sourceId: string, auth: FamilyAuthContext): Promise<void> {
    if (auth.status !== 'active') throw new AchievementError('ACHIEVEMENT_PERMISSION_DENIED', 'Inactive member.', 403);
    if (sourceModule === 'tower_defense') {
      const defense = await this.towerDefenses.findDefenseById(sourceId);
      if (!defense) throw new AchievementError('ACHIEVEMENT_NOT_FOUND', 'Tower Defense not found.', 404, { sourceId });
      return;
    }
    const event = await this.familyEvents.findEventById(sourceId);
    if (!event) throw new AchievementError('ACHIEVEMENT_NOT_FOUND', 'Family event not found.', 404, { sourceId });
  }

  private async assertCanManageSource(sourceModule: RewardAllocationSourceModule, sourceId: string, auth: FamilyAuthContext): Promise<void> {
    if (auth.status !== 'active') throw new AchievementError('ACHIEVEMENT_PERMISSION_DENIED', 'Inactive member.', 403);
    if (auth.role === 'owner' || auth.rank >= 8 || hasPermission(auth, 'manage_rewards')) return;
    if (sourceModule === 'tower_defense') {
      const defense = await this.towerDefenses.findDefenseById(sourceId);
      if (!defense) throw new AchievementError('ACHIEVEMENT_NOT_FOUND', 'Tower Defense not found.', 404, { sourceId });
      if (defense.commanderFamilyMemberId === auth.familyMemberId || hasPermission(auth, 'manage_events')) return;
    } else {
      const event = await this.familyEvents.findEventById(sourceId);
      if (!event) throw new AchievementError('ACHIEVEMENT_NOT_FOUND', 'Family event not found.', 404, { sourceId });
      if (event.organizerFamilyMemberId === auth.familyMemberId || hasPermission(auth, 'manage_events')) return;
    }
    throw new AchievementError('ACHIEVEMENT_PERMISSION_DENIED', 'Permission denied.', 403);
  }

  private async assertSourceMutable(sourceModule: RewardAllocationSourceModule, sourceId: string): Promise<void> {
    if (sourceModule === 'tower_defense') {
      const defense = await this.towerDefenses.findDefenseById(sourceId);
      if (!defense) throw new AchievementError('ACHIEVEMENT_NOT_FOUND', 'Tower Defense not found.', 404, { sourceId });
      if (defense.status === 'completed' || defense.status === 'cancelled') {
        throw new AchievementError('REWARD_TRANSITION_INVALID', 'Cannot change reward allocations for a closed source.', 409, { sourceModule, sourceId, status: defense.status });
      }
      return;
    }
    const event = await this.familyEvents.findEventById(sourceId);
    if (!event) throw new AchievementError('ACHIEVEMENT_NOT_FOUND', 'Family event not found.', 404, { sourceId });
    if (event.status === 'completed' || event.status === 'cancelled') {
      throw new AchievementError('REWARD_TRANSITION_INVALID', 'Cannot change reward allocations for a closed source.', 409, { sourceModule, sourceId, status: event.status });
    }
  }
}

function hasPermission(auth: FamilyAuthContext, permission: FamilyPermission): boolean {
  return auth.permissions.includes(permission);
}
