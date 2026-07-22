import { loadConfig, maskSensitiveValue } from '../config/env.js';
import { createPgPool } from './pool.js';
import { applyPendingMigrations } from './migrations.js';

const config = loadConfig();
const pool = createPgPool(config);

if (!pool) {
  throw new Error('DATABASE_URL is required for migrations');
}

try {
  const applied = await applyPendingMigrations(pool);
  if (applied.length === 0) {
    console.log('No pending migrations.');
  } else {
    for (const migration of applied) console.log(`Applied migration ${migration.name}`);
  }
} catch (error) {
  console.error('Migration failed', {
    message: error instanceof Error ? error.message : 'unknown',
    databaseUrl: maskSensitiveValue(config.databaseUrl),
  });
  process.exitCode = 1;
} finally {
  await pool.end();
}
