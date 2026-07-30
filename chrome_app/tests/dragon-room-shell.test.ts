import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FamilyUser } from '../lib/family-types.ts';
import {
  DragonRoomHeader,
  DragonRoomRail,
  DragonRoomShell,
  DragonRoomStatusArea,
  type DragonRoomRailItem
} from '../entrypoints/dashboard/dragon-ui/components/room-shell.ts';
import {
  DRAGON_ROOM_BACKGROUND_VARIANT,
  DRAGON_ROOM_NAVIGATION,
  canAccessDragonRoom,
  getDragonRoomNavigationItems
} from '../entrypoints/dashboard/family/room-navigation.ts';

const roomShellSource = readFileSync(new URL('../entrypoints/dashboard/dragon-ui/components/room-shell.ts', import.meta.url), 'utf8');
const roomShellStyles = readFileSync(new URL('../entrypoints/dashboard/dragon-ui/styles/room-shell.css', import.meta.url), 'utf8');
const dragonUiSource = readFileSync(new URL('../entrypoints/dashboard/dragon-ui/dragon-ui.tsx', import.meta.url), 'utf8');
const familyShellSource = readFileSync(new URL('../entrypoints/dashboard/family/family-shell.tsx', import.meta.url), 'utf8');
const familyTabsSource = readFileSync(new URL('../entrypoints/dashboard/family/family-tabs.tsx', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const baseUser = {
  id: 'member-1',
  nickname: 'Keeper',
  staticId: '101',
  passwordHash: null,
  mustChangePassword: false,
  role: 'member',
  rank: 'Dragon',
  rankLevel: 3,
  promotionProgress: 0,
  promotionRequirements: { completed: [], remaining: [] },
  lastActive: null,
  isOnline: true,
  displayName: 'Keeper',
  avatarUrl: null,
  avatarDataUrl: null,
  status: 'online',
  accountStatus: 'active',
  statusMessage: null,
  nextRank: null,
  promotionUpdatedAt: null,
  joinedAt: null,
  notes: null,
  permissions: [],
  stats: {
    tasksDone: 0,
    eventsJoined: 0,
    weeklyActivity: 0,
    contributionPoints: 0,
    questsTotal: 0,
    daysInFamily: 0,
    marks: 0,
    captureOrDefenseCount: 0,
    questsOrganized: 0,
    weeklyActivityDays: 0,
    brigadeLeadDays: 0,
    newMembersTrained: 0
  },
  tasks: []
} satisfies FamilyUser;

describe('Dragon Room Shell and navigation foundation', () => {
  it('renders shell landmarks, heading relationships and optional slots', () => {
    const html = renderToStaticMarkup(
      h(
        DragonRoomShell,
        {
          as: 'section',
          labelledBy: 'room-title',
          navigation: h('nav', { 'aria-label': 'Rooms' }, 'Navigation'),
          header: h(DragonRoomHeader, {
            title: 'Dashboard',
            titleId: 'room-title',
            eyebrow: 'Entrance Hall',
            description: 'Personal command surface',
            metadata: h('span', null, 'Rank'),
            actions: h('button', { type: 'button' }, 'Action')
          }),
          statusArea: h(DragonRoomStatusArea, { tone: 'loading' }, 'Loading room'),
          secondaryPanel: h('p', null, 'Secondary')
        },
        h('article', null, 'Body')
      )
    );

    assert.match(html, /^<section/);
    assert.match(html, /aria-labelledby="room-title"/);
    assert.match(html, /<nav aria-label="Rooms"/);
    assert.match(html, /<header/);
    assert.match(html, /id="room-title"/);
    assert.match(html, /role="status"/);
    assert.match(html, /aria-busy="true"/);
    assert.match(html, /<aside/);
    assert.match(html, /dh-dragon-room-body/);
  });

  it('renders navigation items with active, hidden and locked states', () => {
    const items: Array<DragonRoomRailItem<'one' | 'two' | 'hidden'>> = [
      { key: 'one', label: 'One', room: 'First Room' },
      { key: 'two', label: 'Two', room: 'Second Room', locked: true },
      { key: 'hidden', label: 'Hidden', hidden: true }
    ];

    const html = renderToStaticMarkup(h(DragonRoomRail, { items, activeItem: 'one', onItemSelect: () => undefined }));

    assert.match(html, /<nav/);
    assert.match(html, /aria-current="page"/);
    assert.match(html, /aria-disabled="true"/);
    assert.match(html, /Locked/);
    assert.doesNotMatch(html, /Hidden/);
  });

  it('preserves click behavior for enabled navigation items and blocks locked items', () => {
    const selected: string[] = [];
    const items: Array<DragonRoomRailItem<'one' | 'two'>> = [
      { key: 'one', label: 'One' },
      { key: 'two', label: 'Two', locked: true }
    ];
    const element = DragonRoomRail({ items, activeItem: 'one', onItemSelect: (item) => selected.push(item) }) as ReactElement;
    const buttons = element.props.children as ReactElement[];

    buttons[0].props.onClick();
    buttons[1].props.onClick();

    assert.deepEqual(selected, ['one']);
  });

  it('supports keyboard movement across enabled navigation buttons', () => {
    const element = DragonRoomRail({
      items: [
        { key: 'one', label: 'One' },
        { key: 'two', label: 'Two' }
      ],
      activeItem: 'one',
      onItemSelect: () => undefined
    }) as ReactElement<{ onKeyDown: (event: unknown) => void }>;
    let focused = '';
    const firstButton = { focus: () => { focused = 'one'; } };
    const secondButton = { focus: () => { focused = 'two'; } };

    element.props.onKeyDown({
      key: 'ArrowRight',
      currentTarget: { querySelectorAll: () => [firstButton, secondButton] },
      target: firstButton,
      preventDefault: () => undefined
    });

    assert.equal(focused, 'two');
  });

  it('keeps Dragon House navigation driven from one typed configuration source', () => {
    const keys = DRAGON_ROOM_NAVIGATION.map((item) => item.key);

    assert.equal(new Set(keys).size, keys.length);
    assert.deepEqual(keys, [
      'cabinet',
      'members',
      'profile',
      'calendar',
      'events',
      'tower-defense',
      'achievements',
      'resources',
      'discord-sync',
      'family',
      'buyers',
      'map'
    ]);
    assert.equal(DRAGON_ROOM_BACKGROUND_VARIANT.calendar, 'calendar');
    assert.equal(DRAGON_ROOM_BACKGROUND_VARIANT['discord-sync'], 'resources');
  });

  it('keeps permission awareness in navigation without changing existing tab availability', () => {
    const discordSync = DRAGON_ROOM_NAVIGATION.find((item) => item.key === 'discord-sync');
    assert.ok(discordSync);
    assert.equal(canAccessDragonRoom(baseUser, discordSync), false);

    const visibleItems = getDragonRoomNavigationItems(baseUser);
    assert.equal(visibleItems.some((item) => item.key === 'discord-sync'), true);
    assert.equal(visibleItems.find((item) => item.key === 'discord-sync')?.locked, false);
    assert.match(visibleItems.find((item) => item.key === 'discord-sync')?.ariaLabel ?? '', /access limited inside room/);
  });

  it('routes FamilyTabs through the canonical Room Rail adapter', () => {
    assert.match(familyTabsSource, /<DragonRoomRail/);
    assert.match(familyTabsSource, /getDragonRoomNavigationItems\(currentUser\)/);
    assert.match(familyTabsSource, /activeItem=\{activeTab\}/);
    assert.match(familyTabsSource, /onItemSelect=\{onChange\}/);
    assert.doesNotMatch(familyTabsSource, /const TABS/);
  });

  it('adopts Room Shell only around the Cabinet surface and preserves callbacks', () => {
    assert.match(familyShellSource, /<DragonRoomShell[\s\S]*className="dh-dragon-room-shell-cabinet"/);
    assert.match(familyShellSource, /<PersonalCabinet[\s\S]*onOpenTab=\{onTabChange\}/);
    assert.match(familyShellSource, /onAvatarChange=\{onAvatarChange\}/);
    assert.match(familyShellSource, /onAuthenticatedUserRefresh=\{onAuthenticatedUserRefresh\}/);
    assert.match(familyShellSource, /<FamilyTabs activeTab=\{activeTab\} onChange=\{onTabChange\} currentUser=\{currentUser\}/);
    assert.doesNotMatch(familyShellSource, /activeTab === 'members' \? \(\s*<DragonRoomShell/);
    assert.doesNotMatch(familyShellSource, /activeTab === 'calendar' \? \(\s*<DragonRoomShell/);
  });

  it('exports Room Shell primitives through existing Dragon UI and keeps styles token-driven', () => {
    [
      'DragonRoomShell',
      'DragonRoomHeader',
      'DragonRoomBody',
      'DragonRoomRail',
      'DragonRoomPanel',
      'DragonRoomStatusArea'
    ].forEach((name) => assert.match(dragonUiSource, new RegExp(`export \\{[\\s\\S]*${name}`)));

    assert.match(roomShellSource, /type DragonRoomShellProps/);
    assert.match(roomShellStyles, /var\(--dragon-/);
    assert.match(roomShellStyles, /var\(--dh-/);
    assert.match(roomShellStyles, /color-mix/);
    assert.doesNotMatch(roomShellStyles, /#[0-9a-fA-F]{3,8}/);
    assert.match(packageJson.scripts['test:auth-source'], /tests\/dragon-room-shell\.test\.ts/);
  });
});
