import type { FamilyAuthUser, FamilyMember, FamilyMemberStatus, FamilyPermission, FamilyRole, FamilySession } from '../types.js';

export type MemberOnboardingState =
  | 'complete'
  | 'static_id_required'
  | 'discord_link_required'
  | 'member_access_denied'
  | 'account_deactivated';

export type MemberOnboardingStatus = {
  complete: boolean;
  state: MemberOnboardingState;
  requirements: {
    staticId: {
      satisfied: boolean;
      value?: string;
    };
    discordLink: {
      satisfied: boolean;
    };
  };
};

export type AuthenticatedMemberDto = {
  memberId: string;
  nickname: string;
  displayName: string;
  staticId: string | null;
  role: FamilyRole;
  rank: number;
  status: FamilyMemberStatus;
  permissions: FamilyPermission[];
  discord: {
    linked: boolean;
    userId: string | null;
    username: string | null;
    displayName: string | null;
    avatar: string | null;
    guildId: string | null;
    lastSyncedAt: string | null;
  };
  session: {
    loginProvider: FamilySession['loginProvider'];
    expiresAt: string;
    lastUsedAt: string | null;
    mustChangePassword: boolean;
  };
  onboarding: MemberOnboardingStatus;
};

export function createAuthenticatedMemberDto(
  member: FamilyMember,
  session: Pick<FamilySession, 'loginProvider' | 'expiresAt' | 'lastUsedAt'>,
  authUser: Pick<FamilyAuthUser, 'mustChangePassword'>,
): AuthenticatedMemberDto {
  const discordLinked = member.discord?.linked === true && Boolean(member.discord.discordUserId);
  const onboarding = createMemberOnboardingStatus(member, discordLinked);
  return {
    memberId: member.id,
    nickname: member.nickname,
    displayName: displayName(member),
    staticId: member.staticId,
    role: member.role,
    rank: member.rank,
    status: member.status,
    permissions: member.permissions,
    discord: {
      linked: discordLinked,
      userId: member.discord?.discordUserId ?? null,
      username: member.discord?.discordUsername ?? null,
      displayName: discordDisplayName(member),
      avatar: member.discord?.discordAvatar ?? null,
      guildId: member.discord?.guildId ?? null,
      lastSyncedAt: member.discord?.lastSyncedAt ?? null,
    },
    session: {
      loginProvider: session.loginProvider,
      expiresAt: session.expiresAt,
      lastUsedAt: session.lastUsedAt,
      mustChangePassword: authUser.mustChangePassword,
    },
    onboarding,
  };
}

export function createMemberOnboardingStatus(member: FamilyMember, discordLinked = member.discord?.linked === true && Boolean(member.discord.discordUserId)): MemberOnboardingStatus {
  const staticId = member.staticId?.trim() || null;
  const staticIdSatisfied = Boolean(staticId);
  let state: MemberOnboardingState = 'complete';

  if (member.status !== 'active' || member.deletedAt) state = 'account_deactivated';
  else if (!discordLinked) state = 'discord_link_required';
  else if (!staticIdSatisfied) state = 'static_id_required';

  return {
    complete: state === 'complete',
    state,
    requirements: {
      staticId: {
        satisfied: staticIdSatisfied,
        ...(staticId ? { value: staticId } : {}),
      },
      discordLink: {
        satisfied: discordLinked,
      },
    },
  };
}

function displayName(member: FamilyMember): string {
  return member.discord?.discordServerNickname?.trim() || member.discord?.discordGlobalName?.trim() || member.nickname;
}

function discordDisplayName(member: FamilyMember): string | null {
  return member.discord?.discordServerNickname?.trim() || member.discord?.discordGlobalName?.trim() || (member.discord?.discordUsername ?? null);
}
