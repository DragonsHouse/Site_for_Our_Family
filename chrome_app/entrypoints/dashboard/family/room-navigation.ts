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
  hideFromProductionNavigation?: boolean;
};

const SHOW_LEGACY_ROOMS =
  (import.meta as { env?: Record<string, string | boolean | undefined> }).env?.DEV === true ||
  (import.meta as { env?: Record<string, string | boolean | undefined> }).env?.VITE_DRAGON_HOUSE_SHOW_LEGACY_ROOMS === 'true';

export const DRAGON_ROOM_NAVIGATION: DragonRoomNavigationItem[] = [
  {
    key: 'cabinet',
    label: 'Кабінет і профіль',
    room: 'Вхідна зала',
    description: 'Особистий кабінет, профіль, активність, нагороди й виплати в одному місці.',
    background: 'dashboard'
  },
  {
    key: 'members',
    label: 'Учасники',
    room: 'Зала вартових',
    description: 'Список сімʼї, ролі, ранги та статуси учасників.',
    background: 'members'
  },
  {
    key: 'profile',
    label: 'Профіль',
    room: 'Зала профілю',
    description: 'Профіль обʼєднано з особистим кабінетом.',
    background: 'profile',
    hideFromProductionNavigation: true
  },
  {
    key: 'family',
    label: 'Сімʼя',
    room: 'Зала полумʼя',
    description: 'Сімейний огляд, правила, ранги, квести та керування.',
    background: 'dashboard'
  },
  {
    key: 'calendar',
    label: 'Календар',
    room: 'Зала хронік',
    description: 'Події, оборона вишок, квести та спільне планування.',
    background: 'calendar'
  },
  {
    key: 'events',
    label: 'Події',
    room: 'Варта подій',
    description: 'Сімейні події, участь, присутність і Discord-публікації.',
    background: 'events'
  },
  {
    key: 'tower-defense',
    label: 'Оборона вишок',
    room: 'Військова зала',
    description: 'Готовність вишок, відповіді варти та підтверджена участь.',
    background: 'events'
  },
  {
    key: 'achievements',
    label: 'Нагороди',
    room: 'Зала відзнак',
    description: 'Досягнення, нагороди та історія отриманих відзнак.',
    background: 'achievements'
  },
  {
    key: 'resources',
    label: 'Ресурси',
    room: 'Скарбниця',
    description: 'Матеріали та корисні посилання Dragon House.',
    background: 'resources'
  },
  {
    key: 'map',
    label: 'Карта',
    room: 'Військовий стіл',
    description: 'Карта, території, зони та довідкові посилання.',
    background: 'events'
  },
  {
    key: 'discord-sync',
    label: 'Discord-синхронізація',
    room: 'Зала синхронізації',
    description: 'Перевірка Discord-звʼязку, публікацій і синхронізації ролей.',
    background: 'resources',
    requiredPermission: 'manage_discord_integration'
  },
  {
    key: 'buyers',
    label: 'Покупці',
    room: 'Торгова скарбниця',
    description: 'Допоміжний legacy-інструмент покупців.',
    background: 'resources',
    hideFromProductionNavigation: true
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
  return DRAGON_ROOM_NAVIGATION.filter((item) => item.key !== 'profile' && (SHOW_LEGACY_ROOMS || !item.hideFromProductionNavigation)).map((item) => {
    const canAccess = canAccessDragonRoom(user, item);
    return {
      key: item.key,
      label: item.label,
      room: item.room,
      description: item.description,
      locked: !canAccess,
      ariaLabel: `${item.label}, ${item.room}${canAccess ? '' : ', доступ обмежений у кімнаті'}`
    };
  });
}

export function getDragonRoomMetadata(tab: FamilyTab) {
  const normalizedTab = tab === 'profile' ? 'cabinet' : tab;
  return DRAGON_ROOM_NAVIGATION.find((item) => item.key === normalizedTab) ?? DRAGON_ROOM_NAVIGATION[0];
}
