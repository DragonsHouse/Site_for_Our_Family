create table family_assets (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  storage_provider text not null,
  storage_key text not null unique,
  original_filename text not null,
  content_type text not null check (content_type in ('image/png', 'image/jpeg', 'image/webp')),
  size_bytes bigint not null check (size_bytes > 0),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  width integer,
  height integer,
  created_by text references family_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  version integer not null default 1 check (version > 0)
);

create table family_asset_slot_assignments (
  slot text primary key,
  asset_id uuid not null references family_assets(id),
  assigned_by text references family_members(id) on delete set null,
  assigned_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  constraint family_asset_slot_phase1_check check (slot = 'quest_cleanup')
);

create index idx_family_assets_created_at on family_assets(created_at desc);
create index idx_family_asset_slot_assignments_asset on family_asset_slot_assignments(asset_id);
