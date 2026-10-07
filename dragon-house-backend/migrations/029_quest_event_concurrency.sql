alter table family_quest_templates
  add column if not exists version integer not null default 1 check (version > 0);

alter table family_quests
  add column if not exists version integer not null default 1 check (version > 0);

alter table family_events
  add column if not exists version integer not null default 1 check (version > 0);

create index if not exists idx_family_quest_templates_version on family_quest_templates(id, version);
create index if not exists idx_family_quests_version on family_quests(id, version);
create index if not exists idx_family_events_version on family_events(id, version);
