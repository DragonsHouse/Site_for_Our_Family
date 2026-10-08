import type pg from 'pg';
import type { AppConfig } from '../config/env.js';
import { hashPassword } from '../auth/password.js';
import { assertConnectedE2eDatabase } from './e2e-db-guard.js';

const now = '2026-01-15T10:00:00.000Z';
const ownerId = 'e2e-owner';
const deputyId = 'e2e-deputy';
const memberId = 'e2e-member';
const password = 'dragon-e2e';

export async function seedE2eDatabase(pool: pg.Pool, config: AppConfig): Promise<void> {
  await assertConnectedE2eDatabase(pool, config);
  const passwordHash = await hashPassword(password, Math.min(config.bcryptCost, 10));
  const tower = await pool.query<{ id: string }>('select id from family_towers order by tower_code asc limit 1');
  const towerId = tower.rows[0]?.id ?? '00000000-0000-4000-8000-000000000301';

  await pool.query('begin');
  try {
    const cleanupStatements = [
      `delete from family_audit_log where metadata->>'seed' = 'e2e'`,
      `delete from family_event_attendance where event_id in (select id from family_events where metadata->>'seed' = 'e2e')`,
      `delete from family_event_responses where event_id in (select id from family_events where metadata->>'seed' = 'e2e')`,
      `delete from family_events where metadata->>'seed' = 'e2e'`,
      `delete from family_tower_defense_attendance where defense_id in (select id from family_tower_defenses where metadata->>'seed' = 'e2e')`,
      `delete from family_tower_defense_responses where defense_id in (select id from family_tower_defenses where metadata->>'seed' = 'e2e')`,
      `delete from family_tower_defenses where metadata->>'seed' = 'e2e'`,
      `delete from family_fire_guard_roster where metadata->>'seed' = 'e2e'`,
      `delete from family_tower_cooldown_states where metadata->>'seed' = 'e2e'`,
      `delete from family_quest_people where quest_id in (select id from family_quests where metadata->>'seed' = 'e2e')`,
      `delete from family_quest_rewards where quest_id in (select id from family_quests where metadata->>'seed' = 'e2e')`,
      `delete from family_quest_reports where quest_id in (select id from family_quests where metadata->>'seed' = 'e2e')`,
      `delete from family_quest_payouts where quest_id in (select id from family_quests where metadata->>'seed' = 'e2e')`,
      `delete from family_quest_audit where quest_id in (select id from family_quests where metadata->>'seed' = 'e2e')`,
      `delete from family_quests where metadata->>'seed' = 'e2e'`,
      `delete from family_quest_templates where metadata->>'seed' = 'e2e'`,
      `delete from family_treasury_entries where metadata->>'seed' = 'e2e'`,
      `delete from discord_account_links where family_member_id in ($1, $2, $3)`,
      `delete from family_sessions where family_member_id in ($1, $2, $3)`,
      `delete from family_auth_users where family_member_id in ($1, $2, $3)`,
      `delete from family_members where id in ($1, $2, $3)`,
    ];
    for (const statement of cleanupStatements) {
      await pool.query(statement, statement.includes('$1') ? [ownerId, deputyId, memberId] : []);
    }

    await pool.query(
      `insert into family_members
        (id, nickname, static_id, role, rank, permissions, status, joined_at, date_of_birth, notes, permissions_override, profile_metadata, created_at, updated_at)
       values
        ($1, 'E2E_Owner', '900001', 'owner', 10, $4::jsonb, 'active', $7, '1990-01-01', 'E2E owner actor', $4::jsonb, '{"seed":"e2e"}'::jsonb, $7, $7),
        ($2, 'E2E_Deputy', '900002', 'deputy', 8, $5::jsonb, 'active', $7, '1991-02-02', 'E2E deputy actor', $5::jsonb, '{"seed":"e2e"}'::jsonb, $7, $7),
        ($3, 'E2E_Member', '900003', 'member', 2, $6::jsonb, 'active', $7, '1992-03-03', 'E2E normal member actor', $6::jsonb, '{"seed":"e2e"}'::jsonb, $7, $7)`,
      [
        ownerId,
        deputyId,
        memberId,
        JSON.stringify([
          'manage_users',
          'view_members',
          'manage_members',
          'manage_family_quests',
          'manage_events',
          'manage_treasury',
          'manage_family_economy',
          'manage_accounting',
          'manage_rewards',
          'manage_discord_integration',
        ]),
        JSON.stringify(['view_members', 'manage_family_quests', 'manage_events', 'manage_treasury', 'manage_family_economy']),
        JSON.stringify(['view_members']),
        now,
      ],
    );

    await pool.query(
      `insert into family_auth_users
        (family_member_id, login, static_id, password_hash, is_active, must_change_password, role, rank, permissions, created_at, updated_at)
       select id, nickname, static_id, $4, true, false, role, rank, permissions, $5, $5
       from family_members
       where id in ($1, $2, $3)`,
      [ownerId, deputyId, memberId, passwordHash, now],
    );

    await pool.query(
      `insert into discord_account_links
        (family_member_id, discord_user_id, discord_username, discord_global_name, discord_server_nickname,
         discord_avatar, discord_avatar_url, guild_id, joined_at, left_at, last_synced_at, verified,
         guild_member_verified, linked_at, updated_at)
       values
        ($1, '900000000001', 'e2e_owner', 'E2E Owner', 'E2E_Owner', null, null, 'e2e-guild', $4, null, $4, true, true, $4, $4),
        ($2, '900000000002', 'e2e_deputy', 'E2E Deputy', 'E2E_Deputy', null, null, 'e2e-guild', $4, null, $4, true, true, $4, $4),
        ($3, '900000000003', 'e2e_member', 'E2E Member', 'E2E_Member', null, null, 'e2e-guild', $4, null, $4, true, true, $4, $4)`,
      [ownerId, deputyId, memberId, now],
    );

    await pool.query(
      `insert into family_quest_templates
        (id, template_key, title, category, description, steps, recommended_team_size, total_reward, member_reward_pool,
         family_reward, reward_mode, required_items, is_active, cooldown_hours, created_by_family_member_id,
         updated_by_family_member_id, metadata, created_at, updated_at)
       values
        ('10000000-0000-4000-8000-000000000001', 'e2e-template-seed', 'E2E Seed Template', 'e2e',
         'Deterministic template for real backend E2E.', '["prepare","finish"]'::jsonb, 3, 300000, 250000,
         50000, 'equal', 'E2E kit', true, 24, $1, $1, '{"seed":"e2e"}'::jsonb, $2, $2)`,
      [ownerId, now],
    );

    await pool.query(
      `insert into family_quests
        (id, template_id, title, description, category, status, starts_at, scheduled_at, organizer_family_member_id,
         total_reward, member_reward_pool, family_reward, reward_mode, required_items, metadata, created_at, updated_at)
       values
        ('10000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000001',
         'E2E Seed Quest', 'Seed quest for reload checks.', 'e2e', 'recruiting', $2, $2, $1,
         300000, 250000, 50000, 'equal', 'E2E kit', '{"seed":"e2e"}'::jsonb, $2, $2)`,
      [ownerId, '2026-02-01T18:00:00.000Z'],
    );

    await pool.query(
      `insert into family_treasury_entries
        (id, category, title, location_number, description, price, price_amount, price_note, note, created_by_family_member_id,
         updated_by_family_member_id, metadata, created_at, updated_at)
       values
        ('e2e-treasury-entry', 'shops', 'E2E Treasury Shop', 'E2E-1', 'Deterministic treasury entity.', '12345',
         12345, 'seed price note', 'seed note', $1, $1, '{"seed":"e2e"}'::jsonb, $2, $2)`,
      [ownerId, now],
    );

    await pool.query(
      `insert into family_events
        (id, title, description, event_type, category, status, priority, starts_at, ends_at, timezone, location_label,
         created_by_family_member_id, organizer_family_member_id, max_participants, visibility, notes, metadata, created_at, updated_at)
       values
        ('10000000-0000-4000-8000-000000000201', 'E2E Seed Event', 'Seed event for conflict checks.', 'family_activity',
         'family', 'scheduled', 'normal', $2, $3, 'Europe/Kyiv', 'E2E Hall', $1, $1, 20, 'members',
         'seed notes', '{"seed":"e2e"}'::jsonb, $4, $4)`,
      [ownerId, '2026-02-02T18:00:00.000Z', '2026-02-02T19:00:00.000Z', now],
    );

    await pool.query(
      `insert into family_fire_guard_roster
        (family_member_id, role, status, note, assigned_by_family_member_id, metadata, created_at, updated_at)
       values
        ($1, 'commander', 'active', 'E2E commander', $1, '{"seed":"e2e"}'::jsonb, $3, $3),
        ($2, 'support', 'active', 'E2E support', $1, '{"seed":"e2e"}'::jsonb, $3, $3),
        ($4, 'reserve', 'active', 'E2E reserve', $1, '{"seed":"e2e"}'::jsonb, $3, $3)`,
      [ownerId, deputyId, now, memberId],
    );

    await pool.query(
      `insert into family_tower_defenses
        (id, tower_id, title, description, status, priority, starts_at, timezone, phase, wave, commander_family_member_id,
         created_by_family_member_id, minimum_guard_count, recommended_guard_count, maximum_guard_count, event_projection_key,
         metadata, created_at, updated_at)
       values
        ('10000000-0000-4000-8000-000000000301', $1, 'E2E Tower Defense', 'Seed tower defense.',
         'scheduled', 'normal', $3, 'Europe/Kyiv', 'planning', 1, $2, $2, 1, 2, 3,
         'e2e-tower-defense-seed', '{"seed":"e2e"}'::jsonb, $4, $4)`,
      [towerId, ownerId, '2026-02-03T18:00:00.000Z', now],
    );

    await pool.query(
      `insert into family_tower_cooldown_states
        (tower_id, cooldown_at, cooldown_status, source, source_author_id, metadata, created_at, updated_at)
       values ($1, $2, 'current', 'hub', $3, '{"seed":"e2e"}'::jsonb, $4, $4)`,
      [towerId, '2026-02-04T18:00:00.000Z', ownerId, now],
    );

    await pool.query(
      `insert into family_audit_log
        (id, actor_family_member_id, actor_type, action, entity_type, entity_id, before_data, after_data, metadata, created_at)
       values
        ('e2e-audit-001', $1, 'user', 'e2e_seed_created', 'e2e_seed', 'e2e-seed', null, '{"ok":true}'::jsonb, '{"seed":"e2e"}'::jsonb, $2),
        ('e2e-audit-002', $1, 'user', 'treasury_entry_created', 'family_treasury_entry', 'e2e-treasury-entry', null, '{"title":"E2E Treasury Shop"}'::jsonb, '{"seed":"e2e"}'::jsonb, $2)`,
      [ownerId, now],
    );

    await pool.query('commit');
  } catch (error) {
    await pool.query('rollback');
    throw error;
  }
}
