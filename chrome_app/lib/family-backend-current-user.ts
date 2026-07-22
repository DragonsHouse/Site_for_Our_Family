import type { BackendAuthUser } from './family-backend-auth-client';
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

export function createBackendCurrentFamilyUser(
  backendUser: BackendAuthUser,
  backendMember: FamilyUser | null = null,
): FamilyUser {
  const displayName = backendMember?.displayName?.trim() || backendMember?.nickname || backendUser.login;
  return {
    ...createFallbackBackendMember(backendUser),
    ...backendMember,
    id: backendUser.familyMemberId,
    nickname: backendMember?.nickname?.trim() || backendUser.login,
    staticId: backendUser.staticId,
    role: backendUser.role,
    rank: backendMember?.rank || `Rank ${backendUser.rank}`,
    rankLevel: backendUser.rank,
    permissions: [...backendUser.permissions],
    mustChangePassword: backendUser.mustChangePassword,
    passwordHash: null,
    displayName,
    accountStatus: backendMember?.accountStatus ?? 'active',
    status: backendMember?.status ?? 'offline',
    isOnline: backendMember?.isOnline ?? false,
  };
}

export function createLoggedOutFamilyHubAuthState(): FamilyHubAuthState {
  return {
    currentUser: null,
    familyUsers: [],
  };
}

function createFallbackBackendMember(backendUser: BackendAuthUser): FamilyUser {
  const now = new Date().toISOString();
  return {
    id: backendUser.familyMemberId,
    nickname: backendUser.login,
    staticId: backendUser.staticId,
    passwordHash: null,
    mustChangePassword: backendUser.mustChangePassword,
    role: backendUser.role,
    rank: `Rank ${backendUser.rank}`,
    rankLevel: backendUser.rank,
    promotionProgress: 0,
    promotionRequirements: { completed: [], remaining: [] },
    lastActive: null,
    isOnline: false,
    displayName: backendUser.login,
    avatarUrl: null,
    avatarDataUrl: null,
    status: 'offline',
    accountStatus: 'active',
    statusMessage: null,
    nextRank: null,
    promotionUpdatedAt: now,
    joinedAt: null,
    notes: null,
    permissions: [...backendUser.permissions],
    stats: { ...EMPTY_STATS },
    tasks: [],
    deletedAt: null,
    discordUserId: null,
    discordUsername: null,
    discordDisplayName: null,
    discordAvatarUrl: null,
    discordLinkedAt: null,
    discordSyncedAt: null,
    discordLinkStatus: 'not_linked',
    externalSource: 'family_hub',
    externalId: backendUser.familyMemberId,
    externalRevision: null,
    externalCreatedAt: null,
    externalUpdatedAt: null,
    lastSyncedAt: null,
    syncStatus: 'pending',
    syncError: null,
  };
}
