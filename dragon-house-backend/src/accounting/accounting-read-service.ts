import type pg from 'pg';
import type { FamilyAuthContext } from '../types.js';
import { FinanceError } from './finance-errors.js';
import type { FamilyAccountingTransactionRecord } from './finance-models.js';

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
