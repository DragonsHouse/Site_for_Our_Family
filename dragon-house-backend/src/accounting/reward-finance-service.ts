import type pg from 'pg';
import type { FamilyMemberAccrualRecord } from './finance-models.js';

type AccrualRow = {
  id: string;
  family_member_id: string;
  source_type: FamilyMemberAccrualRecord['sourceType'];
  source_id: string;
  source_key: string;
  amount: string;
  currency: string;
  reason: string;
  status: FamilyMemberAccrualRecord['status'];
  approved_at: Date | string | null;
  paid_at: Date | string | null;
  reporting_period_start: Date | string | null;
  reporting_period_end: Date | string | null;
  metadata: Record<string, unknown>;
  created_at: Date | string;
  updated_at: Date | string;
};

export type RewardFinanceHandoffInput = {
  rewardGrantId: string;
  familyMemberId: string;
  amount: number;
  currency: string;
  rewardName: string;
  issuedByFamilyMemberId: string;
  issuedAt: string;
  sourceKey?: string;
  metadata?: Record<string, unknown>;
};

export type RewardFinanceHandoff = {
  createRewardAccrual(input: RewardFinanceHandoffInput): Promise<FamilyMemberAccrualRecord>;
};

export class PgRewardFinanceService implements RewardFinanceHandoff {
  constructor(private readonly pool: pg.Pool) {}

  async createRewardAccrual(input: RewardFinanceHandoffInput): Promise<FamilyMemberAccrualRecord> {
    const sourceKey = input.sourceKey ?? buildRewardAccrualSourceKey(input.rewardGrantId);
    const result = await this.pool.query<AccrualRow>(
      `insert into family_member_accruals
        (family_member_id, source_type, source_id, source_key, amount, currency, reason, status, approved_at, metadata)
       values ($1, 'reward', $2, $3, $4, $5, $6, 'accrued', $7, $8)
       on conflict (source_key) do update
       set updated_at = now()
       where family_member_accruals.family_member_id = excluded.family_member_id
         and family_member_accruals.amount = excluded.amount
         and family_member_accruals.currency = excluded.currency
         and family_member_accruals.source_type = excluded.source_type
       returning *`,
      [
        input.familyMemberId,
        input.rewardGrantId,
        sourceKey,
        input.amount,
        input.currency,
        `Reward entitlement: ${input.rewardName}`,
        input.issuedAt,
        {
          rewardGrantId: input.rewardGrantId,
          issuedByFamilyMemberId: input.issuedByFamilyMemberId,
          issuedAt: input.issuedAt,
          ...(input.metadata ?? {}),
        },
      ],
    );
    if (!result.rows[0]) throw new Error('reward accrual idempotency conflict');
    return mapAccrual(result.rows[0]);
  }
}

export function buildRewardAccrualSourceKey(rewardGrantId: string): string {
  return `family-member-accrual:reward:${rewardGrantId}`;
}

function mapAccrual(row: AccrualRow): FamilyMemberAccrualRecord {
  return {
    id: row.id,
    familyMemberId: row.family_member_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    sourceKey: row.source_key,
    amount: Number(row.amount),
    currency: row.currency,
    reason: row.reason,
    status: row.status,
    approvedAt: row.approved_at ? iso(row.approved_at) : null,
    paidAt: row.paid_at ? iso(row.paid_at) : null,
    reportingPeriodStart: row.reporting_period_start ? isoDate(row.reporting_period_start) : null,
    reportingPeriodEnd: row.reporting_period_end ? isoDate(row.reporting_period_end) : null,
    metadata: row.metadata ?? {},
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function isoDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}
