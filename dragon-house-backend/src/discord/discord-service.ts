import { Client, GatewayIntentBits } from 'discord.js';
import {
  configuredChannelNames,
  configuredChannelPurposes,
  isDiscordConfigComplete,
  type AppConfig,
} from '../config/env.js';
import type {
  DiscordConnectionStatus,
  DiscordStatusResponse,
  ExternalFamilyNews,
  ExternalFamilyQuest,
  ExternalSyncResult,
  PublicDiscordConfig,
} from '../types.js';
import { getAllowedChannelIds, isAllowedChannel } from './channel-allowlist.js';

type DiscordServiceState = {
  status: DiscordConnectionStatus;
  lastConnectedAt: string | null;
  lastError: string | null;
};

export class DiscordService {
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
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers],
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

  async validateChannelAccess(channelId: string): Promise<boolean> {
    if (!isAllowedChannel(this.config, channelId) || !this.client.isReady()) return false;
    const channel = await this.client.channels.fetch(channelId).catch(() => null);
    return Boolean(channel);
  }

  async resolveMember(_familyUserId: string): Promise<null> {
    return null;
  }

  async fetchNewsMessages(): Promise<ExternalFamilyNews[]> {
    if (!this.config.discord.channels.quantNews || !isAllowedChannel(this.config, this.config.discord.channels.quantNews)) {
      return [];
    }
    return [];
  }

  async fetchQuestMessages(): Promise<ExternalFamilyQuest[]> {
    if (
      !this.config.discord.channels.questAnnouncements ||
      !isAllowedChannel(this.config, this.config.discord.channels.questAnnouncements)
    ) {
      return [];
    }
    return [];
  }

  async publishNews(_postId: string, channelId = this.config.discord.channels.quantNews): Promise<ExternalSyncResult> {
    if (!channelId || !isAllowedChannel(this.config, channelId)) {
      return { ok: false, externalId: null, error: 'Channel is not allowed' };
    }
    return { ok: false, externalId: null, error: 'Publishing is not implemented' };
  }

  async publishQuestUpdate(
    _questId: string,
    channelId = this.config.discord.channels.questAnnouncements,
  ): Promise<ExternalSyncResult> {
    if (!channelId || !isAllowedChannel(this.config, channelId)) {
      return { ok: false, externalId: null, error: 'Channel is not allowed' };
    }
    return { ok: false, externalId: null, error: 'Publishing is not implemented' };
  }

  getAllowedChannelIds(): string[] {
    return [...getAllowedChannelIds(this.config)];
  }
}
