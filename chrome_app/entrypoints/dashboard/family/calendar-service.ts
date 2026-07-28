import { DRAGON_CALENDAR_MOCK_EVENTS } from './calendar-mock-data';
import type { DragonCalendarCategory, DragonCalendarEvent, DragonCalendarFilters } from './calendar-models';
import { compareEvents } from './calendar-date';
import { createMockRepository } from '../data/repositories/mock-repository';
import type { Repository } from '../data/repositories/repository';

export type DragonCalendarCreateInput = Omit<DragonCalendarEvent, 'id'>;
export type DragonCalendarUpdateInput = Partial<DragonCalendarEvent>;

export type DragonCalendarRepository = Repository<
  DragonCalendarEvent,
  DragonCalendarCreateInput,
  DragonCalendarUpdateInput,
  DragonCalendarFilters
>;

export const mockDragonCalendarRepository: DragonCalendarRepository = createMockRepository<
  DragonCalendarEvent,
  DragonCalendarCreateInput,
  DragonCalendarUpdateInput,
  DragonCalendarFilters
>(DRAGON_CALENDAR_MOCK_EVENTS, (input) => ({
  id: globalThis.crypto?.randomUUID?.() ?? `calendar-${Date.now()}`,
  ...input
}));

export type DragonCalendarStats = {
  totalEvents: number;
  birthdaysThisMonth: number;
  upcomingEvents: number;
  recentActivity: string;
  categoryCounts: Record<DragonCalendarCategory, number>;
};

export function filterDragonCalendarEvents(events: DragonCalendarEvent[], filters: DragonCalendarFilters) {
  const search = filters.search.trim().toLowerCase();

  return events
    .filter((event) => {
      const matchesSearch =
        !search ||
        event.title.toLowerCase().includes(search) ||
        event.description.toLowerCase().includes(search) ||
        event.participants.some((participant) => participant.name.toLowerCase().includes(search));
      const matchesCategory = filters.category === 'all' || event.category === filters.category;
      const matchesMember =
        !filters.member ||
        event.participants.some((participant) => participant.id === filters.member || participant.name === filters.member);
      const matchesFrom = !filters.dateFrom || event.date >= filters.dateFrom;
      const matchesTo = !filters.dateTo || event.date <= filters.dateTo;

      return matchesSearch && matchesCategory && matchesMember && matchesFrom && matchesTo;
    })
    .sort(compareEvents);
}

export function getDragonCalendarMembers(events: DragonCalendarEvent[]) {
  const members = new Map<string, string>();

  events.forEach((event) => {
    event.participants.forEach((participant) => {
      members.set(participant.id, participant.name);
    });
  });

  return Array.from(members, ([id, name]) => ({ id, name })).sort((left, right) => left.name.localeCompare(right.name));
}

export function getDragonCalendarStats(events: DragonCalendarEvent[], month: Date, todayKey: string): DragonCalendarStats {
  const monthPrefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const eventsThisMonth = events.filter((event) => event.date.startsWith(monthPrefix));
  const categoryCounts = events.reduce(
    (counts, event) => ({
      ...counts,
      [event.category]: counts[event.category] + 1
    }),
    {
      dragon_meeting: 0,
      birthday: 0,
      celebration: 0,
      war_event: 0,
      quest: 0,
      ritual: 0,
      resource: 0,
      personal: 0
    } satisfies Record<DragonCalendarCategory, number>
  );
  const recent = [...events].sort((left, right) => right.date.localeCompare(left.date))[0];

  return {
    totalEvents: eventsThisMonth.length,
    birthdaysThisMonth: eventsThisMonth.filter((event) => event.category === 'birthday').length,
    upcomingEvents: events.filter((event) => event.date >= todayKey).length,
    recentActivity: recent?.activity ?? 'Хроніки очікують перший запис',
    categoryCounts
  };
}
