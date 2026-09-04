import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  calculateBackendPayrollPeriod,
  confirmBackendPayoutItemPaid,
  createBackendAdjustment,
  createBackendPayoutBatch,
  createBackendPayrollPeriod,
  createBackendPremium,
  createBackendSalaryRule,
  FamilyAccountingApiError,
  fetchBackendPaymentProofDataUrl,
  finalizeBackendPayoutBatch,
  finalizeBackendPayrollPeriod,
  getBackendAccountingDashboard,
  getBackendMemberAccountingReport,
  getBackendPayableSummary,
  getBackendWeeklyActivityStatus,
  listBackendPayrollPeriods,
  listBackendSalaryRules,
  previewBackendPayrollPeriod,
  setBackendSalaryRuleActive,
  type BackendAccountingAccrual,
  type BackendAccountingDashboard,
  type BackendMemberAccountingReport,
  type BackendPayableMemberSummary,
  type BackendPayableSummary,
  type BackendPayrollPeriod,
  type BackendPayrollPreview,
  type BackendPayoutBatch,
  type BackendPayoutBatchItem,
  type BackendSalaryRule,
  type BackendWeeklyActivityStatus
} from '../../../lib/family-accounting-backend-client';
import { canManageAccounting, canViewAccounting } from '../../../lib/family-permissions';
import type { FamilyUser } from '../../../lib/family-types';

type LoadState =
  | { status: 'loading'; message: string }
  | { status: 'error'; message: string }
  | { status: 'ready'; dashboard: BackendAccountingDashboard; payableSummary: BackendPayableSummary; periods: BackendPayrollPeriod[]; rules: BackendSalaryRule[]; preview: BackendPayrollPreview | null; ownReport: BackendMemberAccountingReport | null; weeklyActivity: BackendWeeklyActivityStatus | null };

type PaymentCategoryFilter = 'all' | 'salary' | 'quests' | 'premium' | 'rewards' | 'corrections';
type ProofViewerState =
  | { status: 'loading'; proofId: string; title: string; details: string[] }
  | { status: 'error'; proofId: string; title: string; details: string[]; message: string }
  | { status: 'ready'; proofId: string; dataUrl: string; title: string; details: string[] };

function money(value: number | null | undefined, currency = 'USD') {
  return value == null ? '-' : `${value.toLocaleString('uk-UA')} ${currency}`;
}

function date(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString('uk-UA') : '-';
}

function sourceLabel(accrual: BackendAccountingAccrual | string) {
  const sourceType = typeof accrual === 'string' ? accrual : accrual.sourceType;
  const category = typeof accrual === 'string' ? null : typeof accrual.metadata?.category === 'string' ? accrual.metadata.category : null;
  if (sourceType === 'salary') return 'Базова зарплата';
  if (sourceType === 'premium' && category === 'activity') return 'Премія за активність';
  if (sourceType === 'premium' && category === 'quest_activity') return 'Квестова премія';
  if (sourceType === 'premium' && category === 'combat') return 'Вишки / стаки';
  if (sourceType === 'premium' && category === 'leadership') return 'Leadership premium';
  if (sourceType === 'premium' && category === 'top3') return 'TOP-3';
  if (sourceType === 'premium') return 'Особиста премія';
  if (sourceType === 'reward') return 'Нагорода';
  if (sourceType === 'quest' || sourceType === 'quest_reward' || sourceType === 'quest_best_participant') return 'Квести';
  if (sourceType === 'adjustment' || sourceType === 'manual_bonus') return 'Корекція';
  return 'Інше';
}

const payableBreakdownLabels: Record<string, string> = {
  baseSalary: 'Базова зарплата',
  quests: 'Квести',
  activityPremium: 'Премія за активність',
  questPremium: 'Квестова премія',
  combatPremium: 'Вишки / стаки',
  leadershipPremium: 'Leadership premium',
  top3Premium: 'TOP-3',
  personalPremium: 'Особиста премія',
  rewards: 'Нагорода',
  corrections: 'Корекція',
  other: 'Інше'
};

const managerHistoryTabs: Array<{ key: PaymentCategoryFilter; label: string }> = [
  { key: 'all', label: 'Усі' },
  { key: 'salary', label: 'Зарплата' },
  { key: 'quests', label: 'Квести' },
  { key: 'premium', label: 'Премії' },
  { key: 'rewards', label: 'Rewards' },
  { key: 'corrections', label: 'Корекції' }
];

function memberLabel(users: FamilyUser[], memberId: string) {
  const member = users.find((user) => user.id === memberId || user.nickname === memberId);
  if (!member) return memberId;
  return member.staticId ? `${member.nickname} #${member.staticId}` : member.nickname;
}

function paymentCategoryForItem(item: BackendPayoutBatchItem, accruals: BackendAccountingAccrual[]): PaymentCategoryFilter {
  const linked = accruals.filter((accrual) => item.accrualIds.includes(accrual.id));
  if (linked.some((accrual) => accrual.sourceType === 'salary')) return 'salary';
  if (linked.some((accrual) => ['quest', 'quest_reward', 'quest_best_participant'].includes(accrual.sourceType))) return 'quests';
  if (linked.some((accrual) => accrual.sourceType === 'premium')) return 'premium';
  if (linked.some((accrual) => accrual.sourceType === 'reward')) return 'rewards';
  if (linked.some((accrual) => accrual.sourceType === 'adjustment' || accrual.sourceType === 'manual_bonus')) return 'corrections';
  return 'all';
}

function paymentCategoryLabel(category: PaymentCategoryFilter): string {
  if (category === 'all') return 'Інше';
  return managerHistoryTabs.find((tab) => tab.key === category)?.label ?? 'Інше';
}

function filterPaymentHistory(
  items: BackendPayoutBatchItem[],
  filters: { category: PaymentCategoryFilter; member: string; payer: string; from: string; to: string },
  accruals: BackendAccountingAccrual[],
  users: FamilyUser[]
) {
  const memberNeedle = filters.member.trim().toLowerCase();
  const payerNeedle = filters.payer.trim().toLowerCase();
  const from = filters.from ? new Date(`${filters.from}T00:00:00`) : null;
  const to = filters.to ? new Date(`${filters.to}T23:59:59`) : null;
  return items.filter((item) => {
    const category = paymentCategoryForItem(item, accruals);
    const member = memberLabel(users, item.familyMemberId).toLowerCase();
    const payer = (item.payerNicknameSnapshot ?? '').toLowerCase();
    const paidAt = item.paidAt ? new Date(item.paidAt) : null;
    if (filters.category !== 'all' && category !== filters.category) return false;
    if (memberNeedle && !member.includes(memberNeedle)) return false;
    if (payerNeedle && !payer.includes(payerNeedle)) return false;
    if (from && (!paidAt || paidAt < from)) return false;
    if (to && (!paidAt || paidAt > to)) return false;
    return true;
  });
}

export function FamilyAccounting({ currentUser, users }: { currentUser: FamilyUser; users: FamilyUser[] }) {
  const canView = canViewAccounting(currentUser);
  const canManage = canManageAccounting(currentUser);
  const [state, setState] = useState<LoadState>({ status: 'loading', message: 'Loading accounting from backend...' });
  const [selectedAccrualIds, setSelectedAccrualIds] = useState<string[]>([]);
  const [mutatingKey, setMutatingKey] = useState<string | null>(null);
  const [periodTitle, setPeriodTitle] = useState('Weekly payroll');
  const [ruleName, setRuleName] = useState('Base salary rule');
  const [ruleAmount, setRuleAmount] = useState('');
  const [ruleMinRank, setRuleMinRank] = useState('');
  const [ruleMaxRank, setRuleMaxRank] = useState('');
  const [premiumMemberId, setPremiumMemberId] = useState(users[0]?.id ?? '');
  const [premiumAmount, setPremiumAmount] = useState('');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [reason, setReason] = useState('');
  const [proofByItem, setProofByItem] = useState<Record<string, { originalFilename: string; contentType: 'image/png' | 'image/jpeg' | 'image/webp'; dataBase64: string }>>({});
  const [proofPreviewByItem, setProofPreviewByItem] = useState<Record<string, { filename: string; size: number; dataUrl: string }>>({});
  const [proofViewer, setProofViewer] = useState<ProofViewerState | null>(null);
  const [historyCategory, setHistoryCategory] = useState<PaymentCategoryFilter>('all');
  const [historyMemberFilter, setHistoryMemberFilter] = useState('');
  const [historyPayerFilter, setHistoryPayerFilter] = useState('');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');

  const pendingAccruals = state.status === 'ready' ? state.dashboard.pendingAccruals : [];
  const latestPeriod = state.status === 'ready' ? state.periods[0] ?? null : null;
  const selectedTotal = useMemo(
    () => pendingAccruals.filter((item) => selectedAccrualIds.includes(item.id)).reduce((total, item) => total + item.amount, 0),
    [pendingAccruals, selectedAccrualIds]
  );
  const filteredPaymentHistory = useMemo(() => {
    if (state.status !== 'ready') return [];
    return filterPaymentHistory(
      state.ownReport?.payoutHistory ?? [],
      {
        category: historyCategory,
        member: historyMemberFilter,
        payer: historyPayerFilter,
        from: historyDateFrom,
        to: historyDateTo
      },
      state.ownReport?.accruals ?? [],
      users
    );
  }, [state, historyCategory, historyMemberFilter, historyPayerFilter, historyDateFrom, historyDateTo, users]);

  useEffect(() => {
    if (!canView) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [canView, currentUser.id]);

  async function load(signal?: AbortSignal) {
    setState({ status: 'loading', message: 'Loading accounting from backend...' });
    try {
      const [dashboard, payableSummary, periods, rules, ownReport, weeklyActivity] = await Promise.all([
        getBackendAccountingDashboard(signal),
        canManage ? getBackendPayableSummary(signal) : Promise.resolve({ items: [] }),
        listBackendPayrollPeriods(signal),
        listBackendSalaryRules(signal),
        getBackendMemberAccountingReport(currentUser.id, signal).catch(() => null),
        getBackendWeeklyActivityStatus(currentUser.id, signal).catch(() => null)
      ]);
      const latest = periods.items[0] ?? null;
      const preview = latest ? await previewBackendPayrollPeriod(latest.id, signal).catch(() => null) : null;
      setState({ status: 'ready', dashboard, payableSummary, periods: periods.items, rules: rules.items, preview, ownReport, weeklyActivity });
      setSelectedAccrualIds([]);
    } catch (error) {
      if (signal?.aborted) return;
      setState({ status: 'error', message: accountingErrorMessage(error) });
    }
  }

  async function mutate(key: string, action: () => Promise<unknown>) {
    if (mutatingKey) return;
    setMutatingKey(key);
    try {
      await action();
      await load();
    } catch (error) {
      setState({ status: 'error', message: accountingErrorMessage(error) });
    } finally {
      setMutatingKey(null);
    }
  }

  if (!canView) {
    return (
      <section className="dh-panel rounded-3xl p-5">
        <h2 className="text-lg font-semibold text-white">Бухгалтерія</h2>
        <p className="mt-2 text-sm text-slate-400">Фінансовий розділ доступний тільки власнику або accounting manager.</p>
      </section>
    );
  }

  return (
    <section className="dh-panel rounded-3xl p-5" data-accounting-source="backend">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Бухгалтерія Dragon House</h2>
          <p className="mt-1 text-sm text-slate-400">Accruals, payroll periods, premiums and payout batches are loaded from backend.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={state.status === 'loading'} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-200 disabled:opacity-50">
          Retry
        </button>
      </div>

      {state.status === 'loading' ? <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-slate-300">{state.message}</div> : null}
      {state.status === 'error' ? (
        <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
          {state.message}
          <button type="button" onClick={() => void load()} className="ml-3 rounded-lg border border-red-300/30 px-3 py-1 text-xs">Retry</button>
        </div>
      ) : null}

      {state.status === 'ready' ? (
        <div className="mt-5 space-y-5">
          <div className="grid gap-3 md:grid-cols-4">
            <SummaryCard label="Payable" value={money(state.ownReport?.totals.payable ?? 0, state.ownReport?.totals.currency)} />
            <SummaryCard label="Paid" value={money(state.ownReport?.totals.paid ?? 0, state.ownReport?.totals.currency)} />
            <SummaryCard label="Salary" value={money(state.ownReport?.bySource.salary ?? 0, state.ownReport?.totals.currency)} />
            <SummaryCard label="Premiums" value={money(state.ownReport?.bySource.premium ?? 0, state.ownReport?.totals.currency)} />
          </div>

          {state.weeklyActivity ? (
            <section className={`rounded-2xl border p-4 ${state.weeklyActivity.eligible ? 'border-emerald-400/25 bg-emerald-500/10' : 'border-amber-400/25 bg-amber-500/10'}`}>
              <h3 className="font-semibold text-white">Тижнева активність</h3>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <SummaryCard label="Квести цього тижня" value={`${state.weeklyActivity.completedQuests} / ${state.weeklyActivity.questRequirement}`} />
                <SummaryCard label="Вишки / стаки" value={`${state.weeklyActivity.towerParticipations} / ${state.weeklyActivity.towerRequirement}`} />
              </div>
              {state.weeklyActivity.eligible ? (
                <p className="mt-3 text-sm text-emerald-100">✅ Тижнева активність виконана. Дякуємо за активність у житті сім’ї 🐉</p>
              ) : (
                <div className="mt-3 space-y-2 text-sm text-amber-100">
                  <p>⚠️ Тижнева активність не виконана</p>
                  <p>Для отримання базової зарплати потрібно виконати хоча б 1 сімейний квест або взяти участь хоча б в 1 вишці/стаку протягом тижня.</p>
                  <p>Якщо ви кудись від’їхали або тимчасово зайняті — напишіть Старшим драконам, щоб вони знали, що з вами все добре ❤️</p>
                </div>
              )}
            </section>
          ) : null}

          {state.ownReport?.weeklyEarnings ? (
            <section className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <h3 className="font-semibold text-white">Заробіток за тиждень</h3>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <SummaryCard label="Базова зарплата" value={money(state.ownReport.weeklyEarnings.categories.baseSalary, state.ownReport.weeklyEarnings.currency)} />
                <SummaryCard label="Квести" value={money(state.ownReport.weeklyEarnings.categories.quests, state.ownReport.weeklyEarnings.currency)} />
                <SummaryCard label="Активність" value={money(state.ownReport.weeklyEarnings.categories.activityPremium, state.ownReport.weeklyEarnings.currency)} />
                <SummaryCard label="Квестова премія" value={money(state.ownReport.weeklyEarnings.categories.questPremium, state.ownReport.weeklyEarnings.currency)} />
                <SummaryCard label="Вишки / Стаки" value={money(state.ownReport.weeklyEarnings.categories.combatPremium, state.ownReport.weeklyEarnings.currency)} />
                <SummaryCard label="Leadership premium" value={money(state.ownReport.weeklyEarnings.categories.leadershipPremium, state.ownReport.weeklyEarnings.currency)} />
                <SummaryCard label="TOP-3" value={money(state.ownReport.weeklyEarnings.categories.top3Premium, state.ownReport.weeklyEarnings.currency)} />
                <SummaryCard label="Особисті премії" value={money(state.ownReport.weeklyEarnings.categories.personalPremium, state.ownReport.weeklyEarnings.currency)} />
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <SummaryCard label="Разом нараховано" value={money(state.ownReport.weeklyEarnings.totals.accrued, state.ownReport.weeklyEarnings.currency)} />
                <SummaryCard label="Виплачено" value={money(state.ownReport.weeklyEarnings.totals.paid, state.ownReport.weeklyEarnings.currency)} />
                <SummaryCard label="Очікує виплати" value={money(state.ownReport.weeklyEarnings.totals.outstanding, state.ownReport.weeklyEarnings.currency)} />
              </div>
            </section>
          ) : null}

          {canManage ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 xl:col-span-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-white">Потрібно виплатити</h3>
                    <p className="mt-1 text-xs text-amber-100/80">Backend grouped payable summary. No frontend recalculation.</p>
                  </div>
                  <span className="rounded-full border border-amber-300/30 px-3 py-1 text-xs text-amber-100">{state.payableSummary.items.length} members</span>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  {state.payableSummary.items.map((item) => (
                    <PayableMemberCard
                      key={item.memberId}
                      item={item}
                      mutating={Boolean(mutatingKey)}
                      onPay={() => void mutate(`payable-${item.memberId}`, () => createBackendPayoutBatch({
                        payrollPeriodId: latestPeriod?.id ?? null,
                        title: `Виплата ${item.nickname} ${new Date().toLocaleDateString('uk-UA')}`,
                        accrualIds: item.accrualIds
                      }))}
                    />
                  ))}
                  {!state.payableSummary.items.length ? <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">Наразі немає виплат, що очікують.</div> : null}
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <h3 className="font-semibold text-white">Payroll foundation</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input value={periodTitle} onChange={(event) => setPeriodTitle(event.target.value)} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100" />
                  <button
                    type="button"
                    disabled={Boolean(mutatingKey)}
                    onClick={() => void mutate('period', () => createBackendPayrollPeriod({
                      periodType: 'weekly',
                      startsAt: startOfCurrentWeek(),
                      endsAt: endOfCurrentWeek(),
                      title: periodTitle.trim() || 'Weekly payroll'
                    }))}
                    className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-sm font-semibold text-amber-100 disabled:opacity-50"
                  >
                    Create period
                  </button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <input value={ruleName} onChange={(event) => setRuleName(event.target.value)} placeholder="Rule name" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100" />
                  <input value={ruleAmount} onChange={(event) => setRuleAmount(event.target.value.replace(/[^\d.]/g, ''))} placeholder="Amount" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100" />
                  <input value={ruleMinRank} onChange={(event) => setRuleMinRank(event.target.value.replace(/\D/g, ''))} placeholder="Min rank" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100" />
                  <input value={ruleMaxRank} onChange={(event) => setRuleMaxRank(event.target.value.replace(/\D/g, ''))} placeholder="Max rank" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!Number(ruleAmount) || (!ruleMinRank && !ruleMaxRank) || Boolean(mutatingKey)}
                    onClick={() => void mutate('salary-rule', () => createBackendSalaryRule({
                      ruleKey: `base-rank-${ruleMinRank || 'any'}-${ruleMaxRank || 'any'}-${Date.now()}`,
                      name: ruleName.trim() || 'Base salary rule',
                      ruleType: 'base_salary',
                      basis: 'rank',
                      amount: Number(ruleAmount),
                      config: {
                        ...(ruleMinRank ? { minRank: Number(ruleMinRank) } : {}),
                        ...(ruleMaxRank ? { maxRank: Number(ruleMaxRank) } : {})
                      }
                    }))}
                    className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 disabled:opacity-50"
                  >
                    Add base rule
                  </button>
                  <button type="button" disabled={!latestPeriod || Boolean(mutatingKey)} onClick={() => latestPeriod && void mutate('calculate', () => calculateBackendPayrollPeriod(latestPeriod.id))} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 disabled:opacity-50">Calculate</button>
                  <button type="button" disabled={!latestPeriod || Boolean(mutatingKey)} onClick={() => latestPeriod && void mutate('finalize', () => finalizeBackendPayrollPeriod(latestPeriod.id))} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 disabled:opacity-50">Finalize</button>
                </div>
                <div className="mt-4 grid gap-2">
                  <h4 className="text-sm font-semibold text-slate-200">Salary Rules</h4>
                  {state.rules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
                      <span>
                        <span className="block font-medium text-white">{rule.name}</span>
                        <span className="block text-slate-400">{rule.ruleType} - {rule.basis} - v{rule.version} - {money(rule.amount, rule.currency)}</span>
                      </span>
                      <button type="button" disabled={Boolean(mutatingKey)} onClick={() => void mutate(`rule-${rule.id}`, () => setBackendSalaryRuleActive(rule.id, !rule.active))} className="rounded-lg border border-white/10 px-3 py-1 text-xs text-slate-200 disabled:opacity-50">
                        {rule.active ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  ))}
                  {!state.rules.length ? <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-500">No salary rules configured.</div> : null}
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <h3 className="font-semibold text-white">Premium / adjustment</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <select value={premiumMemberId} onChange={(event) => setPremiumMemberId(event.target.value)} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100">
                    {users.map((user) => <option key={user.id} value={user.id}>{memberLabel(users, user.id)}</option>)}
                  </select>
                  <input value={premiumAmount} onChange={(event) => setPremiumAmount(event.target.value.replace(/[^\d.-]/g, ''))} placeholder="50,000 - 500,000" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100" />
                  <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason" className="sm:col-span-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100" />
                </div>
                <p className="mt-2 text-xs text-slate-500">Manual premium range: 50,000 - 500,000. It becomes payable, not paid.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={!premiumMemberId || !manualPremiumAmountValid(premiumAmount) || !reason.trim() || Boolean(mutatingKey)} onClick={() => void mutate('premium', () => createBackendPremium({ familyMemberId: premiumMemberId, payrollPeriodId: latestPeriod?.id ?? null, amount: Math.abs(Number(premiumAmount)), reason: reason.trim(), sourceKey: `manual-premium:${premiumMemberId}:${Date.now()}`, category: 'manual', stackingPolicy: 'not_applicable' }))} className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-50">Add premium</button>
                  <button type="button" disabled={!premiumMemberId || !Number(adjustmentAmount || premiumAmount) || !reason.trim() || Boolean(mutatingKey)} onClick={() => void mutate('adjustment', () => createBackendAdjustment({ familyMemberId: premiumMemberId, amount: Number(adjustmentAmount || premiumAmount), reason: reason.trim(), sourceKey: `manual-adjustment:${premiumMemberId}:${Date.now()}` }))} className="rounded-xl border border-red-400/40 bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-100 disabled:opacity-50">Add adjustment</button>
                  <input value={adjustmentAmount} onChange={(event) => setAdjustmentAmount(event.target.value.replace(/[^\d.-]/g, ''))} placeholder="Adjustment override" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100" />
                </div>
              </section>
            </div>
          ) : null}

          {canManage && state.preview ? (
            <section className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-white">Payroll Preview</h3>
                  <p className="mt-1 text-xs text-slate-500">Preview is dry-run only. It does not create accruals.</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs ${state.preview.configurationComplete ? 'border-emerald-400/30 text-emerald-100' : 'border-amber-400/30 text-amber-100'}`}>
                  {state.preview.configurationComplete ? 'Configuration ready' : 'Configuration warnings'}
                </span>
              </div>
              {state.preview.warnings.length ? (
                <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-100">
                  {state.preview.warnings.slice(0, 6).join(', ')}
                </div>
              ) : null}
              <div className="mt-3 grid gap-2">
                {state.preview.items.slice(0, 8).map((item) => (
                  <div key={item.familyMemberId} className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-sm md:grid-cols-[1fr_auto_auto_auto]">
                    <span>
                      <span className="block font-medium text-white">{item.displayName}</span>
                      <span className="block text-slate-400">{item.eligible ? item.status : 'ineligible'}{item.warnings.length ? ` - ${item.warnings.join(', ')}` : ''}</span>
                    </span>
                    <span className="text-slate-300">Base {money(item.baseAmount, item.currency)}</span>
                    <span className="text-slate-300">Modifiers {money(item.modifiersTotal, item.currency)}</span>
                    <span className="font-semibold text-amber-100">Salary {money(item.finalSalary, item.currency)} · Premium preview {money(item.premiumPreviewTotal, item.currency)}</span>
                  </div>
                ))}
                {!state.preview.items.length ? <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-500">No eligible active members in preview.</div> : null}
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold text-white">Pending / payable accruals</h3>
                <p className="mt-1 text-xs text-slate-500">Backend [] means there are no payable accruals.</p>
              </div>
              {canManage ? (
                <button type="button" disabled={!selectedAccrualIds.length || Boolean(mutatingKey)} onClick={() => void mutate('batch', () => createBackendPayoutBatch({ payrollPeriodId: latestPeriod?.id ?? null, title: `Payout ${new Date().toLocaleDateString('uk-UA')}`, accrualIds: selectedAccrualIds }))} className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-sm font-semibold text-amber-100 disabled:opacity-50">
                  Create batch: {money(selectedTotal)}
                </button>
              ) : null}
            </div>
            <div className="mt-3 grid gap-2">
              {pendingAccruals.map((accrual) => (
                <AccrualRow
                  key={accrual.id}
                  accrual={accrual}
                  memberName={memberLabel(users, accrual.familyMemberId)}
                  selected={selectedAccrualIds.includes(accrual.id)}
                  canSelect={canManage}
                  onToggle={() => setSelectedAccrualIds((current) => current.includes(accrual.id) ? current.filter((id) => id !== accrual.id) : [...current, accrual.id])}
                />
              ))}
              {!pendingAccruals.length ? <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-500">No pending accruals.</div> : null}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <h3 className="font-semibold text-white">Payout batches</h3>
            <div className="mt-3 grid gap-2">
              {state.dashboard.payoutBatches.map((batch) => (
                <BatchRow key={batch.id} batch={batch} canManage={canManage} mutating={Boolean(mutatingKey)} onFinalize={() => void mutate(`finalize-${batch.id}`, () => finalizeBackendPayoutBatch(batch.id))} />
              ))}
              {!state.dashboard.payoutBatches.length ? <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-500">No payout batches.</div> : null}
            </div>
          </section>

          {canManage && state.ownReport ? (
            <PaymentHistoryManager
              items={filteredPaymentHistory}
              allAccruals={state.ownReport.accruals}
              users={users}
              category={historyCategory}
              onCategoryChange={setHistoryCategory}
              memberFilter={historyMemberFilter}
              onMemberFilterChange={setHistoryMemberFilter}
              payerFilter={historyPayerFilter}
              onPayerFilterChange={setHistoryPayerFilter}
              dateFrom={historyDateFrom}
              onDateFromChange={setHistoryDateFrom}
              dateTo={historyDateTo}
              onDateToChange={setHistoryDateTo}
              proofByItem={proofByItem}
              proofPreviewByItem={proofPreviewByItem}
              mutating={Boolean(mutatingKey)}
              setProofByItem={setProofByItem}
              setProofPreviewByItem={setProofPreviewByItem}
              onConfirm={(item) => void mutate(`paid-${item.id}`, () => confirmBackendPayoutItemPaid(item.payoutBatchId, item.id, { proof: proofByItem[item.id], idempotencyKey: `proof:${item.id}` }))}
              onOpenProof={(item) => void openProofViewer(item, memberLabel(users, item.familyMemberId), paymentCategoryLabel(paymentCategoryForItem(item, state.ownReport.accruals)), setProofViewer)}
            />
          ) : null}

          {false && canManage && state.ownReport?.payoutHistory.length ? (
            <section className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <h3 className="font-semibold text-white">Payment history / proof</h3>
              <div className="mt-3 grid gap-2">
                {state.ownReport.payoutHistory.map((item) => (
                  <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span>
                        <span className="block font-medium text-white">{item.status === 'paid' ? '✅ Виплачено' : 'Очікує виплати'} - {money(item.totalAmount, item.currency)}</span>
                        <span className="block text-slate-400">{item.payerNicknameSnapshot ? `Виплатив: ${item.payerNicknameSnapshot}; Роль: ${item.payerRoleSnapshot ?? '-'}` : 'Proof required before paid confirmation'}</span>
                      </span>
                      {item.status !== 'paid' ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <ProofInput
                            itemId={item.id}
                            preview={proofPreviewByItem[item.id] ?? null}
                            onReady={(proof, preview) => {
                              setProofByItem((current) => ({ ...current, [item.id]: proof }));
                              setProofPreviewByItem((current) => ({ ...current, [item.id]: preview }));
                            }}
                            onRemove={() => {
                              setProofByItem((current) => {
                                const next = { ...current };
                                delete next[item.id];
                                return next;
                              });
                              setProofPreviewByItem((current) => {
                                const next = { ...current };
                                delete next[item.id];
                                return next;
                              });
                            }}
                          />
                          <button type="button" disabled={!proofByItem[item.id] || Boolean(mutatingKey)} onClick={() => void mutate(`paid-${item.id}`, () => confirmBackendPayoutItemPaid(item.payoutBatchId, item.id, { proof: proofByItem[item.id], idempotencyKey: `proof:${item.id}` }))} className="rounded-lg border border-emerald-400/30 px-3 py-1 text-xs text-emerald-100 disabled:opacity-50">Підтвердити виплату</button>
                        </span>
                      ) : item.paymentProofId ? (
                        <button type="button" disabled={Boolean(mutatingKey)} onClick={() => void openProofViewer(item, setProofViewer, setMutatingKey)} className="rounded-lg border border-white/10 px-3 py-1 text-xs text-slate-200 disabled:opacity-50">Переглянути підтвердження</button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {proofViewer ? (
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={() => setProofViewer(null)}>
              <div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-2xl border border-amber-300/20 bg-slate-950 p-4 shadow-2xl shadow-amber-950/40" onClick={(event) => event.stopPropagation()}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-white">{proofViewer.title}</h3>
                  <button type="button" aria-label="Close proof viewer" onClick={() => setProofViewer(null)} className="rounded-lg border border-white/10 px-3 py-1 text-sm text-slate-200">Close</button>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
                  <div className="grid min-h-64 place-items-center rounded-xl border border-white/10 bg-black/30 p-2">
                    {proofViewer.status === 'loading' ? <div className="text-sm text-slate-300">Завантажуємо скріншот...</div> : null}
                    {proofViewer.status === 'error' ? (
                      <div className="space-y-3 text-center text-sm text-red-100">
                        <p>{proofViewer.message}</p>
                        <button type="button" onClick={() => void retryProofViewer(proofViewer, setProofViewer)} className="rounded-lg border border-red-300/30 px-3 py-1 text-xs">Retry</button>
                      </div>
                    ) : null}
                    {proofViewer.status === 'ready' ? <img src={proofViewer.dataUrl} alt={proofViewer.title} className="max-h-[72vh] w-full rounded-xl object-contain" /> : null}
                  </div>
                  <div className="space-y-2 text-sm text-slate-300">
                    {proofViewer.details.map((detail) => <p key={detail}>{detail}</p>)}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return <div className="dh-card rounded-2xl p-4"><div className="text-sm text-slate-500">{label}</div><div className="mt-1 text-xl font-semibold text-white">{value}</div></div>;
}

function PayableMemberCard({ item, mutating, onPay }: { item: BackendPayableMemberSummary; mutating: boolean; onPay: () => void }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="font-medium text-white">{item.nickname}</div>
          <div className="text-slate-400">{item.roleLabel}{item.staticId ? ` #${item.staticId}` : ''}</div>
        </div>
        <div className="text-left sm:text-right">
          <div className="text-xs text-slate-400">До виплати</div>
          <div className="text-lg font-semibold text-amber-100">{money(item.totalOutstanding, item.currency)}</div>
        </div>
      </div>
      <div className="mt-3 grid gap-1">
        {Object.entries(item.breakdown).filter(([, amount]) => amount !== 0).map(([category, amount]) => (
          <div key={category} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-2 py-1">
            <span className="text-slate-300">{payableBreakdownLabels[category] ?? category}</span>
            <strong className="text-slate-100">{money(amount, item.currency)}</strong>
          </div>
        ))}
      </div>
      <button type="button" disabled={mutating || item.accrualIds.length === 0} onClick={onPay} className="mt-3 w-full rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-50">
        Виплатити
      </button>
    </div>
  );
}

function AccrualRow({ accrual, memberName, selected, canSelect, onToggle }: { accrual: BackendAccountingAccrual; memberName: string; selected: boolean; canSelect: boolean; onToggle: () => void }) {
  return (
    <label className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-sm sm:grid-cols-[auto_1fr_auto]">
      {canSelect ? <input type="checkbox" checked={selected} onChange={onToggle} className="mt-1" /> : null}
      <span>
        <span className="block font-medium text-white">{memberName}</span>
        <span className="block text-slate-400">{sourceLabel(accrual)} - {accrual.reason}</span>
      </span>
      <span className="font-semibold text-amber-100">{money(accrual.amount, accrual.currency)}</span>
    </label>
  );
}

function BatchRow({ batch, canManage, mutating, onFinalize }: { batch: BackendPayoutBatch; canManage: boolean; mutating: boolean; onFinalize: () => void }) {
  const paidLabel = batch.status === 'paid' ? 'Виплачено' : batch.status === 'finalized' ? 'Є невиплачені' : 'Чернетка';
  const paidCount = batch.status === 'paid' ? batch.itemCount : 0;
  const outstandingCount = batch.status === 'paid' ? 0 : batch.itemCount;
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm" data-responsive-payout-batch="stacked-card">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="font-medium text-white">{batch.title}</div>
          <div className="text-slate-400">{paidLabel} · {date(batch.createdAt)}</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-4">
            <MiniMetric label="Сума" value={money(batch.totalAmount)} />
            <MiniMetric label="Учасники" value={String(batch.itemCount)} />
            <MiniMetric label="Виплачено" value={String(paidCount)} />
            <MiniMetric label="Очікує" value={String(outstandingCount)} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-amber-100">{money(batch.totalAmount)}</span>
          {canManage && batch.status === 'draft' ? <button type="button" disabled={mutating} onClick={onFinalize} className="rounded-lg border border-white/10 px-3 py-1 text-xs text-slate-200 disabled:opacity-50">Finalize</button> : null}
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-lg border border-white/10 bg-black/20 px-2 py-1">
      <span className="block text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
      <strong className="text-slate-100">{value}</strong>
    </span>
  );
}

function PaymentHistoryManager({
  items,
  allAccruals,
  users,
  category,
  onCategoryChange,
  memberFilter,
  onMemberFilterChange,
  payerFilter,
  onPayerFilterChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  proofByItem,
  proofPreviewByItem,
  mutating,
  setProofByItem,
  setProofPreviewByItem,
  onConfirm,
  onOpenProof
}: {
  items: BackendPayoutBatchItem[];
  allAccruals: BackendAccountingAccrual[];
  users: FamilyUser[];
  category: PaymentCategoryFilter;
  onCategoryChange: (category: PaymentCategoryFilter) => void;
  memberFilter: string;
  onMemberFilterChange: (value: string) => void;
  payerFilter: string;
  onPayerFilterChange: (value: string) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  proofByItem: Record<string, { originalFilename: string; contentType: 'image/png' | 'image/jpeg' | 'image/webp'; dataBase64: string }>;
  proofPreviewByItem: Record<string, { filename: string; size: number; dataUrl: string }>;
  mutating: boolean;
  setProofByItem: Dispatch<SetStateAction<Record<string, { originalFilename: string; contentType: 'image/png' | 'image/jpeg' | 'image/webp'; dataBase64: string }>>>;
  setProofPreviewByItem: Dispatch<SetStateAction<Record<string, { filename: string; size: number; dataUrl: string }>>>;
  onConfirm: (item: BackendPayoutBatchItem) => void;
  onOpenProof: (item: BackendPayoutBatchItem) => void;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-white">Історія виплат</h3>
          <p className="mt-1 text-xs text-slate-500">Payment history tabs and filters are presentation-only.</p>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">{items.length} records</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Payment history categories">
        {managerHistoryTabs.map((tab) => (
          <button key={tab.key} type="button" role="tab" aria-selected={category === tab.key} onClick={() => onCategoryChange(tab.key)} className={`rounded-full border px-3 py-1 text-xs ${category === tab.key ? 'border-amber-300/40 bg-amber-500/15 text-amber-100' : 'border-white/10 bg-black/20 text-slate-300'}`}>
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-4">
        <input value={memberFilter} onChange={(event) => onMemberFilterChange(event.target.value)} placeholder="Member" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100" aria-label="Payment history member filter" />
        <input value={payerFilter} onChange={(event) => onPayerFilterChange(event.target.value)} placeholder="Payer" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100" aria-label="Payment history payer filter" />
        <input type="date" value={dateFrom} onChange={(event) => onDateFromChange(event.target.value)} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100" />
        <input type="date" value={dateTo} onChange={(event) => onDateToChange(event.target.value)} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100" />
      </div>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <PaymentHistoryRow
            key={item.id}
            item={item}
            category={paymentCategoryForItem(item, allAccruals)}
            memberName={memberLabel(users, item.familyMemberId)}
            proof={proofByItem[item.id] ?? null}
            proofPreview={proofPreviewByItem[item.id] ?? null}
            mutating={mutating}
            onReady={(proof, preview) => {
              setProofByItem((current) => ({ ...current, [item.id]: proof }));
              setProofPreviewByItem((current) => ({ ...current, [item.id]: preview }));
            }}
            onRemove={() => {
              setProofByItem((current) => {
                const next = { ...current };
                delete next[item.id];
                return next;
              });
              setProofPreviewByItem((current) => {
                const next = { ...current };
                delete next[item.id];
                return next;
              });
            }}
            onConfirm={() => onConfirm(item)}
            onOpenProof={() => onOpenProof(item)}
          />
        ))}
        {!items.length ? <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-500">Історія виплат поки порожня для цього фільтра.</div> : null}
      </div>
    </section>
  );
}

function PaymentHistoryRow({
  item,
  category,
  memberName,
  proof,
  proofPreview,
  mutating,
  onReady,
  onRemove,
  onConfirm,
  onOpenProof
}: {
  item: BackendPayoutBatchItem;
  category: PaymentCategoryFilter;
  memberName: string;
  proof: { originalFilename: string; contentType: 'image/png' | 'image/jpeg' | 'image/webp'; dataBase64: string } | null;
  proofPreview: { filename: string; size: number; dataUrl: string } | null;
  mutating: boolean;
  onReady: (proof: { originalFilename: string; contentType: 'image/png' | 'image/jpeg' | 'image/webp'; dataBase64: string }, preview: { filename: string; size: number; dataUrl: string }) => void;
  onRemove: () => void;
  onConfirm: () => void;
  onOpenProof: () => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm shadow-[0_0_24px_rgba(245,158,11,0.06)]">
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <span>
          <span className="block text-xs text-amber-100">{paymentCategoryLabel(category)}</span>
          <span className="block font-medium text-white">{item.status === 'paid' ? '✅ Виплачено' : '⏳ Очікує виплати'} - {money(item.totalAmount, item.currency)}</span>
          <span className="block text-slate-400">Кому: {memberName} · {item.paidAt ? date(item.paidAt) : '-'}</span>
          <span className="block text-slate-400">{item.payerNicknameSnapshot ? `Виплатив: ${item.payerNicknameSnapshot}; Роль: ${item.payerRoleSnapshot ?? '-'}` : 'Proof required before paid confirmation'}</span>
        </span>
        {item.status !== 'paid' ? (
          <span className="flex flex-wrap items-center gap-2">
            <ProofInput itemId={item.id} preview={proofPreview} onReady={onReady} onRemove={onRemove} />
            <button type="button" disabled={!proof || mutating} onClick={onConfirm} className="rounded-lg border border-emerald-400/30 px-3 py-1 text-xs text-emerald-100 disabled:opacity-50">Підтвердити виплату</button>
          </span>
        ) : item.paymentProofId ? (
          <button type="button" disabled={mutating} onClick={onOpenProof} className="rounded-lg border border-white/10 px-3 py-1 text-xs text-slate-200 disabled:opacity-50">Переглянути підтвердження</button>
        ) : (
          <span className="text-xs text-slate-500">No proof attached</span>
        )}
      </div>
    </div>
  );
}

function ProofInput({
  itemId,
  preview,
  onReady,
  onRemove
}: {
  itemId: string;
  preview: { filename: string; size: number; dataUrl: string } | null;
  onReady: (proof: { originalFilename: string; contentType: 'image/png' | 'image/jpeg' | 'image/webp'; dataBase64: string }, preview: { filename: string; size: number; dataUrl: string }) => void;
  onRemove: () => void;
}) {
  return (
    <span className="grid gap-2">
      <label className="rounded-lg border border-dashed border-white/20 bg-black/20 px-3 py-2 text-xs text-slate-300">
        <span className="block font-medium text-slate-100">Прикріпіть скріншот виплати</span>
        <span className="block text-slate-500">PNG, JPG/JPEG, WEBP до 5 MB</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label={`payment-proof-${itemId}`}
          onChange={(event) => void readProofFile(event.currentTarget.files?.[0] ?? null).then((result) => result && onReady(result.proof, result.preview))}
          className="mt-2 max-w-48 text-xs text-slate-300"
        />
      </label>
      {preview ? (
        <span className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-slate-300">
          <img src={preview.dataUrl} alt={preview.filename} className="mb-2 max-h-24 rounded object-contain" />
          <span className="block">{preview.filename}</span>
          <span className="block text-slate-500">{Math.round(preview.size / 1024)} KB</span>
          <button type="button" onClick={onRemove} className="mt-2 rounded border border-white/10 px-2 py-1 text-slate-200">Remove</button>
        </span>
      ) : null}
    </span>
  );
}

async function openProofViewer(
  item: { paymentProofId: string | null; totalAmount: number; currency: string; payerNicknameSnapshot: string | null; payerRoleSnapshot: string | null; paidAt: string | null },
  recipientOrSetViewer: string | ((viewer: ProofViewerState | null) => void),
  categoryOrSetMutatingKey: string | ((key: string | null) => void),
  setViewerMaybe?: (viewer: ProofViewerState | null) => void
) {
  if (!item.paymentProofId) return;
  const legacySetViewer = typeof recipientOrSetViewer === 'function' ? recipientOrSetViewer : null;
  const setProofViewer = legacySetViewer ?? setViewerMaybe;
  if (!setProofViewer) return;
  const setMutatingKey = typeof categoryOrSetMutatingKey === 'function' ? categoryOrSetMutatingKey : null;
  const recipient = typeof recipientOrSetViewer === 'string' ? recipientOrSetViewer : '-';
  const category = typeof categoryOrSetMutatingKey === 'string' ? categoryOrSetMutatingKey : 'Payment';
  const details = paymentProofDetails(item, recipient, category);
  setMutatingKey?.(`proof-${item.paymentProofId}`);
  setProofViewer({ status: 'loading', proofId: item.paymentProofId, title: 'Підтвердження виплати', details });
  try {
    const proof = await fetchBackendPaymentProofDataUrl(item.paymentProofId);
    setProofViewer({
      status: 'ready',
      proofId: item.paymentProofId,
      dataUrl: proof.dataUrl,
      title: 'Підтвердження виплати',
      details
    });
  } catch (error) {
    setProofViewer({
      status: 'error',
      proofId: item.paymentProofId,
      title: 'Підтвердження виплати',
      details,
      message: error instanceof Error ? error.message : 'Не вдалося завантажити скріншот підтвердження.'
    });
  } finally {
    setMutatingKey?.(null);
  }
}

async function retryProofViewer(viewer: Extract<ProofViewerState, { status: 'error' }>, setProofViewer: (viewer: ProofViewerState | null) => void) {
  setProofViewer({ status: 'loading', proofId: viewer.proofId, title: viewer.title, details: viewer.details });
  try {
    const proof = await fetchBackendPaymentProofDataUrl(viewer.proofId);
    setProofViewer({ status: 'ready', proofId: viewer.proofId, dataUrl: proof.dataUrl, title: viewer.title, details: viewer.details });
  } catch (error) {
    setProofViewer({ ...viewer, message: error instanceof Error ? error.message : viewer.message });
  }
}

function paymentProofDetails(
  item: { totalAmount: number; currency: string; payerNicknameSnapshot: string | null; payerRoleSnapshot: string | null; paidAt: string | null },
  recipient: string,
  category: string
) {
  return [
    `Кому: ${recipient}`,
    `Сума: ${money(item.totalAmount, item.currency)}`,
    `Категорія: ${category}`,
    `Виплатив: ${item.payerNicknameSnapshot ?? '-'}`,
    `Роль: ${item.payerRoleSnapshot ?? '-'}`,
    `Дата: ${item.paidAt ? new Date(item.paidAt).toLocaleString('uk-UA') : '-'}`
  ];
}

function startOfCurrentWeek() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  const day = start.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setUTCDate(start.getUTCDate() + diff);
  return start.toISOString();
}

function endOfCurrentWeek() {
  const end = new Date(startOfCurrentWeek());
  end.setUTCDate(end.getUTCDate() + 7);
  return end.toISOString();
}

function manualPremiumAmountValid(value: string) {
  const amount = Math.abs(Number(value));
  return Number.isFinite(amount) && amount >= 50000 && amount <= 500000;
}

async function readProofFile(file: File | null): Promise<{
  proof: { originalFilename: string; contentType: 'image/png' | 'image/jpeg' | 'image/webp'; dataBase64: string };
  preview: { filename: string; size: number; dataUrl: string };
} | null> {
  if (!file) return null;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return null;
  if (file.size > 5 * 1024 * 1024) return null;
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const dataBase64 = btoa(binary);
  return {
    proof: {
      originalFilename: file.name,
      contentType: file.type as 'image/png' | 'image/jpeg' | 'image/webp',
      dataBase64,
    },
    preview: {
      filename: file.name,
      size: file.size,
      dataUrl: `data:${file.type};base64,${dataBase64}`,
    },
  };
}

function accountingErrorMessage(error: unknown) {
  if (error instanceof FamilyAccountingApiError) {
    if (error.code === 'BACKEND_UNAVAILABLE') return 'Accounting backend is unavailable. No local fallback is used.';
    if (error.code === 'ACCOUNTING_PERMISSION_DENIED') return 'No permission for accounting action.';
    return error.message;
  }
  return error instanceof Error ? error.message : 'Accounting request failed.';
}
