import type pg from 'pg';
import type {
  AchievementCategory,
  AchievementDefinitionRecord,
  AchievementRarity,
  AchievementSourceModule,
  AwardAchievementInput,
  GrantRewardInput,
  MemberAchievementRecord,
  MemberRewardGrantRecord,
  RewardGrantHistoryQuery,
  RewardGrantListItem,
  RewardDefinitionRecord,
  RewardGrantStatus,
  RewardSourceModule,
  RewardType,
} from './achievement-models.js';
import type { AchievementRepository, UpdateRewardGrantLifecycleInput } from './achievement-repository.js';

type AchievementDefinitionRow = {
  id: string;
  achievement_key: string;
  name: string;
  description: string;
  category: AchievementCategory;
  icon: string | null;
  image_metadata: Record<string, unknown>;
  rarity: AchievementRarity;
  active: boolean;
  repeatable: boolean;
  hidden: boolean;
  rule_metadata: Record<string, unknown>;
  created_at: Date | string;
  updated_at: Date | string;
};

type MemberAchievementRow = {
  award_id: string;
  family_member_id: string;
  achievement_id: string;
  source_module: AchievementSourceModule;
  source_id: string;
  source_key: string;
  awarded_at: Date | string;
  awarded_by_family_member_id: string | null;
  award_metadata: Record<string, unknown>;
  award_created_at: Date | string;
} & AchievementDefinitionRow;

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

type MemberRewardGrantRow = {
  grant_id: string;
  family_member_id: string;
  reward_id: string;
  source_module: RewardSourceModule;
  source_id: string;
  source_key: string;
  status: RewardGrantStatus;
  granted_at: Date | string;
  approved_at: Date | string | null;
  approved_by_family_member_id: string | null;
  issued_at: Date | string | null;
  issued_by_family_member_id: string | null;
  finance_accrual_id: string | null;
  finance_transferred_at: Date | string | null;
  grant_metadata: Record<string, unknown>;
  grant_created_at: Date | string;
  grant_updated_at: Date | string;
  grant_version: number;
  member_display_name?: string | null;
} & RewardDefinitionRow;

export class PgAchievementRepository implements AchievementRepository {
  constructor(private readonly pool: pg.Pool) {}

  async listAchievementDefinitions(activeOnly = false): Promise<AchievementDefinitionRecord[]> {
    const result = await this.pool.query<AchievementDefinitionRow>(
      `select * from family_achievement_definitions
       where ($1::boolean = false or active = true)
       order by category asc, name asc`,
      [activeOnly],
    );
    return result.rows.map(toAchievementDefinition);
  }

  async findAchievementDefinitionByKey(key: string): Promise<AchievementDefinitionRecord | null> {
    const result = await this.pool.query<AchievementDefinitionRow>(
      'select * from family_achievement_definitions where achievement_key = $1 limit 1',
      [key],
    );
    return result.rows[0] ? toAchievementDefinition(result.rows[0]) : null;
  }

  async listMemberAchievements(memberId: string): Promise<MemberAchievementRecord[]> {
    const result = await this.pool.query<MemberAchievementRow>(
      `${memberAchievementSelect()}
       where a.family_member_id = $1
       order by a.awarded_at desc, a.id desc`,
      [memberId],
    );
    return result.rows.map(toMemberAchievement);
  }

  async awardAchievement(input: AwardAchievementInput): Promise<MemberAchievementRecord> {
    const definition = await this.findAchievementDefinitionByKey(input.achievementKey);
    if (!definition) throw new Error('achievement definition not found');
    const nonRepeatableMemberKey = definition.repeatable ? null : `${input.familyMemberId}:${definition.id}`;
    const result = await this.pool.query<{ id: string }>(
      `insert into family_member_achievements
        (family_member_id, achievement_id, source_module, source_id, source_key, awarded_at, awarded_by_family_member_id, metadata, non_repeatable_member_key)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (source_key) do update set source_key = excluded.source_key
       returning id`,
      [
        input.familyMemberId,
        definition.id,
        input.sourceModule,
        input.sourceId,
        input.sourceKey,
        input.awardedAt,
        input.awardedByFamilyMemberId ?? null,
        input.metadata ?? {},
        nonRepeatableMemberKey,
      ],
    ).catch(async (error: unknown) => {
      if (isUniqueViolation(error) && nonRepeatableMemberKey) {
        const existing = await this.pool.query<{ id: string }>(
          'select id from family_member_achievements where non_repeatable_member_key = $1 limit 1',
          [nonRepeatableMemberKey],
        );
        if (existing.rows[0]) return existing;
      }
      throw error;
    });
    return this.requireMemberAchievement(result.rows[0]!.id);
  }

  async listRewardDefinitions(activeOnly = false): Promise<RewardDefinitionRecord[]> {
    const result = await this.pool.query<RewardDefinitionRow>(
      `select * from family_reward_definitions
       where ($1::boolean = false or active = true)
       order by reward_type asc, name asc`,
      [activeOnly],
    );
    return result.rows.map(toRewardDefinition);
  }

  async findRewardDefinitionByKey(key: string): Promise<RewardDefinitionRecord | null> {
    const result = await this.pool.query<RewardDefinitionRow>('select * from family_reward_definitions where reward_key = $1 limit 1', [key]);
    return result.rows[0] ? toRewardDefinition(result.rows[0]) : null;
  }

  async listMemberRewardGrants(memberId: string): Promise<MemberRewardGrantRecord[]> {
    const result = await this.pool.query<MemberRewardGrantRow>(
      `${memberRewardGrantSelect()}
       where g.family_member_id = $1
       order by g.granted_at desc, g.id desc`,
      [memberId],
    );
    return result.rows.map(toMemberRewardGrant);
  }

  async findMemberRewardGrantById(id: string): Promise<MemberRewardGrantRecord | null> {
    const result = await this.pool.query<MemberRewardGrantRow>(`${memberRewardGrantSelect()} where g.id = $1 limit 1`, [id]);
    return result.rows[0] ? toMemberRewardGrant(result.rows[0]) : null;
  }

  async listRewardGrants(query: RewardGrantHistoryQuery): Promise<RewardGrantListItem[]> {
    const result = await this.pool.query<MemberRewardGrantRow>(
      `${memberRewardGrantSelect(true)}
       where ($1::text is null or g.status = $1)
         and ($2::text is null or d.reward_type = $2)
         and ($3::text is null or g.source_module = $3)
         and ($4::text is null or g.family_member_id = $4)
         and ($5::timestamptz is null or g.granted_at >= $5)
         and ($6::timestamptz is null or g.granted_at <= $6)
       order by g.granted_at desc, g.id desc
       limit $7`,
      [
        query.status && query.status !== 'all' ? query.status : null,
        query.rewardType && query.rewardType !== 'all' ? query.rewardType : null,
        query.sourceModule && query.sourceModule !== 'all' ? query.sourceModule : null,
        query.memberId ?? null,
        query.from ?? null,
        query.to ?? null,
        query.limit,
      ],
    );
    return result.rows.map(toRewardGrantListItem);
  }

  async grantReward(input: GrantRewardInput): Promise<MemberRewardGrantRecord> {
    const definition = await this.findRewardDefinitionByKey(input.rewardKey);
    if (!definition) throw new Error('reward definition not found');
    const result = await this.pool.query<{ id: string }>(
      `insert into family_member_reward_grants
        (family_member_id, reward_id, source_module, source_id, source_key, status, granted_at, approved_at, approved_by_family_member_id, issued_at, issued_by_family_member_id, metadata)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       on conflict (source_key) do update set source_key = excluded.source_key
       returning id`,
      [
        input.familyMemberId,
        definition.id,
        input.sourceModule,
        input.sourceId,
        input.sourceKey,
        input.status ?? 'earned',
        input.grantedAt,
        input.approvedAt ?? null,
        input.approvedByFamilyMemberId ?? null,
        input.issuedAt ?? null,
        input.issuedByFamilyMemberId ?? null,
        input.metadata ?? {},
      ],
    );
    return this.requireMemberRewardGrant(result.rows[0]!.id);
  }

  async updateRewardGrantLifecycle(id: string, input: UpdateRewardGrantLifecycleInput): Promise<MemberRewardGrantRecord | null> {
    const result = await this.pool.query<{ id: string }>(
      `update family_member_reward_grants
       set status = $2,
           approved_at = coalesce($3, approved_at),
           approved_by_family_member_id = coalesce($4, approved_by_family_member_id),
           issued_at = coalesce($5, issued_at),
           issued_by_family_member_id = coalesce($6, issued_by_family_member_id),
           finance_accrual_id = coalesce($7, finance_accrual_id),
           finance_transferred_at = coalesce($8, finance_transferred_at),
           metadata = metadata || $9::jsonb,
           updated_at = $10,
           version = version + 1
       where id = $1
       returning id`,
      [
        id,
        input.status,
        input.approvedAt ?? null,
        input.approvedByFamilyMemberId ?? null,
        input.issuedAt ?? null,
        input.issuedByFamilyMemberId ?? null,
        input.financeAccrualId ?? null,
        input.financeTransferredAt ?? null,
        input.metadata ?? {},
        input.now,
      ],
    );
    return result.rows[0] ? this.requireMemberRewardGrant(result.rows[0].id) : null;
  }

  private async requireMemberAchievement(id: string): Promise<MemberAchievementRecord> {
    const result = await this.pool.query<MemberAchievementRow>(`${memberAchievementSelect()} where a.id = $1 limit 1`, [id]);
    if (!result.rows[0]) throw new Error('member achievement not found');
    return toMemberAchievement(result.rows[0]);
  }

  private async requireMemberRewardGrant(id: string): Promise<MemberRewardGrantRecord> {
    const result = await this.pool.query<MemberRewardGrantRow>(`${memberRewardGrantSelect()} where g.id = $1 limit 1`, [id]);
    if (!result.rows[0]) throw new Error('member reward grant not found');
    return toMemberRewardGrant(result.rows[0]);
  }
}

function memberAchievementSelect() {
  return `select
    a.id as award_id, a.family_member_id, a.achievement_id, a.source_module, a.source_id, a.source_key,
    a.awarded_at, a.awarded_by_family_member_id, a.metadata as award_metadata, a.created_at as award_created_at,
    d.*
   from family_member_achievements a
   join family_achievement_definitions d on d.id = a.achievement_id`;
}

function memberRewardGrantSelect(includeMember = false) {
  return `select
    g.id as grant_id, g.family_member_id, g.reward_id, g.source_module, g.source_id, g.source_key,
    g.status, g.granted_at, g.approved_at, g.approved_by_family_member_id, g.issued_at, g.issued_by_family_member_id,
    g.finance_accrual_id, g.finance_transferred_at, g.metadata as grant_metadata,
    g.created_at as grant_created_at, g.updated_at as grant_updated_at, g.version as grant_version,
    ${includeMember ? 'm.nickname as member_display_name,' : ''}
    d.*
   from family_member_reward_grants g
   join family_reward_definitions d on d.id = g.reward_id
   ${includeMember ? 'left join family_members m on m.id = g.family_member_id' : ''}`;
}

function toAchievementDefinition(row: AchievementDefinitionRow): AchievementDefinitionRecord {
  return {
    id: row.id,
    achievementKey: row.achievement_key,
    name: row.name,
    description: row.description,
    category: row.category,
    icon: row.icon,
    imageMetadata: row.image_metadata ?? {},
    rarity: row.rarity,
    active: row.active,
    repeatable: row.repeatable,
    hidden: row.hidden,
    ruleMetadata: row.rule_metadata ?? {},
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function toMemberAchievement(row: MemberAchievementRow): MemberAchievementRecord {
  return {
    id: row.award_id,
    familyMemberId: row.family_member_id,
    achievementId: row.achievement_id,
    sourceModule: row.source_module,
    sourceId: row.source_id,
    sourceKey: row.source_key,
    awardedAt: iso(row.awarded_at),
    awardedByFamilyMemberId: row.awarded_by_family_member_id,
    metadata: row.award_metadata ?? {},
    achievement: toAchievementDefinition(row),
    createdAt: iso(row.award_created_at),
  };
}

function toRewardDefinition(row: RewardDefinitionRow): RewardDefinitionRecord {
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

function toMemberRewardGrant(row: MemberRewardGrantRow): MemberRewardGrantRecord {
  return {
    id: row.grant_id,
    familyMemberId: row.family_member_id,
    rewardId: row.reward_id,
    sourceModule: row.source_module,
    sourceId: row.source_id,
    sourceKey: row.source_key,
    status: row.status,
    grantedAt: iso(row.granted_at),
    approvedAt: row.approved_at ? iso(row.approved_at) : null,
    approvedByFamilyMemberId: row.approved_by_family_member_id,
    issuedAt: row.issued_at ? iso(row.issued_at) : null,
    issuedByFamilyMemberId: row.issued_by_family_member_id,
    financeAccrualId: row.finance_accrual_id,
    financeTransferredAt: row.finance_transferred_at ? iso(row.finance_transferred_at) : null,
    metadata: row.grant_metadata ?? {},
    reward: toRewardDefinition(row),
    createdAt: iso(row.grant_created_at),
    updatedAt: iso(row.grant_updated_at),
    version: row.grant_version,
  };
}

function toRewardGrantListItem(row: MemberRewardGrantRow): RewardGrantListItem {
  const grant = toMemberRewardGrant(row);
  return {
    ...grant,
    member: row.member_display_name ? { id: row.family_member_id, displayName: row.member_display_name } : null,
    finance: {
      accrualId: row.finance_accrual_id,
      transferredAt: row.finance_transferred_at ? iso(row.finance_transferred_at) : null,
      status: row.reward_type !== 'money' ? 'not_applicable' : row.finance_accrual_id ? 'accrued' : 'not_transferred',
    },
  };
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === '23505');
}
