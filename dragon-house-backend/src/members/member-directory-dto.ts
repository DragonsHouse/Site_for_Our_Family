import type { FamilyMember, FamilyMemberStatus, FamilyRole } from '../types.js';

export type FamilyMemberDirectorySort = 'displayName' | 'rank' | 'role' | 'joinedAt';
export type FamilyMemberDirectoryOrder = 'asc' | 'desc';

export type FamilyMemberDirectoryQuery = {
  page: number;
  pageSize: number;
  search?: string | null;
  role?: FamilyRole | 'all' | null;
  status?: FamilyMemberStatus | 'all' | null;
  sort: FamilyMemberDirectorySort;
  order: FamilyMemberDirectoryOrder;
};

export type FamilyMemberDirectoryItemDto = {
  memberId: string;
  displayName: string;
  role: FamilyRole;
  rank: {
    level: number;
    title: string | null;
  };
  status: FamilyMemberStatus;
  avatarUrl: string | null;
  discord: {
    linked: boolean;
    displayName: string | null;
    serverNickname: string | null;
    avatarUrl: string | null;
  };
  joinedAt: string | null;
};

export type FamilyMemberDirectoryResponseDto = {
  items: FamilyMemberDirectoryItemDto[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export function toFamilyMemberDirectoryItemDto(member: FamilyMember): FamilyMemberDirectoryItemDto {
  const serverNickname = stringOrNull(member.discord?.discordServerNickname);
  const discordDisplayName =
    serverNickname ?? stringOrNull(member.discord?.discordGlobalName) ?? stringOrNull(member.discord?.discordUsername);

  return {
    memberId: member.id,
    displayName: serverNickname ?? stringOrNull(member.nickname) ?? 'Unknown member',
    role: member.role,
    rank: {
      level: member.rank,
      title: null,
    },
    status: member.status === 'inactive' ? 'inactive' : 'active',
    avatarUrl: safeUrlFromMetadata(member.profileMetadata),
    discord: {
      linked: member.discord?.linked === true && Boolean(member.discord.discordUserId),
      displayName: discordDisplayName,
      serverNickname,
      avatarUrl: safeUrl(member.discord?.discordAvatar),
    },
    joinedAt: member.joinedAt ?? null,
  };
}

function stringOrNull(value: string | null | undefined): string | null {
  const next = value?.trim();
  return next ? next : null;
}

function safeUrl(value: string | null | undefined): string | null {
  const next = stringOrNull(value);
  if (!next) return null;
  return /^(https?:|data:image\/)/iu.test(next) ? next : null;
}

function safeUrlFromMetadata(metadata: Record<string, unknown>): string | null {
  const candidates = ['avatarUrl', 'avatarDataUrl', 'publicAvatarUrl'];
  for (const key of candidates) {
    const value = metadata[key];
    if (typeof value !== 'string') continue;
    const url = safeUrl(value);
    if (url) return url;
  }
  return null;
}
