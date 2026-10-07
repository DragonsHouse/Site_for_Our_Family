import type pg from 'pg';
import type { AppConfig } from '../config/env.js';

export function assertE2eDatabaseConfig(config: AppConfig): void {
  if (config.nodeEnv !== 'test' || !config.e2eTestMode) {
    throw new Error('E2E database commands require NODE_ENV=test and E2E_TEST_MODE=true.');
  }
  if (!config.databaseUrl) throw new Error('DATABASE_URL is required for E2E database commands.');
  const databaseName = databaseNameFromUrl(config.databaseUrl);
  if (databaseName !== config.e2eDatabaseName || !databaseName.includes('e2e')) {
    throw new Error(
      `Refusing to use non-E2E database "${databaseName}". Expected "${config.e2eDatabaseName}" and a name containing "e2e".`,
    );
  }
}

export async function assertConnectedE2eDatabase(pool: pg.Pool, config: AppConfig): Promise<void> {
  assertE2eDatabaseConfig(config);
  const result = await pool.query<{ current_database: string }>('select current_database()');
  const databaseName = result.rows[0]?.current_database ?? '';
  if (databaseName !== config.e2eDatabaseName || !databaseName.includes('e2e')) {
    throw new Error(`Connected to "${databaseName}", not the configured E2E database "${config.e2eDatabaseName}".`);
  }
}

function databaseNameFromUrl(databaseUrl: string): string {
  try {
    return new URL(databaseUrl).pathname.replace(/^\/+/u, '');
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
  }
}
