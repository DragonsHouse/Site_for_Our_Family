import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { applyPendingMigrations } from '../db/migrations.js';
import { getJson, startRouterWithActors, type TestActorName } from '../test/actor-sessions.js';
import { createFamilyAuditLogRouter } from './family-audit-log.js';

type Query = { sql: string; values: unknown[] };

const privateSnapshot = {
  nickname: 'Visible_Name',
  dateOfBirth: '1990-05-10',
  notes: 'private note',
  profileMetadata: { phone: 'secret' },
  discordUserId: '123456789012345678',
  passwordHash: '$2a$12$abc',
};

function fakePool(queries: Query[]) {
  return {
    query: async (sql: string, values: unknown[]) => {
      queries.push({ sql, values });
      return {
        rows: [{
          id: 'audit-1',
          actor_family_member_id: 'actor-owner',
          actor_type: 'user',
          actor_nickname: 'actor-owner',
          action: 'member_updated',
          entity_type: 'family_member',
          entity_id: 'member-1',
          before_data: privateSnapshot,
          after_data: { ...privateSnapshot, rank: 4 },
          metadata: { token: 'secret-token', reason: 'promotion' },
          created_at: new Date('2026-01-02T00:00:00.000Z'),
        }],
      };
    },
  } as unknown as pg.Pool;
}

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (closers.length) await closers.pop()?.();
});

async function harness(pool: pg.Pool) {
  const server = await startRouterWithActors((config, authService) => createFamilyAuditLogRouter(config, authService, pool));
  closers.push(server.close);
  return server;
}

describe('GET /family/audit-log authorization', () => {
  it('denies members and roles without an audit domain before querying the database', async () => {
    const queries: Query[] = [];
    const { baseUrl, tokens } = await harness(fakePool(queries));
    for (const actor of ['member', 'accountingManager'] as TestActorName[]) {
      const result = await getJson(`${baseUrl}/api/family/audit-log`, tokens[actor]);
      expect(result.status, actor).toBe(403);
      expect(result.body).not.toHaveProperty('items');
    }
    expect(queries).toEqual([]);
    const anonymous = await fetch(`${baseUrl}/api/family/audit-log`);
    expect(anonymous.status).toBe(401);
  });

  it('runs the owner query without a domain restriction', async () => {
    const queries: Query[] = [];
    const { baseUrl, tokens } = await harness(fakePool(queries));
    expect((await getJson(`${baseUrl}/api/family/audit-log`, tokens.owner)).status).toBe(200);
    expect(queries[0]?.sql).not.toMatch(/entity_type = any/u);
  });

  it('restricts deputies and single-domain managers in SQL, even when they filter for another domain', async () => {
    const queries: Query[] = [];
    const { baseUrl, tokens } = await harness(fakePool(queries));
    await getJson(`${baseUrl}/api/family/audit-log`, tokens.deputy);
    await getJson(`${baseUrl}/api/family/audit-log?entityType=family_member`, tokens.mapManager);
    expect(queries[0]?.sql).toMatch(/a\.entity_type = any\(\$1::text\[\]\)/u);
    expect(queries[0]?.values[0]).toEqual(['family_tower', 'family_treasury_entry']);
    expect(queries[1]?.sql).toMatch(/\(a\.entity_type = any\(\$1::text\[\]\)\) and a\.entity_type = \$2/u);
    expect(queries[1]?.values.slice(0, 2)).toEqual([['family_map_state'], 'family_member']);
  });

  it('redacts private member fields and secrets from returned rows unless the viewer may see private fields', async () => {
    const queries: Query[] = [];
    const { baseUrl, tokens } = await harness(fakePool(queries));
    const manager = await getJson(`${baseUrl}/api/family/audit-log`, tokens.memberManager);
    const text = JSON.stringify(manager.body);
    expect(manager.status).toBe(200);
    expect(text).toContain('Visible_Name');
    expect(text).toContain('promotion');
    expect(text).not.toMatch(/1990-05-10|private note|phone|123456789012345678|passwordHash|secret-token/u);

    for (const actor of ['owner', 'privateViewer'] as TestActorName[]) {
      const privileged = JSON.stringify((await getJson(`${baseUrl}/api/family/audit-log`, tokens[actor])).body);
      expect(privileged, actor).toContain('1990-05-10');
      expect(privileged, actor).not.toMatch(/passwordHash|secret-token/u);
    }
  });
});

const testDatabaseUrl = process.env.DRAGON_HOUSE_TEST_DATABASE_URL;
const describePg = testDatabaseUrl ? describe : describe.skip;

describePg('GET /family/audit-log against PostgreSQL', () => {
  let pool: pg.Pool;
  const runId = `audit-scope-${randomUUID()}`;
  const windowStart = new Date(Date.UTC(2100, 0, 1) + Math.floor(Math.random() * 1_000_000) * 60_000);
  const at = (minutes: number) => new Date(windowStart.getTime() + minutes * 60_000).toISOString();
  const windowQuery = `from=${encodeURIComponent(at(0))}&to=${encodeURIComponent(at(30))}&limit=50`;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: testDatabaseUrl });
    await applyPendingMigrations(pool);
    const rows: Array<[string, string, string, unknown]> = [
      ['member_updated', 'family_member', `${runId}-member`, { nickname: 'Visible_Name', date_of_birth: '1990-05-10', notes: 'legacy private note', discord: { discordUserId: '123456789012345678' } }],
      ['discord_sync_member_updated', 'family_member', `${runId}-sync`, { nickname: 'Synced_Name', dateOfBirth: '1991-06-11' }],
      ['family_map_updated', 'family_map_state', `${runId}-map`, { markers: 3 }],
      ['treasury_entry_created', 'family_treasury_entry', `${runId}-treasury`, { title: 'Shop' }],
      ['tower_kd_updated', 'family_tower', `${runId}-tower`, { cooldownStatus: 'ready' }],
      ['future_domain_event', 'future_private_domain', `${runId}-future`, { secretPlan: 'owner only' }],
    ];
    for (const [index, [action, entityType, entityId, afterData]] of rows.entries()) {
      await pool.query(
        `insert into family_audit_log (id, actor_family_member_id, actor_type, action, entity_type, entity_id, before_data, after_data, metadata, created_at)
         values ($1, null, 'system', $2, $3, $4, null, $5::jsonb, $6::jsonb, $7)`,
        [`${runId}-${index}`, action, entityType, entityId, JSON.stringify(afterData), JSON.stringify({ passwordHash: 'x', runId }), at(index + 1)],
      );
    }
  });

  afterAll(async () => {
    await pool.query('delete from family_audit_log where id like $1', [`${runId}-%`]);
    await pool.end();
  });

  async function entityTypesFor(actor: TestActorName): Promise<{ status: number; entityTypes: string[]; text: string }> {
    const server = await startRouterWithActors((config, authService) => createFamilyAuditLogRouter(config, authService, pool));
    closers.push(server.close);
    const result = await getJson(`${server.baseUrl}/api/family/audit-log?${windowQuery}`, server.tokens[actor]);
    const items = (result.body.items as Array<{ entityType: string; entityId: string }> | undefined) ?? [];
    return { status: result.status, entityTypes: items.filter((item) => item.entityId.startsWith(runId)).map((item) => item.entityType).sort(), text: JSON.stringify(result.body) };
  }

  it('returns every domain to the owner, with private fields but no secrets', async () => {
    const owner = await entityTypesFor('owner');
    expect(owner.status).toBe(200);
    expect(owner.entityTypes).toEqual(['family_map_state', 'family_member', 'family_member', 'family_tower', 'family_treasury_entry', 'future_private_domain']);
    expect(owner.text).toContain('legacy private note');
    expect(owner.text).not.toContain('passwordHash');
  });

  it('scopes deputy, managers and Discord managers to their domains on real rows', async () => {
    expect((await entityTypesFor('deputy')).entityTypes).toEqual(['family_tower', 'family_treasury_entry']);
    expect((await entityTypesFor('mapManager')).entityTypes).toEqual(['family_map_state']);
    expect((await entityTypesFor('questManager')).entityTypes).toEqual(['family_tower']);
    const discord = await entityTypesFor('discordManager');
    expect(discord.entityTypes).toEqual(['family_member']);
    expect(discord.text).toContain('Synced_Name');
    expect(discord.text).not.toContain('Visible_Name');
  });

  it('redacts private fields from legacy member rows for member managers', async () => {
    const manager = await entityTypesFor('memberManager');
    expect(manager.entityTypes).toEqual(['family_member', 'family_member']);
    expect(manager.text).toContain('Visible_Name');
    expect(manager.text).not.toMatch(/1990-05-10|1991-06-11|legacy private note|123456789012345678|passwordHash|owner only/u);
  });

  it('denies ordinary members and accountants without an audit domain', async () => {
    expect((await entityTypesFor('member')).status).toBe(403);
    expect((await entityTypesFor('accountingManager')).status).toBe(403);
  });
});
