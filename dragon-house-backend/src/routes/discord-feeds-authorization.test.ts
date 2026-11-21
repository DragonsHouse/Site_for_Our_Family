import { afterEach, describe, expect, it } from 'vitest';
import type { DiscordService } from '../discord/discord-service.js';
import { getJson, startRouterWithActors, type TestActorName } from '../test/actor-sessions.js';
import type { ExternalFamilyQuest } from '../types.js';
import { createFamilyAccountingRouter } from './family-accounting.js';
import { createFamilyQuestsRouter } from './family-quests.js';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (closers.length) await closers.pop()?.();
});

const channels = { accounting: 'accounting-channel', questAnnouncements: 'quest-channel', adminLog: 'admin-channel' };

const accountingMessage = {
  externalId: 'msg-1',
  channelId: 'accounting-channel',
  authorId: '123456789012345678',
  authorName: 'Treasurer',
  authorAvatarUrl: 'https://cdn.example/avatar.png',
  content: 'Paid 150000 to member',
  createdAt: '2026-01-01T00:00:00.000Z',
  editedAt: null,
  attachmentCount: 1,
  attachments: [{ id: 'att-1', filename: 'proof.png', contentType: 'image/png', url: 'https://cdn.example/proof.png', proxyUrl: 'https://cdn.example/p.png', size: 10, width: 1, height: 1 }],
};

const embedQuest: ExternalFamilyQuest = {
  externalId: 'embed-1',
  channelId: 'quest-channel',
  authorId: '223456789012345678',
  authorName: 'Bot',
  messageCreatedAt: '2026-01-01T00:00:00.000Z',
  title: 'Каптьорики: нічний рейд',
  status: 'recruiting',
  participants: ['Visible_Player', '<@323456789012345678>'],
  helpers: ['Helper_Player'],
  participantDetails: [{ displayName: 'Visible_Player', discordUserId: '423456789012345678', rewardAmount: 50000, rewardPercent: 50, payoutStatus: 'paid' }],
  totalReward: 100000,
  paidReward: 50000,
  remainingReward: 50000,
  rewardLines: [{ displayName: 'Visible_Player', discordUserId: '423456789012345678', amount: 50000, rewardPercent: 50, status: 'paid' }],
  startsAt: '2026-01-02T00:00:00.000Z',
  completedAt: null,
  organizer: { displayName: '<@523456789012345678>', discordUserId: '523456789012345678' },
  source: 'discord_embed',
  sourceQuestId: 'quest-1',
  templateKey: 'night-raid',
  sourceMessageIds: ['m1'],
  warnings: ['internal parser warning'],
  raw: { content: 'raw private message text' },
};

const adminLogQuest: ExternalFamilyQuest = {
  ...embedQuest,
  externalId: 'audit-1',
  title: 'Admin log only quest',
  source: 'discord_audit_log',
  sourceQuestId: 'quest-2',
  raw: { events: ['private admin event'] },
};

function fakeDiscord(calls: string[], limits: number[] = []) {
  return {
    fetchAccountingMessages: async () => {
      calls.push('accounting');
      return [accountingMessage];
    },
    fetchQuestMessages: async (limit: number) => {
      calls.push('quests');
      limits.push(limit);
      return [embedQuest, adminLogQuest];
    },
  } as unknown as DiscordService;
}

describe('GET /family/accounting/discord-feed authorization', () => {
  async function start(calls: string[]) {
    const server = await startRouterWithActors(
      (config, authService) => createFamilyAccountingRouter(config, authService, null, null, fakeDiscord(calls)),
      { discord: { channels } },
    );
    closers.push(server.close);
    return server;
  }

  it('returns 403 to members and non-accounting managers without calling Discord', async () => {
    const calls: string[] = [];
    const { baseUrl, tokens } = await start(calls);
    for (const actor of ['member', 'mapManager', 'questManager', 'discordManager', 'memberManager'] as TestActorName[]) {
      const result = await getJson(`${baseUrl}/api/family/accounting/discord-feed`, tokens[actor]);
      expect(result.status, actor).toBe(403);
      expect(result.body).toMatchObject({ code: 'ACCOUNTING_PERMISSION_DENIED' });
      expect(JSON.stringify(result.body), actor).not.toMatch(/Paid 150000|proof\.png|123456789012345678/u);
    }
    expect(calls).toEqual([]);
    expect((await fetch(`${baseUrl}/api/family/accounting/discord-feed`)).status).toBe(401);
  });

  it('serves the feed to owners, rank-8 leadership and accounting managers', async () => {
    const calls: string[] = [];
    const { baseUrl, tokens } = await start(calls);
    for (const actor of ['owner', 'deputy', 'accountingManager'] as TestActorName[]) {
      const result = await getJson(`${baseUrl}/api/family/accounting/discord-feed`, tokens[actor]);
      expect(result.status, actor).toBe(200);
      expect(result.body).toMatchObject({ status: 'synced', items: [{ content: 'Paid 150000 to member' }] });
    }
    expect(calls).toEqual(['accounting', 'accounting', 'accounting']);
  });

  it('does not leak Discord error details', async () => {
    const failing = {
      fetchAccountingMessages: async () => {
        throw new Error('Missing Access to channel 123456789012345678 token=abc');
      },
    } as unknown as DiscordService;
    const server = await startRouterWithActors(
      (config, authService) => createFamilyAccountingRouter(config, authService, null, null, failing),
      { discord: { channels } },
    );
    closers.push(server.close);
    const result = await getJson(`${server.baseUrl}/api/family/accounting/discord-feed`, server.tokens.owner);
    expect(result.body).toMatchObject({ status: 'error', error: 'Discord accounting feed is unavailable' });
    expect(JSON.stringify(result.body)).not.toContain('token=abc');
  });
});

describe('GET /family/quests/discord-feed authorization and redaction', () => {
  async function start(calls: string[], limits: number[]) {
    const server = await startRouterWithActors(
      (config, authService) => createFamilyQuestsRouter(config, authService, null, null, fakeDiscord(calls, limits)),
      { discord: { channels } },
    );
    closers.push(server.close);
    return server;
  }

  it('shows members only public announcement fields', async () => {
    const calls: string[] = [];
    const limits: number[] = [];
    const { baseUrl, tokens } = await start(calls, limits);
    for (const actor of ['member', 'mapManager', 'discordManager'] as TestActorName[]) {
      const result = await getJson(`${baseUrl}/api/family/quests/discord-feed?limit=500`, tokens[actor]);
      expect(result.status, actor).toBe(200);
      expect(result.body.items).toEqual([{
        externalId: 'embed-1',
        title: 'Каптьорики: нічний рейд',
        status: 'recruiting',
        participants: ['Visible_Player', 'Учасник Discord'],
        helpers: ['Helper_Player'],
        startsAt: '2026-01-02T00:00:00.000Z',
        completedAt: null,
        messageCreatedAt: '2026-01-01T00:00:00.000Z',
        organizer: { displayName: 'Учасник Discord' },
        source: 'discord_embed',
        sourceQuestId: 'quest-1',
        templateKey: 'night-raid',
      }]);
      expect(JSON.stringify(result.body), actor).not.toMatch(/50000|100000|\d{17,20}|raw private|private admin|Admin log only|internal parser warning|payoutStatus/u);
    }
    expect(limits).toEqual([50, 50, 50]);
  });

  it('shows quest and accounting managers the parsed feed without the raw Discord payload', async () => {
    const calls: string[] = [];
    const limits: number[] = [];
    const { baseUrl, tokens } = await start(calls, limits);
    for (const actor of ['owner', 'deputy', 'questManager', 'accountingManager'] as TestActorName[]) {
      const result = await getJson(`${baseUrl}/api/family/quests/discord-feed?limit=300`, tokens[actor]);
      const items = result.body.items as Array<Record<string, unknown>>;
      expect(result.status, actor).toBe(200);
      expect(items.map((item) => item.externalId)).toEqual(['embed-1', 'audit-1']);
      expect(items[0]).toMatchObject({ totalReward: 100000, rewardLines: [{ amount: 50000 }] });
      expect(JSON.stringify(items), actor).not.toMatch(/raw private|private admin/u);
      expect(items.every((item) => !('raw' in item)), actor).toBe(true);
    }
    expect(limits).toEqual([300, 300, 300, 300]);
  });

  it('requires an authenticated session', async () => {
    const { baseUrl } = await start([], []);
    expect((await fetch(`${baseUrl}/api/family/quests/discord-feed`)).status).toBe(401);
  });
});
