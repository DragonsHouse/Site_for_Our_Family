import type { AuthenticatedMember } from './family-backend-auth-client';
import type { FamilyUser, FamilyUserStats } from './family-types';

export type FamilyHubAuthState = {
  currentUser: FamilyUser | null;
  familyUsers: FamilyUser[];
};

const EMPTY_STATS: FamilyUserStats = {
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
  newMembersTrained: 0,
};

export function createBackendCurrentFamilyUser(member: AuthenticatedMember): FamilyUser {
  const now = new Date().toISOString();
  return {
    id: member.memberId,
    nickname: member.nickname,
    staticId: member.staticId ?? '',
    passwordHash: null,
    mustChangePassword: member.session.mustChangePassword,
    role: member.role,
    rank: `Rank ${member.rank}`,
    rankLevel: member.rank,
    promotionProgress: 0,
    promotionRequirements: { completed: [], remaining: [] },
    lastActive: member.session.lastUsedAt,
    isOnline: false,
    displayName: member.displayName,
    avatarUrl: member.discord.avatar,
    avatarDataUrl: null,
    status: 'offline',
    accountStatus: member.status,
    statusMessage: null,
    nextRank: null,
    promotionUpdatedAt: now,
    joinedAt: null,
    notes: null,
    permissions: [...member.permissions],
    stats: { ...EMPTY_STATS },
    tasks: [],
    deletedAt: null,
    discordUserId: member.discord.userId,
    discordUsername: member.discord.username,
    discordDisplayName: member.discord.displayName,
    discordAvatarUrl: member.discord.avatar,
    discordLinkedAt: null,
    discordSyncedAt: member.discord.lastSyncedAt,
    discordLinkStatus: member.discord.linked ? 'linked' : 'not_linked',
    externalSource: member.discord.linked ? 'discord' : 'family_hub',
    externalId: member.discord.userId ?? member.memberId,
    externalRevision: null,
    externalCreatedAt: null,
    externalUpdatedAt: null,
    lastSyncedAt: member.discord.lastSyncedAt,
    syncStatus: member.discord.linked ? 'synced' : 'pending',
    syncError: null,
  };
}

export function createLoggedOutFamilyHubAuthState(): FamilyHubAuthState {
  return {
    currentUser: null,
    familyUsers: [],
  };
}
