import { authenticatedFetch } from './family-backend-auth-client';

export class FamilyAccountingApiError extends Error {
  constructor(message: string, readonly code = 'REQUEST_FAILED', readonly status = 0) {
    super(message);
    this.name = 'FamilyAccountingApiError';
  }
}

export type BackendAccountingAccrual = {
  id: string;
  familyMemberId: string;
  sourceType: string;
  sourceId: string;
  sourceKey?: string | null;
  amount: number;
  currency: string;
  reason: string;
  status: string;
  approvedAt?: string | null;
  paidAt?: string | null;
  reportingPeriodStart?: string | null;
  reportingPeriodEnd?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type BackendPayoutBatch = {
  id: string;
  payrollPeriodId: string | null;
  title: string;
  reference: string | null;
  status: string;
  totalAmount: number;
  itemCount: number;
  createdAt: string;
};

export type BackendPayrollPeriod = {
  id: string;
  periodType: 'weekly' | 'monthly' | 'custom';
  startsAt: string;
  endsAt: string;
  status: string;
  title: string;
};

export type BackendSalaryRule = {
  id: string;
  ruleKey: string;
  name: string;
  description: string | null;
  ruleType: string;
  basis: string;
  amount: number;
  currency: string;
  active: boolean;
  version: number;
  priority: number;
  stackingPolicy: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  config: Record<string, unknown>;
};

export type BackendPayrollPreviewItem = {
  familyMemberId: string;
  displayName: string;
  eligible: boolean;
  status: string;
  baseAmount: number;
  modifiersTotal: number;
  premiumPreviewTotal: number;
  finalSalary: number;
  currency: string;
  warnings: string[];
};

export type BackendPayrollPreview = {
  period: BackendPayrollPeriod;
  configurationComplete: boolean;
  warnings: string[];
  items: BackendPayrollPreviewItem[];
};

export type BackendPayoutBatchItem = {
  id: string;
  payoutBatchId: string;
  familyMemberId: string;
  totalAmount: number;
  currency: string;
  status: string;
  paidByFamilyMemberId: string | null;
  payerNicknameSnapshot: string | null;
  payerRoleSnapshot: string | null;
  paymentProofId: string | null;
  paidAt: string | null;
  accountingTransactionId: string | null;
  accrualIds: string[];
};

export type BackendAccountingDashboard = {
  pendingAccruals: BackendAccountingAccrual[];
  payoutBatches: BackendPayoutBatch[];
};

export type BackendPayableMemberSummary = {
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
  accruals: BackendAccountingAccrual[];
};

export type BackendPayableSummary = {
  items: BackendPayableMemberSummary[];
};

export type BackendMemberAccountingReport = {
  memberId: string;
  totals: {
    accrued: number;
    payable: number;
    paid: number;
    outstanding: number;
    currency: string;
  };
  bySource: {
    salary: number;
    premium: number;
    rewards: number;
    quests: number;
    adjustments: number;
  };
  weeklyEarnings?: {
    startsAt: string;
    endsAt: string;
    currency: string;
    categories: {
      baseSalary: number;
      quests: number;
      activityPremium: number;
      questPremium: number;
      combatPremium: number;
      leadershipPremium: number;
      top3Premium: number;
      personalPremium: number;
      rewards: number;
      corrections: number;
      other: number;
    };
    totals: {
      accrued: number;
      paid: number;
      outstanding: number;
    };
  };
  accruals: BackendAccountingAccrual[];
  payoutHistory: BackendPayoutBatchItem[];
};

export type BackendWeeklyActivityStatus = {
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

export async function getBackendAccountingDashboard(signal?: AbortSignal): Promise<BackendAccountingDashboard> {
  return assertDashboard(await requestJson('/api/family/accounting/dashboard', { method: 'GET', signal }));
}

export async function getBackendPayableSummary(signal?: AbortSignal): Promise<BackendPayableSummary> {
  const value = await requestJson('/api/family/accounting/payable-summary', { method: 'GET', signal });
  if (!isRecord(value) || !Array.isArray(value.items)) throw malformed();
  return { items: value.items.map(assertPayableMemberSummary) };
}

export async function listBackendPayrollPeriods(signal?: AbortSignal): Promise<{ items: BackendPayrollPeriod[] }> {
  const value = await requestJson('/api/family/accounting/payroll-periods', { method: 'GET', signal });
  if (!isRecord(value) || !Array.isArray(value.items)) throw malformed();
  return { items: value.items.map(assertPeriod) };
}

export async function listBackendSalaryRules(signal?: AbortSignal): Promise<{ items: BackendSalaryRule[] }> {
  const value = await requestJson('/api/family/accounting/salary-rules', { method: 'GET', signal });
  if (!isRecord(value) || !Array.isArray(value.items)) throw malformed();
  return { items: value.items.map(assertSalaryRule) };
}

export async function createBackendPayrollPeriod(payload: { periodType: 'weekly' | 'monthly' | 'custom'; startsAt: string; endsAt: string; title: string }): Promise<BackendPayrollPeriod> {
  return assertPeriod(await requestJson('/api/family/accounting/payroll-periods', { method: 'POST', body: JSON.stringify(payload) }));
}

export async function createBackendSalaryRule(payload: { ruleKey: string; name: string; ruleType?: string; basis: string; amount: number; active?: boolean; priority?: number; stackingPolicy?: string; config?: Record<string, unknown> }): Promise<BackendSalaryRule> {
  return assertSalaryRule(await requestJson('/api/family/accounting/salary-rules', { method: 'POST', body: JSON.stringify(payload) }));
}

export async function updateBackendSalaryRule(ruleId: string, payload: Partial<{ name: string; description: string | null; ruleType: string; basis: string; amount: number; active: boolean; priority: number; stackingPolicy: string; config: Record<string, unknown> }>): Promise<BackendSalaryRule> {
  return assertSalaryRule(await requestJson(`/api/family/accounting/salary-rules/${encodeURIComponent(ruleId)}`, { method: 'PATCH', body: JSON.stringify(payload) }));
}

export async function setBackendSalaryRuleActive(ruleId: string, active: boolean): Promise<BackendSalaryRule> {
  const action = active ? 'activate' : 'deactivate';
  return assertSalaryRule(await requestJson(`/api/family/accounting/salary-rules/${encodeURIComponent(ruleId)}/${action}`, { method: 'POST' }));
}

export async function previewBackendPayrollPeriod(periodId: string, signal?: AbortSignal): Promise<BackendPayrollPreview> {
  return assertPreview(await requestJson(`/api/family/accounting/payroll-periods/${encodeURIComponent(periodId)}/preview`, { method: 'GET', signal }));
}

export async function validateBackendPayrollPeriod(periodId: string, signal?: AbortSignal): Promise<{ configurationComplete: boolean; warnings: string[]; preview: BackendPayrollPreview }> {
  const value = await requestJson(`/api/family/accounting/payroll-periods/${encodeURIComponent(periodId)}/validate`, { method: 'GET', signal });
  if (!isRecord(value) || !isRecord(value.preview) || !Array.isArray(value.warnings)) throw malformed();
  return {
    configurationComplete: Boolean(value.configurationComplete),
    warnings: value.warnings.map(String),
    preview: assertPreview(value.preview),
  };
}

export async function calculateBackendPayrollPeriod(periodId: string): Promise<unknown> {
  return requestJson(`/api/family/accounting/payroll-periods/${encodeURIComponent(periodId)}/calculate`, { method: 'POST' });
}

export async function finalizeBackendPayrollPeriod(periodId: string): Promise<BackendPayrollPeriod> {
  return assertPeriod(await requestJson(`/api/family/accounting/payroll-periods/${encodeURIComponent(periodId)}/finalize`, { method: 'POST' }));
}

export async function createBackendPremium(payload: { familyMemberId: string; payrollPeriodId?: string | null; amount: number; reason: string; sourceKey?: string | null; category?: string; stackingPolicy?: string }): Promise<unknown> {
  return requestJson('/api/family/accounting/premiums', { method: 'POST', body: JSON.stringify(payload) });
}

export async function createBackendAdjustment(payload: { familyMemberId: string; amount: number; reason: string; sourceKey?: string | null }): Promise<BackendAccountingAccrual> {
  return assertAccrual(await requestJson('/api/family/accounting/adjustments', { method: 'POST', body: JSON.stringify(payload) }));
}

export async function createBackendPayoutBatch(payload: { payrollPeriodId?: string | null; title: string; accrualIds: string[] }): Promise<{ batch: BackendPayoutBatch; items: BackendPayoutBatchItem[] }> {
  const value = await requestJson('/api/family/accounting/payout-batches', { method: 'POST', body: JSON.stringify(payload) });
  if (!isRecord(value) || !isRecord(value.batch) || !Array.isArray(value.items)) throw malformed();
  return { batch: assertBatch(value.batch), items: value.items.map(assertBatchItem) };
}

export async function finalizeBackendPayoutBatch(batchId: string): Promise<BackendPayoutBatch> {
  return assertBatch(await requestJson(`/api/family/accounting/payout-batches/${encodeURIComponent(batchId)}/finalize`, { method: 'POST' }));
}

export async function confirmBackendPayoutItemPaid(batchId: string, itemId: string, payload: { proof: { originalFilename: string; contentType: 'image/png' | 'image/jpeg' | 'image/webp'; dataBase64: string }; idempotencyKey?: string | null }): Promise<{ item: BackendPayoutBatchItem }> {
  const value = await requestJson(`/api/family/accounting/payout-batches/${encodeURIComponent(batchId)}/items/${encodeURIComponent(itemId)}/confirm-paid`, { method: 'POST', body: JSON.stringify(payload) });
  if (!isRecord(value) || !isRecord(value.item)) throw malformed();
  return { item: assertBatchItem(value.item) };
}

export async function fetchBackendPaymentProofDataUrl(proofId: string): Promise<{ dataUrl: string; contentType: string }> {
  let response: Response;
  try {
    response = await authenticatedFetch(`/api/family/accounting/payment-proofs/${encodeURIComponent(proofId)}`, { method: 'GET' });
  } catch (error) {
    throw new FamilyAccountingApiError(error instanceof Error ? error.message : 'Payment proof is unavailable', 'BACKEND_UNAVAILABLE');
  }
  if (!response.ok) {
    throw new FamilyAccountingApiError(`Payment proof request failed: ${response.status}`, 'REQUEST_FAILED', response.status);
  }
  const contentType = response.headers.get('content-type') ?? 'image/png';
  const blob = await response.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new FamilyAccountingApiError('Could not read payment proof image', 'PROOF_READ_FAILED'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
  return { dataUrl, contentType };
}

export async function getBackendMemberAccountingReport(memberId: string, signal?: AbortSignal): Promise<BackendMemberAccountingReport> {
  const value = await requestJson(`/api/family/members/${encodeURIComponent(memberId)}/accounting-report`, { method: 'GET', signal });
  if (!isRecord(value) || !isRecord(value.totals) || !isRecord(value.bySource) || !Array.isArray(value.accruals) || !Array.isArray(value.payoutHistory)) throw malformed();
  return {
    memberId: stringField(value, 'memberId'),
    totals: {
      accrued: numberField(value.totals, 'accrued'),
      payable: numberField(value.totals, 'payable'),
      paid: numberField(value.totals, 'paid'),
      outstanding: numberField(value.totals, 'outstanding'),
      currency: stringField(value.totals, 'currency'),
    },
    bySource: {
      salary: numberField(value.bySource, 'salary'),
      premium: numberField(value.bySource, 'premium'),
      rewards: numberField(value.bySource, 'rewards'),
      quests: numberField(value.bySource, 'quests'),
      adjustments: numberField(value.bySource, 'adjustments'),
    },
    weeklyEarnings: isRecord(value.weeklyEarnings) ? assertWeeklyEarnings(value.weeklyEarnings) : undefined,
    accruals: value.accruals.map(assertAccrual),
    payoutHistory: value.payoutHistory.map(assertBatchItem),
  };
}

export async function getBackendWeeklyActivityStatus(memberId: string, signal?: AbortSignal): Promise<BackendWeeklyActivityStatus> {
  return assertWeeklyActivityStatus(await requestJson(`/api/family/members/${encodeURIComponent(memberId)}/weekly-activity`, { method: 'GET', signal }));
}

async function requestJson(path: string, init: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body) headers.set('Content-Type', 'application/json');
    response = await authenticatedFetch(path, { ...init, headers });
  } catch (error) {
    throw new FamilyAccountingApiError(error instanceof Error ? error.message : 'Accounting backend is unavailable', 'BACKEND_UNAVAILABLE');
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const message = isRecord(body) && typeof body.message === 'string' ? body.message : `Accounting request failed: ${response.status}`;
    throw new FamilyAccountingApiError(message, isRecord(body) && typeof body.code === 'string' ? body.code : 'REQUEST_FAILED', response.status);
  }
  return body;
}

function assertDashboard(value: unknown): BackendAccountingDashboard {
  if (!isRecord(value) || !Array.isArray(value.pendingAccruals) || !Array.isArray(value.payoutBatches)) throw malformed();
  return { pendingAccruals: value.pendingAccruals.map(assertAccrual), payoutBatches: value.payoutBatches.map(assertBatch) };
}

function assertAccrual(value: unknown): BackendAccountingAccrual {
  if (!isRecord(value)) throw malformed();
  return {
    id: stringField(value, 'id'),
    familyMemberId: stringField(value, 'familyMemberId'),
    sourceType: stringField(value, 'sourceType'),
    sourceId: stringField(value, 'sourceId'),
    sourceKey: nullableStringField(value, 'sourceKey'),
    amount: numberField(value, 'amount'),
    currency: stringField(value, 'currency'),
    reason: stringField(value, 'reason'),
    status: stringField(value, 'status'),
    approvedAt: nullableStringField(value, 'approvedAt'),
    paidAt: nullableStringField(value, 'paidAt'),
    reportingPeriodStart: nullableStringField(value, 'reportingPeriodStart'),
    reportingPeriodEnd: nullableStringField(value, 'reportingPeriodEnd'),
    metadata: isRecord(value.metadata) ? value.metadata : {},
    createdAt: stringField(value, 'createdAt'),
  };
}

function assertPayableMemberSummary(value: unknown): BackendPayableMemberSummary {
  if (!isRecord(value) || !Array.isArray(value.accrualIds) || !Array.isArray(value.accruals) || !isRecord(value.breakdown)) throw malformed();
  const breakdown: Record<string, number> = {};
  for (const [key, amount] of Object.entries(value.breakdown)) {
    if (typeof amount === 'number' && Number.isFinite(amount)) breakdown[key] = amount;
  }
  return {
    memberId: stringField(value, 'memberId'),
    nickname: stringField(value, 'nickname'),
    staticId: nullableStringField(value, 'staticId'),
    rank: numberField(value, 'rank'),
    role: stringField(value, 'role'),
    roleLabel: stringField(value, 'roleLabel'),
    totalOutstanding: numberField(value, 'totalOutstanding'),
    currency: stringField(value, 'currency'),
    accrualCount: numberField(value, 'accrualCount'),
    accrualIds: value.accrualIds.map(String),
    breakdown,
    accruals: value.accruals.map(assertAccrual),
  };
}

function assertBatch(value: unknown): BackendPayoutBatch {
  if (!isRecord(value)) throw malformed();
  return {
    id: stringField(value, 'id'),
    payrollPeriodId: nullableStringField(value, 'payrollPeriodId'),
    title: stringField(value, 'title'),
    reference: nullableStringField(value, 'reference'),
    status: stringField(value, 'status'),
    totalAmount: numberField(value, 'totalAmount'),
    itemCount: numberField(value, 'itemCount'),
    createdAt: stringField(value, 'createdAt'),
  };
}

function assertBatchItem(value: unknown): BackendPayoutBatchItem {
  if (!isRecord(value) || !Array.isArray(value.accrualIds)) throw malformed();
  return {
    id: stringField(value, 'id'),
    payoutBatchId: stringField(value, 'payoutBatchId'),
    familyMemberId: stringField(value, 'familyMemberId'),
    totalAmount: numberField(value, 'totalAmount'),
    currency: stringField(value, 'currency'),
    status: stringField(value, 'status'),
    paidByFamilyMemberId: nullableStringField(value, 'paidByFamilyMemberId'),
    payerNicknameSnapshot: nullableStringField(value, 'payerNicknameSnapshot'),
    payerRoleSnapshot: nullableStringField(value, 'payerRoleSnapshot'),
    paymentProofId: nullableStringField(value, 'paymentProofId'),
    paidAt: nullableStringField(value, 'paidAt'),
    accountingTransactionId: nullableStringField(value, 'accountingTransactionId'),
    accrualIds: value.accrualIds.map(String),
  };
}

function assertPeriod(value: unknown): BackendPayrollPeriod {
  if (!isRecord(value)) throw malformed();
  return {
    id: stringField(value, 'id'),
    periodType: stringField(value, 'periodType') as 'weekly' | 'monthly' | 'custom',
    startsAt: stringField(value, 'startsAt'),
    endsAt: stringField(value, 'endsAt'),
    status: stringField(value, 'status'),
    title: stringField(value, 'title'),
  };
}

function assertWeeklyEarnings(value: Record<string, unknown>): NonNullable<BackendMemberAccountingReport['weeklyEarnings']> {
  if (!isRecord(value.categories) || !isRecord(value.totals)) throw malformed();
  return {
    startsAt: stringField(value, 'startsAt'),
    endsAt: stringField(value, 'endsAt'),
    currency: stringField(value, 'currency'),
    categories: {
      baseSalary: numberField(value.categories, 'baseSalary'),
      quests: numberField(value.categories, 'quests'),
      activityPremium: numberField(value.categories, 'activityPremium'),
      questPremium: numberField(value.categories, 'questPremium'),
      combatPremium: numberField(value.categories, 'combatPremium'),
      leadershipPremium: numberField(value.categories, 'leadershipPremium'),
      top3Premium: numberField(value.categories, 'top3Premium'),
      personalPremium: numberField(value.categories, 'personalPremium'),
      rewards: numberField(value.categories, 'rewards'),
      corrections: numberField(value.categories, 'corrections'),
      other: numberField(value.categories, 'other'),
    },
    totals: {
      accrued: numberField(value.totals, 'accrued'),
      paid: numberField(value.totals, 'paid'),
      outstanding: numberField(value.totals, 'outstanding'),
    },
  };
}

function assertWeeklyActivityStatus(value: unknown): BackendWeeklyActivityStatus {
  if (!isRecord(value)) throw malformed();
  const qualifyingReason = stringField(value, 'qualifyingReason');
  if (!['quest', 'tower', 'both', 'none'].includes(qualifyingReason)) throw malformed();
  return {
    periodId: nullableStringField(value, 'periodId'),
    startsAt: stringField(value, 'startsAt'),
    endsAt: stringField(value, 'endsAt'),
    completedQuests: numberField(value, 'completedQuests'),
    towerParticipations: numberField(value, 'towerParticipations'),
    questRequirement: 1,
    towerRequirement: 1,
    eligible: Boolean(value.eligible),
    qualifyingReason: qualifyingReason as BackendWeeklyActivityStatus['qualifyingReason'],
  };
}

function assertSalaryRule(value: unknown): BackendSalaryRule {
  if (!isRecord(value) || !isRecord(value.config)) throw malformed();
  return {
    id: stringField(value, 'id'),
    ruleKey: stringField(value, 'ruleKey'),
    name: stringField(value, 'name'),
    description: nullableStringField(value, 'description'),
    ruleType: stringField(value, 'ruleType'),
    basis: stringField(value, 'basis'),
    amount: numberField(value, 'amount'),
    currency: stringField(value, 'currency'),
    active: Boolean(value.active),
    version: numberField(value, 'version'),
    priority: numberField(value, 'priority'),
    stackingPolicy: stringField(value, 'stackingPolicy'),
    effectiveFrom: nullableStringField(value, 'effectiveFrom'),
    effectiveTo: nullableStringField(value, 'effectiveTo'),
    config: value.config,
  };
}

function assertPreview(value: unknown): BackendPayrollPreview {
  if (!isRecord(value) || !isRecord(value.period) || !Array.isArray(value.warnings) || !Array.isArray(value.items)) throw malformed();
  return {
    period: assertPeriod(value.period),
    configurationComplete: Boolean(value.configurationComplete),
    warnings: value.warnings.map(String),
    items: value.items.map(assertPreviewItem),
  };
}

function assertPreviewItem(value: unknown): BackendPayrollPreviewItem {
  if (!isRecord(value) || !Array.isArray(value.warnings)) throw malformed();
  return {
    familyMemberId: stringField(value, 'familyMemberId'),
    displayName: stringField(value, 'displayName'),
    eligible: Boolean(value.eligible),
    status: stringField(value, 'status'),
    baseAmount: numberField(value, 'baseAmount'),
    modifiersTotal: numberField(value, 'modifiersTotal'),
    premiumPreviewTotal: numberField(value, 'premiumPreviewTotal'),
    finalSalary: numberField(value, 'finalSalary'),
    currency: stringField(value, 'currency'),
    warnings: value.warnings.map(String),
  };
}

function stringField(value: Record<string, unknown>, field: string): string {
  if (typeof value[field] !== 'string') throw malformed();
  return value[field];
}

function nullableStringField(value: Record<string, unknown>, field: string): string | null {
  if (value[field] === null || value[field] === undefined) return null;
  if (typeof value[field] !== 'string') throw malformed();
  return value[field];
}

function numberField(value: Record<string, unknown>, field: string): number {
  if (typeof value[field] !== 'number' || !Number.isFinite(value[field])) throw malformed();
  return value[field];
}

function malformed(): FamilyAccountingApiError {
  return new FamilyAccountingApiError('Accounting backend response was malformed', 'MALFORMED_RESPONSE');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
