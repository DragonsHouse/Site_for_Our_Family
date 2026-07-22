import { useMemo, useState } from 'react';
import {
  notifyBonusPaid,
  notifyBonusStatusChanged,
  notifyQuestPayoutUpdated
} from '../../../lib/family-notifications';
import { canManageAccounting, canViewAccounting } from '../../../lib/family-permissions';
import {
  addManualLedgerExpense,
  calculateFamilyCapital,
  calculateMonthlyEarning,
  calculatePremiumAmount,
  ensurePremiumBonus,
  readFamilyAccountingMonths,
  readFamilyPremiumRules,
  saveFamilyPremiumRules,
  updateFamilyBonus
} from '../../../lib/family-repositories';
import type {
  FamilyAccountingAuditEntry,
  FamilyAccountingMonth,
  FamilyBonus,
  FamilyBonusStatus,
  FamilyLedgerEntry,
  FamilyPremiumRules,
  FamilyQuestReport,
  FamilyUser
} from '../../../lib/family-types';

const STATUS_LABELS: Record<FamilyBonusStatus | 'all', string> = {
  all: 'Усі',
  calculated: 'Очікує',
  pending_payout: 'Не видано',
  paid: 'Видано',
  not_eligible: 'Без премії'
};

const LEDGER_LABELS: Record<FamilyLedgerEntry['type'], string> = {
  income: 'Дохід',
  expense: 'Витрата',
  payout: 'Виплата',
  adjustment: 'Корекція'
};

type AccountingSelection =
  | { type: 'period'; monthId: string }
  | { type: 'member'; userId: string }
  | { type: 'bonus'; bonusId: string }
  | { type: 'quest_report'; reportId: string }
  | { type: 'ledger'; ledgerId: string }
  | null;

function money(value: number | null | undefined) {
  return value == null ? '-' : `${value.toLocaleString('uk-UA')} $`;
}

function date(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString('uk-UA') : '-';
}

function periodTitle(month: FamilyAccountingMonth) {
  return `${String(month.month).padStart(2, '0')}.${month.year}`;
}

function allBonuses(months: FamilyAccountingMonth[]) {
  return months.flatMap((month) => month.bonuses);
}

function allReports(months: FamilyAccountingMonth[]) {
  return months.flatMap((month) => month.questReports ?? []);
}

function allLedger(months: FamilyAccountingMonth[]) {
  return months.flatMap((month) => month.ledger ?? []);
}

function AuditTrail({ entries }: { entries: FamilyAccountingAuditEntry[] }) {
  return (
    <div className="grid gap-2">
      {entries.slice(0, 40).map((entry) => (
        <div key={entry.id} className="rounded-xl border border-white/10 bg-black/25 p-3 text-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-medium text-white">{entry.actorId}</span>
            <span className="text-xs text-slate-500">{date(entry.createdAt)}</span>
          </div>
          <div className="mt-1 text-slate-300">
            {entry.field}: <span className="text-slate-500">{String(entry.before ?? '-')}</span>
            <span className="mx-2 text-amber-300">→</span>
            <span className="text-amber-100">{String(entry.after ?? '-')}</span>
          </div>
        </div>
      ))}
      {!entries.length ? <div className="text-sm text-slate-500">Історії змін ще немає.</div> : null}
    </div>
  );
}

function BonusManager({
  bonus,
  canManage,
  onSave,
  onEnsurePremium
}: {
  bonus: FamilyBonus;
  canManage: boolean;
  onSave: (bonusId: string, updates: { status: FamilyBonusStatus; amount: number | null; comment: string | null }) => void;
  onEnsurePremium: (userId: string, comment: string | null) => void;
}) {
  const [status, setStatus] = useState<FamilyBonusStatus>(bonus.status);
  const [amount, setAmount] = useState(bonus.amount == null ? '' : String(bonus.amount));
  const [comment, setComment] = useState(bonus.comment ?? '');

  if (!canManage) return null;

  const save = (nextStatus = status) =>
    onSave(bonus.id, {
      status: nextStatus,
      amount: amount ? Number(amount) : null,
      comment: comment.trim() || null
    });

  return (
    <div className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
      <h4 className="font-semibold text-white">Керування виплатою</h4>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <label className="block text-sm text-slate-300">
          Статус
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as FamilyBonusStatus)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-slate-100"
          >
            <option value="calculated">Очікує</option>
            <option value="pending_payout">Не видано</option>
            <option value="paid">Видано</option>
            <option value="not_eligible">Без премії</option>
          </select>
        </label>
        <label className="block text-sm text-slate-300">
          Сума
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, ''))}
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-slate-100"
          />
        </label>
        <div className="flex items-end gap-2">
          <button type="button" onClick={() => save('paid')} className="rounded-xl border border-orange-500/40 bg-orange-500/15 px-3 py-2 text-sm font-semibold text-orange-100">
            Видано
          </button>
          <button type="button" onClick={() => save('pending_payout')} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-semibold text-slate-200">
            Не видано
          </button>
        </div>
      </div>
      <label className="mt-3 block text-sm text-slate-300">
        Коментар
        <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-slate-100" />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => save()} className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-100">
          Зберегти зміни
        </button>
        {bonus.source === 'premium' ? (
          <button type="button" onClick={() => onEnsurePremium(bonus.userId, comment.trim() || null)} className="rounded-xl border border-white/10 bg-black/25 px-4 py-2 text-sm text-slate-200">
            Перерахувати за правилами
          </button>
        ) : null}
      </div>
    </div>
  );
}

function RulesEditor({
  rules,
  canManage,
  onSave
}: {
  rules: FamilyPremiumRules;
  canManage: boolean;
  onSave: (rules: FamilyPremiumRules) => void;
}) {
  const [draft, setDraft] = useState(() => rules.tiers.map((tier) => ({ ...tier })));

  return (
    <section className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-white">Правила премії</h3>
          <p className="mt-1 text-sm text-slate-400">Премія рахується з місячного заробітку за сімейні квести.</p>
        </div>
        {canManage ? (
          <button type="button" onClick={() => onSave({ ...rules, tiers: draft })} className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-sm text-amber-100">
            Зберегти правила
          </button>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2">
        {draft.map((tier, index) => (
          <div key={tier.id} className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-sm md:grid-cols-[1fr_130px_130px]">
            <input
              value={tier.title}
              disabled={!canManage}
              onChange={(event) => setDraft((items) => items.map((item, itemIndex) => (itemIndex === index ? { ...item, title: event.target.value } : item)))}
              className="rounded-lg border border-white/10 bg-black/35 px-2 py-1 text-slate-100 disabled:opacity-70"
            />
            <input
              value={tier.minMonthlyEarning}
              disabled={!canManage}
              onChange={(event) => setDraft((items) => items.map((item, itemIndex) => (itemIndex === index ? { ...item, minMonthlyEarning: Number(event.target.value) || 0 } : item)))}
              className="rounded-lg border border-white/10 bg-black/35 px-2 py-1 text-slate-100 disabled:opacity-70"
            />
            <input
              value={tier.premiumAmount}
              disabled={!canManage}
              onChange={(event) => setDraft((items) => items.map((item, itemIndex) => (itemIndex === index ? { ...item, premiumAmount: Number(event.target.value) || 0 } : item)))}
              className="rounded-lg border border-white/10 bg-black/35 px-2 py-1 text-slate-100 disabled:opacity-70"
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function ExpenseForm({ canManage, onAdd }: { canManage: boolean; onAdd: (amount: number, title: string, comment: string | null) => void }) {
  const [title, setTitle] = useState('Інша витрата');
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');

  if (!canManage) return null;

  return (
    <section className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4">
      <h3 className="font-semibold text-white">Додати витрату / мінус</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_160px]">
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Оплата податку, купівля машини..." className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-slate-100" />
        <input value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, ''))} placeholder="Сума" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-slate-100" />
      </div>
      <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={2} placeholder="Коментар" className="mt-3 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-slate-100" />
      <button
        type="button"
        onClick={() => {
          if (!amount || !title.trim()) return;
          onAdd(Number(amount), title.trim(), comment.trim() || null);
          setAmount('');
          setComment('');
        }}
        className="mt-3 rounded-xl border border-red-400/40 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-100"
      >
        Додати мінус
      </button>
    </section>
  );
}

function DetailsDrawer({
  selection,
  months,
  users,
  canManage,
  onClose,
  onSaveBonus,
  onEnsurePremium
}: {
  selection: AccountingSelection;
  months: FamilyAccountingMonth[];
  users: FamilyUser[];
  canManage: boolean;
  onClose: () => void;
  onSaveBonus: (bonusId: string, updates: { status: FamilyBonusStatus; amount: number | null; comment: string | null }) => void;
  onEnsurePremium: (userId: string, comment: string | null) => void;
}) {
  if (!selection) return null;

  const period = selection.type === 'period' ? months.find((month) => month.id === selection.monthId) ?? null : null;
  const bonus = selection.type === 'bonus' ? allBonuses(months).find((item) => item.id === selection.bonusId) ?? null : null;
  const report = selection.type === 'quest_report' ? allReports(months).find((item) => item.id === selection.reportId) ?? null : null;
  const ledger = selection.type === 'ledger' ? allLedger(months).find((item) => item.id === selection.ledgerId) ?? null : null;
  const member = selection.type === 'member' ? users.find((user) => user.nickname === selection.userId) ?? null : bonus ? users.find((user) => user.nickname === bonus.userId) ?? null : null;
  const audit = months.flatMap((month) => month.auditTrail ?? []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/75 p-4">
      <aside className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-[#111111] p-5 shadow-2xl shadow-red-950/40">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">Dragon House accounting</p>
            <h3 className="mt-1 text-xl font-semibold text-white">Деталі</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200">Закрити</button>
        </div>

        {period ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="text-2xl font-semibold text-white">{periodTitle(period)}</div>
              <div className="mt-2 text-sm text-slate-300">Операцій: {(period.ledger ?? []).length}</div>
            </div>
            <AuditTrail entries={period.auditTrail ?? []} />
          </div>
        ) : null}

        {member ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="text-lg font-semibold text-white">{member.nickname}</div>
            <div className="mt-1 text-sm text-slate-300">{member.rank}</div>
            <div className="mt-1 text-sm text-slate-500">Rank level: {member.rankLevel}</div>
          </div>
        ) : null}

        {bonus ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm">
              <div className="text-lg font-semibold text-white">{bonus.userId}</div>
              <div className="mt-2 text-slate-300">{bonus.reason}</div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <div>Сума: <span className="text-amber-100">{money(bonus.amount)}</span></div>
                <div>Статус: <span className="text-amber-100">{STATUS_LABELS[bonus.status]}</span></div>
                <div>Підтвердив: {bonus.approvedBy ?? '-'}</div>
                <div>Видав: {bonus.paidBy ?? '-'}</div>
                <div>Дата видачі: {date(bonus.paidAt)}</div>
                <div>Коментар: {bonus.comment ?? '-'}</div>
              </div>
            </div>
            <BonusManager bonus={bonus} canManage={canManage} onSave={onSaveBonus} onEnsurePremium={onEnsurePremium} />
            <AuditTrail entries={audit.filter((entry) => entry.entityId === bonus.id || entry.entityId.endsWith(`:${bonus.userId}`))} />
          </div>
        ) : null}

        {report ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm">
            <div className="text-lg font-semibold text-white">{report.title}</div>
            <div className="mt-2 text-slate-300">Підтвердив: {report.confirmedBy}</div>
            <div className="mt-1 text-slate-300">Загальна винагорода: {money(report.totalReward)}</div>
            <div className="mt-1 text-slate-300">Людям: {money(report.memberRewardPool)} · у сім’ю: {money(report.familyBankShare)}</div>
            <div className="mt-3 grid gap-2">
              {report.payouts.map((payout) => (
                <div key={payout.userId} className="rounded-xl border border-white/10 bg-black/25 p-3">
                  {payout.userId}: {money(payout.amount)} · {payout.status ?? 'pending'}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {ledger ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm">
            <div className="text-lg font-semibold text-white">{ledger.title}</div>
            <div className="mt-2 text-slate-300">{LEDGER_LABELS[ledger.type]} · {money(ledger.amount)}</div>
            <div className="mt-1 text-slate-400">{ledger.comment ?? '-'}</div>
            <div className="mt-1 text-slate-500">{ledger.createdBy} · {date(ledger.createdAt)}</div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

export function FamilyAccounting({ currentUser, users }: { currentUser: FamilyUser; users: FamilyUser[] }) {
  const [status, setStatus] = useState<FamilyBonusStatus | 'all'>('all');
  const [months, setMonths] = useState<FamilyAccountingMonth[]>(() => readFamilyAccountingMonths());
  const [rules, setRules] = useState<FamilyPremiumRules>(() => readFamilyPremiumRules());
  const [selection, setSelection] = useState<AccountingSelection>(null);
  const currentMonth = months[0];
  const canView = canViewAccounting(currentUser);
  const canManage = canManageAccounting(currentUser);
  const capital = calculateFamilyCapital(months);

  const bonuses = useMemo(() => {
    if (!currentMonth) return [];
    return currentMonth.bonuses.filter((bonus) => status === 'all' || bonus.status === status);
  }, [currentMonth, status]);

  const ledgerEntries = currentMonth?.ledger ?? [];
  const questIncome = ledgerEntries.filter((entry) => entry.type === 'income');
  const payouts = ledgerEntries.filter((entry) => entry.type === 'payout');
  const manualExpenses = ledgerEntries.filter((entry) => entry.type === 'expense');

  function refresh() {
    setMonths(readFamilyAccountingMonths());
    setRules(readFamilyPremiumRules());
  }

  async function saveBonus(bonusId: string, updates: { status: FamilyBonusStatus; amount: number | null; comment: string | null }) {
    const result = updateFamilyBonus(bonusId, currentUser.nickname, updates);
    if (!result) return;
    refresh();
    if (result.before.status !== result.after.status) await notifyBonusStatusChanged(result.after);
    if (result.before.status !== 'paid' && result.after.status === 'paid') await notifyBonusPaid(result.after);
    if (result.after.questReportId) await notifyQuestPayoutUpdated(result.after);
  }

  function saveRules(nextRules: FamilyPremiumRules) {
    saveFamilyPremiumRules(nextRules, currentUser.nickname);
    refresh();
  }

  function confirmPremium(userId: string, comment: string | null) {
    ensurePremiumBonus(userId, currentUser.nickname, comment);
    refresh();
  }

  if (!canView) {
    return (
      <section className="dh-panel rounded-3xl p-5">
        <h2 className="text-lg font-semibold text-white">Бухгалтерія</h2>
        <p className="mt-2 text-sm text-slate-400">Загальна бухгалтерія доступна тільки старшим рангам і учасникам з окремим доступом.</p>
      </section>
    );
  }

  return (
    <section className="dh-panel rounded-3xl p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Бухгалтерія Dragon House</h2>
          <p className="mt-1 text-sm text-slate-400">Капітал, заробіток з квестів, премії, виплати й ручні витрати.</p>
        </div>
        {currentMonth ? (
          <button type="button" onClick={() => setSelection({ type: 'period', monthId: currentMonth.id })} className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-left text-sm text-amber-100">
            {periodTitle(currentMonth)} · капітал {money(capital)}
          </button>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <div className="dh-card rounded-2xl p-4"><div className="text-slate-500">Капітал сім’ї</div><div className="mt-1 text-2xl font-semibold text-white">{money(capital)}</div></div>
        <div className="dh-card rounded-2xl p-4"><div className="text-slate-500">Доходи з квестів</div><div className="mt-1 text-xl font-semibold text-emerald-100">{money(questIncome.reduce((sum, item) => sum + item.amount, 0))}</div></div>
        <div className="dh-card rounded-2xl p-4"><div className="text-slate-500">Видані payout</div><div className="mt-1 text-xl font-semibold text-orange-100">{money(payouts.reduce((sum, item) => sum + item.amount, 0))}</div></div>
        <div className="dh-card rounded-2xl p-4"><div className="text-slate-500">Ручні витрати</div><div className="mt-1 text-xl font-semibold text-red-100">{money(manualExpenses.reduce((sum, item) => sum + item.amount, 0))}</div></div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <RulesEditor rules={rules} canManage={canManage} onSave={saveRules} />
        <ExpenseForm
          canManage={canManage}
          onAdd={(amount, title, comment) => {
            addManualLedgerExpense({ amount, title, comment, createdBy: currentUser.nickname });
            refresh();
          }}
        />
      </div>

      {canManage ? (
        <section className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
          <h3 className="font-semibold text-white">Премії за правилами</h3>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {users.map((user) => {
              const earning = currentMonth ? calculateMonthlyEarning(currentMonth, user.nickname) : 0;
              const premium = calculatePremiumAmount(earning, rules);
              return (
                <button key={user.nickname} type="button" onClick={() => confirmPremium(user.nickname, null)} className="rounded-xl border border-white/10 bg-black/25 p-3 text-left text-sm hover:border-amber-500/40">
                  <span className="block font-medium text-white">{user.nickname}</span>
                  <span className="mt-1 block text-slate-300">Зароблено: {money(earning)}</span>
                  <span className="block text-amber-100">Премія: {money(premium.amount)}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {(Object.keys(STATUS_LABELS) as Array<FamilyBonusStatus | 'all'>).map((item) => (
          <button key={item} type="button" onClick={() => setStatus(item)} className={status === item ? 'dh-tab-active rounded-xl px-3 py-2 text-sm font-semibold' : 'dh-tab rounded-xl px-3 py-2 text-sm font-semibold'}>
            {STATUS_LABELS[item]}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
        <div className="grid grid-cols-[1fr_0.8fr_1.2fr_0.8fr] bg-black/35 px-3 py-2 text-xs uppercase tracking-wide text-slate-400">
          <div>Учасник</div><div>Сума</div><div>Джерело</div><div>Статус</div>
        </div>
        {bonuses.map((bonus) => (
          <button key={bonus.id} type="button" onClick={() => setSelection({ type: 'bonus', bonusId: bonus.id })} className="grid w-full grid-cols-[1fr_0.8fr_1.2fr_0.8fr] border-t border-white/10 px-3 py-3 text-left text-sm hover:bg-orange-500/5">
            <span className="font-medium text-white">{bonus.userId}</span>
            <span className="text-amber-100">{money(bonus.amount)}</span>
            <span className="text-slate-300">{bonus.source === 'premium' ? 'Премія за правилами' : bonus.reason}</span>
            <span className="text-slate-200">{STATUS_LABELS[bonus.status]}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <section>
          <h3 className="font-semibold text-white">Звіти сімейних квестів</h3>
          <div className="mt-3 grid gap-3">
            {(currentMonth?.questReports ?? []).map((report) => (
              <button key={report.id} type="button" onClick={() => setSelection({ type: 'quest_report', reportId: report.id })} className="rounded-2xl border border-white/10 bg-black/30 p-4 text-left text-sm hover:border-amber-500/40">
                <span className="block font-semibold text-white">{report.title}</span>
                <span className="mt-1 block text-slate-300">Людям: {money(report.memberRewardPool)} · у сім’ю: {money(report.familyBankShare)}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="font-semibold text-white">Family ledger</h3>
          <div className="mt-3 grid gap-2">
            {ledgerEntries.map((entry) => (
              <button key={entry.id} type="button" onClick={() => setSelection({ type: 'ledger', ledgerId: entry.id })} className="rounded-xl border border-white/10 bg-black/25 p-3 text-left text-sm hover:border-orange-500/30">
                <span className="block font-medium text-white">{entry.title}</span>
                <span className="text-slate-300">{LEDGER_LABELS[entry.type]} · {money(entry.amount)} · {date(entry.createdAt)}</span>
              </button>
            ))}
            {!ledgerEntries.length ? <div className="text-sm text-slate-500">Операцій ще немає.</div> : null}
          </div>
        </section>
      </div>

      <div className="mt-5">
        <h3 className="font-semibold text-white">Audit trail</h3>
        <div className="mt-3"><AuditTrail entries={currentMonth?.auditTrail ?? []} /></div>
      </div>

      <DetailsDrawer
        selection={selection}
        months={months}
        users={users}
        canManage={canManage}
        onClose={() => setSelection(null)}
        onSaveBonus={(bonusId, updates) => void saveBonus(bonusId, updates)}
        onEnsurePremium={confirmPremium}
      />
    </section>
  );
}
