import type pg from 'pg';
import type { DiscordSyncApplyResult, DiscordSyncAuditRecord, DiscordSyncPlan } from './sync-engine-models.js';

type SyncReportRow = {
  id: string;
  mode: 'dry_run' | 'apply';
  status: 'succeeded' | 'failed';
  report: Record<string, unknown>;
  created_at: Date;
};

export interface DiscordSyncAuditRepository {
  saveDryRunPlan(plan: DiscordSyncPlan, initiatedByMemberId: string | null): Promise<void>;
  saveApplyResult(result: DiscordSyncApplyResult, initiatedByMemberId: string | null): Promise<void>;
  getPlan(planId: string): Promise<DiscordSyncPlan | null>;
  hasAppliedPlan(planId: string): Promise<boolean>;
  listHistory(limit?: number): Promise<DiscordSyncAuditRecord[]>;
  getAuditRecord(auditId: string): Promise<DiscordSyncAuditRecord | null>;
  getLatestSuccessfulApply(): Promise<DiscordSyncAuditRecord | null>;
}

export class InMemoryDiscordSyncAuditRepository implements DiscordSyncAuditRepository {
  private readonly reports = new Map<string, SyncReportRow>();

  async saveDryRunPlan(plan: DiscordSyncPlan, initiatedByMemberId: string | null): Promise<void> {
    this.reports.set(plan.planId, {
      id: plan.planId,
      mode: 'dry_run',
      status: 'succeeded',
      report: { ...plan, initiatedByMemberId },
      created_at: new Date(plan.generatedAt),
    });
  }

  async saveApplyResult(result: DiscordSyncApplyResult, initiatedByMemberId: string | null): Promise<void> {
    this.reports.set(result.syncRunId, {
      id: result.syncRunId,
      mode: 'apply',
      status: result.status,
      report: { ...result, initiatedByMemberId },
      created_at: new Date(result.appliedAt),
    });
  }

  async getPlan(planId: string): Promise<DiscordSyncPlan | null> {
    const row = this.reports.get(planId);
    return row?.mode === 'dry_run' ? normalizeStoredPlan(row.report) : null;
  }

  async hasAppliedPlan(planId: string): Promise<boolean> {
    return [...this.reports.values()].some((row) => row.mode === 'apply' && reportPlanId(row.report) === planId);
  }

  async listHistory(limit = 20): Promise<DiscordSyncAuditRecord[]> {
    return [...this.reports.values()]
      .sort((left, right) => right.created_at.getTime() - left.created_at.getTime())
      .slice(0, limit)
      .map(toAuditRecord);
  }

  async getAuditRecord(auditId: string): Promise<DiscordSyncAuditRecord | null> {
    const row = this.reports.get(auditId);
    return row ? toAuditRecord(row) : null;
  }

  async getLatestSuccessfulApply(): Promise<DiscordSyncAuditRecord | null> {
    const rows = await this.listHistory(100);
    return rows.find((row) => row.mode === 'apply' && row.status === 'succeeded') ?? null;
  }
}

export class PgDiscordSyncAuditRepository implements DiscordSyncAuditRepository {
  constructor(private readonly pool: pg.Pool) {}

  async saveDryRunPlan(plan: DiscordSyncPlan, initiatedByMemberId: string | null): Promise<void> {
    await this.pool.query(
      `insert into discord_sync_reports (id, mode, status, report)
       values ($1, 'dry_run', 'succeeded', $2)
       on conflict (id) do update
       set report = excluded.report,
           created_at = now()`,
      [plan.planId, JSON.stringify({ ...plan, initiatedByMemberId })],
    );
  }

  async saveApplyResult(result: DiscordSyncApplyResult, initiatedByMemberId: string | null): Promise<void> {
    await this.pool.query(
      `insert into discord_sync_reports (id, mode, status, report)
       values ($1, 'apply', $2, $3)
       on conflict (id) do nothing`,
      [result.syncRunId, result.status, JSON.stringify({ ...result, initiatedByMemberId })],
    );
  }

  async getPlan(planId: string): Promise<DiscordSyncPlan | null> {
    const query = await this.pool.query<{ report: Record<string, unknown> }>(
      `select report from discord_sync_reports
       where id = $1 and mode = 'dry_run'
       limit 1`,
      [planId],
    );
    return query.rows[0]?.report ? normalizeStoredPlan(query.rows[0].report) : null;
  }

  async hasAppliedPlan(planId: string): Promise<boolean> {
    const query = await this.pool.query<{ exists: boolean }>(
      `select exists (
         select 1 from discord_sync_reports
         where mode = 'apply'
           and (
             report->>'planId' = $1
             or report #>> '{applyRequest,planId}' = $1
           )
       ) as exists`,
      [planId],
    );
    return query.rows[0]?.exists ?? false;
  }

  async listHistory(limit = 20): Promise<DiscordSyncAuditRecord[]> {
    const query = await this.pool.query<SyncReportRow>(
      `select id, mode, status, report, created_at
       from discord_sync_reports
       order by created_at desc
       limit $1`,
      [limit],
    );
    return query.rows.map(toAuditRecord);
  }

  async getAuditRecord(auditId: string): Promise<DiscordSyncAuditRecord | null> {
    const query = await this.pool.query<SyncReportRow>(
      `select id, mode, status, report, created_at
       from discord_sync_reports
       where id = $1
       limit 1`,
      [auditId],
    );
    return query.rows[0] ? toAuditRecord(query.rows[0]) : null;
  }

  async getLatestSuccessfulApply(): Promise<DiscordSyncAuditRecord | null> {
    const query = await this.pool.query<SyncReportRow>(
      `select id, mode, status, report, created_at
       from discord_sync_reports
       where mode = 'apply' and status = 'succeeded'
       order by created_at desc
       limit 1`,
    );
    return query.rows[0] ? toAuditRecord(query.rows[0]) : null;
  }
}

function normalizeStoredPlan(report: Record<string, unknown>): DiscordSyncPlan {
  return report as unknown as DiscordSyncPlan;
}

function toAuditRecord(row: SyncReportRow): DiscordSyncAuditRecord {
  const report = row.report;
  const mode = row.mode === 'dry_run' ? 'dry-run' : 'apply';
  const planId = reportPlanId(report);
  const summary = report.summary;
  const counts = isRecord(summary) ? numberRecord(summary) : {};
  const dryRun = isRecord(report.dryRun) ? report.dryRun : null;
  const rawDryRun = isRecord(report.rawDryRun) ? report.rawDryRun : dryRun;
  const guildId = stringOrNull(report.guildId) ?? (isRecord(rawDryRun) ? stringOrNull(rawDryRun.guildId) : null);
  const completedAt = stringOrNull(report.appliedAt) ?? stringOrNull(report.generatedAt) ?? row.created_at.toISOString();
  const conflicts = Array.isArray(report.conflicts) ? report.conflicts : [];
  const snapshotMetadata = {
    fingerprint: stringOrNull(report.snapshotFingerprint) ?? (isRecord(rawDryRun) ? stringOrNull(rawDryRun.planHash) : null),
    generatedAt: stringOrNull(report.generatedAt),
  };

  return {
    auditId: row.id,
    planId,
    guildId,
    initiatedByMemberId: stringOrNull(report.initiatedByMemberId),
    startedAt: row.created_at.toISOString(),
    completedAt,
    mode,
    status: row.status,
    counts,
    conflicts,
    appliedCreates: numberValue(report.created, 'length') ?? numberValue(counts, 'created') ?? numberValue(counts, 'create') ?? 0,
    appliedUpdates: numberValue(report.updated, 'length') ?? numberValue(counts, 'updated') ?? numberValue(counts, 'update') ?? 0,
    appliedDeactivations: numberValue(report.deactivated, 'length') ?? numberValue(counts, 'inactive') ?? numberValue(counts, 'deactivate') ?? 0,
    skippedItems: numberValue(report.skipped, 'length') ?? numberValue(counts, 'skipped') ?? 0,
    failures: numberValue(counts, 'errors') ?? 0,
    snapshotMetadata,
    applicationStatus: stringOrNull(report.status) ?? row.status,
    errorSummary: Array.isArray(report.errors) && report.errors.length ? String(report.errors[0]) : null,
  };
}

function reportPlanId(report: Record<string, unknown>): string | null {
  const applyRequest = isRecord(report.applyRequest) ? report.applyRequest : null;
  return stringOrNull(report.planId) ?? (applyRequest ? stringOrNull(applyRequest.planId) : null);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberRecord(value: Record<string, unknown>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
  );
}

function numberValue(value: unknown, property: string): number | null {
  if (Array.isArray(value) && property === 'length') return value.length;
  if (!isRecord(value)) return null;
  return typeof value[property] === 'number' ? value[property] : null;
}
