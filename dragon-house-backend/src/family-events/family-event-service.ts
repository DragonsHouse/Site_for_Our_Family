import type { FamilyAuthContext } from '../types.js';
import { FamilyEventError } from './family-event-errors.js';
import type {
  CreateFamilyEventInput,
  FamilyEventAttendanceRecord,
  FamilyEventCompletionOutput,
  FamilyEventListQuery,
  FamilyEventRecord,
  FamilyEventResponseRecord,
  FamilyEventStatus,
  UpdateFamilyEventInput,
} from './family-event-models.js';
import type { FamilyEventRepository, UpsertEventAttendanceInput, UpsertEventResponseInput } from './family-event-repository.js';

export type FamilyEventDto = Omit<FamilyEventRecord, 'metadata'> & {
  participantCount: number;
  confirmedCount: number;
  presentCount: number;
  metadata: Record<string, unknown>;
};

const TRANSITIONS: Record<FamilyEventStatus, FamilyEventStatus[]> = {
  draft: ['scheduled', 'cancelled'],
  scheduled: ['active', 'cancelled'],
  active: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export class FamilyEventService {
  constructor(private readonly repository: FamilyEventRepository) {}

  async listEvents(query: FamilyEventListQuery, auth: FamilyAuthContext): Promise<{ items: FamilyEventDto[] }> {
    this.assertCanRead(auth);
    const items = (await this.repository.listEvents(query))
      .filter((event) => canReadEvent(auth, event))
      .map(toDto);
    return { items };
  }

  async getEvent(id: string, auth: FamilyAuthContext): Promise<FamilyEventDto> {
    const event = await this.requireEvent(id);
    if (!canReadEvent(auth, event)) throw new FamilyEventError('FAMILY_EVENT_PERMISSION_DENIED', 'Permission denied.', 403);
    return toDto(event);
  }

  async createEvent(input: CreateFamilyEventInput, auth: FamilyAuthContext, now = new Date()): Promise<FamilyEventDto> {
    this.assertCanManage(auth);
    await this.validateCreateOrUpdate(input);
    const organizerFamilyMemberId = input.organizerFamilyMemberId ?? auth.familyMemberId;
    await this.assertMemberExists(organizerFamilyMemberId);
    const created = await this.repository.createEvent({
      ...input,
      organizerFamilyMemberId,
      createdByFamilyMemberId: auth.familyMemberId,
      now: now.toISOString(),
    });
    return toDto(created);
  }

  async updateEvent(id: string, input: UpdateFamilyEventInput, auth: FamilyAuthContext, now = new Date()): Promise<FamilyEventDto> {
    const event = await this.requireEvent(id);
    this.assertCanManageEvent(auth, event);
    if (event.status === 'completed' || event.status === 'cancelled') {
      throw new FamilyEventError('FAMILY_EVENT_INVALID_TRANSITION', 'Closed events cannot be edited.', 409, { status: event.status });
    }
    await this.validateCreateOrUpdate(input, event);
    if (input.organizerFamilyMemberId) await this.assertMemberExists(input.organizerFamilyMemberId);
    const updated = await this.repository.updateEvent(id, { ...input, now: now.toISOString() });
    if (!updated) throw new FamilyEventError('FAMILY_EVENT_NOT_FOUND', 'Family event not found.', 404);
    return toDto(updated);
  }

  async respond(
    eventId: string,
    input: Omit<UpsertEventResponseInput, 'eventId' | 'familyMemberId' | 'now'> & { familyMemberId?: string },
    auth: FamilyAuthContext,
    now = new Date(),
  ): Promise<FamilyEventResponseRecord> {
    const event = await this.requireEvent(eventId);
    if (!canReadEvent(auth, event)) throw new FamilyEventError('FAMILY_EVENT_PERMISSION_DENIED', 'Permission denied.', 403);
    const familyMemberId = input.familyMemberId ?? auth.familyMemberId;
    if (familyMemberId !== auth.familyMemberId) this.assertCanManageEvent(auth, event);
    await this.assertMemberExists(familyMemberId);
    if (event.status === 'completed' || event.status === 'cancelled') {
      throw new FamilyEventError('FAMILY_EVENT_INVALID_TRANSITION', 'Cannot respond to a closed event.', 409, { status: event.status });
    }
    return this.repository.upsertResponse({ ...input, eventId, familyMemberId, now: now.toISOString() });
  }

  async withdrawResponse(eventId: string, auth: FamilyAuthContext, now = new Date()): Promise<FamilyEventResponseRecord> {
    const event = await this.requireEvent(eventId);
    if (!canReadEvent(auth, event)) throw new FamilyEventError('FAMILY_EVENT_PERMISSION_DENIED', 'Permission denied.', 403);
    if (event.status === 'completed' || event.status === 'cancelled') {
      throw new FamilyEventError('FAMILY_EVENT_INVALID_TRANSITION', 'Cannot withdraw from a closed event.', 409, { status: event.status });
    }
    return this.repository.removeResponse(eventId, auth.familyMemberId, now.toISOString());
  }

  async confirmAttendance(
    eventId: string,
    input: Omit<UpsertEventAttendanceInput, 'eventId' | 'confirmedByFamilyMemberId' | 'now'>,
    auth: FamilyAuthContext,
    now = new Date(),
  ): Promise<FamilyEventAttendanceRecord> {
    const event = await this.requireEvent(eventId);
    this.assertCanManageEvent(auth, event);
    await this.assertMemberExists(input.familyMemberId);
    const response = event.responses.find((item) => item.familyMemberId === input.familyMemberId);
    if (!response || response.response === 'declined') {
      throw new FamilyEventError('FAMILY_EVENT_INVALID_ATTENDANCE_MEMBER', 'Attendance member must have an active event response.', 409, {
        eventId,
        familyMemberId: input.familyMemberId,
      });
    }
    return this.repository.upsertAttendance({ ...input, eventId, confirmedByFamilyMemberId: auth.familyMemberId, now: now.toISOString() });
  }

  async startEvent(eventId: string, auth: FamilyAuthContext, now = new Date()): Promise<FamilyEventDto> {
    const event = await this.requireEvent(eventId);
    this.assertCanManageEvent(auth, event);
    this.assertTransition(event.status, 'active');
    const updated = await this.repository.updateEvent(eventId, { status: 'active', now: now.toISOString() });
    if (!updated) throw new FamilyEventError('FAMILY_EVENT_NOT_FOUND', 'Family event not found.', 404);
    return toDto(updated);
  }

  async completeEvent(eventId: string, auth: FamilyAuthContext, now = new Date()): Promise<{ event: FamilyEventDto; completion: FamilyEventCompletionOutput }> {
    const event = await this.requireEvent(eventId);
    this.assertCanManageEvent(auth, event);
    if (event.status !== 'active') {
      throw new FamilyEventError('FAMILY_EVENT_INVALID_TRANSITION', 'Only active events can be completed.', 409, { status: event.status });
    }
    const updated = await this.repository.updateEvent(eventId, {
      status: 'completed',
      completedByFamilyMemberId: auth.familyMemberId,
      completedAt: now.toISOString(),
      now: now.toISOString(),
    });
    if (!updated) throw new FamilyEventError('FAMILY_EVENT_NOT_FOUND', 'Family event not found.', 404);
    return { event: toDto(updated), completion: buildCompletionOutput(updated) };
  }

  async cancelEvent(eventId: string, input: { reason?: string | null }, auth: FamilyAuthContext, now = new Date()): Promise<FamilyEventDto> {
    const event = await this.requireEvent(eventId);
    this.assertCanManageEvent(auth, event);
    if (event.status === 'completed' || event.status === 'cancelled') {
      throw new FamilyEventError('FAMILY_EVENT_INVALID_TRANSITION', 'Event is already closed.', 409, { status: event.status });
    }
    const updated = await this.repository.updateEvent(eventId, {
      status: 'cancelled',
      notes: input.reason ?? event.notes,
      cancelledByFamilyMemberId: auth.familyMemberId,
      cancelledAt: now.toISOString(),
      now: now.toISOString(),
    });
    if (!updated) throw new FamilyEventError('FAMILY_EVENT_NOT_FOUND', 'Family event not found.', 404);
    return toDto(updated);
  }

  private async requireEvent(id: string): Promise<FamilyEventRecord> {
    const event = await this.repository.findEventById(id);
    if (!event) throw new FamilyEventError('FAMILY_EVENT_NOT_FOUND', 'Family event not found.', 404);
    return event;
  }

  private async validateCreateOrUpdate(input: Partial<Omit<CreateFamilyEventInput, 'status'>>, current?: FamilyEventRecord): Promise<void> {
    const startsAt = input.startsAt ?? current?.startsAt;
    const endsAt = input.endsAt !== undefined ? input.endsAt : current?.endsAt;
    if (startsAt && Number.isNaN(Date.parse(startsAt))) {
      throw new FamilyEventError('FAMILY_EVENT_INVALID_TIME_RANGE', 'startsAt must be a valid timestamp.', 400, { startsAt });
    }
    if (startsAt && endsAt && (Number.isNaN(Date.parse(endsAt)) || Date.parse(endsAt) < Date.parse(startsAt))) {
      throw new FamilyEventError('FAMILY_EVENT_INVALID_TIME_RANGE', 'endsAt cannot be before startsAt.', 400, { startsAt, endsAt });
    }
    if (input.maxParticipants !== undefined && input.maxParticipants !== null && input.maxParticipants < 1) {
      throw new FamilyEventError('VALIDATION_ERROR', 'maxParticipants must be positive.', 400, { maxParticipants: input.maxParticipants });
    }
  }

  private async assertMemberExists(id: string): Promise<void> {
    if (!(await this.repository.familyMemberExists(id))) {
      throw new FamilyEventError('FAMILY_EVENT_MEMBER_NOT_FOUND', 'Family member not found.', 404, { familyMemberId: id });
    }
  }

  private assertTransition(from: FamilyEventStatus, to: FamilyEventStatus): void {
    if (!TRANSITIONS[from].includes(to)) {
      throw new FamilyEventError('FAMILY_EVENT_INVALID_TRANSITION', `Cannot move event from ${from} to ${to}.`, 409, { from, to });
    }
  }

  private assertCanRead(auth: FamilyAuthContext): void {
    if (auth.status !== 'active') throw new FamilyEventError('FAMILY_EVENT_PERMISSION_DENIED', 'Inactive member.', 403);
  }

  private assertCanManage(auth: FamilyAuthContext): void {
    if (canManageFamilyEvents(auth)) return;
    throw new FamilyEventError('FAMILY_EVENT_PERMISSION_DENIED', 'Permission denied.', 403);
  }

  private assertCanManageEvent(auth: FamilyAuthContext, event: FamilyEventRecord): void {
    if (canManageFamilyEvents(auth) || event.organizerFamilyMemberId === auth.familyMemberId) return;
    throw new FamilyEventError('FAMILY_EVENT_PERMISSION_DENIED', 'Permission denied.', 403);
  }
}

export function canManageFamilyEvents(auth: FamilyAuthContext): boolean {
  return auth.role === 'owner' || auth.rank >= 8 || auth.permissions.includes('manage_events');
}

export function canReadEvent(auth: FamilyAuthContext, event: FamilyEventRecord): boolean {
  if (auth.status !== 'active') return false;
  if (event.visibility === 'public' || event.visibility === 'members') return true;
  if (event.organizerFamilyMemberId === auth.familyMemberId || event.createdByFamilyMemberId === auth.familyMemberId) return true;
  if (event.responses.some((response) => response.familyMemberId === auth.familyMemberId && response.response !== 'declined')) return true;
  if (event.visibility === 'leadership') return canManageFamilyEvents(auth);
  return canManageFamilyEvents(auth);
}

export function calculateFamilyEventCounts(event: FamilyEventRecord) {
  return {
    participantCount: event.responses.filter((item) => item.response !== 'declined').length,
    confirmedCount: event.responses.filter((item) => item.response === 'confirmed').length,
    presentCount: event.attendance.filter((item) => item.status === 'present' || item.status === 'late').length,
  };
}

export function buildCompletionOutput(event: FamilyEventRecord): FamilyEventCompletionOutput {
  return {
    eventId: event.id,
    participantIds: event.attendance.filter((item) => item.status === 'present' || item.status === 'late').map((item) => item.familyMemberId),
    organizerFamilyMemberId: event.organizerFamilyMemberId,
    attendance: event.attendance,
    status: 'completed',
    source: {
      sourceType: 'family_events',
      sourceId: event.id,
      sourceKey: `family-events:${event.id}`,
    },
  };
}

function toDto(event: FamilyEventRecord): FamilyEventDto {
  return {
    ...event,
    ...calculateFamilyEventCounts(event),
  };
}
