import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { FamilyQuestPayoutService } from './quest-payout-service.js';
import type { FamilyAuthContext } from '../types.js';

const questId = '10000000-0000-4000-8000-000000000001';
const payoutId = '40000000-0000-4000-8000-000000000001';
const rewardId = '50000000-0000-4000-8000-000000000001';
const memberId = 'member-id';
const issuerId = 'issuer-id';
const now = new Date('2026-08-10T12:00:00.000Z');

type FakeDb = {
  quests: Array<Record<string, unknown>>;
  members: Array<Record<string, unknown>>;
  payouts: Array<Record<string, unknown>>;
  rewards: Array<Record<string, unknown>>;
  accruals: Array<Record<string, unknown>>;
  transactions: Array<Record<string, unknown>>;
  audit: Array<Record<string, unknown>>;
};

type FakeOptions = {
  failOnAccounting?: boolean;
  failOnPayoutUpdate?: boolean;
};

describe('FamilyQuestPayoutService', () => {
  it('issues one quest payout atomically and creates finance records', async () => {
    const { service, db } = harness();

    const result = await service.issueQuestPayout(input(), auth(), now);

    expect(result).toMatchObject({
      questId,
      payoutId,
      familyMemberId: memberId,
      amount: 700000,
      payoutStatus: 'paid',
      paidByFamilyMemberId: issuerId,
      alreadyIssued: false,
    });
    expect(db.accruals).toHaveLength(1);
    expect(db.accruals[0]).toMatchObject({
      family_member_id: memberId,
      source_type: 'quest_reward',
      source_id: payoutId,
      amount: '700000.00',
      status: 'paid',
    });
    expect(db.transactions).toHaveLength(1);
    expect(db.transactions[0]).toMatchObject({
      transaction_type: 'payout',
      amount: '700000.00',
      family_member_id: memberId,
      quest_id: questId,
      payout_id: payoutId,
      created_by_family_member_id: issuerId,
    });
    expect(db.payouts[0]).toMatchObject({
      status: 'paid',
      paid_by_family_member_id: issuerId,
      idempotency_key: 'issue-key-0001',
      accrual_id: db.accruals[0].id,
      accounting_transaction_id: db.transactions[0].id,
    });
    expect(db.rewards[0]).toMatchObject({ status: 'issued', issued_by_family_member_id: issuerId });
    expect(db.audit).toHaveLength(1);
    expect(db.audit[0]).toMatchObject({
      quest_id: questId,
      actor_family_member_id: issuerId,
      action: 'payout_issued',
      related_family_member_id: memberId,
    });
  });

  it('keeps member and payment references connected', async () => {
    const { service, db } = harness();

    await service.issueQuestPayout(input(), auth(), now);

    expect(db.transactions[0].accrual_id).toBe(db.accruals[0].id);
    expect(db.transactions[0].payout_id).toBe(payoutId);
    expect(db.payouts[0].accrual_id).toBe(db.accruals[0].id);
    expect(db.payouts[0].accounting_transaction_id).toBe(db.transactions[0].id);
    expect(db.audit[0].metadata).toMatchObject({
      payoutId,
      accrualId: db.accruals[0].id,
      accountingTransactionId: db.transactions[0].id,
    });
  });

  it('reuses the completed result for the same idempotency key without duplicates', async () => {
    const { service, db } = harness();

    const first = await service.issueQuestPayout(input(), auth(), now);
    const second = await service.issueQuestPayout(input(), auth(), now);

    expect(first.alreadyIssued).toBe(false);
    expect(second.alreadyIssued).toBe(true);
    expect(db.accruals).toHaveLength(1);
    expect(db.transactions).toHaveLength(1);
    expect(db.audit).toHaveLength(1);
  });

  it('rejects conflicting reuse of an idempotency key', async () => {
    const { service, db } = harness({
      payouts: [
        payout(),
        payout({ id: '40000000-0000-4000-8000-000000000099', idempotency_key: 'issue-key-0001' }),
      ],
    });

    await expect(service.issueQuestPayout(input(), auth(), now)).rejects.toMatchObject({ code: 'QUEST_PAYOUT_IDEMPOTENCY_CONFLICT' });
    expect(db.accruals).toHaveLength(0);
    expect(db.transactions).toHaveLength(0);
  });

  it('rejects invalid quest ids', async () => {
    const { service } = harness({ quests: [] });
    await expect(service.issueQuestPayout(input(), auth(), now)).rejects.toMatchObject({ code: 'QUEST_NOT_FOUND' });
  });

  it('rejects invalid payout ids', async () => {
    const { service } = harness({ payouts: [] });
    await expect(service.issueQuestPayout(input(), auth(), now)).rejects.toMatchObject({ code: 'QUEST_PAYOUT_NOT_FOUND' });
  });

  it('rejects payouts that do not belong to the quest', async () => {
    const { service } = harness({ payouts: [payout({ quest_id: '10000000-0000-4000-8000-000000000099' })] });
    await expect(service.issueQuestPayout(input(), auth(), now)).rejects.toMatchObject({ code: 'QUEST_PAYOUT_MISMATCH' });
  });

  it('rejects unauthorized users', async () => {
    const { service } = harness();
    await expect(service.issueQuestPayout(input(), { ...auth(), permissions: [] }, now)).rejects.toMatchObject({
      code: 'QUEST_PAYOUT_PERMISSION_DENIED',
    });
  });

  it('rejects payouts without a target family member', async () => {
    const { service } = harness({ payouts: [payout({ family_member_id: null })] });
    await expect(service.issueQuestPayout(input(), auth(), now)).rejects.toMatchObject({ code: 'QUEST_PAYOUT_TARGET_REQUIRED' });
  });

  it('rejects payouts for inactive members', async () => {
    const { service } = harness({ members: [{ id: memberId, status: 'inactive', deleted_at: null }, { id: issuerId, status: 'active', deleted_at: null }] });
    await expect(service.issueQuestPayout(input(), auth(), now)).rejects.toMatchObject({ code: 'QUEST_PAYOUT_MEMBER_INVALID' });
  });

  it('rejects invalid payout amounts', async () => {
    const { service } = harness({ payouts: [payout({ amount: '0.00' })] });
    await expect(service.issueQuestPayout(input(), auth(), now)).rejects.toMatchObject({ code: 'QUEST_PAYOUT_AMOUNT_INVALID' });
  });

  it('rejects non-payable payout statuses', async () => {
    const { service } = harness({ payouts: [payout({ status: 'unpaid' })] });
    await expect(service.issueQuestPayout(input(), auth(), now)).rejects.toMatchObject({ code: 'QUEST_PAYOUT_NOT_PAYABLE' });
  });

  it('rejects already-paid payouts when a different idempotency key is supplied', async () => {
    const { service } = harness({
      payouts: [payout({ status: 'paid', paid_at: now, paid_by_family_member_id: issuerId, idempotency_key: 'issue-key-old' })],
    });
    await expect(service.issueQuestPayout(input({ idempotencyKey: 'issue-key-new' }), auth(), now)).rejects.toMatchObject({
      code: 'QUEST_PAYOUT_ALREADY_PAID',
    });
  });

  it('rolls back if accounting creation fails', async () => {
    const { service, db } = harness({}, { failOnAccounting: true });

    await expect(service.issueQuestPayout(input(), auth(), now)).rejects.toThrow('accounting failed');

    expect(db.accruals).toHaveLength(0);
    expect(db.transactions).toHaveLength(0);
    expect(db.payouts[0].status).toBe('pending');
    expect(db.rewards[0].status).toBe('prepared');
    expect(db.audit).toHaveLength(0);
  });

  it('rolls back if payout update fails', async () => {
    const { service, db } = harness({}, { failOnPayoutUpdate: true });

    await expect(service.issueQuestPayout(input(), auth(), now)).rejects.toMatchObject({ code: 'QUEST_PAYOUT_ALREADY_PAID' });

    expect(db.accruals).toHaveLength(0);
    expect(db.transactions).toHaveLength(0);
    expect(db.payouts[0].status).toBe('pending');
    expect(db.rewards[0].status).toBe('prepared');
    expect(db.audit).toHaveLength(0);
  });

  it('does not create new finance records for already-paid legacy payouts', async () => {
    const { service, db } = harness({
      payouts: [payout({ status: 'paid', paid_at: now, paid_by_family_member_id: issuerId })],
    });

    const result = await service.issueQuestPayout(input(), auth(), now);

    expect(result.alreadyIssued).toBe(true);
    expect(db.accruals).toHaveLength(0);
    expect(db.transactions).toHaveLength(0);
    expect(db.audit).toHaveLength(0);
  });
});

function input(overrides: Partial<Parameters<FamilyQuestPayoutService['issueQuestPayout']>[0]> = {}) {
  return {
    questId,
    payoutId,
    issuedByFamilyMemberId: issuerId,
    idempotencyKey: 'issue-key-0001',
    ...overrides,
  };
}

function auth(overrides: Partial<FamilyAuthContext> = {}): FamilyAuthContext {
  return {
    familyMemberId: issuerId,
    role: 'member',
    rank: 8,
    status: 'active',
    permissions: ['manage_accounting'],
    ...overrides,
  };
}

function harness(seed: Partial<FakeDb> = {}, options: FakeOptions = {}) {
  const db: FakeDb = {
    quests: seed.quests ?? [{ id: questId, status: 'sent_to_accounting' }],
    members: seed.members ?? [
      { id: memberId, status: 'active', deleted_at: null },
      { id: issuerId, status: 'active', deleted_at: null },
    ],
    payouts: seed.payouts ?? [payout()],
    rewards: seed.rewards ?? [reward()],
    accruals: seed.accruals ?? [],
    transactions: seed.transactions ?? [],
    audit: seed.audit ?? [],
  };
  const service = new FamilyQuestPayoutService(new FakePool(db, options) as never);
  return { service, db };
}

function payout(overrides: Record<string, unknown> = {}) {
  return {
    id: payoutId,
    quest_id: questId,
    report_id: '30000000-0000-4000-8000-000000000001',
    quest_person_id: '20000000-0000-4000-8000-000000000001',
    family_member_id: memberId,
    display_name: 'Member_Dragons',
    amount: '700000.00',
    status: 'pending',
    paid_at: null,
    paid_by_family_member_id: null,
    payout_event_key: null,
    idempotency_key: null,
    accrual_id: null,
    accounting_transaction_id: null,
    issued_at: null,
    issued_by_family_member_id: null,
    ...overrides,
  };
}

function reward(overrides: Record<string, unknown> = {}) {
  return {
    id: rewardId,
    quest_id: questId,
    quest_person_id: '20000000-0000-4000-8000-000000000001',
    reward_type: 'money',
    amount: '700000.00',
    status: 'prepared',
    issued_at: null,
    issued_by_family_member_id: null,
    ...overrides,
  };
}

class FakePool {
  constructor(private readonly db: FakeDb, private readonly options: FakeOptions) {}

  async connect() {
    return new FakeClient(this.db, this.options);
  }
}

class FakeClient {
  private snapshot: FakeDb | null = null;

  constructor(private readonly db: FakeDb, private readonly options: FakeOptions) {}

  release() {}

  async query(sql: string, values: unknown[] = []): Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number }> {
    const normalized = sql.toLowerCase().replace(/\s+/gu, ' ').trim();
    if (normalized === 'begin') {
      this.snapshot = cloneDb(this.db);
      return { rows: [] };
    }
    if (normalized === 'commit') {
      this.snapshot = null;
      return { rows: [] };
    }
    if (normalized === 'rollback') {
      if (this.snapshot) restoreDb(this.db, this.snapshot);
      this.snapshot = null;
      return { rows: [] };
    }
    if (normalized.startsWith('select exists(select 1 from family_quests')) {
      return rows([{ exists: this.db.quests.some((quest) => quest.id === values[0]) }]);
    }
    if (normalized.startsWith('select id, quest_id from family_quest_payouts where idempotency_key')) {
      return rows(this.db.payouts.filter((item) => item.idempotency_key === values[0] && item.id !== values[1]).slice(0, 1));
    }
    if (normalized.startsWith('select p.*, m.status as member_status')) {
      const item = this.db.payouts.find((candidate) => candidate.id === values[0]);
      if (!item) return rows([]);
      const member = this.db.members.find((candidate) => candidate.id === item.family_member_id);
      return rows([{ ...item, member_status: member?.status ?? null, member_deleted_at: member?.deleted_at ?? null }]);
    }
    if (normalized.startsWith('insert into family_member_accruals')) {
      const existing = this.db.accruals.find((item) => item.source_key === values[2]);
      if (existing) return rows([existing]);
      const created = {
        id: randomUUID(),
        family_member_id: values[0],
        source_type: 'quest_reward',
        source_id: values[1],
        source_key: values[2],
        amount: money(values[3]),
        currency: 'USD',
        reason: values[4],
        status: 'paid',
        approved_at: new Date(String(values[5])),
        paid_at: new Date(String(values[5])),
        reporting_period_start: null,
        reporting_period_end: null,
        metadata: JSON.parse(String(values[6])) as Record<string, unknown>,
        created_at: now,
        updated_at: now,
      };
      this.db.accruals.push(created);
      return rows([created]);
    }
    if (normalized.startsWith('insert into family_accounting_transactions')) {
      if (this.options.failOnAccounting) throw new Error('accounting failed');
      const existing = this.db.transactions.find((item) => item.source_key === values[5]);
      if (existing) return rows([existing]);
      const created = {
        id: randomUUID(),
        transaction_type: 'payout',
        amount: money(values[0]),
        currency: 'USD',
        family_member_id: values[1],
        quest_id: values[2],
        accrual_id: values[3],
        payout_id: values[4],
        source_key: values[5],
        reason: values[6],
        created_by_family_member_id: values[7],
        metadata: JSON.parse(String(values[8])) as Record<string, unknown>,
        created_at: now,
      };
      this.db.transactions.push(created);
      return rows([created]);
    }
    if (normalized.startsWith("update family_quest_payouts set status = 'paid'")) {
      if (this.options.failOnPayoutUpdate) return { rows: [], rowCount: 0 };
      const item = this.db.payouts.find((candidate) => candidate.id === values[0]);
      if (!item || item.status !== 'pending') return { rows: [], rowCount: 0 };
      Object.assign(item, {
        status: 'paid',
        paid_at: new Date(String(values[1])),
        paid_by_family_member_id: values[2],
        issued_at: new Date(String(values[1])),
        issued_by_family_member_id: values[2],
        idempotency_key: item.idempotency_key ?? values[3],
        payout_event_key: item.payout_event_key ?? values[4],
        accrual_id: values[5],
        accounting_transaction_id: values[6],
        version: Number(item.version ?? 1) + 1,
      });
      return { rows: [], rowCount: 1 };
    }
    if (normalized.startsWith("update family_quest_rewards set status = 'issued'")) {
      const item = this.db.rewards.find(
        (candidate) =>
          candidate.quest_id === values[0] &&
          candidate.quest_person_id === values[1] &&
          candidate.reward_type === 'money' &&
          ['planned', 'prepared'].includes(String(candidate.status)) &&
          (candidate.amount == null || Number(candidate.amount) === Number(values[2])),
      );
      if (item) {
        item.status = 'issued';
        item.issued_at = new Date(String(values[3]));
        item.issued_by_family_member_id = values[4];
      }
      return { rows: [], rowCount: item ? 1 : 0 };
    }
    if (normalized.startsWith('insert into family_quest_audit')) {
      this.db.audit.push({
        quest_id: values[0],
        actor_family_member_id: values[1],
        action: 'payout_issued',
        comment: values[2],
        related_family_member_id: values[3],
        metadata: JSON.parse(String(values[4])) as Record<string, unknown>,
      });
      return { rows: [], rowCount: 1 };
    }
    if (normalized.startsWith('update family_quests q set status =')) {
      const quest = this.db.quests.find((item) => item.id === values[0]);
      if (quest && this.db.payouts.some((item) => item.quest_id === values[0]) && !this.db.payouts.some((item) => item.quest_id === values[0] && item.status !== 'paid')) {
        quest.status = 'paid';
        quest.paid_at = new Date(String(values[1]));
        quest.paid_by_family_member_id = values[2];
      }
      return { rows: [], rowCount: quest ? 1 : 0 };
    }
    if (normalized.startsWith('select * from family_member_accruals where id')) {
      return rows(this.db.accruals.filter((item) => item.id === values[0]).slice(0, 1));
    }
    if (normalized.startsWith('select * from family_accounting_transactions where id')) {
      return rows(this.db.transactions.filter((item) => item.id === values[0]).slice(0, 1));
    }
    throw new Error(`Unhandled fake query: ${sql}`);
  }
}

function rows(items: Array<Record<string, unknown>>): { rows: Array<Record<string, unknown>>; rowCount: number } {
  return { rows: items, rowCount: items.length };
}

function money(value: unknown) {
  return `${Number(value).toFixed(2)}`;
}

function cloneDb(db: FakeDb): FakeDb {
  return JSON.parse(JSON.stringify(db), dateReviver) as FakeDb;
}

function restoreDb(target: FakeDb, snapshot: FakeDb) {
  target.quests = snapshot.quests;
  target.members = snapshot.members;
  target.payouts = snapshot.payouts;
  target.rewards = snapshot.rewards;
  target.accruals = snapshot.accruals;
  target.transactions = snapshot.transactions;
  target.audit = snapshot.audit;
}

function dateReviver(_key: string, value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}t\d{2}:/iu.test(value) ? new Date(value) : value;
}
