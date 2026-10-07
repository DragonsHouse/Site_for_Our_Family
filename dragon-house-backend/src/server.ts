import { getMissingDiscordConfig, loadConfig, validateProductionConfig } from './config/env.js';
import { createApp } from './app.js';
import { maskSensitiveValue } from './config/env.js';
import { registerDatabaseShutdown, verifyDatabaseConnection } from './db/pool.js';
import { assertConnectedE2eDatabase } from './e2e/e2e-db-guard.js';
import { DiscordAutoSyncService } from './discord/auto-sync-service.js';
import { DiscordTowerGuardAutoSyncService } from './discord/tower-guard-auto-sync-service.js';
import { createLogger } from './logging/logger.js';

const config = loadConfig();
const logger = createLogger(config);
const productionConfigErrors = validateProductionConfig(config);
if (productionConfigErrors.length > 0) {
  throw new Error(`Invalid production configuration: missing ${productionConfigErrors.join(', ')}`);
}
const { app, discordService, discordSyncEngineService, towerDefenseService, pgPool } = createApp(config);
const missingDiscordConfig = getMissingDiscordConfig(config);

if (missingDiscordConfig.length > 0) {
  logger.warn('discord_integration_disabled', { missing: missingDiscordConfig, status: discordService.getStatus().status });
}

const discordAutoSync = new DiscordAutoSyncService(config, discordSyncEngineService, logger);
const discordTowerGuardAutoSync = new DiscordTowerGuardAutoSyncService(config, discordService, towerDefenseService, logger);

if (pgPool) {
  try {
    await verifyDatabaseConnection(pgPool);
    if (config.e2eTestMode) await assertConnectedE2eDatabase(pgPool, config);
    registerDatabaseShutdown(pgPool);
    logger.info('postgres_connection_verified');
  } catch (error) {
    logger.error('postgres_connection_failed', {
      message: error instanceof Error ? error.message : 'unknown',
      databaseUrl: maskSensitiveValue(config.databaseUrl),
    });
  }
}

const server = app.listen(config.port, () => {
  logger.info('backend_listening', { port: config.port });
  if (config.discord.orchestration.enabled || config.discord.towerSync.enabled) {
    discordService.connect().catch(() => {
      logger.error('discord_orchestration_connect_failed', { reason: 'Discord gateway connection failed' });
    });
  }
  discordAutoSync.start();
  discordTowerGuardAutoSync.start();
});

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals | 'server_close'): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('backend_shutdown_started', { signal });
  discordAutoSync.stop();
  discordTowerGuardAutoSync.stop();
  await discordService.disconnect().catch((error) => {
    logger.warn('discord_shutdown_failed', { message: error instanceof Error ? error.message : 'unknown' });
  });
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
    setTimeout(resolve, 10_000).unref();
  });
  if (pgPool) {
    await pgPool.end().catch((error) => {
      logger.warn('postgres_shutdown_failed', { message: error instanceof Error ? error.message : 'unknown' });
    });
  }
  logger.info('backend_shutdown_complete', { signal });
}

process.once('SIGTERM', () => {
  void shutdown('SIGTERM').then(() => process.exit(0));
});

process.once('SIGINT', () => {
  void shutdown('SIGINT').then(() => process.exit(0));
});

server.on('close', () => {
  if (!shuttingDown) void shutdown('server_close');
});
