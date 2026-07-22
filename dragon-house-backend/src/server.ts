import { getMissingDiscordConfig, loadConfig } from './config/env.js';
import { createApp } from './app.js';
import { maskSensitiveValue } from './config/env.js';
import { registerDatabaseShutdown, verifyDatabaseConnection } from './db/pool.js';

const config = loadConfig();
const { app, discordService, pgPool } = createApp(config);
const missingDiscordConfig = getMissingDiscordConfig(config);

if (missingDiscordConfig.length > 0) {
  console.warn(
    `Discord integration disabled: missing ${missingDiscordConfig.join(', ')}. Status: ${discordService.getStatus().status}`,
  );
}

if (pgPool) {
  try {
    await verifyDatabaseConnection(pgPool);
    registerDatabaseShutdown(pgPool);
    console.log('PostgreSQL connection verified');
  } catch (error) {
    console.error('PostgreSQL connection failed', {
      message: error instanceof Error ? error.message : 'unknown',
      databaseUrl: maskSensitiveValue(config.databaseUrl),
    });
  }
}

const server = app.listen(config.port, () => {
  console.log(`Dragon House backend listening on port ${config.port}`);
});

server.on('close', () => {
  if (pgPool) void pgPool.end();
});
