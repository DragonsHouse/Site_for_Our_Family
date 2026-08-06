begin;

alter table family_sessions
  drop constraint if exists family_sessions_login_provider_check;

alter table family_sessions
  add constraint family_sessions_login_provider_check
  check (login_provider in ('password', 'discord', 'nickname'));

commit;
