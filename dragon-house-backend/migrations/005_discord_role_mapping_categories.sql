alter table discord_role_mappings
  add column if not exists mapping_type text not null default 'primary_hierarchy',
  add column if not exists grants_permissions boolean not null default true,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table discord_role_mappings
  alter column family_role drop not null,
  alter column rank drop not null;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'discord_role_mappings'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%family_role%'
  loop
    execute format('alter table discord_role_mappings drop constraint if exists %I', constraint_name);
  end loop;

  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'discord_role_mappings'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%rank%'
  loop
    execute format('alter table discord_role_mappings drop constraint if exists %I', constraint_name);
  end loop;
end $$;

alter table discord_role_mappings
  add constraint discord_role_mappings_mapping_type_check
    check (mapping_type in ('primary_hierarchy', 'additional_functional', 'ignored')),
  add constraint discord_role_mappings_family_role_check
    check (family_role is null or family_role in ('owner', 'deputy', 'moderator', 'member')),
  add constraint discord_role_mappings_rank_check
    check (rank is null or rank between 1 and 10),
  add constraint discord_role_mappings_primary_requires_rank_check
    check (
      mapping_type <> 'primary_hierarchy'
      or (family_role is not null and rank is not null)
    ),
  add constraint discord_role_mappings_ignored_grants_nothing_check
    check (
      mapping_type <> 'ignored'
      or (grants_permissions = false and permissions = '[]'::jsonb)
    );

create index if not exists idx_discord_role_mappings_type_priority
  on discord_role_mappings(mapping_type, enabled, priority desc);
