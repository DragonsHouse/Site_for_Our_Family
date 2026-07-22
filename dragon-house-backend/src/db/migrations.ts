import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type pg from 'pg';

export type MigrationFile = {
  version: string;
  name: string;
  path: string;
  checksum: string;
  sql: string;
};

export type AppliedMigration = {
  version: string;
  name: string;
  checksum: string;
  appliedAt: string;
};

export type MigrationStatus = {
  pending: MigrationFile[];
  applied: AppliedMigration[];
};

export function checksumSql(sql: string) {
  return createHash('sha256').update(sql).digest('hex');
}

export async function readMigrationFiles(migrationsDir = join(process.cwd(), 'migrations')): Promise<MigrationFile[]> {
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
  const migrations: MigrationFile[] = [];
  for (const file of files) {
    const sql = await readFile(join(migrationsDir, file), 'utf8');
    const [version] = file.split('_');
    migrations.push({
      version,
      name: basename(file),
      path: join(migrationsDir, file),
      checksum: checksumSql(sql),
      sql,
    });
  }
  return migrations;
}

export async function ensureMigrationTable(client: pg.Pool | pg.PoolClient) {
  await client.query(`
    create table if not exists schema_migrations (
      version text primary key,
      name text not null,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `);
}

export async function getAppliedMigrations(client: pg.Pool | pg.PoolClient): Promise<AppliedMigration[]> {
  await ensureMigrationTable(client);
  const result = await client.query<{
    version: string;
    name: string;
    checksum: string;
    applied_at: Date;
  }>('select version, name, checksum, applied_at from schema_migrations order by version');
  return result.rows.map((row) => ({
    version: row.version,
    name: row.name,
    checksum: row.checksum,
    appliedAt: row.applied_at.toISOString(),
  }));
}

export async function getMigrationStatus(pool: pg.Pool): Promise<MigrationStatus> {
  const migrations = await readMigrationFiles();
  const applied = await getAppliedMigrations(pool);
  const appliedByVersion = new Map(applied.map((migration) => [migration.version, migration]));
  for (const migration of migrations) {
    const existing = appliedByVersion.get(migration.version);
    if (existing && existing.checksum !== migration.checksum) {
      throw new Error(`Migration checksum mismatch for ${migration.name}`);
    }
  }
  return {
    applied,
    pending: migrations.filter((migration) => !appliedByVersion.has(migration.version)),
  };
}

export async function applyPendingMigrations(pool: pg.Pool) {
  const migrations = await readMigrationFiles();
  const applied: AppliedMigration[] = [];
  for (const migration of migrations) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await ensureMigrationTable(client);
      const existing = await client.query<{ checksum: string }>('select checksum from schema_migrations where version = $1', [
        migration.version,
      ]);
      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== migration.checksum) {
          throw new Error(`Migration checksum mismatch for ${migration.name}`);
        }
        await client.query('commit');
        continue;
      }
      await client.query(migration.sql);
      await client.query('insert into schema_migrations (version, name, checksum) values ($1, $2, $3) on conflict (version) do nothing', [
        migration.version,
        migration.name,
        migration.checksum,
      ]);
      await client.query('commit');
      applied.push({
        version: migration.version,
        name: migration.name,
        checksum: migration.checksum,
        appliedAt: new Date().toISOString(),
      });
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }
  return applied;
}
