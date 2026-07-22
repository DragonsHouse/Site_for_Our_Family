import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createBackendCurrentFamilyUser,
  createLoggedOutFamilyHubAuthState,
} from '../lib/family-backend-current-user.ts';

const backendMember = {
  familyMemberId: 'member-1',
  login: 'Backend_Dragon',
  staticId: '922',
  role: 'member',
  rank: 4,
  permissions: ['view_members'],
  mustChangePassword: false,
} as const;

const conflictingProfile = {
  id: 'legacy-local-id',
  nickname: 'Local_Stale_Name',
  staticId: 'local-static',
  passwordHash: 'must-not-survive',
  mustChangePassword: true,
  role: 'owner',
  rank: 'Local Owner Rank',
  rankLevel: 10,
  promotionProgress: 99,
  promotionRequirements: { completed: [], remaining: [] },
  lastActive: '2026-07-01T00:00:00.000Z',
  isOnline: true,
  displayName: 'Local Display',
  avatarUrl: 'local-avatar',
  avatarDataUrl: 'local-avatar-data',
  status: 'online',
  accountStatus: 'inactive',
  statusMessage: 'local status',
  nextRank: null,
  promotionUpdatedAt: '2026-07-01T00:00:00.000Z',
  joinedAt: '2026-07-01',
  notes: 'local notes',
  permissions: ['manage_users', 'manage_discord_integration'],
  stats: {
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
  },
  tasks: [],
  deletedAt: '2026-07-01T00:00:00.000Z',
  externalSource: 'family_hub',
  externalId: 'legacy-local-id',
  externalRevision: 'local',
  externalCreatedAt: null,
  externalUpdatedAt: null,
  lastSyncedAt: null,
  syncStatus: 'local_only',
  syncError: null,
} as const;

describe('createBackendCurrentFamilyUser', () => {
  it('uses backend auth identity, role, rank and permissions over conflicting profile data', () => {
    const user = createBackendCurrentFamilyUser(backendMember, conflictingProfile);

    assert.equal(user.id, 'member-1');
    assert.equal(user.staticId, '922');
    assert.equal(user.role, 'member');
    assert.equal(user.rankLevel, 4);
    assert.deepEqual(user.permissions, ['view_members']);
    assert.equal(user.mustChangePassword, false);
    assert.equal(user.passwordHash, null);
  });

  it('keeps backend member display and status fields when they are available', () => {
    const user = createBackendCurrentFamilyUser(backendMember, conflictingProfile);

    assert.equal(user.nickname, 'Local_Stale_Name');
    assert.equal(user.displayName, 'Local Display');
    assert.equal(user.accountStatus, 'inactive');
    assert.equal(user.status, 'online');
  });

  it('prevents a legacy local profile from elevating permissions', () => {
    const user = createBackendCurrentFamilyUser(backendMember, conflictingProfile);

    assert.equal(user.role, 'member');
    assert.deepEqual(user.permissions, ['view_members']);
    assert.equal(user.permissions.includes('manage_users'), false);
    assert.equal(user.permissions.includes('manage_discord_integration'), false);
  });

  it('handles missing optional backend member profile safely', () => {
    const user = createBackendCurrentFamilyUser(backendMember, null);

    assert.equal(user.id, 'member-1');
    assert.equal(user.nickname, 'Backend_Dragon');
    assert.equal(user.displayName, 'Backend_Dragon');
    assert.equal(user.accountStatus, 'active');
    assert.equal(user.status, 'offline');
    assert.equal(user.passwordHash, null);
  });
});

describe('createLoggedOutFamilyHubAuthState', () => {
  it('clears authenticated frontend state', () => {
    assert.deepEqual(createLoggedOutFamilyHubAuthState(), {
      currentUser: null,
      familyUsers: [],
    });
  });
});
