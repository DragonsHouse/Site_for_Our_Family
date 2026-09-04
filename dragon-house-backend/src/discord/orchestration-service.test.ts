import { describe, expect, it, vi } from 'vitest';
import { InMemoryDiscordAccountLinkRepository } from './account-link-repository.js';
import { buildDragonCommandDefinitions, safeDiscordRegistrationTarget, validateDiscordCommandRegistrationConfig } from './command-definitions.js';
import { DiscordIdentityResolver } from './identity-resolver.js';
import type { DiscordMessagePayload, DiscordMessageTransport } from './orchestration-models.js';
import { InMemoryDiscordOrchestrationRepository } from './orchestration-repository.js';
import { DiscordOrchestrationService } from './orchestration-service.js';
import { MemoryFamilyMemberRepository } from '../members/member-repository.js';
import type { FamilyQuestService } from '../quests/quest-service.js';
import { createTestConfig } from '../test/test-config.js';
import type { TowerDefenseService } from '../tower-defense/tower-defense-service.js';
import type { FamilyEventService } from '../family-events/family-event-service.js';
import type { FamilyMember } from '../types.js';

const memberId = 'member-1';
const discordUserId = 'discord-1';
const guildId = 'guild-1';
const channelId = 'quest-channel';

describe('DiscordOrchestrationService', () => {
  it('resolves linked Discord user and calls Quest domain join through service', async () => {
    const { service, questService } = await buildService();

    const response = await service.handleInteraction({
      interactionId: 'interaction-join',
      guildId,
      channelId,
      discordUserId,
      customId: 'dh:q:join:00000000-0000-4000-8000-000000000001',
    });

    expect(response).toMatchObject({ ok: true, sourceModule: 'family_quests' });
    expect(questService.joinQuest).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000001',
      expect.objectContaining({ role: 'participant', metadata: { source: 'discord' } }),
      expect.objectContaining({ familyMemberId: memberId }),
      expect.any(Date),
    );
  });

  it('returns a friendly link instruction for unlinked Discord users', async () => {
    const { service } = await buildService({ link: false });

    const response = await service.handleInteraction({
      interactionId: 'interaction-unlinked',
      guildId,
      channelId,
      discordUserId: 'unknown-discord-user',
      customId: 'dh:q:join:00000000-0000-4000-8000-000000000001',
    });

    expect(response.ok).toBe(false);
    expect(response.code).toBe('DISCORD_ACCOUNT_NOT_LINKED');
    expect(response.content).toContain('ще не привʼязаний');
  });

  it('rejects interactions outside the configured guild', async () => {
    const { service } = await buildService();

    const response = await service.handleInteraction({
      interactionId: 'interaction-wrong-guild',
      guildId: 'other-guild',
      channelId,
      discordUserId,
      customId: 'dh:q:join:00000000-0000-4000-8000-000000000001',
    });

    expect(response.ok).toBe(false);
    expect(response.code).toBe('DISCORD_GUILD_NOT_ALLOWED');
  });

  it('handles Tower Defense response without marking attendance', async () => {
    const { service, towerDefenseService } = await buildService();

    await service.handleInteraction({
      interactionId: 'interaction-tower',
      guildId,
      channelId,
      discordUserId,
      customId: 'dh:t:respond:00000000-0000-4000-8000-000000000002:confirmed',
    });

    expect(towerDefenseService.respond).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000002',
      expect.objectContaining({ response: 'confirmed', source: 'discord', idempotencyKey: 'interaction-tower' }),
      expect.objectContaining({ familyMemberId: memberId }),
      expect.any(Date),
    );
    expect(towerDefenseService.confirmAttendance).not.toHaveBeenCalled();
  });

  it('does not call the domain service twice for a repeated interaction idempotency key', async () => {
    const { service, towerDefenseService } = await buildService();
    const request = {
      interactionId: 'interaction-repeat',
      guildId,
      channelId,
      discordUserId,
      customId: 'dh:t:respond:00000000-0000-4000-8000-000000000002:confirmed',
    };

    await service.handleInteraction(request);
    const repeated = await service.handleInteraction(request);

    expect(repeated.content).toContain('вже оброблено');
    expect(towerDefenseService.respond).toHaveBeenCalledTimes(1);
  });

  it('upserts Family Event response through the event domain service', async () => {
    const { service, familyEventService } = await buildService();

    const response = await service.handleInteraction({
      interactionId: 'interaction-event',
      guildId,
      channelId,
      discordUserId,
      customId: 'dh:e:respond:00000000-0000-4000-8000-000000000003:confirmed',
    });

    expect(response.ok).toBe(true);
    expect(familyEventService.respond).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000003',
      expect.objectContaining({ response: 'confirmed', metadata: { source: 'discord' } }),
      expect.objectContaining({ familyMemberId: memberId }),
      expect.any(Date),
    );
  });

  it('updates existing Discord message instead of creating a duplicate on retry', async () => {
    const transport = fakeTransport();
    const { service } = await buildService({ transport });
    const auth = { familyMemberId: memberId, role: 'member' as const, rank: 4, status: 'active' as const, permissions: [] };

    await service.publishQuest('00000000-0000-4000-8000-000000000001', channelId, auth);
    await service.publishQuest('00000000-0000-4000-8000-000000000001', channelId, auth);

    expect(transport.sent).toHaveLength(1);
    expect(transport.edited).toHaveLength(1);
    expect(transport.edited[0]).toMatchObject({ messageId: 'message-1' });
  });

  it('recovers when a stored Discord message was deleted before sync', async () => {
    const transport = fakeTransport({ failEdit: true });
    const { service } = await buildService({ transport });
    const auth = { familyMemberId: memberId, role: 'member' as const, rank: 4, status: 'active' as const, permissions: [] };

    await service.publishQuest('00000000-0000-4000-8000-000000000001', channelId, auth);
    const recovered = await service.publishQuest('00000000-0000-4000-8000-000000000001', channelId, auth);

    expect(transport.sent).toHaveLength(2);
    expect(transport.edited).toHaveLength(1);
    expect(recovered.state).toBe('synced');
    expect(recovered.messageExists).toBe(true);
  });

  it('rejects publish when Discord orchestration is disabled', async () => {
    const { service } = await buildService({ orchestrationEnabled: false, transport: fakeTransport() });
    const auth = { familyMemberId: memberId, role: 'owner' as const, rank: 10, status: 'active' as const, permissions: [] };

    await expect(service.publishQuest('00000000-0000-4000-8000-000000000001', channelId, auth)).rejects.toMatchObject({
      code: 'DISCORD_ORCHESTRATION_DISABLED',
    });
  });

  it('handles /dragon me through linked identity', async () => {
    const { service } = await buildService();

    const me = await service.handleCommand({
      interactionId: 'command-me',
      guildId,
      channelId,
      discordUserId,
      commandName: 'dragon',
      subcommand: 'me',
      options: {},
    });

    expect(me.ok).toBe(true);
    expect(me.content).toContain('Aten Rhoads');
    expect(me.content).toContain('Discord привʼязано');
  });

  it('routes Quest slash command actions through the Quest domain service', async () => {
    const { service, questService } = await buildService();

    await service.handleCommand({
      interactionId: 'command-quest-join',
      guildId,
      channelId,
      discordUserId,
      commandName: 'dragon',
      subcommand: 'quest',
      options: { action: 'join', quest_id: '00000000-0000-4000-8000-000000000001' },
    });

    expect(questService.joinQuest).toHaveBeenCalledTimes(1);
  });
});

describe('Discord command registration definitions', () => {
  it('defines deterministic /dragon subcommands', () => {
    const commands = buildDragonCommandDefinitions();

    expect(commands).toHaveLength(1);
    expect(commands[0].name).toBe('dragon');
    expect(commands[0].options.map((option) => option.name)).toEqual(['me', 'status', 'quest', 'tower', 'event']);
  });

  it('validates registration config without leaking token values', () => {
    expect(validateDiscordCommandRegistrationConfig({ clientId: null, botToken: 'secret-token', guildId: null })).toEqual([
      'DISCORD_CLIENT_ID',
      'DISCORD_GUILD_ID',
    ]);
    expect(safeDiscordRegistrationTarget({ clientId: '123456789012345678', botToken: 'secret-token', guildId: '987654321098765432' })).toEqual({
      applicationId: '123...678',
      guildId: '987...432',
    });
  });
});

async function buildService(options: { link?: boolean; transport?: FakeTransport | null; orchestrationEnabled?: boolean } = {}) {
  const config = createTestConfig({
    discord: {
      guildId,
      orchestration: { enabled: options.orchestrationEnabled ?? true },
      channels: {
        questAnnouncements: channelId,
        towerGuard: channelId,
        events: channelId,
      },
    },
  });
  const links = new InMemoryDiscordAccountLinkRepository();
  if (options.link !== false) {
    await links.save({
      familyMemberId: memberId,
      discordUserId,
      discordUsername: 'dragon',
      guildMemberVerified: true,
      linkedAt: '2026-08-13T10:00:00.000Z',
      updatedAt: '2026-08-13T10:00:00.000Z',
    });
  }
  const members = new MemoryFamilyMemberRepository([member()]);
  const repository = new InMemoryDiscordOrchestrationRepository();
  const questService = fakeQuestService();
  const towerDefenseService = fakeTowerDefenseService();
  const familyEventService = fakeFamilyEventService();
  const service = new DiscordOrchestrationService(
    config,
    new DiscordIdentityResolver(links, members),
    repository,
    options.transport === undefined ? null : options.transport,
    questService as unknown as FamilyQuestService,
    towerDefenseService as unknown as TowerDefenseService,
    familyEventService as unknown as FamilyEventService,
  );
  return { service, repository, questService, towerDefenseService, familyEventService };
}

function member(): FamilyMember {
  return {
    id: memberId,
    nickname: 'Aten Rhoads',
    staticId: '123',
    role: 'member',
    rank: 4,
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
    createdAt: '2026-08-13T10:00:00.000Z',
    updatedAt: '2026-08-13T10:00:00.000Z',
  };
}

function fakeQuestService() {
  return {
    listQuests: vi.fn(async () => ({ items: [] })),
    joinQuest: vi.fn(async (_id: string, input: { role: 'participant' | 'helper' }) => ({ role: input.role })),
    withdrawQuest: vi.fn(),
    completeQuest: vi.fn(),
    getQuest: vi.fn(async (id: string) => ({
      id,
      title: 'Допомога громадянам',
      description: 'Quest details',
      status: 'active',
      startsAt: '2026-08-13T10:00:00.000Z',
      participants: [],
      helpers: [],
      memberRewardPool: 700000,
    })),
  };
}

function fakeTowerDefenseService() {
  return {
    listDefenses: vi.fn(async () => ({ items: [] })),
    respond: vi.fn(),
    withdrawResponse: vi.fn(),
    startDefense: vi.fn(),
    completeDefense: vi.fn(),
    cancelDefense: vi.fn(),
    confirmAttendance: vi.fn(),
    getDefense: vi.fn(async (id: string) => ({
      id,
      title: 'Defense',
      tower: { name: 'Tower A' },
      status: 'scheduled',
      startsAt: '2026-08-13T10:00:00.000Z',
      commanderDisplayName: 'Commander',
      confirmedCount: 0,
      presentCount: 0,
      minimumGuardCount: 2,
    })),
  };
}

function fakeFamilyEventService() {
  return {
    listEvents: vi.fn(async () => ({ items: [] })),
    respond: vi.fn(),
    withdrawResponse: vi.fn(),
    startEvent: vi.fn(),
    completeEvent: vi.fn(),
    cancelEvent: vi.fn(),
    getEvent: vi.fn(async (id: string) => ({
      id,
      title: 'War Council',
      eventType: 'family_meeting',
      status: 'scheduled',
      startsAt: '2026-08-13T10:00:00.000Z',
      locationLabel: 'Hall',
      organizerDisplayName: 'Organizer',
      participantCount: 0,
    })),
  };
}

type FakeTransport = DiscordMessageTransport & {
  sent: Array<{ channelId: string; payload: DiscordMessagePayload }>;
  edited: Array<{ channelId: string; messageId: string; payload: DiscordMessagePayload }>;
  failEdit?: boolean;
};

function fakeTransport(options: { failEdit?: boolean } = {}): FakeTransport {
  const transport: FakeTransport = {
    sent: [],
    edited: [],
    failEdit: options.failEdit,
    async sendMessage(channel, payload) {
      this.sent.push({ channelId: channel, payload });
      return { messageId: `message-${this.sent.length}` };
    },
    async editMessage(channel, messageId, payload) {
      this.edited.push({ channelId: channel, messageId, payload });
      if (this.failEdit) throw new Error('Unknown Message');
      return { messageId };
    },
  };
  return transport;
}
