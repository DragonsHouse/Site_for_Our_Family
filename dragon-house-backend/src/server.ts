import { getMissingDiscordConfig, loadConfig, validateProductionConfig } from './config/env.js';
import { createApp } from './app.js';
import { maskSensitiveValue } from './config/env.js';
import { registerDatabaseShutdown, verifyDatabaseConnection } from './db/pool.js';
import { DiscordAutoSyncService } from './discord/auto-sync-service.js';
import { DiscordTowerGuardAutoSyncService } from './discord/tower-guard-auto-sync-service.js';
import { createLogger } from './logging/logger.js';

const config = loadConfig();
const logger = createLogger(config);
const productionConfigErrors = validateProductionConfig(config);
if (productionConfigErrors.length > 0) {
  throw new Error(`Invalid production configuration: missing ${productionConfigErrors.join(', ')}`);
}
const { app, discordService, discordSyncEngineService, pgPool } = createApp(config);
const missingDiscordConfig = getMissingDiscordConfig(config);

if (missingDiscordConfig.length > 0) {
  logger.warn('discord_integration_disabled', { missing: missingDiscordConfig, status: discordService.getStatus().status });
}

const discordAutoSync = new DiscordAutoSyncService(config, discordSyncEngineService, logger);
const discordTowerGuardAutoSync = new DiscordTowerGuardAutoSyncService(config, discordService, pgPool, logger);

if (pgPool) {
  try {
    await verifyDatabaseConnection(pgPool);
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

server.on('close', () => {
  discordAutoSync.stop();
  discordTowerGuardAutoSync.stop();
  if (pgPool) void pgPool.end();
});
