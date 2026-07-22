import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { DiscordGuildMemberReaderError } from '../discord/guild-member-reader.js';
import type { DiscordMemberSyncDryRunService } from '../discord/member-sync-dry-run-service.js';
import { createTestConfig } from '../test/test-config.js';
import type { FamilyAuthService } from '../auth/auth-service.js';

const servers: Array<{ close: (callback?: (error?: Error) => void) => void }> = [];

function authService(role: 'owner' | 'member'): FamilyAuthService {
  return {
    authenticateToken: async () => ({
      context: {
        familyMemberId: 'family-1',
        role,
        rank: role === 'owner' ? 10 : 1,
        permissions: [],
      },
      session: {
        sessionId: 'session-1',
        familyMemberId: 'family-1',
        tokenHash: 'hash',
        createdAt: '2026-07-20T00:00:00.000Z',
        expiresAt: '2026-07-21T00:00:00.000Z',
        lastUsedAt: '2026-07-20T00:00:00.000Z',
      },
    }),
  } as unknown as FamilyAuthService;
}

function dryRunService(run: DiscordMemberSyncDryRunService['run']): DiscordMemberSyncDryRunService {
  return { run } as DiscordMemberSyncDryRunService;
}

async function requestDryRun(service: DiscordMemberSyncDryRunService, auth = authService('owner')) {
  const { app } = createApp(createTestConfig(), {
    authService: auth,
    memberSyncDryRunService: service,
  });
  const server = app.listen(0);
  servers.push(server);
  const address = server.address() as AddressInfo;
  const response = await fetch(`http://127.0.0.1:${address.port}/api/discord/sync/members/dry-run`, {
    method: 'POST',
    headers: { authorization: 'Bearer test-token' },
  });
  return { status: response.status, body: await response.json() };
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

describe('Discord sync dry-run route', () => {
  it('requires owner auth', async () => {
    const result = await requestDryRun(
      dryRunService(async () => ({
        generatedAt: '2026-07-20T00:00:00.000Z',
        guildId: 'guild-1',
        discordMemberCount: 0,
        familyMemberCount: 0,
        summary: { create: 0, update: 0, unchanged: 0, deactivate_candidate: 0, conflict: 0, ignored_bot: 0 },
        actions: [],
        warnings: [],
        conflicts: [],
        missingRoleMappings: [],
      })),
      authService('member'),
    );

    expect(result.status).toBe(403);
    expect(result.body).toEqual({ error: 'owner_required' });
  });

  it('returns dry-run output for owners', async () => {
    const result = await requestDryRun(
      dryRunService(async () => ({
        generatedAt: '2026-07-20T00:00:00.000Z',
        guildId: 'guild-1',
        discordMemberCount: 1,
        familyMemberCount: 0,
        summary: { create: 1, update: 0, unchanged: 0, deactivate_candidate: 0, conflict: 0, ignored_bot: 0 },
        actions: [],
        warnings: [],
        conflicts: [],
        missingRoleMappings: [],
      })),
    );

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ guildId: 'guild-1', discordMemberCount: 1 });
  });

  it('sanitizes missing configuration errors', async () => {
    const result = await requestDryRun(
      dryRunService(async () => {
        throw new DiscordGuildMemberReaderError('discord_sync_not_configured', 'DISCORD_BOT_TOKEN and DISCORD_GUILD_ID are required.');
      }),
    );

    expect(result.status).toBe(503);
    expect(result.body.error).toBe('discord_sync_not_configured');
    expect(JSON.stringify(result.body)).not.toContain('token-value');
  });

  it('sanitizes Discord API errors', async () => {
    const result = await requestDryRun(
      dryRunService(async () => {
        throw new DiscordGuildMemberReaderError('discord_api_error', 'Discord API member fetch failed.');
      }),
    );

    expect(result.status).toBe(502);
    expect(result.body).toEqual({ error: 'discord_api_error', message: 'Discord API member fetch failed.' });
  });
});
