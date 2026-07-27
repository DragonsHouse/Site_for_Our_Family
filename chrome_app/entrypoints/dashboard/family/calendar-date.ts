import type { DragonCalendarDay, DragonCalendarEvent } from './calendar-models';

const UKRAINIAN_MONTH_FORMATTER = new Intl.DateTimeFormat('uk-UA', {
  month: 'long',
  year: 'numeric'
});

const UKRAINIAN_DAY_FORMATTER = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  month: 'short'
});

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function getMonthTitle(date: Date) {
  const title = UKRAINIAN_MONTH_FORMATTER.format(date);
  return title.charAt(0).toUpperCase() + title.slice(1);
}

export function getDayTitle(date: Date) {
  return UKRAINIAN_DAY_FORMATTER.format(date);
}

export function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export function addDays(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

export function startOfWeek(date: Date) {
  const day = date.getDay() || 7;
  return addDays(date, 1 - day);
}

export function groupEventsByDate(events: DragonCalendarEvent[]) {
  return events.reduce<Record<string, DragonCalendarEvent[]>>((grouped, event) => {
    grouped[event.date] = [...(grouped[event.date] ?? []), event].sort(compareEvents);
    return grouped;
  }, {});
}

export function buildMonthDays(month: Date, eventsByDate: Record<string, DragonCalendarEvent[]>, todayKey: string): DragonCalendarDay[] {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = startOfWeek(firstDay);

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(start, index);
    const key = toDateKey(date);

    return {
      key,
      date,
      dayNumber: date.getDate(),
      inCurrentMonth: date.getMonth() === month.getMonth(),
      isToday: key === todayKey,
      events: eventsByDate[key] ?? []
    };
  });
}

export function buildWeekDays(anchor: Date, eventsByDate: Record<string, DragonCalendarEvent[]>, todayKey: string): DragonCalendarDay[] {
  const start = startOfWeek(anchor);

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, index);
    const key = toDateKey(date);

    return {
      key,
      date,
      dayNumber: date.getDate(),
      inCurrentMonth: true,
      isToday: key === todayKey,
      events: eventsByDate[key] ?? []
    };
  });
}

export function compareEvents(left: DragonCalendarEvent, right: DragonCalendarEvent) {
  return `${left.date} ${left.startTime ?? '99:99'} ${left.title}`.localeCompare(`${right.date} ${right.startTime ?? '99:99'} ${right.title}`);
}
