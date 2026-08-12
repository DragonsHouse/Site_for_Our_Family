create extension if not exists pgcrypto;

create table if not exists family_member_accruals (
  id uuid primary key default gen_random_uuid(),
  family_member_id text not null references family_members(id) on delete restrict,
  source_type text not null
    check (source_type in ('quest_reward', 'quest_best_participant', 'salary', 'premium', 'manual_bonus', 'tower_defense', 'other')),
  source_id text not null,
  source_key text not null,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'USD',
  reason text not null,
  status text not null default 'accrued' check (status in ('accrued', 'approved', 'paid', 'cancelled')),
  approved_at timestamptz null,
  paid_at timestamptz null,
  reporting_period_start date null,
  reporting_period_end date null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object'),
  check (reporting_period_end is null or reporting_period_start is null or reporting_period_end >= reporting_period_start)
);

create unique index if not exists idx_family_member_accruals_source_key
  on family_member_accruals(source_key);
create index if not exists idx_family_member_accruals_member_status
  on family_member_accruals(family_member_id, status, created_at desc);
create index if not exists idx_family_member_accruals_source
  on family_member_accruals(source_type, source_id);

create table if not exists family_accounting_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_type text not null check (transaction_type in ('income', 'expense', 'payout', 'adjustment')),
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'USD',
  family_member_id text null references family_members(id) on delete set null,
  quest_id uuid null references family_quests(id) on delete set null,
  accrual_id uuid null references family_member_accruals(id) on delete set null,
  payout_id uuid null references family_quest_payouts(id) on delete set null,
  source_key text not null,
  reason text not null,
  created_by_family_member_id text null references family_members(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists idx_family_accounting_transactions_source_key
  on family_accounting_transactions(source_key);
create index if not exists idx_family_accounting_transactions_created_at
  on family_accounting_transactions(created_at desc);
create index if not exists idx_family_accounting_transactions_member
  on family_accounting_transactions(family_member_id, created_at desc);
create index if not exists idx_family_accounting_transactions_quest
  on family_accounting_transactions(quest_id, created_at desc);
create index if not exists idx_family_accounting_transactions_accrual
  on family_accounting_transactions(accrual_id);

alter table family_quest_payouts
  add column if not exists idempotency_key text null,
  add column if not exists accrual_id uuid null references family_member_accruals(id) on delete set null,
  add column if not exists accounting_transaction_id uuid null references family_accounting_transactions(id) on delete set null,
  add column if not exists issued_at timestamptz null,
  add column if not exists issued_by_family_member_id text null references family_members(id) on delete set null,
  add column if not exists version integer not null default 1 check (version > 0);

create unique index if not exists idx_family_quest_payouts_payout_event_key
  on family_quest_payouts(payout_event_key)
  where payout_event_key is not null;
create unique index if not exists idx_family_quest_payouts_idempotency_key
  on family_quest_payouts(idempotency_key)
  where idempotency_key is not null;
create index if not exists idx_family_quest_payouts_accrual
  on family_quest_payouts(accrual_id);
create index if not exists idx_family_quest_payouts_accounting_transaction
  on family_quest_payouts(accounting_transaction_id);
