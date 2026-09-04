import type { FamilyAuthContext, FamilyMember } from '../types.js';

export type DiscordOrchestrationSourceModule = 'family_quests' | 'tower_defense' | 'family_events';

export type DiscordMessageIdentity = {
  sourceModule: DiscordOrchestrationSourceModule;
  sourceId: string;
  messageKind: string;
  guildId: string;
  channelId: string;
};

export type DiscordMessageRecord = DiscordMessageIdentity & {
  id: string;
  messageId: string | null;
  threadId: string | null;
  payloadHash: string | null;
  syncedAt: string | null;
  externalSource: string;
  externalId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type SaveDiscordMessageInput = DiscordMessageIdentity & {
  messageId?: string | null;
  threadId?: string | null;
  payloadHash?: string | null;
  syncedAt?: string | null;
  externalId: string;
  metadata?: Record<string, unknown>;
};

export type DiscordActionStatus = 'received' | 'succeeded' | 'failed' | 'ignored';

export type DiscordActionRecord = {
  id: string;
  interactionId: string | null;
  idempotencyKey: string;
  guildId: string;
  channelId: string | null;
  messageId: string | null;
  discordUserId: string;
  familyMemberId: string | null;
  action: string;
  sourceModule: DiscordOrchestrationSourceModule | 'member_sync' | null;
  sourceId: string | null;
  status: DiscordActionStatus;
  errorCode: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type SaveDiscordActionInput = {
  interactionId?: string | null;
  idempotencyKey: string;
  guildId: string;
  channelId?: string | null;
  messageId?: string | null;
  discordUserId: string;
  familyMemberId?: string | null;
  action: string;
  sourceModule?: DiscordActionRecord['sourceModule'];
  sourceId?: string | null;
  status: DiscordActionStatus;
  errorCode?: string | null;
  metadata?: Record<string, unknown>;
};

export type DiscordResolvedIdentity = {
  discordUserId: string;
  familyMember: FamilyMember;
  auth: FamilyAuthContext;
};

export type DiscordInteractionRequest = {
  interactionId: string;
  idempotencyKey?: string | null;
  guildId: string;
  channelId?: string | null;
  messageId?: string | null;
  discordUserId: string;
  customId: string;
  values?: string[];
};

export type DiscordCommandOptionValue = string | number | boolean | null;

export type DiscordCommandRequest = {
  interactionId: string;
  idempotencyKey?: string | null;
  guildId: string;
  channelId?: string | null;
  discordUserId: string;
  commandName: string;
  subcommand: 'me' | 'status' | 'quest' | 'tower' | 'event';
  options: Record<string, DiscordCommandOptionValue>;
};

export type DiscordInteractionResponse = {
  ok: boolean;
  ephemeral: boolean;
  content: string;
  action: string;
  sourceModule?: DiscordOrchestrationSourceModule;
  sourceId?: string;
  code?: string;
};

export type DiscordMessagePayload = {
  content: string;
  components?: Array<Record<string, unknown>>;
  embeds?: Array<Record<string, unknown>>;
};

export interface DiscordMessageTransport {
  sendMessage(channelId: string, payload: DiscordMessagePayload): Promise<{ messageId: string }>;
  editMessage(channelId: string, messageId: string, payload: DiscordMessagePayload): Promise<{ messageId: string }>;
}
