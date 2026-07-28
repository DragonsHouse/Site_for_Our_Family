import { useMemo, useState } from 'react';
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
  DragonSelect
} from '../dragon-ui/dragon-ui';
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

export function DragonEventEngineScreen({ dependencies }: { dependencies?: DragonEventStateDependencies }) {
  const engine = useDragonEventState(dependencies);
  const [detailsEvent, setDetailsEvent] = useState<DragonEvent | null>(null);

  return (
    <div className="dh-event-engine" data-dragon-event-engine="frontend">
      <DragonPanel variant="ceremonial" className="dh-event-engine-hero">
        <div>
          <p className="dh-dragon-eyebrow">DRAGON EVENT ENGINE</p>
          <h1>Every family action becomes a chronicle.</h1>
          <p>Backend-ready activity architecture for meetings, birthdays, quests, celebrations, future Tower Defense and Discord sync.</p>
        </div>
        <DragonEventStatistics statistics={engine.statistics} />
      </DragonPanel>

      {engine.loading ? <DragonEventLoadingState /> : null}
      {engine.error ? <DragonEventErrorState message={engine.error.message} onRetry={engine.refresh} /> : null}

      <DragonEventFilters filters={engine.filters} sortMode={engine.sortMode} onChange={engine.setFilters} onSortChange={engine.setSortMode} />

      <div className="dh-event-command-grid">
        <DragonTodayEvents events={engine.todayEvents} onSelect={setDetailsEvent} />
        <DragonUpcomingEvents events={engine.upcomingEvents} onSelect={setDetailsEvent} />
      </div>

      <DragonEventGallery events={engine.visibleEvents} onSelect={setDetailsEvent} />

      <DragonSection eyebrow="EVENT TIMELINE" title="Living activity chronicle">
        <DragonEventTimeline events={engine.visibleEvents} onSelect={setDetailsEvent} />
      </DragonSection>

      {detailsEvent ? <DragonEventDetails event={detailsEvent} onClose={() => setDetailsEvent(null)} /> : null}
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
    <DragonCard interactive className={`dh-event-card ${meta.className} is-${event.status}`}>
      <button type="button" className="dh-event-card-open" onClick={() => onSelect?.(event)} aria-label={`Open event ${event.title}`}>
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
        <DragonBadge tone={event.priority === 'critical' ? 'danger' : event.priority === 'high' ? 'ember' : 'muted'}>{event.priority}</DragonBadge>
        <DragonBadge tone={event.status === 'completed' ? 'success' : event.status === 'active' ? 'gold' : 'muted'}>{event.status}</DragonBadge>
      </div>
      <dl>
        <div>
          <dt>Date</dt>
          <dd>{getDragonEventDateKey(event)}</dd>
        </div>
        <div>
          <dt>Hall</dt>
          <dd>{event.location.label}</dd>
        </div>
        <div>
          <dt>XP</dt>
          <dd>{event.xp}</dd>
        </div>
      </dl>
      <DragonProgress value={capacity} label={`${event.title} participation`} />
    </DragonCard>
  );
}

export function DragonEventDetails({ event, onClose }: { event: DragonEvent; onClose: () => void }) {
  const meta = DRAGON_EVENT_TYPE_META[event.type];

  return (
    <DragonDialog title={event.title} onClose={onClose}>
      <div className={`dh-event-details ${meta.className}`}>
        <div className="dh-event-details-seal" aria-hidden="true">
          {meta.glyph}
        </div>
        <div className="dh-event-details-main">
          <DragonBadge tone={meta.tone}>{meta.label}</DragonBadge>
          <DragonBadge tone="muted">{event.backendEventId}</DragonBadge>
          <p>{event.description}</p>
          <dl>
            <div>
              <dt>Starts</dt>
              <dd>{event.startsAt}</dd>
            </div>
            <div>
              <dt>Ends</dt>
              <dd>{event.endsAt ?? 'Open ended'}</dd>
            </div>
            <div>
              <dt>Owner</dt>
              <dd>{event.owner.name}</dd>
            </div>
            <div>
              <dt>Participants</dt>
              <dd>{event.participants.map((participant) => participant.name).join(', ')}</dd>
            </div>
          </dl>
        </div>
        <div className="dh-event-details-grid">
          <DragonCard>
            <span className="dh-dragon-eyebrow">Achievements</span>
            <strong>{event.achievementIds.length}</strong>
            <p>{event.achievementIds.join(', ') || 'Reserved integration point'}</p>
          </DragonCard>
          <DragonCard>
            <span className="dh-dragon-eyebrow">Rewards</span>
            <strong>{event.rewards.length}</strong>
            <p>{event.rewards.map((reward) => reward.label).join(', ') || 'Reward logic not executed here'}</p>
          </DragonCard>
          <DragonCard>
            <span className="dh-dragon-eyebrow">Tower Defense</span>
            <strong>{event.towerDefense?.result ?? 'extension ready'}</strong>
            <p>{event.towerDefense?.defenseId ?? 'Defense metadata slot is available without hardcoded logic.'}</p>
          </DragonCard>
          <DragonCard>
            <span className="dh-dragon-eyebrow">Discord</span>
            <strong>{event.discord?.channelId ?? 'not synced'}</strong>
            <p>{event.discord?.guildId ?? 'Discord metadata placeholder'}</p>
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
        placeholder="Search events"
        aria-label="Search Dragon Events"
      />
      <DragonSelect value={filters.type} onChange={(event) => update({ type: event.currentTarget.value as DragonEventFilters['type'] })} aria-label="Filter events by type">
        {EVENT_TYPES.map((type) => (
          <option key={type} value={type}>
            {type === 'all' ? 'All types' : DRAGON_EVENT_TYPE_META[type].label}
          </option>
        ))}
      </DragonSelect>
      <DragonSelect value={filters.status} onChange={(event) => update({ status: event.currentTarget.value as DragonEventFilters['status'] })} aria-label="Filter events by status">
        {EVENT_STATUSES.map((status) => (
          <option key={status} value={status}>
            {status === 'all' ? 'All statuses' : status}
          </option>
        ))}
      </DragonSelect>
      <DragonSelect value={filters.priority} onChange={(event) => update({ priority: event.currentTarget.value as DragonEventFilters['priority'] })} aria-label="Filter events by priority">
        {EVENT_PRIORITIES.map((priority) => (
          <option key={priority} value={priority}>
            {priority === 'all' ? 'All priorities' : priority}
          </option>
        ))}
      </DragonSelect>
      <DragonSelect value={filters.visibility} onChange={(event) => update({ visibility: event.currentTarget.value as DragonEventFilters['visibility'] })} aria-label="Filter events by visibility">
        {EVENT_VISIBILITIES.map((visibility) => (
          <option key={visibility} value={visibility}>
            {visibility === 'all' ? 'All visibility' : visibility}
          </option>
        ))}
      </DragonSelect>
      <DragonInput type="date" value={filters.dateFrom} onChange={(event) => update({ dateFrom: event.currentTarget.value })} aria-label="Dragon Event date from" />
      <DragonInput type="date" value={filters.dateTo} onChange={(event) => update({ dateTo: event.currentTarget.value })} aria-label="Dragon Event date to" />
      <DragonSelect value={sortMode} onChange={(event) => onSortChange(event.currentTarget.value as DragonEventSortMode)} aria-label="Sort Dragon Events">
        {EVENT_SORTS.map((sort) => (
          <option key={sort} value={sort}>
            {sort}
          </option>
        ))}
      </DragonSelect>
      <DragonButton type="button" variant="ghost" onClick={() => onChange(DEFAULT_DRAGON_EVENT_FILTERS)}>
        Clear
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
    <DragonSection eyebrow="UPCOMING" title="Next burning seals">
      <div className="dh-event-mini-list">
        {events.length ? (
          events.map((event) => <DragonEventMiniCard key={event.id} event={event} onSelect={onSelect} />)
        ) : (
          <DragonEmptyState title="No upcoming events" description="The Event Engine is ready for the next family activity." />
        )}
      </div>
    </DragonSection>
  );
}

export function DragonTodayEvents({ events, onSelect }: { events: DragonEvent[]; onSelect?: (event: DragonEvent) => void }) {
  return (
    <DragonSection eyebrow="TODAY" title="Today's chamber activity">
      <div className="dh-event-mini-list">
        {events.length ? (
          events.map((event) => <DragonEventMiniCard key={event.id} event={event} onSelect={onSelect} />)
        ) : (
          <DragonEmptyState title="No events today" description="No Dragon House activity is scheduled for this day." />
        )}
      </div>
    </DragonSection>
  );
}

export function DragonEventStatistics({ statistics }: { statistics: ReturnType<typeof useDragonEventState>['statistics'] }) {
  return (
    <div className="dh-event-statistics" aria-label="Dragon Event statistics">
      <div>
        <span className="dh-dragon-eyebrow">Total</span>
        <strong>{statistics.total}</strong>
      </div>
      <div>
        <span className="dh-dragon-eyebrow">Today</span>
        <strong>{statistics.today}</strong>
      </div>
      <div>
        <span className="dh-dragon-eyebrow">Upcoming</span>
        <strong>{statistics.upcoming}</strong>
      </div>
      <DragonProgress value={Math.min(statistics.totalXp, 100)} label="Event XP signal" />
    </div>
  );
}

export function DragonEventEmptyState() {
  return <DragonEmptyState title="No event seals found" description="Adjust filters or wait for the next Dragon House activity." />;
}

export function DragonEventLoadingState() {
  return <DragonLoader label="Dragon Event Engine opens the chronicle gates" />;
}

export function DragonEventErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <DragonRetry title="Dragon Event Engine did not open" description={message} onRetry={onRetry} />;
}

function DragonEventMiniCard({ event, onSelect }: { event: DragonEvent; onSelect?: (event: DragonEvent) => void }) {
  const meta = DRAGON_EVENT_TYPE_META[event.type];
  const time = event.allDay ? 'All day' : getDragonEventTimeKey(event.startsAt) ?? 'Time reserved';

  return (
    <DragonCard interactive className={`dh-event-mini-card ${meta.className}`}>
      <button type="button" onClick={() => onSelect?.(event)}>
        <DragonBadge tone={meta.tone}>{meta.label}</DragonBadge>
        <strong>{event.title}</strong>
        <span>
          {getDragonEventDateKey(event)} at {time}
        </span>
      </button>
    </DragonCard>
  );
}
