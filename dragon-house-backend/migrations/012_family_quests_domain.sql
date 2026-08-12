create extension if not exists pgcrypto;

create table if not exists family_quest_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  title text not null,
  category text not null,
  description text null,
  steps jsonb not null default '[]'::jsonb,
  recommended_team_size integer not null default 1 check (recommended_team_size > 0),
  total_reward numeric(14,2) not null default 0 check (total_reward >= 0),
  member_reward_pool numeric(14,2) not null default 0 check (member_reward_pool >= 0),
  family_reward numeric(14,2) not null default 0 check (family_reward >= 0),
  reward_mode text not null default 'equal'
    check (reward_mode in ('equal', 'percentage', 'fixed', 'mixed', 'manual')),
  required_items text null,
  image_asset_id text null,
  is_active boolean not null default true,
  cooldown_hours integer not null default 24 check (cooldown_hours > 0),
  cooldown_until timestamptz null,
  created_by_family_member_id text null references family_members(id) on delete set null,
  updated_by_family_member_id text null references family_members(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(steps) = 'array'),
  check (member_reward_pool + family_reward <= total_reward)
);

create table if not exists family_quests (
  id uuid primary key default gen_random_uuid(),
  template_id uuid null references family_quest_templates(id) on delete set null,
  title text not null,
  description text not null default '',
  category text not null,
  status text not null default 'recruiting'
    check (status in (
      'recruiting',
      'scheduled',
      'active',
      'paused',
      'stopped',
      'completed',
      'reported',
      'sent_to_accounting',
      'paid',
      'cooldown'
    )),
  starts_at timestamptz null,
  ends_at timestamptz null,
  scheduled_at timestamptz null,
  organizer_family_member_id text null references family_members(id) on delete set null,
  total_reward numeric(14,2) not null default 0 check (total_reward >= 0),
  member_reward_pool numeric(14,2) not null default 0 check (member_reward_pool >= 0),
  family_reward numeric(14,2) not null default 0 check (family_reward >= 0),
  reward_mode text not null default 'equal'
    check (reward_mode in ('equal', 'percentage', 'fixed', 'mixed', 'manual')),
  required_items text null,
  best_participant_family_member_id text null references family_members(id) on delete set null,
  best_participant_reason text null,
  report_id uuid null,
  report_sent_to_accounting_at timestamptz null,
  paid_at timestamptz null,
  paid_by_family_member_id text null references family_members(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at),
  check (member_reward_pool + family_reward <= total_reward)
);

create table if not exists family_quest_people (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references family_quests(id) on delete cascade,
  family_member_id text null references family_members(id) on delete set null,
  display_name text not null,
  role text not null check (role in ('participant', 'helper')),
  joined_at timestamptz not null default now(),
  left_at timestamptz null,
  joined_late boolean not null default false,
  participation_note text null,
  added_manually boolean not null default false,
  added_by_family_member_id text null references family_members(id) on delete set null,
  reward_percent numeric(7,4) null check (reward_percent is null or reward_percent >= 0),
  reward_amount numeric(14,2) not null default 0 check (reward_amount >= 0),
  bonus_amount numeric(14,2) not null default 0 check (bonus_amount >= 0),
  bonus_percent numeric(7,4) not null default 0 check (bonus_percent >= 0),
  is_best_participant boolean not null default false,
  best_participant_reason text null,
  payout_status text not null default 'pending' check (payout_status in ('pending', 'paid', 'unpaid')),
  paid_at timestamptz null,
  paid_by_family_member_id text null references family_members(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (family_member_id is not null or length(trim(display_name)) > 0)
);

create unique index if not exists idx_family_quest_people_active_unique_member
  on family_quest_people(quest_id, family_member_id)
  where family_member_id is not null and left_at is null;

create table if not exists family_quest_rewards (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references family_quests(id) on delete cascade,
  template_id uuid null references family_quest_templates(id) on delete cascade,
  quest_person_id uuid null references family_quest_people(id) on delete set null,
  reward_type text not null check (reward_type in ('money', 'item', 'custom')),
  title text not null,
  amount numeric(14,2) null check (amount is null or amount >= 0),
  currency text null,
  quantity integer null check (quantity is null or quantity > 0),
  status text not null default 'prepared' check (status in ('planned', 'prepared', 'issued', 'cancelled')),
  issued_at timestamptz null,
  issued_by_family_member_id text null references family_members(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quest_id is not null or template_id is not null)
);

create table if not exists family_quest_reports (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null unique references family_quests(id) on delete cascade,
  title text not null,
  comment text null,
  confirmed_by_family_member_id text null references family_members(id) on delete set null,
  total_reward numeric(14,2) not null default 0 check (total_reward >= 0),
  member_reward_pool numeric(14,2) not null default 0 check (member_reward_pool >= 0),
  family_reward numeric(14,2) not null default 0 check (family_reward >= 0),
  transferred_to_accounting_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table family_quests
  add constraint family_quests_report_fk
  foreign key (report_id) references family_quest_reports(id) on delete set null
  not valid;

create table if not exists family_quest_payouts (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references family_quests(id) on delete cascade,
  report_id uuid null references family_quest_reports(id) on delete cascade,
  quest_person_id uuid null references family_quest_people(id) on delete set null,
  family_member_id text null references family_members(id) on delete set null,
  display_name text not null,
  amount numeric(14,2) not null default 0 check (amount >= 0),
  reward_percent numeric(7,4) null check (reward_percent is null or reward_percent >= 0),
  reward_items jsonb not null default '[]'::jsonb,
  bonus_amount numeric(14,2) not null default 0 check (bonus_amount >= 0),
  bonus_percent numeric(7,4) not null default 0 check (bonus_percent >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'unpaid')),
  paid_at timestamptz null,
  paid_by_family_member_id text null references family_members(id) on delete set null,
  payout_event_key text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(reward_items) = 'array')
);

create table if not exists family_quest_audit (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references family_quests(id) on delete cascade,
  actor_family_member_id text null references family_members(id) on delete set null,
  action text not null,
  comment text null,
  previous_status text null,
  new_status text null,
  related_family_member_id text null references family_members(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_family_quest_templates_active on family_quest_templates(is_active, updated_at desc);
create index if not exists idx_family_quests_status on family_quests(status, updated_at desc);
create index if not exists idx_family_quests_template_id on family_quests(template_id);
create index if not exists idx_family_quests_starts_at on family_quests(starts_at);
create index if not exists idx_family_quest_people_quest on family_quest_people(quest_id, role);
create index if not exists idx_family_quest_rewards_quest on family_quest_rewards(quest_id);
create index if not exists idx_family_quest_reports_quest on family_quest_reports(quest_id);
create index if not exists idx_family_quest_payouts_quest on family_quest_payouts(quest_id);
create index if not exists idx_family_quest_audit_quest on family_quest_audit(quest_id, created_at desc);

insert into family_quest_templates
  (id, template_key, title, category, description, steps, recommended_team_size,
   total_reward, member_reward_pool, family_reward, reward_mode, required_items,
   image_asset_id, cooldown_hours, metadata)
values
  ('00000000-0000-4000-8000-000000000101', 'help-citizens', 'Допомога громадянам', 'Громадський',
   'Продаж хот-догів і допомога новим гравцям.',
   '["Продати 100 хот-догів", "Передати гроші новим гравцям"]'::jsonb, 2,
   700000, 700000, 0, 'equal', null, 'quest_help_citizens', 24, '{"seed":"frontend-default"}'::jsonb),
  ('00000000-0000-4000-8000-000000000102', 'subotnyk', 'Суботник', 'Громадський',
   'Знайти сміттєві пакети в жовтій зоні.',
   '["Знайти всі сміттєві пакети в 5 зонах"]'::jsonb, 4,
   900000, 900000, 0, 'equal', null, 'quest_cleanup', 24, '{"seed":"frontend-default"}'::jsonb),
  ('00000000-0000-4000-8000-000000000103', 'hunting-season', 'Мисливський сезон', 'Бізнес',
   'Продати шкури скупнику на ринку.',
   '["Продати 250 шкур скупнику на ринку"]'::jsonb, 3,
   400000, 400000, 0, 'equal', null, 'quest_hunting', 24, '{"seed":"frontend-default"}'::jsonb),
  ('00000000-0000-4000-8000-000000000104', 'forest-trophies', 'Лісові трофеї', 'Бізнес',
   'Зібрати й продати лісові ресурси в правильному порядку.',
   '["Зібрати 500 печериць", "Зібрати 400 грибів", "Продати ресурси"]'::jsonb, 2,
   600000, 600000, 0, 'equal', null, 'quest_forest_trophies', 24, '{"seed":"frontend-default"}'::jsonb),
  ('00000000-0000-4000-8000-000000000105', 'woodcutter-call', 'Заклик лісоруба', 'Бізнес',
   'Зібрати й продати деревину в правильному порядку.',
   '["Зібрати соснові колоди", "Зібрати дубові колоди", "Продати деревину"]'::jsonb, 2,
   400000, 400000, 0, 'equal', null, 'quest_lumberjack', 24, '{"seed":"frontend-default"}'::jsonb),
  ('00000000-0000-4000-8000-000000000106', 'cargo-boom', 'Товарний вибух', 'Бізнес',
   'Перевезти продукти на сімейних машинах.',
   '["Перевезти 1000 кг продуктів"]'::jsonb, 4,
   700000, 700000, 0, 'equal', null, 'quest_goods_explosion', 24, '{"seed":"frontend-default"}'::jsonb),
  ('00000000-0000-4000-8000-000000000107', 'fish-day', 'Рибний день', 'Бізнес',
   'Наловити рибу командою.',
   '["Наловити 2000 риб"]'::jsonb, 10,
   700000, 700000, 0, 'equal', 'Вудка, прикормка, човен', 'quest_fishing', 24, '{"seed":"frontend-default"}'::jsonb),
  ('00000000-0000-4000-8000-000000000108', 'guardians', 'Вартові свого', 'Бойовий',
   'Захистити території у війні сімей.',
   '["Захистити 2 території у війні сімей"]'::jsonb, 8,
   750000, 750000, 0, 'equal', null, 'quest_guardians', 24, '{"seed":"frontend-default"}'::jsonb),
  ('00000000-0000-4000-8000-000000000109', 'blood-power', 'Влада через кров', 'Бойовий',
   'Здобути перемоги у війні сімей.',
   '["Здобути 3 перемоги у війні сімей"]'::jsonb, 8,
   1000000, 1000000, 0, 'equal', null, 'quest_blood_power', 24, '{"seed":"frontend-default"}'::jsonb),
  ('00000000-0000-4000-8000-000000000110', 'fuel-progress', 'Паливо прогресу', 'Бізнес',
   'Видобути паливо для сімейного банку.',
   '["Видобути паливо 500 разів на нафтокачці"]'::jsonb, 6,
   400000, 400000, 0, 'equal', '6 бочок з паливом', 'quest_fuel_progress', 24, '{"seed":"frontend-default"}'::jsonb),
  ('00000000-0000-4000-8000-000000000111', 'mining-work', 'Шахтарська справа', 'Бізнес',
   'Видобути руду командою.',
   '["Видобути залізо", "Видобути мідь", "Видобути срібло"]'::jsonb, 6,
   600000, 600000, 0, 'equal', null, 'quest_mining', 24, '{"seed":"frontend-default"}'::jsonb)
on conflict (template_key) do nothing;
