import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const calendarSource = readFileSync(new URL('../entrypoints/dashboard/family/dragon-calendar.tsx', import.meta.url), 'utf8');
const modelsSource = readFileSync(new URL('../entrypoints/dashboard/family/calendar-models.ts', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../entrypoints/dashboard/family/calendar-service.ts', import.meta.url), 'utf8');
const stateSource = readFileSync(new URL('../entrypoints/dashboard/family/calendar-state.ts', import.meta.url), 'utf8');
const mockSource = readFileSync(new URL('../entrypoints/dashboard/family/calendar-mock-data.ts', import.meta.url), 'utf8');
const styleSource = readFileSync(new URL('../entrypoints/dashboard/style.css', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

describe('Dragon Calendar production module source contract', () => {
  it('separates event models, dummy data, repository service and calendar state', () => {
    assert.match(modelsSource, /export type DragonCalendarEvent/);
    assert.match(modelsSource, /DragonCalendarCategory/);
    assert.match(mockSource, /DRAGON_CALENDAR_MOCK_EVENTS/);
    assert.match(serviceSource, /export type DragonCalendarRepository/);
    assert.match(serviceSource, /mockDragonCalendarRepository/);
    assert.match(stateSource, /useDragonCalendarState/);
    assert.doesNotMatch(serviceSource, /fetch\(/);
    assert.doesNotMatch(calendarSource, /fetch\(/);
  });

  it('supports month, week and agenda views with navigation controls', () => {
    assert.match(modelsSource, /'month' \| 'week' \| 'agenda'/);
    assert.match(calendarSource, /DRAGON_CALENDAR_VIEW_TABS/);
    assert.match(calendarSource, /calendar\.goToToday/);
    assert.match(calendarSource, /calendar\.goToPrevious/);
    assert.match(calendarSource, /calendar\.goToNext/);
    assert.match(calendarSource, /dh-calendar-month-view/);
    assert.match(calendarSource, /dh-calendar-week-view/);
    assert.match(calendarSource, /dh-calendar-agenda-view/);
  });

  it('covers Dragon House event categories and visual category styling', () => {
    [
      'dragon_meeting',
      'birthday',
      'celebration',
      'war_event',
      'quest',
      'ritual',
      'resource',
      'personal'
    ].forEach((category) => {
      assert.match(modelsSource, new RegExp(category));
    });
    ['dragon_meeting', 'celebration', 'war_event', 'quest', 'ritual', 'resource', 'personal'].forEach((category) => {
      assert.match(mockSource, new RegExp(category));
    });
    assert.match(stateSource, /useDragonBirthdayState/);
    assert.match(stateSource, /mergeDragonCalendarBirthdayEvents/);
    assert.doesNotMatch(mockSource, /category: 'birthday'/);

    [
      'dh-calendar-category-dragon-meeting',
      'dh-calendar-category-birthday',
      'dh-calendar-category-war-event',
      'dh-calendar-category-ritual'
    ].forEach((className) => assert.match(styleSource, new RegExp(className)));
  });

  it('renders production calendar affordances through Dragon UI primitives', () => {
    [
      'DragonHero',
      'DragonPanel',
      'DragonSection',
      'DragonTabs',
      'DragonInput',
      'DragonSelect',
      'DragonButton',
      'DragonCard',
      'DragonBadge',
      'DragonTooltip',
      'DragonDialog',
      'DragonEmptyState'
    ].forEach((name) => assert.match(calendarSource, new RegExp(name)));

    assert.match(calendarSource, /calendar\.filters\.search/);
    assert.match(calendarSource, /calendar\.filters\.category/);
    assert.match(calendarSource, /calendar\.filters\.member/);
    assert.match(calendarSource, /calendar\.filters\.dateFrom/);
    assert.match(calendarSource, /calendar\.filters\.dateTo/);
    assert.match(calendarSource, /has-birthday/);
    assert.match(calendarSource, /has-critical/);
    assert.match(calendarSource, /dh-calendar-overflow/);
  });

  it('opens DragonDialog event details with future integration placeholders', () => {
    assert.match(calendarSource, /calendar\.selectedEvent/);
    assert.match(calendarSource, /DragonDialog title=\{calendar\.selectedEvent\.title\}/);
    assert.match(calendarSource, /Attachments/);
    assert.match(calendarSource, /Comments/);
    assert.match(calendarSource, /participants\.map/);
    assert.match(calendarSource, /calendar\.setSelectedEvent\(null\)/);
  });

  it('runs in the frontend test suite', () => {
    assert.match(packageJson.scripts['test:auth-source'], /tests\/dragon-calendar-module\.test\.ts/);
  });
});
