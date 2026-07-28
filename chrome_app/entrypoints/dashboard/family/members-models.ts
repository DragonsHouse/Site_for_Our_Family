import type { DragonEntity } from '../data/models/entity';

export type DragonMemberRole =
  | 'volodarka_predvichnoho_polumia'
  | 'keeper_of_flame'
  | 'elder'
  | 'senior_dragon'
  | 'dragon'
  | 'egg';

export type DragonMemberStatus = 'online' | 'offline' | 'away' | 'in_voice' | 'recently_active';

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
  status: DragonMemberStatus;
  staticId: string;
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
    label: 'Volodarka Predvichnoho Polumia',
    order: 6,
    tone: 'gold',
    className: 'dh-members-role-volodarka',
    seal: 'Crown Flame'
  },
  keeper_of_flame: {
    label: 'Keeper of Flame',
    order: 5,
    tone: 'ember',
    className: 'dh-members-role-keeper',
    seal: 'Keeper Seal'
  },
  elder: {
    label: 'Elders',
    order: 4,
    tone: 'gold',
    className: 'dh-members-role-elder',
    seal: 'Ancient Seal'
  },
  senior_dragon: {
    label: 'Senior Dragons',
    order: 3,
    tone: 'success',
    className: 'dh-members-role-senior',
    seal: 'Wing Seal'
  },
  dragon: {
    label: 'Dragon',
    order: 2,
    tone: 'ember',
    className: 'dh-members-role-dragon',
    seal: 'Dragon Seal'
  },
  egg: {
    label: 'Egg',
    order: 1,
    tone: 'muted',
    className: 'dh-members-role-egg',
    seal: 'Hatchling Seal'
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
  online: {
    label: 'Online',
    tone: 'success',
    className: 'dh-members-status-online'
  },
  offline: {
    label: 'Offline',
    tone: 'muted',
    className: 'dh-members-status-offline'
  },
  away: {
    label: 'Away',
    tone: 'gold',
    className: 'dh-members-status-away'
  },
  in_voice: {
    label: 'In Voice',
    tone: 'ember',
    className: 'dh-members-status-voice'
  },
  recently_active: {
    label: 'Recently Active',
    tone: 'success',
    className: 'dh-members-status-recent'
  }
};
