import { useMemo, useState } from 'react';
import { useDragonCollection } from '../data/hooks/use-dragon-collection';
import type { DragonBirthdayData } from './birthday-models';
import type { DragonMember, DragonMembersFilters } from './members-models';
import type { DragonMemberCreateInput, DragonMembersRepository, DragonMemberUpdateInput } from './members-service';
import { toDragonBirthdayData } from './birthday-service';
import type { DragonEvent, DragonEventFilters, DragonEventSortMode } from './dragon-event-models';
import type { DragonEventCreateInput, DragonEventRepository, DragonEventUpdateInput } from './dragon-event-repository';
import { mockDragonEventRepository } from './dragon-event-repository';
import { mockDragonMembersRepository } from './members-service';
import {
  DEFAULT_DRAGON_EVENT_FILTERS,
  buildDragonBirthdayEvents,
  filterDragonEvents,
  getDragonEventStatistics,
  getDragonEventTimeline,
  getDragonTodayEvents,
  getDragonUpcomingEvents,
  mergeDragonEvents,
  sortDragonEvents
} from './dragon-event-service';

const MEMBER_BIRTHDAY_FILTERS: DragonMembersFilters = {
  search: '',
  role: 'all',
  status: 'all',
  joinYear: '',
  birthdayMonth: '',
  sort: 'nickname',
  direction: 'asc'
};

export type DragonEventStateDependencies = {
  eventRepository: DragonEventRepository;
  membersRepository?: DragonMembersRepository;
  now?: Date;
  includeBirthdayEvents?: boolean;
};

export function createMockDragonEventStateDependencies(overrides: Partial<DragonEventStateDependencies> = {}): DragonEventStateDependencies {
  return {
    eventRepository: mockDragonEventRepository,
    membersRepository: mockDragonMembersRepository,
    includeBirthdayEvents: true,
    ...overrides
  };
}

export function useDragonEventState(dependencies: DragonEventStateDependencies = createMockDragonEventStateDependencies()) {
  const todayKey = useMemo(() => toDateKey(dependencies.now ?? new Date()), [dependencies.now]);
  const [filters, setFilters] = useState<DragonEventFilters>(DEFAULT_DRAGON_EVENT_FILTERS);
  const [sortMode, setSortMode] = useState<DragonEventSortMode>('upcoming');
  const [selectedEvent, setSelectedEvent] = useState<DragonEvent | null>(null);
  const eventsCollection = useDragonCollection<DragonEvent, Partial<DragonEventFilters>, DragonEventCreateInput, DragonEventUpdateInput>(
    dependencies.eventRepository,
    {},
    {
      page: 1,
      pageSize: 200
    }
  );
  const membersCollection = useDragonCollection<DragonMember, DragonMembersFilters, DragonMemberCreateInput, DragonMemberUpdateInput>(
    dependencies.membersRepository ?? mockDragonMembersRepository,
    MEMBER_BIRTHDAY_FILTERS,
    {
      page: 1,
      pageSize: 200
    }
  );
  const birthdays = useMemo<DragonBirthdayData[]>(
    () => (dependencies.includeBirthdayEvents === false ? [] : membersCollection.items.map((member) => toDragonBirthdayData(member))),
    [dependencies.includeBirthdayEvents, membersCollection.items]
  );
  const birthdayEvents = useMemo(
    () => buildDragonBirthdayEvents(birthdays, Number(todayKey.slice(0, 4)), todayKey),
    [birthdays, todayKey]
  );
  const events = useMemo(
    () => mergeDragonEvents(eventsCollection.items, dependencies.includeBirthdayEvents === false ? [] : birthdayEvents),
    [birthdayEvents, dependencies.includeBirthdayEvents, eventsCollection.items]
  );
  const filteredEvents = useMemo(() => filterDragonEvents(events, filters), [events, filters]);
  const visibleEvents = useMemo(() => sortDragonEvents(filteredEvents, sortMode, todayKey), [filteredEvents, sortMode, todayKey]);
  const statistics = useMemo(() => getDragonEventStatistics(events, todayKey), [events, todayKey]);
  const timeline = useMemo(() => getDragonEventTimeline(events), [events]);
  const todayEvents = useMemo(() => getDragonTodayEvents(events, todayKey), [events, todayKey]);
  const upcomingEvents = useMemo(() => getDragonUpcomingEvents(events, todayKey), [events, todayKey]);

  return {
    loading: eventsCollection.loading || (dependencies.includeBirthdayEvents !== false && membersCollection.loading),
    refreshing: eventsCollection.refreshing || (dependencies.includeBirthdayEvents !== false && membersCollection.refreshing),
    error: eventsCollection.error ?? (dependencies.includeBirthdayEvents !== false ? membersCollection.error : null),
    refresh: () => {
      eventsCollection.refresh();
      if (dependencies.includeBirthdayEvents !== false) membersCollection.refresh();
    },
    events,
    repositoryEvents: eventsCollection.items,
    birthdayEvents,
    filteredEvents,
    visibleEvents,
    statistics,
    timeline,
    todayEvents,
    upcomingEvents,
    filters,
    setFilters,
    sortMode,
    setSortMode,
    selectedEvent,
    setSelectedEvent,
    todayKey,
    backendIntegration: {
      repositoryBoundary: 'Repository<DragonEvent>',
      eventRepositorySupplied: Boolean(dependencies.eventRepository),
      membersRepositorySupplied: Boolean(dependencies.membersRepository),
      birthdayComposition: dependencies.includeBirthdayEvents !== false ? 'Repository<DragonMember> -> Birthday -> DragonEvent' : 'disabled'
    }
  };
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
