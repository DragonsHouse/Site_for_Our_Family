alter table family_member_reward_grants
  add column if not exists approved_at timestamptz null,
  add column if not exists approved_by_family_member_id text null references family_members(id) on delete set null,
  add column if not exists finance_accrual_id uuid null references family_member_accruals(id) on delete set null,
  add column if not exists finance_transferred_at timestamptz null,
  add column if not exists version integer not null default 1 check (version > 0);

create index if not exists idx_family_member_reward_grants_pending
  on family_member_reward_grants(status, granted_at desc);
create index if not exists idx_family_member_reward_grants_approved_by
  on family_member_reward_grants(approved_by_family_member_id, approved_at desc)
  where approved_by_family_member_id is not null;
create index if not exists idx_family_member_reward_grants_finance_accrual
  on family_member_reward_grants(finance_accrual_id)
  where finance_accrual_id is not null;

do $$
declare
  constraint_name text;
begin
  select c.conname
    into constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = current_schema()
    and t.relname = 'family_member_accruals'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%source_type%'
    and pg_get_constraintdef(c.oid) like '%quest_reward%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table family_member_accruals drop constraint %I', constraint_name);
  end if;
end $$;

alter table family_member_accruals
  add constraint family_member_accruals_source_type_check
  check (source_type in ('quest_reward', 'quest_best_participant', 'reward', 'salary', 'premium', 'manual_bonus', 'tower_defense', 'other'));
