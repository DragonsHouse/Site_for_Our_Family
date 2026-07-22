import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { InMemoryFamilyAuthRepository } from '../auth/auth-repository.js';
import { hashPassword } from '../auth/password.js';
import { MemoryFamilyMemberRepository } from '../members/member-repository.js';
import { createTestConfig, type TestConfigOverrides } from '../test/test-config.js';
import type { FamilyMember } from '../types.js';

const servers: Array<{ close: (callback?: (error?: Error) => void) => void }> = [];
const ANASTASIA_MEMBER_ID = 'a0b1c2d3-0001-4a00-8000-000000000001';

async function createServer(overrides: TestConfigOverrides = {}) {
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
  return `http://127.0.0.1:${address.port}`;
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

describe('auth routes', () => {
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
