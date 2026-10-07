import { loadConfig } from '../config/env.js';
import { createPgPool } from '../db/pool.js';
import { assertConnectedE2eDatabase } from './e2e-db-guard.js';
import { seedE2eDatabase } from './seed-e2e-data.js';

const config = loadConfig();
const pool = createPgPool(config);
if (!pool) throw new Error('DATABASE_URL is required for E2E seed.');

try {
  await assertConnectedE2eDatabase(pool, config);
  await seedE2eDatabase(pool, config);
  console.log('E2E seed completed.');
} finally {
  await pool.end();
}
