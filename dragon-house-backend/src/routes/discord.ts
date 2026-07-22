import { Router } from 'express';
import { requireFutureFamilyHubAuth } from '../middleware/auth-placeholder.js';
import type { DiscordService } from '../discord/discord-service.js';

export function createDiscordRouter(discordService: DiscordService): Router {
  const router = Router();

  router.get('/discord/config/public', (_request, response) => {
    response.json(discordService.getPublicConfig());
  });

  router.get('/discord/status', (_request, response) => {
    response.json(discordService.getStatus());
  });

  router.post('/discord/news/:postId/publish', requireFutureFamilyHubAuth(discordService));
  router.post('/discord/quests/:questId/publish', requireFutureFamilyHubAuth(discordService));

  return router;
}
