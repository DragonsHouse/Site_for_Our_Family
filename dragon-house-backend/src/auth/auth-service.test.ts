import { describe, expect, it } from 'vitest';
import { createTestConfig } from '../test/test-config.js';
import { DuplicateFamilyAuthUserError, InMemoryFamilyAuthRepository } from './auth-repository.js';
import { FamilyAuthService } from './auth-service.js';
import { hashPassword } from './password.js';
import { hashSessionToken } from './tokens.js';

const ANASTASIA_MEMBER_ID = 'a0b1c2d3-0001-4a00-8000-000000000001';
const DISABLED_MEMBER_ID = 'a0b1c2d3-0002-4a00-8000-000000000002';

async function createService() {
  const repository = new InMemoryFamilyAuthRepository();
  const config = createTestConfig({ bcryptCost: 10 });
  await repository.createUser({
    familyMemberId: ANASTASIA_MEMBER_ID,
    login: 'Anastasia_Dragons',
    staticId: '41384',
    passwordHash: await hashPassword('41384', config.bcryptCost),
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
    passwordHash: await hashPassword('Password123', config.bcryptCost),
    isActive: false,
    mustChangePassword: false,
    role: 'member',
    rank: 1,
    permissions: [],
  });
  return { service: new FamilyAuthService(config, repository), repository };
}

describe('FamilyAuthService', () => {
  it('correct login creates a session and does not return passwordHash', async () => {
    const { service, repository } = await createService();

    const result = await service.login('Anastasia_Dragons', '41384');
    const session = await repository.findSessionByTokenHash(hashSessionToken(result.token));

    expect(result.token).toHaveLength(43);
    expect(session).not.toBeNull();
    expect(session?.tokenHash).not.toBe(result.token);
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.user.mustChangePassword).toBe(true);
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

    await expect(service.me(login.token)).resolves.toMatchObject({ familyMemberId: ANASTASIA_MEMBER_ID });
    await expect(service.me('')).rejects.toMatchObject({ code: 'session_required' });

    const session = await repository.findSessionByTokenHash(hashSessionToken(login.token));
    if (!session) throw new Error('Missing session');
    await repository.revokeSession(session.sessionId, new Date().toISOString());
    await expect(service.me(login.token)).rejects.toMatchObject({ code: 'session_invalid' });
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

    expect(user.mustChangePassword).toBe(false);
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
