import type pg from 'pg';
import type { FamilyAuthContext } from '../types.js';
import { FinanceError } from './finance-errors.js';
import type { FamilyAccountingTransactionRecord } from './finance-models.js';
import type { MemberFinanceSummary } from '../member-activity/member-activity-service.js';
import type { MemberActivityItem } from '../member-activity/member-activity-models.js';

type TransactionRow = {
  id: string;
  transaction_type: FamilyAccountingTransactionRecord['transactionType'];
  amount: string;
  currency: string;
  family_member_id: string | null;
  quest_id: string | null;
  accrual_id: string | null;
  payout_id: string | null;
  source_key: string;
  reason: string;
  created_by_family_member_id: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
};

export class FamilyAccountingReadService {
  constructor(private readonly pool: pg.Pool) {}

  async listTransactions(auth: FamilyAuthContext, limit = 50): Promise<{ items: FamilyAccountingTransactionRecord[] }> {
    if (!canViewAccounting(auth)) throw new FinanceError('QUEST_PAYOUT_PERMISSION_DENIED', undefined, 403);
    const result = await this.pool.query<TransactionRow>(
      `select *
       from family_accounting_transactions
       order by created_at desc, id desc
       limit $1`,
      [Math.min(Math.max(limit, 1), 100)],
    );
    return { items: result.rows.map(mapTransaction) };
  }

  async getMemberFinanceSummary(memberId: string): Promise<MemberFinanceSummary> {
    const result = await this.pool.query<{
      accrued_total: string;
      paid_total: string;
      unpaid_total: string;
      currency: string | null;
    }>(
      `select
         coalesce(sum(a.amount) filter (where a.status in ('accrued', 'approved', 'paid')), 0) as accrued_total,
         coalesce(sum(a.amount) filter (where a.status = 'paid'), 0) as paid_total,
         coalesce(sum(a.amount) filter (where a.status in ('accrued', 'approved')), 0) as unpaid_total,
         coalesce(sum(a.amount) filter (where a.source_type = 'salary' and a.status <> 'cancelled'), 0) as salary_total,
         coalesce(sum(a.amount) filter (where a.source_type = 'premium' and a.status <> 'cancelled'), 0) as premium_total,
         coalesce(sum(a.amount) filter (where a.source_type = 'reward' and a.status <> 'cancelled'), 0) as reward_money_total,
         coalesce(sum(a.amount) filter (where a.source_type in ('quest', 'quest_reward', 'quest_best_participant') and a.status <> 'cancelled'), 0) as quest_money_total,
         coalesce(sum(a.amount) filter (where a.source_type in ('adjustment', 'manual_bonus') and a.status <> 'cancelled'), 0) as adjustment_total,
         coalesce(max(a.currency), 'USD') as currency
       from family_member_accruals a
       where a.family_member_id = $1
         and a.status <> 'cancelled'`,
      [memberId],
    );
    const row = result.rows[0];
    return {
      accruedTotal: Number(row?.accrued_total ?? 0),
      paidTotal: Number(row?.paid_total ?? 0),
      unpaidTotal: Number(row?.unpaid_total ?? 0),
      currency: row?.currency ?? 'USD',
      salaryTotal: Number((row as Record<string, string | undefined>)?.salary_total ?? 0),
      premiumTotal: Number((row as Record<string, string | undefined>)?.premium_money_total ?? (row as Record<string, string | undefined>)?.premium_total ?? 0),
      rewardMoneyTotal: Number((row as Record<string, string | undefined>)?.reward_money_total ?? 0),
      questMoneyTotal: Number((row as Record<string, string | undefined>)?.quest_money_total ?? 0),
      adjustmentTotal: Number((row as Record<string, string | undefined>)?.adjustment_total ?? 0),
    };
  }

  async listMemberAccountingActivity(memberId: string): Promise<MemberActivityItem[]> {
    const accruals = await this.pool.query<{
      id: string;
      source_type: string;
      source_id: string;
      amount: string;
      currency: string;
      reason: string;
      status: string;
      created_at: Date;
      approved_at: Date | null;
    }>(
      `select id, source_type, source_id, amount, currency, reason, status, created_at, approved_at
       from family_member_accruals
       where family_member_id = $1
         and status <> 'cancelled'
         and source_type in ('salary', 'premium')
       order by created_at desc
       limit 50`,
      [memberId],
    );
    const payouts = await this.pool.query<{
      id: string;
      payout_batch_id: string;
      total_amount: string;
      currency: string;
      paid_at: Date | null;
    }>(
      `select id, payout_batch_id, total_amount, currency, paid_at
       from family_payout_batch_items
       where family_member_id = $1 and status = 'paid'
       order by paid_at desc nulls last, created_at desc
       limit 50`,
      [memberId],
    );
    return [
      ...accruals.rows.map((row) => ({
        id: `accounting:accrual:${row.id}`,
        type: 'accounting_accrual' as const,
        sourceModule: 'accounting' as const,
        sourceId: row.source_id,
        sourceSubId: row.id,
        occurredAt: (row.approved_at ?? row.created_at).toISOString(),
        title: row.source_type === 'salary' ? 'Salary accrued' : 'Premium accrued',
        description: `${row.reason}: ${Number(row.amount).toLocaleString('uk-UA')} ${row.currency}`,
        metadata: { sourceType: row.source_type, status: row.status },
      })),
      ...payouts.rows.map((row) => ({
        id: `accounting:payout:${row.id}`,
        type: 'accounting_payout' as const,
        sourceModule: 'accounting' as const,
        sourceId: row.payout_batch_id,
        sourceSubId: row.id,
        occurredAt: (row.paid_at ?? new Date(0)).toISOString(),
        title: 'Payout received',
        description: `${Number(row.total_amount).toLocaleString('uk-UA')} ${row.currency} payout was recorded.`,
        metadata: { payoutBatchId: row.payout_batch_id },
      })),
    ];
  }
}

function canViewAccounting(auth: FamilyAuthContext): boolean {
  return auth.role === 'owner' || auth.rank >= 8 || auth.permissions.includes('manage_accounting');
}

function mapTransaction(row: TransactionRow): FamilyAccountingTransactionRecord {
  return {
    id: row.id,
    transactionType: row.transaction_type,
    amount: Number(row.amount),
    currency: row.currency,
    familyMemberId: row.family_member_id,
    questId: row.quest_id,
    accrualId: row.accrual_id,
    payoutId: row.payout_id,
    sourceKey: row.source_key,
    reason: row.reason,
    createdByFamilyMemberId: row.created_by_family_member_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString(),
  };
}
