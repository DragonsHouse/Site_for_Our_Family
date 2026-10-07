-- Final pre-manual-QA hardening:
-- - DB-backed Tower KD/cooldown reminder state
-- - Treasury structured price fields and optimistic concurrency
-- - Audit actor typing for user/system/discord actions

alter table family_audit_log
  add column if not exists actor_type text not null default 'user'
    check (actor_type in ('user', 'system', 'discord'));

alter table family_treasury_entries
  add column if not exists price_amount numeric(14,2) null,
  add column if not exists price_note text null,
  add column if not exists version integer not null default 1 check (version > 0);

update family_treasury_entries
set
  price_amount = case
    when price is not null and trim(price) ~ '^[0-9]+([[:space:]]?[0-9]{3})*([.,][0-9]{1,2})?$'
      then replace(replace(trim(price), ' ', ''), ',', '.')::numeric(14,2)
    else price_amount
  end,
  price_note = case
    when price is not null and not (trim(price) ~ '^[0-9]+([[:space:]]?[0-9]{3})*([.,][0-9]{1,2})?$')
      then coalesce(price_note, price)
    else price_note
  end;

create index if not exists idx_family_treasury_entries_version
  on family_treasury_entries(id, version);

create table if not exists family_tower_cooldown_states (
  tower_id uuid primary key references family_towers(id) on delete cascade,
  cooldown_at timestamptz null,
  cooldown_status text not null default 'missing'
    check (cooldown_status in ('current', 'stale', 'missing')),
  source text not null default 'system'
    check (source in ('discord', 'hub', 'system')),
  source_channel_id text null,
  source_message_id text null,
  source_author_id text null,
  missing_condition_key text null,
  last_kd_reminder_at timestamptz null,
  last_kd_reminder_reason text null,
  last_kd_reminder_result text null
    check (last_kd_reminder_result is null or last_kd_reminder_result in ('sent', 'failed', 'skipped')),
  last_kd_reminder_error text null,
  reminder_cycle_resolved_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object')
);

create index if not exists idx_family_tower_cooldown_states_status
  on family_tower_cooldown_states(cooldown_status, updated_at desc);

create index if not exists idx_family_tower_cooldown_states_reminder
  on family_tower_cooldown_states(last_kd_reminder_at desc)
  where last_kd_reminder_at is not null;
