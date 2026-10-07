import type { AppConfig } from '../config/env.js';
import type { AppLogger } from '../logging/logger.js';
import type { TowerDefenseService } from '../tower-defense/tower-defense-service.js';
import type { DiscordService } from './discord-service.js';
import type { ExternalTowerGuardSignal } from './tower-message-parser.js';

export class DiscordTowerGuardAutoSyncService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly config: Pick<AppConfig, 'discord'>,
    private readonly discordService: DiscordService,
    private readonly towerDefenseService: TowerDefenseService | null,
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
    if (!this.shouldRun() || !this.towerDefenseService || this.running) return;
    this.running = true;
    try {
      const actorMemberId = this.config.discord.towerSync.actorMemberId;
      if (!actorMemberId) {
        this.logger.warn('discord_tower_guard_auto_sync_no_configured_system_actor');
        return;
      }

      const fetchedSignals = await this.discordService.fetchTowerGuardMessages(this.config.discord.towerSync.messageLimit);
      const signals = fetchedSignals
        .filter((signal) => isCurrentSignal(signal, now))
        .sort((left, right) => latestSignalTime(right) - latestSignalTime(left));
      const confidence = reconciliationConfidence({
        fetchedCount: fetchedSignals.length,
        currentCount: signals.length,
        requestedLimit: this.config.discord.towerSync.messageLimit,
      });

      if (!signals.length) {
        this.logger.warn('discord_tower_guard_auto_sync_degraded_empty_snapshot', {
          reason: 'no_current_trusted_tower_signals',
          messageLimit: this.config.discord.towerSync.messageLimit,
        });
        return;
      }

      const result = await this.towerDefenseService.reconcileExternalTowerGuardSignals(signals, {
        systemActorFamilyMemberId: actorMemberId,
        confidence,
        kdReminderIntervalSeconds: this.config.discord.towerSync.kdReminderIntervalSeconds,
      }, now);
      await this.deliverKdReminders(result.kdReminderCandidates, now);
      this.logger.info('discord_tower_guard_auto_sync_applied', {
        count: result.processedCount,
        closedStaleCount: result.closedStaleCount,
        kdReminderCandidates: result.kdReminderCandidates.length,
        state: result.state,
        warnings: result.warnings,
      });
    } catch (error) {
      this.logger.error('discord_tower_guard_auto_sync_failed', {
        message: error instanceof Error ? error.message : 'unknown',
      });
    } finally {
      this.running = false;
    }
  }

  private async deliverKdReminders(
    candidates: Array<{ towerId: string; towerName: string; towerCode: string; reason: string }>,
    now: Date,
  ): Promise<void> {
    if (!candidates.length || !this.towerDefenseService) return;
    const channelId = this.config.discord.channels.towerGuard;
    const roleId = this.config.discord.towerSync.capterRoleId;
    const limitedCandidates = candidates.slice(0, 3);
    for (const candidate of limitedCandidates) {
      const reason = candidate.reason === 'stale' ? 'stale_kd' : 'missing_kd';
      if (!channelId) {
        this.logger.warn('discord_tower_kd_reminder_skipped_no_channel', { towerId: candidate.towerId });
        await this.towerDefenseService.recordTowerKdReminderDelivery({
          towerId: candidate.towerId,
          result: 'skipped',
          reason,
          error: 'tower_guard_channel_missing',
        }, now);
        continue;
      }
      if (!roleId) {
        this.logger.warn('discord_tower_kd_reminder_skipped_no_capter_role', { towerId: candidate.towerId });
        await this.towerDefenseService.recordTowerKdReminderDelivery({
          towerId: candidate.towerId,
          result: 'skipped',
          reason,
          error: 'capter_role_missing',
        }, now);
        continue;
      }
      try {
        await this.discordService.sendMessage(channelId, {
          content: `<@&${roleId}> Каптьорики, зараз немає актуального КД на ${candidate.towerName}. Оновіть КД, будь ласка.`,
          allowedMentions: { roles: [roleId], parse: [] },
        });
        await this.towerDefenseService.recordTowerKdReminderDelivery({
          towerId: candidate.towerId,
          result: 'sent',
          reason,
        }, now);
      } catch (error) {
        await this.towerDefenseService.recordTowerKdReminderDelivery({
          towerId: candidate.towerId,
          result: 'failed',
          reason,
          error: error instanceof Error ? error.message : 'unknown',
        }, now);
        this.logger.warn('discord_tower_kd_reminder_failed', {
          towerId: candidate.towerId,
          message: error instanceof Error ? error.message : 'unknown',
        });
      }
    }
    if (candidates.length > limitedCandidates.length) {
      this.logger.warn('discord_tower_kd_reminder_limited', {
        requested: candidates.length,
        sentOrRecorded: limitedCandidates.length,
      });
    }
  }

  private shouldRun(): boolean {
    return Boolean(
      this.config.discord.towerSync.enabled &&
        this.config.discord.botToken &&
        this.config.discord.guildId &&
        this.config.discord.channels.towerGuard &&
        this.towerDefenseService,
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

function reconciliationConfidence(input: { fetchedCount: number; currentCount: number; requestedLimit: number }): 'complete' | 'degraded' {
  if (input.currentCount === 0) return 'degraded';
  if (input.fetchedCount >= input.requestedLimit) return 'degraded';
  return 'complete';
}
