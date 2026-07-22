alter table family_members
  add column if not exists status text not null default 'active',
  add column if not exists avatar_asset_id text null,
  add column if not exists notes text null,
  add column if not exists joined_at timestamptz null,
  add column if not exists deleted_at timestamptz null,
  add column if not exists version integer not null default 1,
  add column if not exists created_by_family_member_id text null,
  add column if not exists updated_by_family_member_id text null,
  add column if not exists permissions_override jsonb not null default '[]'::jsonb,
  add column if not exists onboarding_metadata jsonb not null default '{}'::jsonb,
  add column if not exists profile_metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'family_members_status_check'
  ) then
    alter table family_members
      add constraint family_members_status_check check (status in ('active', 'inactive'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'family_members_version_positive_check'
  ) then
    alter table family_members
      add constraint family_members_version_positive_check check (version > 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'family_members_created_by_fk'
  ) then
    alter table family_members
      add constraint family_members_created_by_fk
      foreign key (created_by_family_member_id) references family_members(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'family_members_updated_by_fk'
  ) then
    alter table family_members
      add constraint family_members_updated_by_fk
      foreign key (updated_by_family_member_id) references family_members(id) on delete set null;
  end if;
end $$;

create unique index if not exists idx_family_members_static_id_lower_unique
  on family_members (lower(static_id));
create unique index if not exists idx_family_members_nickname_lower_unique
  on family_members (lower(nickname));
create index if not exists idx_family_members_status on family_members(status);
create index if not exists idx_family_members_role on family_members(role);
create index if not exists idx_family_members_joined_at on family_members(joined_at);
create index if not exists idx_family_members_deleted_at on family_members(deleted_at);

create table if not exists family_audit_log (
  id text primary key,
  actor_family_member_id text null references family_members(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_data jsonb null,
  after_data jsonb null,
  metadata jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists idx_family_audit_log_entity on family_audit_log(entity_type, entity_id, created_at desc);
create index if not exists idx_family_audit_log_actor on family_audit_log(actor_family_member_id, created_at desc);
