import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyPendingMigrations } from '../db/migrations.js';
import type { DiscordOAuthState } from '../types.js';
import { PgDiscordOAuthStateRepository } from './oauth-state-repository.js';

function createState(familyMemberId: string, stateId: string, expiresAt = '2026-07-17T00:10:00.000Z'): DiscordOAuthState {
  return {
    stateId,
    familyMemberId,
    createdAt: '2026-07-17T00:00:00.000Z',
    expiresAt,
    consumedAt: null,
  };
}

const testDatabaseUrl = process.env.DRAGON_HOUSE_TEST_DATABASE_URL;
const describePg = testDatabaseUrl ? describe : describe.skip;

describePg('PgDiscordOAuthStateRepository', () => {
  let pool: pg.Pool;
  const runId = `discord-state-${randomUUID()}`;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: testDatabaseUrl });
    await applyPendingMigrations(pool);
    await pool.query(
      `insert into family_members (id, nickname, static_id, role, rank, permissions)
       values ($1, $2, $3, 'member', 1, '[]'::jsonb)`,
      [runId, runId, `${runId}-static`],
    );
  });

  afterAll(async () => {
    await pool.query('delete from discord_oauth_states where family_member_id = $1', [runId]);
    await pool.query('delete from family_members where id = $1', [runId]);
    await pool.end();
  });

  it('persists OAuth states across repository instances', async () => {
    const firstRepository = new PgDiscordOAuthStateRepository(pool);
    const secondRepository = new PgDiscordOAuthStateRepository(pool);
    const state = createState(runId, `${runId}-persistent`);

    await firstRepository.create(state);

    expect(await secondRepository.getByStateId(state.stateId)).toEqual(state);
  });

  it('rejects expired OAuth states at consumption time', async () => {
    const repository = new PgDiscordOAuthStateRepository(pool);
    const state = createState(runId, `${runId}-expired`, '2026-07-17T00:01:00.000Z');
    await repository.create(state);

    expect(await repository.consume(state.stateId, new Date('2026-07-17T00:01:00.000Z'))).toBeNull();
    expect(await repository.consume(state.stateId, new Date('2026-07-17T00:01:01.000Z'))).toBeNull();
  });

  it('consumes OAuth states only once', async () => {
    const repository = new PgDiscordOAuthStateRepository(pool);
    const state = createState(runId, `${runId}-one-time`);
    const consumedAt = new Date('2026-07-17T00:05:00.000Z');
    await repository.create(state);

    const firstConsume = await repository.consume(state.stateId, consumedAt);
    const secondConsume = await repository.consume(state.stateId, consumedAt);

    expect(firstConsume).toMatchObject({
      ...state,
      consumedAt: consumedAt.toISOString(),
    });
    expect(secondConsume).toBeNull();
  });

  it('propagates database errors', async () => {
    const repository = new PgDiscordOAuthStateRepository({
      query: async () => {
        throw new Error('database unavailable');
      },
    } as unknown as pg.Pool);

    await expect(repository.getByStateId('state-error')).rejects.toThrow('database unavailable');
  });
});
