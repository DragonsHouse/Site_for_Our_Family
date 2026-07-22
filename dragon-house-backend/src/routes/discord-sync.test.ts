import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { DiscordGuildMemberReaderError } from '../discord/guild-member-reader.js';
import { DiscordMemberSyncApplyConflictError, type DiscordMemberSyncApplyService } from '../discord/member-sync-apply-service.js';
import type { DiscordMemberSyncDryRunService } from '../discord/member-sync-dry-run-service.js';
import { clearRateLimitBucketsForTests } from '../middleware/rate-limit.js';
import { createTestConfig } from '../test/test-config.js';
import type { FamilyAuthService } from '../auth/auth-service.js';

const servers: Array<{ close: (callback?: (error?: Error) => void) => void }> = [];
const PLAN_ID = 'b'.repeat(32);
const PLAN_HASH = 'a'.repeat(64);
const GENERATED_AT = '2026-07-20T00:00:00.000Z';
const EXPIRES_AT = '2026-07-20T00:05:00.000Z';

function authService(role: 'owner' | 'member', familyMemberId = 'family-1'): FamilyAuthService {
  return {
    authenticateToken: async () => ({
      context: {
        familyMemberId,
        role,
        rank: role === 'owner' ? 10 : 1,
        permissions: [],
      },
      session: {
        sessionId: 'session-1',
        familyMemberId,
        tokenHash: 'hash',
        createdAt: '2026-07-20T00:00:00.000Z',
        expiresAt: '2026-07-21T00:00:00.000Z',
        lastUsedAt: '2026-07-20T00:00:00.000Z',
      },
    }),
  } as unknown as FamilyAuthService;
}

function dryRunResult(input: Partial<Awaited<ReturnType<DiscordMemberSyncDryRunService['run']>>> = {}) {
  return {
    planId: PLAN_ID,
    generatedAt: GENERATED_AT,
    planExpiresAt: EXPIRES_AT,
    planHash: PLAN_HASH,
    guildId: 'guild-1',
    discordMemberCount: 0,
    familyMemberCount: 0,
    summary: { create: 0, update: 0, unchanged: 0, deactivate_candidate: 0, conflict: 0, ignored_bot: 0 },
    actions: [],
    warnings: [],
    conflicts: [],
    missingRoleMappings: [],
    ...input,
  };
}

function applyResult(input: Partial<Awaited<ReturnType<DiscordMemberSyncApplyService['apply']>>> = {}) {
  const applyRequest = {
    confirm: true as const,
    planId: PLAN_ID,
    planGeneratedAt: GENERATED_AT,
    planExpiresAt: EXPIRES_AT,
    planHash: PLAN_HASH,
    idempotencyKey: 'test-apply-key',
  };
  return {
    syncRunId: 'sync-1',
    idempotencyKey: applyRequest.idempotencyKey,
    applyRequest,
    generatedAt: GENERATED_AT,
    mode: 'apply' as const,
    status: 'succeeded' as const,
    dryRun: dryRunResult(),
    summary: { created: 0, updated: 0, skipped: 0, inactive: 0, reactivated: 0, conflicts: 0, warnings: 0, errors: 0, auditEntries: 0 },
    created: [],
    updated: [],
    deactivated: [],
    reactivated: [],
    skipped: [],
    conflicts: [],
    warnings: [],
    errors: [],
    auditEntries: 0,
    reportPath: '',
    ...input,
  };
}

function dryRunService(run: DiscordMemberSyncDryRunService['run']): DiscordMemberSyncDryRunService {
  return { run } as DiscordMemberSyncDryRunService;
}

function applyService(apply: DiscordMemberSyncApplyService['apply']): DiscordMemberSyncApplyService {
  return {
    apply,
    getLatestReport: async () => ({ syncRunId: 'sync-1' }),
  } as unknown as DiscordMemberSyncApplyService;
}

async function withServer(dependencies: Parameters<typeof createApp>[1], config = createTestConfig()) {
  const { app } = createApp(config, dependencies);
  const server = app.listen(0);
  servers.push(server);
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function requestDryRun(service: DiscordMemberSyncDryRunService, auth = authService('owner')) {
  const baseUrl = await withServer({ authService: auth, memberSyncDryRunService: service });
  const response = await fetch(`${baseUrl}/api/discord/sync/members/dry-run`, {
    method: 'POST',
    headers: { authorization: 'Bearer test-token' },
  });
  return { status: response.status, body: await response.json(), headers: response.headers };
}

async function requestApply(service: DiscordMemberSyncApplyService, auth = authService('owner')) {
  const baseUrl = await withServer({
    authService: auth,
    memberSyncDryRunService: dryRunService(async () => dryRunResult()),
    memberSyncApplyService: service,
  });
  const response = await fetch(`${baseUrl}/api/discord/apply-sync`, {
    method: 'POST',
    headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
    body: JSON.stringify({
      confirm: true,
      planId: PLAN_ID,
      planGeneratedAt: GENERATED_AT,
      planExpiresAt: EXPIRES_AT,
      planHash: PLAN_HASH,
      idempotencyKey: 'test-apply-key',
    }),
  });
  return { status: response.status, body: await response.json(), headers: response.headers };
}

afterEach(async () => {
  clearRateLimitBucketsForTests();
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
    const result = await requestDryRun(dryRunService(async () => dryRunResult()), authService('member'));

    expect(result.status).toBe(403);
    expect(result.body).toEqual({ error: 'owner_required' });
  });

  it('returns dry-run output for owners', async () => {
    const result = await requestDryRun(dryRunService(async () => dryRunResult({ discordMemberCount: 1, summary: { ...dryRunResult().summary, create: 1 } })));

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ guildId: 'guild-1', discordMemberCount: 1, planHash: PLAN_HASH, planId: PLAN_ID });
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

  it('supports the short dry-run alias', async () => {
    const baseUrl = await withServer({
      authService: authService('owner'),
      memberSyncDryRunService: dryRunService(async () => dryRunResult({ guildId: 'guild-1', discordMemberCount: 1 })),
    });

    const response = await fetch(`${baseUrl}/api/discord/dry-run`, {
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ guildId: 'guild-1' });
  });

  it('rate limits expensive dry-run requests by authenticated member', async () => {
    const baseUrl = await withServer(
      {
        authService: authService('owner', 'owner-1'),
        memberSyncDryRunService: dryRunService(async () => dryRunResult()),
      },
      createTestConfig({ discord: { sync: { dryRunRateLimitPerMinute: 1 } } }),
    );

    const first = await fetch(`${baseUrl}/api/discord/dry-run`, { method: 'POST', headers: { authorization: 'Bearer test-token' } });
    const second = await fetch(`${baseUrl}/api/discord/dry-run`, { method: 'POST', headers: { authorization: 'Bearer test-token' } });

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.headers.get('retry-after')).not.toBeNull();
    expect((await second.json()).error).toBe('rate_limited');
  });

  it('protects apply sync with owner auth', async () => {
    const result = await requestApply(applyService(async () => applyResult()), authService('member'));

    expect(result.status).toBe(403);
    expect(result.body).toEqual({ error: 'owner_required' });
  });

  it('runs apply sync for owners', async () => {
    const result = await requestApply(applyService(async () => applyResult({ summary: { ...applyResult().summary, created: 1 }, created: ['member-1'], auditEntries: 1 })));

    expect(result.status).toBe(200);
    expect(result.body.summary.created).toBe(1);
  });

  it('requires apply confirmation, plan identity, plan hash and idempotency key', async () => {
    const baseUrl = await withServer({
      authService: authService('owner'),
      memberSyncDryRunService: dryRunService(async () => dryRunResult()),
      memberSyncApplyService: applyService(async () => {
        throw new Error('apply should not run');
      }),
    });

    const response = await fetch(`${baseUrl}/api/discord/apply-sync`, {
      method: 'POST',
      headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
      body: JSON.stringify({ confirm: true, planHash: PLAN_HASH }),
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('discord_apply_sync_confirmation_required');
  });

  it('maps stale plan conflicts to safe 409 responses', async () => {
    const result = await requestApply(
      applyService(async () => {
        throw new DiscordMemberSyncApplyConflictError('discord_sync_plan_expired', 'expired');
      }),
    );

    expect(result.status).toBe(409);
    expect(result.body).toEqual({ error: 'discord_sync_plan_expired', message: 'expired' });
  });
});
