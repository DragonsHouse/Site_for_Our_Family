import { hasFamilyPermission } from '../../../lib/family-permissions.ts';
import type { FamilyPermission, FamilyTab, FamilyUser } from '../../../lib/family-types.ts';
import type { DragonBackgroundVariant } from '../dragon-ui/dragon-ui';
import type { DragonRoomRailItem } from '../dragon-ui/components/room-shell';

export type DragonRoomNavigationItem = {
  key: FamilyTab;
  label: string;
  room: string;
  description: string;
  background: DragonBackgroundVariant;
  requiredPermission?: FamilyPermission;
  minimumRankLevel?: number;
};

export const DRAGON_ROOM_NAVIGATION: DragonRoomNavigationItem[] = [
  {
    key: 'cabinet',
    label: 'Dashboard',
    room: 'Entrance Hall',
    description: 'Personal command surface and account overview.',
    background: 'dashboard'
  },
  {
    key: 'members',
    label: 'Members',
    room: 'Hall of Guardians',
    description: 'Family directory, Dragon roles and member presence.',
    background: 'members'
  },
  {
    key: 'profile',
    label: 'Profile',
    room: 'Dragon Chamber',
    description: 'Personal identity, rank, timeline and permissions.',
    background: 'profile'
  },
  {
    key: 'calendar',
    label: 'Calendar',
    room: 'Hall of Chronicles',
    description: 'Family events, birthdays and shared planning.',
    background: 'calendar'
  },
  {
    key: 'events',
    label: 'Events',
    room: 'Event Watch',
    description: 'Dragon Event Engine and cross-module event stream.',
    background: 'events'
  },
  {
    key: 'tower-defense',
    label: 'Р’РѕРіРЅСЏРЅР° РІР°СЂС‚Р°',
    room: 'War Chamber',
    description: 'Tower Defense readiness and roster coordination.',
    background: 'events'
  },
  {
    key: 'achievements',
    label: 'Achievements',
    room: 'Seal Engine',
    description: 'Achievement engine, rewards and future unlocks.',
    background: 'achievements'
  },
  {
    key: 'resources',
    label: 'Resources',
    room: 'Treasury',
    description: 'Family resources and reference material.',
    background: 'resources'
  },
  {
    key: 'discord-sync',
    label: 'Discord Sync',
    room: 'Sync Chamber',
    description: 'Discord synchronization diagnostics and apply flow.',
    background: 'resources',
    requiredPermission: 'manage_discord_integration'
  },
  {
    key: 'family',
    label: 'Family',
    room: 'Hall of Flame',
    description: 'Legacy family management rooms and content.',
    background: 'dashboard'
  },
  {
    key: 'buyers',
    label: 'Buyers',
    room: 'Trade Vault',
    description: 'Buyer tools inside the Dragon House shell.',
    background: 'resources'
  },
  {
    key: 'map',
    label: 'Map',
    room: 'War Table',
    description: 'Territory references and map tools.',
    background: 'events'
  }
];

export const DRAGON_ROOM_TAB_KEYS: FamilyTab[] = DRAGON_ROOM_NAVIGATION.map((item) => item.key);

export const DRAGON_ROOM_BACKGROUND_VARIANT: Record<FamilyTab, DragonBackgroundVariant> =
  DRAGON_ROOM_NAVIGATION.reduce(
    (variants, item) => ({
      ...variants,
      [item.key]: item.background
    }),
    {} as Record<FamilyTab, DragonBackgroundVariant>
  );

export function canAccessDragonRoom(user: FamilyUser, item: DragonRoomNavigationItem) {
  if (item.requiredPermission && !hasFamilyPermission(user, item.requiredPermission)) return false;
  if (typeof item.minimumRankLevel === 'number' && user.rankLevel < item.minimumRankLevel) return false;
  return true;
}

export function getDragonRoomNavigationItems(user: FamilyUser): Array<DragonRoomRailItem<FamilyTab>> {
  return DRAGON_ROOM_NAVIGATION.map((item) => ({
    key: item.key,
    label: item.label,
    room: item.room,
    description: item.description,
    locked: false,
    ariaLabel: `${item.label}, ${item.room}${canAccessDragonRoom(user, item) ? '' : ', access limited inside room'}`
  }));
}

export function getDragonRoomMetadata(tab: FamilyTab) {
  return DRAGON_ROOM_NAVIGATION.find((item) => item.key === tab) ?? DRAGON_ROOM_NAVIGATION[0];
}
