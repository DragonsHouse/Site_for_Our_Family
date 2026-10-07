import { loadConfig } from '../config/env.js';
import { createPgPool } from '../db/pool.js';
import { assertConnectedE2eDatabase } from './e2e-db-guard.js';

const config = loadConfig();
const pool = createPgPool(config);
if (!pool) throw new Error('DATABASE_URL is required for E2E reset.');

try {
  await assertConnectedE2eDatabase(pool, config);
  await pool.query('drop schema public cascade');
  await pool.query('create schema public');
  console.log(`Reset E2E database schema: ${config.e2eDatabaseName}`);
} finally {
  await pool.end();
}
