import { useMemo, useState, type FormEvent } from 'react';
import {
  DragonBadge,
  DragonButton,
  DragonCard,
  DragonDialog,
  DragonEmptyState,
  DragonInput,
  DragonLoader,
  DragonPanel,
  DragonProgress,
  DragonRetry,
  DragonSection,
  DragonSelect,
  DragonTextarea
} from '../dragon-ui/dragon-ui';
import type { FamilyUser } from '../../../lib/family-types';
import { canManageDiscordIntegration } from '../../../lib/family-permissions';
import {
  cancelFamilyEventFromBackend,
  completeFamilyEventFromBackend,
  confirmFamilyEventAttendanceFromBackend,
  createFamilyEventFromBackend,
  respondFamilyEventFromBackend,
  startFamilyEventFromBackend,
  updateFamilyEventFromBackend,
  withdrawFamilyEventResponseFromBackend,
  type FamilyEventAttendanceChoice,
  type FamilyEventResponseChoice
} from '../../../lib/family-events-backend-operations';
import type { CreateBackendFamilyEventPayload } from '../../../lib/family-events-backend-client';
import { FamilyEventsApiError } from '../../../lib/family-events-backend-response';
import {
  DRAGON_EVENT_TYPE_META,
  type DragonEvent,
  type DragonEventFilters,
  type DragonEventPriority,
  type DragonEventSortMode,
  type DragonEventStatus,
  type DragonEventType,
  type DragonEventVisibility
} from './dragon-event-models';
import { DEFAULT_DRAGON_EVENT_FILTERS, getDragonEventDateKey, getDragonEventTimeKey } from './dragon-event-service';
import { useDragonEventState, type DragonEventStateDependencies } from './dragon-event-state';
import { FamilyRewardAllocationPanel } from './family-reward-allocation-panel';
import { DiscordPublishPanel } from './discord-publish-panel';

const EVENT_TYPES: Array<DragonEventType | 'all'> = [
  'all',
  'family_meeting',
  'birthday',
  'quest',
  'tower_defense',
  'celebration',
  'training',
  'resource_run',
  'patrol',
  'war',
  'announcement',
  'custom'
];
const EVENT_STATUSES: Array<DragonEventStatus | 'all'> = ['all', 'draft', 'scheduled', 'active', 'completed', 'cancelled'];
const EVENT_PRIORITIES: Array<DragonEventPriority | 'all'> = ['all', 'low', 'normal', 'high', 'critical'];
const EVENT_VISIBILITIES: Array<DragonEventVisibility | 'all'> = ['all', 'public', 'members', 'leadership', 'private', 'hidden'];
const EVENT_SORTS: DragonEventSortMode[] = ['today', 'upcoming', 'active', 'completed', 'priority', 'newest', 'oldest', 'alphabetical'];
const STANDALONE_EVENT_TYPES: DragonEventType[] = ['family_meeting', 'celebration', 'training', 'announcement', 'custom'];
const STANDALONE_EVENT_CATEGORIES = ['meeting', 'training', 'celebration', 'announcement', 'custom'] as const;
const RESPONSE_CHOICES: FamilyEventResponseChoice[] = ['interested', 'joining', 'confirmed', 'declined'];
const ATTENDANCE_CHOICES: FamilyEventAttendanceChoice[] = ['present', 'late', 'absent', 'excused'];
const EVENT_CONFLICT_MESSAGE = 'Цю подію вже змінив інший користувач. Оновіть дані й повторіть зміни.';

const EVENT_STATUS_LABELS: Record<DragonEventStatus, string> = {
  draft: 'Чернетка',
  scheduled: 'Заплановано',
  active: 'Активна',
  completed: 'Завершена',
  cancelled: 'Скасована'
};

const EVENT_PRIORITY_LABELS: Record<DragonEventPriority, string> = {
  low: 'Низький',
  normal: 'Звичайний',
  high: 'Високий',
  critical: 'Критичний'
};

const EVENT_VISIBILITY_LABELS: Record<DragonEventVisibility, string> = {
  public: 'Публічна',
  members: 'Для учасників',
  leadership: 'Для старших',
  private: 'Приватна',
  hidden: 'Прихована'
};

const EVENT_SORT_LABELS: Record<DragonEventSortMode, string> = {
  today: 'Сьогодні',
  upcoming: 'Найближчі',
  active: 'Активні',
  completed: 'Завершені',
  priority: 'За пріоритетом',
  newest: 'Новіші',
  oldest: 'Старіші',
  alphabetical: 'За назвою'
};

const STANDALONE_EVENT_CATEGORY_LABELS: Record<typeof STANDALONE_EVENT_CATEGORIES[number], string> = {
  meeting: 'Зустріч',
  training: 'Тренування',
  celebration: 'Святкування',
  announcement: 'Оголошення',
  custom: 'Інше'
};

const RESPONSE_CHOICE_LABELS: Record<FamilyEventResponseChoice, string> = {
  interested: 'Цікавить',
  joining: 'Буду',
  confirmed: 'Підтверджено',
  declined: 'Не буду'
};

const ATTENDANCE_CHOICE_LABELS: Record<FamilyEventAttendanceChoice, string> = {
  present: 'Був/була',
  late: 'Запізнився/лась',
  absent: 'Не був/була',
  excused: 'Поважна причина'
};

export function DragonEventEngineScreen({ currentUser, dependencies }: { currentUser?: FamilyUser; dependencies?: DragonEventStateDependencies }) {
  const engine = useDragonEventState(dependencies);
  const [detailsEvent, setDetailsEvent] = useState<DragonEvent | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<DragonEvent | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [mutationErrorAction, setMutationErrorAction] = useState<(() => void) | null>(null);
  const [mutatingKey, setMutatingKey] = useState<string | null>(null);
  const canCreate = currentUser ? canManageFamilyEvents(currentUser) : false;

  const runMutation = async (key: string, action: () => Promise<DragonEvent | void>) => {
    if (mutatingKey) return;
    setMutatingKey(key);
    setMutationError(null);
    setMutationErrorAction(null);
    try {
      const updated = await action();
      if (updated) setDetailsEvent(updated);
      engine.refresh();
      if (!updated && key !== 'create') setDetailsEvent(null);
      if (updated && editEvent?.id === updated.id) setEditEvent(null);
      if (key === 'create') setCreateOpen(false);
    } catch (error) {
      if (error instanceof FamilyEventsApiError && error.status === 409) {
        setMutationError(EVENT_CONFLICT_MESSAGE);
        setMutationErrorAction(() => () => {
          setEditEvent(null);
          setDetailsEvent(null);
          engine.refresh();
        });
        return;
      }
      setMutationError(error instanceof Error ? error.message : 'Не вдалося виконати дію з подією.');
    } finally {
      setMutatingKey(null);
    }
  };

  return (
    <div className="dh-event-engine" data-dragon-event-engine="frontend">
      <DragonPanel variant="ceremonial" className="dh-event-engine-hero">
        <div>
          <p className="dh-dragon-eyebrow">Події</p>
          <h1>Хроніка сімейних подій</h1>
          <p>Зустрічі, дні народження, квести, святкування, вишки та синхронізація з Discord.</p>
        </div>
        <div className="flex flex-col gap-2">
          <DragonEventStatistics statistics={engine.statistics} />
          {canCreate ? (
            <DragonButton type="button" onClick={() => setCreateOpen(true)}>
              Створити подію
            </DragonButton>
          ) : null}
        </div>
      </DragonPanel>

      {engine.loading ? <DragonEventLoadingState /> : null}
      {engine.error ? <DragonEventErrorState message={engine.error.message} onRetry={engine.refresh} /> : null}

      <DragonEventFilters filters={engine.filters} sortMode={engine.sortMode} onChange={engine.setFilters} onSortChange={engine.setSortMode} />

      <div className="dh-event-command-grid">
        <DragonTodayEvents events={engine.todayEvents} onSelect={setDetailsEvent} />
        <DragonUpcomingEvents events={engine.upcomingEvents} onSelect={setDetailsEvent} />
      </div>

      <DragonEventGallery events={engine.visibleEvents} onSelect={setDetailsEvent} />

      <DragonSection eyebrow="Хроніка" title="Історія активності">
        <DragonEventTimeline events={engine.visibleEvents} onSelect={setDetailsEvent} />
      </DragonSection>

      {createOpen && currentUser ? (
        <DragonEventFormDialog
          title="Створити сімейну подію"
          currentUser={currentUser}
          mutating={mutatingKey === 'create'}
          error={mutationError}
          errorAction={mutationErrorAction}
          onClose={() => setCreateOpen(false)}
          onSubmit={(payload) => runMutation('create', () => createFamilyEventFromBackend(payload))}
        />
      ) : null}

      {editEvent && currentUser ? (
        <DragonEventFormDialog
          title="Редагувати сімейну подію"
          currentUser={currentUser}
          event={editEvent}
          mutating={mutatingKey === `edit:${editEvent.id}`}
          error={mutationError}
          errorAction={mutationErrorAction}
          onClose={() => setEditEvent(null)}
          onSubmit={(payload) => runMutation(`edit:${editEvent.id}`, () => updateFamilyEventFromBackend(editEvent, payload))}
        />
      ) : null}

      {detailsEvent ? (
        <DragonEventDetails
          event={detailsEvent}
          currentUser={currentUser}
          mutatingKey={mutatingKey}
          error={mutationError}
          errorAction={mutationErrorAction}
          onClose={() => setDetailsEvent(null)}
          onEdit={(event) => {
            setDetailsEvent(null);
            setEditEvent(event);
          }}
          onRespond={(choice) => currentUser ? runMutation(`respond:${detailsEvent.id}:${choice}`, () => respondFamilyEventFromBackend(detailsEvent, currentUser.id, choice)) : undefined}
          onWithdraw={() => runMutation(`withdraw:${detailsEvent.id}`, () => withdrawFamilyEventResponseFromBackend(detailsEvent))}
          onAttendance={(memberId, status) => runMutation(`attendance:${detailsEvent.id}:${memberId}:${status}`, () => confirmFamilyEventAttendanceFromBackend(detailsEvent, memberId, status))}
          onStart={() => runMutation(`start:${detailsEvent.id}`, () => startFamilyEventFromBackend(detailsEvent))}
          onComplete={() => runMutation(`complete:${detailsEvent.id}`, () => completeFamilyEventFromBackend(detailsEvent))}
          onCancel={(reason) => runMutation(`cancel:${detailsEvent.id}`, () => cancelFamilyEventFromBackend(detailsEvent, reason))}
        />
      ) : null}
    </div>
  );
}

export function DragonEventGallery({ events, onSelect }: { events: DragonEvent[]; onSelect?: (event: DragonEvent) => void }) {
  if (!events.length) {
    return <DragonEventEmptyState />;
  }

  return (
    <section className="dh-event-gallery" aria-label="Dragon Event Gallery">
      {events.map((event) => (
        <DragonEventCard key={event.id} event={event} onSelect={onSelect} />
      ))}
    </section>
  );
}

export function DragonEventCard({ event, onSelect }: { event: DragonEvent; onSelect?: (event: DragonEvent) => void }) {
  const meta = DRAGON_EVENT_TYPE_META[event.type];
  const capacity = event.maxParticipants ? Math.round((event.participantCount / event.maxParticipants) * 100) : Math.min(event.participantCount * 20, 100);

  return (
    <DragonCard interactive className={`dh-event-card ${meta.className} is-${event.status}`} data-testid="event-card" data-event-id={event.backendEventId ?? event.id}>
      <button type="button" data-testid="event-card-open" className="dh-event-card-open" onClick={() => onSelect?.(event)} aria-label={`Відкрити подію ${event.title}`}>
        <span className="dh-event-card-glyph" aria-hidden="true">
          {meta.glyph}
        </span>
        <span>
          <strong>{event.title}</strong>
          <small>{event.description}</small>
        </span>
      </button>
      <div className="dh-event-card-meta">
        <DragonBadge tone={meta.tone}>{meta.label}</DragonBadge>
        <DragonBadge tone={event.priority === 'critical' ? 'danger' : event.priority === 'high' ? 'ember' : 'muted'}>{EVENT_PRIORITY_LABELS[event.priority]}</DragonBadge>
        <DragonBadge tone={event.status === 'completed' ? 'success' : event.status === 'active' ? 'gold' : 'muted'}>{EVENT_STATUS_LABELS[event.status]}</DragonBadge>
      </div>
      <dl>
        <div>
          <dt>Дата</dt>
          <dd>{getDragonEventDateKey(event)}</dd>
        </div>
        <div>
          <dt>Локація</dt>
          <dd>{event.location.label}</dd>
        </div>
        <div>
          <dt>XP</dt>
          <dd>{event.xp}</dd>
        </div>
      </dl>
      <DragonProgress value={capacity} label={`Участь у події ${event.title}`} />
    </DragonCard>
  );
}

export function DragonEventDetails({
  event,
  currentUser,
  mutatingKey,
  error,
  errorAction,
  onClose,
  onEdit,
  onRespond,
  onWithdraw,
  onAttendance,
  onStart,
  onComplete,
  onCancel
}: {
  event: DragonEvent;
  currentUser?: FamilyUser;
  mutatingKey?: string | null;
  error?: string | null;
  errorAction?: (() => void) | null;
  onClose: () => void;
  onEdit?: (event: DragonEvent) => void;
  onRespond?: (choice: FamilyEventResponseChoice) => void;
  onWithdraw?: () => void;
  onAttendance?: (memberId: string, status: FamilyEventAttendanceChoice) => void;
  onStart?: () => void;
  onComplete?: () => void;
  onCancel?: (reason?: string | null) => void;
}) {
  const meta = DRAGON_EVENT_TYPE_META[event.type];
  const [cancelReason, setCancelReason] = useState('');
  const [confirmingComplete, setConfirmingComplete] = useState(false);
  const isStandalone = event.source.sourceModule === 'events';
  const closed = event.status === 'completed' || event.status === 'cancelled';
  const canManage = Boolean(currentUser && isStandalone && canManageEvent(currentUser, event));
  const canManageDiscord = Boolean(currentUser && isStandalone && event.backendEventId && canManageDiscordIntegration(currentUser));
  const currentResponse = currentUser ? event.participants.find((participant) => participant.backendMemberId === currentUser.id || participant.id === currentUser.id)?.role : null;

  return (
    <DragonDialog title={event.title} onClose={onClose}>
      <div className={`dh-event-details ${meta.className}`}>
        <div className="dh-event-details-seal" aria-hidden="true">
          {meta.glyph}
        </div>
        <div className="dh-event-details-main">
          <DragonBadge tone={meta.tone}>{meta.label}</DragonBadge>
          <DragonBadge tone="muted">{sourceLabel(event)}</DragonBadge>
          <p>{event.description}</p>
          <dl>
            <div>
              <dt>Початок</dt>
              <dd>{event.startsAt}</dd>
            </div>
            <div>
              <dt>Завершення</dt>
              <dd>{event.endsAt ?? 'Без кінцевого часу'}</dd>
            </div>
            <div>
              <dt>Організатор</dt>
              <dd>{event.owner.name}</dd>
            </div>
            <div>
              <dt>Учасники</dt>
              <dd>{event.participants.map((participant) => participant.name).join(', ')}</dd>
            </div>
          </dl>
        </div>
        {isStandalone ? (
          <DragonCard className="dh-event-details-actions">
            <span className="dh-dragon-eyebrow">Дії</span>
            {error ? <p role="alert" data-testid="event-conflict-message">{error}</p> : null}
            {errorAction ? (
              <DragonButton type="button" variant="secondary" data-testid="event-conflict-refresh" onClick={errorAction}>
                Оновити дані
              </DragonButton>
            ) : null}
            {currentUser ? (
              <div className="flex flex-wrap gap-2">
                {RESPONSE_CHOICES.map((choice) => (
                  <DragonButton
                    key={choice}
                    type="button"
                    variant={currentResponse === choice ? 'secondary' : 'ghost'}
                    disabled={Boolean(mutatingKey) || closed}
                    onClick={() => onRespond?.(choice)}
                  >
                    {RESPONSE_CHOICE_LABELS[choice]}
                  </DragonButton>
                ))}
                <DragonButton type="button" variant="ghost" disabled={Boolean(mutatingKey) || closed || !currentResponse} onClick={onWithdraw}>
                  Скасувати участь
                </DragonButton>
              </div>
            ) : null}
            {canManage ? (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {!closed ? (
                    <DragonButton type="button" variant="secondary" data-testid="event-edit" disabled={Boolean(mutatingKey)} onClick={() => onEdit?.(event)}>
                      Редагувати
                    </DragonButton>
                  ) : null}
                  {event.status === 'scheduled' ? (
                    <DragonButton type="button" disabled={Boolean(mutatingKey)} onClick={onStart}>
                      Почати
                    </DragonButton>
                  ) : null}
                  {event.status === 'active' ? (
                    <DragonButton type="button" disabled={Boolean(mutatingKey)} onClick={() => setConfirmingComplete(true)}>
                      Завершити
                    </DragonButton>
                  ) : null}
                  {!closed ? (
                    <DragonButton type="button" variant="danger" disabled={Boolean(mutatingKey)} onClick={() => onCancel?.(cancelReason || null)}>
                      Скасувати
                    </DragonButton>
                  ) : null}
                </div>
                {confirmingComplete && event.backendEventId ? (
                  <div className="space-y-3" data-event-completion-reward-summary="backend">
                    <span className="dh-dragon-eyebrow">Підсумок винагород</span>
                    <FamilyRewardAllocationPanel
                      sourceModule="events"
                      sourceId={event.backendEventId}
                      canManage={false}
                      closed={false}
                      summaryOnly
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <DragonButton type="button" variant="ghost" disabled={Boolean(mutatingKey)} onClick={() => setConfirmingComplete(false)}>
                        Продовжити редагування
                      </DragonButton>
                      <DragonButton type="button" disabled={Boolean(mutatingKey)} onClick={onComplete}>
                        Підтвердити завершення
                      </DragonButton>
                    </div>
                  </div>
                ) : null}
                {!closed ? <DragonInput value={cancelReason} onChange={(input) => setCancelReason(input.currentTarget.value)} placeholder="Причина скасування" aria-label="Причина скасування" /> : null}
                <div className="dh-event-attendance-grid">
                  {event.participants.length ? event.participants.map((participant) => (
                    <div key={participant.backendMemberId ?? participant.id}>
                      <strong>{participant.name}</strong>
                      <div className="flex flex-wrap gap-2">
                        {ATTENDANCE_CHOICES.map((choice) => (
                          <DragonButton
                            key={choice}
                            type="button"
                            variant="ghost"
                            disabled={Boolean(mutatingKey) || closed}
                            onClick={() => onAttendance?.(participant.backendMemberId ?? participant.id, choice)}
                          >
                            {ATTENDANCE_CHOICE_LABELS[choice]}
                          </DragonButton>
                        ))}
                      </div>
                    </div>
                  )) : <p>Відповідей поки немає.</p>}
                </div>
              </div>
            ) : null}
            {canManageDiscord ? <DiscordPublishPanel target="event" sourceId={event.backendEventId} /> : null}
          </DragonCard>
        ) : null}
        <div className="dh-event-details-grid">
          {isStandalone && currentUser && event.backendEventId ? (
            <FamilyRewardAllocationPanel
              sourceModule="events"
              sourceId={event.backendEventId}
              canManage={canManage}
              closed={closed}
            />
          ) : null}
          <DragonCard>
            <span className="dh-dragon-eyebrow">Досягнення</span>
            <strong>{event.achievementIds.length}</strong>
            <p>{event.achievementIds.join(', ') || 'Досягнення для цієї події не привʼязані.'}</p>
          </DragonCard>
          <DragonCard>
            <span className="dh-dragon-eyebrow">Винагороди</span>
            <strong>{event.rewards.length}</strong>
            <p>{event.rewards.map((reward) => reward.label).join(', ') || 'Винагороди для цієї події не налаштовані.'}</p>
          </DragonCard>
          <DragonCard>
            <span className="dh-dragon-eyebrow">Оборона вишок</span>
            <strong>{event.towerDefense?.result ?? 'Готово до звʼязку'}</strong>
            <p>{event.towerDefense?.defenseId ?? 'Дані оборони для цієї події не привʼязані.'}</p>
          </DragonCard>
          <DragonCard>
            <span className="dh-dragon-eyebrow">Discord</span>
            <strong>{event.discord?.channelId ?? 'Не синхронізовано'}</strong>
            <p>{event.discord?.guildId ?? 'Discord-метадані для цієї події не привʼязані.'}</p>
          </DragonCard>
        </div>
      </div>
    </DragonDialog>
  );
}

export function DragonEventFilters({
  filters,
  sortMode,
  onChange,
  onSortChange
}: {
  filters: DragonEventFilters;
  sortMode: DragonEventSortMode;
  onChange: (filters: DragonEventFilters) => void;
  onSortChange: (sort: DragonEventSortMode) => void;
}) {
  const update = (patch: Partial<DragonEventFilters>) => onChange({ ...filters, ...patch });

  return (
    <DragonPanel className="dh-event-filters">
      <DragonInput
        type="search"
        value={filters.search}
        onChange={(event) => update({ search: event.currentTarget.value })}
        placeholder="Пошук подій"
        aria-label="Пошук подій Dragon House"
      />
      <DragonSelect value={filters.type} onChange={(event) => update({ type: event.currentTarget.value as DragonEventFilters['type'] })} aria-label="Фільтр подій за типом">
        {EVENT_TYPES.map((type) => (
          <option key={type} value={type}>
            {type === 'all' ? 'Усі типи' : DRAGON_EVENT_TYPE_META[type].label}
          </option>
        ))}
      </DragonSelect>
      <DragonSelect value={filters.status} onChange={(event) => update({ status: event.currentTarget.value as DragonEventFilters['status'] })} aria-label="Фільтр подій за статусом">
        {EVENT_STATUSES.map((status) => (
          <option key={status} value={status}>
            {status === 'all' ? 'Усі статуси' : EVENT_STATUS_LABELS[status]}
          </option>
        ))}
      </DragonSelect>
      <DragonSelect value={filters.priority} onChange={(event) => update({ priority: event.currentTarget.value as DragonEventFilters['priority'] })} aria-label="Фільтр подій за пріоритетом">
        {EVENT_PRIORITIES.map((priority) => (
          <option key={priority} value={priority}>
            {priority === 'all' ? 'Усі пріоритети' : EVENT_PRIORITY_LABELS[priority]}
          </option>
        ))}
      </DragonSelect>
      <DragonSelect value={filters.visibility} onChange={(event) => update({ visibility: event.currentTarget.value as DragonEventFilters['visibility'] })} aria-label="Фільтр подій за видимістю">
        {EVENT_VISIBILITIES.map((visibility) => (
          <option key={visibility} value={visibility}>
            {visibility === 'all' ? 'Уся видимість' : EVENT_VISIBILITY_LABELS[visibility]}
          </option>
        ))}
      </DragonSelect>
      <DragonInput type="date" value={filters.dateFrom} onChange={(event) => update({ dateFrom: event.currentTarget.value })} aria-label="Дата подій від" />
      <DragonInput type="date" value={filters.dateTo} onChange={(event) => update({ dateTo: event.currentTarget.value })} aria-label="Дата подій до" />
      <DragonSelect value={sortMode} onChange={(event) => onSortChange(event.currentTarget.value as DragonEventSortMode)} aria-label="Сортування подій">
        {EVENT_SORTS.map((sort) => (
          <option key={sort} value={sort}>
            {EVENT_SORT_LABELS[sort]}
          </option>
        ))}
      </DragonSelect>
      <DragonButton type="button" variant="ghost" onClick={() => onChange(DEFAULT_DRAGON_EVENT_FILTERS)}>
        Очистити
      </DragonButton>
    </DragonPanel>
  );
}

export function DragonEventTimeline({ events, onSelect }: { events: DragonEvent[]; onSelect?: (event: DragonEvent) => void }) {
  const timelineEvents = useMemo(() => [...events].sort((left, right) => right.startsAt.localeCompare(left.startsAt)).slice(0, 10), [events]);

  return (
    <div className="dh-event-timeline">
      {timelineEvents.map((event) => {
        const meta = DRAGON_EVENT_TYPE_META[event.type];
        return (
          <button key={event.id} type="button" className={`dh-event-timeline-item ${meta.className}`} onClick={() => onSelect?.(event)}>
            <span>{getDragonEventDateKey(event)}</span>
            <strong>{event.title}</strong>
            <small>{event.source.sourceModule}</small>
          </button>
        );
      })}
    </div>
  );
}

export function DragonUpcomingEvents({ events, onSelect }: { events: DragonEvent[]; onSelect?: (event: DragonEvent) => void }) {
  return (
    <DragonSection eyebrow="Найближчі" title="Заплановані події">
      <div className="dh-event-mini-list">
        {events.length ? (
          events.map((event) => <DragonEventMiniCard key={event.id} event={event} onSelect={onSelect} />)
        ) : (
          <DragonEmptyState title="Найближчих подій немає" description="Коли зʼявиться нова сімейна активність, вона буде тут." />
        )}
      </div>
    </DragonSection>
  );
}

export function DragonTodayEvents({ events, onSelect }: { events: DragonEvent[]; onSelect?: (event: DragonEvent) => void }) {
  return (
    <DragonSection eyebrow="Сьогодні" title="Активність на сьогодні">
      <div className="dh-event-mini-list">
        {events.length ? (
          events.map((event) => <DragonEventMiniCard key={event.id} event={event} onSelect={onSelect} />)
        ) : (
          <DragonEmptyState title="На сьогодні подій немає" description="На цей день активність Dragon House не запланована." />
        )}
      </div>
    </DragonSection>
  );
}

export function DragonEventStatistics({ statistics }: { statistics: ReturnType<typeof useDragonEventState>['statistics'] }) {
  return (
    <div className="dh-event-statistics" aria-label="Статистика подій Dragon House">
      <div>
        <span className="dh-dragon-eyebrow">Усього</span>
        <strong>{statistics.total}</strong>
      </div>
      <div>
        <span className="dh-dragon-eyebrow">Сьогодні</span>
        <strong>{statistics.today}</strong>
      </div>
      <div>
        <span className="dh-dragon-eyebrow">Заплановано</span>
        <strong>{statistics.upcoming}</strong>
      </div>
      <DragonProgress value={Math.min(statistics.totalXp, 100)} label="Бал подій" />
    </div>
  );
}

export function DragonEventEmptyState() {
  return <DragonEmptyState title="Подій поки немає" description="Зміни фільтри або дочекайся наступної активності Dragon House." />;
}

export function DragonEventLoadingState() {
  return <DragonLoader label="Завантажуємо події..." />;
}

export function DragonEventErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <DragonRetry title="Не вдалося завантажити події" description={message} onRetry={onRetry} />;
}

function DragonEventMiniCard({ event, onSelect }: { event: DragonEvent; onSelect?: (event: DragonEvent) => void }) {
  const meta = DRAGON_EVENT_TYPE_META[event.type];
  const time = event.allDay ? 'Увесь день' : getDragonEventTimeKey(event.startsAt) ?? 'Час уточнюється';

  return (
    <DragonCard interactive className={`dh-event-mini-card ${meta.className}`}>
      <button type="button" onClick={() => onSelect?.(event)}>
        <DragonBadge tone={meta.tone}>{meta.label}</DragonBadge>
        <strong>{event.title}</strong>
        <span>
          {getDragonEventDateKey(event)}, {time}
        </span>
      </button>
    </DragonCard>
  );
}

type DragonEventFormState = {
  title: string;
  description: string;
  eventType: DragonEventType;
  category: typeof STANDALONE_EVENT_CATEGORIES[number];
  startsAt: string;
  endsAt: string;
  timezone: string;
  allDay: boolean;
  locationLabel: string;
  organizerFamilyMemberId: string;
  maxParticipants: string;
  visibility: DragonEventVisibility;
  notes: string;
};

function DragonEventFormDialog({
  title,
  currentUser,
  event,
  mutating,
  error,
  errorAction,
  onClose,
  onSubmit
}: {
  title: string;
  currentUser: FamilyUser;
  event?: DragonEvent;
  mutating: boolean;
  error: string | null;
  errorAction?: (() => void) | null;
  onClose: () => void;
  onSubmit: (payload: CreateBackendFamilyEventPayload) => void;
}) {
  const [form, setForm] = useState<DragonEventFormState>(() => ({
    title: event?.title ?? '',
    description: event?.description ?? '',
    eventType: event?.type && STANDALONE_EVENT_TYPES.includes(event.type) ? event.type : 'custom',
    category: event?.category === 'meeting' || event?.category === 'training' || event?.category === 'celebration' || event?.category === 'announcement' ? event.category : 'custom',
    startsAt: toDateTimeLocal(event?.startsAt) || '',
    endsAt: toDateTimeLocal(event?.endsAt ?? null) || '',
    timezone: event?.timezone ?? 'Europe/Kyiv',
    allDay: event?.allDay ?? false,
    locationLabel: event?.location.kind === 'none' ? '' : event?.location.label ?? '',
    organizerFamilyMemberId: event?.owner.backendMemberId ?? currentUser.id,
    maxParticipants: event?.maxParticipants ? String(event.maxParticipants) : '',
    visibility: event?.visibility ?? 'members',
    notes: typeof event?.futureMetadata.completionMetadata?.notes === 'string' ? event.futureMetadata.completionMetadata.notes : ''
  }));
  const update = (patch: Partial<DragonEventFormState>) => setForm((current) => ({ ...current, ...patch }));

  const submit = (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    if (!form.title.trim() || !form.startsAt) return;
    onSubmit({
      title: form.title.trim(),
      description: form.description,
      eventType: form.eventType,
      category: form.category,
      startsAt: fromDateTimeLocal(form.startsAt),
      endsAt: form.endsAt ? fromDateTimeLocal(form.endsAt) : null,
      timezone: form.timezone || 'Europe/Kyiv',
      allDay: form.allDay,
      locationLabel: form.locationLabel || null,
      organizerFamilyMemberId: form.organizerFamilyMemberId || currentUser.id,
      maxParticipants: form.maxParticipants ? Number(form.maxParticipants) : null,
      visibility: form.visibility,
      notes: form.notes || null
    });
  };

  return (
    <DragonDialog title={title} onClose={onClose}>
      <form className="dh-event-form space-y-3" onSubmit={submit}>
        {error ? <p role="alert" data-testid="event-conflict-message">{error}</p> : null}
        {errorAction ? (
          <DragonButton type="button" variant="secondary" data-testid="event-conflict-refresh" onClick={errorAction}>
            Оновити дані
          </DragonButton>
        ) : null}
        <DragonInput data-testid="event-form-title" value={form.title} onChange={(input) => update({ title: input.currentTarget.value })} placeholder="Назва події" aria-label="Назва події" required />
        <DragonTextarea data-testid="event-form-description" value={form.description} onChange={(input) => update({ description: input.currentTarget.value })} placeholder="Опис події" aria-label="Опис події" />
        <div className="grid gap-3 md:grid-cols-2">
          <DragonSelect value={form.eventType} onChange={(input) => update({ eventType: input.currentTarget.value as DragonEventType })} aria-label="Тип події">
            {STANDALONE_EVENT_TYPES.map((type) => (
              <option key={type} value={type}>{DRAGON_EVENT_TYPE_META[type].label}</option>
            ))}
          </DragonSelect>
          <DragonSelect value={form.category} onChange={(input) => update({ category: input.currentTarget.value as DragonEventFormState['category'] })} aria-label="Категорія події">
            {STANDALONE_EVENT_CATEGORIES.map((category) => (
              <option key={category} value={category}>{STANDALONE_EVENT_CATEGORY_LABELS[category]}</option>
            ))}
          </DragonSelect>
          <DragonInput type="datetime-local" value={form.startsAt} onChange={(input) => update({ startsAt: input.currentTarget.value })} aria-label="Початок події" required />
          <DragonInput type="datetime-local" value={form.endsAt} onChange={(input) => update({ endsAt: input.currentTarget.value })} aria-label="Завершення події" />
          <DragonInput value={form.timezone} onChange={(input) => update({ timezone: input.currentTarget.value })} placeholder="Europe/Kyiv" aria-label="Часовий пояс" />
          <DragonInput value={form.locationLabel} onChange={(input) => update({ locationLabel: input.currentTarget.value })} placeholder="Локація" aria-label="Локація" />
          <DragonInput value={form.organizerFamilyMemberId} onChange={(input) => update({ organizerFamilyMemberId: input.currentTarget.value })} aria-label="ID організатора в сімʼї" />
          <DragonInput type="number" min="1" value={form.maxParticipants} onChange={(input) => update({ maxParticipants: input.currentTarget.value })} placeholder="Максимум учасників" aria-label="Максимум учасників" />
          <DragonSelect value={form.visibility} onChange={(input) => update({ visibility: input.currentTarget.value as DragonEventVisibility })} aria-label="Видимість події">
            {EVENT_VISIBILITIES.filter((visibility) => visibility !== 'all').map((visibility) => (
              <option key={visibility} value={visibility}>{EVENT_VISIBILITY_LABELS[visibility]}</option>
            ))}
          </DragonSelect>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.allDay} onChange={(input) => update({ allDay: input.currentTarget.checked })} />
            Увесь день
          </label>
        </div>
        <DragonTextarea value={form.notes} onChange={(input) => update({ notes: input.currentTarget.value })} placeholder="Нотатки" aria-label="Нотатки події" />
        <div className="flex flex-wrap justify-end gap-2">
          <DragonButton type="button" variant="ghost" onClick={onClose} disabled={mutating}>Закрити</DragonButton>
          <DragonButton type="submit" data-testid="event-form-save" disabled={mutating || !form.title.trim() || !form.startsAt}>{mutating ? 'Зберігаємо...' : 'Зберегти'}</DragonButton>
        </div>
      </form>
      {event?.backendEventId ? (
        <div className="mt-4">
          <FamilyRewardAllocationPanel
            sourceModule="events"
            sourceId={event.backendEventId}
            canManage={canManageEvent(currentUser, event)}
            closed={event.status === 'completed' || event.status === 'cancelled'}
          />
        </div>
      ) : null}
    </DragonDialog>
  );
}

function canManageFamilyEvents(user: FamilyUser): boolean {
  return user.role === 'owner' || user.rankLevel >= 8 || user.permissions.includes('manage_events');
}

function canManageEvent(user: FamilyUser, event: DragonEvent): boolean {
  return canManageFamilyEvents(user) || event.owner.backendMemberId === user.id || event.owner.id === user.id;
}

function sourceLabel(event: DragonEvent): string {
  if (event.source.sourceModule === 'tower_defense') return 'Оборона вишок';
  if (event.source.sourceModule === 'quest_board') return 'Сімейний квест';
  if (event.source.sourceModule === 'birthday') return 'День народження';
  return 'Сімейна подія';
}

function toDateTimeLocal(value?: string | null): string {
  return value ? value.slice(0, 16) : '';
}

function fromDateTimeLocal(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}
