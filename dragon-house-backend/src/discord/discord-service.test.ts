import { ChannelType, PermissionFlagsBits, TextChannel } from 'discord.js';
import { describe, expect, it } from 'vitest';
import { createTestConfig } from '../test/test-config.js';
import { DiscordService, isTrustedDiscordSource } from './discord-service.js';

const channelId = 'configured-channel';

describe('DiscordService channel access validation', () => {
  it('rejects a configured channel when ViewChannel is missing', async () => {
    const service = serviceWithChannel([]);

    await expect(service.validateChannelAccess(channelId)).resolves.toMatchObject({
      ok: false,
      code: 'DISCORD_CHANNEL_PERMISSION_MISSING',
      missingPermissions: expect.arrayContaining(['ViewChannel']),
    });
  });

  it('rejects a configured channel when SendMessages is missing', async () => {
    const service = serviceWithChannel(['ViewChannel', 'ReadMessageHistory', 'EmbedLinks']);

    await expect(service.validateChannelAccess(channelId)).resolves.toMatchObject({
      ok: false,
      code: 'DISCORD_CHANNEL_PERMISSION_MISSING',
      missingPermissions: ['SendMessages'],
    });
  });

  it('rejects a configured channel when ReadMessageHistory is missing', async () => {
    const service = serviceWithChannel(['ViewChannel', 'SendMessages', 'EmbedLinks']);

    await expect(service.validateChannelAccess(channelId)).resolves.toMatchObject({
      ok: false,
      code: 'DISCORD_CHANNEL_PERMISSION_MISSING',
      missingPermissions: ['ReadMessageHistory'],
    });
  });

  it('rejects a configured channel when EmbedLinks is missing', async () => {
    const service = serviceWithChannel(['ViewChannel', 'SendMessages', 'ReadMessageHistory']);

    await expect(service.validateChannelAccess(channelId)).resolves.toMatchObject({
      ok: false,
      code: 'DISCORD_CHANNEL_PERMISSION_MISSING',
      missingPermissions: ['EmbedLinks'],
    });
  });

  it('allows a configured text channel when all required permissions are present', async () => {
    const service = serviceWithChannel(['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'EmbedLinks']);

    await expect(service.validateChannelAccess(channelId)).resolves.toEqual({
      ok: true,
      channelId,
      requiredPermissions: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'EmbedLinks'],
      missingPermissions: [],
    });
  });

  it('does not allow an arbitrary unconfigured channel even when fetchable', async () => {
    const service = serviceWithChannel(['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'EmbedLinks']);

    await expect(service.validateChannelAccess('random-channel')).resolves.toMatchObject({
      ok: false,
      code: 'DISCORD_CHANNEL_NOT_ALLOWED',
    });
  });
});

describe('isTrustedDiscordSource', () => {
  it('accepts a configured trusted bot author', () => {
    const config = createTestConfig({ discord: { trustedBotUserId: 'bot-1' } });

    expect(isTrustedDiscordSource(config, messageSource({ authorId: 'bot-1' }))).toBe(true);
  });

  it('rejects random members and unconfigured trust', () => {
    const trusted = createTestConfig({ discord: { trustedBotUserId: 'bot-1' } });
    const unconfigured = createTestConfig();

    expect(isTrustedDiscordSource(trusted, messageSource({ authorId: 'member-1' }))).toBe(false);
    expect(isTrustedDiscordSource(unconfigured, messageSource({ authorId: 'bot-1' }))).toBe(false);
  });

  it('accepts configured application or webhook identities', () => {
    const config = createTestConfig({ discord: { trustedApplicationId: 'app-1', trustedWebhookId: 'webhook-1' } });

    expect(isTrustedDiscordSource(config, messageSource({ authorId: 'other', applicationId: 'app-1' }))).toBe(true);
    expect(isTrustedDiscordSource(config, messageSource({ authorId: 'other', webhookId: 'webhook-1' }))).toBe(true);
  });
});

type RequiredPermissionName = 'ViewChannel' | 'SendMessages' | 'ReadMessageHistory' | 'EmbedLinks' | 'AttachFiles';

function serviceWithChannel(permissionNames: RequiredPermissionName[]) {
  const service = new DiscordService(createTestConfig({
    discord: {
      clientId: 'client-id',
      clientSecret: 'client-secret',
      botToken: 'bot-token',
      redirectUri: 'http://localhost/discord',
      guildId: 'guild-id',
      channels: { questAnnouncements: channelId },
    },
  }));
  const allowedFlags = new Set(permissionNames.map((name) => permissionFlag(name)));
  const channel = Object.assign(Object.create(TextChannel.prototype), {
    type: ChannelType.GuildText,
    guild: {
      members: {
        me: { id: 'bot-member' },
        fetchMe: async () => ({ id: 'bot-member' }),
      },
    },
    permissionsFor: () => ({
      has: (flag: bigint) => allowedFlags.has(flag),
    }),
  }) as TextChannel;
  (service as unknown as { client: unknown }).client = {
    isReady: () => true,
    channels: {
      fetch: async () => channel,
    },
  };
  return service;
}

function messageSource(input: { authorId: string; applicationId?: string | null; webhookId?: string | null }) {
  return {
    author: { id: input.authorId },
    applicationId: input.applicationId ?? null,
    webhookId: input.webhookId ?? null,
  };
}

function permissionFlag(name: RequiredPermissionName): bigint {
  return {
    ViewChannel: PermissionFlagsBits.ViewChannel,
    SendMessages: PermissionFlagsBits.SendMessages,
    ReadMessageHistory: PermissionFlagsBits.ReadMessageHistory,
    EmbedLinks: PermissionFlagsBits.EmbedLinks,
    AttachFiles: PermissionFlagsBits.AttachFiles,
  }[name];
}
