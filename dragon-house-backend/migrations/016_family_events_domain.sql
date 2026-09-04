create extension if not exists pgcrypto;

create table if not exists family_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  event_type text not null
    check (event_type in ('family_meeting', 'training', 'rp_event', 'family_activity', 'celebration', 'announcement', 'custom')),
  category text not null default 'custom'
    check (category in ('meeting', 'training', 'rp', 'family', 'celebration', 'announcement', 'custom')),
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'active', 'completed', 'cancelled')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'critical')),
  starts_at timestamptz not null,
  ends_at timestamptz null,
  timezone text not null default 'Europe/Kiev',
  all_day boolean not null default false,
  location_label text null,
  created_by_family_member_id text not null references family_members(id) on delete restrict,
  organizer_family_member_id text not null references family_members(id) on delete restrict,
  max_participants integer null check (max_participants is null or max_participants > 0),
  visibility text not null default 'members'
    check (visibility in ('public', 'members', 'leadership', 'private', 'hidden')),
  notes text null,
  completed_by_family_member_id text null references family_members(id) on delete set null,
  completed_at timestamptz null,
  cancelled_by_family_member_id text null references family_members(id) on delete set null,
  cancelled_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(title)) > 0),
  check (ends_at is null or ends_at >= starts_at),
  check (jsonb_typeof(metadata) = 'object')
);

create index if not exists idx_family_events_status_starts
  on family_events(status, starts_at desc);
create index if not exists idx_family_events_category_starts
  on family_events(category, starts_at desc);
create index if not exists idx_family_events_type_starts
  on family_events(event_type, starts_at desc);
create index if not exists idx_family_events_organizer_starts
  on family_events(organizer_family_member_id, starts_at desc);
create index if not exists idx_family_events_visibility
  on family_events(visibility, starts_at desc);

create table if not exists family_event_responses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references family_events(id) on delete cascade,
  family_member_id text not null references family_members(id) on delete cascade,
  response text not null default 'invited'
    check (response in ('invited', 'interested', 'joining', 'confirmed', 'declined')),
  responded_at timestamptz not null default now(),
  note text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists idx_family_event_responses_event_member
  on family_event_responses(event_id, family_member_id);
create index if not exists idx_family_event_responses_member
  on family_event_responses(family_member_id, responded_at desc);
create index if not exists idx_family_event_responses_response
  on family_event_responses(response, responded_at desc);

create table if not exists family_event_attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references family_events(id) on delete cascade,
  family_member_id text not null references family_members(id) on delete cascade,
  status text not null
    check (status in ('present', 'late', 'absent', 'excused')),
  confirmed_by_family_member_id text not null references family_members(id) on delete restrict,
  confirmed_at timestamptz not null default now(),
  note text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists idx_family_event_attendance_event_member
  on family_event_attendance(event_id, family_member_id);
create index if not exists idx_family_event_attendance_member
  on family_event_attendance(family_member_id, confirmed_at desc);
create index if not exists idx_family_event_attendance_status
  on family_event_attendance(status, confirmed_at desc);
