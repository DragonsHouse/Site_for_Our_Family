export type DragonCalendarView = 'month' | 'week' | 'agenda';

export type DragonCalendarCategory =
  | 'dragon_meeting'
  | 'birthday'
  | 'celebration'
  | 'war_event'
  | 'quest'
  | 'ritual'
  | 'resource'
  | 'personal';

export type DragonCalendarPriority = 'low' | 'normal' | 'high' | 'critical';

export type DragonCalendarParticipant = {
  id: string;
  name: string;
  role?: string;
};

export type DragonCalendarAttachment = {
  id: string;
  title: string;
  kind: 'document' | 'image' | 'link';
};

export type DragonCalendarEvent = {
  id: string;
  title: string;
  description: string;
  date: string;
  startTime?: string;
  endTime?: string;
  category: DragonCalendarCategory;
  priority: DragonCalendarPriority;
  participants: DragonCalendarParticipant[];
  createdBy: string;
  hall: string;
  attachments: DragonCalendarAttachment[];
  activity: string;
};

export type DragonCalendarFilters = {
  search: string;
  category: DragonCalendarCategory | 'all';
  member: string;
  dateFrom: string;
  dateTo: string;
};

export type DragonCalendarDay = {
  key: string;
  date: Date;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  events: DragonCalendarEvent[];
};

export const DRAGON_CALENDAR_CATEGORY_META: Record<
  DragonCalendarCategory,
  {
    label: string;
    glyph: string;
    tone: 'ember' | 'gold' | 'success' | 'muted' | 'danger';
    className: string;
  }
> = {
  dragon_meeting: {
    label: 'Dragon Meeting',
    glyph: '🐉',
    tone: 'gold',
    className: 'dh-calendar-category-dragon-meeting'
  },
  birthday: {
    label: 'Birthday',
    glyph: '🎂',
    tone: 'success',
    className: 'dh-calendar-category-birthday'
  },
  celebration: {
    label: 'Celebration',
    glyph: '🎉',
    tone: 'gold',
    className: 'dh-calendar-category-celebration'
  },
  war_event: {
    label: 'War Event',
    glyph: '⚔',
    tone: 'danger',
    className: 'dh-calendar-category-war-event'
  },
  quest: {
    label: 'Quest',
    glyph: '📜',
    tone: 'ember',
    className: 'dh-calendar-category-quest'
  },
  ritual: {
    label: 'Ritual',
    glyph: '🔥',
    tone: 'ember',
    className: 'dh-calendar-category-ritual'
  },
  resource: {
    label: 'Resource',
    glyph: '📦',
    tone: 'muted',
    className: 'dh-calendar-category-resource'
  },
  personal: {
    label: 'Personal',
    glyph: '👤',
    tone: 'muted',
    className: 'dh-calendar-category-personal'
  }
};

export const DRAGON_CALENDAR_VIEW_TABS: Array<{ key: DragonCalendarView; label: string; room: string }> = [
  { key: 'month', label: 'Місяць', room: 'Chronicle Wall' },
  { key: 'week', label: 'Тиждень', room: 'Flame Line' },
  { key: 'agenda', label: 'Список', room: 'Seal Ledger' }
];
