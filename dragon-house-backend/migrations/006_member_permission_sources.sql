alter table family_members
  add column if not exists permissions_discord jsonb not null default '[]'::jsonb,
  add column if not exists permissions_denied jsonb not null default '[]'::jsonb;

update family_members
set permissions_override = permissions
where permissions_override = '[]'::jsonb
  and permissions <> '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'family_members_permissions_discord_array_check'
  ) then
    alter table family_members
      add constraint family_members_permissions_discord_array_check
      check (jsonb_typeof(permissions_discord) = 'array');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'family_members_permissions_denied_array_check'
  ) then
    alter table family_members
      add constraint family_members_permissions_denied_array_check
      check (jsonb_typeof(permissions_denied) = 'array');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'family_members_permissions_override_array_check'
  ) then
    alter table family_members
      add constraint family_members_permissions_override_array_check
      check (jsonb_typeof(permissions_override) = 'array');
  end if;
end $$;

comment on column family_members.permissions is
  'Effective permissions currently used by Family Hub authorization.';
comment on column family_members.permissions_override is
  'Manual permission grants that must survive Discord synchronization.';
comment on column family_members.permissions_discord is
  'Permissions last granted by Discord role synchronization.';
comment on column family_members.permissions_denied is
  'Manual permission denials applied after system, Discord, and manual grants.';
