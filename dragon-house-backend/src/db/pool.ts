import pg from 'pg';
import { maskSensitiveValue, type AppConfig } from '../config/env.js';

export function createPgPool(config: AppConfig): pg.Pool | null {
  if (!config.databaseUrl) return null;
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    max: config.nodeEnv === 'production' ? 10 : 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 10_000,
  });
  pool.on('error', (error) => {
    console.error('PostgreSQL pool error', { message: error.message, databaseUrl: maskSensitiveValue(config.databaseUrl) });
  });
  return pool;
}

export async function verifyDatabaseConnection(pool: pg.Pool): Promise<boolean> {
  await pool.query('select 1');
  return true;
}

export function registerDatabaseShutdown(pool: pg.Pool) {
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    await pool.end();
  };
  process.once('SIGINT', () => void close().finally(() => process.exit(0)));
  process.once('SIGTERM', () => void close().finally(() => process.exit(0)));
}
