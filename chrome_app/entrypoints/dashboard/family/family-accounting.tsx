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
  getBackendDiscordAccountingFeed,
  getBackendMemberAccountingReport,
  getBackendMonthlyAccountingSummary,
  getBackendPayableSummary,
  getBackendWeeklyActivityStatus,
  listBackendPayrollPeriods,
  listBackendSalaryRules,
  previewBackendPayrollPeriod,
  setBackendSalaryRuleActive,
  type BackendAccountingAccrual,
  type BackendAccountingDashboard,
  type BackendDiscordAccountingFeed,
  type BackendMemberAccountingReport,
  type BackendMonthlyAccountingSummary,
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
  | { status: 'ready'; dashboard: BackendAccountingDashboard; payableSummary: BackendPayableSummary; periods: BackendPayrollPeriod[]; rules: BackendSalaryRule[]; preview: BackendPayrollPreview | null; ownReport: BackendMemberAccountingReport | null; weeklyActivity: BackendWeeklyActivityStatus | null; discordFeed: BackendDiscordAccountingFeed | null; monthlySummary: BackendMonthlyAccountingSummary | null };

type PaymentCategoryFilter = 'all' | 'salary' | 'quests' | 'premium' | 'rewards' | 'corrections';
type ManualPremiumCategory = 'manual' | 'activity' | 'quest_activity' | 'combat' | 'leadership' | 'top3' | 'special';
type ProofViewerState =
  | { status: 'loading'; proofId: string; title: string; details: string[] }
  | { status: 'error'; proofId: string; title: string; details: string[]; message: string }
  | { status: 'ready'; proofId: string; dataUrl: string; title: string; details: string[] };

const ACCOUNTING_REFRESH_INTERVAL_MS = 30_000;

function money(value: number | null | undefined, currency = 'USD') {
  return value == null ? '-' : `${value.toLocaleString('uk-UA')} ${currency}`;
}

function date(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString('uk-UA') : '-';
}

function currentUserAvatarSrc(user: FamilyUser) {
  return user.avatarDataUrl || user.avatarUrl;
}

function sourceLabel(accrual: BackendAccountingAccrual | string) {
  const sourceType = typeof accrual === 'string' ? accrual : accrual.sourceType;
  const category = typeof accrual === 'string' ? null : typeof accrual.metadata?.category === 'string' ? accrual.metadata.category : null;
  if (sourceType === 'salary') return 'Базова зарплата';
  if (sourceType === 'premium' && category === 'activity') return 'Премія за активність';
  if (sourceType === 'premium' && category === 'quest_activity') return 'Квестова премія';
  if (sourceType === 'premium' && category === 'combat') return 'Вишки / стаки';
  if (sourceType === 'premium' && category === 'leadership') return 'Премія за лідерство';
  if (sourceType === 'premium' && category === 'top3') return 'TOP-3';
  if (sourceType === 'premium' && category === 'special') return 'Рекрутери / HR';
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
  leadershipPremium: 'Премія за лідерство',
  top3Premium: 'TOP-3',
  specialPremium: 'Рекрутери / HR',
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
  { key: 'rewards', label: 'Нагороди' },
  { key: 'corrections', label: 'Корекції' }
];

const manualPremiumCategories: Array<{ key: ManualPremiumCategory; label: string; hint: string; defaultReason: string }> = [
  {
    key: 'manual',
    label: 'Особиста премія',
    hint: 'Разова премія за рішенням керівництва.',
    defaultReason: 'Особиста премія за рішенням старших'
  },
  {
    key: 'activity',
    label: 'Активність',
    hint: 'За стабільну присутність і допомогу сім’ї.',
    defaultReason: 'Премія за активність у сімейних справах'
  },
  {
    key: 'quest_activity',
    label: 'Квести',
    hint: 'За організацію або сильну участь у квестах.',
    defaultReason: 'Квестова премія'
  },
  {
    key: 'combat',
    label: 'Каптери / фармери',
    hint: 'Для каптерів, фармерів, вишок, стаків і бойових активностей.',
    defaultReason: 'Премія каптеру/фармеру за сімейну активність'
  },
  {
    key: 'leadership',
    label: 'Від старших',
    hint: 'Виписувальна премія від старших за корисну дію або приведення людей.',
    defaultReason: 'Виписувальна премія від старших за приведення людей'
  },
  {
    key: 'top3',
    label: 'TOP-3',
    hint: 'Для лідерів таблиць, тижня або події.',
    defaultReason: 'Премія TOP-3'
  },
  {
    key: 'special',
    label: 'Рекрутери / HR',
    hint: 'За рекрутинг, адаптацію, перевірку кандидатів і супровід новачків.',
    defaultReason: 'Премія рекрутеру/HR за приведення та адаптацію людей'
  }
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

function discordFeedStatusLabel(feed: BackendDiscordAccountingFeed | null): string {
  if (!feed) return 'Discord-стрічка недоступна';
  if (feed.status === 'synced') return `Синхронізовано ${new Date(feed.lastSyncedAt).toLocaleTimeString('uk-UA')}`;
  if (feed.status === 'not_configured') return 'DISCORD_ACCOUNTING_CHANNEL_ID не налаштовано';
  if (feed.status === 'unavailable') return 'Discord-сервіс недоступний';
  return feed.error ?? 'Помилка Discord-стрічки';
}

function isImageAttachment(attachment: { contentType: string | null; filename: string }) {
  return attachment.contentType?.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/iu.test(attachment.filename);
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
  const [state, setState] = useState<LoadState>({ status: 'loading', message: 'Завантаження...' });
  const [selectedAccrualIds, setSelectedAccrualIds] = useState<string[]>([]);
  const [mutatingKey, setMutatingKey] = useState<string | null>(null);
  const [periodTitle, setPeriodTitle] = useState('Тижнева зарплата');
  const [ruleName, setRuleName] = useState('Правило базової зарплати');
  const [ruleAmount, setRuleAmount] = useState('');
  const [ruleMinRank, setRuleMinRank] = useState('');
  const [ruleMaxRank, setRuleMaxRank] = useState('');
  const [premiumMemberId, setPremiumMemberId] = useState(users[0]?.id ?? '');
  const [premiumAmount, setPremiumAmount] = useState('');
  const [premiumCategory, setPremiumCategory] = useState<ManualPremiumCategory>('manual');
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
  const [summaryYear, setSummaryYear] = useState(() => new Date().getFullYear());
  const [summaryMonth, setSummaryMonth] = useState(() => new Date().getMonth() + 1);

  const pendingAccruals = state.status === 'ready' ? state.dashboard.pendingAccruals : [];
  const latestPeriod = state.status === 'ready' ? state.periods[0] ?? null : null;
  const selectedTotal = useMemo(
    () => pendingAccruals.filter((item) => selectedAccrualIds.includes(item.id)).reduce((total, item) => total + item.amount, 0),
    [pendingAccruals, selectedAccrualIds]
  );
  const ownAccruals = state.status === 'ready' ? state.ownReport?.accruals ?? [] : [];
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
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void load(controller.signal, { silent: true });
    }, ACCOUNTING_REFRESH_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalId);
      controller.abort();
    };
  }, [canManage, canView, currentUser.id, summaryMonth, summaryYear]);

  async function load(signal?: AbortSignal, options: { silent?: boolean } = {}) {
    if (!options.silent) setState({ status: 'loading', message: 'Завантаження...' });
    try {
      const [dashboard, payableSummary, periods, rules, ownReport, weeklyActivity, discordFeed, monthlySummary] = await Promise.all([
        getBackendAccountingDashboard(signal),
        canManage ? getBackendPayableSummary(signal) : Promise.resolve({ items: [] }),
        listBackendPayrollPeriods(signal),
        listBackendSalaryRules(signal),
        getBackendMemberAccountingReport(currentUser.id, signal).catch(() => null),
        getBackendWeeklyActivityStatus(currentUser.id, signal).catch(() => null),
        canManage ? getBackendDiscordAccountingFeed(signal).catch(() => null) : Promise.resolve(null),
        canManage ? getBackendMonthlyAccountingSummary(summaryYear, summaryMonth, signal).catch(() => null) : Promise.resolve(null)
      ]);
      const latest = periods.items[0] ?? null;
      const preview = latest ? await previewBackendPayrollPeriod(latest.id, signal).catch(() => null) : null;
      setState({ status: 'ready', dashboard, payableSummary, periods: periods.items, rules: rules.items, preview, ownReport, weeklyActivity, discordFeed, monthlySummary });
      if (!options.silent) setSelectedAccrualIds([]);
    } catch (error) {
      if (signal?.aborted) return;
      if (options.silent) return;
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
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-amber-500/30 bg-black/35 text-sm font-bold text-amber-100">
            {currentUserAvatarSrc(currentUser) ? (
              <img src={currentUserAvatarSrc(currentUser) ?? undefined} alt={currentUser.displayName ?? currentUser.nickname} className="h-full w-full object-cover" />
            ) : (
              <span>{currentUser.nickname.slice(0, 2).toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">Бухгалтерія Dragon House</h2>
            <p className="mt-1 text-sm text-slate-400">Нарахування, періоди зарплати, премії та виплатні пакети завантажуються з офіційного сервісу.</p>
          </div>
        </div>
        <button type="button" onClick={() => void load()} disabled={state.status === 'loading'} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-200 disabled:opacity-50">
          Повторити
        </button>
      </div>

      {state.status === 'loading' ? <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-slate-300">{state.message}</div> : null}
      {state.status === 'error' ? (
        <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
          {state.message}
          <button type="button" onClick={() => void load()} className="ml-3 rounded-lg border border-red-300/30 px-3 py-1 text-xs">Повторити</button>
        </div>
      ) : null}

      {state.status === 'ready' ? (
        <div className="mt-5 space-y-5">
          <div className="grid gap-3 md:grid-cols-4">
            <SummaryCard label="До виплати" value={money(state.ownReport?.totals.payable ?? 0, state.ownReport?.totals.currency)} />
            <SummaryCard label="Виплачено" value={money(state.ownReport?.totals.paid ?? 0, state.ownReport?.totals.currency)} />
            <SummaryCard label="Зарплата" value={money(state.ownReport?.bySource.salary ?? 0, state.ownReport?.totals.currency)} />
            <SummaryCard label="Премії" value={money(state.ownReport?.bySource.premium ?? 0, state.ownReport?.totals.currency)} />
          </div>

          {canManage ? <DiscordAccountingFeedPanel feed={state.discordFeed} /> : null}

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
                  <p>Якщо ви кудись від’їхали або тимчасово зайняті, напишіть Старшим драконам, щоб вони знали, що з вами все добре.</p>
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
                <SummaryCard label="Вишки / стаки" value={money(state.ownReport.weeklyEarnings.categories.combatPremium, state.ownReport.weeklyEarnings.currency)} />
                <SummaryCard label="Премія за лідерство" value={money(state.ownReport.weeklyEarnings.categories.leadershipPremium, state.ownReport.weeklyEarnings.currency)} />
                <SummaryCard label="TOP-3" value={money(state.ownReport.weeklyEarnings.categories.top3Premium, state.ownReport.weeklyEarnings.currency)} />
                <SummaryCard label="Рекрутери / HR" value={money(state.ownReport.weeklyEarnings.categories.specialPremium, state.ownReport.weeklyEarnings.currency)} />
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
            <MonthlyAccountingSummaryPanel
              summary={state.monthlySummary}
              month={summaryMonth}
              year={summaryYear}
              onMonthChange={setSummaryMonth}
              onYearChange={setSummaryYear}
              onReload={() => void load()}
            />
          ) : null}

          {canManage ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 xl:col-span-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-white">Потрібно виплатити</h3>
                    <p className="mt-1 text-xs text-amber-100/80">Зведення до виплати завантажується з офіційного сервісу без перерахунку на клієнті.</p>
                  </div>
                  <span className="rounded-full border border-amber-300/30 px-3 py-1 text-xs text-amber-100">{state.payableSummary.items.length} учасників</span>
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
                <h3 className="font-semibold text-white">Періоди зарплати</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input value={periodTitle} onChange={(event) => setPeriodTitle(event.target.value)} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100" />
                  <button
                    type="button"
                    disabled={Boolean(mutatingKey)}
                    onClick={() => void mutate('period', () => createBackendPayrollPeriod({
                      periodType: 'weekly',
                      startsAt: startOfCurrentWeek(),
                      endsAt: endOfCurrentWeek(),
                      title: periodTitle.trim() || 'Тижнева зарплата'
                    }))}
                    className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-sm font-semibold text-amber-100 disabled:opacity-50"
                  >
                    Створити період
                  </button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <input value={ruleName} onChange={(event) => setRuleName(event.target.value)} placeholder="Назва правила" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100" />
                  <input value={ruleAmount} onChange={(event) => setRuleAmount(event.target.value.replace(/[^\d.]/g, ''))} placeholder="Сума" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100" />
                  <input value={ruleMinRank} onChange={(event) => setRuleMinRank(event.target.value.replace(/\D/g, ''))} placeholder="Мін. ранг" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100" />
                  <input value={ruleMaxRank} onChange={(event) => setRuleMaxRank(event.target.value.replace(/\D/g, ''))} placeholder="Макс. ранг" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!Number(ruleAmount) || (!ruleMinRank && !ruleMaxRank) || Boolean(mutatingKey)}
                    onClick={() => void mutate('salary-rule', () => createBackendSalaryRule({
                      ruleKey: `base-rank-${ruleMinRank || 'any'}-${ruleMaxRank || 'any'}-${Date.now()}`,
                      name: ruleName.trim() || 'Правило базової зарплати',
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
                    Додати базове правило
                  </button>
                  <button type="button" disabled={!latestPeriod || Boolean(mutatingKey)} onClick={() => latestPeriod && void mutate('calculate', () => calculateBackendPayrollPeriod(latestPeriod.id))} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 disabled:opacity-50">Розрахувати</button>
                  <button type="button" disabled={!latestPeriod || Boolean(mutatingKey)} onClick={() => latestPeriod && void mutate('finalize', () => finalizeBackendPayrollPeriod(latestPeriod.id))} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 disabled:opacity-50">Зафіксувати</button>
                </div>
                <div className="mt-4 grid gap-2">
                  <h4 className="text-sm font-semibold text-slate-200">Правила зарплати</h4>
                  {state.rules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
                      <span>
                        <span className="block font-medium text-white">{rule.name}</span>
                        <span className="block text-slate-400">{rule.ruleType} - {rule.basis} - v{rule.version} - {money(rule.amount, rule.currency)}</span>
                      </span>
                      <button type="button" disabled={Boolean(mutatingKey)} onClick={() => void mutate(`rule-${rule.id}`, () => setBackendSalaryRuleActive(rule.id, !rule.active))} className="rounded-lg border border-white/10 px-3 py-1 text-xs text-slate-200 disabled:opacity-50">
                        {rule.active ? 'Вимкнути' : 'Увімкнути'}
                      </button>
                    </div>
                  ))}
                  {!state.rules.length ? <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-500">Даних поки немає</div> : null}
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <h3 className="font-semibold text-white">Премія / корекція</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <select value={premiumMemberId} onChange={(event) => setPremiumMemberId(event.target.value)} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100">
                    {users.map((user) => <option key={user.id} value={user.id}>{memberLabel(users, user.id)}</option>)}
                  </select>
                  <select
                    value={premiumCategory}
                    onChange={(event) => {
                      const nextCategory = event.target.value as ManualPremiumCategory;
                      setPremiumCategory(nextCategory);
                      if (!reason.trim()) {
                        setReason(manualPremiumCategories.find((category) => category.key === nextCategory)?.defaultReason ?? '');
                      }
                    }}
                    className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100"
                    aria-label="Категорія премії"
                  >
                    {manualPremiumCategories.map((category) => (
                      <option key={category.key} value={category.key}>{category.label}</option>
                    ))}
                  </select>
                  <input value={premiumAmount} onChange={(event) => setPremiumAmount(event.target.value.replace(/[^\d.-]/g, ''))} placeholder="50,000 - 500,000" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100" />
                  <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Причина" className="sm:col-span-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100" />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {manualPremiumCategories.find((category) => category.key === premiumCategory)?.hint} Ручна особиста премія має бути 50 000 - 500 000. Інші категорії фіксуються як окреме нарахування до виплати.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={!premiumMemberId || !premiumAmountValid(premiumAmount, premiumCategory) || !reason.trim() || Boolean(mutatingKey)} onClick={() => void mutate('premium', () => createBackendPremium({ familyMemberId: premiumMemberId, payrollPeriodId: latestPeriod?.id ?? null, amount: Math.abs(Number(premiumAmount)), reason: reason.trim(), sourceKey: `${premiumCategory}-premium:${premiumMemberId}:${Date.now()}`, category: premiumCategory, stackingPolicy: premiumCategory === 'manual' ? 'not_applicable' : 'category_specific' }))} className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-50">Додати премію</button>
                  <button type="button" disabled={!premiumMemberId || !Number(adjustmentAmount || premiumAmount) || !reason.trim() || Boolean(mutatingKey)} onClick={() => void mutate('adjustment', () => createBackendAdjustment({ familyMemberId: premiumMemberId, amount: Number(adjustmentAmount || premiumAmount), reason: reason.trim(), sourceKey: `manual-adjustment:${premiumMemberId}:${Date.now()}` }))} className="rounded-xl border border-red-400/40 bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-100 disabled:opacity-50">Додати корекцію</button>
                  <input value={adjustmentAmount} onChange={(event) => setAdjustmentAmount(event.target.value.replace(/[^\d.-]/g, ''))} placeholder="Окрема сума корекції" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100" />
                </div>
              </section>
            </div>
          ) : null}

          {canManage && state.preview ? (
            <section className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-white">Попередній розрахунок зарплати</h3>
                  <p className="mt-1 text-xs text-slate-500">Це лише перевірка. Вона не створює нарахування.</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs ${state.preview.configurationComplete ? 'border-emerald-400/30 text-emerald-100' : 'border-amber-400/30 text-amber-100'}`}>
                  {state.preview.configurationComplete ? 'Налаштування готові' : 'Є попередження в налаштуваннях'}
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
                      <span className="block text-slate-400">{item.eligible ? item.status : 'не відповідає умовам'}{item.warnings.length ? ` - ${item.warnings.join(', ')}` : ''}</span>
                    </span>
                    <span className="text-slate-300">База {money(item.baseAmount, item.currency)}</span>
                    <span className="text-slate-300">Модифікатори {money(item.modifiersTotal, item.currency)}</span>
                    <span className="font-semibold text-amber-100">Зарплата {money(item.finalSalary, item.currency)} · Попередні премії {money(item.premiumPreviewTotal, item.currency)}</span>
                  </div>
                ))}
                {!state.preview.items.length ? <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-500">Даних поки немає.</div> : null}
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold text-white">Очікують виплати</h3>
                <p className="mt-1 text-xs text-slate-500">Якщо список порожній, зараз немає нарахувань до виплати.</p>
              </div>
              {canManage ? (
                <button type="button" disabled={!selectedAccrualIds.length || Boolean(mutatingKey)} onClick={() => void mutate('batch', () => createBackendPayoutBatch({ payrollPeriodId: latestPeriod?.id ?? null, title: `Payout ${new Date().toLocaleDateString('uk-UA')}`, accrualIds: selectedAccrualIds }))} className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-sm font-semibold text-amber-100 disabled:opacity-50">
                  Створити пакет: {money(selectedTotal)}
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
              {!pendingAccruals.length ? <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-500">Даних поки немає.</div> : null}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <h3 className="font-semibold text-white">Пакети виплат</h3>
            <div className="mt-3 grid gap-2">
              {state.dashboard.payoutBatches.map((batch) => (
                <BatchRow key={batch.id} batch={batch} canManage={canManage} mutating={Boolean(mutatingKey)} onFinalize={() => void mutate(`finalize-${batch.id}`, () => finalizeBackendPayoutBatch(batch.id))} />
              ))}
              {!state.dashboard.payoutBatches.length ? <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-500">Даних поки немає.</div> : null}
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
              onOpenProof={(item) => void openProofViewer(item, memberLabel(users, item.familyMemberId), paymentCategoryLabel(paymentCategoryForItem(item, ownAccruals)), setProofViewer)}
            />
          ) : null}

          {proofViewer ? (
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={() => setProofViewer(null)}>
              <div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-2xl border border-amber-300/20 bg-slate-950 p-4 shadow-2xl shadow-amber-950/40" onClick={(event) => event.stopPropagation()}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-white">{proofViewer.title}</h3>
                  <button type="button" aria-label="Закрити перегляд підтвердження" onClick={() => setProofViewer(null)} className="rounded-lg border border-white/10 px-3 py-1 text-sm text-slate-200">Закрити</button>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
                  <div className="grid min-h-64 place-items-center rounded-xl border border-white/10 bg-black/30 p-2">
                    {proofViewer.status === 'loading' ? <div className="text-sm text-slate-300">Завантажуємо скріншот...</div> : null}
                    {proofViewer.status === 'error' ? (
                      <div className="space-y-3 text-center text-sm text-red-100">
                        <p>{proofViewer.message}</p>
                        <button type="button" onClick={() => void retryProofViewer(proofViewer, setProofViewer)} className="rounded-lg border border-red-300/30 px-3 py-1 text-xs">Повторити</button>
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

function MonthlyAccountingSummaryPanel({
  summary,
  month,
  year,
  onMonthChange,
  onYearChange,
  onReload
}: {
  summary: BackendMonthlyAccountingSummary | null;
  month: number;
  year: number;
  onMonthChange: Dispatch<SetStateAction<number>>;
  onYearChange: Dispatch<SetStateAction<number>>;
  onReload: () => void;
}) {
  const years = Array.from({ length: 7 }, (_, index) => new Date().getFullYear() - 3 + index);
  const months = [
    'Січень',
    'Лютий',
    'Березень',
    'Квітень',
    'Травень',
    'Червень',
    'Липень',
    'Серпень',
    'Вересень',
    'Жовтень',
    'Листопад',
    'Грудень'
  ];
  const discordGap = summary ? summary.quests.completedCount - summary.quests.withDiscordProjectionCount : 0;

  return (
    <section className="rounded-2xl border border-sky-400/20 bg-sky-500/10 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="font-semibold text-white">Бухгалтерія за місяць</h3>
          <p className="mt-1 text-xs text-sky-100/80">
            Місячний зріз бере гроші, завершені квести й Discord projection з офіційної бази. Discord-стрічка нижче лишається доказовим шаром, а не джерелом paid/approved.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={month} onChange={(event) => onMonthChange(Number(event.target.value))} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100" aria-label="Місяць бухгалтерії">
            {months.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
          </select>
          <select value={year} onChange={(event) => onYearChange(Number(event.target.value))} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100" aria-label="Рік бухгалтерії">
            {years.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <button type="button" onClick={onReload} className="rounded-xl border border-sky-300/30 px-3 py-2 text-sm text-sky-100">Оновити</button>
        </div>
      </div>

      {!summary ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
          Не вдалося завантажити місячну бухгалтерію. Перевір backend і права доступу.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-2 md:grid-cols-4">
            <SummaryCard label="Прибуток" value={money(summary.totals.income, summary.currency)} />
            <SummaryCard label="Витрати" value={money(summary.totals.expenses, summary.currency)} />
            <SummaryCard label="Чистий баланс" value={money(summary.totals.net, summary.currency)} />
            <SummaryCard label="Завершено квестів" value={String(summary.quests.completedCount)} />
          </div>
          <div className="grid gap-2 md:grid-cols-4">
            <SummaryCard label="Прибуток сім’ї з квестів" value={money(summary.totals.questFamilyIncome, summary.currency)} />
            <SummaryCard label="Нагороди учасникам" value={money(summary.totals.questMemberRewards, summary.currency)} />
            <SummaryCard label="Усього по квестах" value={money(summary.totals.questTotalRewards, summary.currency)} />
            <SummaryCard label="Discord projection" value={`${summary.quests.withDiscordProjectionCount}/${summary.quests.completedCount}`} />
          </div>
          {discordGap > 0 ? (
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
              Є reconciliation gap: {discordGap} завершених квестів за цей місяць не мають збереженої Discord projection у базі.
            </div>
          ) : null}

          <div className="grid gap-3 xl:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <h4 className="text-sm font-semibold text-white">TOP-3 по квестах</h4>
              <div className="mt-2 grid gap-2">
                {summary.quests.topMembers.map((member, index) => (
                  <div key={`${member.familyMemberId ?? member.displayName}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate text-slate-100">{index + 1}. {member.displayName}</span>
                    <span className="shrink-0 text-amber-100">{member.completedQuests} квестів · {money(member.earnedAmount, summary.currency)}</span>
                  </div>
                ))}
                {!summary.quests.topMembers.length ? <div className="rounded-lg border border-white/10 bg-black/25 p-3 text-sm text-slate-400">За цей місяць немає учасників у завершених квестах.</div> : null}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <h4 className="text-sm font-semibold text-white">Останні рухи грошей</h4>
              <div className="mt-2 grid max-h-72 gap-2 overflow-y-auto pr-1">
                {summary.transactions.slice(0, 12).map((transaction) => (
                  <div key={transaction.id} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-100">{transaction.reason}</span>
                      <span className={transaction.type === 'income' ? 'text-emerald-100' : 'text-amber-100'}>{money(transaction.amount, transaction.currency)}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {date(transaction.createdAt)} · {transaction.type} {transaction.memberName ? `· ${transaction.memberName}` : ''} {transaction.questTitle ? `· ${transaction.questTitle}` : ''}
                    </div>
                  </div>
                ))}
                {!summary.transactions.length ? <div className="rounded-lg border border-white/10 bg-black/25 p-3 text-sm text-slate-400">За цей місяць рухів грошей ще немає.</div> : null}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <h4 className="text-sm font-semibold text-white">Квести за місяць</h4>
            <div className="mt-2 grid max-h-80 gap-2 overflow-y-auto pr-1">
              {summary.quests.items.map((quest) => (
                <div key={quest.id} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <span className="font-medium text-white">{quest.title}</span>
                    <span className="text-amber-100">{money(quest.totalReward, summary.currency)}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {date(quest.completedAt)} · учасники {quest.participantCount} · помічники {quest.helperCount} · сім’ї {money(quest.familyReward, summary.currency)} · людям {money(quest.memberRewardPool, summary.currency)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {quest.discordMessageId ? 'Discord projection є' : 'Discord projection не знайдено'}
                  </div>
                </div>
              ))}
              {!summary.quests.items.length ? <div className="rounded-lg border border-white/10 bg-black/25 p-3 text-sm text-slate-400">За цей місяць завершених квестів ще немає.</div> : null}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function DiscordAccountingFeedPanel({ feed }: { feed: BackendDiscordAccountingFeed | null }) {
  const imageCount = feed?.items.reduce((total, item) => total + item.attachments.filter(isImageAttachment).length, 0) ?? 0;
  return (
    <section className="rounded-2xl border border-sky-400/20 bg-sky-500/10 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-white">Discord accounting feed</h3>
          <p className="mt-1 text-xs text-sky-100/80">{discordFeedStatusLabel(feed)}</p>
        </div>
        <span className="rounded-full border border-sky-300/30 px-3 py-1 text-xs text-sky-100">
          {feed?.items.length ?? 0} messages / {imageCount} photos
        </span>
      </div>
      <div className="mt-3 grid gap-2">
        {feed?.items.slice(0, 5).map((item) => (
          <article key={item.externalId} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <span>
                <span className="block font-medium text-white">{item.authorName}</span>
                <span className="block text-xs text-slate-500">{new Date(item.createdAt).toLocaleString('uk-UA')}</span>
              </span>
              <span className="text-xs text-sky-100">{item.attachmentCount} files</span>
            </div>
            {item.content ? <p className="mt-2 whitespace-pre-wrap text-slate-300">{item.content}</p> : null}
            {item.attachments.length ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {item.attachments.map((attachment) => (
                  isImageAttachment(attachment) ? (
                    <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-white/10 bg-black/30">
                      <img src={attachment.proxyUrl ?? attachment.url} alt={attachment.filename} className="h-32 w-full object-cover" />
                      <span className="block truncate px-2 py-1 text-xs text-slate-300">{attachment.filename}</span>
                    </a>
                  ) : (
                    <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs text-slate-300">
                      {attachment.filename}
                    </a>
                  )
                ))}
              </div>
            ) : null}
          </article>
        ))}
        {feed && feed.items.length === 0 ? <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-400">No Discord accounting messages yet.</div> : null}
        {!feed ? <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-400">Discord accounting feed did not load.</div> : null}
      </div>
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
          <p className="mt-1 text-xs text-slate-500">Фільтри працюють по категорії, учаснику, виплатнику та датах.</p>
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
        <input value={memberFilter} onChange={(event) => onMemberFilterChange(event.target.value)} placeholder="Учасник" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100" aria-label="Фільтр історії виплат за учасником" />
        <input value={payerFilter} onChange={(event) => onPayerFilterChange(event.target.value)} placeholder="Хто виплатив" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100" aria-label="Фільтр історії виплат за виплатником" />
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
          <span className="block text-slate-400">{item.payerNicknameSnapshot ? `Виплатив: ${item.payerNicknameSnapshot}; Роль: ${item.payerRoleSnapshot ?? '-'}` : 'Потрібне підтвердження перед позначкою виплати'}</span>
        </span>
        {item.status !== 'paid' ? (
          <span className="flex flex-wrap items-center gap-2">
            <ProofInput itemId={item.id} preview={proofPreview} onReady={onReady} onRemove={onRemove} />
            <button type="button" disabled={!proof || mutating} onClick={onConfirm} className="rounded-lg border border-emerald-400/30 px-3 py-1 text-xs text-emerald-100 disabled:opacity-50">Підтвердити виплату</button>
          </span>
        ) : item.paymentProofId ? (
          <button type="button" disabled={mutating} onClick={onOpenProof} className="rounded-lg border border-white/10 px-3 py-1 text-xs text-slate-200 disabled:opacity-50">Переглянути підтвердження</button>
        ) : (
          <span className="text-xs text-slate-500">Підтвердження не прикріплено</span>
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

function premiumAmountValid(value: string, category: ManualPremiumCategory) {
  const amount = Math.abs(Number(value));
  if (!Number.isFinite(amount) || amount <= 0) return false;
  return category === 'manual' ? manualPremiumAmountValid(value) : true;
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
    if (error.code === 'BACKEND_UNAVAILABLE') return 'Не вдалося завантажити дані обліку. Локальна підміна не використовується.';
    if (error.code === 'ACCOUNTING_PERMISSION_DENIED') return 'Немає прав для дії в обліку.';
    return error.message;
  }
  return error instanceof Error ? error.message : 'Не вдалося виконати дію в обліку.';
}
