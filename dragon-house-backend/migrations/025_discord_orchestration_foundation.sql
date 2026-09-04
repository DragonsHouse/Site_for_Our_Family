create table if not exists discord_orchestration_messages (
  id uuid primary key default gen_random_uuid(),
  source_module text not null check (source_module in ('family_quests', 'tower_defense', 'family_events')),
  source_id text not null,
  message_kind text not null default 'announcement',
  guild_id text not null,
  channel_id text not null,
  message_id text null,
  thread_id text null,
  payload_hash text null,
  synced_at timestamptz null,
  external_source text not null default 'discord',
  external_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists idx_discord_orchestration_messages_source
  on discord_orchestration_messages(source_module, source_id, message_kind, guild_id, channel_id);

create unique index if not exists idx_discord_orchestration_messages_external
  on discord_orchestration_messages(external_source, external_id);

create unique index if not exists idx_discord_orchestration_messages_discord_message
  on discord_orchestration_messages(guild_id, channel_id, message_id)
  where message_id is not null;

create index if not exists idx_discord_orchestration_messages_synced
  on discord_orchestration_messages(source_module, synced_at desc);

create table if not exists discord_orchestration_actions (
  id uuid primary key default gen_random_uuid(),
  interaction_id text null,
  idempotency_key text not null,
  guild_id text not null,
  channel_id text null,
  message_id text null,
  discord_user_id text not null,
  family_member_id text null references family_members(id) on delete set null,
  action text not null,
  source_module text null check (source_module is null or source_module in ('family_quests', 'tower_defense', 'family_events', 'member_sync')),
  source_id text null,
  status text not null check (status in ('received', 'succeeded', 'failed', 'ignored')),
  error_code text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists idx_discord_orchestration_actions_idempotency
  on discord_orchestration_actions(idempotency_key);

create unique index if not exists idx_discord_orchestration_actions_interaction
  on discord_orchestration_actions(interaction_id)
  where interaction_id is not null;

create index if not exists idx_discord_orchestration_actions_member
  on discord_orchestration_actions(family_member_id, created_at desc);

create index if not exists idx_discord_orchestration_actions_source
  on discord_orchestration_actions(source_module, source_id, created_at desc);
