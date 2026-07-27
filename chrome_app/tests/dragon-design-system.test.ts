import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const uiSource = readFileSync(new URL('../entrypoints/dashboard/dragon-ui/dragon-ui.tsx', import.meta.url), 'utf8');
const backgroundSource = readFileSync(new URL('../entrypoints/dashboard/dragon-ui/dragon-background.tsx', import.meta.url), 'utf8');
const themeSource = readFileSync(new URL('../entrypoints/dashboard/dragon-ui/dragon-theme.ts', import.meta.url), 'utf8');
const styleSource = readFileSync(new URL('../entrypoints/dashboard/style.css', import.meta.url), 'utf8');
const shellSource = readFileSync(new URL('../entrypoints/dashboard/family/family-shell.tsx', import.meta.url), 'utf8');
const tabsSource = readFileSync(new URL('../entrypoints/dashboard/family/family-tabs.tsx', import.meta.url), 'utf8');
const calendarSource = readFileSync(new URL('../entrypoints/dashboard/family/dragon-calendar.tsx', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

describe('Dragon House design system source contract', () => {
  it('exports reusable Dragon UI primitives for future modules', () => {
    [
      'DragonBackground',
      'DragonButton',
      'DragonCard',
      'DragonPanel',
      'DragonInput',
      'DragonTextarea',
      'DragonSelect',
      'DragonDialog',
      'DragonTabs',
      'DragonBadge',
      'DragonToast',
      'DragonTooltip',
      'DragonAvatar',
      'DragonDivider',
      'DragonSection',
      'DragonLoader',
      'DragonProgress',
      'DragonEmptyState',
      'DragonHero'
    ].forEach((name) => assert.match(uiSource, new RegExp(`export function ${name}|export \\{ ${name}`)));
  });

  it('centralizes Dragon Fortress theme tokens and ambient animation names', () => {
    ['colors', 'radius', 'shadow', 'motion'].forEach((tokenGroup) => assert.match(themeSource, new RegExp(`${tokenGroup}:`)));
    [
      '--dragon-obsidian',
      '--dragon-metal',
      '--dragon-border-hot',
      '--dragon-shadow-ember',
      '--dragon-motion-ambient',
      '@keyframes dh-dragon-breathe',
      '@keyframes dh-dragon-smoke',
      '@keyframes dh-dragon-embers',
      '@media (prefers-reduced-motion: reduce)'
    ].forEach((pattern) => assert.match(styleSource, new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
  });

  it('provides reusable DragonBackground variants for core Hub rooms', () => {
    ['login', 'dashboard', 'calendar', 'members', 'profile', 'events', 'quests', 'resources'].forEach((variant) => {
      assert.match(themeSource, new RegExp(`'${variant}'`));
      assert.match(styleSource, new RegExp(`dh-dragon-bg-${variant}`));
    });

    assert.match(backgroundSource, /dh-dragon-bg-guardian/);
    assert.match(backgroundSource, /dh-dragon-bg-eye/);
    assert.match(backgroundSource, /dh-dragon-bg-embers/);
  });

  it('routes Family Hub shell and navigation through Dragon UI instead of generic dashboard tabs', () => {
    assert.match(shellSource, /<DragonBackground variant=\{TAB_BACKGROUND_VARIANT\[activeTab\]\}/);
    assert.match(shellSource, /<DragonHero/);
    assert.match(shellSource, /<DragonCalendar currentUser=\{currentUser\}/);
    assert.match(tabsSource, /<DragonTabs/);
    assert.match(tabsSource, /Hall of Chronicles/);
    assert.doesNotMatch(tabsSource, /dh-panel flex flex-wrap/);
  });

  it('builds Dragon Calendar as the first module on top of the design system', () => {
    [
      'DragonHero',
      'DragonSection',
      'DragonPanel',
      'DragonCard',
      'DragonInput',
      'DragonSelect',
      'DragonButton',
      'DragonBadge',
      'DragonDivider',
      'DragonProgress',
      'DragonEmptyState'
    ].forEach((name) => assert.match(calendarSource, new RegExp(name)));

    assert.match(calendarSource, /HALL OF CHRONICLES/);
    assert.match(calendarSource, /Dragon Calendar/);
    assert.match(calendarSource, /Family Calendar/);
  });

  it('includes the Dragon design system contract in the frontend test suite', () => {
    assert.match(packageJson.scripts['test:auth-source'], /tests\/dragon-design-system\.test\.ts/);
  });
});
