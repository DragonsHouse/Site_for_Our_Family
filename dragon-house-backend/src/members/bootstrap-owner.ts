import { randomUUID } from 'node:crypto';
import { loadConfig } from '../config/env.js';
import { createPgPool } from '../db/pool.js';
import { hashPassword } from '../auth/password.js';
import type { FamilyPermission } from '../types.js';

const OWNER_PERMISSIONS: FamilyPermission[] = [
  'manage_users',
  'view_members',
  'manage_members',
  'manage_member_roles',
  'manage_member_auth',
  'delete_members',
  'restore_members',
  'view_member_private_fields',
  'manage_tasks',
  'manage_ranks',
  'view_private_notes',
  'manage_family_map',
  'manage_events',
  'manage_buyers',
  'manage_family_posts',
  'manage_family_news',
  'manage_news',
  'view_family_history',
  'manage_family_economy',
  'manage_family_quests',
  'manage_family_assets',
  'manage_discord_integration',
  'manage_accounting',
  'manage_treasury',
  'manage_recruitment',
  'manage_resources',
  'manage_roles',
];

function arg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : null;
  return value?.trim() || null;
}

const config = loadConfig();
if (config.nodeEnv !== 'development') {
  throw new Error('family:bootstrap-owner is development-only.');
}

const nickname = arg('nickname');
const login = arg('login');
const staticId = arg('static-id');
const password = arg('password');
if (!nickname || !login || !staticId || !password) {
  throw new Error('Usage: npm run family:bootstrap-owner -- --nickname "Name" --login "login" --static-id "123" --password "temporary-password1"');
}

const pool = createPgPool(config);
if (!pool) throw new Error('DATABASE_URL is required.');

const client = await pool.connect();
try {
  await client.query('begin');
  const owners = await client.query<{ count: string }>(
    `select count(*)::text as count from family_members
     where role = 'owner' and status = 'active' and deleted_at is null`,
  );
  if (Number(owners.rows[0]?.count ?? 0) > 0) {
    throw new Error('Active owner already exists.');
  }
  const familyMemberId = randomUUID();
  const passwordHash = await hashPassword(password, config.bcryptCost);
  await client.query(
    `insert into family_members
      (id, nickname, static_id, role, rank, permissions, status, joined_at, permissions_override)
     values ($1, $2, $3, 'owner', 10, $4, 'active', now(), $4)`,
    [familyMemberId, nickname, staticId, JSON.stringify(OWNER_PERMISSIONS)],
  );
  await client.query(
    `insert into family_auth_users
      (family_member_id, login, static_id, password_hash, is_active, must_change_password, role, rank, permissions)
     values ($1, $2, $3, $4, true, true, 'owner', 10, $5)`,
    [familyMemberId, login, staticId, passwordHash, JSON.stringify(OWNER_PERMISSIONS)],
  );
  await client.query('commit');
  console.log(JSON.stringify({ created: true, familyMemberId, login, staticId }, null, 2));
} catch (error) {
  await client.query('rollback');
  throw error;
} finally {
  client.release();
  await pool.end();
}
