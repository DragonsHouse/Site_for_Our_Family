import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  getDragonDialogFocusableElements,
  getDragonDialogTabTarget
} from '../entrypoints/dashboard/dragon-ui/use-dragon-dialog-focus.ts';

const calendarStateSource = readFileSync(new URL('../entrypoints/dashboard/family/calendar-state.ts', import.meta.url), 'utf8');
const birthdayStateSource = readFileSync(new URL('../entrypoints/dashboard/family/birthday-state.ts', import.meta.url), 'utf8');
const calendarCompositionSource = readFileSync(new URL('../entrypoints/dashboard/family/calendar-composition.ts', import.meta.url), 'utf8');
const calendarSource = readFileSync(new URL('../entrypoints/dashboard/family/dragon-calendar.tsx', import.meta.url), 'utf8');
const dragonUiSource = readFileSync(new URL('../entrypoints/dashboard/dragon-ui/dragon-ui.tsx', import.meta.url), 'utf8');
const dialogFocusSource = readFileSync(new URL('../entrypoints/dashboard/dragon-ui/use-dragon-dialog-focus.ts', import.meta.url), 'utf8');
const achievementsSource = readFileSync(new URL('../entrypoints/dashboard/family/dragon-achievements.tsx', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

function focusableElement(label: string) {
  return {
    label,
    offsetWidth: 1,
    offsetHeight: 1,
    getClientRects: () => [1],
    getAttribute: () => null,
    hasAttribute: () => false
  };
}

function focusContainer(elements: Array<ReturnType<typeof focusableElement>>) {
  return {
    offsetWidth: 1,
    offsetHeight: 1,
    getClientRects: () => [1],
    getAttribute: () => null,
    hasAttribute: () => false,
    querySelectorAll: () => elements,
    contains: (element: unknown) => elements.includes(element as ReturnType<typeof focusableElement>)
  };
}

describe('Dragon production foundation hardening', () => {
  it('uses an explicit Calendar and Birthday repository composition boundary', () => {
    assert.match(calendarStateSource, /export type DragonCalendarStateDependencies/);
    assert.match(calendarStateSource, /eventRepository: DragonEventRepository/);
    assert.match(calendarStateSource, /membersRepository: DragonMembersRepository/);
    assert.match(calendarStateSource, /dependencies\.eventRepository/);
    assert.match(calendarStateSource, /membersRepository: dependencies\.membersRepository/);
    assert.doesNotMatch(calendarStateSource, /mockDragonEventRepository|mockDragonMembersRepository/);
    assert.doesNotMatch(calendarStateSource, /useDragonBirthdayState\(undefined/);

    assert.match(birthdayStateSource, /export type DragonBirthdayStateDependencies/);
    assert.match(birthdayStateSource, /membersRepository: DragonMembersRepository/);
    assert.doesNotMatch(birthdayStateSource, /mockDragonMembersRepository/);
    assert.match(calendarCompositionSource, /createDragonCalendarStateDependencies/);
    assert.match(calendarCompositionSource, /createMockDragonCalendarStateDependencies/);
    assert.match(calendarSource, /dependencies\?: DragonCalendarStateDependencies/);
  });

  it('keeps calendar and birthday merge behavior isolated from mock event duplication', () => {
    assert.match(calendarStateSource, /mergeDragonEvents/);
    assert.match(calendarStateSource, /buildDragonBirthdayEvents/);
    assert.match(calendarStateSource, /mapDragonEventsToCalendarEvents/);
    assert.match(calendarStateSource, /todayKey/);
    assert.match(birthdayStateSource, /buildDragonBirthdayCalendarEvents/);
    assert.match(birthdayStateSource, /sortUpcomingDragonBirthdays\(birthdays, dependencies\.todayKey\)/);
  });

  it('implements DragonDialog focus lifecycle and modal keyboard behavior in a shared hook', () => {
    [
      'useDragonDialogFocus',
      'initialFocusRef',
      'closeOnEscape',
      'restoreFocus',
      'lockBodyScroll',
      'keydown',
      'focusin',
      'removeEventListener',
      'preventDefault',
      'previouslyFocused'
    ].forEach((token) => assert.match(dialogFocusSource, new RegExp(token)));

    assert.match(dragonUiSource, /useDragonDialogFocus/);
    assert.match(dragonUiSource, /aria-modal="true"/);
    assert.match(dragonUiSource, /tabIndex=\{-1\}/);
    assert.match(dragonUiSource, /aria-describedby=\{ariaDescribedBy\}/);
    assert.match(dragonUiSource, /closeOnBackdrop/);
  });

  it('wraps Tab and Shift+Tab within dialog focus targets and falls back to the container', () => {
    const first = focusableElement('first');
    const last = focusableElement('last');
    const container = focusContainer([first, last]);
    const emptyContainer = focusContainer([]);

    assert.deepEqual(getDragonDialogFocusableElements(container as never), [first, last]);
    assert.equal(getDragonDialogTabTarget(container as never, last as never, false), first);
    assert.equal(getDragonDialogTabTarget(container as never, first as never, true), last);
    assert.equal(getDragonDialogTabTarget(emptyContainer as never, null, false), emptyContainer);
  });

  it('adds pressed state to achievement completion toggles and keyboard movement to Dragon navigation', () => {
    assert.match(achievementsSource, /aria-pressed=\{filters\.completion === 'unlocked'\}/);
    assert.match(achievementsSource, /aria-pressed=\{filters\.completion === 'locked'\}/);
    assert.match(dragonUiSource, /ArrowLeft/);
    assert.match(dragonUiSource, /ArrowRight/);
    assert.match(dragonUiSource, /Home/);
    assert.match(dragonUiSource, /onKeyDown=\{handleKeyDown\}/);
  });

  it('runs in the frontend test suite', () => {
    assert.match(packageJson.scripts['test:auth-source'], /tests\/dragon-foundation-hardening\.test\.ts/);
  });
});
