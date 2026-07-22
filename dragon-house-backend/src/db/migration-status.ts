import { loadConfig } from '../config/env.js';
import { createPgPool } from './pool.js';
import { getMigrationStatus } from './migrations.js';

const config = loadConfig();
const pool = createPgPool(config);

if (!pool) throw new Error('DATABASE_URL is required for migration status');

try {
  const status = await getMigrationStatus(pool);
  console.log(
    JSON.stringify(
      {
        applied: status.applied.map((migration) => ({
          version: migration.version,
          name: migration.name,
          appliedAt: migration.appliedAt,
        })),
        pending: status.pending.map((migration) => ({ version: migration.version, name: migration.name })),
      },
      null,
      2,
    ),
  );
} finally {
  await pool.end();
}
