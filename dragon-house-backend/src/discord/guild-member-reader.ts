import {
  Client,
  DiscordAPIError,
  GatewayIntentBits,
  type Guild,
  type GuildMember,
  type User,
} from 'discord.js';
import type { AppConfig } from '../config/env.js';
import type { NormalizedDiscordGuildMember } from '../types.js';

export type DiscordGuildMemberReaderErrorCode =
  | 'discord_sync_not_configured'
  | 'discord_guild_members_intent_required'
  | 'discord_api_error';

export class DiscordGuildMemberReaderError extends Error {
  constructor(
    readonly code: DiscordGuildMemberReaderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DiscordGuildMemberReaderError';
  }
}

export interface DiscordGuildMemberReader {
  fetchGuildMembers(): Promise<NormalizedDiscordGuildMember[]>;
}

export type DiscordClientLike = {
  login(token: string): Promise<string>;
  guilds: {
    fetch(guildId: string): Promise<Guild>;
  };
  destroy(): void;
};

export class DiscordJsGuildMemberReader implements DiscordGuildMemberReader {
  constructor(
    private readonly config: AppConfig,
    private readonly clientFactory: () => DiscordClientLike = () =>
      new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] }),
  ) {}

  async fetchGuildMembers(): Promise<NormalizedDiscordGuildMember[]> {
    const botToken = this.config.discord.botToken;
    const guildId = this.config.discord.guildId;
    if (!botToken || !guildId) {
      throw new DiscordGuildMemberReaderError(
        'discord_sync_not_configured',
        'DISCORD_BOT_TOKEN and DISCORD_GUILD_ID are required for Discord member sync.',
      );
    }

    const client = this.clientFactory();
    try {
      await client.login(botToken);
      const guild = await client.guilds.fetch(guildId);
      const members = await guild.members.fetch();
      return [...members.values()].map((member) => normalizeDiscordGuildMember(guild.id, member));
    } catch (error) {
      throw sanitizeDiscordError(error);
    } finally {
      client.destroy();
    }
  }
}

export function normalizeDiscordGuildMember(
  guildId: string,
  member: Pick<GuildMember, 'nickname' | 'joinedAt' | 'displayAvatarURL'> & {
    user: Pick<User, 'id' | 'username' | 'globalName' | 'bot'>;
    roles: { cache: Map<string, { id: string }> };
  },
): NormalizedDiscordGuildMember {
  return {
    discordUserId: member.user.id,
    username: member.user.username,
    globalName: member.user.globalName ?? null,
    serverNickname: member.nickname ?? null,
    avatarUrl: member.displayAvatarURL({ extension: 'png', size: 128 }),
    guildId,
    roleIds: [...member.roles.cache.values()]
      .map((role) => role.id)
      .filter((roleId) => roleId !== guildId)
      .sort(),
    joinedAt: member.joinedAt?.toISOString() ?? null,
    bot: member.user.bot,
  };
}

function sanitizeDiscordError(error: unknown): DiscordGuildMemberReaderError {
  if (isMissingIntentError(error)) {
    return new DiscordGuildMemberReaderError(
      'discord_guild_members_intent_required',
      'Discord Guild Members privileged intent is required for member sync.',
    );
  }
  return new DiscordGuildMemberReaderError('discord_api_error', 'Discord API member fetch failed.');
}

function isMissingIntentError(error: unknown): boolean {
  if (error instanceof DiscordAPIError) return error.code === 50001 || error.code === 50013 || error.code === 4014;
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : '';
  return candidate.code === 4014 || message.includes('privileged intent') || message.includes('disallowed intent');
}
