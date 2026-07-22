import type { NextFunction, Request, Response } from 'express';
import type { DiscordService } from '../discord/discord-service.js';

export function requireFutureFamilyHubAuth(discordService: DiscordService) {
  return (_request: Request, response: Response, _next: NextFunction) => {
    if (!discordService.isConfigured) {
      response.status(503).json({
        error: 'not_configured',
        message: 'Discord backend is not configured yet',
      });
      return;
    }

    response.status(501).json({
      error: 'not_implemented',
      message: 'Family Hub session/token exchange is not implemented yet',
    });
  };
}
