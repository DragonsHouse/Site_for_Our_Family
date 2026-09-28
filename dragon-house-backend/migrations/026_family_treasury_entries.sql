create table if not exists family_treasury_entries (
  id text primary key default gen_random_uuid()::text,
  category text not null check (category in ('fuel', 'clothing', 'weapons', 'shops', 'other')),
  title text not null check (length(trim(title)) > 0),
  location_number text null,
  location_reference text null,
  description text not null default '',
  price text null,
  note text null,
  is_active boolean not null default true,
  created_by_family_member_id text null references family_members(id) on delete set null,
  updated_by_family_member_id text null references family_members(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_family_treasury_entries_active_category
  on family_treasury_entries (is_active, category, updated_at desc);

insert into family_treasury_entries (
  id, category, title, location_number, description, price, note, created_at, updated_at
)
values
  ('fuel-21', 'fuel', 'Заправка №21', '21', 'Дешева заправка для сімейних поїздок.', null, 'Пріоритетне місце для економії на паливі.', '2026-07-07T00:00:00.000Z', '2026-07-07T00:00:00.000Z'),
  ('fuel-20', 'fuel', 'Заправка №20', '20', 'Альтернативна вигідна заправка.', null, null, '2026-07-07T00:00:00.000Z', '2026-07-07T00:00:00.000Z'),
  ('clothing-9-13', 'clothing', 'Одяг 9/13', '9/13', 'Одяг без націнки.', 'без націнки', null, '2026-07-07T00:00:00.000Z', '2026-07-07T00:00:00.000Z'),
  ('weapon-4-11', 'weapons', 'Зброя 4/11', '4/11', 'Зброя без націнки.', 'без націнки', null, '2026-07-07T00:00:00.000Z', '2026-07-07T00:00:00.000Z'),
  ('shop-29', 'shops', '№29', '29', 'Вигідна точка Dragon House.', null, null, '2026-07-07T00:00:00.000Z', '2026-07-07T00:00:00.000Z'),
  ('shop-151', 'shops', '№151', '151', 'Вигідна точка Dragon House.', null, null, '2026-07-07T00:00:00.000Z', '2026-07-07T00:00:00.000Z'),
  ('shop-44', 'shops', '№44', '44', 'Вигідна точка Dragon House.', null, null, '2026-07-07T00:00:00.000Z', '2026-07-07T00:00:00.000Z'),
  ('shop-130', 'shops', '№130', '130', 'Вигідна точка Dragon House.', null, null, '2026-07-07T00:00:00.000Z', '2026-07-07T00:00:00.000Z'),
  ('shop-45', 'shops', '№45', '45', 'Вигідна точка Dragon House.', null, null, '2026-07-07T00:00:00.000Z', '2026-07-07T00:00:00.000Z'),
  ('shop-30', 'shops', '№30', '30', 'Особливо вигідна точка Dragon House.', 'особливо вигідний', 'особливо вигідний', '2026-07-07T00:00:00.000Z', '2026-07-07T00:00:00.000Z'),
  ('shop-18-22', 'shops', '24/7 №18/22', '18/22', 'Магазин 24/7 без націнки.', 'без націнки', 'без націнки', '2026-07-07T00:00:00.000Z', '2026-07-07T00:00:00.000Z'),
  ('shop-19-22', 'shops', '24/7 №19/22', '19/22', 'Магазин 24/7 з вигідними лопатками.', 'лопатки по 5300', 'лопатки по 5300', '2026-07-07T00:00:00.000Z', '2026-07-07T00:00:00.000Z')
on conflict (id) do nothing;
