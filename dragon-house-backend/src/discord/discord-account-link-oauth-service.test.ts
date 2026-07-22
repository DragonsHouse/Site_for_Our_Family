import { describe, expect, it, vi } from 'vitest';
import { createTestConfig } from '../test/test-config.js';
import {
  InMemoryDiscordAccountLinkRepository,
} from './account-link-repository.js';
import { DiscordAccountLinkOAuthError, DiscordAccountLinkOAuthService } from './discord-account-link-oauth-service.js';
import { InMemoryDiscordOAuthStateRepository } from './oauth-state-repository.js';
import type { DiscordAccountLink } from '../types.js';

const configuredDiscord = {
  clientId: '1527643777554972709',
  clientSecret: 'test-client-secret',
  oauthRedirectUri: 'http://localhost:8787/api/discord/account-link/callback',
  guildId: '936687501316354068',
};
const validCallbackTime = new Date('2026-07-17T00:01:00.000Z');

function createExistingLink(familyMemberId: string, discordUserId: string): DiscordAccountLink {
  const now = new Date('2026-07-17T00:00:00.000Z').toISOString();
  return {
    familyMemberId,
    discordUserId,
    discordUsername: `user-${discordUserId}`,
    discordGlobalName: null,
    discordAvatarUrl: null,
    guildMemberVerified: true,
    linkedAt: now,
    updatedAt: now,
  };
}

function createService(fetchImpl = createSuccessfulDiscordFetch()) {
  const accountLinks = new InMemoryDiscordAccountLinkRepository();
  const oauthStates = new InMemoryDiscordOAuthStateRepository();
  const service = new DiscordAccountLinkOAuthService(
    createTestConfig({ discord: configuredDiscord }),
    accountLinks,
    oauthStates,
    fetchImpl as typeof fetch,
  );
  return { service, accountLinks, oauthStates, fetchImpl };
}

function createSuccessfulDiscordFetch(discordUserId = 'discord-1') {
  return vi.fn(async (url: string | URL | Request, _init?: RequestInit) => {
    const urlValue = String(url);
    if (urlValue.endsWith('/oauth2/token')) {
      return Response.json({ access_token: 'access-token', token_type: 'Bearer' });
    }
    if (urlValue.endsWith('/users/@me')) {
      return Response.json({
        id: discordUserId,
        username: 'AnastasiaDiscord',
        global_name: 'Anastasia',
        avatar: 'avatar_hash',
      });
    }
    if (urlValue.includes('/users/@me/guilds/936687501316354068/member')) {
      return Response.json({ user: { id: discordUserId } });
    }
    return new Response('{}', { status: 404 });
  });
}

async function startAndGetState(service: DiscordAccountLinkOAuthService) {
  const start = await service.start('family-1', new Date('2026-07-17T00:00:00.000Z'));
  const url = new URL(start.authorizationUrl);
  return { start, rawState: url.searchParams.get('state') ?? '', url };
}

describe('DiscordAccountLinkOAuthService', () => {
  it('start returns an authorization URL with minimal scopes and expiration', async () => {
    const { service } = createService();

    const { start, url } = await startAndGetState(service);

    expect(start.expiresAt).toBe('2026-07-17T00:10:00.000Z');
    expect(url.searchParams.get('client_id')).toBe('1527643777554972709');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('identify guilds.members.read');
    expect(url.searchParams.get('scope')).not.toContain('email');
    expect(url.searchParams.get('scope')).not.toContain('bot');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('state')).toHaveLength(43);
  });

  it('rejects missing, unknown, expired and consumed state', async () => {
    const { service } = createService();

    await expect(service.complete({ code: 'code' })).rejects.toMatchObject({
      code: 'discord_oauth_state_invalid',
    });
    await expect(service.complete({ code: 'code', state: 'unknown' })).rejects.toMatchObject({
      code: 'discord_oauth_state_invalid',
    });

    const expired = await startAndGetState(service);
    await expect(
      service.complete({
        code: 'code',
        state: expired.rawState,
        now: new Date('2026-07-17T00:10:01.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'discord_oauth_state_expired' });

    const consumed = await startAndGetState(service);
    await service.complete({ code: 'code', state: consumed.rawState, now: validCallbackTime });
    await expect(service.complete({ code: 'code', state: consumed.rawState, now: validCallbackTime })).rejects.toMatchObject({
      code: 'discord_oauth_state_consumed',
    });
  });

  it('handles access_denied without creating a link', async () => {
    const { service, accountLinks } = createService();
    await expect(service.complete({ error: 'access_denied' })).rejects.toMatchObject({
      code: 'discord_oauth_denied',
    });
    expect(await accountLinks.getByFamilyMemberId('family-1')).toBeNull();
  });

  it('does not put the client secret in the token URL', async () => {
    const fetchImpl = createSuccessfulDiscordFetch();
    const { service } = createService(fetchImpl);
    const { rawState } = await startAndGetState(service);

    await service.complete({ code: 'discord-code', state: rawState, now: validCallbackTime });

    const tokenCall = fetchImpl.mock.calls.find(([url]) => String(url).endsWith('/oauth2/token'));
    expect(tokenCall).toBeDefined();
    expect(String(tokenCall?.[0])).not.toContain('test-client-secret');
    expect(String(tokenCall?.[1]?.body)).toContain('client_secret=test-client-secret');
  });

  it('maps Discord user data and verifies guild membership', async () => {
    const { service, accountLinks } = createService();
    const { rawState } = await startAndGetState(service);

    const result = await service.complete({ code: 'discord-code', state: rawState, now: validCallbackTime });

    expect(result.link).toMatchObject({
      familyMemberId: 'family-1',
      discordUserId: 'discord-1',
      discordUsername: 'AnastasiaDiscord',
      discordGlobalName: 'Anastasia',
      guildMemberVerified: true,
    });
    expect(result.link.discordAvatarUrl).toContain('https://cdn.discordapp.com/avatars/discord-1/avatar_hash.png');
    expect(await accountLinks.getByFamilyMemberId('family-1')).not.toBeNull();
  });

  it('rejects guild member 404 without creating a link', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, _init?: RequestInit) => {
      const urlValue = String(url);
      if (urlValue.endsWith('/oauth2/token')) return Response.json({ access_token: 'access-token', token_type: 'Bearer' });
      if (urlValue.endsWith('/users/@me')) return Response.json({ id: 'discord-1', username: 'User', global_name: null, avatar: null });
      return new Response('{}', { status: 404 });
    });
    const { service, accountLinks } = createService(fetchImpl);
    const { rawState } = await startAndGetState(service);

    await expect(service.complete({ code: 'discord-code', state: rawState, now: validCallbackTime })).rejects.toMatchObject({
      code: 'discord_guild_membership_required',
    });
    expect(await accountLinks.getByFamilyMemberId('family-1')).toBeNull();
  });

  it('rejects duplicate familyMemberId and duplicate discordUserId', async () => {
    const { service, accountLinks } = createService(createSuccessfulDiscordFetch('discord-used'));
    await accountLinks.save(createExistingLink('family-1', 'discord-old'));
    const existingFamilyState = await startAndGetState(service);

    await expect(service.complete({ code: 'code', state: existingFamilyState.rawState, now: validCallbackTime })).rejects.toMatchObject({
      code: 'discord_account_already_linked',
    });

    const other = createService(createSuccessfulDiscordFetch('discord-used'));
    await other.accountLinks.save(createExistingLink('family-2', 'discord-used'));
    const existingDiscordState = await startAndGetState(other.service);

    await expect(other.service.complete({ code: 'code', state: existingDiscordState.rawState, now: validCallbackTime })).rejects.toMatchObject({
      code: 'discord_account_linked_elsewhere',
    });
  });

  it('rejects OAuth start when config is incomplete', async () => {
    const service = new DiscordAccountLinkOAuthService(
      createTestConfig(),
      new InMemoryDiscordAccountLinkRepository(),
      new InMemoryDiscordOAuthStateRepository(),
      createSuccessfulDiscordFetch() as typeof fetch,
    );

    await expect(service.start('family-1')).rejects.toBeInstanceOf(DiscordAccountLinkOAuthError);
    await expect(service.start('family-1')).rejects.toMatchObject({ code: 'discord_oauth_not_configured' });
  });
});
