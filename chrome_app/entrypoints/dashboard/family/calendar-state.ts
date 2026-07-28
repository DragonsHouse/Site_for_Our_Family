import { useMemo, useState } from 'react';
import { useDragonCollection } from '../data/hooks/use-dragon-collection';
import { mergeDragonCalendarBirthdayEvents } from './birthday-service';
import { useDragonBirthdayState } from './birthday-state';
import { addDays, addMonths, buildMonthDays, buildWeekDays, groupEventsByDate, toDateKey } from './calendar-date';
import {
  filterDragonCalendarEvents,
  getDragonCalendarMembers,
  getDragonCalendarStats,
  mockDragonCalendarRepository,
  type DragonCalendarCreateInput,
  type DragonCalendarRepository,
  type DragonCalendarUpdateInput
} from './calendar-service';
import type { DragonCalendarEvent, DragonCalendarFilters, DragonCalendarView } from './calendar-models';

const DEFAULT_FILTERS: DragonCalendarFilters = {
  search: '',
  category: 'all',
  member: '',
  dateFrom: '',
  dateTo: ''
};

export function useDragonCalendarState(repository: DragonCalendarRepository = mockDragonCalendarRepository) {
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);
  const [view, setView] = useState<DragonCalendarView>('month');
  const [anchorDate, setAnchorDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedEvent, setSelectedEvent] = useState<DragonCalendarEvent | null>(null);
  const collection = useDragonCollection<
    DragonCalendarEvent,
    DragonCalendarFilters,
    DragonCalendarCreateInput,
    DragonCalendarUpdateInput
  >(repository, DEFAULT_FILTERS, {
    page: 1,
    pageSize: 200
  });
  const birthdayState = useDragonBirthdayState(undefined, anchorDate.getFullYear());
  const events = useMemo(
    () => mergeDragonCalendarBirthdayEvents(collection.items, birthdayState.calendarEvents),
    [collection.items, birthdayState.calendarEvents]
  );
  const filteredEvents = useMemo(() => filterDragonCalendarEvents(events, collection.filters), [events, collection.filters]);
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
    filters: collection.filters,
    setFilters: collection.setFilters,
    loading: collection.loading || birthdayState.loading,
    refreshing: collection.refreshing || birthdayState.refreshing,
    error: collection.error ?? birthdayState.error,
    refresh: () => {
      collection.refresh();
      birthdayState.refresh();
    },
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
    clearFilters: () => collection.setFilters(DEFAULT_FILTERS)
  };
}
