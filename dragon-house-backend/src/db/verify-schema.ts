import { loadConfig } from '../config/env.js';
import { createPgPool } from './pool.js';

type Check = { name: string; ok: boolean; details?: string };

const requiredTables = [
  'schema_migrations',
  'family_members',
  'family_auth_users',
  'family_sessions',
  'discord_account_links',
  'discord_oauth_states',
  'family_audit_log',
];

async function tableExists(pool: NonNullable<ReturnType<typeof createPgPool>>, tableName: string) {
  const result = await pool.query<{ exists: boolean }>(
    `select exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = $1
    )`,
    [tableName],
  );
  return result.rows[0]?.exists ?? false;
}

async function constraintExists(pool: NonNullable<ReturnType<typeof createPgPool>>, tableName: string, type: 'p' | 'u' | 'f' | 'c', columnName?: string) {
  const result = await pool.query<{ exists: boolean }>(
    `select exists (
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      left join unnest(c.conkey) key(attnum) on true
      left join pg_attribute a on a.attrelid = t.oid and a.attnum = key.attnum
      where t.relname = $1 and c.contype = $2 and ($3::text is null or a.attname = $3)
    )`,
    [tableName, type, columnName ?? null],
  );
  return result.rows[0]?.exists ?? false;
}

async function foreignKeyTargets(
  pool: NonNullable<ReturnType<typeof createPgPool>>,
  tableName: string,
  columnName: string,
  targetTable: string,
  targetColumn: string,
) {
  const result = await pool.query<{ exists: boolean }>(
    `select exists (
      select 1
      from pg_constraint c
      join pg_class source_table on source_table.oid = c.conrelid
      join pg_class target_table on target_table.oid = c.confrelid
      join unnest(c.conkey) with ordinality source_key(attnum, ord) on true
      join unnest(c.confkey) with ordinality target_key(attnum, ord) on source_key.ord = target_key.ord
      join pg_attribute source_attr on source_attr.attrelid = source_table.oid and source_attr.attnum = source_key.attnum
      join pg_attribute target_attr on target_attr.attrelid = target_table.oid and target_attr.attnum = target_key.attnum
      where c.contype = 'f'
        and source_table.relname = $1
        and source_attr.attname = $2
        and target_table.relname = $3
        and target_attr.attname = $4
    )`,
    [tableName, columnName, targetTable, targetColumn],
  );
  return result.rows[0]?.exists ?? false;
}

async function columnExists(pool: NonNullable<ReturnType<typeof createPgPool>>, tableName: string, columnName: string) {
  const result = await pool.query<{ exists: boolean }>(
    `select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = $1 and column_name = $2
    )`,
    [tableName, columnName],
  );
  return result.rows[0]?.exists ?? false;
}

async function indexExists(pool: NonNullable<ReturnType<typeof createPgPool>>, indexName: string) {
  const result = await pool.query<{ exists: boolean }>('select exists (select 1 from pg_indexes where indexname = $1)', [
    indexName,
  ]);
  return result.rows[0]?.exists ?? false;
}

async function runChecks() {
  const config = loadConfig();
  const pool = createPgPool(config);
  if (!pool) throw new Error('DATABASE_URL is required for schema verification');
  const checks: Check[] = [];
  try {
    for (const tableName of requiredTables) {
      checks.push({ name: `table:${tableName}`, ok: await tableExists(pool, tableName) });
    }
    checks.push({ name: 'family_members.id primary key', ok: await constraintExists(pool, 'family_members', 'p', 'id') });
    checks.push({ name: 'family_members.nickname is not primary key', ok: !(await constraintExists(pool, 'family_members', 'p', 'nickname')) });
    checks.push({ name: 'family_members.static_id unique', ok: await constraintExists(pool, 'family_members', 'u', 'static_id') });
    for (const column of ['status', 'avatar_asset_id', 'notes', 'joined_at', 'deleted_at', 'version', 'permissions_override', 'onboarding_metadata', 'profile_metadata']) {
      checks.push({ name: `family_members.${column} column`, ok: await columnExists(pool, 'family_members', column) });
    }
    checks.push({ name: 'family_members lower(static_id) unique index', ok: await indexExists(pool, 'idx_family_members_static_id_lower_unique') });
    checks.push({ name: 'family_members lower(nickname) unique index', ok: await indexExists(pool, 'idx_family_members_nickname_lower_unique') });
    checks.push({ name: 'family_members.status index', ok: await indexExists(pool, 'idx_family_members_status') });
    checks.push({ name: 'family_members.version positive check', ok: await constraintExists(pool, 'family_members', 'c', 'version') });
    checks.push({ name: 'family_auth_users.login unique', ok: await constraintExists(pool, 'family_auth_users', 'u', 'login') });
    checks.push({ name: 'family_auth_users.static_id unique', ok: await constraintExists(pool, 'family_auth_users', 'u', 'static_id') });
    checks.push({
      name: 'family_auth_users.family_member_id -> family_members.id',
      ok: await foreignKeyTargets(pool, 'family_auth_users', 'family_member_id', 'family_members', 'id'),
    });
    checks.push({
      name: 'family_sessions.family_member_id -> family_members.id',
      ok: await foreignKeyTargets(pool, 'family_sessions', 'family_member_id', 'family_members', 'id'),
    });
    checks.push({
      name: 'discord_account_links.family_member_id -> family_members.id',
      ok: await foreignKeyTargets(pool, 'discord_account_links', 'family_member_id', 'family_members', 'id'),
    });
    checks.push({ name: 'discord_account_links.discord_user_id unique', ok: await constraintExists(pool, 'discord_account_links', 'u', 'discord_user_id') });
    checks.push({ name: 'family_sessions.token_hash unique', ok: await constraintExists(pool, 'family_sessions', 'u', 'token_hash') });
    checks.push({
      name: 'family_audit_log.actor_family_member_id -> family_members.id',
      ok: await foreignKeyTargets(pool, 'family_audit_log', 'actor_family_member_id', 'family_members', 'id'),
    });
  } finally {
    await pool.end();
  }
  const failed = checks.filter((check) => !check.ok);
  console.log(JSON.stringify({ ok: failed.length === 0, checks }, null, 2));
  if (failed.length) process.exitCode = 1;
}

await runChecks();
