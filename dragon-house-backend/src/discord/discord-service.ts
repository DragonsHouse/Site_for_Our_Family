import { ChannelType, Client, Events, GatewayIntentBits, type Message, PermissionFlagsBits, TextChannel } from 'discord.js';
import {
  configuredChannelNames,
  configuredChannelPurposes,
  isDiscordConfigComplete,
  type AppConfig,
} from '../config/env.js';
import type {
  DiscordConnectionStatus,
  ExternalAccountingMessage,
  DiscordStatusResponse,
  ExternalFamilyQuest,
  PublicDiscordConfig,
} from '../types.js';
import { getAllowedChannelIds, isAllowedChannel } from './channel-allowlist.js';
import type { DiscordCommandOptionValue, DiscordCommandRequest, DiscordMessagePayload, DiscordMessageTransport } from './orchestration-models.js';
import type { DiscordInteractionRequest, DiscordInteractionResponse } from './orchestration-models.js';
import { aggregateDiscordQuestAuditMessages, parseDiscordQuestMessage } from './quest-message-parser.js';
import { parseDiscordTowerGuardMessage, type ExternalTowerGuardSignal } from './tower-message-parser.js';

const requiredChannelPermissions = [
  { name: 'ViewChannel', flag: PermissionFlagsBits.ViewChannel },
  { name: 'SendMessages', flag: PermissionFlagsBits.SendMessages },
  { name: 'ReadMessageHistory', flag: PermissionFlagsBits.ReadMessageHistory },
  { name: 'EmbedLinks', flag: PermissionFlagsBits.EmbedLinks },
] as const;

export type DiscordChannelAccessResult =
  | {
      ok: true;
      channelId: string;
      requiredPermissions: string[];
      missingPermissions: [];
    }
  | {
      ok: false;
      channelId: string;
      code:
        | 'DISCORD_CHANNEL_NOT_ALLOWED'
        | 'DISCORD_CLIENT_NOT_CONNECTED'
        | 'DISCORD_CHANNEL_UNAVAILABLE'
        | 'DISCORD_CHANNEL_NOT_TEXT'
        | 'DISCORD_BOT_MEMBER_UNAVAILABLE'
        | 'DISCORD_CHANNEL_PERMISSION_MISSING';
      message: string;
      requiredPermissions: string[];
      missingPermissions: string[];
    };

type DiscordServiceState = {
  status: DiscordConnectionStatus;
  lastConnectedAt: string | null;
  lastError: string | null;
};

export class DiscordService implements DiscordMessageTransport {
  private readonly client: Client;

  private readonly disabled: boolean;

  private state: DiscordServiceState;

  constructor(private readonly config: AppConfig) {
    this.disabled = !isDiscordConfigComplete(config);
    this.state = {
      status: this.disabled ? 'not_configured' : 'configured',
      lastConnectedAt: null,
      lastError: null,
    };
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent],
    });
  }

  get isConfigured(): boolean {
    return !this.disabled;
  }

  get isConnected(): boolean {
    return this.state.status === 'connected';
  }

  getPublicConfig(): PublicDiscordConfig {
    return {
      clientId: this.config.discord.clientId,
      redirectUri: this.config.discord.oauthRedirectUri,
      guildConfigured: Boolean(this.config.discord.guildId),
      configuredChannelNames: configuredChannelNames(this.config),
      configuredChannelPurposes: configuredChannelPurposes(this.config),
      connectionStatus: this.state.status,
    };
  }

  getStatus(): DiscordStatusResponse {
    return { ...this.state };
  }

  async connect(): Promise<DiscordStatusResponse> {
    if (this.disabled || !this.config.discord.botToken) {
      this.state = {
        ...this.state,
        status: 'not_configured',
        lastError: 'Discord configuration is incomplete',
      };
      return this.getStatus();
    }

    if (this.client.isReady()) {
      this.state = {
        status: 'connected',
        lastConnectedAt: this.state.lastConnectedAt ?? new Date().toISOString(),
        lastError: null,
      };
      return this.getStatus();
    }

    this.state = { ...this.state, status: 'connecting', lastError: null };
    try {
      await this.client.login(this.config.discord.botToken);
      if (!this.client.isReady()) await waitForClientReady(this.client);
      this.state = {
        status: 'connected',
        lastConnectedAt: new Date().toISOString(),
        lastError: null,
      };
    } catch {
      this.state = {
        ...this.state,
        status: 'error',
        lastError: 'Discord connection failed',
      };
    }
    return this.getStatus();
  }

  registerButtonInteractionHandler(handler: (request: DiscordInteractionRequest) => Promise<DiscordInteractionResponse>): void {
    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isButton() || !interaction.guildId || !interaction.channelId) return;
      if (!interaction.customId.startsWith('dh:')) return;
      await interaction.deferReply({ ephemeral: true });
      try {
        const result = await handler({
          interactionId: interaction.id,
          guildId: interaction.guildId,
          channelId: interaction.channelId,
          messageId: interaction.message.id,
          discordUserId: interaction.user.id,
          customId: interaction.customId,
        });
        await interaction.editReply({ content: result.content });
      } catch {
        await interaction.editReply({
          content: 'Не вдалося обробити дію в Dragon House Hub. Спробуй ще раз або звернися до старших.',
        });
      }
    });
  }

  registerCommandInteractionHandler(handler: (request: DiscordCommandRequest) => Promise<DiscordInteractionResponse>): void {
    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand() || interaction.commandName !== 'dragon' || !interaction.guildId) return;
      await interaction.deferReply({ ephemeral: true });
      const subcommand = interaction.options.getSubcommand(true);
      if (!isDragonSubcommand(subcommand)) {
        await interaction.editReply({
          content: 'Ця Discord-команда ще не підтримується Dragon House Hub.',
        });
        return;
      }
      try {
        const result = await handler({
          interactionId: interaction.id,
          guildId: interaction.guildId,
          channelId: interaction.channelId,
          discordUserId: interaction.user.id,
          commandName: interaction.commandName,
          subcommand,
          options: Object.fromEntries(
            interaction.options.data
              .find((option) => option.name === subcommand)
              ?.options?.map((option) => [option.name, normalizeOptionValue(option.value)]) ?? [],
          ),
        });
        await interaction.editReply({ content: result.content });
      } catch {
        await interaction.editReply({
          content: 'Не вдалося виконати Discord-команду в Dragon House Hub. Спробуй ще раз або звернися до старших.',
        });
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.client.isReady()) {
      await this.client.destroy();
    }
    this.state = {
      status: this.disabled ? 'not_configured' : 'configured',
      lastConnectedAt: this.state.lastConnectedAt,
      lastError: null,
    };
  }

  async validateGuildAccess(): Promise<boolean> {
    if (this.disabled || !this.config.discord.guildId || !this.client.isReady()) return false;
    const guild = await this.client.guilds.fetch(this.config.discord.guildId).catch(() => null);
    return Boolean(guild);
  }

  async validateChannelAccess(channelId: string): Promise<DiscordChannelAccessResult> {
    const requiredPermissions = requiredChannelPermissions.map((permission) => permission.name);
    if (!isAllowedChannel(this.config, channelId)) {
      return {
        ok: false,
        channelId,
        code: 'DISCORD_CHANNEL_NOT_ALLOWED',
        message: 'This Discord channel is not configured for Dragon House publishing.',
        requiredPermissions,
        missingPermissions: requiredPermissions,
      };
    }
    if (!this.client.isReady()) {
      return {
        ok: false,
        channelId,
        code: 'DISCORD_CLIENT_NOT_CONNECTED',
        message: 'Discord client is not connected.',
        requiredPermissions,
        missingPermissions: requiredPermissions,
      };
    }
    const channel = await this.client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      return {
        ok: false,
        channelId,
        code: 'DISCORD_CHANNEL_UNAVAILABLE',
        message: 'Discord channel is unavailable.',
        requiredPermissions,
        missingPermissions: requiredPermissions,
      };
    }
    if (channel.type !== ChannelType.GuildText || !(channel instanceof TextChannel)) {
      return {
        ok: false,
        channelId,
        code: 'DISCORD_CHANNEL_NOT_TEXT',
        message: 'Discord channel is not a text channel.',
        requiredPermissions,
        missingPermissions: requiredPermissions,
      };
    }
    const botMember = channel.guild.members.me ?? (await channel.guild.members.fetchMe().catch(() => null));
    if (!botMember) {
      return {
        ok: false,
        channelId,
        code: 'DISCORD_BOT_MEMBER_UNAVAILABLE',
        message: 'Discord bot member could not be resolved for this guild.',
        requiredPermissions,
        missingPermissions: requiredPermissions,
      };
    }
    const permissions = channel.permissionsFor(botMember);
    const missingPermissions = requiredChannelPermissions
      .filter((permission) => !permissions?.has(permission.flag))
      .map((permission) => permission.name);
    if (missingPermissions.length) {
      return {
        ok: false,
        channelId,
        code: 'DISCORD_CHANNEL_PERMISSION_MISSING',
        message: `Discord bot lacks required channel permissions: ${missingPermissions.join(', ')}.`,
        requiredPermissions,
        missingPermissions,
      };
    }
    return { ok: true, channelId, requiredPermissions, missingPermissions: [] };
  }

  async fetchQuestMessages(limit = 200): Promise<ExternalFamilyQuest[]> {
    const maxMessages = Math.min(Math.max(limit, 1), 500);
    const embedQuests = this.config.discord.channels.questAnnouncements && isAllowedChannel(this.config, this.config.discord.channels.questAnnouncements)
      ? await this.fetchParsedQuestEmbeds(this.config.discord.channels.questAnnouncements, maxMessages)
      : [];
    const auditQuests = this.config.discord.channels.adminLog && isAllowedChannel(this.config, this.config.discord.channels.adminLog)
      ? await this.fetchParsedQuestAuditLog(this.config.discord.channels.adminLog, maxMessages)
      : [];
    const byKey = new Map<string, ExternalFamilyQuest>();
    for (const quest of [...auditQuests, ...embedQuests]) byKey.set(quest.sourceQuestId ?? quest.externalId, quest);
    return [...byKey.values()]
      .sort((left, right) => (right.completedAt ?? right.messageCreatedAt ?? '').localeCompare(left.completedAt ?? left.messageCreatedAt ?? ''));
  }

  async fetchTowerGuardMessages(limit = this.config.discord.towerSync.messageLimit): Promise<ExternalTowerGuardSignal[]> {
    const channelId = this.config.discord.channels.towerGuard;
    if (!channelId || !isAllowedChannel(this.config, channelId)) return [];
    const channel = await this.requireTextChannel(channelId);
    const messages = await fetchMessages(channel, Math.min(Math.max(limit, 1), 500));
    const byTower = new Map<number, ExternalTowerGuardSignal>();
    for (const message of messages.sort((left, right) => right.createdTimestamp - left.createdTimestamp)) {
      if (!isTrustedDiscordSource(this.config, message)) continue;
      const parsed = parseDiscordTowerGuardMessage({
        id: message.id,
        channelId,
        authorId: message.author.id,
        authorName: message.member?.displayName ?? message.author.globalName ?? message.author.username,
        createdAt: message.createdAt.toISOString(),
        editedAt: message.editedAt?.toISOString() ?? null,
        content: message.content,
        embeds: message.embeds.map((embed) => ({
          title: embed.title,
          description: embed.description,
          fields: embed.fields.map((field) => ({ name: field.name, value: field.value })),
        })),
      });
      if (parsed && !byTower.has(parsed.towerNumber)) byTower.set(parsed.towerNumber, parsed);
    }
    return [...byTower.values()].sort((left, right) => left.towerNumber - right.towerNumber);
  }

  private async fetchParsedQuestEmbeds(channelId: string, limit: number): Promise<ExternalFamilyQuest[]> {
    const channel = await this.requireTextChannel(channelId);
    const messages = await fetchMessages(channel, limit);
    return messages
      .sort((left, right) => right.createdTimestamp - left.createdTimestamp)
      .filter((message) => isTrustedDiscordSource(this.config, message))
      .map((message) => parseDiscordQuestMessage({
        id: message.id,
        channelId,
        authorId: message.author.id,
        authorName: message.member?.displayName ?? message.author.globalName ?? message.author.username,
        createdAt: message.createdAt.toISOString(),
        editedAt: message.editedAt?.toISOString() ?? null,
        content: message.content,
        embeds: message.embeds.map((embed) => ({
          title: embed.title,
          description: embed.description,
          fields: embed.fields.map((field) => ({ name: field.name, value: field.value })),
        })),
      }))
      .filter((quest): quest is ExternalFamilyQuest => Boolean(quest));
  }

  private async fetchParsedQuestAuditLog(channelId: string, limit: number): Promise<ExternalFamilyQuest[]> {
    const channel = await this.requireTextChannel(channelId);
    const messages = await fetchMessages(channel, limit);
    return aggregateDiscordQuestAuditMessages(messages.filter((message) => isTrustedDiscordSource(this.config, message)).map((message) => ({
      id: message.id,
      channelId,
      authorId: message.author.id,
      authorName: message.member?.displayName ?? message.author.globalName ?? message.author.username,
      createdAt: message.createdAt.toISOString(),
      editedAt: message.editedAt?.toISOString() ?? null,
      content: message.content,
    })));
  }

  async fetchAccountingMessages(limit = 20): Promise<ExternalAccountingMessage[]> {
    const channelId = this.config.discord.channels.accounting;
    if (!channelId || !isAllowedChannel(this.config, channelId)) return [];
    const channel = await this.requireTextChannel(channelId);
    const messages = await channel.messages.fetch({ limit: Math.min(Math.max(limit, 1), 50) });
    return [...messages.values()]
      .sort((left, right) => right.createdTimestamp - left.createdTimestamp)
      .map((message) => ({
        externalId: message.id,
        channelId,
        authorId: message.author.id,
        authorName: message.member?.displayName ?? message.author.globalName ?? message.author.username,
        authorAvatarUrl: message.author.displayAvatarURL(),
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        editedAt: message.editedAt?.toISOString() ?? null,
        attachmentCount: message.attachments.size,
        attachments: [...message.attachments.values()].map((attachment) => ({
          id: attachment.id,
          filename: attachment.name,
          contentType: attachment.contentType,
          url: attachment.url,
          proxyUrl: attachment.proxyURL,
          size: attachment.size,
          width: attachment.width,
          height: attachment.height,
        })),
      }));
  }

  async sendMessage(channelId: string, payload: DiscordMessagePayload): Promise<{ messageId: string }> {
    const channel = await this.requireTextChannel(channelId);
    const message = await channel.send(toDiscordPayload(payload));
    return { messageId: message.id };
  }

  async editMessage(channelId: string, messageId: string, payload: DiscordMessagePayload): Promise<{ messageId: string }> {
    const channel = await this.requireTextChannel(channelId);
    const message = await channel.messages.fetch(messageId);
    const updated = await message.edit(toDiscordPayload(payload));
    return { messageId: updated.id };
  }

  getAllowedChannelIds(): string[] {
    return [...getAllowedChannelIds(this.config)];
  }

  private async requireTextChannel(channelId: string): Promise<TextChannel> {
    if (this.disabled) throw new Error('Discord is not configured');
    if (!this.client.isReady()) throw new Error('Discord client is not connected');
    const access = await this.validateChannelAccess(channelId);
    if (!access.ok) throw new Error(access.code);
    const channel = await this.client.channels.fetch(channelId);
    if (!channel || channel.type !== ChannelType.GuildText || !(channel instanceof TextChannel)) {
      throw new Error('Discord text channel is unavailable');
    }
    return channel;
  }
}

export function isTrustedDiscordSource(
  config: Pick<AppConfig, 'discord'>,
  message: { author: { id: string }; applicationId: string | null; webhookId: string | null },
): boolean {
  const trustedBotUserId = config.discord.trustedBotUserId;
  const trustedApplicationId = config.discord.trustedApplicationId;
  const trustedWebhookId = config.discord.trustedWebhookId;
  if (!trustedBotUserId && !trustedApplicationId && !trustedWebhookId) return false;
  return Boolean(
    (trustedBotUserId && message.author.id === trustedBotUserId) ||
      (trustedApplicationId && message.applicationId === trustedApplicationId) ||
      (trustedWebhookId && message.webhookId === trustedWebhookId),
  );
}

function waitForClientReady(client: Client): Promise<void> {
  if (client.isReady()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Discord client ready timeout'));
    }, 15_000);
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      clearTimeout(timeout);
      client.off(Events.ClientReady, onReady);
      client.off('error', onError);
    };
    client.once(Events.ClientReady, onReady);
    client.once('error', onError);
  });
}

function isDragonSubcommand(value: string): value is DiscordCommandRequest['subcommand'] {
  return value === 'me' || value === 'status' || value === 'quest' || value === 'tower' || value === 'event';
}

function normalizeOptionValue(value: unknown): DiscordCommandOptionValue {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return null;
}

function toDiscordPayload(payload: DiscordMessagePayload) {
  return {
    content: payload.content,
    components: payload.components as never,
    embeds: payload.embeds as never,
    allowedMentions: payload.allowedMentions,
  };
}

async function fetchMessages(channel: TextChannel, limit: number): Promise<Message[]> {
  const messages: Message[] = [];
  let before: string | undefined;
  while (messages.length < limit) {
    const batch = await channel.messages.fetch({
      limit: Math.min(100, limit - messages.length),
      ...(before ? { before } : {}),
    });
    if (!batch.size) break;
    const items = [...batch.values()];
    messages.push(...items);
    before = items[items.length - 1]?.id;
    if (!before || batch.size < 100) break;
  }
  return messages;
}
