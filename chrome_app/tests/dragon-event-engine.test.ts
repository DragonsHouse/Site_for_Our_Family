import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DRAGON_EVENT_MOCK_DATA } from '../entrypoints/dashboard/family/dragon-event-mock-data.ts';
import {
  DEFAULT_DRAGON_EVENT_FILTERS,
  buildDragonBirthdayEvents,
  filterDragonEvents,
  getDragonEventStatistics,
  getDragonEventTimeline,
  mapDragonEventsToCalendarEvents,
  mergeDragonEvents,
  sortDragonEvents
} from '../entrypoints/dashboard/family/dragon-event-service.ts';

const modelsSource = readFileSync(new URL('../entrypoints/dashboard/family/dragon-event-models.ts', import.meta.url), 'utf8');
const repositorySource = readFileSync(new URL('../entrypoints/dashboard/family/dragon-event-repository.ts', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../entrypoints/dashboard/family/dragon-event-service.ts', import.meta.url), 'utf8');
const stateSource = readFileSync(new URL('../entrypoints/dashboard/family/dragon-event-state.ts', import.meta.url), 'utf8');
const mockSource = readFileSync(new URL('../entrypoints/dashboard/family/dragon-event-mock-data.ts', import.meta.url), 'utf8');
const screenSource = readFileSync(new URL('../entrypoints/dashboard/family/dragon-events.tsx', import.meta.url), 'utf8');
const calendarStateSource = readFileSync(new URL('../entrypoints/dashboard/family/calendar-state.ts', import.meta.url), 'utf8');
const profileStateSource = readFileSync(new URL('../entrypoints/dashboard/family/profile-state.ts', import.meta.url), 'utf8');
const shellSource = readFileSync(new URL('../entrypoints/dashboard/family/family-shell.tsx', import.meta.url), 'utf8');
const styleSource = readFileSync(new URL('../entrypoints/dashboard/style.css', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

describe('Dragon Event Engine', () => {
  it('defines a generic backend-ready event model and repository boundary', () => {
    assert.match(modelsSource, /export type DragonEvent = DragonEntity/);
    assert.match(repositorySource, /Repository<DragonEvent/);
    assert.match(repositorySource, /mockDragonEventRepository/);
    assert.match(repositorySource, /createMockRepository/);
    assert.match(stateSource, /useDragonCollection/);
    assert.match(stateSource, /eventRepository: DragonEventRepository/);
    assert.doesNotMatch(screenSource, /DRAGON_EVENT_MOCK_DATA/);
    assert.doesNotMatch(screenSource, /mockDragonEventRepository/);
    assert.doesNotMatch(screenSource, /fetch\(/);
  });

  it('covers required event fields, types, metadata and integration points', () => {
    [
      'backendEventId',
      'type',
      'category',
      'status',
      'priority',
      'visibility',
      'owner',
      'creator',
      'participants',
      'participantCount',
      'maxParticipants',
      'location',
      'calendar',
      'startsAt',
      'endsAt',
      'allDay',
      'timezone',
      'repeat',
      'tags',
      'rewards',
      'xp',
      'achievementIds',
      'questIds',
      'towerDefense',
      'resources',
      'birthday',
      'notifications',
      'discord',
      'source',
      'futureMetadata'
    ].forEach((field) => assert.match(modelsSource, new RegExp(field)));

    [
      'family_meeting',
      'birthday',
      'quest',
      'tower_defense',
      'celebration',
      'training',
      'resource_run',
      'patrol',
      'war',
      'announcement',
      'custom'
    ].forEach((type) => {
      assert.match(modelsSource, new RegExp(type));
    });
    ['family_meeting', 'quest', 'tower_defense', 'resource_run', 'announcement', 'custom'].forEach((type) => {
      assert.match(mockSource, new RegExp(type));
    });
  });

  it('filters and sorts event data without React business logic', () => {
    const questEvents = filterDragonEvents(DRAGON_EVENT_MOCK_DATA, { ...DEFAULT_DRAGON_EVENT_FILTERS, type: 'quest' });
    assert.equal(questEvents.length, 1);
    assert.equal(questEvents[0].type, 'quest');

    const criticalFirst = sortDragonEvents(DRAGON_EVENT_MOCK_DATA, 'priority', '2026-07-28');
    assert.equal(criticalFirst[0].priority, 'critical');

    const searchResults = filterDragonEvents(DRAGON_EVENT_MOCK_DATA, { ...DEFAULT_DRAGON_EVENT_FILTERS, search: 'treasury' });
    assert.equal(searchResults.some((event) => event.id === 'event-resource-audit'), true);
    assert.doesNotMatch(screenSource, /reduce<Record|sortDragonEvents|filterDragonEvents/);
  });

  it('calculates statistics, timeline entries and calendar projection', () => {
    const statistics = getDragonEventStatistics(DRAGON_EVENT_MOCK_DATA, '2026-07-28');
    assert.equal(statistics.total, DRAGON_EVENT_MOCK_DATA.length);
    assert.equal(statistics.today, 1);
    assert.equal(statistics.critical, 2);
    assert.equal(statistics.totalXp > 0, true);

    const timeline = getDragonEventTimeline(DRAGON_EVENT_MOCK_DATA, 3);
    assert.equal(timeline.length, 3);
    assert.match(timeline[0].backendEventId, /^evt_/);

    const calendarEvents = mapDragonEventsToCalendarEvents(DRAGON_EVENT_MOCK_DATA);
    assert.equal(calendarEvents.some((event) => event.category === 'quest'), true);
    assert.equal(calendarEvents.some((event) => event.category === 'birthday'), false);
  });

  it('generates birthday events as Dragon Events and prevents duplicate calendar seals', () => {
    const birthdays = [
      {
        id: 'birthday-visible',
        memberId: 'member-visible',
        memberName: 'Visible Dragon',
        date: { month: 7, day: 28 },
        visibility: 'visible',
        showAge: false,
        source: 'member_profile',
        backendField: 'dateOfBirth',
        discordMemberField: 'discordUserId',
        notifications: { enabled: true, daysBefore: [0, 7], channels: ['hub'] },
        metadata: {}
      },
      {
        id: 'birthday-hidden',
        memberId: 'member-hidden',
        memberName: 'Hidden Dragon',
        date: { month: 7, day: 28 },
        visibility: 'hidden',
        showAge: false,
        source: 'member_profile',
        backendField: 'dateOfBirth',
        discordMemberField: 'discordUserId',
        notifications: { enabled: true, daysBefore: [0], channels: ['hub'] },
        metadata: {}
      }
    ] as const;
    const birthdayEvents = buildDragonBirthdayEvents([...birthdays], 2026, '2026-07-28');
    assert.equal(birthdayEvents.length, 1);
    assert.equal(birthdayEvents[0].type, 'birthday');
    assert.equal(birthdayEvents[0].priority, 'high');

    const merged = mergeDragonEvents([birthdayEvents[0]], birthdayEvents);
    assert.equal(merged.length, 1);
  });

  it('integrates Calendar, Profile, Achievements and Hub through the Event Engine boundary', () => {
    assert.match(calendarStateSource, /eventRepository: DragonEventRepository/);
    assert.match(calendarStateSource, /mapDragonEventsToCalendarEvents/);
    assert.match(calendarStateSource, /buildDragonBirthdayEvents/);
    assert.match(profileStateSource, /eventRepository\?: DragonEventRepository/);
    assert.match(profileStateSource, /getDragonEventTimeline/);
    assert.match(modelsSource, /achievementIds: string\[\]/);
    assert.match(modelsSource, /rewards: DragonEventReward\[\]/);
    assert.match(modelsSource, /DragonEventTowerDefenseMetadata/);
    assert.match(shellSource, /activeTab === 'events' \? <DragonEventEngineScreen \/>/);
    assert.doesNotMatch(shellSource, /DashboardApp familyTab="events"/);
  });

  it('exports reusable Dragon Event UI components and styling hooks', () => {
    [
      'DragonEventEngineScreen',
      'DragonEventGallery',
      'DragonEventCard',
      'DragonEventDetails',
      'DragonEventFilters',
      'DragonEventTimeline',
      'DragonUpcomingEvents',
      'DragonTodayEvents',
      'DragonEventStatistics',
      'DragonEventEmptyState',
      'DragonEventLoadingState',
      'DragonEventErrorState'
    ].forEach((name) => assert.match(screenSource, new RegExp(`export function ${name}`)));

    ['DragonPanel', 'DragonCard', 'DragonDialog', 'DragonBadge', 'DragonProgress', 'DragonInput', 'DragonSelect'].forEach((primitive) => {
      assert.match(screenSource, new RegExp(primitive));
    });

    ['dh-event-engine', 'dh-event-gallery', 'dh-event-card', 'dh-event-details', 'dh-event-timeline', 'dh-event-statistics'].forEach((className) => {
      assert.match(styleSource, new RegExp(className));
    });
  });

  it('runs in the frontend test suite', () => {
    assert.match(packageJson.scripts['test:auth-source'], /tests\/dragon-event-engine\.test\.ts/);
  });
});
