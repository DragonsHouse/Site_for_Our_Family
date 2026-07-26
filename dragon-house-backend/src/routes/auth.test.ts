import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { DiscordOAuthLoginError, type DiscordOAuthLoginService } from '../auth/discord-oauth-login-service.js';
import { InMemoryFamilyAuthRepository } from '../auth/auth-repository.js';
import { hashPassword } from '../auth/password.js';
import { hashSessionToken } from '../auth/tokens.js';
import { MemoryFamilyMemberRepository } from '../members/member-repository.js';
import { createTestConfig, type TestConfigOverrides } from '../test/test-config.js';
import type { AuthenticatedMemberDto } from '../auth/authenticated-member-dto.js';
import type { FamilyMember, FamilySession } from '../types.js';

const servers: Array<{ close: (callback?: (error?: Error) => void) => void }> = [];
const ANASTASIA_MEMBER_ID = 'a0b1c2d3-0001-4a00-8000-000000000001';

async function createServerHarness(overrides: TestConfigOverrides = {}) {
  const config = createTestConfig({
    ...overrides,
    bcryptCost: 10,
    discord: {
      clientId: '1527643777554972709',
      clientSecret: 'test-secret',
      oauthRedirectUri: 'http://localhost:8787/api/discord/account-link/callback',
      guildId: '936687501316354068',
      ...overrides.discord,
    },
  });
  const authRepository = new InMemoryFamilyAuthRepository();
  const memberRepository = new MemoryFamilyMemberRepository([
    createMember({
      id: ANASTASIA_MEMBER_ID,
      nickname: 'Anastasia_Dragons',
      staticId: '41384',
      role: 'owner',
      rank: 10,
      permissions: ['manage_discord_integration'],
    }),
  ]);
  await authRepository.createUser({
    familyMemberId: ANASTASIA_MEMBER_ID,
    login: 'Anastasia_Dragons',
    staticId: '41384',
    passwordHash: await hashPassword('41384', config.bcryptCost),
    isActive: true,
    mustChangePassword: false,
    role: 'owner',
    rank: 10,
    permissions: ['manage_discord_integration'],
  });
  const { app } = createApp(config, { authRepository, memberRepository });
  const server = app.listen(0);
  servers.push(server);
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    authRepository,
    memberRepository,
  };
}

async function createServer(overrides: TestConfigOverrides = {}) {
  return (await createServerHarness(overrides)).baseUrl;
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
});

describe('auth routes', { timeout: 20_000 }, () => {
  it('login creates bearer session and me returns sanitized user', async () => {
    const baseUrl = await createServer();

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginOrStaticId: 'Anastasia_Dragons', password: '41384' }),
    });
    const loginBody = (await login.json()) as { token: string; user: Record<string, unknown> };

    expect(login.status).toBe(200);
    expect(loginBody.user).not.toHaveProperty('passwordHash');

    const me = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${loginBody.token}` },
    });

    expect(me.status).toBe(200);
    const meBody = (await me.json()) as Record<string, unknown>;
    expect(meBody).toMatchObject({
      memberId: ANASTASIA_MEMBER_ID,
      nickname: 'Anastasia_Dragons',
      role: 'owner',
      rank: 10,
      status: 'active',
      permissions: ['manage_discord_integration'],
      discord: { linked: false },
      session: { loginProvider: 'password', mustChangePassword: false },
    });
    expect(meBody).not.toHaveProperty('familyMemberId');
    expect(meBody).not.toHaveProperty('login');
    expect(meBody).not.toHaveProperty('passwordHash');
    expect(meBody).not.toHaveProperty('token');
    expect(meBody).not.toHaveProperty('member');
  });

  it('keeps successful password login response shape unchanged while exposing mustChangePassword', async () => {
    const { baseUrl, authRepository } = await createServerHarness();
    const existing = await authRepository.findUserByFamilyMemberId(ANASTASIA_MEMBER_ID);
    if (!existing) throw new Error('Missing auth user');
    await authRepository.updatePassword(ANASTASIA_MEMBER_ID, existing.passwordHash, true);

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginOrStaticId: 'Anastasia_Dragons', password: '41384' }),
    });
    const body = (await login.json()) as Record<string, unknown>;

    expect(login.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['expiresAt', 'token', 'user']);
    expect(body).not.toHaveProperty('outcome');
    expect(body.user).toMatchObject({
      memberId: ANASTASIA_MEMBER_ID,
      session: { loginProvider: 'password', mustChangePassword: true },
    });
  });

  it('returns normalized auth outcomes for invalid credentials and missing token without enumeration data', async () => {
    const baseUrl = await createServer();

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginOrStaticId: 'Unknown_Dragons', password: 'wrong' }),
    });
    const loginBody = (await login.json()) as Record<string, unknown>;

    expect(login.status).toBe(401);
    expect(loginBody).toMatchObject({
      error: 'invalid_credentials',
      outcome: { code: 'invalid_credentials' },
    });
    expect(JSON.stringify(loginBody)).not.toContain('Unknown_Dragons');
    expect(JSON.stringify(loginBody)).not.toContain(ANASTASIA_MEMBER_ID);

    const me = await fetch(`${baseUrl}/api/auth/me`);
    expect(me.status).toBe(401);
    expect(await me.json()).toMatchObject({
      error: 'session_required',
      outcome: { code: 'authentication_required', onboardingState: 'unauthenticated' },
    });
  });

  it('returns normalized outcomes for deactivated password login, invalid session and expired session', async () => {
    const { baseUrl, authRepository, memberRepository } = await createServerHarness({ authSessionTtlHours: -1 });
    await memberRepository.create(
      createMember({
        id: 'inactive-member',
        nickname: 'Inactive_Dragons',
        staticId: '999',
        status: 'inactive',
      }),
      ANASTASIA_MEMBER_ID,
    );
    await authRepository.createUser({
      familyMemberId: 'inactive-member',
      login: 'Inactive_Dragons',
      staticId: '999',
      passwordHash: await hashPassword('999', 10),
      isActive: true,
      mustChangePassword: false,
      role: 'member',
      rank: 1,
      permissions: [],
    });

    const inactiveLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginOrStaticId: 'Inactive_Dragons', password: '999' }),
    });
    expect(inactiveLogin.status).toBe(403);
    expect(await inactiveLogin.json()).toMatchObject({
      error: 'account_disabled',
      outcome: { code: 'account_deactivated', onboardingState: 'account_deactivated' },
    });

    const invalid = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: 'Bearer not-a-real-token' },
    });
    expect(invalid.status).toBe(401);
    expect(await invalid.json()).toMatchObject({
      error: 'session_invalid',
      outcome: { code: 'session_invalid', onboardingState: 'session_invalid' },
    });

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginOrStaticId: 'Anastasia_Dragons', password: '41384' }),
    });
    const loginBody = (await login.json()) as { token: string };
    const expired = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${loginBody.token}` },
    });
    expect(expired.status).toBe(401);
    expect(await expired.json()).toMatchObject({
      error: 'session_expired',
      outcome: { code: 'session_expired', onboardingState: 'session_expired' },
    });
  });

  it('returns account_deactivated when a member is deactivated after session creation', async () => {
    const { baseUrl, authRepository, memberRepository } = await createServerHarness();
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginOrStaticId: 'Anastasia_Dragons', password: '41384' }),
    });
    const loginBody = (await login.json()) as { token: string };
    const current = await memberRepository.findById(ANASTASIA_MEMBER_ID);
    if (!current) throw new Error('Missing member');
    await memberRepository.update(ANASTASIA_MEMBER_ID, { status: 'inactive' }, current.version, ANASTASIA_MEMBER_ID);
    const session = await authRepository.findSessionByTokenHash(hashSessionToken(loginBody.token));
    expect(session).not.toBeNull();

    const me = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${loginBody.token}` },
    });

    expect(me.status).toBe(403);
    expect(await me.json()).toMatchObject({
      error: 'account_disabled',
      outcome: { code: 'account_deactivated', onboardingState: 'account_deactivated' },
    });
  });

  it('updates authenticated member Static ID through self-service and returns refreshed onboarding', async () => {
    const { baseUrl, authRepository, memberRepository } = await createServerHarness();
    await memberRepository.create(
      createMember({
        id: 'self-service-member',
        nickname: 'Self_Service',
        staticId: null,
        discord: {
          linked: true,
          discordUserId: 'discord-self-service',
          discordUsername: 'self_service',
        },
      }),
      ANASTASIA_MEMBER_ID,
    );
    await authRepository.createUser({
      familyMemberId: 'self-service-member',
      login: 'Self_Service',
      staticId: 'self-service-login',
      passwordHash: await hashPassword('41384', 10),
      isActive: true,
      mustChangePassword: false,
      role: 'member',
      rank: 1,
      permissions: [],
    });
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginOrStaticId: 'Self_Service', password: '41384' }),
    });
    const loginBody = (await login.json()) as { token: string };

    const response = await fetch(`${baseUrl}/api/family/me/static-id`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${loginBody.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ staticId: ' 72001 ' }),
    });
    const body = (await response.json()) as AuthenticatedMemberDto;
    const updatedSelf = await memberRepository.findById('self-service-member');
    const owner = await memberRepository.findById(ANASTASIA_MEMBER_ID);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      memberId: 'self-service-member',
      staticId: '72001',
      onboarding: { complete: false, state: 'discord_link_required' },
      discord: { linked: false, userId: null },
    });
    expect(updatedSelf?.staticId).toBe('72001');
    expect(updatedSelf?.discord).toBeUndefined();
    expect(owner?.staticId).toBe('41384');
  });

  it('returns structured Static ID validation errors without clearing auth state', async () => {
    const { baseUrl, authRepository, memberRepository } = await createServerHarness();
    await memberRepository.create(createMember({ id: 'duplicate-route-member', nickname: 'Duplicate_Route', staticId: '73001' }), ANASTASIA_MEMBER_ID);
    await authRepository.createUser({
      familyMemberId: 'duplicate-route-member',
      login: 'Duplicate_Route',
      staticId: '73001',
      passwordHash: await hashPassword('41384', 10),
      isActive: true,
      mustChangePassword: false,
      role: 'member',
      rank: 1,
      permissions: [],
    });
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginOrStaticId: 'Anastasia_Dragons', password: '41384' }),
    });
    const loginBody = (await login.json()) as { token: string };

    const invalid = await fetch(`${baseUrl}/api/family/me/static-id`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${loginBody.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ staticId: '   ' }),
    });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({
      error: 'invalid_static_id',
      code: 'static_id_required',
      fields: { staticId: 'Static ID is required' },
    });

    const duplicate = await fetch(`${baseUrl}/api/family/me/static-id`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${loginBody.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ staticId: '73001' }),
    });
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toMatchObject({
      error: 'invalid_static_id',
      code: 'static_id_duplicate',
      fields: { staticId: 'Static ID is already in use' },
    });
  });

  it('protected routes ignore x-family-member-id when auth service exists', async () => {
    const baseUrl = await createServer();

    const response = await fetch(`${baseUrl}/api/discord/account-link/start`, {
      method: 'POST',
      headers: { 'x-family-member-id': ANASTASIA_MEMBER_ID },
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: 'session_required' });
  });

  it('Discord start uses authenticated bearer session', async () => {
    const baseUrl = await createServer();
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginOrStaticId: '41384', password: '41384' }),
    });
    const loginBody = (await login.json()) as { token: string };

    const start = await fetch(`${baseUrl}/api/discord/account-link/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${loginBody.token}` },
    });
    const body = (await start.json()) as { authorizationUrl: string };

    expect(start.status).toBe(200);
    expect(body.authorizationUrl).toContain('client_id=1527643777554972709');
    expect(body.authorizationUrl).not.toContain('test-secret');
  });

  it('rate limits Discord OAuth login start requests', async () => {
    const baseUrl = await createServer({
      discord: {
        oauthRedirectUri: 'http://localhost:8787/api/auth/discord/callback',
        oauth: {
          startRateLimitPerMinute: 1,
          loginRedirectUris: ['https://extension.example/login-complete'],
        },
      },
    });

    const first = await fetch(`${baseUrl}/api/auth/discord/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientType: 'chrome_extension' }),
    });
    const second = await fetch(`${baseUrl}/api/auth/discord/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientType: 'chrome_extension' }),
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.headers.get('Retry-After')).toBeTruthy();
    expect(await second.json()).toMatchObject({ error: 'rate_limited' });
  });

  it('normalizes public Discord login outcomes without member enumeration data', async () => {
    const baseUrl = await createServerWithDiscordLoginService({
      complete: async () => {
        throw new DiscordOAuthLoginError('DISCORD_ACCOUNT_NOT_LINKED', 403);
      },
    });

    const response = await postDiscordComplete(baseUrl);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      error: 'DISCORD_ACCOUNT_NOT_LINKED',
      outcome: { code: 'discord_link_required', onboardingState: 'discord_link_required' },
    });
    expect(JSON.stringify(body)).not.toContain(ANASTASIA_MEMBER_ID);
    expect(JSON.stringify(body)).not.toContain('Anastasia_Dragons');
    expect(JSON.stringify(body)).not.toContain('41384');
    expect(JSON.stringify(body)).not.toContain('password');
    expect(JSON.stringify(body)).not.toContain('stack');
  });

  it('normalizes inactive and access-denied Discord login outcomes', async () => {
    const inactiveBaseUrl = await createServerWithDiscordLoginService({
      complete: async () => {
        throw new DiscordOAuthLoginError('MEMBER_INACTIVE', 403);
      },
    });
    const inactive = await postDiscordComplete(inactiveBaseUrl);
    expect(inactive.status).toBe(403);
    expect(await inactive.json()).toMatchObject({
      error: 'MEMBER_INACTIVE',
      outcome: { code: 'account_deactivated', onboardingState: 'account_deactivated' },
    });

    const deniedBaseUrl = await createServerWithDiscordLoginService({
      complete: async () => {
        throw new DiscordOAuthLoginError('MEMBER_ACCESS_DENIED', 403);
      },
    });
    const denied = await postDiscordComplete(deniedBaseUrl);
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({
      error: 'MEMBER_ACCESS_DENIED',
      outcome: { code: 'member_access_denied', onboardingState: 'member_access_denied' },
    });
  });

  it('keeps successful Discord complete response shape unchanged', async () => {
    const user = createAuthenticatedMember();
    const baseUrl = await createServerWithDiscordLoginService({
      complete: async () => ({ token: 'discord-session-token', expiresAt: '2026-07-22T11:00:00.000Z', user }),
    });

    const response = await fetch(`${baseUrl}/api/auth/discord/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completionCode: 'abcdefghijklmnopqrstuvwxyz123456', clientType: 'chrome_extension' }),
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['expiresAt', 'token', 'user']);
    expect(body).not.toHaveProperty('outcome');
    expect(body.user).toMatchObject({
      memberId: ANASTASIA_MEMBER_ID,
      session: { loginProvider: 'discord', mustChangePassword: false },
    });
  });
});

async function createServerWithDiscordLoginService(implementation: Partial<DiscordOAuthLoginService>) {
  const config = createTestConfig({
    discord: {
      clientId: '1527643777554972709',
      clientSecret: 'test-secret',
      oauthRedirectUri: 'http://localhost:8787/api/auth/discord/callback',
      guildId: '936687501316354068',
      oauth: {
        loginRedirectUris: ['https://extension.example/login-complete'],
      },
    },
  });
  const { app } = createApp(config, {
    authService: null,
    memberService: null,
    oauthLoginService: implementation as unknown as DiscordOAuthLoginService,
  });
  const server = app.listen(0);
  servers.push(server);
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

function postDiscordComplete(baseUrl: string): Promise<Response> {
  return fetch(`${baseUrl}/api/auth/discord/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completionCode: 'abcdefghijklmnopqrstuvwxyz123456', clientType: 'chrome_extension' }),
  });
}

function createAuthenticatedMember(): AuthenticatedMemberDto {
  const session: Pick<FamilySession, 'loginProvider' | 'expiresAt' | 'lastUsedAt'> = {
    loginProvider: 'discord',
    expiresAt: '2026-07-22T11:00:00.000Z',
    lastUsedAt: '2026-07-22T10:00:00.000Z',
  };
  return {
    memberId: ANASTASIA_MEMBER_ID,
    nickname: 'Anastasia_Dragons',
    displayName: 'Anastasia_Dragons',
    staticId: '41384',
    role: 'owner',
    rank: 10,
    status: 'active',
    permissions: ['manage_discord_integration'],
    discord: {
      linked: true,
      userId: 'discord-1',
      username: 'anastasia_dragons',
      displayName: 'Anastasia_Dragons',
      avatar: null,
      guildId: '936687501316354068',
      lastSyncedAt: null,
    },
    session: {
      loginProvider: session.loginProvider,
      expiresAt: session.expiresAt,
      lastUsedAt: session.lastUsedAt,
      mustChangePassword: false,
    },
    onboarding: {
      complete: true,
      state: 'complete',
      requirements: {
        staticId: { satisfied: true, value: '41384' },
        discordLink: { satisfied: true },
      },
    },
  };
}

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
