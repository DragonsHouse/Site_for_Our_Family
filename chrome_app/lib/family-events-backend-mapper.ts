import type { DragonEvent, DragonEventCategory, DragonEventStatus, DragonEventType, DragonEventVisibility } from '../entrypoints/dashboard/family/dragon-event-models.ts';
import type { DragonEventCreateInput, DragonEventUpdateInput } from '../entrypoints/dashboard/family/dragon-event-repository.ts';
import type { BackendFamilyCalendarItemDto, BackendFamilyEventDto } from './family-events-backend-response.ts';
import type { CreateBackendFamilyEventPayload, UpdateBackendFamilyEventPayload } from './family-events-backend-client.ts';

const EVENT_TYPES: DragonEventType[] = ['family_meeting', 'birthday', 'quest', 'tower_defense', 'celebration', 'training', 'resource_run', 'patrol', 'war', 'announcement', 'custom'];
const EVENT_CATEGORIES: DragonEventCategory[] = ['meeting', 'birthday', 'quest', 'defense', 'celebration', 'training', 'resource', 'patrol', 'war', 'announcement', 'custom'];
const EVENT_STATUSES: DragonEventStatus[] = ['draft', 'scheduled', 'active', 'completed', 'cancelled'];
const EVENT_VISIBILITIES: DragonEventVisibility[] = ['public', 'members', 'leadership', 'private', 'hidden'];

export function mapBackendFamilyEvent(event: BackendFamilyEventDto): DragonEvent {
  return baseDragonEvent({
    id: event.id,
    backendEventId: event.id,
    title: event.title,
    description: event.description,
    type: mapEventType(event.eventType),
    category: mapEventCategory(event.category),
    status: safeEnum(event.status, EVENT_STATUSES, 'draft'),
    priority: event.priority === 'low' || event.priority === 'high' || event.priority === 'critical' ? event.priority : 'normal',
    visibility: safeEnum(event.visibility, EVENT_VISIBILITIES, 'members'),
    owner: {
      id: event.organizerFamilyMemberId,
      name: event.organizerDisplayName ?? event.organizerFamilyMemberId,
      role: 'Organizer',
      backendMemberId: event.organizerFamilyMemberId
    },
    creator: {
      id: event.createdByFamilyMemberId,
      name: event.createdByDisplayName ?? event.createdByFamilyMemberId,
      role: 'Creator',
      backendMemberId: event.createdByFamilyMemberId
    },
    participants: event.responses
      .filter((response) => response.response !== 'declined')
      .map((response) => ({
        id: response.familyMemberId,
        name: response.displayName,
        role: response.response,
        backendMemberId: response.familyMemberId
      })),
    participantCount: event.participantCount,
    maxParticipants: event.maxParticipants,
    location: {
      label: event.locationLabel ?? 'Dragon House',
      kind: event.locationLabel ? 'external' : 'none'
    },
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    allDay: event.allDay,
    timezone: event.timezone,
    tags: readStringArray(event.metadata.tags),
    xp: 0,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    source: {
      sourceModule: 'events',
      sourceId: event.id,
      importedAt: event.updatedAt
    },
    futureMetadata: {
      backendFields: {
        sourceTable: 'family_events',
        responseTable: 'family_event_responses',
        attendanceTable: 'family_event_attendance'
      },
      completionMetadata: {
        presentCount: event.presentCount,
        confirmedCount: event.confirmedCount
      }
    }
  });
}

export function mapBackendCalendarItem(item: BackendFamilyCalendarItemDto): DragonEvent {
  const sourceModule = item.sourceModule === 'family_events' ? 'events' : item.sourceModule === 'family_quests' ? 'quest_board' : 'tower_defense';
  return baseDragonEvent({
    id: item.id,
    backendEventId: item.sourceId,
    title: item.title,
    description: readString(item.metadata.description) ?? '',
    type: item.sourceModule === 'tower_defense' ? 'tower_defense' : item.sourceModule === 'family_quests' ? 'quest' : mapEventType(item.type),
    category: item.sourceModule === 'tower_defense' ? 'defense' : item.sourceModule === 'family_quests' ? 'quest' : mapEventCategory(readString(item.metadata.category) ?? item.type),
    status: safeEnum(item.status, EVENT_STATUSES, 'scheduled'),
    priority: 'normal',
    visibility: safeEnum(readString(item.metadata.visibility) ?? 'members', EVENT_VISIBILITIES, 'members'),
    owner: member(readString(item.metadata.organizerFamilyMemberId) ?? readString(item.metadata.commanderFamilyMemberId) ?? 'unknown', 'Owner'),
    creator: member(readString(item.metadata.organizerFamilyMemberId) ?? readString(item.metadata.commanderFamilyMemberId) ?? 'unknown', 'Creator'),
    participants: [],
    participantCount: 0,
    maxParticipants: null,
    location: {
      label: readString(item.metadata.locationLabel) ?? readString(item.metadata.towerName) ?? '',
      kind: readString(item.metadata.locationLabel) || readString(item.metadata.towerName) ? 'external' : 'none'
    },
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    allDay: Boolean(item.metadata.allDay),
    timezone: 'Europe/Kiev',
    tags: [],
    xp: 0,
    createdAt: item.startsAt,
    updatedAt: item.endsAt ?? item.startsAt,
    source: {
      sourceModule,
      sourceId: item.sourceId,
      importedAt: item.startsAt
    },
    towerDefense: item.sourceModule === 'tower_defense' ? {
      defenseId: item.sourceId,
      towerId: readString(item.metadata.towerId),
      towerName: readString(item.metadata.towerName),
      towerCode: readString(item.metadata.towerCode),
      commanderMemberId: readString(item.metadata.commanderFamilyMemberId),
      defenseStatus: safeEnum(item.status, ['draft', 'scheduled', 'gathering', 'active', 'completed', 'cancelled'] as const, 'scheduled'),
      result: item.metadata.result === 'lost' ? 'defeat' : item.metadata.result === 'defended' ? 'victory' : item.status === 'active' ? 'in_progress' : 'scheduled'
    } : undefined,
    questIds: item.sourceModule === 'family_quests' ? [item.sourceId] : [],
    futureMetadata: {
      backendFields: {
        sourceModule: item.sourceModule,
        sourceId: item.sourceId
      },
      extensionSlots: item.metadata
    }
  });
}

export function mapDragonEventCreateInput(input: DragonEventCreateInput): CreateBackendFamilyEventPayload {
  return {
    title: input.title,
    description: input.description,
    eventType: input.type === 'quest' || input.type === 'tower_defense' || input.type === 'birthday' ? 'custom' : input.type,
    category: input.category === 'quest' || input.category === 'defense' || input.category === 'birthday' ? 'custom' : input.category,
    status: input.status,
    priority: input.priority,
    startsAt: input.startsAt,
    endsAt: input.endsAt ?? null,
    timezone: input.timezone,
    allDay: input.allDay,
    locationLabel: input.location.kind === 'none' ? null : input.location.label,
    organizerFamilyMemberId: input.owner.backendMemberId ?? input.owner.id,
    maxParticipants: input.maxParticipants ?? null,
    visibility: input.visibility,
    notes: input.futureMetadata.completionMetadata?.notes ? String(input.futureMetadata.completionMetadata.notes) : null,
    metadata: {
      tags: input.tags
    }
  };
}

export function mapDragonEventUpdateInput(input: DragonEventUpdateInput): UpdateBackendFamilyEventPayload {
  const mapped: UpdateBackendFamilyEventPayload = {};
  if (input.title !== undefined) mapped.title = input.title;
  if (input.description !== undefined) mapped.description = input.description;
  if (input.type !== undefined) mapped.eventType = input.type === 'quest' || input.type === 'tower_defense' || input.type === 'birthday' ? 'custom' : input.type;
  if (input.category !== undefined) mapped.category = input.category === 'quest' || input.category === 'defense' || input.category === 'birthday' ? 'custom' : input.category;
  if (input.status !== undefined) mapped.status = input.status;
  if (input.priority !== undefined) mapped.priority = input.priority;
  if (input.startsAt !== undefined) mapped.startsAt = input.startsAt;
  if (input.endsAt !== undefined) mapped.endsAt = input.endsAt;
  if (input.timezone !== undefined) mapped.timezone = input.timezone;
  if (input.allDay !== undefined) mapped.allDay = input.allDay;
  if (input.location !== undefined) mapped.locationLabel = input.location.kind === 'none' ? null : input.location.label;
  if (input.owner !== undefined) mapped.organizerFamilyMemberId = input.owner.backendMemberId ?? input.owner.id;
  if (input.maxParticipants !== undefined) mapped.maxParticipants = input.maxParticipants;
  if (input.visibility !== undefined) mapped.visibility = input.visibility;
  if (input.tags !== undefined) mapped.metadata = { tags: input.tags };
  return mapped;
}

function baseDragonEvent(input: Omit<DragonEvent, 'calendar' | 'repeat' | 'rewards' | 'achievementIds' | 'notifications'>): DragonEvent {
  return {
    calendar: {
      enabled: input.visibility !== 'private' && input.visibility !== 'hidden',
      stableEventKey: `${input.source.sourceModule}:${input.backendEventId}`
    },
    repeat: { frequency: 'none' },
    rewards: [],
    achievementIds: [],
    notifications: { enabled: false, channels: [], reminders: [] },
    ...input
  };
}

function member(id: string, role: string) {
  return { id, name: id, role, backendMemberId: id };
}

function mapEventType(value: string): DragonEventType {
  if (value === 'rp_event' || value === 'family_activity') return 'custom';
  return safeEnum(value, EVENT_TYPES, 'custom');
}

function mapEventCategory(value: string): DragonEventCategory {
  if (value === 'rp' || value === 'family') return 'custom';
  return safeEnum(value, EVENT_CATEGORIES, 'custom');
}

function safeEnum<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
