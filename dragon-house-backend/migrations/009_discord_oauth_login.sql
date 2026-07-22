begin;

alter table discord_oauth_states
  alter column family_member_id drop not null;

alter table discord_oauth_states
  add column if not exists purpose text not null default 'account_link',
  add column if not exists client_type text,
  add column if not exists redirect_target text,
  add column if not exists code_verifier text,
  add column if not exists environment text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'discord_oauth_states_purpose_check'
  ) then
    alter table discord_oauth_states
      add constraint discord_oauth_states_purpose_check
      check (purpose in ('account_link', 'login'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'discord_oauth_states_client_type_check'
  ) then
    alter table discord_oauth_states
      add constraint discord_oauth_states_client_type_check
      check (client_type is null or client_type in ('web', 'chrome_extension'));
  end if;
end $$;

alter table family_sessions
  add column if not exists login_provider text not null default 'password',
  add column if not exists revoked_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'family_sessions_login_provider_check'
  ) then
    alter table family_sessions
      add constraint family_sessions_login_provider_check
      check (login_provider in ('password', 'discord'));
  end if;
end $$;

create table if not exists discord_login_completions (
  code_hash text primary key,
  state_id text not null references discord_oauth_states(state_id) on delete cascade,
  family_member_id text not null references family_members(id) on delete cascade,
  client_type text not null check (client_type in ('web', 'chrome_extension')),
  redirect_target text not null,
  environment text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create index if not exists idx_discord_oauth_states_purpose_expires_at
  on discord_oauth_states(purpose, expires_at);

create index if not exists idx_discord_login_completions_family_member_id
  on discord_login_completions(family_member_id);

create index if not exists idx_discord_login_completions_expires_at
  on discord_login_completions(expires_at);

create index if not exists idx_family_sessions_login_provider
  on family_sessions(login_provider, created_at desc);

commit;
