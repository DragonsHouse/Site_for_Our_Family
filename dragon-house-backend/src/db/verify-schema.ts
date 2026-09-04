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
  'discord_login_completions',
  'discord_role_mappings',
  'family_audit_log',
  'discord_sync_reports',
  'discord_orchestration_messages',
  'discord_orchestration_actions',
  'family_quest_templates',
  'family_quests',
  'family_quest_people',
  'family_quest_rewards',
  'family_quest_reports',
  'family_quest_payouts',
  'family_quest_audit',
  'family_member_accruals',
  'family_accounting_transactions',
  'family_payroll_periods',
  'family_salary_rules',
  'family_salary_calculations',
  'family_premium_entitlements',
  'family_payout_batches',
  'family_payout_batch_items',
  'family_payout_batch_item_accruals',
  'family_accounting_audit',
  'family_quest_payout_configs',
  'family_payment_proofs',
  'family_towers',
  'family_tower_defenses',
  'family_tower_defense_responses',
  'family_tower_defense_attendance',
  'family_fire_guard_roster',
  'family_events',
  'family_event_responses',
  'family_event_attendance',
  'family_achievement_definitions',
  'family_member_achievements',
  'family_reward_definitions',
  'family_member_reward_grants',
  'family_reward_allocations',
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

async function columnNotNull(pool: NonNullable<ReturnType<typeof createPgPool>>, tableName: string, columnName: string) {
  const result = await pool.query<{ not_null: boolean }>(
    `select is_nullable = 'NO' as not_null
     from information_schema.columns
     where table_schema = 'public' and table_name = $1 and column_name = $2`,
    [tableName, columnName],
  );
  return result.rows[0]?.not_null ?? false;
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
    checks.push({ name: 'family_members.static_id nullable for Discord-created members', ok: !(await columnNotNull(pool, 'family_members', 'static_id')) });
    for (const column of [
      'status',
      'date_of_birth',
      'avatar_asset_id',
      'notes',
      'joined_at',
      'deleted_at',
      'version',
      'permissions_override',
      'permissions_discord',
      'permissions_denied',
      'onboarding_metadata',
      'profile_metadata',
    ]) {
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
    for (const column of ['discord_server_nickname', 'discord_avatar', 'guild_id', 'joined_at', 'left_at', 'last_synced_at', 'verified']) {
      checks.push({ name: `discord_account_links.${column} column`, ok: await columnExists(pool, 'discord_account_links', column) });
    }
    checks.push({ name: 'discord_role_mappings.discord_role_id primary key', ok: await constraintExists(pool, 'discord_role_mappings', 'p', 'discord_role_id') });
    checks.push({ name: 'discord_role_mappings.family_role check', ok: await constraintExists(pool, 'discord_role_mappings', 'c', 'family_role') });
    checks.push({ name: 'discord_role_mappings.rank check', ok: await constraintExists(pool, 'discord_role_mappings', 'c', 'rank') });
    checks.push({ name: 'discord_role_mappings.mapping_type check', ok: await constraintExists(pool, 'discord_role_mappings', 'c', 'mapping_type') });
    for (const column of ['discord_role_name', 'mapping_type', 'permissions', 'priority', 'grants_permissions', 'metadata', 'enabled']) {
      checks.push({ name: `discord_role_mappings.${column} column`, ok: await columnExists(pool, 'discord_role_mappings', column) });
    }
    checks.push({ name: 'discord_role_mappings type priority index', ok: await indexExists(pool, 'idx_discord_role_mappings_type_priority') });
    checks.push({ name: 'family_sessions.token_hash unique', ok: await constraintExists(pool, 'family_sessions', 'u', 'token_hash') });
    checks.push({ name: 'family_sessions.login_provider column', ok: await columnExists(pool, 'family_sessions', 'login_provider') });
    checks.push({ name: 'family_sessions.revoked_reason column', ok: await columnExists(pool, 'family_sessions', 'revoked_reason') });
    checks.push({ name: 'family_sessions.login_provider check', ok: await constraintExists(pool, 'family_sessions', 'c', 'login_provider') });
    for (const column of ['purpose', 'client_type', 'redirect_target', 'code_verifier', 'environment', 'metadata']) {
      checks.push({ name: `discord_oauth_states.${column} column`, ok: await columnExists(pool, 'discord_oauth_states', column) });
    }
    checks.push({ name: 'discord_oauth_states purpose check', ok: await constraintExists(pool, 'discord_oauth_states', 'c', 'purpose') });
    checks.push({ name: 'discord_oauth_states client type check', ok: await constraintExists(pool, 'discord_oauth_states', 'c', 'client_type') });
    checks.push({
      name: 'discord_login_completions.family_member_id -> family_members.id',
      ok: await foreignKeyTargets(pool, 'discord_login_completions', 'family_member_id', 'family_members', 'id'),
    });
    checks.push({
      name: 'discord_login_completions.state_id -> discord_oauth_states.state_id',
      ok: await foreignKeyTargets(pool, 'discord_login_completions', 'state_id', 'discord_oauth_states', 'state_id'),
    });
    checks.push({ name: 'discord_login_completions expires index', ok: await indexExists(pool, 'idx_discord_login_completions_expires_at') });
    checks.push({
      name: 'family_audit_log.actor_family_member_id -> family_members.id',
      ok: await foreignKeyTargets(pool, 'family_audit_log', 'actor_family_member_id', 'family_members', 'id'),
    });
    checks.push({ name: 'discord_sync_reports.id primary key', ok: await constraintExists(pool, 'discord_sync_reports', 'p', 'id') });
    checks.push({ name: 'discord_sync_reports.created_at index', ok: await indexExists(pool, 'idx_discord_sync_reports_created_at') });
    checks.push({ name: 'discord_sync_reports.idempotency_key column', ok: await columnExists(pool, 'discord_sync_reports', 'idempotency_key') });
    checks.push({ name: 'discord_sync_reports idempotency key unique index', ok: await indexExists(pool, 'idx_discord_sync_reports_idempotency_key') });
    checks.push({ name: 'family_audit_log syncRunId index', ok: await indexExists(pool, 'idx_family_audit_log_sync_run_id') });
    checks.push({ name: 'discord_orchestration_messages.id primary key', ok: await constraintExists(pool, 'discord_orchestration_messages', 'p', 'id') });
    checks.push({ name: 'discord_orchestration_actions.id primary key', ok: await constraintExists(pool, 'discord_orchestration_actions', 'p', 'id') });
    checks.push({
      name: 'discord_orchestration_actions.family_member_id -> family_members.id',
      ok: await foreignKeyTargets(pool, 'discord_orchestration_actions', 'family_member_id', 'family_members', 'id'),
    });
    for (const indexName of [
      'idx_discord_orchestration_messages_source',
      'idx_discord_orchestration_messages_external',
      'idx_discord_orchestration_messages_discord_message',
      'idx_discord_orchestration_actions_idempotency',
      'idx_discord_orchestration_actions_interaction',
    ]) {
      checks.push({ name: `${indexName} exists`, ok: await indexExists(pool, indexName) });
    }
    checks.push({ name: 'family_quest_templates.id primary key', ok: await constraintExists(pool, 'family_quest_templates', 'p', 'id') });
    checks.push({ name: 'family_quest_templates.template_key unique', ok: await constraintExists(pool, 'family_quest_templates', 'u', 'template_key') });
    checks.push({ name: 'family_quests.id primary key', ok: await constraintExists(pool, 'family_quests', 'p', 'id') });
    checks.push({
      name: 'family_quests.template_id -> family_quest_templates.id',
      ok: await foreignKeyTargets(pool, 'family_quests', 'template_id', 'family_quest_templates', 'id'),
    });
    checks.push({
      name: 'family_quest_people.quest_id -> family_quests.id',
      ok: await foreignKeyTargets(pool, 'family_quest_people', 'quest_id', 'family_quests', 'id'),
    });
    checks.push({ name: 'family_quest_people active member unique index', ok: await indexExists(pool, 'idx_family_quest_people_active_unique_member') });
    checks.push({
      name: 'family_quest_reports.quest_id -> family_quests.id',
      ok: await foreignKeyTargets(pool, 'family_quest_reports', 'quest_id', 'family_quests', 'id'),
    });
    checks.push({
      name: 'family_quest_payouts.quest_id -> family_quests.id',
      ok: await foreignKeyTargets(pool, 'family_quest_payouts', 'quest_id', 'family_quests', 'id'),
    });
    checks.push({
      name: 'family_quest_audit.quest_id -> family_quests.id',
      ok: await foreignKeyTargets(pool, 'family_quest_audit', 'quest_id', 'family_quests', 'id'),
    });
    checks.push({
      name: 'family_member_accruals.family_member_id -> family_members.id',
      ok: await foreignKeyTargets(pool, 'family_member_accruals', 'family_member_id', 'family_members', 'id'),
    });
    checks.push({
      name: 'family_accounting_transactions.family_member_id -> family_members.id',
      ok: await foreignKeyTargets(pool, 'family_accounting_transactions', 'family_member_id', 'family_members', 'id'),
    });
    checks.push({
      name: 'family_accounting_transactions.quest_id -> family_quests.id',
      ok: await foreignKeyTargets(pool, 'family_accounting_transactions', 'quest_id', 'family_quests', 'id'),
    });
    checks.push({
      name: 'family_accounting_transactions.accrual_id -> family_member_accruals.id',
      ok: await foreignKeyTargets(pool, 'family_accounting_transactions', 'accrual_id', 'family_member_accruals', 'id'),
    });
    checks.push({
      name: 'family_accounting_transactions.payout_id -> family_quest_payouts.id',
      ok: await foreignKeyTargets(pool, 'family_accounting_transactions', 'payout_id', 'family_quest_payouts', 'id'),
    });
    checks.push({
      name: 'family_quest_payouts.accrual_id -> family_member_accruals.id',
      ok: await foreignKeyTargets(pool, 'family_quest_payouts', 'accrual_id', 'family_member_accruals', 'id'),
    });
    checks.push({
      name: 'family_quest_payouts.accounting_transaction_id -> family_accounting_transactions.id',
      ok: await foreignKeyTargets(pool, 'family_quest_payouts', 'accounting_transaction_id', 'family_accounting_transactions', 'id'),
    });
    checks.push({
      name: 'family_quest_payouts.issued_by_family_member_id -> family_members.id',
      ok: await foreignKeyTargets(pool, 'family_quest_payouts', 'issued_by_family_member_id', 'family_members', 'id'),
    });
    for (const column of ['idempotency_key', 'accrual_id', 'accounting_transaction_id', 'issued_at', 'issued_by_family_member_id', 'version']) {
      checks.push({ name: `family_quest_payouts.${column} column`, ok: await columnExists(pool, 'family_quest_payouts', column) });
    }
    for (const indexName of [
      'idx_family_member_accruals_source_key',
      'idx_family_member_accruals_member_status',
      'idx_family_accounting_transactions_source_key',
      'idx_family_accounting_transactions_member',
      'idx_family_quest_payouts_payout_event_key',
      'idx_family_quest_payouts_idempotency_key',
      'idx_family_quest_payouts_accrual',
      'idx_family_quest_payouts_accounting_transaction',
    ]) {
      checks.push({ name: `${indexName} exists`, ok: await indexExists(pool, indexName) });
    }
    checks.push({ name: 'family_payroll_periods.id primary key', ok: await constraintExists(pool, 'family_payroll_periods', 'p', 'id') });
    checks.push({
      name: 'family_payroll_periods.created_by_family_member_id -> family_members.id',
      ok: await foreignKeyTargets(pool, 'family_payroll_periods', 'created_by_family_member_id', 'family_members', 'id'),
    });
    checks.push({
      name: 'family_salary_rules.created_by_family_member_id -> family_members.id',
      ok: await foreignKeyTargets(pool, 'family_salary_rules', 'created_by_family_member_id', 'family_members', 'id'),
    });
    checks.push({
      name: 'family_salary_rules.updated_by_family_member_id -> family_members.id',
      ok: await foreignKeyTargets(pool, 'family_salary_rules', 'updated_by_family_member_id', 'family_members', 'id'),
    });
    for (const column of ['rule_type', 'version', 'stacking_policy', 'effective_from', 'effective_to', 'priority']) {
      checks.push({ name: `family_salary_rules.${column} column`, ok: await columnExists(pool, 'family_salary_rules', column) });
    }
    checks.push({
      name: 'family_salary_calculations.payroll_period_id -> family_payroll_periods.id',
      ok: await foreignKeyTargets(pool, 'family_salary_calculations', 'payroll_period_id', 'family_payroll_periods', 'id'),
    });
    checks.push({
      name: 'family_salary_calculations.accrual_id -> family_member_accruals.id',
      ok: await foreignKeyTargets(pool, 'family_salary_calculations', 'accrual_id', 'family_member_accruals', 'id'),
    });
    for (const column of ['eligibility', 'breakdown', 'rule_snapshot', 'input_snapshot', 'warnings', 'status']) {
      checks.push({ name: `family_salary_calculations.${column} column`, ok: await columnExists(pool, 'family_salary_calculations', column) });
    }
    checks.push({
      name: 'family_premium_entitlements.accrual_id -> family_member_accruals.id',
      ok: await foreignKeyTargets(pool, 'family_premium_entitlements', 'accrual_id', 'family_member_accruals', 'id'),
    });
    for (const column of ['category', 'stacking_policy']) {
      checks.push({ name: `family_premium_entitlements.${column} column`, ok: await columnExists(pool, 'family_premium_entitlements', column) });
    }
    checks.push({ name: 'family_quest_payout_configs.config_key unique', ok: await constraintExists(pool, 'family_quest_payout_configs', 'u', 'config_key') });
    checks.push({ name: 'family_quest_payout_configs.template_key unique', ok: await constraintExists(pool, 'family_quest_payout_configs', 'u', 'template_key') });
    checks.push({
      name: 'family_payout_batch_items.payout_batch_id -> family_payout_batches.id',
      ok: await foreignKeyTargets(pool, 'family_payout_batch_items', 'payout_batch_id', 'family_payout_batches', 'id'),
    });
    checks.push({
      name: 'family_payout_batch_item_accruals.accrual_id -> family_member_accruals.id',
      ok: await foreignKeyTargets(pool, 'family_payout_batch_item_accruals', 'accrual_id', 'family_member_accruals', 'id'),
    });
    checks.push({
      name: 'family_accounting_transactions.payout_batch_id -> family_payout_batches.id',
      ok: await foreignKeyTargets(pool, 'family_accounting_transactions', 'payout_batch_id', 'family_payout_batches', 'id'),
    });
    checks.push({
      name: 'family_accounting_audit.actor_family_member_id -> family_members.id',
      ok: await foreignKeyTargets(pool, 'family_accounting_audit', 'actor_family_member_id', 'family_members', 'id'),
    });
    checks.push({
      name: 'family_payment_proofs.payout_batch_id -> family_payout_batches.id',
      ok: await foreignKeyTargets(pool, 'family_payment_proofs', 'payout_batch_id', 'family_payout_batches', 'id'),
    });
    checks.push({
      name: 'family_payment_proofs.payout_batch_item_id -> family_payout_batch_items.id',
      ok: await foreignKeyTargets(pool, 'family_payment_proofs', 'payout_batch_item_id', 'family_payout_batch_items', 'id'),
    });
    checks.push({
      name: 'family_payment_proofs.uploaded_by_family_member_id -> family_members.id',
      ok: await foreignKeyTargets(pool, 'family_payment_proofs', 'uploaded_by_family_member_id', 'family_members', 'id'),
    });
    for (const column of ['payroll_period_id', 'payout_batch_item_id']) {
      checks.push({ name: `family_member_accruals.${column} column`, ok: await columnExists(pool, 'family_member_accruals', column) });
    }
    for (const column of ['payout_batch_id', 'payout_batch_item_id', 'recorded_at', 'payment_proof_id', 'payer_nickname_snapshot', 'payer_role_snapshot']) {
      checks.push({ name: `family_accounting_transactions.${column} column`, ok: await columnExists(pool, 'family_accounting_transactions', column) });
    }
    for (const column of ['payment_proof_id', 'payer_nickname_snapshot', 'payer_role_snapshot']) {
      checks.push({ name: `family_payout_batch_items.${column} column`, ok: await columnExists(pool, 'family_payout_batch_items', column) });
    }
    for (const indexName of [
      'idx_family_payroll_periods_status_dates',
      'idx_family_salary_rules_active',
      'idx_family_salary_rules_type_active',
      'idx_family_salary_rules_version',
      'idx_family_salary_calculations_period_member',
      'idx_family_salary_calculations_status',
      'idx_family_premium_entitlements_member_status',
      'idx_family_payout_batches_status_created',
      'idx_family_payout_batch_items_batch_status',
      'idx_family_accounting_audit_entity',
      'idx_family_quest_payout_configs_active',
      'idx_family_payment_proofs_item',
      'idx_family_payment_proofs_transaction',
    ]) {
      checks.push({ name: `${indexName} exists`, ok: await indexExists(pool, indexName) });
    }
    for (const indexName of [
      'idx_family_quest_templates_active',
      'idx_family_quests_status',
      'idx_family_quests_template_id',
      'idx_family_quests_starts_at',
      'idx_family_quest_rewards_quest',
      'idx_family_quest_reports_quest',
      'idx_family_quest_payouts_quest',
      'idx_family_quest_audit_quest',
    ]) {
      checks.push({ name: `${indexName} exists`, ok: await indexExists(pool, indexName) });
    }
    checks.push({ name: 'family_towers.id primary key', ok: await constraintExists(pool, 'family_towers', 'p', 'id') });
    checks.push({ name: 'family_towers.tower_code unique', ok: await constraintExists(pool, 'family_towers', 'u', 'tower_code') });
    checks.push({ name: 'family_tower_defenses.id primary key', ok: await constraintExists(pool, 'family_tower_defenses', 'p', 'id') });
    checks.push({
      name: 'family_tower_defenses.tower_id -> family_towers.id',
      ok: await foreignKeyTargets(pool, 'family_tower_defenses', 'tower_id', 'family_towers', 'id'),
    });
    checks.push({
      name: 'family_tower_defenses.commander_family_member_id -> family_members.id',
      ok: await foreignKeyTargets(pool, 'family_tower_defenses', 'commander_family_member_id', 'family_members', 'id'),
    });
    checks.push({
      name: 'family_tower_defenses.created_by_family_member_id -> family_members.id',
      ok: await foreignKeyTargets(pool, 'family_tower_defenses', 'created_by_family_member_id', 'family_members', 'id'),
    });
    checks.push({
      name: 'family_tower_defense_responses.defense_id -> family_tower_defenses.id',
      ok: await foreignKeyTargets(pool, 'family_tower_defense_responses', 'defense_id', 'family_tower_defenses', 'id'),
    });
    checks.push({
      name: 'family_tower_defense_responses.family_member_id -> family_members.id',
      ok: await foreignKeyTargets(pool, 'family_tower_defense_responses', 'family_member_id', 'family_members', 'id'),
    });
    checks.push({
      name: 'family_tower_defense_attendance.defense_id -> family_tower_defenses.id',
      ok: await foreignKeyTargets(pool, 'family_tower_defense_attendance', 'defense_id', 'family_tower_defenses', 'id'),
    });
    checks.push({
      name: 'family_tower_defense_attendance.family_member_id -> family_members.id',
      ok: await foreignKeyTargets(pool, 'family_tower_defense_attendance', 'family_member_id', 'family_members', 'id'),
    });
    checks.push({
      name: 'family_fire_guard_roster.family_member_id -> family_members.id',
      ok: await foreignKeyTargets(pool, 'family_fire_guard_roster', 'family_member_id', 'family_members', 'id'),
    });
    for (const column of ['guild_id', 'channel_id', 'message_id', 'voice_channel_id', 'synced_at', 'external_source', 'external_id', 'sync_idempotency_key']) {
      checks.push({ name: `family_tower_defenses.${column} column`, ok: await columnExists(pool, 'family_tower_defenses', column) });
    }
    for (const indexName of [
      'idx_family_towers_active',
      'idx_family_tower_defenses_status',
      'idx_family_tower_defenses_result',
      'idx_family_tower_defenses_priority',
      'idx_family_tower_defenses_tower',
      'idx_family_tower_defenses_commander',
      'idx_family_tower_defense_responses_active_member',
      'idx_family_tower_defense_attendance_member',
      'idx_family_fire_guard_roster_member',
    ]) {
      checks.push({ name: `${indexName} exists`, ok: await indexExists(pool, indexName) });
    }
    checks.push({ name: 'family_events.id primary key', ok: await constraintExists(pool, 'family_events', 'p', 'id') });
    checks.push({
      name: 'family_events.created_by_family_member_id -> family_members.id',
      ok: await foreignKeyTargets(pool, 'family_events', 'created_by_family_member_id', 'family_members', 'id'),
    });
    checks.push({
      name: 'family_events.organizer_family_member_id -> family_members.id',
      ok: await foreignKeyTargets(pool, 'family_events', 'organizer_family_member_id', 'family_members', 'id'),
    });
    checks.push({
      name: 'family_event_responses.event_id -> family_events.id',
      ok: await foreignKeyTargets(pool, 'family_event_responses', 'event_id', 'family_events', 'id'),
    });
    checks.push({
      name: 'family_event_responses.family_member_id -> family_members.id',
      ok: await foreignKeyTargets(pool, 'family_event_responses', 'family_member_id', 'family_members', 'id'),
    });
    checks.push({
      name: 'family_event_attendance.event_id -> family_events.id',
      ok: await foreignKeyTargets(pool, 'family_event_attendance', 'event_id', 'family_events', 'id'),
    });
    checks.push({
      name: 'family_event_attendance.family_member_id -> family_members.id',
      ok: await foreignKeyTargets(pool, 'family_event_attendance', 'family_member_id', 'family_members', 'id'),
    });
    for (const column of ['event_type', 'category', 'status', 'starts_at', 'ends_at', 'visibility', 'metadata']) {
      checks.push({ name: `family_events.${column} column`, ok: await columnExists(pool, 'family_events', column) });
    }
    for (const indexName of [
      'idx_family_events_status_starts',
      'idx_family_events_category_starts',
      'idx_family_events_type_starts',
      'idx_family_events_organizer_starts',
      'idx_family_event_responses_event_member',
      'idx_family_event_responses_member',
      'idx_family_event_attendance_event_member',
      'idx_family_event_attendance_member',
    ]) {
      checks.push({ name: `${indexName} exists`, ok: await indexExists(pool, indexName) });
    }
    checks.push({ name: 'family_achievement_definitions.id primary key', ok: await constraintExists(pool, 'family_achievement_definitions', 'p', 'id') });
    checks.push({ name: 'family_achievement_definitions.achievement_key unique', ok: await constraintExists(pool, 'family_achievement_definitions', 'u', 'achievement_key') });
    checks.push({
      name: 'family_member_achievements.family_member_id -> family_members.id',
      ok: await foreignKeyTargets(pool, 'family_member_achievements', 'family_member_id', 'family_members', 'id'),
    });
    checks.push({
      name: 'family_member_achievements.achievement_id -> family_achievement_definitions.id',
      ok: await foreignKeyTargets(pool, 'family_member_achievements', 'achievement_id', 'family_achievement_definitions', 'id'),
    });
    checks.push({ name: 'family_reward_definitions.id primary key', ok: await constraintExists(pool, 'family_reward_definitions', 'p', 'id') });
    checks.push({ name: 'family_reward_definitions.reward_key unique', ok: await constraintExists(pool, 'family_reward_definitions', 'u', 'reward_key') });
    checks.push({
      name: 'family_member_reward_grants.family_member_id -> family_members.id',
      ok: await foreignKeyTargets(pool, 'family_member_reward_grants', 'family_member_id', 'family_members', 'id'),
    });
    checks.push({
      name: 'family_member_reward_grants.reward_id -> family_reward_definitions.id',
      ok: await foreignKeyTargets(pool, 'family_member_reward_grants', 'reward_id', 'family_reward_definitions', 'id'),
    });
    for (const column of ['achievement_key', 'category', 'rarity', 'active', 'repeatable', 'hidden', 'rule_metadata']) {
      checks.push({ name: `family_achievement_definitions.${column} column`, ok: await columnExists(pool, 'family_achievement_definitions', column) });
    }
    for (const column of ['source_module', 'source_id', 'source_key', 'awarded_at', 'metadata', 'non_repeatable_member_key']) {
      checks.push({ name: `family_member_achievements.${column} column`, ok: await columnExists(pool, 'family_member_achievements', column) });
    }
    for (const column of ['reward_key', 'reward_type', 'amount', 'value', 'metadata', 'active']) {
      checks.push({ name: `family_reward_definitions.${column} column`, ok: await columnExists(pool, 'family_reward_definitions', column) });
    }
    for (const column of ['source_module', 'source_id', 'source_key', 'status', 'granted_at', 'approved_at', 'approved_by_family_member_id', 'issued_at', 'finance_accrual_id', 'finance_transferred_at', 'metadata', 'version']) {
      checks.push({ name: `family_member_reward_grants.${column} column`, ok: await columnExists(pool, 'family_member_reward_grants', column) });
    }
    checks.push({
      name: 'family_member_reward_grants.approved_by_family_member_id -> family_members.id',
      ok: await foreignKeyTargets(pool, 'family_member_reward_grants', 'approved_by_family_member_id', 'family_members', 'id'),
    });
    checks.push({
      name: 'family_member_reward_grants.finance_accrual_id -> family_member_accruals.id',
      ok: await foreignKeyTargets(pool, 'family_member_reward_grants', 'finance_accrual_id', 'family_member_accruals', 'id'),
    });
    for (const indexName of [
      'idx_family_member_achievements_source_key',
      'idx_family_member_achievements_non_repeatable',
      'idx_family_member_achievements_member_awarded',
      'idx_family_member_achievements_definition',
      'idx_family_member_achievements_source',
      'idx_family_member_reward_grants_source_key',
      'idx_family_member_reward_grants_member_status',
      'idx_family_member_reward_grants_reward',
      'idx_family_member_reward_grants_source',
      'idx_family_member_reward_grants_pending',
      'idx_family_member_reward_grants_approved_by',
      'idx_family_member_reward_grants_finance_accrual',
    ]) {
      checks.push({ name: `${indexName} exists`, ok: await indexExists(pool, indexName) });
    }
    checks.push({ name: 'family_reward_allocations.id primary key', ok: await constraintExists(pool, 'family_reward_allocations', 'p', 'id') });
    checks.push({
      name: 'family_reward_allocations.family_member_id -> family_members.id',
      ok: await foreignKeyTargets(pool, 'family_reward_allocations', 'family_member_id', 'family_members', 'id'),
    });
    checks.push({
      name: 'family_reward_allocations.reward_definition_id -> family_reward_definitions.id',
      ok: await foreignKeyTargets(pool, 'family_reward_allocations', 'reward_definition_id', 'family_reward_definitions', 'id'),
    });
    checks.push({
      name: 'family_reward_allocations.tower_defense_id -> family_tower_defenses.id',
      ok: await foreignKeyTargets(pool, 'family_reward_allocations', 'tower_defense_id', 'family_tower_defenses', 'id'),
    });
    checks.push({
      name: 'family_reward_allocations.family_event_id -> family_events.id',
      ok: await foreignKeyTargets(pool, 'family_reward_allocations', 'family_event_id', 'family_events', 'id'),
    });
    for (const column of ['source_module', 'source_id', 'family_member_id', 'reward_definition_id', 'quantity', 'reason', 'source_key', 'metadata']) {
      checks.push({ name: `family_reward_allocations.${column} column`, ok: await columnExists(pool, 'family_reward_allocations', column) });
    }
    for (const indexName of [
      'idx_family_reward_allocations_source_key',
      'idx_family_reward_allocations_unique_assignment',
      'idx_family_reward_allocations_source',
      'idx_family_reward_allocations_member',
      'idx_family_reward_allocations_reward',
    ]) {
      checks.push({ name: `${indexName} exists`, ok: await indexExists(pool, indexName) });
    }
  } finally {
    await pool.end();
  }
  const failed = checks.filter((check) => !check.ok);
  console.log(JSON.stringify({ ok: failed.length === 0, checks }, null, 2));
  if (failed.length) process.exitCode = 1;
}

await runChecks();
