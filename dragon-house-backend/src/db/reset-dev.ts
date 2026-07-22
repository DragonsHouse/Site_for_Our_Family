import { loadConfig } from '../config/env.js';
import { createPgPool } from './pool.js';

const config = loadConfig();

if (config.nodeEnv !== 'development') {
  throw new Error('db:reset:dev is blocked outside NODE_ENV=development');
}

if (process.env.CONFIRM_DATABASE_RESET !== 'dragon_house') {
  throw new Error('Set CONFIRM_DATABASE_RESET=dragon_house to run the dev-only reset command');
}

const pool = createPgPool(config);
if (!pool) throw new Error('DATABASE_URL is required for db:reset:dev');

try {
  await pool.query('drop schema public cascade');
  await pool.query('create schema public');
  console.log('Development database schema reset completed.');
} finally {
  await pool.end();
}
