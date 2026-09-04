create extension if not exists pgcrypto;

create table if not exists family_towers (
  id uuid primary key default gen_random_uuid(),
  tower_code text not null unique,
  name text not null,
  location_label text not null,
  map_metadata jsonb not null default '{}'::jsonb,
  image_asset_id text null,
  icon_asset_id text null,
  is_active boolean not null default true,
  external_source text null,
  external_id text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(tower_code)) > 0),
  check (length(trim(name)) > 0),
  check (jsonb_typeof(map_metadata) = 'object'),
  check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists idx_family_towers_external_identity
  on family_towers(external_source, external_id)
  where external_source is not null and external_id is not null;
create index if not exists idx_family_towers_active
  on family_towers(is_active, name asc);

create table if not exists family_fire_guard_roster (
  id uuid primary key default gen_random_uuid(),
  family_member_id text not null references family_members(id) on delete cascade,
  role text not null check (role in ('commander', 'vanguard', 'driver', 'scout', 'support', 'reserve')),
  status text not null default 'active' check (status in ('active', 'reserve', 'resting', 'unavailable')),
  note text null,
  assigned_by_family_member_id text null references family_members(id) on delete set null,
  external_source text null,
  external_id text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists idx_family_fire_guard_roster_member
  on family_fire_guard_roster(family_member_id);
create index if not exists idx_family_fire_guard_roster_status_role
  on family_fire_guard_roster(status, role);

create table if not exists family_tower_defenses (
  id uuid primary key default gen_random_uuid(),
  tower_id uuid not null references family_towers(id) on delete restrict,
  title text not null,
  description text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'gathering', 'active', 'completed', 'cancelled')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'critical')),
  scheduled_at timestamptz null,
  starts_at timestamptz not null,
  ended_at timestamptz null,
  timezone text not null default 'Europe/Kiev',
  phase text not null default 'planning',
  wave integer not null default 1 check (wave > 0),
  commander_family_member_id text not null references family_members(id) on delete restrict,
  created_by_family_member_id text not null references family_members(id) on delete restrict,
  minimum_guard_count integer not null default 1 check (minimum_guard_count > 0),
  recommended_guard_count integer not null default 1 check (recommended_guard_count > 0),
  maximum_guard_count integer not null default 1 check (maximum_guard_count > 0),
  result text not null default 'pending'
    check (result in ('pending', 'defended', 'lost', 'cancelled')),
  score integer null check (score is null or score >= 0),
  notes text null,
  failure_reason text null,
  completed_by_family_member_id text null references family_members(id) on delete set null,
  completed_at timestamptz null,
  xp integer not null default 0 check (xp >= 0),
  leaderboard_eligible boolean not null default true,
  statistics_eligible boolean not null default true,
  guild_id text null,
  channel_id text null,
  message_id text null,
  voice_channel_id text null,
  synced_at timestamptz null,
  external_source text null,
  external_id text null,
  sync_idempotency_key text null,
  event_projection_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(title)) > 0),
  check (ended_at is null or ended_at >= starts_at),
  check (minimum_guard_count <= recommended_guard_count and recommended_guard_count <= maximum_guard_count),
  check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists idx_family_tower_defenses_event_projection_key
  on family_tower_defenses(event_projection_key);
create unique index if not exists idx_family_tower_defenses_sync_idempotency_key
  on family_tower_defenses(sync_idempotency_key)
  where sync_idempotency_key is not null;
create unique index if not exists idx_family_tower_defenses_external_identity
  on family_tower_defenses(external_source, external_id)
  where external_source is not null and external_id is not null;
create index if not exists idx_family_tower_defenses_status
  on family_tower_defenses(status, starts_at desc);
create index if not exists idx_family_tower_defenses_result
  on family_tower_defenses(result, starts_at desc);
create index if not exists idx_family_tower_defenses_priority
  on family_tower_defenses(priority, starts_at desc);
create index if not exists idx_family_tower_defenses_tower
  on family_tower_defenses(tower_id, starts_at desc);
create index if not exists idx_family_tower_defenses_commander
  on family_tower_defenses(commander_family_member_id, starts_at desc);

create table if not exists family_tower_defense_responses (
  id uuid primary key default gen_random_uuid(),
  defense_id uuid not null references family_tower_defenses(id) on delete cascade,
  family_member_id text not null references family_members(id) on delete cascade,
  response text not null default 'no-response'
    check (response in ('no-response', 'available', 'joining', 'confirmed', 'unavailable')),
  responded_at timestamptz not null default now(),
  note text null,
  source text not null default 'api' check (source in ('manual', 'discord', 'api')),
  external_source text null,
  external_id text null,
  idempotency_key text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists idx_family_tower_defense_responses_active_member
  on family_tower_defense_responses(defense_id, family_member_id);
create unique index if not exists idx_family_tower_defense_responses_idempotency
  on family_tower_defense_responses(idempotency_key)
  where idempotency_key is not null;
create index if not exists idx_family_tower_defense_responses_member
  on family_tower_defense_responses(family_member_id, responded_at desc);

create table if not exists family_tower_defense_attendance (
  id uuid primary key default gen_random_uuid(),
  defense_id uuid not null references family_tower_defenses(id) on delete cascade,
  family_member_id text not null references family_members(id) on delete cascade,
  status text not null default 'unconfirmed'
    check (status in ('unconfirmed', 'present', 'late', 'absent', 'excused')),
  confirmed_by_family_member_id text null references family_members(id) on delete set null,
  confirmed_at timestamptz null,
  note text null,
  score integer null check (score is null or score >= 0),
  damage_blocked integer null check (damage_blocked is null or damage_blocked >= 0),
  supplies_used integer null check (supplies_used is null or supplies_used >= 0),
  contribution_notes text null,
  source text not null default 'api' check (source in ('manual', 'discord', 'api')),
  external_source text null,
  external_id text null,
  idempotency_key text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists idx_family_tower_defense_attendance_member
  on family_tower_defense_attendance(defense_id, family_member_id);
create unique index if not exists idx_family_tower_defense_attendance_idempotency
  on family_tower_defense_attendance(idempotency_key)
  where idempotency_key is not null;
create index if not exists idx_family_tower_defense_attendance_status
  on family_tower_defense_attendance(status, confirmed_at desc);
create index if not exists idx_family_tower_defense_attendance_member_history
  on family_tower_defense_attendance(family_member_id, confirmed_at desc);
