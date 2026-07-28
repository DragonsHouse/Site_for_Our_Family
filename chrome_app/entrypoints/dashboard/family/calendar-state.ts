import { useMemo, useState } from 'react';
import { useDragonCollection } from '../data/hooks/use-dragon-collection';
import { useDragonBirthdayState } from './birthday-state';
import { addDays, addMonths, buildMonthDays, buildWeekDays, groupEventsByDate, toDateKey } from './calendar-date';
import {
  filterDragonCalendarEvents,
  getDragonCalendarMembers,
  getDragonCalendarStats,
} from './calendar-service';
import type { DragonCalendarEvent, DragonCalendarFilters, DragonCalendarView } from './calendar-models';
import type { DragonEvent, DragonEventFilters } from './dragon-event-models';
import type { DragonEventCreateInput, DragonEventRepository, DragonEventUpdateInput } from './dragon-event-repository';
import { buildDragonBirthdayEvents, mapDragonEventsToCalendarEvents, mergeDragonEvents } from './dragon-event-service';
import type { DragonMembersRepository } from './members-service';

const DEFAULT_FILTERS: DragonCalendarFilters = {
  search: '',
  category: 'all',
  member: '',
  dateFrom: '',
  dateTo: ''
};

export type DragonCalendarStateDependencies = {
  eventRepository: DragonEventRepository;
  membersRepository: DragonMembersRepository;
  now?: Date;
};

export function useDragonCalendarState(dependencies: DragonCalendarStateDependencies) {
  const today = useMemo(() => dependencies.now ?? new Date(), [dependencies.now]);
  const todayKey = useMemo(() => toDateKey(today), [today]);
  const [view, setView] = useState<DragonCalendarView>('month');
  const [anchorDate, setAnchorDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedEvent, setSelectedEvent] = useState<DragonCalendarEvent | null>(null);
  const [filters, setFilters] = useState<DragonCalendarFilters>(DEFAULT_FILTERS);
  const collection = useDragonCollection<DragonEvent, Partial<DragonEventFilters>, DragonEventCreateInput, DragonEventUpdateInput>(dependencies.eventRepository, {}, {
    page: 1,
    pageSize: 200
  });
  const birthdayState = useDragonBirthdayState({
    membersRepository: dependencies.membersRepository,
    year: anchorDate.getFullYear(),
    todayKey
  });
  const birthdayDragonEvents = useMemo(
    () => buildDragonBirthdayEvents(birthdayState.birthdays, anchorDate.getFullYear(), todayKey),
    [anchorDate, birthdayState.birthdays, todayKey]
  );
  const dragonEvents = useMemo(() => mergeDragonEvents(collection.items, birthdayDragonEvents), [birthdayDragonEvents, collection.items]);
  const events = useMemo(
    () => mapDragonEventsToCalendarEvents(dragonEvents),
    [dragonEvents]
  );
  const filteredEvents = useMemo(() => filterDragonCalendarEvents(events, filters), [events, filters]);
  const eventsByDate = useMemo(() => groupEventsByDate(filteredEvents), [filteredEvents]);
  const monthDays = useMemo(() => buildMonthDays(anchorDate, eventsByDate, todayKey), [anchorDate, eventsByDate, todayKey]);
  const weekDays = useMemo(() => buildWeekDays(anchorDate, eventsByDate, todayKey), [anchorDate, eventsByDate, todayKey]);
  const members = useMemo(() => getDragonCalendarMembers(events), [events]);
  const stats = useMemo(() => getDragonCalendarStats(filteredEvents, anchorDate, todayKey), [filteredEvents, anchorDate, todayKey]);

  return {
    view,
    setView,
    anchorDate,
    setAnchorDate,
    today,
    todayKey,
    filters,
    setFilters,
    loading: collection.loading || birthdayState.loading,
    refreshing: collection.refreshing || birthdayState.refreshing,
    error: collection.error ?? birthdayState.error,
    refresh: () => {
      collection.refresh();
      birthdayState.refresh();
    },
    dragonEvents,
    events,
    filteredEvents,
    monthDays,
    weekDays,
    members,
    stats,
    selectedEvent,
    setSelectedEvent,
    goToToday: () => setAnchorDate(new Date(today.getFullYear(), today.getMonth(), today.getDate())),
    goToPrevious: () => setAnchorDate((current) => (view === 'month' ? addMonths(current, -1) : addDays(current, -7))),
    goToNext: () => setAnchorDate((current) => (view === 'month' ? addMonths(current, 1) : addDays(current, 7))),
    clearFilters: () => setFilters(DEFAULT_FILTERS)
  };
}
