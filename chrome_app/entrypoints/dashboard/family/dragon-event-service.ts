import type { DragonCalendarCategory, DragonCalendarEvent, DragonCalendarPriority } from './calendar-models';
import type { DragonBirthdayData } from './birthday-models';
import type {
  DragonEvent,
  DragonEventCategory,
  DragonEventFilters,
  DragonEventPriority,
  DragonEventSortMode,
  DragonEventStatistics,
  DragonEventTimelineEntry,
  DragonEventType
} from './dragon-event-models';

export const DEFAULT_DRAGON_EVENT_FILTERS: DragonEventFilters = {
  type: 'all',
  status: 'all',
  priority: 'all',
  visibility: 'all',
  dateFrom: '',
  dateTo: '',
  owner: '',
  participant: '',
  search: ''
};

const PRIORITY_SCORE: Record<DragonEventPriority, number> = {
  low: 1,
  normal: 2,
  high: 3,
  critical: 4
};

const CALENDAR_CATEGORY_BY_EVENT_CATEGORY: Record<DragonEventCategory, DragonCalendarCategory> = {
  meeting: 'dragon_meeting',
  birthday: 'birthday',
  quest: 'quest',
  defense: 'war_event',
  celebration: 'celebration',
  training: 'war_event',
  resource: 'resource',
  patrol: 'war_event',
  war: 'war_event',
  announcement: 'ritual',
  custom: 'personal'
};

export function filterDragonEvents(events: DragonEvent[], filters: DragonEventFilters = DEFAULT_DRAGON_EVENT_FILTERS) {
  const search = filters.search.trim().toLowerCase();

  return events.filter((event) => {
    if (filters.type !== 'all' && event.type !== filters.type) return false;
    if (filters.status !== 'all' && event.status !== filters.status) return false;
    if (filters.priority !== 'all' && event.priority !== filters.priority) return false;
    if (filters.visibility !== 'all' && event.visibility !== filters.visibility) return false;
    if (filters.dateFrom && getDragonEventDateKey(event) < filters.dateFrom) return false;
    if (filters.dateTo && getDragonEventDateKey(event) > filters.dateTo) return false;
    if (filters.owner && event.owner.id !== filters.owner) return false;
    if (filters.participant && !event.participants.some((participant) => participant.id === filters.participant)) return false;
    if (!search) return true;

    return [
      event.title,
      event.description,
      event.backendEventId,
      event.owner.name,
      event.creator.name,
      ...event.tags,
      ...event.participants.map((participant) => participant.name)
    ].some((value) => value.toLowerCase().includes(search));
  });
}

export function sortDragonEvents(events: DragonEvent[], sortMode: DragonEventSortMode = 'upcoming', todayKey = getLocalDateKey()) {
  return [...events].sort((left, right) => compareDragonEvents(left, right, sortMode, todayKey));
}

export function compareDragonEvents(left: DragonEvent, right: DragonEvent, sortMode: DragonEventSortMode, todayKey = getLocalDateKey()) {
  if (sortMode === 'priority') {
    return PRIORITY_SCORE[right.priority] - PRIORITY_SCORE[left.priority] || left.startsAt.localeCompare(right.startsAt);
  }

  if (sortMode === 'newest') return right.createdAt.localeCompare(left.createdAt);
  if (sortMode === 'oldest') return left.createdAt.localeCompare(right.createdAt);
  if (sortMode === 'alphabetical') return left.title.localeCompare(right.title);
  if (sortMode === 'completed') {
    const byCompleted = Number(right.status === 'completed') - Number(left.status === 'completed');
    return byCompleted || right.startsAt.localeCompare(left.startsAt);
  }
  if (sortMode === 'active') {
    const byActive = Number(right.status === 'active') - Number(left.status === 'active');
    return byActive || left.startsAt.localeCompare(right.startsAt);
  }
  if (sortMode === 'today') {
    const leftToday = Number(getDragonEventDateKey(left) === todayKey);
    const rightToday = Number(getDragonEventDateKey(right) === todayKey);
    return rightToday - leftToday || left.startsAt.localeCompare(right.startsAt);
  }

  const leftPast = getDragonEventDateKey(left) < todayKey;
  const rightPast = getDragonEventDateKey(right) < todayKey;
  if (leftPast !== rightPast) return Number(leftPast) - Number(rightPast);
  return left.startsAt.localeCompare(right.startsAt);
}

export function getDragonEventStatistics(events: DragonEvent[], todayKey = getLocalDateKey()): DragonEventStatistics {
  return {
    total: events.length,
    today: events.filter((event) => getDragonEventDateKey(event) === todayKey).length,
    upcoming: events.filter((event) => getDragonEventDateKey(event) >= todayKey && event.status !== 'completed').length,
    active: events.filter((event) => event.status === 'active').length,
    completed: events.filter((event) => event.status === 'completed').length,
    critical: events.filter((event) => event.priority === 'critical').length,
    totalXp: events.reduce((sum, event) => sum + event.xp, 0)
  };
}

export function getDragonEventTimeline(events: DragonEvent[], limit = 12): DragonEventTimelineEntry[] {
  return [...events]
    .sort((left, right) => right.startsAt.localeCompare(left.startsAt))
    .slice(0, limit)
    .map((event) => ({
      id: event.id,
      backendEventId: event.backendEventId,
      occurredAt: event.startsAt,
      title: event.title,
      description: event.description,
      type: event.type,
      sourceModule: event.source.sourceModule
    }));
}

export function getDragonTodayEvents(events: DragonEvent[], todayKey = getLocalDateKey()) {
  return sortDragonEvents(
    events.filter((event) => getDragonEventDateKey(event) === todayKey),
    'today',
    todayKey
  );
}

export function getDragonUpcomingEvents(events: DragonEvent[], todayKey = getLocalDateKey(), limit = 6) {
  return sortDragonEvents(
    events.filter((event) => getDragonEventDateKey(event) >= todayKey && event.status !== 'completed'),
    'upcoming',
    todayKey
  ).slice(0, limit);
}

export function buildDragonBirthdayEvents(birthdays: DragonBirthdayData[], year: number, todayKey = getLocalDateKey()): DragonEvent[] {
  return birthdays.filter((birthday) => birthday.date && birthday.visibility === 'visible').flatMap((birthday) => {
    if (!birthday.date) return [];
    const observedDate = getObservedBirthdayInYear(birthday.date.month, birthday.date.day, year);
    const age = birthday.showAge ? calculateBirthdayAge(birthday.date.year, birthday.date.month, birthday.date.day, observedDate) : null;

    return [
      {
        id: `birthday-${birthday.memberId}-${year}`,
        backendEventId: `birthday:${birthday.memberId}:${year}`,
        title: `Birthday: ${birthday.memberName}`,
        description: `Dragon House birthday seal for ${birthday.memberName}.${age === null ? '' : ` Turns ${age}.`}`,
        type: 'birthday',
        category: 'birthday',
        status: observedDate < todayKey ? 'completed' : 'scheduled',
        priority: observedDate === todayKey ? 'high' : 'normal',
        visibility: 'members',
        owner: { id: birthday.memberId, name: birthday.memberName, discordUserId: birthday.discordUsername ?? null },
        creator: { id: 'birthday-engine', name: 'Birthday Engine' },
        participants: [{ id: birthday.memberId, name: birthday.memberName, role: 'Birthday Dragon' }],
        participantCount: 1,
        maxParticipants: null,
        location: { label: 'Celebration Chamber', kind: 'dragon_room', backendLocationId: 'room_celebration_chamber' },
        calendar: { enabled: true, stableEventKey: `birthday:${birthday.memberId}:${observedDate}`, colorKey: 'birthday' },
        startsAt: `${observedDate}T00:00:00`,
        endsAt: null,
        allDay: true,
        timezone: 'date-only',
        repeat: { frequency: 'yearly', interval: 1 },
        tags: ['birthday', 'celebration'],
        rewards: [],
        xp: 0,
        achievementIds: [],
        questIds: [],
        birthday: {
          memberId: birthday.memberId,
          observedDate,
          age,
          showAge: birthday.showAge,
          sourceBirthdayId: birthday.id
        },
        notifications: {
          enabled: birthday.notifications.enabled,
          channels: birthday.notifications.channels,
          reminders: birthday.notifications.daysBefore.map((daysBefore) => ({ offsetMinutes: daysBefore * 24 * 60 }))
        },
        createdAt: `${observedDate}T00:00:00`,
        updatedAt: `${observedDate}T00:00:00`,
        source: { sourceModule: 'birthday', sourceId: birthday.id },
        futureMetadata: { backendFields: { birthday: birthday.backendField } }
      } satisfies DragonEvent
    ];
  });
}

export function mergeDragonEvents(events: DragonEvent[], generatedEvents: DragonEvent[]) {
  const keys = new Set(events.map(getDragonEventStableKey));
  return [...events, ...generatedEvents.filter((event) => !keys.has(getDragonEventStableKey(event)))];
}

export function mapDragonEventsToCalendarEvents(events: DragonEvent[]): DragonCalendarEvent[] {
  return events
    .filter((event) => event.calendar.enabled && event.visibility !== 'hidden' && event.visibility !== 'private')
    .map((event) => ({
      id: event.calendar.calendarEventId ?? event.id,
      title: event.title,
      description: event.description,
      date: getDragonEventDateKey(event),
      startTime: event.allDay ? undefined : getDragonEventTimeKey(event.startsAt),
      endTime: event.endsAt && !event.allDay ? getDragonEventTimeKey(event.endsAt) : undefined,
      category: CALENDAR_CATEGORY_BY_EVENT_CATEGORY[event.category],
      priority: event.priority as DragonCalendarPriority,
      participants: event.participants.map((participant) => ({ id: participant.id, name: participant.name, role: participant.role })),
      createdBy: event.creator.name,
      hall: event.location.label,
      attachments: [],
      activity: event.source.sourceModule
    }));
}

export function getDragonEventStableKey(event: DragonEvent) {
  return event.calendar.stableEventKey;
}

export function getDragonEventDateKey(event: DragonEvent) {
  return event.birthday?.observedDate ?? event.startsAt.slice(0, 10);
}

export function getDragonEventTimeKey(dateTime: string) {
  const time = /T(\d{2}:\d{2})/u.exec(dateTime);
  return time?.[1];
}

export function getDragonEventTypeLabel(type: DragonEventType) {
  return type
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getLocalDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getObservedBirthdayInYear(month: number, day: number, year: number) {
  const observedDay = month === 2 && day === 29 && !isLeapYear(year) ? 28 : day;
  return `${year}-${String(month).padStart(2, '0')}-${String(observedDay).padStart(2, '0')}`;
}

function calculateBirthdayAge(year: number | undefined, month: number, day: number, todayKey: string) {
  if (!year) return null;
  const [todayYear, todayMonth, todayDay] = todayKey.split('-').map(Number);
  const observedDay = month === 2 && day === 29 && !isLeapYear(todayYear) ? 28 : day;
  const hadBirthday = todayMonth > month || (todayMonth === month && todayDay >= observedDay);
  return todayYear - year - (hadBirthday ? 0 : 1);
}

function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
