-- Forward-only hardening for Discord-imported tower defenses.
-- External Discord tower cards do not always contain a trusted commander identity,
-- so the domain must allow an unknown commander instead of inventing one.

alter table family_tower_defenses
  alter column commander_family_member_id drop not null;
