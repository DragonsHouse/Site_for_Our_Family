import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { InMemoryDiscordAccountLinkRepository } from '../discord/account-link-repository.js';
import { createTestConfig } from '../test/test-config.js';
import type { DiscordAccountLink } from '../types.js';

const servers: Array<{ close: (callback?: (error?: Error) => void) => void }> = [];

function createLink(familyMemberId: string): DiscordAccountLink {
  const now = new Date('2026-07-17T00:00:00.000Z').toISOString();
  return {
    familyMemberId,
    discordUserId: `discord-${familyMemberId}`,
    discordUsername: `username-${familyMemberId}`,
    discordGlobalName: 'Global Name',
    discordAvatarUrl: null,
    guildMemberVerified: true,
    linkedAt: now,
    updatedAt: now,
  };
}

async function requestJson(
  path: string,
  options: RequestInit & { familyMemberId?: string } = {},
  repository = new InMemoryDiscordAccountLinkRepository(),
  config = createTestConfig(),
) {
  const { app } = createApp(config, { accountLinks: repository, authService: null });
  const server = app.listen(0);
  servers.push(server);
  const address = server.address() as AddressInfo;
  const headers = new Headers(options.headers);
  if (options.familyMemberId) headers.set('x-family-member-id', options.familyMemberId);
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
    ...options,
    headers,
  });
  const body = response.status === 204 ? null : await response.json();
  return { status: response.status, body, repository };
}

async function requestText(
  path: string,
  options: RequestInit & { familyMemberId?: string } = {},
  repository = new InMemoryDiscordAccountLinkRepository(),
  config = createTestConfig(),
) {
  const { app } = createApp(config, { accountLinks: repository, authService: null });
  const server = app.listen(0);
  servers.push(server);
  const address = server.address() as AddressInfo;
  const headers = new Headers(options.headers);
  if (options.familyMemberId) headers.set('x-family-member-id', options.familyMemberId);
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
    ...options,
    headers,
  });
  return { status: response.status, body: await response.text(), repository };
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

describe('Discord account link routes', () => {
  it('returns null without a link', async () => {
    const result = await requestJson('/api/discord/account-link', { familyMemberId: 'family-1' });

    expect(result.status).toBe(200);
    expect(result.body).toBeNull();
  });

  it('unlinks only current auth user', async () => {
    const repository = new InMemoryDiscordAccountLinkRepository();
    await repository.save(createLink('family-1'));
    await repository.save(createLink('family-2'));

    const result = await requestJson(
      '/api/discord/account-link',
      { method: 'DELETE', familyMemberId: 'family-1' },
      repository,
    );

    expect(result.status).toBe(204);
    expect(await repository.getByFamilyMemberId('family-1')).toBeNull();
    expect(await repository.getByFamilyMemberId('family-2')).not.toBeNull();
  });

  it('start returns authorization URL when OAuth is configured and auth context exists', async () => {
    const repository = new InMemoryDiscordAccountLinkRepository();
    const config = createTestConfig({
      discord: {
        clientId: '1527643777554972709',
        clientSecret: 'test-client-secret',
        oauthRedirectUri: 'http://localhost:8787/api/discord/account-link/callback',
        guildId: '936687501316354068',
      },
    });
    const start = await requestJson(
      '/api/discord/account-link/start',
      { method: 'POST', familyMemberId: 'family-1' },
      repository,
      config,
    );

    expect(start.status).toBe(200);
    expect(start.body.authorizationUrl).toContain('https://discord.com/oauth2/authorize');
    expect(start.body.authorizationUrl).toContain('scope=identify+guilds.members.read');
    expect(start.body.authorizationUrl).not.toContain('test-client-secret');
    expect(await repository.getByFamilyMemberId('family-1')).toBeNull();
  });

  it('callback access_denied does not create a fake link or return tokens', async () => {
    const repository = new InMemoryDiscordAccountLinkRepository();
    const result = await requestText(
      '/api/discord/account-link/callback?error=access_denied&state=ignored',
      {},
      repository,
    );

    expect(result.status).toBe(400);
    expect(result.body).toContain('discord_oauth_denied');
    expect(result.body).not.toContain('access_token');
    expect(await repository.getByFamilyMemberId('family-1')).toBeNull();
  });

  it('does not return secrets in account link responses', async () => {
    const repository = new InMemoryDiscordAccountLinkRepository();
    await repository.save(createLink('family-1'));

    const result = await requestJson('/api/discord/account-link', { familyMemberId: 'family-1' }, repository);

    expect(result.status).toBe(200);
    expect(result.body).not.toHaveProperty('accessToken');
    expect(result.body).not.toHaveProperty('refreshToken');
    expect(result.body).not.toHaveProperty('clientSecret');
  });

  it('production does not trust x-family-member-id', async () => {
    const result = await requestJson(
      '/api/discord/account-link',
      { familyMemberId: 'family-1' },
      new InMemoryDiscordAccountLinkRepository(),
      createTestConfig({ nodeEnv: 'production' }),
    );

    expect(result.status).toBe(503);
    expect(result.body).toMatchObject({ error: 'database_unavailable' });
  });
});
