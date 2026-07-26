import { beforeAll, describe, expect, it } from 'vitest';
import { createTestConfig } from '../test/test-config.js';
import { DuplicateFamilyAuthUserError, InMemoryFamilyAuthRepository } from './auth-repository.js';
import { FamilyAuthService } from './auth-service.js';
import { hashPassword } from './password.js';
import { hashSessionToken } from './tokens.js';
import { MemoryFamilyMemberRepository } from '../members/member-repository.js';
import type { FamilyMember } from '../types.js';

const ANASTASIA_MEMBER_ID = 'a0b1c2d3-0001-4a00-8000-000000000001';
const DISABLED_MEMBER_ID = 'a0b1c2d3-0002-4a00-8000-000000000002';
let anastasiaPasswordHash = '';
let disabledPasswordHash = '';

beforeAll(async () => {
  const config = createTestConfig({ bcryptCost: 10 });
  anastasiaPasswordHash = await hashPassword('41384', config.bcryptCost);
  disabledPasswordHash = await hashPassword('Password123', config.bcryptCost);
});

async function createService() {
  const repository = new InMemoryFamilyAuthRepository();
  const members = new MemoryFamilyMemberRepository([
    createMember({
      id: ANASTASIA_MEMBER_ID,
      nickname: 'Anastasia_Dragons',
      staticId: '41384',
      role: 'member',
      rank: 3,
      permissions: ['view_members'],
      discord: {
        linked: true,
        discordUserId: 'discord-1',
        discordUsername: 'anastasia_dragons',
        discordGlobalName: 'Anastasia',
        discordServerNickname: 'Anastasia_Dragons',
        discordAvatar: 'avatar-hash',
        guildId: 'guild-1',
        lastSyncedAt: '2026-07-22T00:00:00.000Z',
      },
    }),
    createMember({
      id: DISABLED_MEMBER_ID,
      nickname: 'Disabled_Dragons',
      staticId: '999',
      status: 'inactive',
    }),
  ]);
  const config = createTestConfig({ bcryptCost: 10 });
  await repository.createUser({
    familyMemberId: ANASTASIA_MEMBER_ID,
    login: 'Anastasia_Dragons',
    staticId: '41384',
    passwordHash: anastasiaPasswordHash,
    isActive: true,
    mustChangePassword: true,
    role: 'owner',
    rank: 10,
    permissions: ['manage_users', 'manage_discord_integration'],
  });
  await repository.createUser({
    familyMemberId: DISABLED_MEMBER_ID,
    login: 'Disabled_Dragons',
    staticId: '999',
    passwordHash: disabledPasswordHash,
    isActive: false,
    mustChangePassword: false,
    role: 'member',
    rank: 1,
    permissions: [],
  });
  return { service: new FamilyAuthService(config, repository, members), repository, members };
}

describe('FamilyAuthService', { timeout: 20_000 }, () => {
  it('correct login creates a session and does not return passwordHash', async () => {
    const { service, repository } = await createService();

    const result = await service.login('Anastasia_Dragons', '41384');
    const session = await repository.findSessionByTokenHash(hashSessionToken(result.token));

    expect(result.token).toHaveLength(43);
    expect(session).not.toBeNull();
    expect(session?.tokenHash).not.toBe(result.token);
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.user.session.mustChangePassword).toBe(true);
  });

  it('remember-me login creates a longer server-side session', async () => {
    const { service } = await createService();

    const normal = await service.login('Anastasia_Dragons', '41384');
    const remembered = await service.login('Anastasia_Dragons', '41384', { rememberMe: true });

    expect(new Date(remembered.expiresAt).getTime()).toBeGreaterThan(new Date(normal.expiresAt).getTime());
    expect(remembered.user).not.toHaveProperty('passwordHash');
  });

  it('wrong password and unknown login return generic invalid_credentials', async () => {
    const { service } = await createService();

    await expect(service.login('Anastasia_Dragons', 'wrong')).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
    await expect(service.login('Unknown', 'wrong')).rejects.toMatchObject({ code: 'invalid_credentials' });
  });

  it('disabled user cannot login', async () => {
    const { service } = await createService();

    await expect(service.login('Disabled_Dragons', 'Password123')).rejects.toMatchObject({
      code: 'account_disabled',
    });
  });

  it('/me equivalent accepts valid session and rejects missing, expired and revoked sessions', async () => {
    const { service, repository } = await createService();
    const login = await service.login('Anastasia_Dragons', '41384');

    await expect(service.me(login.token)).resolves.toMatchObject({ memberId: ANASTASIA_MEMBER_ID });
    await expect(service.me('')).rejects.toMatchObject({ code: 'session_required' });

    const session = await repository.findSessionByTokenHash(hashSessionToken(login.token));
    if (!session) throw new Error('Missing session');
    await repository.revokeSession(session.sessionId, new Date().toISOString());
    await expect(service.me(login.token)).rejects.toMatchObject({ code: 'session_invalid' });
  });

  it('uses family_members as the source of truth when auth user role and permissions drift', async () => {
    const { service } = await createService();
    const login = await service.login('Anastasia_Dragons', '41384');

    const me = await service.me(login.token);
    const { context } = await service.authenticateToken(login.token, { allowPasswordChangeRequired: true });

    expect(me).toMatchObject({
      memberId: ANASTASIA_MEMBER_ID,
      nickname: 'Anastasia_Dragons',
      role: 'member',
      rank: 3,
      status: 'active',
      permissions: ['view_members'],
      discord: {
        linked: true,
        userId: 'discord-1',
        username: 'anastasia_dragons',
        displayName: 'Anastasia_Dragons',
        avatar: 'avatar-hash',
        guildId: 'guild-1',
        lastSyncedAt: '2026-07-22T00:00:00.000Z',
      },
      onboarding: {
        complete: true,
        state: 'complete',
        requirements: {
          staticId: { satisfied: true, value: '41384' },
          discordLink: { satisfied: true },
        },
      },
    });
    expect(context).toMatchObject({
      familyMemberId: ANASTASIA_MEMBER_ID,
      role: 'member',
      rank: 3,
      status: 'active',
      permissions: ['view_members'],
    });
  });

  it('rejects sessions when the family member record is missing', async () => {
    const repository = new InMemoryFamilyAuthRepository();
    const members = new MemoryFamilyMemberRepository();
    const config = createTestConfig({ bcryptCost: 10 });
    await repository.createUser({
      familyMemberId: ANASTASIA_MEMBER_ID,
      login: 'Anastasia_Dragons',
      staticId: '41384',
      passwordHash: anastasiaPasswordHash,
      isActive: true,
      mustChangePassword: false,
      role: 'owner',
      rank: 10,
      permissions: ['manage_users'],
    });
    const service = new FamilyAuthService(config, repository, members);

    await expect(service.login('Anastasia_Dragons', '41384')).rejects.toMatchObject({ code: 'account_disabled' });
    expect(await repository.findSessionByTokenHash(hashSessionToken('not-a-real-token'))).toBeNull();
  });

  it('logout revokes current session', async () => {
    const { service } = await createService();
    const login = await service.login('Anastasia_Dragons', '41384');

    await service.logout(login.token);

    await expect(service.me(login.token)).rejects.toMatchObject({ code: 'session_invalid' });
  });

  it('change password verifies current password and clears mustChangePassword', async () => {
    const { service } = await createService();
    const login = await service.login('Anastasia_Dragons', '41384');

    await expect(service.changePassword(login.token, 'wrong', 'Newpass123')).rejects.toMatchObject({
      code: 'current_password_invalid',
    });
    await expect(service.changePassword(login.token, '41384', 'short')).rejects.toMatchObject({
      code: 'password_too_weak',
    });

    const user = await service.changePassword(login.token, '41384', 'Newpass123');

    expect(user.session.mustChangePassword).toBe(false);
  });

  it('derives onboarding from canonical member state without persistence', async () => {
    const repository = new InMemoryFamilyAuthRepository();
    const members = new MemoryFamilyMemberRepository([
      createMember({
        id: ANASTASIA_MEMBER_ID,
        nickname: 'Anastasia_Dragons',
        staticId: '41384',
        discord: {
          linked: true,
          discordUserId: 'discord-1',
          discordUsername: 'anastasia_dragons',
        },
      }),
      createMember({
        id: 'missing-static-id',
        nickname: 'Missing_Static',
        staticId: null,
        discord: {
          linked: true,
          discordUserId: 'discord-missing-static',
          discordUsername: 'missing_static',
        },
      }),
      createMember({ id: 'missing-discord', nickname: 'Missing_Discord', staticId: '50003' }),
    ]);
    const service = new FamilyAuthService(createTestConfig({ bcryptCost: 10 }), repository, members);
    await repository.createUser({
      familyMemberId: ANASTASIA_MEMBER_ID,
      login: 'Anastasia_Dragons',
      staticId: '41384',
      passwordHash: anastasiaPasswordHash,
      isActive: true,
      mustChangePassword: false,
      role: 'member',
      rank: 1,
      permissions: [],
    });
    await repository.createUser({
      familyMemberId: 'missing-static-id',
      login: 'Missing_Static',
      staticId: 'login-only-static',
      passwordHash: anastasiaPasswordHash,
      isActive: true,
      mustChangePassword: false,
      role: 'member',
      rank: 1,
      permissions: [],
    });
    await repository.createUser({
      familyMemberId: 'missing-discord',
      login: 'Missing_Discord',
      staticId: '50003',
      passwordHash: anastasiaPasswordHash,
      isActive: true,
      mustChangePassword: false,
      role: 'member',
      rank: 1,
      permissions: [],
    });

    const complete = await service.login('Anastasia_Dragons', '41384');
    const missingStaticId = await service.login('Missing_Static', '41384');
    const missingDiscord = await service.login('Missing_Discord', '41384');

    expect(complete.user.onboarding).toMatchObject({ complete: true, state: 'complete' });
    expect(missingStaticId.user.onboarding).toMatchObject({
      complete: false,
      state: 'static_id_required',
      requirements: {
        staticId: { satisfied: false },
        discordLink: { satisfied: true },
      },
    });
    expect(missingDiscord.user.onboarding).toMatchObject({
      complete: false,
      state: 'discord_link_required',
      requirements: {
        staticId: { satisfied: true, value: '50003' },
        discordLink: { satisfied: false },
      },
    });
  });

  it('updates only the authenticated member Static ID and returns refreshed onboarding', async () => {
    const repository = new InMemoryFamilyAuthRepository();
    const members = new MemoryFamilyMemberRepository([
      createMember({
        id: 'self-static-id',
        nickname: 'Self_Static',
        staticId: null,
        discord: {
          linked: true,
          discordUserId: 'discord-self',
          discordUsername: 'self_static',
        },
      }),
      createMember({ id: 'other-static-id', nickname: 'Other_Static', staticId: '70002' }),
    ]);
    const service = new FamilyAuthService(createTestConfig({ bcryptCost: 10 }), repository, members);
    await repository.createUser({
      familyMemberId: 'self-static-id',
      login: 'Self_Static',
      staticId: 'self-login-static',
      passwordHash: anastasiaPasswordHash,
      isActive: true,
      mustChangePassword: false,
      role: 'member',
      rank: 1,
      permissions: [],
    });

    const login = await service.login('Self_Static', '41384');
    const updated = await service.updateCurrentMemberStaticId(login.token, ' 70001 ');
    const self = await members.findById('self-static-id');
    const other = await members.findById('other-static-id');

    expect(updated.staticId).toBe('70001');
    expect(updated.onboarding).toMatchObject({ complete: true, state: 'complete' });
    expect(self?.staticId).toBe('70001');
    expect(self?.discord?.discordUserId).toBe('discord-self');
    expect(other?.staticId).toBe('70002');
    expect(await repository.existsByStaticId('70001', 'self-static-id')).toBe(false);
  });

  it('rejects invalid and duplicate Static ID self-service updates', async () => {
    const { service, repository, members } = await createService();
    await repository.updatePassword(ANASTASIA_MEMBER_ID, anastasiaPasswordHash, false);
    await members.create(createMember({ id: 'duplicate-static-id', nickname: 'Duplicate_Static', staticId: '80001' }), ANASTASIA_MEMBER_ID);
    await repository.createUser({
      familyMemberId: 'duplicate-static-id',
      login: 'Duplicate_Static',
      staticId: '80001',
      passwordHash: anastasiaPasswordHash,
      isActive: true,
      mustChangePassword: false,
      role: 'member',
      rank: 1,
      permissions: [],
    });
    const login = await service.login('Anastasia_Dragons', '41384');

    await expect(service.updateCurrentMemberStaticId(login.token, '   ')).rejects.toMatchObject({ code: 'static_id_required' });
    await expect(service.updateCurrentMemberStaticId(login.token, 'x'.repeat(81))).rejects.toMatchObject({
      code: 'static_id_too_long',
    });
    await expect(service.updateCurrentMemberStaticId(login.token, '80001')).rejects.toMatchObject({
      code: 'static_id_duplicate',
    });
  });

  it('rate limits repeated failed login attempts', async () => {
    const { service } = await createService();

    for (let index = 0; index < 5; index += 1) {
      await expect(service.login('Anastasia_Dragons', 'wrong')).rejects.toMatchObject({
        code: 'invalid_credentials',
      });
    }
    await expect(service.login('Anastasia_Dragons', 'wrong')).rejects.toMatchObject({
      code: 'login_rate_limited',
    });
  });

  it('rejects duplicate immutable member ID, login and static ID', async () => {
    const { repository } = await createService();
    const passwordHash = await hashPassword('Password123', 10);

    await expect(
      repository.createUser({
        familyMemberId: ANASTASIA_MEMBER_ID,
        login: 'Other_Dragons',
        staticId: '50001',
        passwordHash,
        isActive: true,
        mustChangePassword: true,
        role: 'member',
        rank: 1,
        permissions: [],
      }),
    ).rejects.toBeInstanceOf(DuplicateFamilyAuthUserError);

    await expect(
      repository.createUser({
        familyMemberId: 'a0b1c2d3-0099-4a00-8000-000000000099',
        login: 'Anastasia_Dragons',
        staticId: '50002',
        passwordHash,
        isActive: true,
        mustChangePassword: true,
        role: 'member',
        rank: 1,
        permissions: [],
      }),
    ).rejects.toBeInstanceOf(DuplicateFamilyAuthUserError);

    await expect(
      repository.createUser({
        familyMemberId: 'a0b1c2d3-0100-4a00-8000-000000000100',
        login: 'Static_Dragons',
        staticId: '41384',
        passwordHash,
        isActive: true,
        mustChangePassword: true,
        role: 'member',
        rank: 1,
        permissions: [],
      }),
    ).rejects.toBeInstanceOf(DuplicateFamilyAuthUserError);
  });
});

function createMember(overrides: Partial<FamilyMember>): FamilyMember {
  const now = new Date('2026-07-22T00:00:00.000Z').toISOString();
  return {
    id: 'member-1',
    nickname: 'Member_Dragons',
    staticId: null,
    role: 'member',
    rank: 1,
    status: 'active',
    avatarAssetId: null,
    notes: null,
    joinedAt: null,
    permissions: [],
    permissionsOverride: [],
    permissionsDiscord: [],
    permissionsDenied: [],
    onboardingMetadata: {},
    profileMetadata: {},
    deletedAt: null,
    version: 1,
    createdByFamilyMemberId: null,
    updatedByFamilyMemberId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
