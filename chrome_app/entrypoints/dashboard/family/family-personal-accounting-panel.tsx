import { useEffect, useMemo, useState } from 'react';
import {
  getBackendMemberAccountingReport,
  getBackendWeeklyActivityStatus,
  type BackendAccountingAccrual,
  type BackendMemberAccountingReport,
  type BackendPayoutBatchItem,
  type BackendWeeklyActivityStatus
} from '../../../lib/family-accounting-backend-client';
import { DragonBadge, DragonCard, DragonLoader, DragonPanel, DragonRetry, DragonSection } from '../dragon-ui/dragon-ui';

type PersonalAccountingState = {
  loading: boolean;
  error: Error | null;
  weeklyActivity: BackendWeeklyActivityStatus | null;
  report: BackendMemberAccountingReport | null;
};

type PersonalPaymentTab = 'all' | 'salary' | 'quests' | 'premium';

const emptyState: PersonalAccountingState = {
  loading: true,
  error: null,
  weeklyActivity: null,
  report: null
};

const earningLabels: Array<[keyof NonNullable<BackendMemberAccountingReport['weeklyEarnings']>['categories'], string]> = [
  ['baseSalary', 'Базова зарплата'],
  ['quests', 'Квести'],
  ['activityPremium', 'Премія за активність'],
  ['questPremium', 'Премія за квести'],
  ['combatPremium', 'Вишки / стаки'],
  ['leadershipPremium', 'Премія від старших'],
  ['top3Premium', 'TOP-3'],
  ['specialPremium', 'Рекрутери / HR'],
  ['personalPremium', 'Особисті премії'],
  ['rewards', 'Нагороди'],
  ['corrections', 'Корекції'],
  ['other', 'Інше']
];

const personalPaymentTabs: Array<{ key: PersonalPaymentTab; label: string }> = [
  { key: 'all', label: 'Усі' },
  { key: 'salary', label: 'Зарплата' },
  { key: 'quests', label: 'Квести' },
  { key: 'premium', label: 'Премії' }
];

export function FamilyPersonalAccountingPanel({ memberId }: { memberId: string }) {
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [state, setState] = useState<PersonalAccountingState>(emptyState);
  const [paymentTab, setPaymentTab] = useState<PersonalPaymentTab>('all');

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: null }));
    Promise.all([
      getBackendWeeklyActivityStatus(memberId, controller.signal),
      getBackendMemberAccountingReport(memberId, controller.signal)
    ])
      .then(([weeklyActivity, report]) => {
        setState({ loading: false, error: null, weeklyActivity, report });
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setState({
            loading: false,
            error: error instanceof Error ? error : new Error('Не вдалося завантажити особисту бухгалтерію.'),
            weeklyActivity: null,
            report: null
          });
        }
      });
    return () => controller.abort();
  }, [memberId, refreshNonce]);

  const outstanding = useMemo(
    () => state.report?.accruals.filter((item) => ['accrued', 'approved'].includes(item.status) && !item.paidAt) ?? [],
    [state.report]
  );
  const paidHistory = useMemo(() => {
    if (!state.report) return [];
    return filterPersonalPaymentHistory(state.report.payoutHistory, state.report.accruals, paymentTab).slice(0, 5);
  }, [state.report, paymentTab]);

  return (
    <DragonSection eyebrow="Особиста бухгалтерія" title="Особистий кабінет">
      <div className="dh-accounting-profile">
        {state.loading ? <DragonLoader label="Завантажуємо особисті фінанси..." /> : null}
        {state.error ? (
          <DragonRetry
            title="Особисті фінанси не завантажилися"
            description={state.error.message}
            onRetry={() => setRefreshNonce((value) => value + 1)}
          />
        ) : null}
        {state.weeklyActivity ? <WeeklyActivityCard activity={state.weeklyActivity} /> : null}
        {state.report?.weeklyEarnings ? <WeeklyEarningsCard report={state.report} /> : null}
        {state.report ? <OutstandingCard items={outstanding} /> : null}
        {state.report ? (
          <PaymentHistoryCard
            items={paidHistory}
            tab={paymentTab}
            onTabChange={setPaymentTab}
            accruals={state.report.accruals}
          />
        ) : null}
      </div>
    </DragonSection>
  );
}

function WeeklyActivityCard({ activity }: { activity: BackendWeeklyActivityStatus }) {
  const questDone = activity.completedQuests >= activity.questRequirement;
  const towerDone = activity.towerParticipations >= activity.towerRequirement;
  return (
    <DragonPanel variant="raised" className={`dh-accounting-profile-card ${activity.eligible ? 'is-complete' : 'is-pending'}`}>
      <div className="dh-accounting-profile-heading">
        <div>
          <p className="dh-dragon-eyebrow">{formatWeekRange(activity.startsAt, activity.endsAt)}</p>
          <h3>Тижнева активність</h3>
        </div>
        <DragonBadge tone={activity.eligible ? 'success' : 'warning'}>
          {activity.eligible ? 'Виконана' : 'Не виконана'}
        </DragonBadge>
      </div>
      <div className="dh-accounting-profile-progress">
        <ProgressRow label="Квести" value={activity.completedQuests} done={questDone} />
        <ProgressRow label="Вишки / стаки" value={activity.towerParticipations} done={towerDone} />
      </div>
      {activity.eligible ? (
        <div className="dh-accounting-profile-message is-success">
          <strong>Тижнева активність виконана</strong>
          <p>Підстава: {qualifyingReasonLabel(activity.qualifyingReason)}</p>
        </div>
      ) : (
        <div className="dh-accounting-profile-message is-warning">
          <strong>Тижнева активність не виконана</strong>
          <p>Для базової зарплати потрібен хоча б 1 сімейний квест або участь хоча б в 1 вишці/стаку протягом тижня.</p>
        </div>
      )}
    </DragonPanel>
  );
}

function ProgressRow({ label, value, done }: { label: string; value: number; done: boolean }) {
  return (
    <DragonCard className="dh-accounting-profile-progress-row">
      <span>{label}</span>
      <strong>{done ? '1+ / 1' : `${value} / 1`}</strong>
    </DragonCard>
  );
}

function WeeklyEarningsCard({ report }: { report: BackendMemberAccountingReport }) {
  const earnings = report.weeklyEarnings;
  if (!earnings) return null;
  return (
    <DragonPanel variant="ceremonial" className="dh-accounting-profile-card">
      <div className="dh-accounting-profile-heading">
        <div>
          <p className="dh-dragon-eyebrow">{formatWeekRange(earnings.startsAt, earnings.endsAt)}</p>
          <h3>Заробіток за тиждень</h3>
        </div>
      </div>
      <div className="dh-accounting-profile-breakdown">
        {earningLabels.map(([key, label]) => (
          <div key={key}>
            <span>{label}</span>
            <strong>{formatMoney(earnings.categories[key])}</strong>
          </div>
        ))}
      </div>
      <div className="dh-accounting-profile-totals">
        <DragonCard>
          <span>Разом нараховано</span>
          <strong>{formatMoney(earnings.totals.accrued)}</strong>
        </DragonCard>
        <DragonCard>
          <span>Виплачено</span>
          <strong>{formatMoney(earnings.totals.paid)}</strong>
        </DragonCard>
        <DragonCard>
          <span>Очікує виплати</span>
          <strong>{formatMoney(earnings.totals.outstanding)}</strong>
        </DragonCard>
      </div>
    </DragonPanel>
  );
}

function OutstandingCard({ items }: { items: BackendAccountingAccrual[] }) {
  return (
    <DragonPanel variant="raised" className="dh-accounting-profile-card">
      <h3>Очікує виплати</h3>
      {items.length ? (
        <div className="dh-accounting-profile-list">
          {items.slice(0, 8).map((item) => (
            <DragonCard key={item.id} className="dh-accounting-profile-list-item">
              <div>
                <span>{friendlySourceLabel(item)}</span>
                <p>{item.reason}</p>
              </div>
              <strong>{formatMoney(item.amount)}</strong>
              <DragonBadge tone="warning">Очікує виплати</DragonBadge>
            </DragonCard>
          ))}
        </div>
      ) : (
        <p className="dh-accounting-profile-empty">Наразі немає виплат, що очікують.</p>
      )}
    </DragonPanel>
  );
}

function PaymentHistoryCard({
  items,
  tab,
  onTabChange,
  accruals
}: {
  items: BackendPayoutBatchItem[];
  tab: PersonalPaymentTab;
  onTabChange: (tab: PersonalPaymentTab) => void;
  accruals: BackendAccountingAccrual[];
}) {
  return (
    <DragonPanel variant="ceremonial" className="dh-accounting-profile-card">
      <h3>Історія виплат</h3>
      <div className="dh-accounting-profile-tabs" role="tablist" aria-label="Категорії історії виплат">
        {personalPaymentTabs.map((item) => (
          <button key={item.key} type="button" role="tab" aria-selected={tab === item.key} onClick={() => onTabChange(item.key)} className={tab === item.key ? 'is-active' : ''}>
            {item.label}
          </button>
        ))}
      </div>
      {items.length ? (
        <div className="dh-accounting-profile-list">
          {items.map((item) => (
            <DragonCard key={item.id} className="dh-accounting-profile-list-item">
              <div>
                <span>{personalPaymentCategoryLabel(personalPaymentCategory(item, accruals))}</span>
                <p>{item.paidAt ? formatDateTime(item.paidAt) : 'Дата виплати не вказана'}</p>
                {item.payerNicknameSnapshot ? <p>Виплатив: {item.payerNicknameSnapshot}</p> : null}
                {item.payerRoleSnapshot ? <p>Роль: {item.payerRoleSnapshot}</p> : null}
              </div>
              <strong>{formatMoney(item.totalAmount)}</strong>
              <DragonBadge tone="success">Виплачено</DragonBadge>
            </DragonCard>
          ))}
        </div>
      ) : (
        <p className="dh-accounting-profile-empty">Історія виплат поки порожня.</p>
      )}
    </DragonPanel>
  );
}

function filterPersonalPaymentHistory(items: BackendPayoutBatchItem[], accruals: BackendAccountingAccrual[], tab: PersonalPaymentTab) {
  return items
    .filter((item) => item.status === 'paid')
    .filter((item) => tab === 'all' || personalPaymentCategory(item, accruals) === tab);
}

function personalPaymentCategory(item: BackendPayoutBatchItem, accruals: BackendAccountingAccrual[]): PersonalPaymentTab {
  const linked = accruals.filter((accrual) => item.accrualIds.includes(accrual.id));
  if (linked.some((accrual) => accrual.sourceType === 'salary')) return 'salary';
  if (linked.some((accrual) => ['quest', 'quest_reward', 'quest_best_participant'].includes(accrual.sourceType))) return 'quests';
  if (linked.some((accrual) => accrual.sourceType === 'premium')) return 'premium';
  return 'all';
}

function personalPaymentCategoryLabel(category: PersonalPaymentTab): string {
  return personalPaymentTabs.find((item) => item.key === category)?.label ?? 'Інше';
}

function friendlySourceLabel(item: BackendAccountingAccrual): string {
  const category = typeof item.metadata?.category === 'string' ? item.metadata.category : null;
  if (item.sourceType === 'salary') return 'Базова зарплата';
  if (['quest', 'quest_reward', 'quest_best_participant'].includes(item.sourceType)) return 'Квести';
  if (item.sourceType === 'reward') return 'Нагорода';
  if (item.sourceType === 'adjustment' || item.sourceType === 'manual_bonus') return 'Корекція';
  if (item.sourceType === 'premium' && category === 'activity') return 'Премія за активність';
  if (item.sourceType === 'premium' && category === 'quest_activity') return 'Премія за квести';
  if (item.sourceType === 'premium' && category === 'combat') return 'Вишки / стаки';
  if (item.sourceType === 'premium' && category === 'leadership') return 'Премія від старших';
  if (item.sourceType === 'premium' && category === 'top3') return 'TOP-3';
  if (item.sourceType === 'premium' && category === 'special') return 'Рекрутери / HR';
  if (item.sourceType === 'premium') return 'Особиста премія';
  return 'Інше';
}

function qualifyingReasonLabel(reason: BackendWeeklyActivityStatus['qualifyingReason']): string {
  if (reason === 'quest') return 'сімейний квест';
  if (reason === 'tower') return 'участь у вишках / стаках';
  if (reason === 'both') return 'квест і вишки / стаки';
  return 'підтвердженої активності ще немає';
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(value);
}

function formatWeekRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Поточний тиждень';
  const startText = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', timeZone: 'Europe/Kyiv' }).format(start);
  const endText = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', timeZone: 'Europe/Kyiv' }).format(end);
  return `${startText} - ${endText}`;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Kyiv'
  }).format(new Date(value));
}
