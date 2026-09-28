import type pg from 'pg';
import type { AppConfig } from '../config/env.js';
import type { AppLogger } from '../logging/logger.js';
import type { DiscordService } from './discord-service.js';
import type { ExternalTowerGuardSignal } from './tower-message-parser.js';

export class DiscordTowerGuardAutoSyncService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly config: Pick<AppConfig, 'discord'>,
    private readonly discordService: DiscordService,
    private readonly pool: pg.Pool | null,
    private readonly logger: AppLogger,
  ) {}

  start(): void {
    if (!this.shouldRun() || this.timer) return;
    const intervalMs = this.config.discord.towerSync.intervalSeconds * 1000;
    this.timer = setInterval(() => {
      void this.runOnce();
    }, intervalMs);
    this.timer.unref();
    void this.runOnce();
    this.logger.info('discord_tower_guard_auto_sync_started', {
      channelConfigured: Boolean(this.config.discord.channels.towerGuard),
      intervalSeconds: this.config.discord.towerSync.intervalSeconds,
      messageLimit: this.config.discord.towerSync.messageLimit,
    });
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    this.logger.info('discord_tower_guard_auto_sync_stopped');
  }

  async runOnce(now = new Date()): Promise<void> {
    if (!this.shouldRun() || !this.pool || this.running) return;
    this.running = true;
    try {
      const actorMemberId = await this.resolveActorMemberId();
      if (!actorMemberId) {
        this.logger.warn('discord_tower_guard_auto_sync_no_actor');
        return;
      }
      const signals = (await this.discordService.fetchTowerGuardMessages(this.config.discord.towerSync.messageLimit))
        .filter((signal) => isCurrentSignal(signal, now))
        .sort((left, right) => latestSignalTime(right) - latestSignalTime(left))
        .slice(0, 3);
      for (const signal of signals) await this.upsertSignal(signal, actorMemberId, now);
      await this.closeStaleDiscordDefenses(signals, now);
      this.logger.info('discord_tower_guard_auto_sync_applied', { count: signals.length });
    } catch (error) {
      this.logger.error('discord_tower_guard_auto_sync_failed', {
        message: error instanceof Error ? error.message : 'unknown',
      });
    } finally {
      this.running = false;
    }
  }

  private shouldRun(): boolean {
    return Boolean(
      this.config.discord.towerSync.enabled &&
        this.config.discord.botToken &&
        this.config.discord.guildId &&
        this.config.discord.channels.towerGuard &&
        this.pool,
    );
  }

  private async resolveActorMemberId(): Promise<string | null> {
    const configured = this.config.discord.towerSync.actorMemberId;
    if (configured && await this.memberExists(configured)) return configured;
    const result = await this.pool!.query<{ id: string }>(
      `select id
       from family_members
       where status = 'active' and deleted_at is null
       order by case when role = 'owner' then 0 else 1 end, rank desc, created_at asc
       limit 1`,
    );
    return result.rows[0]?.id ?? null;
  }

  private async memberExists(memberId: string): Promise<boolean> {
    const result = await this.pool!.query<{ exists: boolean }>(
      `select exists(
         select 1 from family_members
         where id = $1 and status = 'active' and deleted_at is null
       ) as exists`,
      [memberId],
    );
    return result.rows[0]?.exists ?? false;
  }

  private async upsertSignal(signal: ExternalTowerGuardSignal, actorMemberId: string, now: Date): Promise<void> {
    const client = await this.pool!.connect();
    try {
      await client.query('begin');
      const towerId = await upsertTower(client, signal, now);
      await upsertCurrentDefense(client, signal, towerId, actorMemberId, now);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  private async closeStaleDiscordDefenses(signals: ExternalTowerGuardSignal[], now: Date): Promise<void> {
    const activeExternalIds = signals.map((signal) => `tower:${signal.towerNumber}`);
    await this.pool!.query(
      `update family_tower_defenses
       set status = 'cancelled',
           result = 'cancelled',
           phase = 'closed',
           ended_at = coalesce(ended_at, $1),
           metadata = metadata || $2::jsonb,
           updated_at = $1
       where external_source = 'discord_tower_guard'
         and status in ('scheduled', 'gathering', 'active')
         and not (external_id = any($3::text[]))`,
      [
        now.toISOString(),
        JSON.stringify({ closedByDiscordTowerSync: true, closedReason: 'not_present_in_latest_discord_tower_guard_messages' }),
        activeExternalIds,
      ],
    );
  }
}

const CURRENT_TOWER_SIGNAL_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function latestSignalTime(signal: ExternalTowerGuardSignal): number {
  return new Date(signal.messageEditedAt ?? signal.messageCreatedAt).getTime();
}

function isCurrentSignal(signal: ExternalTowerGuardSignal, now: Date): boolean {
  const signalTime = latestSignalTime(signal);
  if (!Number.isFinite(signalTime)) return false;
  return now.getTime() - signalTime <= CURRENT_TOWER_SIGNAL_MAX_AGE_MS;
}

async function upsertTower(client: pg.PoolClient, signal: ExternalTowerGuardSignal, now: Date): Promise<string> {
  const result = await client.query<{ id: string }>(
    `insert into family_towers
       (tower_code, name, location_label, map_metadata, is_active, external_source, external_id, metadata, updated_at)
     values
       ($1, $2, $2, '{}'::jsonb, true, 'discord_tower_guard', $3, $4::jsonb, $5)
     on conflict (tower_code)
     do update set
       name = excluded.name,
       location_label = excluded.location_label,
       is_active = true,
       external_source = excluded.external_source,
       external_id = excluded.external_id,
       metadata = family_towers.metadata || excluded.metadata,
       updated_at = excluded.updated_at
     returning id`,
    [
      signal.towerCode,
      signal.towerName,
      String(signal.towerNumber),
      JSON.stringify({
        source: 'discord_tower_guard',
        towerNumber: signal.towerNumber,
        visual: { icon: 'Tower', markerColor: signal.protectionDown ? 'crimson' : 'amber' },
      }),
      now.toISOString(),
    ],
  );
  return result.rows[0]!.id;
}

async function upsertCurrentDefense(
  client: pg.PoolClient,
  signal: ExternalTowerGuardSignal,
  towerId: string,
  actorMemberId: string,
  now: Date,
): Promise<void> {
  const status = signal.protectionDown ? 'active' : 'gathering';
  const priority = signal.protectionDown ? 'critical' : 'high';
  const phase = signal.protectionDown ? 'combat' : 'signal';
  const externalId = `tower:${signal.towerNumber}`;
  const metadata = {
    source: 'discord_tower_guard',
    sourceMessageId: signal.externalId,
    sourceChannelId: signal.channelId,
    towerNumber: signal.towerNumber,
    protectionDown: signal.protectionDown,
    cooldownNeedsUpdate: signal.cooldownNeedsUpdate,
    cooldownAt: signal.cooldownAt,
    statusText: signal.statusText,
    lastDiscordMessageAt: signal.messageEditedAt ?? signal.messageCreatedAt,
  };
  await client.query(
    `insert into family_tower_defenses
       (tower_id, title, description, status, priority, starts_at, timezone, phase, wave,
        commander_family_member_id, created_by_family_member_id, minimum_guard_count, recommended_guard_count,
        maximum_guard_count, guild_id, channel_id, message_id, synced_at, external_source, external_id,
        sync_idempotency_key, event_projection_key, metadata, created_at, updated_at)
     values
       ($1, $2, $3, $4, $5, $6, 'Europe/Kiev', $7, 1, $8, $8, 1, 1, 3, $9, $10, $11, $12,
        'discord_tower_guard', $13, $14, $15, $16::jsonb, $12, $12)
     on conflict (external_source, external_id)
     where external_source is not null and external_id is not null
     do update set
       tower_id = excluded.tower_id,
       title = excluded.title,
       description = excluded.description,
       status = excluded.status,
       priority = excluded.priority,
       starts_at = least(family_tower_defenses.starts_at, excluded.starts_at),
       phase = excluded.phase,
       commander_family_member_id = excluded.commander_family_member_id,
       guild_id = excluded.guild_id,
       channel_id = excluded.channel_id,
       message_id = excluded.message_id,
       synced_at = excluded.synced_at,
       metadata = family_tower_defenses.metadata || excluded.metadata,
       updated_at = excluded.updated_at`,
    [
      towerId,
      `Tower defense: ${signal.towerName}`,
      signal.statusText,
      status,
      priority,
      signal.messageCreatedAt,
      phase,
      actorMemberId,
      null,
      signal.channelId,
      signal.externalId,
      now.toISOString(),
      externalId,
      `discord-tower-guard:${externalId}`,
      `tower-defense:discord:${externalId}`,
      JSON.stringify(metadata),
    ],
  );
}
