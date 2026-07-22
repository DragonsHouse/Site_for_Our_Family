import { Router } from 'express';
import type { AppConfig } from '../config/env.js';
import type { FamilyAuthService } from '../auth/auth-service.js';
import { DiscordGuildMemberReaderError } from '../discord/guild-member-reader.js';
import type { DiscordMemberSyncDryRunService } from '../discord/member-sync-dry-run-service.js';
import { requireFamilyAuthContext } from '../middleware/family-auth-context.js';

export function createDiscordSyncRouter(
  config: AppConfig,
  authService: FamilyAuthService | null,
  dryRunService: DiscordMemberSyncDryRunService | null,
): Router {
  const router = Router();
  const requireAuth = requireFamilyAuthContext(config, authService);

  router.post('/discord/sync/members/dry-run', requireAuth, async (request, response) => {
    if (!request.familyAuth) return response.status(401).json({ error: 'session_required' });
    if (request.familyAuth.role !== 'owner') {
      return response.status(403).json({ error: 'owner_required' });
    }
    if (!dryRunService) {
      return response.status(503).json({ error: 'discord_sync_unavailable' });
    }

    try {
      response.json(await dryRunService.run());
    } catch (error) {
      respondWithDiscordSyncError(response, error);
    }
  });

  return router;
}

function respondWithDiscordSyncError(response: import('express').Response, error: unknown): void {
  if (error instanceof DiscordGuildMemberReaderError) {
    const status = error.code === 'discord_api_error' ? 502 : 503;
    response.status(status).json({ error: error.code, message: error.message });
    return;
  }
  response.status(500).json({ error: 'discord_sync_failed' });
}
