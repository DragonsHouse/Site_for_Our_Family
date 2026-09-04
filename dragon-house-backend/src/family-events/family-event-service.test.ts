import { describe, expect, it } from 'vitest';
import type { FamilyAuthContext } from '../types.js';
import { MemoryFamilyEventRepository } from './family-event-repository.js';
import { FamilyEventService } from './family-event-service.js';

const ownerId = 'owner-id';
const memberId = 'member-id';
const eventId = 'event-id';

describe('FamilyEventService', () => {
  it('creates, updates and lists standalone events with computed participant counts', async () => {
    const { service } = harness();
    const created = await service.createEvent({
      title: 'War Council',
      eventType: 'family_meeting',
      category: 'meeting',
      status: 'scheduled',
      startsAt: '2026-08-20T18:00:00.000Z',
      endsAt: '2026-08-20T19:00:00.000Z',
      organizerFamilyMemberId: ownerId,
    }, auth(ownerId, 'owner'));
    expect(created).toMatchObject({ title: 'War Council', status: 'scheduled', participantCount: 0 });

    const updated = await service.updateEvent(created.id, { locationLabel: 'HQ', priority: 'high' }, auth(ownerId, 'owner'));
    expect(updated).toMatchObject({ locationLabel: 'HQ', priority: 'high' });

    const listed = await service.listEvents({ status: 'scheduled' }, auth(memberId));
    expect(listed.items.map((event) => event.id)).toContain(created.id);
  });

  it('allows self response changes idempotently and blocks ordinary member writes', async () => {
    const { service } = harness();
    await expect(service.createEvent({
      title: 'Blocked',
      eventType: 'custom',
      startsAt: '2026-08-20T18:00:00.000Z',
    }, auth(memberId))).rejects.toMatchObject({ code: 'FAMILY_EVENT_PERMISSION_DENIED' });

    const first = await service.respond(eventId, { response: 'joining' }, auth(memberId), new Date('2026-08-18T10:00:00.000Z'));
    const second = await service.respond(eventId, { response: 'confirmed' }, auth(memberId), new Date('2026-08-18T11:00:00.000Z'));
    expect(second.id).toBe(first.id);
    expect(second.response).toBe('confirmed');
    const event = await service.getEvent(eventId, auth(memberId));
    expect(event.responses).toHaveLength(1);
    expect(event.confirmedCount).toBe(1);
  });

  it('supports attendance, start, complete and invalid transition protection', async () => {
    const { service } = harness();
    await service.respond(eventId, { familyMemberId: memberId, response: 'confirmed' }, auth(ownerId, 'owner'));
    const attendance = await service.confirmAttendance(eventId, { familyMemberId: memberId, status: 'late' }, auth(ownerId, 'owner'));
    expect(attendance).toMatchObject({ familyMemberId: memberId, status: 'late', confirmedByFamilyMemberId: ownerId });

    const started = await service.startEvent(eventId, auth(ownerId, 'owner'));
    expect(started.status).toBe('active');

    const completed = await service.completeEvent(eventId, auth(ownerId, 'owner'));
    expect(completed.event.status).toBe('completed');
    expect(completed.completion).toMatchObject({ eventId, participantIds: [memberId], organizerFamilyMemberId: ownerId });

    await expect(service.cancelEvent(eventId, { reason: 'closed' }, auth(ownerId, 'owner'))).rejects.toMatchObject({ code: 'FAMILY_EVENT_INVALID_TRANSITION' });
  });

  it('requires a relevant response before attendance and lets organizer manage own event', async () => {
    const { service } = harness();
    await expect(service.confirmAttendance(eventId, { familyMemberId: memberId, status: 'present' }, auth(ownerId, 'owner'))).rejects.toMatchObject({
      code: 'FAMILY_EVENT_INVALID_ATTENDANCE_MEMBER',
    });
    await expect(service.updateEvent(eventId, { notes: 'organizer edit' }, auth(ownerId))).resolves.toMatchObject({ notes: 'organizer edit' });
  });

  it('blocks nonexistent members and closed event responses', async () => {
    const { service } = harness();
    await expect(service.respond(eventId, { familyMemberId: 'missing-id', response: 'joining' }, auth(ownerId, 'owner'))).rejects.toMatchObject({
      code: 'FAMILY_EVENT_MEMBER_NOT_FOUND',
    });
    await service.startEvent(eventId, auth(ownerId, 'owner'));
    await service.completeEvent(eventId, auth(ownerId, 'owner'));
    await expect(service.respond(eventId, { response: 'joining' }, auth(memberId))).rejects.toMatchObject({ code: 'FAMILY_EVENT_INVALID_TRANSITION' });
  });
});

function harness() {
  const repository = new MemoryFamilyEventRepository([{
    id: eventId,
    title: 'Family Training',
    description: '',
    eventType: 'training',
    category: 'training',
    status: 'scheduled',
    priority: 'normal',
    startsAt: '2026-08-19T18:00:00.000Z',
    endsAt: null,
    timezone: 'Europe/Kiev',
    allDay: false,
    locationLabel: null,
    createdByFamilyMemberId: ownerId,
    createdByDisplayName: 'Owner',
    organizerFamilyMemberId: ownerId,
    organizerDisplayName: 'Owner',
    maxParticipants: null,
    visibility: 'members',
    notes: null,
    completedByFamilyMemberId: null,
    completedAt: null,
    cancelledByFamilyMemberId: null,
    cancelledAt: null,
    metadata: {},
    createdAt: '2026-08-18T09:00:00.000Z',
    updatedAt: '2026-08-18T09:00:00.000Z',
    responses: [],
    attendance: [],
  }], [ownerId, memberId]);
  return { service: new FamilyEventService(repository) };
}

function auth(id: string, role: FamilyAuthContext['role'] = 'member'): FamilyAuthContext {
  return {
    familyMemberId: id,
    role,
    rank: role === 'owner' ? 10 : 2,
    status: 'active',
    permissions: role === 'owner' ? ['manage_events'] : [],
  };
}
