import type pg from 'pg';
import type {
  DiscordActionRecord,
  DiscordMessageIdentity,
  DiscordMessageRecord,
  SaveDiscordActionInput,
  SaveDiscordMessageInput,
} from './orchestration-models.js';

export interface DiscordOrchestrationRepository {
  findMessage(identity: DiscordMessageIdentity): Promise<DiscordMessageRecord | null>;
  saveMessage(input: SaveDiscordMessageInput): Promise<DiscordMessageRecord>;
  findActionByIdempotencyKey(idempotencyKey: string): Promise<DiscordActionRecord | null>;
  saveAction(input: SaveDiscordActionInput): Promise<DiscordActionRecord>;
}

export class InMemoryDiscordOrchestrationRepository implements DiscordOrchestrationRepository {
  private readonly messages = new Map<string, DiscordMessageRecord>();
  private readonly actions = new Map<string, DiscordActionRecord>();

  async findMessage(identity: DiscordMessageIdentity): Promise<DiscordMessageRecord | null> {
    return this.messages.get(messageKey(identity)) ?? null;
  }

  async saveMessage(input: SaveDiscordMessageInput): Promise<DiscordMessageRecord> {
    const now = new Date().toISOString();
    const key = messageKey(input);
    const current = this.messages.get(key);
    const record: DiscordMessageRecord = {
      id: current?.id ?? `discord-message-${this.messages.size + 1}`,
      sourceModule: input.sourceModule,
      sourceId: input.sourceId,
      messageKind: input.messageKind,
      guildId: input.guildId,
      channelId: input.channelId,
      messageId: input.messageId ?? current?.messageId ?? null,
      threadId: input.threadId ?? current?.threadId ?? null,
      payloadHash: input.payloadHash ?? current?.payloadHash ?? null,
      syncedAt: input.syncedAt ?? now,
      externalSource: 'discord',
      externalId: input.externalId,
      metadata: { ...(current?.metadata ?? {}), ...(input.metadata ?? {}) },
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    };
    this.messages.set(key, record);
    return record;
  }

  async findActionByIdempotencyKey(idempotencyKey: string): Promise<DiscordActionRecord | null> {
    return this.actions.get(idempotencyKey) ?? null;
  }

  async saveAction(input: SaveDiscordActionInput): Promise<DiscordActionRecord> {
    const now = new Date().toISOString();
    const current = this.actions.get(input.idempotencyKey);
    const record: DiscordActionRecord = {
      id: current?.id ?? `discord-action-${this.actions.size + 1}`,
      interactionId: input.interactionId ?? current?.interactionId ?? null,
      idempotencyKey: input.idempotencyKey,
      guildId: input.guildId,
      channelId: input.channelId ?? current?.channelId ?? null,
      messageId: input.messageId ?? current?.messageId ?? null,
      discordUserId: input.discordUserId,
      familyMemberId: input.familyMemberId ?? current?.familyMemberId ?? null,
      action: input.action,
      sourceModule: input.sourceModule ?? current?.sourceModule ?? null,
      sourceId: input.sourceId ?? current?.sourceId ?? null,
      status: input.status,
      errorCode: input.errorCode ?? null,
      metadata: { ...(current?.metadata ?? {}), ...(input.metadata ?? {}) },
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    };
    this.actions.set(input.idempotencyKey, record);
    return record;
  }
}

export class PgDiscordOrchestrationRepository implements DiscordOrchestrationRepository {
  constructor(private readonly pool: pg.Pool) {}

  async findMessage(identity: DiscordMessageIdentity): Promise<DiscordMessageRecord | null> {
    const result = await this.pool.query<DiscordMessageRow>(
      `select * from discord_orchestration_messages
       where source_module = $1 and source_id = $2 and message_kind = $3 and guild_id = $4 and channel_id = $5
       limit 1`,
      [identity.sourceModule, identity.sourceId, identity.messageKind, identity.guildId, identity.channelId],
    );
    return result.rows[0] ? mapMessage(result.rows[0]) : null;
  }

  async saveMessage(input: SaveDiscordMessageInput): Promise<DiscordMessageRecord> {
    const result = await this.pool.query<DiscordMessageRow>(
      `insert into discord_orchestration_messages
        (source_module, source_id, message_kind, guild_id, channel_id, message_id, thread_id, payload_hash, synced_at, external_id, metadata)
       values ($1, $2, $3, $4, $5, $6, $7, $8, coalesce($9::timestamptz, now()), $10, $11::jsonb)
       on conflict (source_module, source_id, message_kind, guild_id, channel_id)
       do update set
         message_id = coalesce(excluded.message_id, discord_orchestration_messages.message_id),
         thread_id = coalesce(excluded.thread_id, discord_orchestration_messages.thread_id),
         payload_hash = excluded.payload_hash,
         synced_at = excluded.synced_at,
         external_id = excluded.external_id,
         metadata = discord_orchestration_messages.metadata || excluded.metadata,
         updated_at = now()
       returning *`,
      [
        input.sourceModule,
        input.sourceId,
        input.messageKind,
        input.guildId,
        input.channelId,
        input.messageId ?? null,
        input.threadId ?? null,
        input.payloadHash ?? null,
        input.syncedAt ?? null,
        input.externalId,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return mapMessage(result.rows[0]);
  }

  async findActionByIdempotencyKey(idempotencyKey: string): Promise<DiscordActionRecord | null> {
    const result = await this.pool.query<DiscordActionRow>(
      'select * from discord_orchestration_actions where idempotency_key = $1 limit 1',
      [idempotencyKey],
    );
    return result.rows[0] ? mapAction(result.rows[0]) : null;
  }

  async saveAction(input: SaveDiscordActionInput): Promise<DiscordActionRecord> {
    const result = await this.pool.query<DiscordActionRow>(
      `insert into discord_orchestration_actions
        (interaction_id, idempotency_key, guild_id, channel_id, message_id, discord_user_id, family_member_id, action, source_module, source_id, status, error_code, metadata)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
       on conflict (idempotency_key)
       do update set
         family_member_id = coalesce(excluded.family_member_id, discord_orchestration_actions.family_member_id),
         status = excluded.status,
         error_code = excluded.error_code,
         metadata = discord_orchestration_actions.metadata || excluded.metadata,
         updated_at = now()
       returning *`,
      [
        input.interactionId ?? null,
        input.idempotencyKey,
        input.guildId,
        input.channelId ?? null,
        input.messageId ?? null,
        input.discordUserId,
        input.familyMemberId ?? null,
        input.action,
        input.sourceModule ?? null,
        input.sourceId ?? null,
        input.status,
        input.errorCode ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return mapAction(result.rows[0]);
  }
}

type DiscordMessageRow = {
  id: string;
  source_module: DiscordMessageRecord['sourceModule'];
  source_id: string;
  message_kind: string;
  guild_id: string;
  channel_id: string;
  message_id: string | null;
  thread_id: string | null;
  payload_hash: string | null;
  synced_at: Date | null;
  external_source: string;
  external_id: string;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

type DiscordActionRow = {
  id: string;
  interaction_id: string | null;
  idempotency_key: string;
  guild_id: string;
  channel_id: string | null;
  message_id: string | null;
  discord_user_id: string;
  family_member_id: string | null;
  action: string;
  source_module: DiscordActionRecord['sourceModule'];
  source_id: string | null;
  status: DiscordActionRecord['status'];
  error_code: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

function messageKey(identity: DiscordMessageIdentity): string {
  return `${identity.sourceModule}:${identity.sourceId}:${identity.messageKind}:${identity.guildId}:${identity.channelId}`;
}

function mapMessage(row: DiscordMessageRow): DiscordMessageRecord {
  return {
    id: row.id,
    sourceModule: row.source_module,
    sourceId: row.source_id,
    messageKind: row.message_kind,
    guildId: row.guild_id,
    channelId: row.channel_id,
    messageId: row.message_id,
    threadId: row.thread_id,
    payloadHash: row.payload_hash,
    syncedAt: row.synced_at?.toISOString() ?? null,
    externalSource: row.external_source,
    externalId: row.external_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapAction(row: DiscordActionRow): DiscordActionRecord {
  return {
    id: row.id,
    interactionId: row.interaction_id,
    idempotencyKey: row.idempotency_key,
    guildId: row.guild_id,
    channelId: row.channel_id,
    messageId: row.message_id,
    discordUserId: row.discord_user_id,
    familyMemberId: row.family_member_id,
    action: row.action,
    sourceModule: row.source_module,
    sourceId: row.source_id,
    status: row.status,
    errorCode: row.error_code,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
