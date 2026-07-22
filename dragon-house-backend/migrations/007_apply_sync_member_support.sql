alter table family_members
  alter column static_id drop not null;

create table if not exists discord_sync_reports (
  id text primary key,
  mode text not null check (mode in ('dry_run', 'apply')),
  status text not null check (status in ('succeeded', 'failed')),
  report jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_discord_sync_reports_created_at
  on discord_sync_reports(created_at desc);

comment on column family_members.static_id is
  'Nullable GTA Static ID. Discord sync does not populate it; manual/game/API sources may set it later.';
