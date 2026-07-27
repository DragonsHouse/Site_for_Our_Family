import { useMemo, useState } from 'react';
import { addDays, addMonths, buildMonthDays, buildWeekDays, groupEventsByDate, toDateKey } from './calendar-date';
import {
  filterDragonCalendarEvents,
  getDragonCalendarMembers,
  getDragonCalendarStats,
  mockDragonCalendarRepository,
  type DragonCalendarRepository
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
  const [filters, setFilters] = useState<DragonCalendarFilters>(DEFAULT_FILTERS);
  const [selectedEvent, setSelectedEvent] = useState<DragonCalendarEvent | null>(null);
  const events = useMemo(() => repository.listEvents(), [repository]);
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
