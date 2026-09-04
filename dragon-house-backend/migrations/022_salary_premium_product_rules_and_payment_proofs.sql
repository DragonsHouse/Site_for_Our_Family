begin;

alter table family_payroll_periods
  drop constraint if exists family_payroll_periods_period_type_check;

alter table family_payroll_periods
  add constraint family_payroll_periods_period_type_check
  check (period_type in ('weekly', 'monthly', 'custom'));

create table if not exists family_quest_payout_configs (
  id uuid primary key default gen_random_uuid(),
  config_key text not null unique,
  template_key text null unique,
  quest_title text not null,
  total_family_income numeric(14,2) not null check (total_family_income >= 0),
  people_payout_pool numeric(14,2) not null check (people_payout_pool >= 0),
  family_remainder numeric(14,2) not null check (family_remainder >= 0),
  currency text not null default 'USD',
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (people_payout_pool + family_remainder = total_family_income),
  check (jsonb_typeof(metadata) = 'object')
);

alter table family_premium_entitlements
  add column if not exists category text not null default 'manual',
  add column if not exists stacking_policy text not null default 'not_applicable';

alter table family_premium_entitlements
  drop constraint if exists family_premium_entitlements_category_check,
  add constraint family_premium_entitlements_category_check
  check (category in ('manual', 'activity', 'quest_activity', 'combat', 'top3', 'leadership', 'special'));

alter table family_premium_entitlements
  drop constraint if exists family_premium_entitlements_stacking_policy_check,
  add constraint family_premium_entitlements_stacking_policy_check
  check (stacking_policy in ('not_applicable', 'stack_all', 'highest_only', 'capped', 'category_specific'));

create table if not exists family_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  payout_batch_id uuid not null references family_payout_batches(id) on delete restrict,
  payout_batch_item_id uuid not null references family_payout_batch_items(id) on delete restrict,
  accounting_transaction_id uuid null references family_accounting_transactions(id) on delete set null,
  storage_key text not null unique,
  original_filename text not null,
  content_type text not null check (content_type in ('image/png', 'image/jpeg', 'image/webp')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  uploaded_by_family_member_id text not null references family_members(id) on delete restrict,
  uploaded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists idx_family_payment_proofs_item
  on family_payment_proofs(payout_batch_item_id);
create index if not exists idx_family_payment_proofs_transaction
  on family_payment_proofs(accounting_transaction_id);
create index if not exists idx_family_payment_proofs_uploaded_by
  on family_payment_proofs(uploaded_by_family_member_id, uploaded_at desc);

alter table family_payout_batch_items
  add column if not exists payment_proof_id uuid null references family_payment_proofs(id) on delete restrict,
  add column if not exists payer_nickname_snapshot text null,
  add column if not exists payer_role_snapshot text null;

alter table family_accounting_transactions
  add column if not exists payment_proof_id uuid null references family_payment_proofs(id) on delete set null,
  add column if not exists payer_nickname_snapshot text null,
  add column if not exists payer_role_snapshot text null;

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
    'payment_proof_uploaded',
    'payout_item_paid'
  ));

create index if not exists idx_family_quest_payout_configs_active
  on family_quest_payout_configs(active, template_key, quest_title);
create index if not exists idx_family_premium_entitlements_category
  on family_premium_entitlements(category, payroll_period_id, status);
create index if not exists idx_family_payout_batch_items_proof
  on family_payout_batch_items(payment_proof_id);
create index if not exists idx_family_accounting_transactions_proof
  on family_accounting_transactions(payment_proof_id);

insert into family_quest_payout_configs
  (config_key, template_key, quest_title, total_family_income, people_payout_pool, family_remainder, metadata)
values
  ('quest-payout-help-citizens', 'help-citizens', 'Допомога громадянам', 1000000, 700000, 300000, '{"source":"product_rule_2026_08_13"}'::jsonb),
  ('quest-payout-cargo-boom', 'cargo-boom', 'Товарний вибух', 1000000, 700000, 300000, '{"source":"product_rule_2026_08_13"}'::jsonb),
  ('quest-payout-subotnyk', 'subotnyk', 'Суботнік', 1000000, 900000, 100000, '{"source":"product_rule_2026_08_13"}'::jsonb),
  ('quest-payout-forest-trophies', 'forest-trophies', 'Лісові трофеї', 750000, 600000, 150000, '{"source":"product_rule_2026_08_13"}'::jsonb),
  ('quest-payout-fish-day', 'fish-day', 'Рибний день', 1000000, 700000, 300000, '{"source":"product_rule_2026_08_13"}'::jsonb),
  ('quest-payout-woodcutter-call', 'woodcutter-call', 'Заклик лісоруба', 500000, 400000, 100000, '{"source":"product_rule_2026_08_13"}'::jsonb),
  ('quest-payout-hunting-season', 'hunting-season', 'Мисливський сезон', 500000, 400000, 100000, '{"source":"product_rule_2026_08_13"}'::jsonb),
  ('quest-payout-mining-work', 'mining-work', 'Шахтарська справа', 750000, 600000, 150000, '{"source":"product_rule_2026_08_13"}'::jsonb),
  ('quest-payout-blood-power', 'blood-power', 'Влада через кров', 1000000, 700000, 300000, '{"source":"product_rule_2026_08_13"}'::jsonb),
  ('quest-payout-fuel-progress', 'fuel-progress', 'Паливо прогреса', 500000, 400000, 100000, '{"source":"product_rule_2026_08_13"}'::jsonb),
  ('quest-payout-guardians', 'guardians', 'Вартові свого', 750000, 600000, 150000, '{"source":"product_rule_2026_08_13"}'::jsonb)
on conflict (config_key) do update
  set template_key = excluded.template_key,
      quest_title = excluded.quest_title,
      total_family_income = excluded.total_family_income,
      people_payout_pool = excluded.people_payout_pool,
      family_remainder = excluded.family_remainder,
      metadata = family_quest_payout_configs.metadata || excluded.metadata,
      active = true,
      updated_at = now();

commit;
