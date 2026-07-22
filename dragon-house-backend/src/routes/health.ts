import { Router } from 'express';
import type pg from 'pg';
import type { DiscordService } from '../discord/discord-service.js';
import type { HealthResponse } from '../types.js';

export function createHealthRouter(discordService: DiscordService, pgPool: pg.Pool | null = null): Router {
  const router = Router();

  router.get('/health', async (_request, response) => {
    let databaseConnected = false;
    if (pgPool) {
      try {
        await pgPool.query('select 1');
        databaseConnected = true;
      } catch {
        databaseConnected = false;
      }
    }
    const body: HealthResponse = {
      status: 'ok',
      serverTime: new Date().toISOString(),
      databaseConfigured: Boolean(pgPool),
      databaseConnected,
      discordConfigured: discordService.isConfigured,
      discordConnected: discordService.isConnected,
      version: process.env.npm_package_version ?? '0.1.0',
    };
    response.json(body);
  });

  router.get('/health/database', async (_request, response) => {
    if (!pgPool) {
      response.status(503).json({ status: 'error', database: 'unavailable' });
      return;
    }
    try {
      await pgPool.query('select 1');
      response.json({ status: 'ok', database: 'connected' });
    } catch {
      response.status(503).json({ status: 'error', database: 'unavailable' });
    }
  });

  return router;
}
