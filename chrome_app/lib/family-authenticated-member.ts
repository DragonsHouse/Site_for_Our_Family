import type { FamilyPermission, FamilyRole } from './family-types';

const KNOWN_FAMILY_PERMISSIONS = [
  'manage_users',
  'view_members',
  'manage_members',
  'manage_member_roles',
  'manage_member_auth',
  'delete_members',
  'restore_members',
  'view_member_private_fields',
  'manage_tasks',
  'manage_ranks',
  'view_private_notes',
  'manage_family_map',
  'manage_events',
  'manage_buyers',
  'manage_family_posts',
  'manage_family_news',
  'manage_news',
  'view_family_history',
  'manage_family_economy',
  'manage_family_quests',
  'manage_family_assets',
  'manage_discord_integration',
  'manage_backups',
  'manage_accounting',
  'manage_treasury',
  'manage_recruitment',
  'manage_resources',
  'manage_roles',
] satisfies FamilyPermission[];

export type AuthenticatedMember = {
  memberId: string;
  nickname: string;
  displayName: string;
  staticId: string | null;
  role: FamilyRole;
  rank: number;
  status: 'active' | 'inactive';
  permissions: FamilyPermission[];
  discord: {
    linked: boolean;
    userId: string | null;
    username: string | null;
    displayName: string | null;
    serverNickname: string | null;
    avatar: string | null;
    guildId: string | null;
    lastSyncedAt: string | null;
  };
  session: {
    loginProvider: 'password' | 'discord' | 'nickname';
    expiresAt: string;
    lastUsedAt: string | null;
    mustChangePassword: boolean;
  };
  onboarding: FamilyOnboardingStatus;
  profileCompletion: FamilyProfileCompletionStatus;
};

export type FamilyOnboardingState =
  | 'complete'
  | 'static_id_required'
  | 'birthday_required'
  | 'discord_link_required'
  | 'member_access_denied'
  | 'account_deactivated';

export type FamilyOnboardingStatus = {
  complete: boolean;
  state: FamilyOnboardingState;
  requirements: {
    staticId: {
      satisfied: boolean;
      value?: string;
    };
    discordLink: {
      satisfied: boolean;
    };
    inGameNickname: {
      satisfied: boolean;
    };
    birthday: {
      satisfied: boolean;
      required: boolean;
    };
  };
};

export type FamilyProfileCompletionStatus = {
  complete: boolean;
  state: 'complete' | 'birthday_required';
  legacyAccessAllowed: boolean;
  requirements: {
    birthday: {
      satisfied: boolean;
      required: boolean;
    };
  };
};

export function assertAuthenticatedMember(value: unknown): AuthenticatedMember {
  if (!isRecord(value)) throw new Error('Family auth response was malformed');
  const discord = value.discord;
  const session = value.session;
  const onboarding = value.onboarding;
  const profileCompletion = value.profileCompletion;
  if (
    typeof value.memberId !== 'string' ||
    typeof value.nickname !== 'string' ||
    typeof value.displayName !== 'string' ||
    !isNullableString(value.staticId) ||
    !isFamilyRole(value.role) ||
    typeof value.rank !== 'number' ||
    !Number.isFinite(value.rank) ||
    !['active', 'inactive'].includes(String(value.status)) ||
    !Array.isArray(value.permissions) ||
    !value.permissions.every(isFamilyPermission) ||
    !isRecord(discord) ||
    typeof discord.linked !== 'boolean' ||
    !isNullableString(discord.userId) ||
    !isNullableString(discord.username) ||
    !isNullableString(discord.displayName) ||
    !isNullableString(discord.serverNickname) ||
    !isNullableString(discord.avatar) ||
    !isNullableString(discord.guildId) ||
    !isNullableString(discord.lastSyncedAt) ||
    !isRecord(session) ||
    !['password', 'discord', 'nickname'].includes(String(session.loginProvider)) ||
    typeof session.expiresAt !== 'string' ||
    !isNullableString(session.lastUsedAt) ||
    typeof session.mustChangePassword !== 'boolean' ||
    !isOnboardingStatus(onboarding) ||
    !isProfileCompletionStatus(profileCompletion)
  ) {
    throw new Error('Family auth response was malformed');
  }
  return value as AuthenticatedMember;
}

function isOnboardingStatus(value: unknown): value is FamilyOnboardingStatus {
  if (!isRecord(value)) return false;
  const requirements = value.requirements;
  if (
    typeof value.complete !== 'boolean' ||
    !isFamilyOnboardingState(value.state) ||
    !isRecord(requirements)
  ) {
    return false;
  }
  const staticId = requirements.staticId;
  const discordLink = requirements.discordLink;
  const inGameNickname = requirements.inGameNickname;
  const birthday = requirements.birthday;
  return (
    isRecord(staticId) &&
    typeof staticId.satisfied === 'boolean' &&
    (staticId.value === undefined || typeof staticId.value === 'string') &&
    isRecord(discordLink) &&
    typeof discordLink.satisfied === 'boolean' &&
    isRecord(inGameNickname) &&
    typeof inGameNickname.satisfied === 'boolean' &&
    isRecord(birthday) &&
    typeof birthday.satisfied === 'boolean' &&
    typeof birthday.required === 'boolean'
  );
}

function isProfileCompletionStatus(value: unknown): value is FamilyProfileCompletionStatus {
  if (!isRecord(value)) return false;
  const requirements = value.requirements;
  if (
    typeof value.complete !== 'boolean' ||
    (value.state !== 'complete' && value.state !== 'birthday_required') ||
    typeof value.legacyAccessAllowed !== 'boolean' ||
    !isRecord(requirements)
  ) {
    return false;
  }
  const birthday = requirements.birthday;
  return isRecord(birthday) && typeof birthday.satisfied === 'boolean' && typeof birthday.required === 'boolean';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isFamilyRole(value: unknown): value is FamilyRole {
  return value === 'owner' || value === 'deputy' || value === 'moderator' || value === 'member';
}

function isFamilyOnboardingState(value: unknown): value is FamilyOnboardingState {
  return (
    value === 'complete' ||
    value === 'static_id_required' ||
    value === 'birthday_required' ||
    value === 'discord_link_required' ||
    value === 'member_access_denied' ||
    value === 'account_deactivated'
  );
}

function isFamilyPermission(value: unknown): value is FamilyPermission {
  return typeof value === 'string' && KNOWN_FAMILY_PERMISSIONS.includes(value as FamilyPermission);
}
