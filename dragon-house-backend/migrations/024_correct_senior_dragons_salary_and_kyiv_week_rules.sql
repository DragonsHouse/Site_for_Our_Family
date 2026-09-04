-- Correct product salary tiers after 023 without editing applied migrations.
-- Rank 8 remains the Crimson Dragons base tier unless the member carries
-- leadership/accounting permissions that identify the Senior Dragons tier.

update family_salary_rules
set amount = 200000,
    name = 'Base salary: Багряні Дракони',
    config = jsonb_build_object(
      'minRank', 8,
      'maxRank', 8,
      'rankLabel', 'Багряні Дракони',
      'productRule', 'weekly_base_salary',
      'excludedPermissions', jsonb_build_array('manage_members', 'manage_accounting', 'manage_treasury')
    ),
    version = version + 1,
    updated_at = now()
where rule_key = 'base_salary_rank_08_crimson_dragons';

insert into family_salary_rules
  (rule_key, name, description, rule_type, basis, amount, currency, active, priority, stacking_policy, config, created_by_family_member_id, updated_by_family_member_id)
values
  (
    'base_salary_rank_08_senior_dragons',
    'Base salary: Старші дракони',
    'Weekly base salary for rank 8 leadership tier.',
    'base_salary',
    'rank',
    250000,
    'USD',
    true,
    108,
    'not_applicable',
    jsonb_build_object(
      'minRank', 8,
      'maxRank', 8,
      'rankLabel', 'Старші дракони',
      'productRule', 'weekly_base_salary',
      'requiredPermissions', jsonb_build_array('manage_members', 'manage_accounting', 'manage_treasury')
    ),
    (select id from family_members where role = 'owner' order by created_at asc limit 1),
    (select id from family_members where role = 'owner' order by created_at asc limit 1)
  )
on conflict (rule_key) do update
set name = excluded.name,
    description = excluded.description,
    rule_type = excluded.rule_type,
    basis = excluded.basis,
    amount = excluded.amount,
    currency = excluded.currency,
    active = excluded.active,
    priority = excluded.priority,
    stacking_policy = excluded.stacking_policy,
    config = excluded.config,
    version = family_salary_rules.version + 1,
    updated_by_family_member_id = excluded.updated_by_family_member_id,
    updated_at = now();

update family_salary_rules
set amount = 300000,
    name = 'Base salary: Хранитель полум’я / Зам',
    config = jsonb_build_object(
      'minRank', 9,
      'maxRank', 9,
      'rankLabel', 'Хранитель полум’я / Зам',
      'productRule', 'weekly_base_salary'
    ),
    version = version + 1,
    updated_at = now()
where rule_key = 'base_salary_rank_09_flame_keeper_deputy';
