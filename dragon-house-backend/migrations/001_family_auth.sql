create table if not exists family_members (
  id text primary key,
  nickname text not null unique,
  static_id text not null unique,
  role text not null check (role in ('owner', 'deputy', 'moderator', 'member')),
  rank integer not null check (rank between 1 and 10),
  permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column family_members.id is
  'Immutable internal Family Hub member ID. Never derive it from nickname, static_id, login, or Discord user ID.';
comment on column family_members.nickname is
  'Editable display/login-facing nickname; not a primary key and not a foreign-key target for domain history.';

create table if not exists family_auth_users (
  family_member_id text primary key references family_members(id) on delete cascade,
  login text not null unique,
  static_id text not null unique,
  password_hash text not null,
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  role text not null check (role in ('owner', 'deputy', 'moderator', 'member')),
  rank integer not null check (rank between 1 and 10),
  permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists family_sessions (
  session_id text primary key,
  family_member_id text not null references family_members(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz not null default now(),
  revoked_at timestamptz null
);

create table if not exists discord_account_links (
  family_member_id text primary key references family_members(id) on delete cascade,
  discord_user_id text not null unique,
  discord_username text not null,
  discord_global_name text null,
  discord_avatar_url text null,
  guild_member_verified boolean not null default false,
  linked_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists discord_oauth_states (
  state_id text primary key,
  family_member_id text not null references family_members(id) on delete cascade,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz null
);

create index if not exists idx_family_members_nickname_lower on family_members (lower(nickname));
create index if not exists idx_family_sessions_family_member_id on family_sessions(family_member_id);
create index if not exists idx_family_sessions_token_hash on family_sessions(token_hash);
create index if not exists idx_family_sessions_active on family_sessions(expires_at, revoked_at);
create index if not exists idx_discord_account_links_discord_user_id on discord_account_links(discord_user_id);
create index if not exists idx_discord_oauth_states_family_member_id on discord_oauth_states(family_member_id);
create index if not exists idx_discord_oauth_states_expires_at on discord_oauth_states(expires_at);
