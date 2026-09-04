import type pg from 'pg';
import type { RewardDefinitionRecord, RewardType } from './achievement-models.js';
import type {
  CreateRewardAllocationInput,
  RewardAllocationRecord,
  RewardAllocationSourceModule,
  UpdateRewardAllocationInput,
} from './reward-allocation-models.js';
import { buildAllocationSourceKey, type RewardAllocationRepository } from './reward-allocation-repository.js';

type RewardAllocationRow = {
  allocation_id: string;
  source_module: RewardAllocationSourceModule;
  source_id: string;
  family_member_id: string;
  member_display_name: string | null;
  reward_definition_id: string;
  quantity: string | number | null;
  reason: string | null;
  source_key: string;
  created_by_family_member_id: string;
  allocation_metadata: Record<string, unknown>;
  allocation_created_at: Date | string;
  allocation_updated_at: Date | string;
  reward_key: string;
  name: string;
  description: string;
  reward_type: RewardType;
  amount: string | number | null;
  value: string | null;
  currency: string | null;
  reward_metadata: Record<string, unknown>;
  active: boolean;
  reward_created_at: Date | string;
  reward_updated_at: Date | string;
};

export class PgRewardAllocationRepository implements RewardAllocationRepository {
  constructor(private readonly pool: pg.Pool) {}

  async listAllocations(sourceModule: RewardAllocationSourceModule, sourceId: string): Promise<RewardAllocationRecord[]> {
    const result = await this.pool.query<RewardAllocationRow>(
      `${ALLOCATION_SELECT}
       where a.source_module = $1 and a.source_id = $2
       order by a.created_at asc, a.id asc`,
      [sourceModule, sourceId],
    );
    return result.rows.map(mapAllocation);
  }

  async findAllocationById(id: string): Promise<RewardAllocationRecord | null> {
    const result = await this.pool.query<RewardAllocationRow>(`${ALLOCATION_SELECT} where a.id = $1 limit 1`, [id]);
    return result.rows[0] ? mapAllocation(result.rows[0]) : null;
  }

  async createAllocation(input: CreateRewardAllocationInput): Promise<RewardAllocationRecord> {
    const reward = await this.findRewardById(input.rewardDefinitionId);
    if (!reward) throw new Error('reward definition not found');
    const sourceKey = buildAllocationSourceKey(input.sourceModule, input.sourceId, input.familyMemberId, reward.rewardKey);
    const result = await this.pool.query<{ id: string }>(
      `insert into family_reward_allocations
        (source_module, tower_defense_id, family_event_id, family_member_id, reward_definition_id,
         quantity, reason, source_key, created_by_family_member_id, metadata, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)
       on conflict (source_key) do update set updated_at = family_reward_allocations.updated_at
       returning id`,
      [
        input.sourceModule,
        input.sourceModule === 'tower_defense' ? input.sourceId : null,
        input.sourceModule === 'events' ? input.sourceId : null,
        input.familyMemberId,
        input.rewardDefinitionId,
        input.quantity ?? null,
        input.reason ?? null,
        sourceKey,
        input.createdByFamilyMemberId,
        JSON.stringify(input.metadata ?? {}),
        input.now,
      ],
    );
    const created = await this.findAllocationById(result.rows[0]!.id);
    if (!created) throw new Error('created allocation was not found');
    return created;
  }

  async updateAllocation(id: string, input: UpdateRewardAllocationInput): Promise<RewardAllocationRecord | null> {
    const current = await this.findAllocationById(id);
    if (!current) return null;
    const reward = input.rewardDefinitionId ? await this.findRewardById(input.rewardDefinitionId) : current.reward;
    if (!reward) throw new Error('reward definition not found');
    const familyMemberId = input.familyMemberId ?? current.familyMemberId;
    const sourceKey = buildAllocationSourceKey(current.sourceModule, current.sourceId, familyMemberId, reward.rewardKey);
    const result = await this.pool.query<{ id: string }>(
      `update family_reward_allocations
       set family_member_id = $2,
           reward_definition_id = $3,
           quantity = $4,
           reason = $5,
           source_key = $6,
           metadata = $7,
           updated_at = $8
       where id = $1
       returning id`,
      [
        id,
        familyMemberId,
        input.rewardDefinitionId ?? current.rewardDefinitionId,
        input.quantity !== undefined ? input.quantity : current.quantity,
        input.reason !== undefined ? input.reason : current.reason,
        sourceKey,
        JSON.stringify(input.metadata ?? current.metadata),
        input.now,
      ],
    );
    return result.rows[0] ? this.findAllocationById(result.rows[0].id) : null;
  }

  async deleteAllocation(id: string): Promise<boolean> {
    const result = await this.pool.query('delete from family_reward_allocations where id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  private async findRewardById(id: string): Promise<RewardDefinitionRecord | null> {
    const result = await this.pool.query<RewardDefinitionRow>('select * from family_reward_definitions where id = $1 limit 1', [id]);
    return result.rows[0] ? mapReward(result.rows[0]) : null;
  }
}

type RewardDefinitionRow = {
  id: string;
  reward_key: string;
  name: string;
  description: string;
  reward_type: RewardType;
  amount: string | number | null;
  value: string | null;
  currency: string | null;
  metadata: Record<string, unknown>;
  active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

const ALLOCATION_SELECT = `
  select a.id as allocation_id,
    a.source_module,
    a.source_id,
    a.family_member_id,
    m.nickname as member_display_name,
    a.reward_definition_id,
    a.quantity,
    a.reason,
    a.source_key,
    a.created_by_family_member_id,
    a.metadata as allocation_metadata,
    a.created_at as allocation_created_at,
    a.updated_at as allocation_updated_at,
    r.reward_key,
    r.name,
    r.description,
    r.reward_type,
    r.amount,
    r.value,
    r.currency,
    r.metadata as reward_metadata,
    r.active,
    r.created_at as reward_created_at,
    r.updated_at as reward_updated_at
  from family_reward_allocations a
  join family_reward_definitions r on r.id = a.reward_definition_id
  left join family_members m on m.id = a.family_member_id
`;

function mapAllocation(row: RewardAllocationRow): RewardAllocationRecord {
  return {
    id: row.allocation_id,
    sourceModule: row.source_module,
    sourceId: row.source_id,
    familyMemberId: row.family_member_id,
    familyMemberDisplayName: row.member_display_name,
    rewardDefinitionId: row.reward_definition_id,
    reward: {
      id: row.reward_definition_id,
      rewardKey: row.reward_key,
      name: row.name,
      description: row.description,
      rewardType: row.reward_type,
      amount: row.amount === null ? null : Number(row.amount),
      value: row.value,
      currency: row.currency,
      metadata: row.reward_metadata ?? {},
      active: row.active,
      createdAt: iso(row.reward_created_at),
      updatedAt: iso(row.reward_updated_at),
    },
    quantity: row.quantity === null ? null : Number(row.quantity),
    reason: row.reason,
    sourceKey: row.source_key,
    createdByFamilyMemberId: row.created_by_family_member_id,
    metadata: row.allocation_metadata ?? {},
    createdAt: iso(row.allocation_created_at),
    updatedAt: iso(row.allocation_updated_at),
  };
}

function mapReward(row: RewardDefinitionRow): RewardDefinitionRecord {
  return {
    id: row.id,
    rewardKey: row.reward_key,
    name: row.name,
    description: row.description,
    rewardType: row.reward_type,
    amount: row.amount === null ? null : Number(row.amount),
    value: row.value,
    currency: row.currency,
    metadata: row.metadata ?? {},
    active: row.active,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}
