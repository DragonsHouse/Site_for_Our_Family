create table if not exists family_content_blocks (
  id text primary key,
  scope text not null check (scope in ('home', 'rules', 'recruitment')),
  title text not null check (length(trim(title)) > 0),
  body text not null default '',
  contact text null,
  sort_order integer not null default 0,
  version integer not null default 1 check (version > 0),
  updated_by_family_member_id text null references family_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_family_content_blocks_scope_order
  on family_content_blocks(scope, sort_order, id);

insert into family_content_blocks (id, scope, title, body, contact, sort_order, created_at, updated_at)
values
  (
    'home-intro',
    'home',
    'Внутрішній штаб сім’ї',
    'Лігво Dragon House: новини, квести, скарбниця, учасники, набір, ранги, премії та керування внутрішніми процесами.',
    'Dragon House',
    10,
    '2026-07-07T00:00:00.000Z',
    '2026-07-07T00:00:00.000Z'
  ),
  (
    'home-alert',
    'home',
    'Важливо',
    'Премії, квести, виплати й набір ведуться через Family Hub. Discord допомагає координувати, але не замінює backend-рішення.',
    'Anastasia_Dragons',
    20,
    '2026-07-07T00:00:00.000Z',
    '2026-07-07T00:00:00.000Z'
  ),
  (
    'recruitment-info',
    'recruitment',
    'Набір у Dragon House',
    'Dragon House приймає активних гравців, які поважають сім’ю, дисципліну та внутрішні правила лігва.',
    'Anastasia_Dragons / Marcel_Dragons',
    10,
    '2026-07-07T00:00:00.000Z',
    '2026-07-07T00:00:00.000Z'
  ),
  (
    'family-rule-honor',
    'rules',
    'I. Честь і поведінка',
    'Заборонені образи, токсичність і приниження членів сім’ї.
Внутрішні конфлікти не виносяться назовні.
Дракони поважають своїх навіть у гніві.',
    null,
    10,
    '2026-07-07T00:00:00.000Z',
    '2026-07-07T00:00:00.000Z'
  ),
  (
    'family-rule-order',
    'rules',
    'II. Порядок у лігві',
    'Кожен канал використовується за призначенням.
Спам, флуд і хаос у робочих зонах гасяться одразу.
Рішення керівництва фіксуються в Hub.',
    null,
    20,
    '2026-07-07T00:00:00.000Z',
    '2026-07-07T00:00:00.000Z'
  ),
  (
    'family-rule-accounting',
    'rules',
    'III. Скарбниця і виплати',
    'Сімейний фонд, премії та виплати проходять через backend accounting flow.
Discord-повідомлення можуть бути підказкою або джерелом контексту, але не є підтвердженою оплатою.
Ніхто не переписує виплати мовчки.',
    null,
    30,
    '2026-07-07T00:00:00.000Z',
    '2026-07-07T00:00:00.000Z'
  )
on conflict (id) do nothing;

create table if not exists family_recruitment_settings (
  id text primary key default 'dragon-house',
  is_open boolean not null default true,
  description text not null default '',
  requirements jsonb not null default '[]'::jsonb,
  contact text not null default '',
  version integer not null default 1 check (version > 0),
  updated_by_family_member_id text null references family_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (id = 'dragon-house'),
  check (jsonb_typeof(requirements) = 'array')
);

insert into family_recruitment_settings (
  id, is_open, description, requirements, contact, created_at, updated_at
)
values (
  'dragon-house',
  true,
  'Dragon House приймає активних гравців, які поважають сім’ю, дисципліну та внутрішні правила лігва.',
  '[
    "Адекватна поведінка",
    "Готовність брати участь у сімейних активностях",
    "Зміна прізвища на Dragons після прийняття",
    "Без токсичності й зливу внутрішньої інформації",
    "Для рекрутерів і HR: ввічлива комунікація та передача кандидатів старшим"
  ]'::jsonb,
  'Anastasia_Dragons / Marcel_Dragons',
  '2026-07-07T00:00:00.000Z',
  '2026-07-07T00:00:00.000Z'
)
on conflict (id) do nothing;

create table if not exists family_news_posts (
  id text primary key default gen_random_uuid()::text,
  type text not null check (type in ('urgent', 'important', 'family_news', 'announcement', 'recruitment', 'poll', 'family', 'event', 'info')),
  title text not null check (length(trim(title)) > 0),
  body text not null check (length(trim(body)) > 0),
  author_family_member_id text null references family_members(id) on delete set null,
  author_name text not null default 'Dragon House',
  pinned boolean not null default false,
  urgent boolean not null default false,
  notification_required boolean not null default false,
  archived_at timestamptz null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_family_news_posts_visible
  on family_news_posts(archived_at, pinned desc, created_at desc);

insert into family_news_posts (
  id, type, title, body, author_name, pinned, urgent, notification_required, created_at, updated_at
)
values
  (
    'post-dragon-hub-launch',
    'urgent',
    'Dragon House Family Hub переходить у штабний режим',
    'Перевіряємо кабінети, ролі, ранги та доступи. Усі важливі сімейні матеріали збираються тут.',
    'Anastasia_Dragons',
    true,
    true,
    true,
    '2026-07-07T12:00:00.000Z',
    '2026-07-07T12:00:00.000Z'
  ),
  (
    'post-economy-base',
    'important',
    'Скарбниця тепер зберігає вигідні місця',
    'Заправки, магазини, одяг і зброя без націнки винесені в окрему базу знань.',
    'Marcel_Dragons',
    true,
    false,
    false,
    '2026-07-07T13:00:00.000Z',
    '2026-07-07T13:00:00.000Z'
  ),
  (
    'post-rank-model',
    'family_news',
    'Підготовлено модель рангів Dragon House',
    'Прогрес підвищення тепер рахується за структурованими вимогами, а не простими текстовими рядками.',
    'Anastasia_Dragons',
    false,
    false,
    false,
    '2026-07-07T14:00:00.000Z',
    '2026-07-07T14:00:00.000Z'
  )
on conflict (id) do nothing;
