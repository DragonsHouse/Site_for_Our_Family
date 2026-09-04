create extension if not exists pgcrypto;

create table if not exists family_reward_allocations (
  id uuid primary key default gen_random_uuid(),
  source_module text not null check (source_module in ('tower_defense', 'events')),
  tower_defense_id uuid null references family_tower_defenses(id) on delete cascade,
  family_event_id uuid null references family_events(id) on delete cascade,
  source_id text generated always as (coalesce(tower_defense_id::text, family_event_id::text)) stored,
  family_member_id text not null references family_members(id) on delete restrict,
  reward_definition_id uuid not null references family_reward_definitions(id) on delete restrict,
  quantity numeric(14,2) null check (quantity is null or quantity > 0),
  reason text null,
  source_key text not null,
  created_by_family_member_id text not null references family_members(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object'),
  check (
    (source_module = 'tower_defense' and tower_defense_id is not null and family_event_id is null)
    or
    (source_module = 'events' and family_event_id is not null and tower_defense_id is null)
  )
);

create unique index if not exists idx_family_reward_allocations_source_key
  on family_reward_allocations(source_key);
create unique index if not exists idx_family_reward_allocations_unique_assignment
  on family_reward_allocations(source_module, source_id, family_member_id, reward_definition_id);
create index if not exists idx_family_reward_allocations_source
  on family_reward_allocations(source_module, source_id, created_at asc);
create index if not exists idx_family_reward_allocations_member
  on family_reward_allocations(family_member_id, created_at desc);
create index if not exists idx_family_reward_allocations_reward
  on family_reward_allocations(reward_definition_id, created_at desc);
