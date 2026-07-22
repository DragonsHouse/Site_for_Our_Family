import { Router } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../config/env.js';
import type { FamilyAuthService } from '../auth/auth-service.js';
import { DiscordGuildMemberReaderError } from '../discord/guild-member-reader.js';
import { DiscordMemberSyncApplyConflictError, type DiscordMemberSyncApplyService } from '../discord/member-sync-apply-service.js';
import type { DiscordMemberSyncDryRunService } from '../discord/member-sync-dry-run-service.js';
import { requireFamilyAuthContext } from '../middleware/family-auth-context.js';
import { createAuthenticatedRateLimit } from '../middleware/rate-limit.js';
import { createLogger, planHashPrefix } from '../logging/logger.js';

const ApplySyncSchema = z.object({
  confirm: z.literal(true),
  planId: z.string().regex(/^[a-f0-9]{32}$/u),
  planGeneratedAt: z.string().datetime(),
  planExpiresAt: z.string().datetime(),
  planHash: z.string().regex(/^[a-f0-9]{64}$/u),
  idempotencyKey: z.string().trim().min(12).max(120),
}).strict();

export function createDiscordSyncRouter(
  config: AppConfig,
  authService: FamilyAuthService | null,
  dryRunService: DiscordMemberSyncDryRunService | null,
  applyService: DiscordMemberSyncApplyService | null = null,
): Router {
  const router = Router();
  const requireAuth = requireFamilyAuthContext(config, authService);
  const logger = createLogger(config);
  const dryRunLimit = createAuthenticatedRateLimit({
    name: 'discord_sync_dry_run',
    limit: config.discord.sync.dryRunRateLimitPerMinute,
    windowMs: 60_000,
    logger,
  });
  const applyLimit = createAuthenticatedRateLimit({
    name: 'discord_sync_apply',
    limit: config.discord.sync.applyRateLimitPerHour,
    windowMs: 60 * 60_000,
    logger,
  });
  const reportLimit = createAuthenticatedRateLimit({
    name: 'discord_sync_report',
    limit: config.discord.sync.reportRateLimitPerMinute,
    windowMs: 60_000,
    logger,
  });

  const runDryRun = async (request: import('express').Request, response: import('express').Response) => {
    if (!request.familyAuth) return response.status(401).json({ error: 'session_required' });
    if (request.familyAuth.role !== 'owner') {
      return response.status(403).json({ error: 'owner_required' });
    }
    if (!dryRunService) {
      return response.status(503).json({ error: 'discord_sync_unavailable' });
    }

    try {
      const startedAt = Date.now();
      logger.info('discord_sync_dry_run_started', { familyMemberId: request.familyAuth.familyMemberId });
      const result = await dryRunService.run();
      logger.info('discord_sync_plan_generated', {
        guildId: result.guildId,
        planId: result.planId,
        planHashPrefix: planHashPrefix(result.planHash),
        durationMs: Date.now() - startedAt,
        summary: result.summary,
      });
      response.json(result);
    } catch (error) {
      respondWithDiscordSyncError(response, error);
    }
  };

  router.post('/discord/sync/members/dry-run', requireAuth, dryRunLimit, runDryRun);
  router.post('/discord/dry-run', requireAuth, dryRunLimit, runDryRun);

  router.post('/discord/apply-sync', requireAuth, applyLimit, async (request, response) => {
    if (!request.familyAuth) return response.status(401).json({ error: 'session_required' });
    if (request.familyAuth.role !== 'owner') {
      return response.status(403).json({ error: 'owner_required' });
    }
    if (!applyService) {
      return response.status(503).json({ error: 'discord_apply_sync_unavailable' });
    }
    const parsed = ApplySyncSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({
        error: 'discord_apply_sync_confirmation_required',
        message: 'Apply sync requires confirm=true, the latest dry-run planHash, and an idempotencyKey.',
      });
    }

    try {
      logger.info('discord_sync_apply_confirmation_received', {
        familyMemberId: request.familyAuth.familyMemberId,
        planId: parsed.data.planId,
        planHashPrefix: planHashPrefix(parsed.data.planHash),
      });
      response.json(await applyService.apply(parsed.data));
    } catch (error) {
      respondWithDiscordSyncError(response, error);
    }
  });

  router.get('/discord/sync-report', requireAuth, reportLimit, async (request, response) => {
    if (!request.familyAuth) return response.status(401).json({ error: 'session_required' });
    if (request.familyAuth.role !== 'owner') {
      return response.status(403).json({ error: 'owner_required' });
    }
    if (!applyService) {
      return response.status(503).json({ error: 'discord_apply_sync_unavailable' });
    }
    response.json(await applyService.getLatestReport());
  });

  return router;
}

function respondWithDiscordSyncError(response: import('express').Response, error: unknown): void {
  if (error instanceof DiscordGuildMemberReaderError) {
    const status = error.code === 'discord_api_error' ? 502 : 503;
    response.status(status).json({ error: error.code, message: error.message });
    return;
  }
  if (error instanceof DiscordMemberSyncApplyConflictError) {
    response.status(409).json({ error: error.code, message: error.message });
    return;
  }
  response.status(500).json({ error: 'discord_sync_failed' });
}
