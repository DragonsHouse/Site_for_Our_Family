import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyPendingMigrations } from '../db/migrations.js';
import {
  InMemoryDiscordRoleMappingRepository,
  PgDiscordRoleMappingRepository,
  type SaveDiscordRoleMappingInput,
} from './role-mapping-repository.js';

function createMapping(discordRoleId: string, priority = 10): SaveDiscordRoleMappingInput {
  return {
    discordRoleId,
    discordRoleName: `Role ${discordRoleId}`,
    familyRole: 'moderator',
    rank: 6,
    permissions: ['view_members', 'manage_family_quests'],
    priority,
    enabled: true,
  };
}

describe('InMemoryDiscordRoleMappingRepository', () => {
  it('lists enabled mappings by priority and can include disabled mappings', async () => {
    const repository = new InMemoryDiscordRoleMappingRepository();
    await repository.save(createMapping('role-low', 1));
    await repository.save(createMapping('role-high', 20));
    await repository.save({ ...createMapping('role-disabled', 30), enabled: false });

    expect((await repository.list()).map((mapping) => mapping.discordRoleId)).toEqual(['role-high', 'role-low']);
    expect((await repository.list(true)).map((mapping) => mapping.discordRoleId)).toEqual([
      'role-disabled',
      'role-high',
      'role-low',
    ]);
  });
});

const testDatabaseUrl = process.env.DRAGON_HOUSE_TEST_DATABASE_URL;
const describePg = testDatabaseUrl ? describe : describe.skip;

describePg('PgDiscordRoleMappingRepository', () => {
  let pool: pg.Pool;
  const runId = `discord-role-${randomUUID()}`;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: testDatabaseUrl });
    await applyPendingMigrations(pool);
  });

  afterAll(async () => {
    await pool.query('delete from discord_role_mappings where discord_role_id like $1', [`${runId}-%`]);
    await pool.end();
  });

  it('persists mappings across repository instances and supports updates', async () => {
    const firstRepository = new PgDiscordRoleMappingRepository(pool);
    const secondRepository = new PgDiscordRoleMappingRepository(pool);
    const discordRoleId = `${runId}-persistent`;

    await firstRepository.save(createMapping(discordRoleId));
    const updated = await secondRepository.save({
      ...createMapping(discordRoleId),
      discordRoleName: 'Updated role',
      familyRole: 'deputy',
      rank: 9,
      permissions: ['view_members', 'manage_members'],
      priority: 50,
      enabled: false,
    });

    expect(updated).toMatchObject({
      discordRoleId,
      discordRoleName: 'Updated role',
      familyRole: 'deputy',
      rank: 9,
      permissions: ['view_members', 'manage_members'],
      priority: 50,
      enabled: false,
    });
    expect(await secondRepository.getByDiscordRoleId(discordRoleId)).toMatchObject(updated);
  });

  it('filters disabled mappings unless requested and orders by priority', async () => {
    const repository = new PgDiscordRoleMappingRepository(pool);
    await repository.save(createMapping(`${runId}-low`, 1));
    await repository.save(createMapping(`${runId}-high`, 20));
    await repository.save({ ...createMapping(`${runId}-disabled`, 30), enabled: false });
    const expectedRoleIds = new Set([`${runId}-low`, `${runId}-high`, `${runId}-disabled`]);

    const enabled = (await repository.list()).filter((mapping) => expectedRoleIds.has(mapping.discordRoleId));
    const all = (await repository.list(true)).filter((mapping) => expectedRoleIds.has(mapping.discordRoleId));

    expect(enabled.map((mapping) => mapping.discordRoleId)).toEqual([`${runId}-high`, `${runId}-low`]);
    expect(all.map((mapping) => mapping.discordRoleId)).toEqual([
      `${runId}-disabled`,
      `${runId}-high`,
      `${runId}-low`,
    ]);
  });

  it('deletes mappings by Discord role ID', async () => {
    const repository = new PgDiscordRoleMappingRepository(pool);
    const discordRoleId = `${runId}-delete`;
    await repository.save(createMapping(discordRoleId));

    expect(await repository.deleteByDiscordRoleId(discordRoleId)).toBe(true);
    expect(await repository.deleteByDiscordRoleId(discordRoleId)).toBe(false);
    expect(await repository.getByDiscordRoleId(discordRoleId)).toBeNull();
  });

  it('propagates database errors', async () => {
    const repository = new PgDiscordRoleMappingRepository({
      query: async () => {
        throw new Error('database unavailable');
      },
    } as unknown as pg.Pool);

    await expect(repository.list()).rejects.toThrow('database unavailable');
  });
});
