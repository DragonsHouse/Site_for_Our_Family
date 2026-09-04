import { randomUUID } from 'node:crypto';
import type {
  CreateFamilyEventInput,
  FamilyEventAttendanceRecord,
  FamilyEventListQuery,
  FamilyEventRecord,
  FamilyEventResponseRecord,
  UpdateFamilyEventInput,
} from './family-event-models.js';

export type UpsertEventResponseInput = {
  eventId: string;
  familyMemberId: string;
  response: FamilyEventResponseRecord['response'];
  note?: string | null;
  metadata?: Record<string, unknown>;
  now: string;
};

export type UpsertEventAttendanceInput = {
  eventId: string;
  familyMemberId: string;
  status: FamilyEventAttendanceRecord['status'];
  confirmedByFamilyMemberId: string;
  note?: string | null;
  metadata?: Record<string, unknown>;
  now: string;
};

export interface FamilyEventRepository {
  familyMemberExists(id: string): Promise<boolean>;
  listEvents(query?: FamilyEventListQuery): Promise<FamilyEventRecord[]>;
  findEventById(id: string): Promise<FamilyEventRecord | null>;
  createEvent(input: CreateFamilyEventInput & { createdByFamilyMemberId: string; organizerFamilyMemberId: string; now: string }): Promise<FamilyEventRecord>;
  updateEvent(id: string, input: UpdateFamilyEventInput & {
    status?: FamilyEventRecord['status'];
    completedByFamilyMemberId?: string | null;
    completedAt?: string | null;
    cancelledByFamilyMemberId?: string | null;
    cancelledAt?: string | null;
    now: string;
  }): Promise<FamilyEventRecord | null>;
  upsertResponse(input: UpsertEventResponseInput): Promise<FamilyEventResponseRecord>;
  removeResponse(eventId: string, familyMemberId: string, now: string): Promise<FamilyEventResponseRecord>;
  upsertAttendance(input: UpsertEventAttendanceInput): Promise<FamilyEventAttendanceRecord>;
}

export class MemoryFamilyEventRepository implements FamilyEventRepository {
  constructor(
    private readonly events: FamilyEventRecord[] = [],
    private readonly familyMemberIds: string[] = [],
  ) {}

  async familyMemberExists(id: string): Promise<boolean> {
    return this.familyMemberIds.includes(id);
  }

  async listEvents(query: FamilyEventListQuery = {}): Promise<FamilyEventRecord[]> {
    const search = query.search?.trim().toLowerCase();
    return this.events
      .filter((event) => {
        if (query.status && query.status !== 'all' && event.status !== query.status) return false;
        if (query.category && query.category !== 'all' && event.category !== query.category) return false;
        if (query.type && query.type !== 'all' && event.eventType !== query.type) return false;
        if (query.from && (event.endsAt ?? event.startsAt) < query.from) return false;
        if (query.to && event.startsAt > query.to) return false;
        if (query.organizer && event.organizerFamilyMemberId !== query.organizer) return false;
        if (query.participant && !event.responses.some((response) => response.familyMemberId === query.participant && response.response !== 'declined')) return false;
        if (!search) return true;
        return [event.title, event.description, event.locationLabel ?? '', event.notes ?? ''].some((value) => value.toLowerCase().includes(search));
      })
      .sort((left, right) => right.startsAt.localeCompare(left.startsAt) || right.id.localeCompare(left.id));
  }

  async findEventById(id: string): Promise<FamilyEventRecord | null> {
    return this.events.find((event) => event.id === id) ?? null;
  }

  async createEvent(input: CreateFamilyEventInput & { createdByFamilyMemberId: string; organizerFamilyMemberId: string; now: string }): Promise<FamilyEventRecord> {
    const event: FamilyEventRecord = {
      id: randomUUID(),
      title: input.title,
      description: input.description ?? '',
      eventType: input.eventType,
      category: input.category ?? 'custom',
      status: input.status ?? 'draft',
      priority: input.priority ?? 'normal',
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
      timezone: input.timezone ?? 'Europe/Kiev',
      allDay: input.allDay ?? false,
      locationLabel: input.locationLabel ?? null,
      createdByFamilyMemberId: input.createdByFamilyMemberId,
      createdByDisplayName: null,
      organizerFamilyMemberId: input.organizerFamilyMemberId,
      organizerDisplayName: null,
      maxParticipants: input.maxParticipants ?? null,
      visibility: input.visibility ?? 'members',
      notes: input.notes ?? null,
      completedByFamilyMemberId: null,
      completedAt: null,
      cancelledByFamilyMemberId: null,
      cancelledAt: null,
      metadata: input.metadata ?? {},
      createdAt: input.now,
      updatedAt: input.now,
      responses: [],
      attendance: [],
    };
    this.events.push(event);
    return event;
  }

  async updateEvent(id: string, input: UpdateFamilyEventInput & {
    status?: FamilyEventRecord['status'];
    completedByFamilyMemberId?: string | null;
    completedAt?: string | null;
    cancelledByFamilyMemberId?: string | null;
    cancelledAt?: string | null;
    now: string;
  }): Promise<FamilyEventRecord | null> {
    const index = this.events.findIndex((event) => event.id === id);
    if (index < 0) return null;
    const current = this.events[index]!;
    const updated: FamilyEventRecord = {
      ...current,
      title: input.title ?? current.title,
      description: input.description ?? current.description,
      eventType: input.eventType ?? current.eventType,
      category: input.category ?? current.category,
      status: input.status ?? current.status,
      priority: input.priority ?? current.priority,
      startsAt: input.startsAt ?? current.startsAt,
      endsAt: input.endsAt !== undefined ? input.endsAt : current.endsAt,
      timezone: input.timezone ?? current.timezone,
      allDay: input.allDay ?? current.allDay,
      locationLabel: input.locationLabel !== undefined ? input.locationLabel : current.locationLabel,
      organizerFamilyMemberId: input.organizerFamilyMemberId ?? current.organizerFamilyMemberId,
      maxParticipants: input.maxParticipants !== undefined ? input.maxParticipants : current.maxParticipants,
      visibility: input.visibility ?? current.visibility,
      notes: input.notes !== undefined ? input.notes : current.notes,
      completedByFamilyMemberId: input.completedByFamilyMemberId !== undefined ? input.completedByFamilyMemberId : current.completedByFamilyMemberId,
      completedAt: input.completedAt !== undefined ? input.completedAt : current.completedAt,
      cancelledByFamilyMemberId: input.cancelledByFamilyMemberId !== undefined ? input.cancelledByFamilyMemberId : current.cancelledByFamilyMemberId,
      cancelledAt: input.cancelledAt !== undefined ? input.cancelledAt : current.cancelledAt,
      metadata: input.metadata ?? current.metadata,
      updatedAt: input.now,
    };
    this.events[index] = updated;
    return updated;
  }

  async upsertResponse(input: UpsertEventResponseInput): Promise<FamilyEventResponseRecord> {
    const event = this.events.find((item) => item.id === input.eventId);
    if (!event) throw new Error('event not found');
    const existing = event.responses.find((item) => item.familyMemberId === input.familyMemberId);
    const response: FamilyEventResponseRecord = {
      id: existing?.id ?? randomUUID(),
      eventId: input.eventId,
      familyMemberId: input.familyMemberId,
      displayName: existing?.displayName ?? input.familyMemberId,
      response: input.response,
      respondedAt: input.now,
      note: input.note ?? null,
      metadata: input.metadata ?? existing?.metadata ?? {},
      createdAt: existing?.createdAt ?? input.now,
      updatedAt: input.now,
    };
    event.responses = [...event.responses.filter((item) => item.familyMemberId !== input.familyMemberId), response];
    event.updatedAt = input.now;
    return response;
  }

  async removeResponse(eventId: string, familyMemberId: string, now: string): Promise<FamilyEventResponseRecord> {
    return this.upsertResponse({ eventId, familyMemberId, response: 'declined', now });
  }

  async upsertAttendance(input: UpsertEventAttendanceInput): Promise<FamilyEventAttendanceRecord> {
    const event = this.events.find((item) => item.id === input.eventId);
    if (!event) throw new Error('event not found');
    const existing = event.attendance.find((item) => item.familyMemberId === input.familyMemberId);
    const attendance: FamilyEventAttendanceRecord = {
      id: existing?.id ?? randomUUID(),
      eventId: input.eventId,
      familyMemberId: input.familyMemberId,
      displayName: existing?.displayName ?? input.familyMemberId,
      status: input.status,
      confirmedByFamilyMemberId: input.confirmedByFamilyMemberId,
      confirmedAt: input.now,
      note: input.note ?? null,
      metadata: input.metadata ?? existing?.metadata ?? {},
      createdAt: existing?.createdAt ?? input.now,
      updatedAt: input.now,
    };
    event.attendance = [...event.attendance.filter((item) => item.familyMemberId !== input.familyMemberId), attendance];
    event.updatedAt = input.now;
    return attendance;
  }
}
