alter table discord_account_links
  add column if not exists discord_server_nickname text null,
  add column if not exists discord_avatar text null,
  add column if not exists guild_id text null,
  add column if not exists joined_at timestamptz null,
  add column if not exists left_at timestamptz null,
  add column if not exists last_synced_at timestamptz null,
  add column if not exists verified boolean not null default false;

update discord_account_links
set verified = true
where guild_member_verified = true and verified = false;

update discord_account_links
set discord_avatar = discord_avatar_url
where discord_avatar is null and discord_avatar_url is not null;

create table if not exists discord_role_mappings (
  discord_role_id text primary key,
  discord_role_name text not null,
  family_role text not null check (family_role in ('owner', 'deputy', 'moderator', 'member')),
  rank integer not null check (rank between 1 and 10),
  permissions jsonb not null default '[]'::jsonb,
  priority integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_discord_account_links_guild_id on discord_account_links(guild_id);
create index if not exists idx_discord_account_links_last_synced_at on discord_account_links(last_synced_at);
create index if not exists idx_discord_account_links_left_at on discord_account_links(left_at);
create index if not exists idx_discord_role_mappings_enabled_priority on discord_role_mappings(enabled, priority desc);
