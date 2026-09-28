import type { DragonEntity } from '../data/models/entity';
import type { DragonBirthdayVisibility } from './birthday-models';

export type DragonMemberRole =
  | 'volodarka_predvichnoho_polumia'
  | 'keeper_of_flame'
  | 'elder'
  | 'senior_dragon'
  | 'dragon'
  | 'egg';

export type DragonMemberStatus = 'active' | 'inactive' | 'online' | 'offline' | 'away' | 'in_voice' | 'recently_active';
export type DragonMemberDiscordSyncState = 'not-linked' | 'linked' | 'synchronized' | 'guild-inactive' | 'conflict';

export type DragonMembersView = 'grid' | 'list';

export type DragonMembersSort = 'nickname' | 'role' | 'rank' | 'joinedAt' | 'status';

export type DragonMember = DragonEntity & {
  discordNickname: string;
  dragonTitle: string;
  role: DragonMemberRole;
  rank: string;
  rankLevel: number;
  joinedAt: string;
  birthday?: string;
  birthdayVisibility?: DragonBirthdayVisibility;
  showBirthdayAge?: boolean;
  status: DragonMemberStatus;
  staticId: string;
  discordUserId?: string | null;
  discordSyncedAt?: string | null;
  discordGuildActive?: boolean;
  discordSyncState?: DragonMemberDiscordSyncState;
  avatarUrl?: string | null;
  voiceChannel?: string;
  lastActiveAt?: string;
};

export type DragonMembersFilters = {
  search: string;
  role: DragonMemberRole | 'all';
  status: DragonMemberStatus | 'all';
  joinYear: string;
  birthdayMonth: string;
  sort: DragonMembersSort;
  direction: 'asc' | 'desc';
};

export const DRAGON_MEMBER_ROLE_META: Record<
  DragonMemberRole,
  {
    label: string;
    order: number;
    tone: 'ember' | 'gold' | 'success' | 'muted' | 'danger';
    className: string;
    seal: string;
  }
> = {
  volodarka_predvichnoho_polumia: {
    label: 'Володарка Предвічного Полум’я',
    order: 6,
    tone: 'gold',
    className: 'dh-members-role-volodarka',
    seal: 'Корона полум’я'
  },
  keeper_of_flame: {
    label: 'Хранитель полум’я',
    order: 5,
    tone: 'ember',
    className: 'dh-members-role-keeper',
    seal: 'Печатка хранителя'
  },
  elder: {
    label: 'Старійшини',
    order: 4,
    tone: 'gold',
    className: 'dh-members-role-elder',
    seal: 'Давня печатка'
  },
  senior_dragon: {
    label: 'Старші дракони',
    order: 3,
    tone: 'success',
    className: 'dh-members-role-senior',
    seal: 'Печатка крила'
  },
  dragon: {
    label: 'Дракон',
    order: 2,
    tone: 'ember',
    className: 'dh-members-role-dragon',
    seal: 'Печатка дракона'
  },
  egg: {
    label: 'Новачок',
    order: 1,
    tone: 'muted',
    className: 'dh-members-role-egg',
    seal: 'Печатка новачка'
  }
};

export const DRAGON_MEMBER_STATUS_META: Record<
  DragonMemberStatus,
  {
    label: string;
    tone: 'ember' | 'gold' | 'success' | 'muted' | 'danger';
    className: string;
  }
> = {
  active: {
    label: 'Активний',
    tone: 'success',
    className: 'dh-members-status-active'
  },
  inactive: {
    label: 'Неактивний',
    tone: 'muted',
    className: 'dh-members-status-inactive'
  },
  online: {
    label: 'Онлайн',
    tone: 'success',
    className: 'dh-members-status-online'
  },
  offline: {
    label: 'Недоступний',
    tone: 'muted',
    className: 'dh-members-status-offline'
  },
  away: {
    label: 'Відійшов',
    tone: 'gold',
    className: 'dh-members-status-away'
  },
  in_voice: {
    label: 'У голосі',
    tone: 'ember',
    className: 'dh-members-status-voice'
  },
  recently_active: {
    label: 'Нещодавно активний',
    tone: 'success',
    className: 'dh-members-status-recent'
  }
};
