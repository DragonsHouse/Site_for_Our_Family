import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { mapBackendCalendarItem, mapBackendFamilyEvent, mapDragonEventCreateInput } from '../lib/family-events-backend-mapper.ts';
import { assertBackendCalendarResponse, assertBackendEventListResponse } from '../lib/family-events-backend-response.ts';

describe('family events backend integration', () => {
  it('maps backend standalone events to DragonEvent without technical ids in visible fields', () => {
    const event = mapBackendFamilyEvent(backendEvent());
    assert.equal(event.backendEventId, 'event-id');
    assert.equal(event.source.sourceModule, 'events');
    assert.equal(event.owner.backendMemberId, 'member-id');
    assert.equal(event.participantCount, 1);
    assert.equal(event.calendar.stableEventKey, 'events:event-id');
    assert.equal(event.location.label, 'HQ');
  });

  it('maps unified calendar feed and keeps Tower Defense as a projection source', () => {
    const response = assertBackendCalendarResponse({
      items: [
        {
          id: 'family_events:event-id',
          sourceModule: 'family_events',
          sourceId: 'event-id',
          title: 'Family Meeting',
          startsAt: '2026-08-20T18:00:00.000Z',
          endsAt: null,
          status: 'scheduled',
          type: 'family_meeting',
          metadata: { category: 'meeting', organizerFamilyMemberId: 'member-id' },
        },
        {
          id: 'tower_defense:tower-defense:key',
          sourceModule: 'tower_defense',
          sourceId: 'defense-id',
          title: 'Tower Defense',
          startsAt: '2026-08-20T20:00:00.000Z',
          endsAt: null,
          status: 'scheduled',
          type: 'tower_defense',
          metadata: { eventProjectionKey: 'tower-defense:key', towerCode: 'LS-01', towerName: 'Legion Square' },
        },
      ],
    });
    const mapped = response.items.map(mapBackendCalendarItem);
    assert.deepEqual(mapped.map((item) => item.source.sourceModule), ['events', 'tower_defense']);
    assert.equal(mapped[1]!.backendEventId, 'defense-id');
    assert.equal(mapped[1]!.towerDefense?.towerCode, 'LS-01');
  });

  it('keeps backend [] empty and rejects malformed event payloads', () => {
    assert.deepEqual(assertBackendEventListResponse({ items: [] }).items, []);
    assert.throws(() => assertBackendEventListResponse({ items: [{ id: 'broken' }] }), /malformed/i);
  });

  it('maps create payloads to backend familyMemberId and does not create Tower Defense events', () => {
    const payload = mapDragonEventCreateInput({
      ...mapBackendFamilyEvent(backendEvent()),
      type: 'tower_defense',
      category: 'defense',
    });
    assert.equal(payload.organizerFamilyMemberId, 'member-id');
    assert.equal(payload.eventType, 'custom');
    assert.equal(payload.category, 'custom');
  });

  it('wires production Events and Calendar to backend adapters without mock fallback', () => {
    const shell = readFileSync(new URL('../entrypoints/dashboard/family/family-shell.tsx', import.meta.url), 'utf8');
    const adapter = readFileSync(new URL('../lib/family-events-read-adapter.ts', import.meta.url), 'utf8');

    assert.match(shell, /createBackendDragonEventRepository/u);
    assert.match(shell, /mode: 'standalone-events'/u);
    assert.match(shell, /mode: 'unified-calendar'/u);
    assert.match(shell, /includeBirthdayEvents: false/u);
    assert.match(shell, /currentUser=\{currentUser\}/u);
    assert.match(adapter, /listBackendFamilyEvents/u);
    assert.match(adapter, /listBackendFamilyCalendar/u);
    assert.doesNotMatch(adapter, /mockDragonEventRepository/u);
    assert.match(adapter, /type === 'tower_defense'[\s\S]*return 'tower_defense'/u);
  });

  it('backs all Family Event write actions with backend operations', () => {
    const client = readFileSync(new URL('../lib/family-events-backend-client.ts', import.meta.url), 'utf8');
    const operations = readFileSync(new URL('../lib/family-events-backend-operations.ts', import.meta.url), 'utf8');

    assert.match(client, /createBackendFamilyEvent/u);
    assert.match(client, /updateBackendFamilyEvent/u);
    assert.match(client, /respondBackendFamilyEvent/u);
    assert.match(client, /withdrawBackendFamilyEventResponse/u);
    assert.match(client, /confirmBackendFamilyEventAttendance/u);
    assert.match(client, /startBackendFamilyEvent/u);
    assert.match(client, /completeBackendFamilyEvent/u);
    assert.match(client, /cancelBackendFamilyEvent/u);
    assert.match(client, /\/api\/family\/events/u);
    assert.match(client, /\/respond/u);
    assert.match(client, /\/responses\/me\/withdraw/u);
    assert.match(client, /\/attendance/u);
    assert.match(client, /\/start/u);
    assert.match(client, /\/complete/u);
    assert.match(client, /\/cancel/u);
    assert.match(operations, /requireBackendFamilyEventId/u);
    assert.match(operations, /Only standalone Family Events/u);
    assert.doesNotMatch(operations, /mockDragonEventRepository/u);
  });

  it('keeps frontend mutations server-confirmed and guarded from duplicate clicks', () => {
    const eventsUi = readFileSync(new URL('../entrypoints/dashboard/family/dragon-events.tsx', import.meta.url), 'utf8');

    assert.match(eventsUi, /const \[mutatingKey/u);
    assert.match(eventsUi, /if \(mutatingKey\) return/u);
    assert.match(eventsUi, /disabled=\{Boolean\(mutatingKey\)/u);
    assert.match(eventsUi, /engine\.refresh\(\)/u);
    assert.match(eventsUi, /setMutationError/u);
    assert.match(eventsUi, /currentUser\.id/u);
    assert.match(eventsUi, /respondFamilyEventFromBackend\(detailsEvent, currentUser\.id/u);
    assert.match(eventsUi, /createFamilyEventFromBackend/u);
    assert.match(eventsUi, /updateFamilyEventFromBackend/u);
    assert.match(eventsUi, /withdrawFamilyEventResponseFromBackend/u);
    assert.match(eventsUi, /confirmFamilyEventAttendanceFromBackend/u);
    assert.match(eventsUi, /startFamilyEventFromBackend/u);
    assert.match(eventsUi, /completeFamilyEventFromBackend/u);
    assert.match(eventsUi, /cancelFamilyEventFromBackend/u);
    assert.doesNotMatch(eventsUi, /mockDragonEventRepository/u);
  });

  it('renders management actions only through current policy signals', () => {
    const eventsUi = readFileSync(new URL('../entrypoints/dashboard/family/dragon-events.tsx', import.meta.url), 'utf8');

    assert.match(eventsUi, /rankLevel >= 8/u);
    assert.match(eventsUi, /manage_events/u);
    assert.match(eventsUi, /event\.owner\.backendMemberId === user\.id/u);
    assert.match(eventsUi, /canManage \? \(/u);
    assert.match(eventsUi, /RESPONSE_CHOICES/u);
    assert.match(eventsUi, /ATTENDANCE_CHOICES/u);
    assert.match(eventsUi, /interested/u);
    assert.match(eventsUi, /joining/u);
    assert.match(eventsUi, /confirmed/u);
    assert.match(eventsUi, /declined/u);
    assert.match(eventsUi, /present/u);
    assert.match(eventsUi, /late/u);
    assert.match(eventsUi, /absent/u);
    assert.match(eventsUi, /excused/u);
  });

  it('supports calendar source filters and keeps birthdays as a separate projection', () => {
    const calendarModels = readFileSync(new URL('../entrypoints/dashboard/family/calendar-models.ts', import.meta.url), 'utf8');
    const calendarState = readFileSync(new URL('../entrypoints/dashboard/family/calendar-state.ts', import.meta.url), 'utf8');
    const calendarService = readFileSync(new URL('../entrypoints/dashboard/family/calendar-service.ts', import.meta.url), 'utf8');
    const calendarUi = readFileSync(new URL('../entrypoints/dashboard/family/dragon-calendar.tsx', import.meta.url), 'utf8');
    const eventService = readFileSync(new URL('../entrypoints/dashboard/family/dragon-event-service.ts', import.meta.url), 'utf8');

    assert.match(calendarModels, /DragonCalendarSourceModule/u);
    assert.match(calendarState, /sourceModule: 'all'/u);
    assert.match(calendarService, /filters\.sourceModule === 'all'/u);
    assert.match(calendarUi, /SOURCE_OPTIONS/u);
    assert.match(calendarUi, /Family Events/u);
    assert.match(calendarUi, /Tower Defense/u);
    assert.match(calendarUi, /Family Quests/u);
    assert.match(calendarUi, /Birthdays/u);
    assert.match(calendarUi, /sourceLabel/u);
    assert.match(eventService, /sourceModule === 'tower_defense'[\s\S]*return 'tower_defense'/u);
    assert.match(eventService, /sourceModule === 'quest_board'[\s\S]*return 'family_quests'/u);
    assert.match(eventService, /sourceModule === 'birthday'[\s\S]*return 'birthday'/u);
    assert.match(eventService, /source: \{ sourceModule: 'birthday'/u);
    assert.doesNotMatch(eventService, /family_events:.*birthday/u);
  });
});

function backendEvent() {
  return {
    id: 'event-id',
    title: 'Family Meeting',
    description: '',
    eventType: 'family_meeting',
    category: 'meeting',
    status: 'scheduled',
    priority: 'normal',
    startsAt: '2026-08-20T18:00:00.000Z',
    endsAt: null,
    timezone: 'Europe/Kiev',
    allDay: false,
    locationLabel: 'HQ',
    createdByFamilyMemberId: 'owner-id',
    createdByDisplayName: 'Owner',
    organizerFamilyMemberId: 'member-id',
    organizerDisplayName: 'Member',
    maxParticipants: null,
    visibility: 'members',
    notes: null,
    completedByFamilyMemberId: null,
    completedAt: null,
    cancelledByFamilyMemberId: null,
    cancelledAt: null,
    metadata: { tags: ['meeting'] },
    createdAt: '2026-08-19T18:00:00.000Z',
    updatedAt: '2026-08-19T18:00:00.000Z',
    participantCount: 1,
    confirmedCount: 1,
    presentCount: 0,
    responses: [{
      id: 'response-id',
      eventId: 'event-id',
      familyMemberId: 'member-id',
      displayName: 'Member',
      response: 'confirmed',
      respondedAt: '2026-08-19T19:00:00.000Z',
      note: null,
      metadata: {},
      createdAt: '2026-08-19T19:00:00.000Z',
      updatedAt: '2026-08-19T19:00:00.000Z',
    }],
    attendance: [],
  };
}
