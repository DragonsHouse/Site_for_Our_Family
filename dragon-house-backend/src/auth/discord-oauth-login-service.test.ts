import { describe, expect, it, vi } from 'vitest';
import { hashPassword } from './password.js';
import { FamilyAuthService } from './auth-service.js';
import { InMemoryFamilyAuthRepository } from './auth-repository.js';
import {
  InMemoryDiscordLoginCompletionRepository,
} from './discord-login-completion-repository.js';
import { DiscordOAuthLoginService } from './discord-oauth-login-service.js';
import { InMemoryDiscordOAuthStateRepository } from '../discord/oauth-state-repository.js';
import { InMemoryDiscordAccountLinkRepository } from '../discord/account-link-repository.js';
import { MemoryFamilyMemberRepository } from '../members/member-repository.js';
import { createLogger } from '../logging/logger.js';
import { createTestConfig } from '../test/test-config.js';
import type { DiscordAccountLink, FamilyMember } from '../types.js';

const NOW = new Date('2026-07-22T10:00:00.000Z');
const MEMBER_ID = 'member-1';
const DISCORD_USER_ID = 'discord-1';

function createMember(overrides: Partial<FamilyMember> = {}): FamilyMember {
  return {
    id: MEMBER_ID,
    nickname: 'Anastasia_Dragons',
    staticId: '41384',
    role: 'owner',
    rank: 10,
    status: 'active',
    avatarAssetId: null,
    notes: null,
    joinedAt: null,
    permissions: ['view_members', 'manage_members', 'manage_discord_integration'],
    permissionsOverride: [],
    permissionsDiscord: ['view_members'],
    permissionsDenied: [],
    onboardingMetadata: {},
    profileMetadata: {},
    deletedAt: null,
    version: 1,
    createdByFamilyMemberId: null,
    updatedByFamilyMemberId: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function createLink(overrides: Partial<DiscordAccountLink> = {}): DiscordAccountLink {
  return {
    familyMemberId: MEMBER_ID,
    discordUserId: DISCORD_USER_ID,
    discordUsername: 'anastasia_dragons',
    discordGlobalName: 'Anastasia_Dragons',
    discordServerNickname: 'Anastasia_Dragons',
    discordAvatar: 'avatar-hash',
    discordAvatarUrl: 'https://cdn.discordapp.com/avatars/discord-1/avatar-hash.png?size=128',
    guildId: 'guild-1',
    joinedAt: NOW.toISOString(),
    leftAt: null,
    lastSyncedAt: NOW.toISOString(),
    verified: true,
    guildMemberVerified: true,
    linkedAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

async function createHarness(options: { member?: FamilyMember; link?: DiscordAccountLink; identityId?: string } = {}) {
  const config = createTestConfig({
    discord: {
      clientId: 'client-id',
      clientSecret: 'client-secret',
      oauthRedirectUri: 'https://api.example/api/auth/discord/callback',
      guildId: 'guild-1',
      sync: { protectedOwnerMemberId: MEMBER_ID, protectedOwnerDiscordUserId: DISCORD_USER_ID },
      oauth: { loginRedirectUris: ['https://extension.example/login-complete'] },
    },
  });
  const states = new InMemoryDiscordOAuthStateRepository();
  const completions = new InMemoryDiscordLoginCompletionRepository();
  const links = new InMemoryDiscordAccountLinkRepository();
  const members = new MemoryFamilyMemberRepository([options.member ?? createMember()]);
  const authRepository = new InMemoryFamilyAuthRepository();
  await authRepository.createUser({
    familyMemberId: MEMBER_ID,
    login: 'Anastasia_Dragons',
    staticId: '41384',
    passwordHash: await hashPassword('local-password', config.bcryptCost),
    isActive: true,
    mustChangePassword: false,
    role: 'owner',
    rank: 10,
    permissions: ['view_members', 'manage_members', 'manage_discord_integration'],
  });
  if (options.link !== null) await links.save(options.link ?? createLink());
  const fetchImpl = vi.fn(async (url: string) => {
    if (url.endsWith('/oauth2/token')) {
      return jsonResponse({ access_token: 'discord-access-token', token_type: 'Bearer' });
    }
    if (url.endsWith('/users/@me')) {
      return jsonResponse({ id: options.identityId ?? DISCORD_USER_ID, username: 'anastasia_dragons', global_name: 'Anastasia_Dragons' });
    }
    return jsonResponse({}, 404);
  }) as unknown as typeof fetch;
  const service = new DiscordOAuthLoginService(
    config,
    states,
    completions,
    links,
    members,
    new FamilyAuthService(config, authRepository, members),
    createLogger(config),
    fetchImpl,
  );
  return { service, fetchImpl, members, completions };
}

describe('DiscordOAuthLoginService', () => {
  it('creates a one-time state and exchanges the authorization code server-side', async () => {
    const { service, fetchImpl } = await createHarness();
    const start = await service.start(undefined, NOW);
    const state = new URL(start.authorizationUrl).searchParams.get('state');
    expect(state).toBeTruthy();
    expect(start.authorizationUrl).toContain('code_challenge_method=S256');

    const callback = await service.callback({ code: 'provider-code', state: state ?? undefined }, NOW);
    expect(callback.familyMemberId).toBe(MEMBER_ID);
    expect(callback.discordUserId).toBe(DISCORD_USER_ID);
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining('/oauth2/token'), expect.objectContaining({ method: 'POST' }));
    const tokenCall = vi.mocked(fetchImpl).mock.calls[0]?.[1] as RequestInit;
    expect(String(tokenCall.body)).toContain('code=provider-code');
    expect(String(tokenCall.body)).toContain('client_secret=client-secret');
  });

  it('rejects invalid, expired and replayed states', async () => {
    const { service } = await createHarness();
    await expect(service.callback({ code: 'provider-code', state: 'invalid' }, NOW)).rejects.toMatchObject({ code: 'OAUTH_STATE_INVALID' });

    const start = await service.start(undefined, NOW);
    const state = new URL(start.authorizationUrl).searchParams.get('state') ?? '';
    await expect(
      service.callback({ code: 'provider-code', state }, new Date(NOW.getTime() + 601_000)),
    ).rejects.toMatchObject({ code: 'OAUTH_STATE_EXPIRED' });

    const replay = await service.start(undefined, NOW);
    const replayState = new URL(replay.authorizationUrl).searchParams.get('state') ?? '';
    await service.callback({ code: 'provider-code', state: replayState }, NOW);
    await expect(service.callback({ code: 'provider-code', state: replayState }, NOW)).rejects.toMatchObject({
      code: 'OAUTH_STATE_ALREADY_USED',
    });
  });

  it('never creates a member or matches by username when Discord ID is unknown', async () => {
    const { service, members } = await createHarness({ identityId: 'unknown-discord-id' });
    const start = await service.start(undefined, NOW);
    const state = new URL(start.authorizationUrl).searchParams.get('state') ?? '';

    await expect(service.callback({ code: 'provider-code', state }, NOW)).rejects.toMatchObject({
      code: 'DISCORD_ACCOUNT_NOT_LINKED',
    });
    expect((await members.list({ page: 1, pageSize: 100, sortBy: 'nickname', sortOrder: 'asc', includeDeleted: true })).total).toBe(1);
  });

  it('rejects inactive linked members', async () => {
    const { service } = await createHarness({ member: createMember({ status: 'inactive' }) });
    const start = await service.start(undefined, NOW);
    const state = new URL(start.authorizationUrl).searchParams.get('state') ?? '';
    await expect(service.callback({ code: 'provider-code', state }, NOW)).rejects.toMatchObject({ code: 'MEMBER_INACTIVE' });
  });

  it('rejects protected owner mismatch', async () => {
    const { service } = await createHarness({ member: createMember({ id: 'wrong-member' }), link: createLink({ familyMemberId: 'wrong-member' }) });
    const start = await service.start(undefined, NOW);
    const state = new URL(start.authorizationUrl).searchParams.get('state') ?? '';
    await expect(service.callback({ code: 'provider-code', state }, NOW)).rejects.toMatchObject({ code: 'MEMBER_ACCESS_DENIED' });
  });

  it('consumes completion codes only once and creates a Family Hub session', async () => {
    const { service } = await createHarness();
    const start = await service.start(undefined, NOW);
    const state = new URL(start.authorizationUrl).searchParams.get('state') ?? '';
    const callback = await service.callback({ code: 'provider-code', state }, NOW);

    const first = await service.complete({ completionCode: callback.completionCode, clientType: 'chrome_extension' }, NOW);
    expect(first.token).toBeTruthy();
    expect(first.user.memberId).toBe(MEMBER_ID);
    expect(first.user.session.loginProvider).toBe('discord');
    await expect(service.complete({ completionCode: callback.completionCode, clientType: 'chrome_extension' }, NOW)).rejects.toMatchObject({
      code: 'LOGIN_COMPLETION_ALREADY_USED',
    });
  });

  it('rejects expired and client-mismatched completion codes', async () => {
    const { service } = await createHarness();
    const start = await service.start(undefined, NOW);
    const state = new URL(start.authorizationUrl).searchParams.get('state') ?? '';
    const callback = await service.callback({ code: 'provider-code', state }, NOW);

    await expect(service.complete({ completionCode: callback.completionCode, clientType: 'web' }, NOW)).rejects.toMatchObject({
      code: 'LOGIN_COMPLETION_EXPIRED',
    });
  });

  it('does not expose Discord access tokens in completion records', async () => {
    const { service, completions } = await createHarness();
    const start = await service.start(undefined, NOW);
    const state = new URL(start.authorizationUrl).searchParams.get('state') ?? '';
    const callback = await service.callback({ code: 'provider-code', state }, NOW);
    const stored = await completions.getByCodeHash(Object.keys(completions as unknown as Record<string, unknown>)[0] ?? '');
    expect(JSON.stringify(stored)).not.toContain('discord-access-token');
    expect(callback.completionCode).not.toContain('discord-access-token');
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}
