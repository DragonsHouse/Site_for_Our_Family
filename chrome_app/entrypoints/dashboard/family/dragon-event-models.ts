import type { DragonEntity } from '../data/models/entity';

export type DragonEventType =
  | 'family_meeting'
  | 'birthday'
  | 'quest'
  | 'tower_defense'
  | 'celebration'
  | 'training'
  | 'resource_run'
  | 'patrol'
  | 'war'
  | 'announcement'
  | 'custom';

export type DragonEventCategory =
  | 'meeting'
  | 'birthday'
  | 'quest'
  | 'defense'
  | 'celebration'
  | 'training'
  | 'resource'
  | 'patrol'
  | 'war'
  | 'announcement'
  | 'custom';

export type DragonEventStatus = 'draft' | 'scheduled' | 'active' | 'completed' | 'cancelled';
export type DragonEventPriority = 'low' | 'normal' | 'high' | 'critical';
export type DragonEventVisibility = 'public' | 'members' | 'leadership' | 'private' | 'hidden';
export type DragonEventSortMode = 'today' | 'upcoming' | 'active' | 'completed' | 'priority' | 'newest' | 'oldest' | 'alphabetical';

export type DragonEventPerson = {
  id: string;
  name: string;
  role?: string;
  backendMemberId?: string;
  discordUserId?: string | null;
};

export type DragonEventLocation = {
  label: string;
  kind: 'dragon_room' | 'discord_voice' | 'map_zone' | 'external' | 'none';
  backendLocationId?: string;
  discordChannelId?: string;
};

export type DragonEventCalendarIntegration = {
  enabled: boolean;
  calendarEventId?: string;
  stableEventKey: string;
  colorKey?: string;
};

export type DragonEventRepeatRule = {
  frequency: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  interval?: number;
  until?: string;
  backendRuleId?: string;
};

export type DragonEventReward = {
  id: string;
  type: 'xp' | 'achievement' | 'badge' | 'artifact' | 'inventory_item' | 'role_unlock' | 'decoration' | 'title';
  label: string;
  value: string | number;
  backendRewardId?: string;
};

export type DragonEventTowerDefenseMetadata = {
  defenseId?: string;
  waveId?: string;
  attendance?: Array<{ memberId: string; status: 'present' | 'late' | 'absent' }>;
  result?: 'victory' | 'defeat' | 'in_progress' | 'scheduled';
  rewardId?: string;
  futureFields?: Record<string, string | number | boolean>;
};

export type DragonEventResourceMetadata = {
  resourceId?: string;
  resourceType?: string;
  quantity?: number;
  backendResourceEventId?: string;
};

export type DragonEventBirthdayMetadata = {
  memberId: string;
  observedDate: string;
  age?: number | null;
  showAge: boolean;
  sourceBirthdayId: string;
};

export type DragonEventNotificationSettings = {
  enabled: boolean;
  channels: Array<'hub' | 'popup' | 'discord' | 'email'>;
  reminders: Array<{ offsetMinutes: number; backendNotificationId?: string }>;
};

export type DragonEventDiscordMetadata = {
  messageId?: string;
  channelId?: string;
  guildId?: string;
  voiceChannelId?: string;
  roleIds?: string[];
  syncedAt?: string;
};

export type DragonEventSourceMetadata = {
  sourceModule: 'events' | 'calendar' | 'birthday' | 'profile' | 'quest_board' | 'tower_defense' | 'resources' | 'discord' | 'manual';
  sourceId?: string;
  importedAt?: string;
};

export type DragonEventFutureMetadata = {
  backendFields?: Record<string, string>;
  completionMetadata?: Record<string, string | number | boolean>;
  questLinks?: string[];
  achievementLinks?: string[];
  extensionSlots?: Record<string, unknown>;
};

export type DragonEvent = DragonEntity & {
  backendEventId: string;
  title: string;
  description: string;
  type: DragonEventType;
  category: DragonEventCategory;
  status: DragonEventStatus;
  priority: DragonEventPriority;
  visibility: DragonEventVisibility;
  owner: DragonEventPerson;
  creator: DragonEventPerson;
  participants: DragonEventPerson[];
  participantCount: number;
  maxParticipants?: number | null;
  location: DragonEventLocation;
  calendar: DragonEventCalendarIntegration;
  startsAt: string;
  endsAt?: string | null;
  allDay: boolean;
  timezone: string;
  repeat: DragonEventRepeatRule;
  tags: string[];
  rewards: DragonEventReward[];
  xp: number;
  achievementIds: string[];
  questIds: string[];
  towerDefense?: DragonEventTowerDefenseMetadata;
  resources?: DragonEventResourceMetadata;
  birthday?: DragonEventBirthdayMetadata;
  notifications: DragonEventNotificationSettings;
  discord?: DragonEventDiscordMetadata;
  createdAt: string;
  updatedAt: string;
  source: DragonEventSourceMetadata;
  futureMetadata: DragonEventFutureMetadata;
};

export type DragonEventFilters = {
  type: DragonEventType | 'all';
  status: DragonEventStatus | 'all';
  priority: DragonEventPriority | 'all';
  visibility: DragonEventVisibility | 'all';
  dateFrom: string;
  dateTo: string;
  owner: string;
  participant: string;
  search: string;
};

export type DragonEventStatistics = {
  total: number;
  today: number;
  upcoming: number;
  active: number;
  completed: number;
  critical: number;
  totalXp: number;
};

export type DragonEventTimelineEntry = {
  id: string;
  backendEventId: string;
  occurredAt: string;
  title: string;
  description: string;
  type: DragonEventType;
  sourceModule: DragonEventSourceMetadata['sourceModule'];
};

export const DRAGON_EVENT_TYPE_LABELS: Record<DragonEventType, string> = {
  family_meeting: 'Family Meeting',
  birthday: 'Birthday',
  quest: 'Quest',
  tower_defense: 'Tower Defense',
  celebration: 'Celebration',
  training: 'Training',
  resource_run: 'Resource Run',
  patrol: 'Patrol',
  war: 'War',
  announcement: 'Announcement',
  custom: 'Custom'
};

export const DRAGON_EVENT_TYPE_META: Record<
  DragonEventType,
  { label: string; glyph: string; tone: 'ember' | 'gold' | 'success' | 'muted' | 'danger'; className: string }
> = {
  family_meeting: { label: 'Family Meeting', glyph: 'Council', tone: 'gold', className: 'dh-event-type-family-meeting' },
  birthday: { label: 'Birthday', glyph: 'Candle', tone: 'success', className: 'dh-event-type-birthday' },
  quest: { label: 'Quest', glyph: 'Quest', tone: 'ember', className: 'dh-event-type-quest' },
  tower_defense: { label: 'Tower Defense', glyph: 'Tower', tone: 'danger', className: 'dh-event-type-tower-defense' },
  celebration: { label: 'Celebration', glyph: 'Flame', tone: 'gold', className: 'dh-event-type-celebration' },
  training: { label: 'Training', glyph: 'Blade', tone: 'ember', className: 'dh-event-type-training' },
  resource_run: { label: 'Resource Run', glyph: 'Vault', tone: 'muted', className: 'dh-event-type-resource-run' },
  patrol: { label: 'Patrol', glyph: 'Watch', tone: 'success', className: 'dh-event-type-patrol' },
  war: { label: 'War', glyph: 'War', tone: 'danger', className: 'dh-event-type-war' },
  announcement: { label: 'Announcement', glyph: 'Horn', tone: 'gold', className: 'dh-event-type-announcement' },
  custom: { label: 'Custom', glyph: 'Rune', tone: 'muted', className: 'dh-event-type-custom' }
};
