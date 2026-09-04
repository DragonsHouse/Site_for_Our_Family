begin;

alter table family_member_accruals
  drop constraint if exists family_member_accruals_source_type_check;

alter table family_member_accruals
  add constraint family_member_accruals_source_type_check
  check (source_type in (
    'quest',
    'quest_reward',
    'quest_best_participant',
    'reward',
    'salary',
    'premium',
    'adjustment',
    'manual_bonus',
    'tower_defense',
    'other'
  ));

do $$
declare
  constraint_name text;
begin
  select c.conname
    into constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  where t.relname = 'family_member_accruals'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%amount%>=%0%';

  if constraint_name is not null then
    execute format('alter table family_member_accruals drop constraint %I', constraint_name);
  end if;
end $$;

alter table family_member_accruals
  add constraint family_member_accruals_amount_non_zero_check check (amount <> 0);

create table if not exists family_payroll_periods (
  id uuid primary key default gen_random_uuid(),
  period_type text not null check (period_type in ('monthly', 'custom')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'calculated', 'finalized', 'closed', 'cancelled')),
  title text not null,
  created_by_family_member_id text not null references family_members(id) on delete restrict,
  finalized_at timestamptz null,
  finalized_by_family_member_id text null references family_members(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (period_type, starts_at, ends_at)
);

create table if not exists family_salary_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  name text not null,
  description text null,
  basis text not null check (basis in ('rank', 'role', 'member', 'manual', 'activity_metric')),
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'USD',
  active boolean not null default true,
  effective_from date null,
  effective_to date null,
  priority integer not null default 100,
  config jsonb not null default '{}'::jsonb,
  created_by_family_member_id text not null references family_members(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_from is null or effective_to >= effective_from)
);

create table if not exists family_salary_calculations (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references family_payroll_periods(id) on delete cascade,
  family_member_id text not null references family_members(id) on delete restrict,
  salary_rule_id uuid null references family_salary_rules(id) on delete set null,
  accrual_id uuid not null references family_member_accruals(id) on delete restrict,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'USD',
  metrics jsonb not null default '{}'::jsonb,
  source_key text not null unique,
  calculated_at timestamptz not null default now(),
  calculated_by_family_member_id text not null references family_members(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payroll_period_id, family_member_id, salary_rule_id)
);

create table if not exists family_premium_entitlements (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid null references family_payroll_periods(id) on delete set null,
  family_member_id text not null references family_members(id) on delete restrict,
  accrual_id uuid not null references family_member_accruals(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'USD',
  reason text not null,
  source_type text not null check (source_type in ('manual', 'rule', 'leaderboard', 'achievement', 'special')),
  source_id text null,
  source_key text not null unique,
  status text not null default 'approved' check (status in ('approved', 'cancelled')),
  created_by_family_member_id text not null references family_members(id) on delete restrict,
  cancelled_at timestamptz null,
  cancelled_by_family_member_id text null references family_members(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists family_payout_batches (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid null references family_payroll_periods(id) on delete set null,
  title text not null,
  reference text null,
  status text not null default 'draft' check (status in ('draft', 'finalized', 'partially_paid', 'paid', 'cancelled')),
  created_by_family_member_id text not null references family_members(id) on delete restrict,
  finalized_at timestamptz null,
  finalized_by_family_member_id text null references family_members(id) on delete restrict,
  paid_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists family_payout_batch_items (
  id uuid primary key default gen_random_uuid(),
  payout_batch_id uuid not null references family_payout_batches(id) on delete cascade,
  family_member_id text not null references family_members(id) on delete restrict,
  total_amount numeric(14,2) not null check (total_amount <> 0),
  currency text not null default 'USD',
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  paid_by_family_member_id text null references family_members(id) on delete restrict,
  paid_at timestamptz null,
  accounting_transaction_id uuid null references family_accounting_transactions(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payout_batch_id, family_member_id)
);

create table if not exists family_payout_batch_item_accruals (
  payout_batch_item_id uuid not null references family_payout_batch_items(id) on delete cascade,
  accrual_id uuid not null references family_member_accruals(id) on delete restrict,
  amount numeric(14,2) not null check (amount <> 0),
  created_at timestamptz not null default now(),
  primary key (payout_batch_item_id, accrual_id),
  unique (accrual_id)
);

create table if not exists family_accounting_audit (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in (
    'payroll_period_created',
    'payroll_calculated',
    'payroll_finalized',
    'salary_rule_created',
    'premium_created',
    'adjustment_created',
    'payout_batch_created',
    'payout_batch_finalized',
    'payout_item_paid'
  )),
  actor_family_member_id text not null references family_members(id) on delete restrict,
  entity_type text not null,
  entity_id text not null,
  source_key text not null unique,
  before_data jsonb null,
  after_data jsonb null,
  created_at timestamptz not null default now()
);

alter table family_member_accruals
  add column if not exists payroll_period_id uuid null references family_payroll_periods(id) on delete set null,
  add column if not exists payout_batch_item_id uuid null references family_payout_batch_items(id) on delete set null;

alter table family_accounting_transactions
  add column if not exists payout_batch_id uuid null references family_payout_batches(id) on delete set null,
  add column if not exists payout_batch_item_id uuid null references family_payout_batch_items(id) on delete set null,
  add column if not exists recorded_at timestamptz not null default now();

create index if not exists idx_family_payroll_periods_status_dates on family_payroll_periods(status, starts_at desc);
create index if not exists idx_family_salary_rules_active on family_salary_rules(active, priority, rule_key);
create index if not exists idx_family_salary_calculations_period_member on family_salary_calculations(payroll_period_id, family_member_id);
create index if not exists idx_family_premium_entitlements_member_status on family_premium_entitlements(family_member_id, status, created_at desc);
create index if not exists idx_family_premium_entitlements_period on family_premium_entitlements(payroll_period_id);
create index if not exists idx_family_payout_batches_status_created on family_payout_batches(status, created_at desc);
create index if not exists idx_family_payout_batch_items_batch_status on family_payout_batch_items(payout_batch_id, status);
create index if not exists idx_family_payout_batch_items_member_status on family_payout_batch_items(family_member_id, status);
create index if not exists idx_family_payout_batch_item_accruals_accrual on family_payout_batch_item_accruals(accrual_id);
create index if not exists idx_family_accounting_audit_entity on family_accounting_audit(entity_type, entity_id, created_at desc);
create index if not exists idx_family_member_accruals_payroll_period on family_member_accruals(payroll_period_id);
create index if not exists idx_family_member_accruals_payout_batch_item on family_member_accruals(payout_batch_item_id);
create index if not exists idx_family_accounting_transactions_payout_batch on family_accounting_transactions(payout_batch_id);
create index if not exists idx_family_accounting_transactions_payout_batch_item on family_accounting_transactions(payout_batch_item_id);

commit;
