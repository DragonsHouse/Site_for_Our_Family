create table if not exists family_map_state (
  id text primary key,
  points jsonb not null default '[]'::jsonb,
  zones jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  updated_by_family_member_id text references family_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint family_map_state_points_array_check check (jsonb_typeof(points) = 'array'),
  constraint family_map_state_zones_array_check check (jsonb_typeof(zones) = 'array'),
  constraint family_map_state_version_positive_check check (version > 0)
);

insert into family_map_state (id, points, zones)
values ('dragon-house-shared-map', '[]'::jsonb, '[]'::jsonb)
on conflict (id) do nothing;

create index if not exists idx_family_map_state_updated_at on family_map_state(updated_at desc);
