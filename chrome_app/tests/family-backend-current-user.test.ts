import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertAuthenticatedMember, type AuthenticatedMember } from '../lib/family-authenticated-member.ts';
import {
  createBackendCurrentFamilyUser,
  createLoggedOutFamilyHubAuthState,
} from '../lib/family-backend-current-user.ts';

const canonicalMember: AuthenticatedMember = {
  memberId: 'member-1',
  nickname: 'Backend_Dragon',
  displayName: 'Backend Display',
  staticId: null,
  role: 'member',
  rank: 4,
  status: 'active',
  permissions: ['view_members'],
  discord: {
    linked: true,
    userId: 'discord-1',
    username: 'backend_dragon',
    displayName: 'Discord Display',
    avatar: 'https://cdn.discordapp.com/avatar.png',
    guildId: 'guild-1',
    lastSyncedAt: '2026-07-22T00:00:00.000Z',
  },
  session: {
    loginProvider: 'discord',
    expiresAt: '2026-07-23T00:00:00.000Z',
    lastUsedAt: null,
    mustChangePassword: false,
  },
};

describe('assertAuthenticatedMember', () => {
  it('accepts canonical /api/auth/me responses with nullable fields', () => {
    const parsed = assertAuthenticatedMember({
      ...canonicalMember,
      staticId: null,
      discord: {
        linked: false,
        userId: null,
        username: null,
        displayName: null,
        avatar: null,
        guildId: null,
        lastSyncedAt: null,
      },
      session: { ...canonicalMember.session, lastUsedAt: null },
    });

    assert.equal(parsed.memberId, 'member-1');
    assert.equal(parsed.discord.linked, false);
    assert.equal(parsed.session.mustChangePassword, false);
  });

  it('rejects the old auth-user response shape', () => {
    assert.throws(
      () =>
        assertAuthenticatedMember({
          familyMemberId: 'member-1',
          login: 'Old_Login',
          staticId: '922',
          role: 'owner',
          rank: 10,
          permissions: ['manage_users'],
          mustChangePassword: false,
        }),
      /malformed/u,
    );
  });
});

describe('createBackendCurrentFamilyUser', () => {
  it('uses only canonical backend member identity, role, rank and permissions', () => {
    const user = createBackendCurrentFamilyUser(canonicalMember);

    assert.equal(user.id, 'member-1');
    assert.equal(user.nickname, 'Backend_Dragon');
    assert.equal(user.displayName, 'Backend Display');
    assert.equal(user.staticId, '');
    assert.equal(user.role, 'member');
    assert.equal(user.rankLevel, 4);
    assert.deepEqual(user.permissions, ['view_members']);
    assert.equal(user.mustChangePassword, false);
    assert.equal(user.passwordHash, null);
    assert.equal(user.discordUserId, 'discord-1');
    assert.equal(user.discordLinkStatus, 'linked');
  });

  it('preserves password-change state from canonical session metadata', () => {
    const user = createBackendCurrentFamilyUser({
      ...canonicalMember,
      session: { ...canonicalMember.session, loginProvider: 'password', mustChangePassword: true },
    });

    assert.equal(user.mustChangePassword, true);
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
