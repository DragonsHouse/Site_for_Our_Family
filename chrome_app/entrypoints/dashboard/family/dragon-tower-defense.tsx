import { useMemo, useState } from 'react';
import {
  DragonAvatar,
  DragonBadge,
  DragonButton,
  DragonCard,
  DragonDialog,
  DragonEmptyState,
  DragonInput,
  DragonPanel,
  DragonProgress,
  DragonRetry,
  DragonSection,
  DragonSelect,
  DragonSkeleton,
  DragonTextarea
} from '../dragon-ui/dragon-ui';
import {
  createBackendDragonTowerDefenseStateDependencies,
  createMockDragonTowerDefenseStateDependencies,
  type DragonTowerDefenseStateDependencies
} from './tower-defense-composition';
import {
  calculateDragonDefenseReadiness,
  formatDragonDefenseDateTime,
  getDragonDefenseResultLabel,
  getDragonDefenseStatusLabel
} from './tower-defense-service';
import { useDragonTowerDefenseState } from './tower-defense-state';
import type {
  DragonDefenseAttendanceStatus,
  DragonDefenseReadiness,
  DragonDefenseResult,
  DragonDefenseStatus,
  DragonFireGuardRosterEntry,
  DragonGuardResponseStatus,
  DragonTowerDefense,
  DragonTowerDefinition,
  DragonTowerDefenseCreateInput,
  DragonTowerDefenseRosterFilter,
  DragonTowerDefenseStatistics
} from './tower-defense-models';
import type { FamilyUser } from '../../../lib/family-types';
import { canManageDiscordIntegration } from '../../../lib/family-permissions';
import { FamilyRewardAllocationPanel } from './family-reward-allocation-panel';
import { DiscordPublishPanel } from './discord-publish-panel';

type TowerDefenseDialog = 'create' | 'edit' | 'details' | 'respond' | 'attendance' | 'complete' | 'cancel' | null;

const RESPONSE_LABELS: Record<DragonGuardResponseStatus, string> = {
  'no-response': 'Без відповіді',
  available: 'Доступний',
  joining: 'Відгукнувся',
  confirmed: 'Підтвердив',
  unavailable: 'Недоступний'
};

const ATTENDANCE_LABELS: Record<DragonDefenseAttendanceStatus, string> = {
  unconfirmed: 'Не підтверджено',
  present: 'Присутній',
  late: 'Запізнився',
  absent: 'Відсутній',
  excused: 'Поважна причина'
};

const READINESS_LABELS: Record<DragonDefenseReadiness, string> = {
  critical: 'Критично',
  insufficient: 'Недостатньо',
  ready: 'Готові',
  reinforced: 'Посилено'
};

const ROSTER_FILTERS: Array<{ key: DragonTowerDefenseRosterFilter; label: string }> = [
  { key: 'all', label: 'Усі' },
  { key: 'available', label: 'Доступні' },
  { key: 'responded', label: 'Відгукнулись' },
  { key: 'confirmed', label: 'Підтвердили' },
  { key: 'unavailable', label: 'Недоступні' },
  { key: 'no-response', label: 'Без відповіді' }
];

export function DragonTowerDefenseScreen({
  dependencies,
  currentUser
}: {
  dependencies?: DragonTowerDefenseStateDependencies;
  currentUser?: FamilyUser | null;
}) {
  const backendDependencyMode = Boolean(currentUser ?? dependencies?.backendOperations ?? dependencies?.loadTowerDefenseReadState);
  const currentFamilyMemberId = currentUser?.id ?? dependencies?.currentFamilyMemberId ?? (backendDependencyMode ? '' : 'anastasia');
  const stateDependencies = useMemo(
    () => dependencies ?? (currentUser ? createBackendDragonTowerDefenseStateDependencies(currentUser.id) : createMockDragonTowerDefenseStateDependencies()),
    [currentUser, dependencies]
  );
  const state = useDragonTowerDefenseState(stateDependencies);
  const [dialog, setDialog] = useState<TowerDefenseDialog>(null);
  const [dialogDefense, setDialogDefense] = useState<DragonTowerDefense | null>(null);

  const openDialog = (nextDialog: TowerDefenseDialog, defense = state.activeDefense) => {
    setDialogDefense(defense);
    setDialog(nextDialog);
  };

  const closeDialog = () => {
    setDialog(null);
    setDialogDefense(null);
  };
  const requireCurrentFamilyMemberId = () => {
    if (state.readSource !== 'backend') return currentFamilyMemberId;
    if (currentFamilyMemberId) return currentFamilyMemberId;
    state.setDomainError('Tower Defense backend requires an authenticated family member.');
    return null;
  };

  if (state.loading) return <DragonTowerDefenseLoadingState />;
  if (state.error) {
    return (
      <DragonRetry
        title="Вогняна варта не відкрилась"
        description={state.error.message}
        onRetry={state.refresh}
      />
    );
  }

  return (
    <div className="dh-tower-defense space-y-4">
      <DragonDefenseHero
        defense={state.activeDefense}
        readiness={state.readiness}
        onCreate={() => openDialog('create', null)}
        onRespond={() => openDialog('respond')}
        onDetails={() => openDialog('details')}
      />

      {state.domainError ? <div className="dh-tower-alert" role="alert">{state.domainError}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <DragonSection title="Активний захист" description="Операційна панель командира Вогняної варти.">
          {state.activeDefense ? (
            <DragonDefenseDetails
              defense={state.activeDefense}
              readiness={calculateDragonDefenseReadiness(state.activeDefense)}
              currentUser={currentUser ?? undefined}
              onEdit={() => openDialog('edit', state.activeDefense)}
              onStart={() => void state.startDefense(state.activeDefense!)}
              onComplete={() => openDialog('complete', state.activeDefense)}
              onCancel={() => openDialog('cancel', state.activeDefense)}
            />
          ) : (
            <DragonEmptyState
              title="Немає активного захисту"
              description="Заплануй захист вишки, щоб зібрати Вогняну варту."
              action={<DragonButton type="button" onClick={() => openDialog('create', null)}>Створити захист</DragonButton>}
            />
          )}
        </DragonSection>

        <DragonDefenseStatistics statistics={state.statistics} />
      </div>

      <DragonSection title="Вогняна варта" description="Доступність у цьому phase є manual/mock статусом, не live Discord presence.">
        <DragonFireGuardRoster
          roster={state.filteredRoster}
          rosterFilter={state.rosterFilter}
          onFilterChange={state.setRosterFilter}
          onRespond={(memberId, response) => {
            if (!state.activeDefense) return;
            void state.respond(state.activeDefense, memberId, response);
          }}
          onAttendance={(memberId, status) => {
            if (!state.activeDefense) return;
            void state.confirmAttendance(state.activeDefense, memberId, status, state.activeDefense.commanderMemberId);
          }}
        />
      </DragonSection>

      <div className="grid gap-4 lg:grid-cols-2">
        <DragonSection title="Заплановані захисти" description="Найближчі операції Вогняної варти.">
          <DragonUpcomingDefenses defenses={state.upcomingDefenses} onDetails={(defense) => openDialog('details', defense)} />
        </DragonSection>
        <DragonDefenseHistory history={state.history} />
      </div>

      <DragonDefenseTimeline defenses={state.allDefenses} />

      <DragonTowerDefenseDialogs
        dialog={dialog}
        defense={dialogDefense}
        onClose={closeDialog}
        onCreate={(input) => {
          if (state.readSource === 'backend' && !requireCurrentFamilyMemberId()) return;
          void state.createDefense(input).then(closeDialog).catch((error: Error) => state.setDomainError(error.message));
        }}
        onEdit={(defense, input) => {
          void state.updateDefense(defense, input).then(closeDialog).catch((error: Error) => state.setDomainError(error.message));
        }}
        onRespond={(defense, response, note) => {
          const memberId = requireCurrentFamilyMemberId();
          if (!memberId) return;
          void state.respond(defense, memberId, response, note).then(closeDialog).catch((error: Error) => state.setDomainError(error.message));
        }}
        onAttendance={(defense, memberId, status) => {
          void state.confirmAttendance(defense, memberId, status, defense.commanderMemberId).then(closeDialog).catch((error: Error) => state.setDomainError(error.message));
        }}
        onComplete={(defense, result, notes, failureReason) => {
          void state.completeDefense(defense, result, defense.commanderMemberId, notes, failureReason).then(closeDialog).catch((error: Error) => state.setDomainError(error.message));
        }}
        onCancel={(defense, reason) => {
          void state.cancelDefense(defense, defense.commanderMemberId, reason).then(closeDialog).catch((error: Error) => state.setDomainError(error.message));
        }}
        towers={state.towerDefinitions}
        currentFamilyMemberId={currentFamilyMemberId}
        backendMode={state.readSource === 'backend'}
        mutating={state.mutating}
        currentUser={currentUser ?? undefined}
      />
    </div>
  );
}

export function DragonDefenseHero({
  defense,
  readiness,
  onCreate,
  onRespond,
  onDetails
}: {
  defense: DragonTowerDefense | null;
  readiness: DragonDefenseReadiness | null;
  onCreate: () => void;
  onRespond: () => void;
  onDetails: () => void;
}) {
  return (
    <DragonSection
      className="dh-tower-hero"
      eyebrow="Вогняна варта"
      title={defense ? defense.tower.towerName : 'Операційна палата захисту'}
      description={defense ? `Захист починається ${formatDragonDefenseDateTime(defense.startsAt)}. Командир: ${defense.commanderMemberId}.` : 'Плануй захисти вишок, збирай вартових і фіксуй реальну участь.'}
    >
      <div className="dh-tower-hero-actions">
        <DragonButton type="button" onClick={defense ? onRespond : onCreate}>
          {defense ? 'Відгукнутися' : 'Створити захист'}
        </DragonButton>
        {defense ? <DragonButton type="button" variant="secondary" onClick={onDetails}>Деталі</DragonButton> : null}
      </div>
      <div className="dh-tower-command-grid">
        <DragonCard className="dh-tower-command-card">
          <span className="dh-tower-signal" aria-hidden="true" />
          <p>Наступна ціль</p>
          <strong>{defense?.tower.towerCode ?? 'Очікує сигнал'}</strong>
          <small>{defense?.tower.location.label ?? 'Немає запланованої операції'}</small>
        </DragonCard>
        <DragonCard className="dh-tower-command-card">
          <p>Статус</p>
          {defense ? <DragonDefenseStatusBadge status={defense.status} /> : <DragonBadge tone="muted">Тиша</DragonBadge>}
          <small>{defense ? `Wave ${defense.wave} / ${defense.phase}` : 'Варта у резерві'}</small>
        </DragonCard>
        <DragonCard className="dh-tower-command-card">
          <p>Готовність</p>
          {readiness ? <DragonReadinessIndicator readiness={readiness} /> : <DragonBadge tone="muted">Без даних</DragonBadge>}
          <small>{defense ? `${defense.confirmedCount}/${defense.recommendedGuardCount} підтверджено` : 'Очікує roster'}</small>
        </DragonCard>
      </div>
    </DragonSection>
  );
}

export function DragonDefenseDetails({
  defense,
  readiness,
  currentUser,
  onEdit,
  onStart,
  onComplete,
  onCancel
}: {
  defense: DragonTowerDefense;
  readiness: DragonDefenseReadiness;
  currentUser?: FamilyUser;
  onEdit: () => void;
  onStart: () => void;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const readinessValue = getReadinessProgress(defense, readiness);
  const closed = defense.status === 'completed' || defense.status === 'cancelled';
  const canManageRewards = canManageTowerRewardAllocations(currentUser, defense);
  const canManageDiscord = Boolean(currentUser && canManageDiscordIntegration(currentUser));

  return (
    <div className="dh-tower-active">
      <DragonDefenseCard defense={defense} onDetails={onEdit} />
      <DragonCard className="dh-tower-operation-card">
        <div className="dh-tower-card-head">
          <div>
            <p className="dh-kicker">Операція</p>
            <h3>{defense.title}</h3>
          </div>
          <DragonReadinessIndicator readiness={readiness} />
        </div>
        <dl className="dh-tower-details-grid">
          <div><dt>Початок</dt><dd>{formatDragonDefenseDateTime(defense.startsAt)}</dd></div>
          <div><dt>Локація</dt><dd>{defense.tower.location.label}</dd></div>
          <div><dt>Командир</dt><dd>{defense.commanderMemberId}</dd></div>
          <div><dt>Участь</dt><dd>{defense.participantCount} відповіли / {defense.confirmedCount} підтвердили</dd></div>
        </dl>
        <DragonProgress value={readinessValue} label={`Готовність захисту: ${READINESS_LABELS[readiness]}`} />
        <div className="dh-tower-actions">
          <DragonButton type="button" variant="secondary" onClick={onEdit}>Редагувати</DragonButton>
          <DragonButton type="button" onClick={onStart} disabled={defense.status !== 'gathering'}>Почати</DragonButton>
          <DragonButton type="button" onClick={onComplete} disabled={defense.status !== 'active'}>Завершити</DragonButton>
          <DragonButton type="button" variant="danger" onClick={onCancel} disabled={defense.status === 'completed' || defense.status === 'cancelled'}>Скасувати</DragonButton>
        </div>
        {canManageDiscord ? <DiscordPublishPanel target="tower" sourceId={defense.backendDefenseId} /> : null}
      </DragonCard>
      {currentUser && defense.backendDefenseId ? (
        <FamilyRewardAllocationPanel
          sourceModule="tower_defense"
          sourceId={defense.backendDefenseId}
          canManage={canManageRewards}
          closed={closed}
        />
      ) : null}
    </div>
  );
}

export function DragonDefenseCard({
  defense,
  onDetails
}: {
  defense: DragonTowerDefense;
  onDetails: () => void;
}) {
  return (
    <DragonCard className="dh-tower-defense-card">
      <div className="dh-tower-card-head">
        <div>
          <p className="dh-kicker">{defense.tower.towerCode}</p>
          <h3>{defense.tower.towerName}</h3>
        </div>
        <DragonDefenseStatusBadge status={defense.status} />
      </div>
      <p>{defense.description}</p>
      <div className="dh-tower-card-meta">
        <span>{formatDragonDefenseDateTime(defense.startsAt)}</span>
        <span>{defense.tower.location.label}</span>
        <span>{defense.priority}</span>
      </div>
      <DragonButton type="button" variant="secondary" onClick={onDetails}>Відкрити</DragonButton>
    </DragonCard>
  );
}

export function DragonFireGuardRoster({
  roster,
  rosterFilter,
  onFilterChange,
  onRespond,
  onAttendance
}: {
  roster: DragonFireGuardRosterEntry[];
  rosterFilter: DragonTowerDefenseRosterFilter;
  onFilterChange: (filter: DragonTowerDefenseRosterFilter) => void;
  onRespond: (memberId: string, response: DragonGuardResponseStatus) => void;
  onAttendance: (memberId: string, status: DragonDefenseAttendanceStatus) => void;
}) {
  return (
    <div className="dh-fire-roster">
      <div className="dh-roster-filters" aria-label="Fire Guard roster filters">
        {ROSTER_FILTERS.map((filter) => (
          <DragonButton
            key={filter.key}
            type="button"
            variant={rosterFilter === filter.key ? 'primary' : 'ghost'}
            aria-pressed={rosterFilter === filter.key}
            onClick={() => onFilterChange(filter.key)}
          >
            {filter.label}
          </DragonButton>
        ))}
      </div>
      {roster.length === 0 ? (
        <DragonEmptyState title="Немає вартових для цього фільтра" description="Зміни фільтр або дочекайся нових відповідей." />
      ) : (
        <div className="dh-fire-roster-list">
          {roster.map((member) => (
            <DragonGuardMemberRow
              key={member.memberId}
              member={member}
              onRespond={(response) => onRespond(member.memberId, response)}
              onAttendance={(status) => onAttendance(member.memberId, status)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function DragonGuardMemberRow({
  member,
  onRespond,
  onAttendance
}: {
  member: DragonFireGuardRosterEntry;
  onRespond: (response: DragonGuardResponseStatus) => void;
  onAttendance: (status: DragonDefenseAttendanceStatus) => void;
}) {
  return (
    <DragonCard className="dh-fire-guard-row">
      <DragonAvatar name={member.displayName} src={member.avatarUrl} size="sm" />
      <div className="dh-fire-guard-main">
        <strong>{member.displayName}</strong>
        <span>{member.familyRank} / {member.fireGuardRole}</span>
        <small>{member.onlineStatus?.label ?? 'Manual/mock status'}</small>
      </div>
      <DragonBadge tone={member.currentResponse === 'confirmed' ? 'success' : member.currentResponse === 'unavailable' ? 'danger' : 'gold'}>
        {RESPONSE_LABELS[member.currentResponse]}
      </DragonBadge>
      <DragonSelect
        aria-label={`Response for ${member.displayName}`}
        value={member.currentResponse}
        onChange={(event) => onRespond(event.target.value as DragonGuardResponseStatus)}
      >
        {Object.entries(RESPONSE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </DragonSelect>
      <DragonSelect
        aria-label={`Attendance for ${member.displayName}`}
        value={member.attendance}
        onChange={(event) => onAttendance(event.target.value as DragonDefenseAttendanceStatus)}
      >
        {Object.entries(ATTENDANCE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </DragonSelect>
    </DragonCard>
  );
}

export function DragonReadinessIndicator({ readiness }: { readiness: DragonDefenseReadiness }) {
  return <DragonBadge tone={readiness === 'critical' ? 'danger' : readiness === 'insufficient' ? 'gold' : 'success'}>{READINESS_LABELS[readiness]}</DragonBadge>;
}

export function DragonDefenseStatusBadge({ status }: { status: DragonDefenseStatus }) {
  return <DragonBadge tone={status === 'active' ? 'danger' : status === 'completed' ? 'success' : status === 'cancelled' ? 'muted' : 'gold'}>{getDragonDefenseStatusLabel(status)}</DragonBadge>;
}

export function DragonUpcomingDefenses({
  defenses,
  onDetails
}: {
  defenses: DragonTowerDefense[];
  onDetails: (defense: DragonTowerDefense) => void;
}) {
  if (defenses.length === 0) {
    return <DragonEmptyState title="Немає запланованих захистів" description="Операційний стіл чистий." />;
  }

  return (
    <div className="dh-tower-card-list">
      {defenses.map((defense) => (
        <DragonDefenseCard key={defense.id} defense={defense} onDetails={() => onDetails(defense)} />
      ))}
    </div>
  );
}

export function DragonDefenseHistory({
  history
}: {
  history: ReturnType<typeof import('./tower-defense-service').buildDragonDefenseHistory>;
}) {
  return (
    <DragonSection title="Історія захистів" description="Завершені операції та їхній результат.">
      {history.length === 0 ? (
        <DragonEmptyState title="Історія ще порожня" description="Завершені захисти з'являться тут." />
      ) : (
        <div className="dh-defense-history">
          {history.map((entry) => (
            <DragonCard key={entry.id} className="dh-defense-history-card">
              <div>
                <strong>{entry.towerName}</strong>
                <span>{formatDragonDefenseDateTime(entry.occurredAt)}</span>
              </div>
              <DragonBadge tone={entry.result === 'defended' ? 'success' : entry.result === 'lost' ? 'danger' : 'muted'}>
                {getDragonDefenseResultLabel(entry.result)}
              </DragonBadge>
              <small>{entry.confirmedAttendance} участь / {entry.xp} XP</small>
            </DragonCard>
          ))}
        </div>
      )}
    </DragonSection>
  );
}

export function DragonDefenseTimeline({ defenses }: { defenses: DragonTowerDefense[] }) {
  return (
    <DragonSection title="Операційна хроніка" description="Timeline формується з Defense records і linked Dragon Events.">
      <div className="dh-defense-timeline">
        {defenses.map((defense) => (
          <DragonCard key={defense.id} className="dh-defense-timeline-entry">
            <span aria-hidden="true" />
            <div>
              <strong>{defense.title}</strong>
              <p>{formatDragonDefenseDateTime(defense.startsAt)} / {defense.tower.location.label}</p>
            </div>
            <DragonDefenseStatusBadge status={defense.status} />
          </DragonCard>
        ))}
      </div>
    </DragonSection>
  );
}

export function DragonDefenseStatistics({ statistics }: { statistics: DragonTowerDefenseStatistics }) {
  return (
    <DragonSection title="Статистика варти" description="Початковий production summary без reward logic.">
      <div className="dh-tower-stat-grid">
        <DragonStat label="Усього" value={statistics.totalDefenses} />
        <DragonStat label="Захищено" value={statistics.defended} />
        <DragonStat label="Втрачено" value={statistics.lost} />
        <DragonStat label="Успіх" value={`${statistics.successRate}%`} />
        <DragonStat label="Участь" value={statistics.totalConfirmedAttendance} />
        <DragonStat label="Середня варта" value={statistics.averageGuardCount} />
      </div>
      {statistics.mostDefendedTower ? (
        <DragonCard className="dh-tower-most">
          Найчастіше захищали: <strong>{statistics.mostDefendedTower.towerName}</strong>
        </DragonCard>
      ) : null}
    </DragonSection>
  );
}

function DragonStat({ label, value }: { label: string; value: string | number }) {
  return (
    <DragonCard className="dh-tower-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </DragonCard>
  );
}

export function DragonDefenseForm({
  defense,
  onSubmit,
  towers = [],
  currentFamilyMemberId,
  currentUser,
  backendMode = false,
  mutating = false
}: {
  defense?: DragonTowerDefense | null;
  onSubmit: (input: DragonTowerDefenseCreateInput) => void;
  towers?: DragonTowerDefinition[];
  currentFamilyMemberId?: string;
  currentUser?: FamilyUser;
  backendMode?: boolean;
  mutating?: boolean;
}) {
  const activeBackendTowers = towers.filter((tower) => tower.active);
  const defaultTower = defense
    ? towers.find((tower) => tower.id === defense.tower.towerId || tower.backendTowerId === defense.tower.towerId)
    : activeBackendTowers[0] ?? towers[0];
  const [title, setTitle] = useState(defense?.title ?? 'Захист вишки: New Signal');
  const [selectedTowerId, setSelectedTowerId] = useState(defaultTower?.id ?? defense?.tower.towerId ?? '');
  const selectedTower = towers.find((tower) => tower.id === selectedTowerId) ?? defaultTower;
  const backendSubmitBlocked = backendMode && (!selectedTower || activeBackendTowers.length === 0 || !currentFamilyMemberId);
  const [towerName, setTowerName] = useState(defense?.tower.towerName ?? selectedTower?.towerName ?? 'New Signal Tower');
  const [towerCode, setTowerCode] = useState(defense?.tower.towerCode ?? selectedTower?.towerCode ?? 'NEW-01');
  const [location, setLocation] = useState(defense?.tower.location.label ?? selectedTower?.location.label ?? 'GTA map sector');
  const [startsAt, setStartsAt] = useState(toLocalInputValue(defense?.startsAt ?? new Date(Date.now() + 60 * 60 * 1000).toISOString()));
  const [minimumGuardCount, setMinimumGuardCount] = useState(String(defense?.minimumGuardCount ?? 3));
  const [recommendedGuardCount, setRecommendedGuardCount] = useState(String(defense?.recommendedGuardCount ?? 5));
  const [description, setDescription] = useState(defense?.description ?? 'Операція Вогняної варти. Manual/mock availability for this phase.');

  return (
    <form
      className="dh-tower-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (backendSubmitBlocked) return;
        const min = Number(minimumGuardCount);
        const recommended = Math.max(Number(recommendedGuardCount), min);
        const towerId = backendMode && selectedTower ? selectedTower.id : defense?.tower.towerId ?? `tower-${towerCode.toLowerCase()}`;
        onSubmit({
          id: defense?.id,
          backendDefenseId: defense?.backendDefenseId,
          eventId: defense?.eventId,
          title,
          description,
          towerId,
          towerName: backendMode && selectedTower ? selectedTower.towerName : towerName,
          towerCode: backendMode && selectedTower ? selectedTower.towerCode : towerCode,
          location: backendMode && selectedTower ? selectedTower.location : { label: location },
          map: backendMode && selectedTower ? selectedTower.map : defense?.tower.map ?? {},
          visual: backendMode && selectedTower ? selectedTower.visual : defense?.tower.visual,
          status: defense?.status ?? 'scheduled',
          priority: defense?.priority ?? 'high',
          scheduledAt: defense?.scheduledAt,
          startsAt: fromLocalInputValue(startsAt),
          timezone: defense?.timezone ?? 'Europe/Kiev',
          wave: defense?.wave ?? 1,
          commanderMemberId: defense?.commanderMemberId ?? currentFamilyMemberId ?? '',
          createdByMemberId: defense?.createdByMemberId ?? currentFamilyMemberId ?? '',
          minimumGuardCount: min,
          recommendedGuardCount: recommended,
          maximumGuardCount: Math.max(recommended, defense?.maximumGuardCount ?? 8),
          xp: defense?.xp ?? 100,
          rewardIds: defense?.rewardIds ?? ['reward_fire_guard_xp'],
          achievementIds: defense?.achievementIds ?? ['ach_guardian']
        });
      }}
    >
      <label>Назва<DragonInput value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
      <label>Вишка<DragonInput value={towerName} onChange={(event) => setTowerName(event.target.value)} required /></label>
      <label>Код<DragonInput value={towerCode} onChange={(event) => setTowerCode(event.target.value)} required /></label>
      <label>Локація<DragonInput value={location} onChange={(event) => setLocation(event.target.value)} required /></label>
      <label>Початок<DragonInput type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required /></label>
      <label>Мінімум вартових<DragonInput type="number" min={1} value={minimumGuardCount} onChange={(event) => setMinimumGuardCount(event.target.value)} required /></label>
      <label>Рекомендовано<DragonInput type="number" min={1} value={recommendedGuardCount} onChange={(event) => setRecommendedGuardCount(event.target.value)} required /></label>
      <label className="dh-tower-form-wide">Опис<DragonTextarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      <DragonButton type="submit">Зберегти захист</DragonButton>
      {backendMode && activeBackendTowers.length === 0 ? <DragonEmptyState title="No active backend towers" description="Backend returned an empty family_towers list." /> : null}
      {backendMode && !currentFamilyMemberId ? <DragonEmptyState title="Authenticated member required" description="Tower Defense writes require a real familyMemberId." /> : null}
      {backendMode && towers.length > 0 ? (
        <label>Вишка
          <DragonSelect value={selectedTowerId} onChange={(event) => setSelectedTowerId(event.target.value)} required>
            {activeBackendTowers.map((tower) => (
              <option key={tower.id} value={tower.id}>{tower.towerCode} / {tower.towerName}</option>
            ))}
          </DragonSelect>
        </label>
      ) : null}
    </form>
  );
}

export function DragonAttendanceEditor({
  defense,
  onAttendance
}: {
  defense: DragonTowerDefense;
  onAttendance: (memberId: string, status: DragonDefenseAttendanceStatus) => void;
}) {
  return (
    <div className="dh-attendance-editor">
      {defense.responses.map((response) => (
        <label key={response.memberId}>
          {response.memberId}
          <DragonSelect
            value={defense.attendance.find((entry) => entry.memberId === response.memberId)?.status ?? 'unconfirmed'}
            onChange={(event) => onAttendance(response.memberId, event.target.value as DragonDefenseAttendanceStatus)}
          >
            {Object.entries(ATTENDANCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </DragonSelect>
        </label>
      ))}
    </div>
  );
}

export function DragonDefenseResultDialog({
  defense,
  currentUser,
  onComplete,
  onClose
}: {
  defense: DragonTowerDefense;
  currentUser?: FamilyUser;
  onComplete: (result: Exclude<DragonDefenseResult, 'pending' | 'cancelled'>, notes: string, failureReason?: string) => void;
  onClose: () => void;
}) {
  const [result, setResult] = useState<Exclude<DragonDefenseResult, 'pending' | 'cancelled'>>('defended');
  const [notes, setNotes] = useState(defense.notes ?? '');
  const [failureReason, setFailureReason] = useState('');

  return (
    <DragonDialog
      title="Завершити захист"
      onClose={onClose}
      actions={
        <>
          <DragonButton type="button" variant="secondary" onClick={onClose}>Закрити</DragonButton>
          <DragonButton type="button" onClick={() => onComplete(result, notes, failureReason || undefined)}>Записати результат</DragonButton>
        </>
      }
    >
      <div className="dh-dialog-stack">
        <p>{defense.tower.towerName}</p>
        {currentUser && defense.backendDefenseId ? (
          <FamilyRewardAllocationPanel
            sourceModule="tower_defense"
            sourceId={defense.backendDefenseId}
            canManage={false}
            closed={false}
            summaryOnly
          />
        ) : null}
        <label>Результат
          <DragonSelect value={result} onChange={(event) => setResult(event.target.value as Exclude<DragonDefenseResult, 'pending' | 'cancelled'>)}>
            <option value="defended">Вишку захищено</option>
            <option value="lost">Вишку втрачено</option>
          </DragonSelect>
        </label>
        <label>Нотатки<DragonTextarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        {result === 'lost' ? <label>Причина втрати<DragonInput value={failureReason} onChange={(event) => setFailureReason(event.target.value)} /></label> : null}
      </div>
    </DragonDialog>
  );
}

function DragonTowerDefenseDialogs({
  dialog,
  defense,
  onClose,
  onCreate,
  onEdit,
  onRespond,
  onAttendance,
  onComplete,
  onCancel,
  towers = [],
  currentFamilyMemberId,
  currentUser,
  backendMode = false,
  mutating = false
}: {
  dialog: TowerDefenseDialog;
  defense: DragonTowerDefense | null;
  onClose: () => void;
  onCreate: (input: DragonTowerDefenseCreateInput) => void;
  onEdit: (defense: DragonTowerDefense, input: DragonTowerDefenseCreateInput) => void;
  onRespond: (defense: DragonTowerDefense, response: DragonGuardResponseStatus, note?: string) => void;
  onAttendance: (defense: DragonTowerDefense, memberId: string, status: DragonDefenseAttendanceStatus) => void;
  onComplete: (defense: DragonTowerDefense, result: Exclude<DragonDefenseResult, 'pending' | 'cancelled'>, notes: string, failureReason?: string) => void;
  onCancel: (defense: DragonTowerDefense, reason?: string) => void;
  towers?: DragonTowerDefinition[];
  currentFamilyMemberId?: string;
  currentUser?: FamilyUser;
  backendMode?: boolean;
  mutating?: boolean;
}) {
  const [response, setResponse] = useState<DragonGuardResponseStatus>('joining');
  const [note, setNote] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  if (dialog === 'create') {
    return (
      <DragonDialog title="Створити захист вишки" onClose={onClose}>
        <DragonDefenseForm onSubmit={onCreate} towers={towers} currentFamilyMemberId={currentFamilyMemberId} backendMode={backendMode} mutating={mutating} />
      </DragonDialog>
    );
  }

  if (!defense) return null;

  if (dialog === 'edit') {
    return (
      <DragonDialog title="Редагувати захист" onClose={onClose}>
        <div className="dh-dialog-stack">
          <DragonDefenseForm defense={defense} onSubmit={(input) => onEdit(defense, input)} towers={towers} currentFamilyMemberId={currentFamilyMemberId} backendMode={backendMode} mutating={mutating} />
          {currentUser && defense.backendDefenseId ? (
            <FamilyRewardAllocationPanel
              sourceModule="tower_defense"
              sourceId={defense.backendDefenseId}
              canManage={canManageTowerRewardAllocations(currentUser, defense)}
              closed={defense.status === 'completed' || defense.status === 'cancelled'}
            />
          ) : null}
        </div>
      </DragonDialog>
    );
  }

  if (dialog === 'details') {
    return (
      <DragonDialog title={defense.title} onClose={onClose}>
        <DragonDefenseDetails defense={defense} readiness={calculateDragonDefenseReadiness(defense)} currentUser={currentUser} onEdit={onClose} onStart={onClose} onComplete={onClose} onCancel={onClose} />
      </DragonDialog>
    );
  }

  if (dialog === 'respond') {
    return (
      <DragonDialog
        title="Відгукнутися на захист"
        onClose={onClose}
        actions={<DragonButton type="button" onClick={() => onRespond(defense, response, note)}>Відгукнутися</DragonButton>}
      >
        <div className="dh-dialog-stack">
          <p>{defense.tower.towerName}</p>
          <label>Відповідь
            <DragonSelect value={response} onChange={(event) => setResponse(event.target.value as DragonGuardResponseStatus)}>
              {Object.entries(RESPONSE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </DragonSelect>
          </label>
          <label>Нотатка<DragonTextarea value={note} onChange={(event) => setNote(event.target.value)} /></label>
        </div>
      </DragonDialog>
    );
  }

  if (dialog === 'attendance') {
    return (
      <DragonDialog title="Підтвердити участь" onClose={onClose}>
        <DragonAttendanceEditor defense={defense} onAttendance={(memberId, status) => onAttendance(defense, memberId, status)} />
      </DragonDialog>
    );
  }

  if (dialog === 'complete') {
    return <DragonDefenseResultDialog defense={defense} currentUser={currentUser} onClose={onClose} onComplete={(result, notes, failureReason) => onComplete(defense, result, notes, failureReason)} />;
  }

  if (dialog === 'cancel') {
    return (
      <DragonDialog
        title="Скасувати захист"
        onClose={onClose}
        actions={<DragonButton type="button" variant="danger" onClick={() => onCancel(defense, cancelReason)}>Скасувати операцію</DragonButton>}
      >
        <label className="dh-dialog-stack">
          Причина
          <DragonTextarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
        </label>
      </DragonDialog>
    );
  }

  return null;
}

function canManageTowerRewardAllocations(user: FamilyUser | null | undefined, defense: DragonTowerDefense): boolean {
  return Boolean(user && (
    user.role === 'owner' ||
    user.rankLevel >= 8 ||
    user.permissions.includes('manage_rewards') ||
    user.permissions.includes('manage_events') ||
    defense.commanderMemberId === user.id
  ));
}

function DragonTowerDefenseLoadingState() {
  return (
    <DragonSection title="Вогняна варта" description="Операційна палата відкривається.">
      <div className="dh-tower-loading">
        <DragonSkeleton />
        <DragonSkeleton />
        <DragonSkeleton />
      </div>
    </DragonSection>
  );
}

function getReadinessProgress(defense: DragonTowerDefense, readiness: DragonDefenseReadiness) {
  if (readiness === 'critical') return 20;
  if (readiness === 'insufficient') return Math.max(35, Math.round((defense.confirmedCount / defense.minimumGuardCount) * 60));
  if (readiness === 'ready') return 75;
  return 100;
}

function toLocalInputValue(value: string) {
  return value.slice(0, 16);
}

function fromLocalInputValue(value: string) {
  return value.length === 16 ? `${value}:00+03:00` : value;
}
