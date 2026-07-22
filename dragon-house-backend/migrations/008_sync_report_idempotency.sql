alter table discord_sync_reports
  add column if not exists idempotency_key text null;

create unique index if not exists idx_discord_sync_reports_idempotency_key
  on discord_sync_reports(idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_family_audit_log_sync_run_id
  on family_audit_log ((metadata->>'syncRunId'))
  where metadata ? 'syncRunId';
