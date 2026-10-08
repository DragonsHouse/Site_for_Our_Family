insert into family_members
  (id, nickname, static_id, role, rank, permissions, status, created_at, updated_at)
values
  (
    'system-accounting-migration-owner',
    'System Accounting Migration',
    'system-accounting-migration',
    'owner',
    10,
    '[]'::jsonb,
    'active',
    now(),
    now()
  )
on conflict (id) do nothing;
