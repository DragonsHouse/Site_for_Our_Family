import type pg from 'pg';
import type { FamilyAuthContext } from '../types.js';
import { FinanceError } from './finance-errors.js';
import type {
  FamilyAccountingTransactionRecord,
  FamilyMemberAccrualRecord,
  IssueQuestPayoutInput,
  IssueQuestPayoutResult,
} from './finance-models.js';

type QuestPayoutFinanceRow = {
  id: string;
  quest_id: string;
  report_id: string | null;
  quest_person_id: string | null;
  family_member_id: string | null;
  display_name: string;
  amount: string;
  status: 'pending' | 'paid' | 'unpaid';
  paid_at: Date | null;
  paid_by_family_member_id: string | null;
  payout_event_key: string | null;
  idempotency_key: string | null;
  accrual_id: string | null;
  accounting_transaction_id: string | null;
  issued_at: Date | null;
  issued_by_family_member_id: string | null;
  member_status: 'active' | 'inactive' | null;
  member_deleted_at: Date | null;
};

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
  approved_at: Date | null;
  paid_at: Date | null;
  reporting_period_start: Date | string | null;
  reporting_period_end: Date | string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

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

export class FamilyQuestPayoutService {
  constructor(private readonly pool: pg.Pool) {}

  async issueQuestPayout(input: IssueQuestPayoutInput, auth: FamilyAuthContext, now = new Date()): Promise<IssueQuestPayoutResult> {
    this.assertCanIssue(auth);
    if (auth.status !== 'active') throw new FinanceError('QUEST_PAYOUT_PERMISSION_DENIED', undefined, 403);
    if (auth.familyMemberId !== input.issuedByFamilyMemberId) {
      throw new FinanceError('QUEST_PAYOUT_PERMISSION_DENIED', undefined, 403);
    }

    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const result = await this.issueQuestPayoutInTransaction(client, input, now);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  private async issueQuestPayoutInTransaction(
    client: pg.PoolClient,
    input: IssueQuestPayoutInput,
    now: Date,
  ): Promise<IssueQuestPayoutResult> {
    if (!(await questExists(client, input.questId))) throw new FinanceError('QUEST_NOT_FOUND', undefined, 404);
    await assertIdempotencyKeyAvailable(client, input.payoutId, input.idempotencyKey);

    const payout = await lockPayout(client, input.payoutId);
    if (!payout) throw new FinanceError('QUEST_PAYOUT_NOT_FOUND', undefined, 404);
    if (payout.quest_id !== input.questId) throw new FinanceError('QUEST_PAYOUT_MISMATCH', undefined, 409);

    if (payout.status === 'paid') {
      if (payout.idempotency_key && payout.idempotency_key !== input.idempotencyKey) {
        throw new FinanceError('QUEST_PAYOUT_ALREADY_PAID', undefined, 409, { payoutId: input.payoutId });
      }
      return this.existingPaidResult(client, payout, input);
    }

    if (payout.status !== 'pending') throw new FinanceError('QUEST_PAYOUT_NOT_PAYABLE', undefined, 409, { status: payout.status });
    if (!payout.family_member_id) throw new FinanceError('QUEST_PAYOUT_TARGET_REQUIRED', undefined, 409);
    if (payout.member_status !== 'active' || payout.member_deleted_at) {
      throw new FinanceError('QUEST_PAYOUT_MEMBER_INVALID', undefined, 409, { familyMemberId: payout.family_member_id });
    }

    const amount = Number(payout.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new FinanceError('QUEST_PAYOUT_AMOUNT_INVALID', undefined, 409);

    const paidAt = now.toISOString();
    const payoutEventKey = payout.payout_event_key ?? buildPayoutEventKey(payout);
    const accrualSourceKey = `family-member-accrual:${payoutEventKey}`;
    const transactionSourceKey = `family-accounting-transaction:${payoutEventKey}`;
    const reason = `Quest payout: ${payout.display_name}`;

    const accrual = await upsertQuestRewardAccrual(client, {
      payout,
      amount,
      sourceKey: accrualSourceKey,
      reason,
      paidAt,
      payoutEventKey,
    });
    const transaction = await upsertQuestPayoutTransaction(client, {
      payout,
      accrualId: accrual.id,
      amount,
      sourceKey: transactionSourceKey,
      reason,
      createdByFamilyMemberId: input.issuedByFamilyMemberId,
      payoutEventKey,
    });

    const updated = await markPayoutPaid(client, {
      payoutId: payout.id,
      idempotencyKey: input.idempotencyKey,
      payoutEventKey,
      accrualId: accrual.id,
      transactionId: transaction.id,
      issuedByFamilyMemberId: input.issuedByFamilyMemberId,
      paidAt,
    });
    if (!updated) throw new FinanceError('QUEST_PAYOUT_ALREADY_PAID', undefined, 409, { payoutId: payout.id });

    await markMoneyRewardIssued(client, {
      questId: payout.quest_id,
      questPersonId: payout.quest_person_id,
      amount,
      issuedAt: paidAt,
      issuedByFamilyMemberId: input.issuedByFamilyMemberId,
    });
    await insertQuestAudit(client, {
      questId: payout.quest_id,
      actorFamilyMemberId: input.issuedByFamilyMemberId,
      relatedFamilyMemberId: payout.family_member_id,
      amount,
      payoutId: payout.id,
      accrualId: accrual.id,
      accountingTransactionId: transaction.id,
      idempotencyKey: input.idempotencyKey,
      payoutEventKey,
    });
    await updateQuestPaidStatusIfComplete(client, payout.quest_id, input.issuedByFamilyMemberId, paidAt);

    return {
      questId: payout.quest_id,
      payoutId: payout.id,
      familyMemberId: payout.family_member_id,
      amount,
      currency: accrual.currency,
      payoutStatus: 'paid',
      paidAt,
      paidByFamilyMemberId: input.issuedByFamilyMemberId,
      idempotencyKey: input.idempotencyKey,
      payoutEventKey,
      accrual,
      accountingTransaction: transaction,
      alreadyIssued: false,
    };
  }

  private async existingPaidResult(
    client: pg.PoolClient,
    payout: QuestPayoutFinanceRow,
    input: IssueQuestPayoutInput,
  ): Promise<IssueQuestPayoutResult> {
    if (!payout.family_member_id) throw new FinanceError('QUEST_PAYOUT_TARGET_REQUIRED', undefined, 409);
    const accrual = payout.accrual_id ? await getAccrual(client, payout.accrual_id) : null;
    const transaction = payout.accounting_transaction_id ? await getTransaction(client, payout.accounting_transaction_id) : null;
    return {
      questId: payout.quest_id,
      payoutId: payout.id,
      familyMemberId: payout.family_member_id,
      amount: Number(payout.amount),
      currency: accrual?.currency ?? transaction?.currency ?? 'USD',
      payoutStatus: 'paid',
      paidAt: payout.paid_at?.toISOString() ?? payout.issued_at?.toISOString() ?? '',
      paidByFamilyMemberId: payout.paid_by_family_member_id ?? payout.issued_by_family_member_id ?? input.issuedByFamilyMemberId,
      idempotencyKey: payout.idempotency_key,
      payoutEventKey: payout.payout_event_key ?? buildPayoutEventKey(payout),
      accrual,
      accountingTransaction: transaction,
      alreadyIssued: true,
    };
  }

  private assertCanIssue(auth: FamilyAuthContext): void {
    if (auth.role === 'owner') return;
    if (auth.permissions.includes('manage_accounting') || auth.permissions.includes('manage_family_quests')) return;
    throw new FinanceError('QUEST_PAYOUT_PERMISSION_DENIED', undefined, 403);
  }
}

async function questExists(client: pg.PoolClient, questId: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>('select exists(select 1 from family_quests where id = $1) as exists', [questId]);
  return result.rows[0]?.exists ?? false;
}

async function assertIdempotencyKeyAvailable(client: pg.PoolClient, payoutId: string, idempotencyKey: string): Promise<void> {
  const result = await client.query<{ id: string; quest_id: string }>(
    `select id, quest_id
     from family_quest_payouts
     where idempotency_key = $1 and id <> $2
     limit 1`,
    [idempotencyKey, payoutId],
  );
  if (result.rows[0]) {
    throw new FinanceError('QUEST_PAYOUT_IDEMPOTENCY_CONFLICT', undefined, 409, {
      conflictingPayoutId: result.rows[0].id,
      conflictingQuestId: result.rows[0].quest_id,
    });
  }
}

async function lockPayout(client: pg.PoolClient, payoutId: string): Promise<QuestPayoutFinanceRow | null> {
  const result = await client.query<QuestPayoutFinanceRow>(
    `select p.*, m.status as member_status, m.deleted_at as member_deleted_at
     from family_quest_payouts p
     left join family_members m on m.id = p.family_member_id
     where p.id = $1
     for update of p`,
    [payoutId],
  );
  return result.rows[0] ?? null;
}

function buildPayoutEventKey(payout: Pick<QuestPayoutFinanceRow, 'quest_id' | 'id' | 'family_member_id'>): string {
  return `quest-payout:${payout.quest_id}:${payout.id}:${payout.family_member_id ?? 'unknown-member'}`;
}

async function upsertQuestRewardAccrual(
  client: pg.PoolClient,
  input: {
    payout: QuestPayoutFinanceRow;
    amount: number;
    sourceKey: string;
    reason: string;
    paidAt: string;
    payoutEventKey: string;
  },
): Promise<FamilyMemberAccrualRecord> {
  const result = await client.query<AccrualRow>(
    `insert into family_member_accruals
      (family_member_id, source_type, source_id, source_key, amount, currency, reason, status, approved_at, paid_at, metadata)
     values ($1, 'quest_reward', $2, $3, $4, 'USD', $5, 'paid', $6, $6, $7)
     on conflict (source_key) do update
     set paid_at = coalesce(family_member_accruals.paid_at, excluded.paid_at),
         status = case when family_member_accruals.status = 'cancelled' then family_member_accruals.status else 'paid' end,
         updated_at = now()
     where family_member_accruals.family_member_id = excluded.family_member_id
       and family_member_accruals.amount = excluded.amount
       and family_member_accruals.source_type = excluded.source_type
     returning *`,
    [
      input.payout.family_member_id,
      input.payout.id,
      input.sourceKey,
      input.amount,
      input.reason,
      input.paidAt,
      JSON.stringify({
        questId: input.payout.quest_id,
        payoutId: input.payout.id,
        reportId: input.payout.report_id,
        questPersonId: input.payout.quest_person_id,
        payoutEventKey: input.payoutEventKey,
      }),
    ],
  );
  const row = result.rows[0];
  if (!row) throw new FinanceError('QUEST_PAYOUT_IDEMPOTENCY_CONFLICT', undefined, 409, { sourceKey: input.sourceKey });
  return mapAccrual(row);
}

async function upsertQuestPayoutTransaction(
  client: pg.PoolClient,
  input: {
    payout: QuestPayoutFinanceRow;
    accrualId: string;
    amount: number;
    sourceKey: string;
    reason: string;
    createdByFamilyMemberId: string;
    payoutEventKey: string;
  },
): Promise<FamilyAccountingTransactionRecord> {
  const result = await client.query<TransactionRow>(
    `insert into family_accounting_transactions
      (transaction_type, amount, currency, family_member_id, quest_id, accrual_id, payout_id, source_key, reason, created_by_family_member_id, metadata)
     values ('payout', $1, 'USD', $2, $3, $4, $5, $6, $7, $8, $9)
     on conflict (source_key) do update
     set metadata = family_accounting_transactions.metadata || excluded.metadata
     where family_accounting_transactions.transaction_type = excluded.transaction_type
       and family_accounting_transactions.amount = excluded.amount
       and family_accounting_transactions.family_member_id is not distinct from excluded.family_member_id
       and family_accounting_transactions.quest_id is not distinct from excluded.quest_id
       and family_accounting_transactions.payout_id is not distinct from excluded.payout_id
     returning *`,
    [
      input.amount,
      input.payout.family_member_id,
      input.payout.quest_id,
      input.accrualId,
      input.payout.id,
      input.sourceKey,
      input.reason,
      input.createdByFamilyMemberId,
      JSON.stringify({
        direction: 'money_leaving_family',
        source: 'quest_payout',
        payoutEventKey: input.payoutEventKey,
      }),
    ],
  );
  const row = result.rows[0];
  if (!row) throw new FinanceError('QUEST_PAYOUT_IDEMPOTENCY_CONFLICT', undefined, 409, { sourceKey: input.sourceKey });
  return mapTransaction(row);
}

async function markPayoutPaid(
  client: pg.PoolClient,
  input: {
    payoutId: string;
    idempotencyKey: string;
    payoutEventKey: string;
    accrualId: string;
    transactionId: string;
    issuedByFamilyMemberId: string;
    paidAt: string;
  },
): Promise<boolean> {
  const result = await client.query(
    `update family_quest_payouts
     set status = 'paid',
         paid_at = $2,
         paid_by_family_member_id = $3,
         issued_at = $2,
         issued_by_family_member_id = $3,
         idempotency_key = coalesce(idempotency_key, $4),
         payout_event_key = coalesce(payout_event_key, $5),
         accrual_id = $6,
         accounting_transaction_id = $7,
         updated_at = now(),
         version = version + 1
     where id = $1
       and status = 'pending'
       and (idempotency_key is null or idempotency_key = $4)`,
    [
      input.payoutId,
      input.paidAt,
      input.issuedByFamilyMemberId,
      input.idempotencyKey,
      input.payoutEventKey,
      input.accrualId,
      input.transactionId,
    ],
  );
  return (result.rowCount ?? 0) === 1;
}

async function markMoneyRewardIssued(
  client: pg.PoolClient,
  input: {
    questId: string;
    questPersonId: string | null;
    amount: number;
    issuedAt: string;
    issuedByFamilyMemberId: string;
  },
): Promise<void> {
  if (!input.questPersonId) return;
  await client.query(
    `update family_quest_rewards
     set status = 'issued',
         issued_at = coalesce(issued_at, $4),
         issued_by_family_member_id = coalesce(issued_by_family_member_id, $5),
         updated_at = now()
     where id = (
       select id
       from family_quest_rewards
       where quest_id = $1
         and quest_person_id = $2
         and reward_type = 'money'
         and status in ('planned', 'prepared')
         and (amount is null or amount = $3)
       order by created_at asc, id asc
       limit 1
     )`,
    [input.questId, input.questPersonId, input.amount, input.issuedAt, input.issuedByFamilyMemberId],
  );
}

async function insertQuestAudit(
  client: pg.PoolClient,
  input: {
    questId: string;
    actorFamilyMemberId: string;
    relatedFamilyMemberId: string;
    amount: number;
    payoutId: string;
    accrualId: string;
    accountingTransactionId: string;
    idempotencyKey: string;
    payoutEventKey: string;
  },
): Promise<void> {
  await client.query(
    `insert into family_quest_audit
      (quest_id, actor_family_member_id, action, comment, related_family_member_id, metadata)
     values ($1, $2, 'payout_issued', $3, $4, $5)`,
    [
      input.questId,
      input.actorFamilyMemberId,
      `Issued quest payout ${input.amount}`,
      input.relatedFamilyMemberId,
      JSON.stringify({
        amount: input.amount,
        payoutId: input.payoutId,
        accrualId: input.accrualId,
        accountingTransactionId: input.accountingTransactionId,
        idempotencyKey: input.idempotencyKey,
        payoutEventKey: input.payoutEventKey,
      }),
    ],
  );
}

async function updateQuestPaidStatusIfComplete(
  client: pg.PoolClient,
  questId: string,
  paidByFamilyMemberId: string,
  paidAt: string,
): Promise<void> {
  await client.query(
    `update family_quests q
     set status = 'paid',
         paid_at = coalesce(q.paid_at, $2),
         paid_by_family_member_id = coalesce(q.paid_by_family_member_id, $3),
         updated_at = now()
     where q.id = $1
       and exists (select 1 from family_quest_payouts p where p.quest_id = q.id)
       and not exists (
         select 1 from family_quest_payouts p
         where p.quest_id = q.id and p.status <> 'paid'
       )`,
    [questId, paidAt, paidByFamilyMemberId],
  );
}

async function getAccrual(client: pg.PoolClient, accrualId: string): Promise<FamilyMemberAccrualRecord | null> {
  const result = await client.query<AccrualRow>('select * from family_member_accruals where id = $1 limit 1', [accrualId]);
  return result.rows[0] ? mapAccrual(result.rows[0]) : null;
}

async function getTransaction(client: pg.PoolClient, transactionId: string): Promise<FamilyAccountingTransactionRecord | null> {
  const result = await client.query<TransactionRow>('select * from family_accounting_transactions where id = $1 limit 1', [transactionId]);
  return result.rows[0] ? mapTransaction(result.rows[0]) : null;
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
    approvedAt: row.approved_at?.toISOString() ?? null,
    paidAt: row.paid_at?.toISOString() ?? null,
    reportingPeriodStart: dateOnly(row.reporting_period_start),
    reportingPeriodEnd: dateOnly(row.reporting_period_end),
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
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

function dateOnly(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}
