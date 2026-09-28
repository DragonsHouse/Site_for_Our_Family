import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../config/env.js';
import type { AppLogger } from '../logging/logger.js';
import type { DiscordSyncEngineService } from './sync-engine-service.js';

export class DiscordAutoSyncService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly config: Pick<AppConfig, 'discord'>,
    private readonly syncEngine: DiscordSyncEngineService | null,
    private readonly logger: AppLogger,
  ) {}

  start(): void {
    if (!this.shouldRun() || this.timer) return;
    const intervalMs = this.config.discord.sync.autoIntervalSeconds * 1000;
    this.timer = setInterval(() => {
      void this.runOnce();
    }, intervalMs);
    this.timer.unref();
    void this.runOnce();
    this.logger.info('discord_auto_sync_started', {
      intervalSeconds: this.config.discord.sync.autoIntervalSeconds,
    });
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    this.logger.info('discord_auto_sync_stopped');
  }

  async runOnce(now = new Date()): Promise<void> {
    if (!this.shouldRun() || !this.syncEngine || this.running) return;
    this.running = true;
    try {
      const plan = await this.syncEngine.generateDryRunPlan(null, now);
      const hasChanges = plan.summary.create > 0 || plan.summary.update > 0 || plan.summary.deactivate > 0;
      if (!hasChanges) {
        this.logger.info('discord_auto_sync_no_changes', { planId: plan.planId });
        return;
      }
      if (plan.summary.blocked > 0) {
        this.logger.warn('discord_auto_sync_blocked', {
          planId: plan.planId,
          blocked: plan.summary.blocked,
          conflicts: plan.conflicts.map((conflict) => conflict.message).slice(0, 5),
        });
        return;
      }
      const result = await this.syncEngine.applyPlan(plan.planId, `auto-sync:${plan.planId}:${randomUUID()}`, null, now);
      this.logger.info('discord_auto_sync_applied', {
        planId: plan.planId,
        syncRunId: result.syncRunId,
        created: result.summary.created,
        updated: result.summary.updated,
        deactivated: result.summary.inactive,
      });
    } catch (error) {
      this.logger.error('discord_auto_sync_failed', {
        message: error instanceof Error ? error.message : 'unknown',
        code: error instanceof Error && 'code' in error ? (error as Error & { code?: string }).code : undefined,
      });
    } finally {
      this.running = false;
    }
  }

  private shouldRun(): boolean {
    return Boolean(
      this.config.discord.sync.autoEnabled &&
        this.config.discord.guildId &&
        this.config.discord.botToken &&
        this.syncEngine,
    );
  }
}
