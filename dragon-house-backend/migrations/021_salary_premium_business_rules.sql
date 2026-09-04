begin;

alter table family_salary_rules
  add column if not exists rule_type text not null default 'base_salary',
  add column if not exists version integer not null default 1,
  add column if not exists stacking_policy text not null default 'not_applicable',
  add column if not exists updated_by_family_member_id text null references family_members(id) on delete restrict;

alter table family_salary_rules
  drop constraint if exists family_salary_rules_rule_type_check,
  add constraint family_salary_rules_rule_type_check
    check (rule_type in (
      'eligibility',
      'base_salary',
      'fixed_activity_bonus',
      'activity_multiplier',
      'attendance_modifier',
      'leadership_modifier',
      'premium_rule'
    ));

alter table family_salary_rules
  drop constraint if exists family_salary_rules_stacking_policy_check,
  add constraint family_salary_rules_stacking_policy_check
    check (stacking_policy in ('not_applicable', 'stack_all', 'highest_only', 'capped', 'category_specific'));

alter table family_salary_rules
  drop constraint if exists family_salary_rules_version_positive_check,
  add constraint family_salary_rules_version_positive_check check (version >= 1);

alter table family_salary_calculations
  add column if not exists eligibility jsonb not null default '{}'::jsonb,
  add column if not exists breakdown jsonb not null default '{}'::jsonb,
  add column if not exists rule_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists input_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists warnings jsonb not null default '[]'::jsonb,
  add column if not exists status text not null default 'valid';

alter table family_salary_calculations
  drop constraint if exists family_salary_calculations_status_check,
  add constraint family_salary_calculations_status_check
    check (status in ('valid', 'configuration_incomplete', 'ineligible'));

alter table family_accounting_audit
  drop constraint if exists family_accounting_audit_action_check;

alter table family_accounting_audit
  add constraint family_accounting_audit_action_check
  check (action in (
    'payroll_period_created',
    'payroll_calculated',
    'payroll_finalized',
    'salary_rule_created',
    'salary_rule_updated',
    'salary_rule_status_changed',
    'premium_created',
    'adjustment_created',
    'payout_batch_created',
    'payout_batch_finalized',
    'payout_item_paid'
  ));

create index if not exists idx_family_salary_rules_type_active on family_salary_rules(rule_type, active, priority);
create index if not exists idx_family_salary_rules_version on family_salary_rules(rule_key, version);
create index if not exists idx_family_salary_calculations_status on family_salary_calculations(payroll_period_id, status);

commit;
