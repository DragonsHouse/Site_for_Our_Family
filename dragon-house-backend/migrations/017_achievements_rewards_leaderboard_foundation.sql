create extension if not exists pgcrypto;

create table if not exists family_achievement_definitions (
  id uuid primary key default gen_random_uuid(),
  achievement_key text not null unique,
  name text not null,
  description text not null default '',
  category text not null
    check (category in ('quests', 'tower_defense', 'events', 'activity', 'leadership', 'streak', 'special')),
  icon text null,
  image_metadata jsonb not null default '{}'::jsonb,
  rarity text not null default 'common'
    check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic')),
  active boolean not null default true,
  repeatable boolean not null default false,
  hidden boolean not null default false,
  rule_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(image_metadata) = 'object'),
  check (jsonb_typeof(rule_metadata) = 'object')
);

create table if not exists family_member_achievements (
  id uuid primary key default gen_random_uuid(),
  family_member_id text not null references family_members(id) on delete restrict,
  achievement_id uuid not null references family_achievement_definitions(id) on delete restrict,
  source_module text not null
    check (source_module in ('quests', 'tower_defense', 'events', 'activity', 'leadership', 'streak', 'special', 'manual')),
  source_id text not null,
  source_key text not null,
  awarded_at timestamptz not null default now(),
  awarded_by_family_member_id text null references family_members(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  non_repeatable_member_key text null,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object')
);

create table if not exists family_reward_definitions (
  id uuid primary key default gen_random_uuid(),
  reward_key text not null unique,
  name text not null,
  description text not null default '',
  reward_type text not null check (reward_type in ('money', 'xp', 'item', 'badge', 'custom')),
  amount numeric(14,2) null check (amount is null or amount >= 0),
  value text null,
  currency text null,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object')
);

create table if not exists family_member_reward_grants (
  id uuid primary key default gen_random_uuid(),
  family_member_id text not null references family_members(id) on delete restrict,
  reward_id uuid not null references family_reward_definitions(id) on delete restrict,
  source_module text not null
    check (source_module in ('quests', 'tower_defense', 'events', 'achievements', 'activity', 'manual')),
  source_id text not null,
  source_key text not null,
  status text not null default 'earned' check (status in ('earned', 'approved', 'issued', 'cancelled')),
  granted_at timestamptz not null default now(),
  issued_at timestamptz null,
  issued_by_family_member_id text null references family_members(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object'),
  check ((status = 'issued') = (issued_at is not null) or status <> 'issued')
);

create unique index if not exists idx_family_member_achievements_source_key
  on family_member_achievements(source_key);
create unique index if not exists idx_family_member_achievements_non_repeatable
  on family_member_achievements(non_repeatable_member_key)
  where non_repeatable_member_key is not null;
create index if not exists idx_family_member_achievements_member_awarded
  on family_member_achievements(family_member_id, awarded_at desc);
create index if not exists idx_family_member_achievements_definition
  on family_member_achievements(achievement_id, awarded_at desc);
create index if not exists idx_family_member_achievements_source
  on family_member_achievements(source_module, source_id);

create unique index if not exists idx_family_member_reward_grants_source_key
  on family_member_reward_grants(source_key);
create index if not exists idx_family_member_reward_grants_member_status
  on family_member_reward_grants(family_member_id, status, granted_at desc);
create index if not exists idx_family_member_reward_grants_reward
  on family_member_reward_grants(reward_id, granted_at desc);
create index if not exists idx_family_member_reward_grants_source
  on family_member_reward_grants(source_module, source_id);

insert into family_achievement_definitions
  (achievement_key, name, description, category, icon, rarity, active, repeatable, hidden, rule_metadata)
values
  ('quest_first_completed', 'First Flight', 'Complete the first family quest and enter the shared chronicle.', 'quests', 'Flight', 'common', true, false, false, '{"rule":"quest_completed_count","threshold":1}'::jsonb),
  ('quest_best_participant', 'Best Participant', 'Be marked as the best participant in a family quest.', 'quests', 'Star', 'rare', true, true, false, '{"rule":"quest_best_participant","threshold":1}'::jsonb),
  ('tower_first_attended', 'Watchtower Initiate', 'Attend a completed Tower Defense operation.', 'tower_defense', 'Tower', 'common', true, false, false, '{"rule":"tower_attended_count","threshold":1}'::jsonb),
  ('tower_first_defended', 'Watchtower Guardian', 'Help defend a tower successfully.', 'tower_defense', 'Shield', 'rare', true, false, false, '{"rule":"tower_defended_count","threshold":1}'::jsonb),
  ('tower_commander', 'Tower Commander', 'Command a Tower Defense operation.', 'leadership', 'Command', 'rare', true, false, false, '{"rule":"tower_commanded_count","threshold":1}'::jsonb),
  ('event_first_attended', 'Council Voice', 'Attend a standalone family event.', 'events', 'Council', 'common', true, false, false, '{"rule":"event_attended_count","threshold":1}'::jsonb),
  ('event_organizer', 'Event Organizer', 'Organize a standalone family event.', 'leadership', 'Banner', 'rare', true, false, false, '{"rule":"event_organized_count","threshold":1}'::jsonb)
on conflict (achievement_key) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    icon = excluded.icon,
    rarity = excluded.rarity,
    active = excluded.active,
    repeatable = excluded.repeatable,
    hidden = excluded.hidden,
    rule_metadata = excluded.rule_metadata,
    updated_at = now();

insert into family_reward_definitions
  (reward_key, name, description, reward_type, amount, value, currency, metadata, active)
values
  ('quest_participation_xp_small', 'Quest Participation XP', 'XP reward grant for a completed quest contribution.', 'xp', 100, '100', null, '{"source":"family_quests"}'::jsonb, true),
  ('tower_defense_xp_small', 'Tower Defense XP', 'XP reward grant for Tower Defense participation.', 'xp', 100, '100', null, '{"source":"tower_defense"}'::jsonb, true),
  ('event_attendance_badge', 'Event Attendance Badge', 'Badge reward grant for attending a family event.', 'badge', null, 'event_attendee', null, '{"source":"family_events"}'::jsonb, true)
on conflict (reward_key) do update
set name = excluded.name,
    description = excluded.description,
    reward_type = excluded.reward_type,
    amount = excluded.amount,
    value = excluded.value,
    currency = excluded.currency,
    metadata = excluded.metadata,
    active = excluded.active,
    updated_at = now();
