import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { applyPendingMigrations, checksumSql, readMigrationFiles } from './migrations.js';

class FakeClient {
  applied = new Map<string, string>();

  sqlStatements: string[] = [];

  rolledBack = false;

  failOnSql: string | null = null;

  async query(sql: string, params: unknown[] = []) {
    const normalized = sql.trim().toLowerCase();
    this.sqlStatements.push(normalized);
    if (this.failOnSql && sql.includes(this.failOnSql)) throw new Error('planned failure');
    if (normalized.startsWith('select checksum from schema_migrations')) {
      const checksum = this.applied.get(String(params[0]));
      return { rows: checksum ? [{ checksum }] : [] };
    }
    if (normalized.startsWith('insert into schema_migrations')) {
      this.applied.set(String(params[0]), String(params[2]));
      return { rows: [] };
    }
    if (normalized === 'rollback') this.rolledBack = true;
    return { rows: [] };
  }

  release() {
    // test fake
  }
}

class FakePool {
  constructor(readonly client: FakeClient) {}

  async connect() {
    return this.client;
  }
}

let originalCwd = process.cwd();

afterEach(() => {
  process.chdir(originalCwd);
});

async function makeMigrationDir(sql = 'create table example(id text primary key);') {
  originalCwd = process.cwd();
  const dir = await mkdtemp(join(tmpdir(), 'dragon-house-migrations-'));
  const migrationsDir = join(dir, 'migrations');
  await import('node:fs/promises').then((fs) => fs.mkdir(migrationsDir));
  await writeFile(join(migrationsDir, '001_test.sql'), sql);
  process.chdir(dir);
  return migrationsDir;
}

describe('migration runner', () => {
  it('applies pending migrations', async () => {
    await makeMigrationDir();
    const client = new FakeClient();

    const applied = await applyPendingMigrations(new FakePool(client) as never);

    expect(applied).toHaveLength(1);
    expect(client.applied.has('001')).toBe(true);
  });

  it('does not reapply already applied migrations', async () => {
    const migrationsDir = await makeMigrationDir();
    const migration = (await readMigrationFiles(migrationsDir))[0];
    const client = new FakeClient();
    client.applied.set('001', migration.checksum);

    const applied = await applyPendingMigrations(new FakePool(client) as never);

    expect(applied).toHaveLength(0);
  });

  it('rolls back failed migrations', async () => {
    await makeMigrationDir('create table example(id text primary key);');
    const client = new FakeClient();
    client.failOnSql = 'create table example';

    await expect(applyPendingMigrations(new FakePool(client) as never)).rejects.toThrow('planned failure');
    expect(client.rolledBack).toBe(true);
    expect(client.applied.size).toBe(0);
  });

  it('blocks changed checksum for applied migration', async () => {
    await makeMigrationDir('create table changed(id text primary key);');
    const client = new FakeClient();
    client.applied.set('001', checksumSql('old sql'));

    await expect(applyPendingMigrations(new FakePool(client) as never)).rejects.toThrow('Migration checksum mismatch');
  });
});
