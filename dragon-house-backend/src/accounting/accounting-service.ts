import type pg from 'pg';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FamilyAuthContext } from '../types.js';
import { FinanceError } from './finance-errors.js';
import { getPayrollWeekBoundary, isCanonicalWeeklyPeriod } from './payroll-week.js';
import type {
  FamilyAccountingTransactionRecord,
  FamilyMemberAccrualRecord,
  FamilyMemberAccrualSourceType,
  PaymentProofInput,
  PayrollMetricSnapshot,
  PayrollPeriodRecord,
  PayrollPreviewItem,
  PayrollPreviewResult,
  PayoutBatchItemRecord,
  PayoutBatchRecord,
  PremiumEntitlementRecord,
  SalaryRuleRecord,
} from './finance-models.js';

type Queryable = Pick<pg.Pool | pg.PoolClient, 'query'>;

export type CreatePayrollPeriodInput = {
  periodType: 'weekly' | 'monthly' | 'custom';
  startsAt: string;
  endsAt: string;
  title: string;
  metadata?: Record<string, unknown>;
};

export type CreateSalaryRuleInput = {
  ruleKey: string;
  name: string;
  description?: string | null;
  ruleType?: SalaryRuleRecord['ruleType'];
  basis: SalaryRuleRecord['basis'];
  amount: number;
  currency?: string;
  active?: boolean;
  priority?: number;
  stackingPolicy?: SalaryRuleRecord['stackingPolicy'];
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  config?: Record<string, unknown>;
};

export type UpdateSalaryRuleInput = Partial<Omit<CreateSalaryRuleInput, 'ruleKey'>> & {
  active?: boolean;
};

export type CreatePremiumInput = {
  familyMemberId: string;
  payrollPeriodId?: string | null;
  amount: number;
  currency?: string;
  reason: string;
  sourceType?: PremiumEntitlementRecord['sourceType'];
  sourceId?: string | null;
  sourceKey?: string | null;
  category?: PremiumEntitlementRecord['category'];
  stackingPolicy?: SalaryRuleRecord['stackingPolicy'];
};

export type CreateAdjustmentInput = {
  familyMemberId: string;
  amount: number;
  currency?: string;
  reason: string;
  sourceKey?: string | null;
};

export type CreatePayoutBatchInput = {
  payrollPeriodId?: string | null;
  title: string;
  reference?: string | null;
  accrualIds: string[];
};

export type AccountingDashboardQuery = {
  memberId?: string | null;
  sourceType?: FamilyMemberAccrualSourceType | 'all' | null;
  status?: FamilyMemberAccrualRecord['status'] | 'all' | null;
  periodId?: string | null;
  from?: string | null;
  to?: string | null;
  limit: number;
};

export type QuestPayoutShare = {
  questId: string;
  questTitle: string;
  payoutPool: number;
  participantCount: number;
  familyRemainder: number;
  totalFamilyIncome: number;
  roundingStrategy: 'largest_remainder_by_quest_person_id';
  shares: Array<{ questPersonId: string; familyMemberId: string; displayName: string; amount: number; accrualId: string; payoutId: string }>;
};

export type WeeklyActivityStatus = {
  periodId: string | null;
  startsAt: string;
  endsAt: string;
  completedQuests: number;
  towerParticipations: number;
  questRequirement: 1;
  towerRequirement: 1;
  eligible: boolean;
  qualifyingReason: 'quest' | 'tower' | 'both' | 'none';
};

export type PayableSummary = {
  items: Array<{
    memberId: string;
    nickname: string;
    staticId: string | null;
    rank: number;
    role: string;
    roleLabel: string;
    totalOutstanding: number;
    currency: string;
    accrualCount: number;
    accrualIds: string[];
    breakdown: Record<string, number>;
    accruals: FamilyMemberAccrualRecord[];
  }>;
};

export type PaymentProofContent = {
  id: string;
  originalFilename: string;
  contentType: PaymentProofInput['contentType'];
  data: Buffer;
};

type AccrualRow = {
  id: string;
  family_member_id: string;
  source_type: FamilyMemberAccrualSourceType;
  source_id: string;
  source_key: string;
  amount: string;
  currency: string;
  reason: string;
  status: FamilyMemberAccrualRecord['status'];
  approved_at: Date | null;
  paid_at: Date | null;
  reporting_period_start: Date | null;
  reporting_period_end: Date | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  payroll_period_id?: string | null;
  payout_batch_item_id?: string | null;
};

type PeriodRow = {
  id: string;
  period_type: PayrollPeriodRecord['periodType'];
  starts_at: Date;
  ends_at: Date;
  status: PayrollPeriodRecord['status'];
  title: string;
  created_by_family_member_id: string;
  finalized_at: Date | null;
  finalized_by_family_member_id: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

type SalaryRuleRow = {
  id: string;
  rule_key: string;
  name: string;
  description: string | null;
  rule_type: SalaryRuleRecord['ruleType'];
  basis: SalaryRuleRecord['basis'];
  amount: string;
  currency: string;
  active: boolean;
  version: number;
  priority: number;
  stacking_policy: SalaryRuleRecord['stackingPolicy'];
  effective_from: Date | null;
  effective_to: Date | null;
  config: Record<string, unknown>;
  created_by_family_member_id: string;
  updated_by_family_member_id: string | null;
  created_at: Date;
  updated_at: Date;
};

type PremiumRow = {
  id: string;
  payroll_period_id: string | null;
  family_member_id: string;
  accrual_id: string;
  amount: string;
  currency: string;
  reason: string;
  source_type: PremiumEntitlementRecord['sourceType'];
  source_id: string | null;
  source_key: string;
  category: PremiumEntitlementRecord['category'];
  stacking_policy: SalaryRuleRecord['stackingPolicy'];
  status: PremiumEntitlementRecord['status'];
  created_by_family_member_id: string;
  created_at: Date;
  updated_at: Date;
};

type BatchRow = {
  id: string;
  payroll_period_id: string | null;
  title: string;
  reference: string | null;
  status: PayoutBatchRecord['status'];
  created_by_family_member_id: string;
  finalized_at: Date | null;
  finalized_by_family_member_id: string | null;
  paid_at: Date | null;
  total_amount: string;
  item_count: string;
  created_at: Date;
  updated_at: Date;
};

type BatchItemRow = {
  id: string;
  payout_batch_id: string;
  family_member_id: string;
  total_amount: string;
  currency: string;
  status: PayoutBatchItemRecord['status'];
  paid_by_family_member_id: string | null;
  payer_nickname_snapshot: string | null;
  payer_role_snapshot: string | null;
  payment_proof_id: string | null;
  paid_at: Date | null;
  accounting_transaction_id: string | null;
  accrual_ids: string[];
  created_at: Date;
  updated_at: Date;
};

type PayrollMemberRow = {
  id: string;
  nickname: string;
  rank: number;
  role: string;
  permissions: string[];
  joined_at: Date | null;
};

type PaymentProofRow = {
  id: string;
  payout_batch_id: string;
  payout_batch_item_id: string;
  accounting_transaction_id: string | null;
  storage_key: string;
  original_filename: string;
  content_type: PaymentProofInput['contentType'];
  size_bytes: number;
  uploaded_by_family_member_id: string;
  uploaded_at: Date;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

type PayableRow = AccrualRow & {
  nickname: string;
  static_id: string | null;
  rank: number;
  role: string;
  permissions: string[];
};

type PayerSnapshotRow = {
  id: string;
  nickname: string;
  role: string;
  rank: number;
};

export class FamilyAccountingService {
  constructor(private readonly pool: pg.Pool) {}

  async createPayrollPeriod(input: CreatePayrollPeriodInput, auth: FamilyAuthContext): Promise<PayrollPeriodRecord> {
    requireAccountingManager(auth);
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) {
      throw new FinanceError('ACCOUNTING_PERIOD_INVALID', undefined, 400);
    }
    if (input.periodType === 'weekly' && !isCanonicalWeeklyPeriod(startsAt, endsAt)) {
      throw new FinanceError('ACCOUNTING_PERIOD_INVALID', 'Weekly payroll must run Monday 00:00 through next Monday 00:00.', 400);
    }
    const result = await this.pool.query<PeriodRow>(
      `insert into family_payroll_periods
        (period_type, starts_at, ends_at, title, created_by_family_member_id, metadata)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (period_type, starts_at, ends_at) do update
         set title = excluded.title,
             metadata = family_payroll_periods.metadata || excluded.metadata,
             updated_at = now()
         where family_payroll_periods.status in ('draft', 'calculated')
       returning *`,
      [input.periodType, startsAt.toISOString(), endsAt.toISOString(), input.title.trim(), auth.familyMemberId, JSON.stringify(input.metadata ?? {})],
    );
    const period = result.rows[0];
    if (!period) throw new FinanceError('ACCOUNTING_PERIOD_CLOSED', undefined, 409);
    await recordAudit(this.pool, auth, 'payroll_period_created', 'payroll_period', period.id, null, period);
    return mapPeriod(period);
  }

  async listPayrollPeriods(auth: FamilyAuthContext, limit = 50): Promise<{ items: PayrollPeriodRecord[] }> {
    requireAccountingManager(auth);
    const result = await this.pool.query<PeriodRow>(
      `select * from family_payroll_periods order by starts_at desc, created_at desc limit $1`,
      [clampLimit(limit)],
    );
    return { items: result.rows.map(mapPeriod) };
  }

  async createSalaryRule(input: CreateSalaryRuleInput, auth: FamilyAuthContext): Promise<SalaryRuleRecord> {
    requireAccountingManager(auth);
    if (!Number.isFinite(input.amount) || input.amount < 0) throw new FinanceError('VALIDATION_ERROR', 'Amount is invalid.', 400);
    validateRuleConfig(input.ruleType ?? 'base_salary', input.basis, input.config ?? {});
    const result = await this.pool.query<SalaryRuleRow>(
      `insert into family_salary_rules
        (rule_key, name, description, rule_type, basis, amount, currency, active, priority, stacking_policy,
         effective_from, effective_to, config, created_by_family_member_id, updated_by_family_member_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
       on conflict (rule_key) do update
         set name = excluded.name,
             description = excluded.description,
             rule_type = excluded.rule_type,
             basis = excluded.basis,
             amount = excluded.amount,
             currency = excluded.currency,
             active = excluded.active,
             priority = excluded.priority,
             stacking_policy = excluded.stacking_policy,
             effective_from = excluded.effective_from,
             effective_to = excluded.effective_to,
             config = excluded.config,
             version = family_salary_rules.version + 1,
             updated_by_family_member_id = excluded.updated_by_family_member_id,
             updated_at = now()
       returning *`,
      [
        input.ruleKey.trim(),
        input.name.trim(),
        input.description ?? null,
        input.ruleType ?? 'base_salary',
        input.basis,
        input.amount,
        input.currency ?? 'USD',
        input.active ?? true,
        input.priority ?? 100,
        input.stackingPolicy ?? 'not_applicable',
        input.effectiveFrom ?? null,
        input.effectiveTo ?? null,
        JSON.stringify(input.config ?? {}),
        auth.familyMemberId,
      ],
    );
    const rule = result.rows[0];
    await recordAudit(this.pool, auth, 'salary_rule_created', 'salary_rule', rule.id, null, rule);
    return mapSalaryRule(rule);
  }

  async listSalaryRules(auth: FamilyAuthContext, limit = 100): Promise<{ items: SalaryRuleRecord[] }> {
    requireAccountingManager(auth);
    const result = await this.pool.query<SalaryRuleRow>(
      `select * from family_salary_rules order by active desc, priority asc, rule_key asc limit $1`,
      [clampLimit(limit)],
    );
    return { items: result.rows.map(mapSalaryRule) };
  }

  async updateSalaryRule(ruleId: string, input: UpdateSalaryRuleInput, auth: FamilyAuthContext): Promise<SalaryRuleRecord> {
    requireAccountingManager(auth);
    const current = await this.pool.query<SalaryRuleRow>('select * from family_salary_rules where id = $1', [ruleId]);
    const row = current.rows[0];
    if (!row) throw new FinanceError('ACCOUNTING_RULE_NOT_FOUND', undefined, 404);
    const next = {
      name: input.name ?? row.name,
      description: input.description === undefined ? row.description : input.description,
      ruleType: input.ruleType ?? row.rule_type,
      basis: input.basis ?? row.basis,
      amount: input.amount ?? Number(row.amount),
      currency: input.currency ?? row.currency,
      active: input.active ?? row.active,
      priority: input.priority ?? row.priority,
      stackingPolicy: input.stackingPolicy ?? row.stacking_policy,
      effectiveFrom: input.effectiveFrom === undefined ? row.effective_from?.toISOString().slice(0, 10) ?? null : input.effectiveFrom,
      effectiveTo: input.effectiveTo === undefined ? row.effective_to?.toISOString().slice(0, 10) ?? null : input.effectiveTo,
      config: input.config ?? row.config ?? {},
    };
    if (!Number.isFinite(next.amount) || next.amount < 0) throw new FinanceError('VALIDATION_ERROR', 'Amount is invalid.', 400);
    validateRuleConfig(next.ruleType, next.basis, next.config);
    const updated = await this.pool.query<SalaryRuleRow>(
      `update family_salary_rules
       set name = $2,
           description = $3,
           rule_type = $4,
           basis = $5,
           amount = $6,
           currency = $7,
           active = $8,
           priority = $9,
           stacking_policy = $10,
           effective_from = $11,
           effective_to = $12,
           config = $13,
           version = version + 1,
           updated_by_family_member_id = $14,
           updated_at = now()
       where id = $1
       returning *`,
      [ruleId, next.name.trim(), next.description ?? null, next.ruleType, next.basis, next.amount, next.currency, next.active, next.priority, next.stackingPolicy, next.effectiveFrom, next.effectiveTo, JSON.stringify(next.config), auth.familyMemberId],
    );
    await recordAudit(this.pool, auth, 'salary_rule_updated', 'salary_rule', ruleId, row, updated.rows[0]);
    return mapSalaryRule(updated.rows[0]);
  }

  async setSalaryRuleActive(ruleId: string, active: boolean, auth: FamilyAuthContext): Promise<SalaryRuleRecord> {
    requireAccountingManager(auth);
    const result = await this.pool.query<SalaryRuleRow>(
      `update family_salary_rules
       set active = $2,
           version = version + 1,
           updated_by_family_member_id = $3,
           updated_at = now()
       where id = $1
       returning *`,
      [ruleId, active, auth.familyMemberId],
    );
    const row = result.rows[0];
    if (!row) throw new FinanceError('ACCOUNTING_RULE_NOT_FOUND', undefined, 404);
    await recordAudit(this.pool, auth, 'salary_rule_status_changed', 'salary_rule', ruleId, null, row);
    return mapSalaryRule(row);
  }

  async validateSalaryConfiguration(periodId: string, auth: FamilyAuthContext): Promise<{ configurationComplete: boolean; warnings: string[]; preview: PayrollPreviewResult }> {
    const preview = await this.previewPayrollPeriod(periodId, auth);
    return { configurationComplete: preview.configurationComplete, warnings: preview.warnings, preview };
  }

  async previewPayrollPeriod(periodId: string, auth: FamilyAuthContext): Promise<PayrollPreviewResult> {
    requireAccountingManager(auth);
    const period = await getPeriod(this.pool, periodId);
    if (!period) throw new FinanceError('ACCOUNTING_PERIOD_NOT_FOUND', undefined, 404);
    const [members, rules] = await Promise.all([listActivePayrollMembers(this.pool), listActiveSalaryRulesForPeriod(this.pool, period)]);
    return buildPayrollPreview(mapPeriod(period), members, rules, await buildPayrollMetricSnapshots(this.pool, period, members.map((member) => member.id)));
  }

  async calculatePayrollPeriod(periodId: string, auth: FamilyAuthContext): Promise<{ period: PayrollPeriodRecord; accruals: FamilyMemberAccrualRecord[]; preview: PayrollPreviewResult }> {
    requireAccountingManager(auth);
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const period = await getPeriod(client, periodId, true);
      if (!period) throw new FinanceError('ACCOUNTING_PERIOD_NOT_FOUND', undefined, 404);
      if (!['draft', 'calculated'].includes(period.status)) throw new FinanceError('ACCOUNTING_PERIOD_CLOSED', undefined, 409);
      const members = await listActivePayrollMembers(client);
      const rules = await listActiveSalaryRulesForPeriod(client, period);
      const preview = buildPayrollPreview(mapPeriod(period), members, rules, await buildPayrollMetricSnapshots(client, period, members.map((member) => member.id)));
      if (!preview.configurationComplete) {
        throw new FinanceError('ACCOUNTING_CONFIGURATION_INCOMPLETE', undefined, 409, { warnings: preview.warnings, items: preview.items });
      }
      const accruals: FamilyMemberAccrualRecord[] = [];
      for (const item of preview.items.filter((entry) => entry.eligible && entry.finalSalary > 0 && entry.status === 'valid')) {
        const baseRuleId = typeof item.breakdown.base[0]?.ruleId === 'string' ? item.breakdown.base[0].ruleId : null;
        const sourceKey = `family-member-accrual:salary:${period.id}:${item.familyMemberId}`;
        const accrual = await upsertAccrual(client, {
          familyMemberId: item.familyMemberId,
          sourceType: 'salary',
          sourceId: period.id,
          sourceKey,
          amount: item.finalSalary,
          currency: item.currency,
          reason: `Salary: ${period.title}`,
          status: 'approved',
          approvedAt: new Date(),
          payrollPeriodId: period.id,
          reportingPeriodStart: period.starts_at,
          reportingPeriodEnd: period.ends_at,
          metadata: {
            payrollPeriodId: period.id,
            inputSnapshot: item.metrics,
            eligibility: item.eligibility,
            breakdown: item.breakdown,
            ruleSnapshot: snapshotRules(rules),
          },
        });
        await client.query(
          `insert into family_salary_calculations
            (payroll_period_id, family_member_id, salary_rule_id, accrual_id, amount, currency, metrics, eligibility,
             breakdown, rule_snapshot, input_snapshot, warnings, status, source_key, calculated_by_family_member_id)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'valid', $13, $14)
           on conflict (source_key) do update
             set accrual_id = excluded.accrual_id,
                 amount = excluded.amount,
                 currency = excluded.currency,
                 metrics = excluded.metrics,
                 eligibility = excluded.eligibility,
                 breakdown = excluded.breakdown,
                 rule_snapshot = excluded.rule_snapshot,
                 input_snapshot = excluded.input_snapshot,
                 warnings = excluded.warnings,
                 status = excluded.status,
                 calculated_at = now(),
                 updated_at = now()`,
          [
            period.id,
            item.familyMemberId,
            baseRuleId,
            accrual.id,
            item.finalSalary,
            item.currency,
            JSON.stringify(item.metrics),
            JSON.stringify(item.eligibility),
            JSON.stringify(item.breakdown),
            JSON.stringify(snapshotRules(rules)),
            JSON.stringify({ memberId: item.familyMemberId, metrics: item.metrics }),
            JSON.stringify(item.warnings),
            `salary:${period.id}:${item.familyMemberId}`,
            auth.familyMemberId,
          ],
        );
        accruals.push(accrual);
      }
      for (const item of preview.items.filter((entry) => entry.status !== 'configuration_incomplete')) {
        for (const premium of item.breakdown.premiums) {
          const ruleKey = readString(premium.ruleKey);
          const amount = readNumber(premium.amount);
          if (!ruleKey || amount === null || amount <= 0) continue;
          const category = readPremiumCategory(premium.category) ?? 'activity';
          const sourceType = readPremiumSourceType(premium.sourceType) ?? (category === 'top3' ? 'leaderboard' : 'rule');
          const sourceKey = `premium-rule:${period.id}:${item.familyMemberId}:${ruleKey}`;
          const premiumAccrual = await upsertAccrual(client, {
            familyMemberId: item.familyMemberId,
            sourceType: 'premium',
            sourceId: period.id,
            sourceKey: `family-member-accrual:${sourceKey}`,
            amount,
            currency: item.currency,
            reason: `Premium: ${readString(premium.reason) ?? ruleKey}`,
            status: 'approved',
            approvedAt: new Date(),
            payrollPeriodId: period.id,
            reportingPeriodStart: period.starts_at,
            reportingPeriodEnd: period.ends_at,
            metadata: {
              premiumSourceKey: sourceKey,
              category,
              stackingPolicy: readString(premium.stackingPolicy) ?? 'not_applicable',
              ruleKey,
              ruleVersion: premium.version,
              inputSnapshot: item.metrics,
              eligibility: item.eligibility,
            },
          });
          const premiumResult = await client.query<PremiumRow>(
            `insert into family_premium_entitlements
              (payroll_period_id, family_member_id, accrual_id, amount, currency, reason, source_type, source_id, source_key,
               category, stacking_policy, created_by_family_member_id)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             on conflict (source_key) do update
               set accrual_id = excluded.accrual_id,
                   amount = excluded.amount,
                   reason = excluded.reason,
                   category = excluded.category,
                   stacking_policy = excluded.stacking_policy,
                   updated_at = now()
             returning *`,
            [
              period.id,
              item.familyMemberId,
              premiumAccrual.id,
              amount,
              item.currency,
              readString(premium.reason) ?? ruleKey,
              sourceType,
              ruleKey,
              sourceKey,
              category,
              readString(premium.stackingPolicy) ?? 'not_applicable',
              auth.familyMemberId,
            ],
          );
          await recordAudit(client, auth, 'premium_created', 'premium', premiumResult.rows[0].id, null, premiumResult.rows[0]);
          accruals.push(premiumAccrual);
        }
      }
      const updated = await client.query<PeriodRow>(
        `update family_payroll_periods
         set status = 'calculated',
             metadata = metadata || $2::jsonb,
             updated_at = now()
         where id = $1
         returning *`,
        [period.id, JSON.stringify({ lastCalculation: { calculatedAt: new Date().toISOString(), configurationComplete: true, warningCount: preview.warnings.length } })],
      );
      await recordAudit(client, auth, 'payroll_calculated', 'payroll_period', period.id, mapPeriod(period), { accrualCount: accruals.length });
      await client.query('commit');
      return { period: mapPeriod(updated.rows[0]), accruals, preview };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async finalizePayrollPeriod(periodId: string, auth: FamilyAuthContext): Promise<PayrollPeriodRecord> {
    requireAccountingManager(auth);
    const preview = await this.previewPayrollPeriod(periodId, auth);
    if (!preview.configurationComplete) {
      throw new FinanceError('ACCOUNTING_CONFIGURATION_INCOMPLETE', undefined, 409, { warnings: preview.warnings });
    }
    const result = await this.pool.query<PeriodRow>(
      `update family_payroll_periods
       set status = 'finalized',
           finalized_at = coalesce(finalized_at, now()),
           finalized_by_family_member_id = coalesce(finalized_by_family_member_id, $2),
           updated_at = now()
       where id = $1
         and status in ('calculated', 'finalized')
         and not exists (
           select 1 from family_salary_calculations c
           where c.payroll_period_id = family_payroll_periods.id and c.status <> 'valid'
         )
       returning *`,
      [periodId, auth.familyMemberId],
    );
    const row = result.rows[0];
    if (!row) throw new FinanceError('ACCOUNTING_PERIOD_CLOSED', undefined, 409);
    await recordAudit(this.pool, auth, 'payroll_finalized', 'payroll_period', row.id, null, row);
    return mapPeriod(row);
  }

  async createPremium(input: CreatePremiumInput, auth: FamilyAuthContext): Promise<PremiumEntitlementRecord> {
    requireAccountingManager(auth);
    await ensureActiveMember(this.pool, input.familyMemberId);
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new FinanceError('VALIDATION_ERROR', 'Amount is invalid.', 400);
    if ((input.sourceType ?? 'manual') === 'manual' && (input.category ?? 'manual') === 'manual' && (input.amount < 50000 || input.amount > 500000)) {
      throw new FinanceError('VALIDATION_ERROR', 'Manual premium must be between 50000 and 500000.', 400);
    }
    const sourceKey = input.sourceKey?.trim() || `premium:${input.payrollPeriodId ?? 'manual'}:${input.familyMemberId}:${input.sourceId ?? input.reason.trim().toLowerCase()}`;
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const accrual = await upsertAccrual(client, {
        familyMemberId: input.familyMemberId,
        sourceType: 'premium',
        sourceId: input.sourceId ?? input.payrollPeriodId ?? sourceKey,
        sourceKey: `family-member-accrual:${sourceKey}`,
        amount: input.amount,
        currency: input.currency ?? 'USD',
        reason: `Premium: ${input.reason.trim()}`,
        status: 'approved',
        approvedAt: new Date(),
        payrollPeriodId: input.payrollPeriodId ?? null,
        metadata: {
          premiumSourceKey: sourceKey,
          category: input.category ?? 'manual',
          stackingPolicy: input.stackingPolicy ?? 'not_applicable',
        },
      });
      const premium = await client.query<PremiumRow>(
        `insert into family_premium_entitlements
          (payroll_period_id, family_member_id, accrual_id, amount, currency, reason, source_type, source_id, source_key,
           category, stacking_policy, created_by_family_member_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         on conflict (source_key) do update
           set accrual_id = excluded.accrual_id,
               amount = excluded.amount,
               reason = excluded.reason,
               category = excluded.category,
               stacking_policy = excluded.stacking_policy,
               updated_at = now()
         returning *`,
        [
          input.payrollPeriodId ?? null,
          input.familyMemberId,
          accrual.id,
          input.amount,
          input.currency ?? 'USD',
          input.reason.trim(),
          input.sourceType ?? 'manual',
          input.sourceId ?? null,
          sourceKey,
          input.category ?? 'manual',
          input.stackingPolicy ?? 'not_applicable',
          auth.familyMemberId,
        ],
      );
      await recordAudit(client, auth, 'premium_created', 'premium', premium.rows[0].id, null, premium.rows[0]);
      await client.query('commit');
      return mapPremium(premium.rows[0]);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async createAdjustment(input: CreateAdjustmentInput, auth: FamilyAuthContext): Promise<FamilyMemberAccrualRecord> {
    requireAccountingManager(auth);
    await ensureActiveMember(this.pool, input.familyMemberId);
    if (!Number.isFinite(input.amount) || input.amount === 0) throw new FinanceError('VALIDATION_ERROR', 'Amount is invalid.', 400);
    if (!input.reason.trim()) throw new FinanceError('VALIDATION_ERROR', 'Reason is required.', 400);
    const sourceKey = input.sourceKey?.trim() || `adjustment:${input.familyMemberId}:${Date.now()}`;
    const accrual = await upsertAccrual(this.pool, {
      familyMemberId: input.familyMemberId,
      sourceType: 'adjustment',
      sourceId: sourceKey,
      sourceKey: `family-member-accrual:${sourceKey}`,
      amount: input.amount,
      currency: input.currency ?? 'USD',
      reason: input.reason.trim(),
      status: 'approved',
      approvedAt: new Date(),
      metadata: { createdByFamilyMemberId: auth.familyMemberId },
    });
    await recordAudit(this.pool, auth, 'adjustment_created', 'accrual', accrual.id, null, accrual);
    return accrual;
  }

  async createPayoutBatch(input: CreatePayoutBatchInput, auth: FamilyAuthContext): Promise<{ batch: PayoutBatchRecord; items: PayoutBatchItemRecord[] }> {
    requireAccountingManager(auth);
    if (!input.accrualIds.length) throw new FinanceError('ACCOUNTING_ACCRUAL_NOT_PAYABLE', undefined, 400);
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const batchResult = await client.query<BatchRow>(
        `insert into family_payout_batches (payroll_period_id, title, reference, created_by_family_member_id)
         values ($1, $2, $3, $4)
         returning *, 0::text as total_amount, 0::text as item_count`,
        [input.payrollPeriodId ?? null, input.title.trim(), input.reference ?? null, auth.familyMemberId],
      );
      const accruals = await client.query<AccrualRow>(
        `select * from family_member_accruals
         where id = any($1::uuid[])
         for update`,
        [input.accrualIds],
      );
      if (accruals.rows.length !== new Set(input.accrualIds).size) throw new FinanceError('ACCOUNTING_ACCRUAL_NOT_FOUND', undefined, 404);
      for (const accrual of accruals.rows) {
        if (!['accrued', 'approved'].includes(accrual.status) || accrual.payout_batch_item_id) {
          throw new FinanceError('ACCOUNTING_ACCRUAL_NOT_PAYABLE', undefined, 409, { accrualId: accrual.id });
        }
      }
      const byMember = new Map<string, AccrualRow[]>();
      for (const accrual of accruals.rows) byMember.set(accrual.family_member_id, [...(byMember.get(accrual.family_member_id) ?? []), accrual]);
      const items: PayoutBatchItemRecord[] = [];
      for (const [memberId, memberAccruals] of byMember) {
        const total = memberAccruals.reduce((sum, accrual) => sum + Number(accrual.amount), 0);
        const currency = memberAccruals[0]?.currency ?? 'USD';
        const item = await client.query<BatchItemRow>(
          `insert into family_payout_batch_items (payout_batch_id, family_member_id, total_amount, currency)
           values ($1, $2, $3, $4)
           returning *, '{}'::text[] as accrual_ids`,
          [batchResult.rows[0].id, memberId, total, currency],
        );
        for (const accrual of memberAccruals) {
          await client.query(
            `insert into family_payout_batch_item_accruals (payout_batch_item_id, accrual_id, amount)
             values ($1, $2, $3)
             on conflict (accrual_id) do nothing`,
            [item.rows[0].id, accrual.id, accrual.amount],
          );
          await client.query(`update family_member_accruals set payout_batch_item_id = $1, updated_at = now() where id = $2`, [item.rows[0].id, accrual.id]);
        }
        items.push({ ...mapBatchItem(item.rows[0]), accrualIds: memberAccruals.map((accrual) => accrual.id) });
      }
      const batch = await getBatch(client, batchResult.rows[0].id);
      await recordAudit(client, auth, 'payout_batch_created', 'payout_batch', batchResult.rows[0].id, null, { accrualIds: input.accrualIds });
      await client.query('commit');
      return { batch: mapBatch(batch), items };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async finalizePayoutBatch(batchId: string, auth: FamilyAuthContext): Promise<PayoutBatchRecord> {
    requireAccountingManager(auth);
    const result = await this.pool.query<BatchRow>(
      `update family_payout_batches
       set status = 'finalized',
           finalized_at = coalesce(finalized_at, now()),
           finalized_by_family_member_id = coalesce(finalized_by_family_member_id, $2),
           updated_at = now()
       where id = $1 and status in ('draft', 'finalized')
       returning *,
         (select coalesce(sum(total_amount), 0)::text from family_payout_batch_items where payout_batch_id = family_payout_batches.id and status <> 'cancelled') as total_amount,
         (select count(*)::text from family_payout_batch_items where payout_batch_id = family_payout_batches.id) as item_count`,
      [batchId, auth.familyMemberId],
    );
    const row = result.rows[0];
    if (!row) throw new FinanceError('ACCOUNTING_PAYOUT_BATCH_INVALID', undefined, 409);
    await recordAudit(this.pool, auth, 'payout_batch_finalized', 'payout_batch', row.id, null, row);
    return mapBatch(row);
  }

  async confirmPayoutItemPaid(
    batchId: string,
    itemId: string,
    input: { proof: PaymentProofInput; idempotencyKey?: string | null },
    auth: FamilyAuthContext,
  ): Promise<{ item: PayoutBatchItemRecord; transaction: FamilyAccountingTransactionRecord }> {
    requireAccountingManager(auth);
    const proofPayload = validatePaymentProof(input.proof);
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const batch = await getBatch(client, batchId, true);
      if (!batch) throw new FinanceError('ACCOUNTING_PAYOUT_BATCH_NOT_FOUND', undefined, 404);
      if (!['finalized', 'partially_paid', 'paid'].includes(batch.status)) throw new FinanceError('ACCOUNTING_PAYOUT_BATCH_INVALID', undefined, 409);
      const itemResult = await client.query<BatchItemRow>(
        `select i.*, '{}'::text[] as accrual_ids
         from family_payout_batch_items i
         where i.id = $1 and i.payout_batch_id = $2
         for update`,
        [itemId, batchId],
      );
      const item = itemResult.rows[0];
      if (!item) throw new FinanceError('ACCOUNTING_PAYOUT_ITEM_NOT_FOUND', undefined, 404);
      const linkedAccruals = await client.query<{ accrual_id: string }>(
        `select accrual_id::text from family_payout_batch_item_accruals where payout_batch_item_id = $1 order by accrual_id`,
        [item.id],
      );
      item.accrual_ids = linkedAccruals.rows.map((row) => row.accrual_id);
      if (item.status === 'paid' && item.accounting_transaction_id) {
        const existing = await getTransaction(client, item.accounting_transaction_id);
        await client.query('commit');
        return { item: mapBatchItem(item), transaction: existing };
      }
      const payer = await getPayerSnapshot(client, auth.familyMemberId);
      if (!payer) throw new FinanceError('ACCOUNTING_PERMISSION_DENIED', undefined, 403);
      const proof = await createPaymentProof(client, {
        batchId,
        itemId,
        proof: proofPayload,
        uploadedByFamilyMemberId: auth.familyMemberId,
        idempotencyKey: input.idempotencyKey ?? null,
      });
      const sourceKey = `family-accounting-transaction:payout-batch:${batchId}:item:${itemId}`;
      const transaction = await client.query<TransactionRow>(
        `insert into family_accounting_transactions
          (transaction_type, amount, currency, family_member_id, accrual_id, source_key, reason, created_by_family_member_id,
           metadata, payout_batch_id, payout_batch_item_id, recorded_at, payment_proof_id, payer_nickname_snapshot, payer_role_snapshot)
         values ('payout', $1, $2, $3, null, $4, $5, $6, $7, $8, $9, now(), $10, $11, $12)
         on conflict (source_key) do update
           set metadata = family_accounting_transactions.metadata || excluded.metadata
         returning *`,
        [
          Math.abs(Number(item.total_amount)),
          item.currency,
          item.family_member_id,
          sourceKey,
          `Payout batch: ${batch.title}`,
          auth.familyMemberId,
          JSON.stringify({
            direction: 'money_leaving_family',
            payoutBatchId: batchId,
            payoutBatchItemId: itemId,
            paymentProofId: proof.id,
            payerNicknameSnapshot: payer.nickname,
            payerRoleSnapshot: payer.role,
          }),
          batchId,
          itemId,
          proof.id,
          payer.nickname,
          payer.role,
        ],
      );
      await client.query(
        `update family_payment_proofs
         set accounting_transaction_id = $2,
             updated_at = now()
         where id = $1`,
        [proof.id, transaction.rows[0].id],
      );
      await client.query(
        `update family_member_accruals
         set status = 'paid', paid_at = coalesce(paid_at, now()), updated_at = now()
         where id = any($1::uuid[])`,
        [item.accrual_ids],
      );
      await client.query(
        `update family_quest_payouts
         set status = 'paid',
             paid_at = coalesce(paid_at, now()),
             paid_by_family_member_id = coalesce(paid_by_family_member_id, $2),
             accounting_transaction_id = coalesce(accounting_transaction_id, $3),
             updated_at = now()
         where accrual_id = any($1::uuid[])
           and status = 'pending'`,
        [item.accrual_ids, auth.familyMemberId, transaction.rows[0].id],
      );
      const paid = await client.query<BatchItemRow>(
        `update family_payout_batch_items
         set status = 'paid',
             paid_by_family_member_id = coalesce(paid_by_family_member_id, $3),
             payer_nickname_snapshot = coalesce(payer_nickname_snapshot, $6),
             payer_role_snapshot = coalesce(payer_role_snapshot, $7),
             payment_proof_id = coalesce(payment_proof_id, $8),
             paid_at = coalesce(paid_at, now()),
             accounting_transaction_id = $4,
             updated_at = now()
         where id = $1 and payout_batch_id = $2
         returning *, $5::text[] as accrual_ids`,
        [itemId, batchId, auth.familyMemberId, transaction.rows[0].id, item.accrual_ids, payer.nickname, payer.role, proof.id],
      );
      await refreshBatchStatus(client, batchId);
      await recordAudit(client, auth, 'payment_proof_uploaded', 'payment_proof', proof.id, null, proof);
      await recordAudit(client, auth, 'payout_item_paid', 'payout_batch_item', itemId, item, {
        ...paid.rows[0],
        paymentProofId: proof.id,
        payerNicknameSnapshot: payer.nickname,
        payerRoleSnapshot: payer.role,
      });
      await client.query('commit');
      await writePaymentProofFile(proof.storage_key, proofPayload.data);
      return { item: mapBatchItem(paid.rows[0]), transaction: mapTransaction(transaction.rows[0]) };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async getDashboard(query: AccountingDashboardQuery, auth: FamilyAuthContext) {
    requireAccountingManager(auth);
    const accruals = await listAccruals(this.pool, query);
    const batches = await this.pool.query<BatchRow>(
      `select b.*,
         (select coalesce(sum(total_amount), 0)::text from family_payout_batch_items where payout_batch_id = b.id and status <> 'cancelled') as total_amount,
         (select count(*)::text from family_payout_batch_items where payout_batch_id = b.id) as item_count
       from family_payout_batches b
       order by b.created_at desc
       limit $1`,
      [clampLimit(query.limit)],
    );
    return {
      pendingAccruals: accruals.filter((item) => ['accrued', 'approved'].includes(item.status)),
      payoutBatches: batches.rows.map(mapBatch),
    };
  }

  async getPayableSummary(auth: FamilyAuthContext): Promise<PayableSummary> {
    requireAccountingManager(auth);
    const result = await this.pool.query<PayableRow>(
      `select a.*, m.nickname, m.static_id, m.rank, m.role, m.permissions
       from family_member_accruals a
       join family_members m on m.id = a.family_member_id
       where a.status in ('accrued', 'approved')
         and a.payout_batch_item_id is null
         and m.deleted_at is null
       order by m.nickname asc, a.created_at asc`,
    );
    const groups = new Map<string, PayableSummary['items'][number]>();
    for (const row of result.rows) {
      const category = accrualCategory(mapAccrual(row));
      const group = groups.get(row.family_member_id) ?? {
        memberId: row.family_member_id,
        nickname: row.nickname,
        staticId: row.static_id,
        rank: row.rank,
        role: row.role,
        roleLabel: accountingRoleLabel(row.rank, row.role, row.permissions ?? []),
        totalOutstanding: 0,
        currency: row.currency,
        accrualCount: 0,
        accrualIds: [],
        breakdown: {},
        accruals: [],
      };
      const accrual = mapAccrual(row);
      group.totalOutstanding += accrual.amount;
      group.accrualCount += 1;
      group.accrualIds.push(accrual.id);
      group.breakdown[category] = (group.breakdown[category] ?? 0) + accrual.amount;
      group.accruals.push(accrual);
      groups.set(row.family_member_id, group);
    }
    return { items: [...groups.values()].sort((left, right) => right.totalOutstanding - left.totalOutstanding || left.nickname.localeCompare(right.nickname)) };
  }

  async recalculateQuestPayouts(questId: string, auth: FamilyAuthContext): Promise<QuestPayoutShare> {
    requireAccountingManager(auth);
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const questResult = await client.query<{
        id: string;
        title: string;
        status: string;
        template_key: string | null;
        completed_at: Date | null;
      }>(
        `select q.id, q.title, q.status, t.template_key, coalesce(q.ends_at, r.created_at, q.updated_at) as completed_at
         from family_quests q
         left join family_quest_templates t on t.id = q.template_id
         left join family_quest_reports r on r.quest_id = q.id
         where q.id = $1
         for update of q`,
        [questId],
      );
      const quest = questResult.rows[0];
      if (!quest) throw new FinanceError('QUEST_NOT_FOUND', undefined, 404);
      if (!['completed', 'reported', 'sent_to_accounting', 'paid'].includes(quest.status)) {
        throw new FinanceError('QUEST_PAYOUT_NOT_PAYABLE', undefined, 409, { status: quest.status });
      }
      const configResult = await client.query<{
        total_family_income: string;
        people_payout_pool: string;
        family_remainder: string;
      }>(
        `select total_family_income, people_payout_pool, family_remainder
         from family_quest_payout_configs
         where active = true and (template_key = $1 or lower(quest_title) = lower($2))
         order by template_key nulls last
         limit 1`,
        [quest.template_key, quest.title],
      );
      const config = configResult.rows[0];
      if (!config) throw new FinanceError('ACCOUNTING_CONFIGURATION_INCOMPLETE', undefined, 409, { questId, templateKey: quest.template_key });
      const people = await client.query<{
        id: string;
        family_member_id: string;
        display_name: string;
      }>(
        `select p.id, p.family_member_id, p.display_name
         from family_quest_people p
         join family_members m on m.id = p.family_member_id
         where p.quest_id = $1
           and p.left_at is null
           and p.family_member_id is not null
           and m.status = 'active'
           and m.deleted_at is null
         order by p.id asc`,
        [questId],
      );
      if (!people.rows.length) throw new FinanceError('QUEST_PAYOUT_TARGET_REQUIRED', undefined, 409, { questId });
      const poolCents = Math.round(Number(config.people_payout_pool) * 100);
      const baseCents = Math.floor(poolCents / people.rows.length);
      const remainderCents = poolCents - baseCents * people.rows.length;
      const shares = [];
      for (let index = 0; index < people.rows.length; index += 1) {
        const person = people.rows[index];
        const amount = (baseCents + (index < remainderCents ? 1 : 0)) / 100;
        const payoutKey = `quest-payout-share:${questId}:${person.id}`;
        const payout = await client.query<{ id: string }>(
          `insert into family_quest_payouts
            (quest_id, quest_person_id, family_member_id, display_name, amount, status, payout_event_key, metadata)
           values ($1, $2, $3, $4, $5, 'pending', $6, $7)
           on conflict (payout_event_key) where payout_event_key is not null do update
             set amount = excluded.amount,
                 display_name = excluded.display_name,
                 metadata = family_quest_payouts.metadata || excluded.metadata,
                 updated_at = now()
             where family_quest_payouts.status <> 'paid'
           returning id`,
          [
            questId,
            person.id,
            person.family_member_id,
            person.display_name,
            amount,
            payoutKey,
            JSON.stringify({
              payoutPool: Number(config.people_payout_pool),
              participantCount: people.rows.length,
              roundingStrategy: 'largest_remainder_by_quest_person_id',
            }),
          ],
        );
        const payoutId = payout.rows[0]?.id;
        if (!payoutId) continue;
        const accrual = await upsertAccrual(client, {
          familyMemberId: person.family_member_id,
          sourceType: 'quest',
          sourceId: payoutId,
          sourceKey: `family-member-accrual:${payoutKey}`,
          amount,
          currency: 'USD',
          reason: `Quest payout: ${quest.title}`,
          status: 'approved',
          approvedAt: new Date(),
          reportingPeriodStart: quest.completed_at,
          reportingPeriodEnd: quest.completed_at,
          metadata: {
            questId,
            questPersonId: person.id,
            payoutId,
            payoutPool: Number(config.people_payout_pool),
            participantCount: people.rows.length,
            memberShare: amount,
            familyRemainder: Number(config.family_remainder),
            totalFamilyIncome: Number(config.total_family_income),
            category: 'quest_payout',
          },
        });
        await client.query(`update family_quest_payouts set accrual_id = $2, updated_at = now() where id = $1 and accrual_id is null`, [payoutId, accrual.id]);
        shares.push({ questPersonId: person.id, familyMemberId: person.family_member_id, displayName: person.display_name, amount, accrualId: accrual.id, payoutId });
      }
      await client.query('commit');
      return {
        questId,
        questTitle: quest.title,
        payoutPool: Number(config.people_payout_pool),
        participantCount: people.rows.length,
        familyRemainder: Number(config.family_remainder),
        totalFamilyIncome: Number(config.total_family_income),
        roundingStrategy: 'largest_remainder_by_quest_person_id',
        shares,
      };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async getMemberAccountingReport(memberId: string, auth: FamilyAuthContext) {
    if (auth.familyMemberId !== memberId) requireAccountingManager(auth);
    const accruals = await listAccruals(this.pool, { memberId, limit: 200 });
    const payouts = await this.pool.query<BatchItemRow>(
      `select i.*, coalesce(array_agg(ia.accrual_id::text) filter (where ia.accrual_id is not null), '{}') as accrual_ids
       from family_payout_batch_items i
       left join family_payout_batch_item_accruals ia on ia.payout_batch_item_id = i.id
       where i.family_member_id = $1
       group by i.id
       order by i.created_at desc
       limit 100`,
      [memberId],
    );
    const active = accruals.filter((item) => item.status !== 'cancelled');
    const sum = (items: FamilyMemberAccrualRecord[]) => items.reduce((total, item) => total + item.amount, 0);
    return {
      memberId,
      totals: {
        accrued: sum(active),
        payable: sum(active.filter((item) => ['accrued', 'approved'].includes(item.status))),
        paid: sum(active.filter((item) => item.status === 'paid')),
        outstanding: sum(active.filter((item) => ['accrued', 'approved'].includes(item.status))),
        currency: active[0]?.currency ?? 'USD',
      },
      bySource: {
        salary: sum(active.filter((item) => item.sourceType === 'salary')),
        premium: sum(active.filter((item) => item.sourceType === 'premium')),
        rewards: sum(active.filter((item) => item.sourceType === 'reward')),
        quests: sum(active.filter((item) => item.sourceType === 'quest' || item.sourceType === 'quest_reward' || item.sourceType === 'quest_best_participant')),
        adjustments: sum(active.filter((item) => item.sourceType === 'adjustment' || item.sourceType === 'manual_bonus')),
      },
      weeklyEarnings: buildWeeklyEarnings(active),
      accruals,
      payoutHistory: payouts.rows.map(mapBatchItem),
      permissions: { canViewSensitive: canManageAccounting(auth) },
    };
  }

  async getPaymentProofContent(proofId: string, auth: FamilyAuthContext): Promise<PaymentProofContent> {
    requireAccountingManager(auth);
    const result = await this.pool.query<PaymentProofRow>('select * from family_payment_proofs where id = $1', [proofId]);
    const proof = result.rows[0];
    if (!proof) throw new FinanceError('ACCOUNTING_PAYMENT_PROOF_NOT_FOUND', undefined, 404);
    const root = path.resolve(process.cwd(), 'storage');
    const target = path.resolve(root, proof.storage_key);
    if (!target.startsWith(root + path.sep)) throw new FinanceError('ACCOUNTING_PAYMENT_PROOF_INVALID', undefined, 400);
    let data: Buffer;
    try {
      data = await readFile(target);
    } catch {
      throw new FinanceError('ACCOUNTING_PAYMENT_PROOF_NOT_FOUND', undefined, 404);
    }
    return {
      id: proof.id,
      originalFilename: proof.original_filename,
      contentType: proof.content_type,
      data,
    };
  }

  async getWeeklyActivityStatus(memberId: string, auth: FamilyAuthContext): Promise<WeeklyActivityStatus> {
    if (auth.familyMemberId !== memberId) requireAccountingManager(auth);
    const member = await getPayrollMember(this.pool, memberId);
    if (!member) throw new FinanceError('ACCOUNTING_MEMBER_NOT_FOUND', undefined, 404);
    const week = getPayrollWeekBoundary();
    const startsAt = week.startsAt;
    const endsAt = week.endsAt;
    const periodResult = await this.pool.query<{ id: string }>(
      `select id from family_payroll_periods
       where period_type = 'weekly' and starts_at = $1 and ends_at = $2
       order by created_at desc
       limit 1`,
      [startsAt.toISOString(), endsAt.toISOString()],
    );
    const period = syntheticPeriod(startsAt, endsAt);
    const metrics = (await buildPayrollMetricSnapshots(this.pool, period, [memberId])).get(memberId) ?? emptyMetrics();
    applyDerivedPayrollMetrics([member], new Map([[memberId, metrics]]));
    const eligibility = evaluateEligibility(member, metrics, []);
    const questQualified = metrics.questsCompleted >= 1;
    const towerQualified = metrics.towerParticipation >= 1;
    return {
      periodId: periodResult.rows[0]?.id ?? null,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      completedQuests: metrics.questsCompleted,
      towerParticipations: metrics.towerParticipation,
      questRequirement: 1,
      towerRequirement: 1,
      eligible: eligibility.eligible,
      qualifyingReason: questQualified && towerQualified ? 'both' : questQualified ? 'quest' : towerQualified ? 'tower' : 'none',
    };
  }
}

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
  payout_batch_id?: string | null;
  payout_batch_item_id?: string | null;
  payment_proof_id?: string | null;
  payer_nickname_snapshot?: string | null;
  payer_role_snapshot?: string | null;
  recorded_at?: Date;
};

async function getPeriod(client: Queryable, periodId: string, lock = false): Promise<PeriodRow | null> {
  const result = await client.query<PeriodRow>(`select * from family_payroll_periods where id = $1 ${lock ? 'for update' : ''}`, [periodId]);
  return result.rows[0] ?? null;
}

async function getPayrollMember(client: Queryable, memberId: string): Promise<PayrollMemberRow | null> {
  const result = await client.query<PayrollMemberRow>(
    `select id, nickname, rank, role, permissions, joined_at
     from family_members
     where id = $1 and status = 'active' and deleted_at is null`,
    [memberId],
  );
  return result.rows[0] ?? null;
}

function syntheticPeriod(startsAt: Date, endsAt: Date): PeriodRow {
  const now = new Date();
  return {
    id: 'current-week',
    period_type: 'weekly',
    starts_at: startsAt,
    ends_at: endsAt,
    status: 'draft',
    title: 'Current week',
    created_by_family_member_id: 'system',
    finalized_at: null,
    finalized_by_family_member_id: null,
    metadata: {},
    created_at: now,
    updated_at: now,
  };
}

async function getBatch(client: Queryable, batchId: string, lock = false): Promise<BatchRow> {
  const result = await client.query<BatchRow>(
    `select b.*,
       (select coalesce(sum(total_amount), 0)::text from family_payout_batch_items where payout_batch_id = b.id and status <> 'cancelled') as total_amount,
       (select count(*)::text from family_payout_batch_items where payout_batch_id = b.id) as item_count
     from family_payout_batches b
     where b.id = $1
     ${lock ? 'for update of b' : ''}`,
    [batchId],
  );
  const row = result.rows[0];
  if (!row) throw new FinanceError('ACCOUNTING_PAYOUT_BATCH_NOT_FOUND', undefined, 404);
  return row;
}

async function getTransaction(client: Queryable, id: string): Promise<FamilyAccountingTransactionRecord> {
  const result = await client.query<TransactionRow>('select * from family_accounting_transactions where id = $1', [id]);
  return mapTransaction(result.rows[0]);
}

async function ensureActiveMember(client: Queryable, memberId: string): Promise<void> {
  const result = await client.query<{ exists: boolean }>(
    `select exists (select 1 from family_members where id = $1 and status = 'active' and deleted_at is null)`,
    [memberId],
  );
  if (!result.rows[0]?.exists) throw new FinanceError('ACCOUNTING_MEMBER_NOT_FOUND', undefined, 404);
}

async function getPayerSnapshot(client: Queryable, memberId: string): Promise<PayerSnapshotRow | null> {
  const result = await client.query<PayerSnapshotRow>(
    `select id, nickname, role, rank
     from family_members
     where id = $1 and status = 'active' and deleted_at is null`,
    [memberId],
  );
  return result.rows[0] ?? null;
}

function validatePaymentProof(input: PaymentProofInput | undefined): PaymentProofInput & { data: Buffer } {
  if (!input) throw new FinanceError('ACCOUNTING_PAYMENT_PROOF_REQUIRED', undefined, 400);
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(input.contentType)) {
    throw new FinanceError('ACCOUNTING_PAYMENT_PROOF_INVALID', 'Payment proof must be png, jpeg, or webp.', 400);
  }
  if (!input.originalFilename.trim()) {
    throw new FinanceError('ACCOUNTING_PAYMENT_PROOF_INVALID', 'Original filename is required.', 400);
  }
  let data: Buffer;
  try {
    data = Buffer.from(input.dataBase64, 'base64');
  } catch {
    throw new FinanceError('ACCOUNTING_PAYMENT_PROOF_INVALID', 'Payment proof is not valid base64.', 400);
  }
  if (!data.length || data.length > 5 * 1024 * 1024) {
    throw new FinanceError('ACCOUNTING_PAYMENT_PROOF_INVALID', 'Payment proof must be between 1 byte and 5 MB.', 400);
  }
  if (!looksLikeImage(data, input.contentType)) {
    throw new FinanceError('ACCOUNTING_PAYMENT_PROOF_INVALID', 'Payment proof content does not match image type.', 400);
  }
  return { ...input, originalFilename: input.originalFilename.trim(), data };
}

function looksLikeImage(data: Buffer, contentType: PaymentProofInput['contentType']): boolean {
  if (contentType === 'image/png') return data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (contentType === 'image/jpeg') return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (contentType === 'image/webp') return data.length >= 12 && data.subarray(0, 4).toString('ascii') === 'RIFF' && data.subarray(8, 12).toString('ascii') === 'WEBP';
  return false;
}

async function createPaymentProof(
  client: Queryable,
  input: {
    batchId: string;
    itemId: string;
    proof: PaymentProofInput & { data: Buffer };
    uploadedByFamilyMemberId: string;
    idempotencyKey: string | null;
  },
): Promise<PaymentProofRow> {
  const extension = input.proof.contentType === 'image/png' ? 'png' : input.proof.contentType === 'image/jpeg' ? 'jpg' : 'webp';
  const storageKey = `payment-proofs/${input.batchId}/${input.itemId}.${extension}`;
  const result = await client.query<PaymentProofRow>(
    `insert into family_payment_proofs
      (payout_batch_id, payout_batch_item_id, storage_key, original_filename, content_type, size_bytes,
       uploaded_by_family_member_id, metadata)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (payout_batch_item_id) do update
       set metadata = family_payment_proofs.metadata || excluded.metadata
     returning *`,
    [
      input.batchId,
      input.itemId,
      storageKey,
      input.proof.originalFilename,
      input.proof.contentType,
      input.proof.data.length,
      input.uploadedByFamilyMemberId,
      JSON.stringify({ idempotencyKey: input.idempotencyKey }),
    ],
  );
  return result.rows[0];
}

async function writePaymentProofFile(storageKey: string, data: Buffer): Promise<void> {
  const root = path.resolve(process.cwd(), 'storage');
  const target = path.resolve(root, storageKey);
  if (!target.startsWith(root + path.sep)) throw new FinanceError('ACCOUNTING_PAYMENT_PROOF_INVALID', undefined, 400);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
}

async function upsertAccrual(client: Queryable, input: {
  familyMemberId: string;
  sourceType: FamilyMemberAccrualSourceType;
  sourceId: string;
  sourceKey: string;
  amount: number;
  currency: string;
  reason: string;
  status: FamilyMemberAccrualRecord['status'];
  approvedAt?: Date | null;
  payrollPeriodId?: string | null;
  reportingPeriodStart?: Date | null;
  reportingPeriodEnd?: Date | null;
  metadata?: Record<string, unknown>;
}): Promise<FamilyMemberAccrualRecord> {
  const result = await client.query<AccrualRow>(
    `insert into family_member_accruals
      (family_member_id, source_type, source_id, source_key, amount, currency, reason, status, approved_at,
       payroll_period_id, reporting_period_start, reporting_period_end, metadata)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     on conflict (source_key) do update
       set amount = excluded.amount,
           currency = excluded.currency,
           reason = excluded.reason,
           metadata = family_member_accruals.metadata || excluded.metadata,
           updated_at = now()
       where family_member_accruals.status <> 'paid'
     returning *`,
    [
      input.familyMemberId,
      input.sourceType,
      input.sourceId,
      input.sourceKey,
      input.amount,
      input.currency,
      input.reason,
      input.status,
      input.approvedAt ?? null,
      input.payrollPeriodId ?? null,
      input.reportingPeriodStart ?? null,
      input.reportingPeriodEnd ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  const row = result.rows[0];
  if (!row) {
    const existing = await client.query<AccrualRow>('select * from family_member_accruals where source_key = $1', [input.sourceKey]);
    return mapAccrual(existing.rows[0]);
  }
  return mapAccrual(row);
}

async function listAccruals(client: Queryable, query: AccountingDashboardQuery): Promise<FamilyMemberAccrualRecord[]> {
  const values: unknown[] = [];
  const where: string[] = [];
  if (query.memberId) {
    values.push(query.memberId);
    where.push(`family_member_id = $${values.length}`);
  }
  if (query.sourceType && query.sourceType !== 'all') {
    values.push(query.sourceType);
    where.push(`source_type = $${values.length}`);
  }
  if (query.status && query.status !== 'all') {
    values.push(query.status);
    where.push(`status = $${values.length}`);
  }
  if (query.periodId) {
    values.push(query.periodId);
    where.push(`payroll_period_id = $${values.length}`);
  }
  if (query.from) {
    values.push(query.from);
    where.push(`created_at >= $${values.length}`);
  }
  if (query.to) {
    values.push(query.to);
    where.push(`created_at <= $${values.length}`);
  }
  values.push(clampLimit(query.limit));
  const result = await client.query<AccrualRow>(
    `select * from family_member_accruals
     ${where.length ? `where ${where.join(' and ')}` : ''}
     order by created_at desc, id desc
     limit $${values.length}`,
    values,
  );
  return result.rows.map(mapAccrual);
}

async function refreshBatchStatus(client: Queryable, batchId: string): Promise<void> {
  await client.query(
    `update family_payout_batches b
     set status = case
           when exists (select 1 from family_payout_batch_items where payout_batch_id = b.id and status = 'pending') and
                exists (select 1 from family_payout_batch_items where payout_batch_id = b.id and status = 'paid') then 'partially_paid'
           when not exists (select 1 from family_payout_batch_items where payout_batch_id = b.id and status = 'pending') then 'paid'
           else b.status
         end,
         paid_at = case when not exists (select 1 from family_payout_batch_items where payout_batch_id = b.id and status = 'pending') then coalesce(paid_at, now()) else paid_at end,
         updated_at = now()
     where b.id = $1`,
    [batchId],
  );
}

async function recordAudit(client: Queryable, auth: FamilyAuthContext, action: string, entityType: string, entityId: string, beforeData: unknown, afterData: unknown): Promise<void> {
  await client.query(
    `insert into family_accounting_audit (action, actor_family_member_id, entity_type, entity_id, source_key, before_data, after_data)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (source_key) do nothing`,
    [action, auth.familyMemberId, entityType, entityId, `accounting-audit:${action}:${entityType}:${entityId}`, beforeData === null ? null : JSON.stringify(beforeData), afterData === null ? null : JSON.stringify(afterData)],
  );
}

async function listActivePayrollMembers(client: Queryable): Promise<PayrollMemberRow[]> {
  const result = await client.query<PayrollMemberRow>(
    `select id, nickname, rank, role, permissions, joined_at
     from family_members
     where status = 'active' and deleted_at is null
     order by nickname asc, id asc`,
  );
  return result.rows;
}

async function listActiveSalaryRulesForPeriod(client: Queryable, period: PeriodRow): Promise<SalaryRuleRow[]> {
  const result = await client.query<SalaryRuleRow>(
    `select *
     from family_salary_rules
     where active = true
       and (effective_from is null or effective_from <= $1::date)
       and (effective_to is null or effective_to >= $2::date)
     order by priority asc, rule_key asc`,
    [period.ends_at.toISOString().slice(0, 10), period.starts_at.toISOString().slice(0, 10)],
  );
  return result.rows;
}

async function buildPayrollMetricSnapshots(client: Queryable, period: PeriodRow, memberIds: string[]): Promise<Map<string, PayrollMetricSnapshot>> {
  const snapshots = new Map<string, PayrollMetricSnapshot>();
  for (const memberId of memberIds) snapshots.set(memberId, emptyMetrics());
  const range = [period.starts_at.toISOString(), period.ends_at.toISOString()];

  const questRows = await client.query<{ family_member_id: string; role: string; is_best_participant: boolean; quest_status: string; joined_at: Date; completed_at: Date | null }>(
    `select p.family_member_id, p.role, p.is_best_participant, q.status as quest_status, p.joined_at,
            coalesce(q.ends_at, r.created_at, q.updated_at) as completed_at
     from family_quest_people p
     join family_quests q on q.id = p.quest_id
     left join family_quest_reports r on r.quest_id = q.id
     where p.family_member_id = any($1::text[]) and p.left_at is null
       and (p.joined_at >= $2::timestamptz and p.joined_at < $3::timestamptz
            or coalesce(q.ends_at, r.created_at, q.updated_at) >= $2::timestamptz and coalesce(q.ends_at, r.created_at, q.updated_at) < $3::timestamptz)`,
    [memberIds, ...range],
  );
  for (const row of questRows.rows) {
    const metrics = snapshots.get(row.family_member_id);
    if (!metrics) continue;
    if (row.role === 'participant' && inPayrollRange(row.joined_at, period)) metrics.questsParticipated += 1;
    if (row.role === 'helper' && inPayrollRange(row.joined_at, period)) metrics.questsHelped += 1;
    if (['completed', 'reported', 'sent_to_accounting', 'paid'].includes(row.quest_status) && row.completed_at && inPayrollRange(row.completed_at, period)) metrics.questsCompleted += 1;
    if (row.is_best_participant && row.completed_at && inPayrollRange(row.completed_at, period)) metrics.questBestParticipant += 1;
  }

  const responseRows = await client.query<{ family_member_id: string }>(
    `select family_member_id
     from family_tower_defense_responses
     where family_member_id = any($1::text[]) and response <> 'no-response'
       and responded_at >= $2::timestamptz and responded_at < $3::timestamptz`,
    [memberIds, ...range],
  );
  for (const row of responseRows.rows) {
    const metrics = snapshots.get(row.family_member_id);
    if (metrics) metrics.towerDefenseResponded += 1;
  }

  const towerRows = await client.query<{ family_member_id: string; attendance_status: string; result: string; completed_at: Date | null }>(
    `select a.family_member_id, a.status as attendance_status, d.result, coalesce(d.completed_at, d.ended_at, d.updated_at) as completed_at
     from family_tower_defense_attendance a
     join family_tower_defenses d on d.id = a.defense_id
     where a.family_member_id = any($1::text[])
       and coalesce(a.confirmed_at, a.updated_at) >= $2::timestamptz
       and coalesce(a.confirmed_at, a.updated_at) < $3::timestamptz`,
    [memberIds, ...range],
  );
  for (const row of towerRows.rows) {
    const metrics = snapshots.get(row.family_member_id);
    if (!metrics) continue;
    if (row.attendance_status === 'present') metrics.towerDefensePresent += 1;
    if (row.attendance_status === 'late') metrics.towerDefenseLate += 1;
    if (row.attendance_status === 'absent') metrics.towerDefenseAbsent += 1;
    if (row.attendance_status === 'excused') metrics.towerDefenseExcused += 1;
    if (row.completed_at && inPayrollRange(row.completed_at, period) && ['present', 'late'].includes(row.attendance_status)) {
      if (row.result === 'defended') metrics.towerDefenseDefended += 1;
      if (row.result === 'lost') metrics.towerDefenseLost += 1;
    }
  }

  const commandedRows = await client.query<{ commander_family_member_id: string; result: string; completed_at: Date | null }>(
    `select commander_family_member_id, result, coalesce(completed_at, ended_at, updated_at) as completed_at
     from family_tower_defenses
     where commander_family_member_id = any($1::text[])
       and starts_at >= $2::timestamptz and starts_at < $3::timestamptz`,
    [memberIds, ...range],
  );
  for (const row of commandedRows.rows) {
    const metrics = snapshots.get(row.commander_family_member_id);
    if (metrics) {
      metrics.towerDefenseCommanded += 1;
      if (row.result === 'defended' && row.completed_at && inPayrollRange(row.completed_at, period)) metrics.towerDefenseSuccessfulCommanded += 1;
    }
  }

  const eventResponseRows = await client.query<{ family_member_id: string }>(
    `select family_member_id
     from family_event_responses
     where family_member_id = any($1::text[]) and response in ('joining', 'confirmed')
       and responded_at >= $2::timestamptz and responded_at < $3::timestamptz`,
    [memberIds, ...range],
  );
  for (const row of eventResponseRows.rows) {
    const metrics = snapshots.get(row.family_member_id);
    if (metrics) metrics.eventsJoined += 1;
  }

  const eventAttendanceRows = await client.query<{ family_member_id: string; status: string }>(
    `select family_member_id, status
     from family_event_attendance
     where family_member_id = any($1::text[])
       and confirmed_at >= $2::timestamptz and confirmed_at < $3::timestamptz`,
    [memberIds, ...range],
  );
  for (const row of eventAttendanceRows.rows) {
    const metrics = snapshots.get(row.family_member_id);
    if (!metrics) continue;
    if (row.status === 'present') metrics.eventsAttended += 1;
    if (row.status === 'late') {
      metrics.eventsAttended += 1;
      metrics.eventsLate += 1;
    }
    if (row.status === 'absent') metrics.eventsAbsent += 1;
    if (row.status === 'excused') metrics.eventsExcused += 1;
  }

  const eventOrganizerRows = await client.query<{ organizer_family_member_id: string }>(
    `select organizer_family_member_id
     from family_events
     where organizer_family_member_id = any($1::text[])
       and starts_at >= $2::timestamptz and starts_at < $3::timestamptz`,
    [memberIds, ...range],
  );
  for (const row of eventOrganizerRows.rows) {
    const metrics = snapshots.get(row.organizer_family_member_id);
    if (metrics) metrics.eventsOrganized += 1;
  }

  const achievementRows = await client.query<{ family_member_id: string }>(
    `select family_member_id
     from family_member_achievements
     where family_member_id = any($1::text[])
       and awarded_at >= $2::timestamptz and awarded_at < $3::timestamptz`,
    [memberIds, ...range],
  );
  for (const row of achievementRows.rows) {
    const metrics = snapshots.get(row.family_member_id);
    if (metrics) metrics.achievementsEarned += 1;
  }

  applyDerivedPayrollMetrics(memberIds.map((id) => ({ id, nickname: id, rank: 0, role: 'member', permissions: [], joined_at: null })), snapshots);
  return snapshots;
}

function buildPayrollPreview(period: PayrollPeriodRecord, members: PayrollMemberRow[], rules: SalaryRuleRow[], metricsByMember: Map<string, PayrollMetricSnapshot>): PayrollPreviewResult {
  const warnings: string[] = [];
  applyDerivedPayrollMetrics(members, metricsByMember);
  const activeBaseRules = rules.filter((rule) => rule.rule_type === 'base_salary');
  if (!activeBaseRules.length) warnings.push('missing_base_salary_rule');
  const items = members.map((member): PayrollPreviewItem => {
    const metrics = metricsByMember.get(member.id) ?? emptyMetrics();
    const eligibility = evaluateEligibility(member, metrics, rules);
    const itemWarnings: string[] = [...eligibility.warnings];
    const matchingBaseRules = activeBaseRules.filter((rule) => salaryRuleApplies(rule, member, metrics));
    if (eligibility.eligible && matchingBaseRules.length === 0) itemWarnings.push('missing_base_salary_for_member');
    if (eligibility.eligible && matchingBaseRules.length > 1) itemWarnings.push('multiple_base_salary_rules_match_member');
    const baseRule = matchingBaseRules.length === 1 ? matchingBaseRules[0] : null;
    const baseAmount = eligibility.eligible && baseRule ? Number(baseRule.amount) : 0;
    const modifierRules = rules.filter((rule) => ['fixed_activity_bonus', 'attendance_modifier', 'leadership_modifier'].includes(rule.rule_type) && salaryRuleApplies(rule, member, metrics));
    const modifiers = modifierRules.map((rule) => ({ ruleId: rule.id, ruleKey: rule.rule_key, ruleType: rule.rule_type, version: rule.version, amount: Number(rule.amount), reason: rule.name }));
    const modifiersTotal = eligibility.eligible ? modifiers.reduce((total, rule) => total + Number(rule.amount), 0) : 0;
    const premiumRules = selectPremiumRules(rules.filter((rule) => rule.rule_type === 'premium_rule' && salaryRuleApplies(rule, member, metrics)));
    const premiums = premiumRules.map((rule) => ({
      ruleId: rule.id,
      ruleKey: rule.rule_key,
      version: rule.version,
      amount: Number(rule.amount),
      sourceType: readString(rule.config.sourceType) ?? (readString(rule.config.category) === 'top3' ? 'leaderboard' : 'rule'),
      category: readString(rule.config.category) ?? 'activity',
      stackingPolicy: rule.stacking_policy,
      reason: rule.name,
    }));
    const premiumPreviewTotal = premiums.reduce((total, rule) => total + Number(rule.amount), 0);
    const status = !eligibility.eligible ? 'ineligible' : itemWarnings.length ? 'configuration_incomplete' : 'valid';
    return {
      familyMemberId: member.id,
      displayName: member.nickname,
      eligible: eligibility.eligible,
      status,
      baseAmount,
      modifiersTotal,
      premiumPreviewTotal,
      finalSalary: status === 'valid' ? baseAmount + modifiersTotal : 0,
      currency: baseRule?.currency ?? rules.find((rule) => rule.currency)?.currency ?? 'USD',
      metrics,
      eligibility: eligibility.details,
      breakdown: {
        base: baseRule ? [{ ruleId: baseRule.id, ruleKey: baseRule.rule_key, version: baseRule.version, amount: baseAmount, reason: baseRule.name }] : [],
        modifiers,
        premiums,
        warnings: itemWarnings,
      },
      warnings: itemWarnings,
    };
  });
  for (const item of items) {
    for (const warning of item.warnings) warnings.push(`${item.familyMemberId}:${warning}`);
  }
  return {
    period,
    configurationComplete: warnings.length === 0,
    warnings: [...new Set(warnings)],
    items,
  };
}

function evaluateEligibility(member: PayrollMemberRow, metrics: PayrollMetricSnapshot, rules: SalaryRuleRow[]): { eligible: boolean; warnings: string[]; details: Record<string, unknown> } {
  const eligibilityRules = rules.filter((rule) => rule.rule_type === 'eligibility');
  const towerParticipation = metrics.towerDefensePresent + metrics.towerDefenseLate;
  const productMinimumMet = metrics.questsCompleted >= 1 || towerParticipation >= 1;
  const details: Record<string, unknown> = {
    activeMember: true,
    productMinimum: {
      completedQuests: metrics.questsCompleted,
      towerParticipation,
      eligible: productMinimumMet,
      rule: 'completedQuests >= 1 OR towerDefensePresent + towerDefenseLate >= 1',
    },
    attendanceSemantics: {
      latePenalty: false,
      absentPenaltyConfigured: false,
      excusedCountsAsAbsent: false,
    },
    checkedRules: eligibilityRules.map((rule) => ({ ruleKey: rule.rule_key, version: rule.version })),
  };
  const warnings: string[] = [];
  if (!productMinimumMet) return { eligible: false, warnings, details };
  for (const rule of eligibilityRules) {
    const config = rule.config ?? {};
    if (Array.isArray(config.excludedMemberIds) && config.excludedMemberIds.includes(member.id)) return { eligible: false, warnings, details: { ...details, excludedBy: rule.rule_key } };
    if (Array.isArray(config.excludedRoles) && config.excludedRoles.includes(member.role)) return { eligible: false, warnings, details: { ...details, excludedBy: rule.rule_key } };
    if (typeof config.minRank === 'number' && member.rank < config.minRank) return { eligible: false, warnings, details: { ...details, minRank: config.minRank } };
    if (Array.isArray(config.roles) && config.roles.length && !config.roles.includes(member.role)) return { eligible: false, warnings, details: { ...details, roles: config.roles } };
    const metricName = readString(config.minimumMetric);
    if (metricName) {
      const minimum = typeof config.minimumValue === 'number' ? config.minimumValue : null;
      if (minimum === null || !(metricName in metrics)) {
        warnings.push('eligibility_metric_config_invalid');
      } else if (Number(metrics[metricName as keyof PayrollMetricSnapshot]) < minimum) {
        return { eligible: false, warnings, details: { ...details, minimumMetric: metricName, minimumValue: minimum } };
      }
    }
  }
  return { eligible: true, warnings, details };
}

function salaryRuleApplies(rule: SalaryRuleRow, member: PayrollMemberRow, metrics: PayrollMetricSnapshot): boolean {
  const config = rule.config ?? {};
  if (Number(rule.amount) <= 0 && rule.rule_type !== 'base_salary') return false;
  if (!memberMatchesRuleScope(member, config)) return false;
  if (rule.basis === 'manual') return true;
  if (rule.basis === 'member') return Array.isArray(config.memberIds) && config.memberIds.includes(member.id);
  if (rule.basis === 'role') return Array.isArray(config.roles) && config.roles.includes(member.role);
  if (rule.basis === 'rank') {
    const minRank = typeof config.minRank === 'number' ? config.minRank : null;
    const maxRank = typeof config.maxRank === 'number' ? config.maxRank : null;
    return (minRank === null || member.rank >= minRank) && (maxRank === null || member.rank <= maxRank);
  }
  if (rule.basis === 'activity_metric') {
    const metricName = readString(config.metric);
    const minimum = typeof config.minimum === 'number' ? config.minimum : 1;
    const maximum = typeof config.maximum === 'number' ? config.maximum : null;
    if (!metricName || !(metricName in metrics)) return false;
    const value = Number(metrics[metricName as keyof PayrollMetricSnapshot]);
    return value >= minimum && (maximum === null || value <= maximum);
  }
  return false;
}

function memberMatchesRuleScope(member: PayrollMemberRow, config: Record<string, unknown>): boolean {
  const includeRoles = Array.isArray(config.roles) ? config.roles.filter((role): role is string => typeof role === 'string') : [];
  if (includeRoles.length && !includeRoles.includes(member.role)) return false;
  const excludedRoles = Array.isArray(config.excludedRoles) ? config.excludedRoles.filter((role): role is string => typeof role === 'string') : [];
  if (excludedRoles.includes(member.role)) return false;
  const permissions = Array.isArray(member.permissions) ? member.permissions : [];
  const requiredPermissions = Array.isArray(config.requiredPermissions) ? config.requiredPermissions.filter((permission): permission is string => typeof permission === 'string') : [];
  if (requiredPermissions.length && !requiredPermissions.some((permission) => permissions.includes(permission))) return false;
  const excludedPermissions = Array.isArray(config.excludedPermissions) ? config.excludedPermissions.filter((permission): permission is string => typeof permission === 'string') : [];
  if (excludedPermissions.some((permission) => permissions.includes(permission))) return false;
  return true;
}

function selectPremiumRules(rules: SalaryRuleRow[]): SalaryRuleRow[] {
  const selected: SalaryRuleRow[] = [];
  const highestOnly = new Map<string, SalaryRuleRow>();
  for (const rule of rules) {
    if (rule.stacking_policy !== 'highest_only') {
      selected.push(rule);
      continue;
    }
    const key = readString(rule.config.category) ?? readString(rule.config.sourceType) ?? rule.rule_type;
    const current = highestOnly.get(key);
    if (!current || Number(rule.amount) > Number(current.amount) || (Number(rule.amount) === Number(current.amount) && rule.priority < current.priority)) {
      highestOnly.set(key, rule);
    }
  }
  return [...selected, ...highestOnly.values()].sort((left, right) => left.priority - right.priority || left.rule_key.localeCompare(right.rule_key));
}

function applyDerivedPayrollMetrics(members: PayrollMemberRow[], metricsByMember: Map<string, PayrollMetricSnapshot>): void {
  for (const metrics of metricsByMember.values()) {
    metrics.towerParticipation = metrics.towerDefensePresent + metrics.towerDefenseLate;
    const towerActivity = Math.max(metrics.towerParticipation, metrics.towerDefenseSuccessfulCommanded);
    const eventActivity = Math.max(metrics.eventsAttended, metrics.eventsOrganized);
    metrics.overallActivityCount = metrics.questsCompleted + towerActivity + eventActivity;
    metrics.overallLeaderboardRank = 0;
  }
  const ranked = members
    .map((member) => ({ member, metrics: metricsByMember.get(member.id) ?? emptyMetrics() }))
    .filter((entry) => entry.metrics.overallActivityCount > 0)
    .sort((left, right) =>
      right.metrics.overallActivityCount - left.metrics.overallActivityCount ||
      left.member.nickname.localeCompare(right.member.nickname) ||
      left.member.id.localeCompare(right.member.id),
    );
  let previousScore: number | null = null;
  let previousRank = 0;
  ranked.forEach((entry, index) => {
    const rank = previousScore === entry.metrics.overallActivityCount ? previousRank : index + 1;
    entry.metrics.overallLeaderboardRank = rank;
    previousScore = entry.metrics.overallActivityCount;
    previousRank = rank;
  });
}

function validateRuleConfig(ruleType: SalaryRuleRecord['ruleType'], basis: SalaryRuleRecord['basis'], config: Record<string, unknown>): void {
  if (ruleType === 'base_salary' && basis === 'activity_metric') {
    throw new FinanceError('VALIDATION_ERROR', 'Base salary cannot use activity_metric basis.', 400);
  }
  if (basis === 'rank' && typeof config.minRank !== 'number' && typeof config.maxRank !== 'number') {
    throw new FinanceError('VALIDATION_ERROR', 'Rank rule requires minRank or maxRank.', 400);
  }
  if (basis === 'role' && (!Array.isArray(config.roles) || !config.roles.length)) {
    throw new FinanceError('VALIDATION_ERROR', 'Role rule requires roles.', 400);
  }
  if (basis === 'member' && (!Array.isArray(config.memberIds) || !config.memberIds.length)) {
    throw new FinanceError('VALIDATION_ERROR', 'Member rule requires memberIds.', 400);
  }
  if (basis === 'activity_metric') {
    const metric = readString(config.metric);
    if (!metric || !(metric in emptyMetrics())) throw new FinanceError('VALIDATION_ERROR', 'Activity metric rule requires a supported metric.', 400);
  }
}

function emptyMetrics(): PayrollMetricSnapshot {
  return {
    questsParticipated: 0,
    questsHelped: 0,
    questsCompleted: 0,
    questBestParticipant: 0,
    towerDefenseResponded: 0,
    towerDefensePresent: 0,
    towerDefenseLate: 0,
    towerDefenseAbsent: 0,
    towerDefenseExcused: 0,
    towerDefenseDefended: 0,
    towerDefenseLost: 0,
    towerDefenseCommanded: 0,
    towerDefenseSuccessfulCommanded: 0,
    towerParticipation: 0,
    eventsJoined: 0,
    eventsAttended: 0,
    eventsLate: 0,
    eventsAbsent: 0,
    eventsExcused: 0,
    eventsOrganized: 0,
    achievementsEarned: 0,
    overallActivityCount: 0,
    overallLeaderboardRank: 0,
  };
}

function inPayrollRange(value: Date, period: PeriodRow): boolean {
  return value >= period.starts_at && value < period.ends_at;
}

function snapshotRules(rules: SalaryRuleRow[]): Array<Record<string, unknown>> {
  return rules.map((rule) => ({
    id: rule.id,
    ruleKey: rule.rule_key,
    ruleType: rule.rule_type,
    version: rule.version,
    basis: rule.basis,
    amount: Number(rule.amount),
    currency: rule.currency,
    priority: rule.priority,
    stackingPolicy: rule.stacking_policy,
    config: rule.config ?? {},
  }));
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readPremiumCategory(value: unknown): PremiumEntitlementRecord['category'] | null {
  const category = readString(value);
  return category && ['manual', 'activity', 'quest_activity', 'combat', 'top3', 'leadership', 'special'].includes(category)
    ? category as PremiumEntitlementRecord['category']
    : null;
}

function readPremiumSourceType(value: unknown): PremiumEntitlementRecord['sourceType'] | null {
  const sourceType = readString(value);
  return sourceType && ['manual', 'rule', 'leaderboard', 'achievement', 'special'].includes(sourceType)
    ? sourceType as PremiumEntitlementRecord['sourceType']
    : null;
}

function requireAccountingManager(auth: FamilyAuthContext): void {
  if (!canManageAccounting(auth)) throw new FinanceError('ACCOUNTING_PERMISSION_DENIED', undefined, 403);
}

function canManageAccounting(auth: FamilyAuthContext): boolean {
  return auth.role === 'owner' || auth.rank >= 8 || auth.permissions.includes('manage_accounting') || auth.permissions.includes('manage_treasury');
}

function accountingRoleLabel(rank: number, role: string, permissions: string[]): string {
  if (role === 'owner' || rank >= 10) return 'Голова';
  if (permissions.includes('manage_treasury') || permissions.includes('manage_accounting') || rank >= 9) return 'Хранитель полум’я / Зам';
  if (rank >= 8) return 'Старші дракони';
  if (rank >= 7) return 'Багряні Дракони';
  if (rank >= 6) return 'Буревогонь';
  if (rank >= 5) return 'Гримуча луска';
  if (rank >= 4) return 'Півкрило Полум’я';
  if (rank >= 3) return 'Жаринка Луската';
  if (rank >= 2) return 'Димохвіст';
  if (rank >= 1) return 'Міні-Спопеляка';
  return 'Яйце дракона';
}

function clampLimit(limit: number): number {
  return Math.min(Math.max(Number.isFinite(limit) ? limit : 50, 1), 200);
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
    reportingPeriodStart: row.reporting_period_start?.toISOString().slice(0, 10) ?? null,
    reportingPeriodEnd: row.reporting_period_end?.toISOString().slice(0, 10) ?? null,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    payrollPeriodId: row.payroll_period_id ?? null,
    payoutBatchItemId: row.payout_batch_item_id ?? null,
  };
}

function accrualCategory(accrual: FamilyMemberAccrualRecord): string {
  const category = typeof accrual.metadata.category === 'string' ? accrual.metadata.category : null;
  if (accrual.sourceType === 'salary') return 'baseSalary';
  if (['quest', 'quest_reward', 'quest_best_participant'].includes(accrual.sourceType)) return 'quests';
  if (accrual.sourceType === 'reward') return 'rewards';
  if (accrual.sourceType === 'adjustment' || accrual.sourceType === 'manual_bonus') return 'corrections';
  if (accrual.sourceType !== 'premium') return 'other';
  if (category === 'activity') return 'activityPremium';
  if (category === 'quest_activity') return 'questPremium';
  if (category === 'combat') return 'combatPremium';
  if (category === 'leadership') return 'leadershipPremium';
  if (category === 'top3') return 'top3Premium';
  if (category === 'manual' || !category) return 'personalPremium';
  return 'other';
}

function mapPeriod(row: PeriodRow): PayrollPeriodRecord {
  return {
    id: row.id,
    periodType: row.period_type,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    status: row.status,
    title: row.title,
    createdByFamilyMemberId: row.created_by_family_member_id,
    finalizedAt: row.finalized_at?.toISOString() ?? null,
    finalizedByFamilyMemberId: row.finalized_by_family_member_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapSalaryRule(row: SalaryRuleRow): SalaryRuleRecord {
  return {
    id: row.id,
    ruleKey: row.rule_key,
    name: row.name,
    description: row.description,
    ruleType: row.rule_type,
    basis: row.basis,
    amount: Number(row.amount),
    currency: row.currency,
    active: row.active,
    version: row.version,
    priority: row.priority,
    stackingPolicy: row.stacking_policy,
    effectiveFrom: row.effective_from?.toISOString().slice(0, 10) ?? null,
    effectiveTo: row.effective_to?.toISOString().slice(0, 10) ?? null,
    config: row.config ?? {},
    createdByFamilyMemberId: row.created_by_family_member_id,
    updatedByFamilyMemberId: row.updated_by_family_member_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapPremium(row: PremiumRow): PremiumEntitlementRecord {
  return {
    id: row.id,
    payrollPeriodId: row.payroll_period_id,
    familyMemberId: row.family_member_id,
    accrualId: row.accrual_id,
    amount: Number(row.amount),
    currency: row.currency,
    reason: row.reason,
    sourceType: row.source_type,
    sourceId: row.source_id,
    sourceKey: row.source_key,
    category: row.category,
    stackingPolicy: row.stacking_policy,
    status: row.status,
    createdByFamilyMemberId: row.created_by_family_member_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapBatch(row: BatchRow): PayoutBatchRecord {
  return {
    id: row.id,
    payrollPeriodId: row.payroll_period_id,
    title: row.title,
    reference: row.reference,
    status: row.status,
    createdByFamilyMemberId: row.created_by_family_member_id,
    finalizedAt: row.finalized_at?.toISOString() ?? null,
    finalizedByFamilyMemberId: row.finalized_by_family_member_id,
    paidAt: row.paid_at?.toISOString() ?? null,
    totalAmount: Number(row.total_amount ?? 0),
    itemCount: Number(row.item_count ?? 0),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapBatchItem(row: BatchItemRow): PayoutBatchItemRecord {
  return {
    id: row.id,
    payoutBatchId: row.payout_batch_id,
    familyMemberId: row.family_member_id,
    totalAmount: Number(row.total_amount),
    currency: row.currency,
    status: row.status,
    paidByFamilyMemberId: row.paid_by_family_member_id,
    payerNicknameSnapshot: row.payer_nickname_snapshot,
    payerRoleSnapshot: row.payer_role_snapshot,
    paymentProofId: row.payment_proof_id,
    paidAt: row.paid_at?.toISOString() ?? null,
    accountingTransactionId: row.accounting_transaction_id,
    accrualIds: row.accrual_ids ?? [],
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
    payoutBatchId: row.payout_batch_id ?? null,
    payoutBatchItemId: row.payout_batch_item_id ?? null,
    paymentProofId: row.payment_proof_id ?? null,
    payerNicknameSnapshot: row.payer_nickname_snapshot ?? null,
    payerRoleSnapshot: row.payer_role_snapshot ?? null,
    recordedAt: row.recorded_at?.toISOString() ?? row.created_at.toISOString(),
  };
}

function buildWeeklyEarnings(accruals: FamilyMemberAccrualRecord[]) {
  const week = getPayrollWeekBoundary();
  const start = week.startsAt;
  const end = week.endsAt;
  const weekly = accruals.filter((item) => {
    const occurred = new Date(item.reportingPeriodEnd ?? item.reportingPeriodStart ?? item.createdAt);
    return occurred >= start && occurred < end && item.status !== 'cancelled';
  });
  const by = (predicate: (item: FamilyMemberAccrualRecord) => boolean) => weekly.filter(predicate).reduce((total, item) => total + item.amount, 0);
  const baseSalary = by((item) => item.sourceType === 'salary');
  const quests = by((item) => item.sourceType === 'quest' || item.sourceType === 'quest_reward' || item.sourceType === 'quest_best_participant');
  const rewards = by((item) => item.sourceType === 'reward');
  const activityPremium = by((item) => item.sourceType === 'premium' && item.metadata.category === 'activity');
  const questPremium = by((item) => item.sourceType === 'premium' && item.metadata.category === 'quest_activity');
  const combatPremium = by((item) => item.sourceType === 'premium' && item.metadata.category === 'combat');
  const leadershipPremium = by((item) => item.sourceType === 'premium' && item.metadata.category === 'leadership');
  const top3Premium = by((item) => item.sourceType === 'premium' && item.metadata.category === 'top3');
  const personalPremium = by((item) => item.sourceType === 'premium' && (!item.metadata.category || item.metadata.category === 'manual'));
  const corrections = by((item) => item.sourceType === 'adjustment' || item.sourceType === 'manual_bonus');
  const other = by((item) => !['salary', 'quest', 'quest_reward', 'quest_best_participant', 'reward', 'premium', 'adjustment', 'manual_bonus'].includes(item.sourceType));
  const accrued = weekly.reduce((total, item) => total + item.amount, 0);
  const paid = weekly.filter((item) => item.status === 'paid').reduce((total, item) => total + item.amount, 0);
  return {
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    currency: weekly[0]?.currency ?? 'USD',
    categories: {
      baseSalary,
      quests,
      activityPremium,
      questPremium,
      combatPremium,
      leadershipPremium,
      top3Premium,
      personalPremium,
      rewards,
      corrections,
      other,
    },
    totals: {
      accrued,
      paid,
      outstanding: accrued - paid,
    },
  };
}
