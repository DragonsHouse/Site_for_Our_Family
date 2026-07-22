import type { FamilyAuthUser, FamilyMember, FamilyMemberStatus, FamilyPermission, FamilyRole, FamilySession } from '../types.js';

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
};

export function createAuthenticatedMemberDto(
  member: FamilyMember,
  session: Pick<FamilySession, 'loginProvider' | 'expiresAt' | 'lastUsedAt'>,
  authUser: Pick<FamilyAuthUser, 'mustChangePassword'>,
): AuthenticatedMemberDto {
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
      linked: member.discord?.linked === true && Boolean(member.discord.discordUserId),
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
  };
}

function displayName(member: FamilyMember): string {
  return member.discord?.discordServerNickname?.trim() || member.discord?.discordGlobalName?.trim() || member.nickname;
}

function discordDisplayName(member: FamilyMember): string | null {
  return member.discord?.discordServerNickname?.trim() || member.discord?.discordGlobalName?.trim() || (member.discord?.discordUsername ?? null);
}
