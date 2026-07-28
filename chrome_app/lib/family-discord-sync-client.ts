import { authenticatedFetch } from './family-backend-auth-client.ts';
import type {
  DiscordRoleSnapshot,
  DiscordSyncApplyResult,
  DiscordSyncAuditRecord,
  DiscordSyncIntegrationStatus,
  DiscordSyncPlan
} from './family-discord-sync-types.ts';

export type FamilyDiscordSyncClient = {
  getStatus(): Promise<DiscordSyncIntegrationStatus>;
  generateDryRunPlan(): Promise<DiscordSyncPlan>;
  getPlan(planId: string): Promise<DiscordSyncPlan>;
  applyPlan(planId: string, idempotencyKey: string): Promise<DiscordSyncApplyResult>;
  getHistory(): Promise<DiscordSyncAuditRecord[]>;
  getAuditRecord(auditId: string): Promise<DiscordSyncAuditRecord>;
  getRoleMappings(): Promise<DiscordRoleSnapshot[]>;
};

export class FamilyDiscordSyncClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'FamilyDiscordSyncClientError';
    this.status = status;
    this.code = code;
  }
}

export function createFamilyDiscordSyncClient(fetcher = authenticatedFetch): FamilyDiscordSyncClient {
  return {
    getStatus: () => getJson<DiscordSyncIntegrationStatus>('/api/discord/sync/status', fetcher),
    generateDryRunPlan: () => postJson<DiscordSyncPlan>('/api/discord/sync/plans', undefined, fetcher),
    getPlan: (planId) => getJson<DiscordSyncPlan>(`/api/discord/sync/plans/${encodeURIComponent(planId)}`, fetcher),
    applyPlan: (planId, idempotencyKey) =>
      postJson<DiscordSyncApplyResult>(
        `/api/discord/sync/plans/${encodeURIComponent(planId)}/apply`,
        { confirm: true, idempotencyKey },
        fetcher
      ),
    getHistory: () => getJson<DiscordSyncAuditRecord[]>('/api/discord/sync/history', fetcher),
    getAuditRecord: (auditId) => getJson<DiscordSyncAuditRecord>(`/api/discord/sync/history/${encodeURIComponent(auditId)}`, fetcher),
    getRoleMappings: () => getJson<DiscordRoleSnapshot[]>('/api/discord/sync/role-mappings', fetcher)
  };
}

async function getJson<T>(path: string, fetcher: typeof authenticatedFetch): Promise<T> {
  const response = await fetcher(path, { method: 'GET', headers: { Accept: 'application/json' } });
  return parseResponse<T>(response);
}

async function postJson<T>(path: string, body: unknown, fetcher: typeof authenticatedFetch): Promise<T> {
  const response = await fetcher(path, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return parseResponse<T>(response);
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.ok) return (await response.json()) as T;
  let body: { error?: string; message?: string } = {};
  try {
    body = (await response.json()) as typeof body;
  } catch {
    body = {};
  }
  throw new FamilyDiscordSyncClientError(
    response.status,
    body.error ?? 'discord_sync_request_failed',
    body.message ?? `Discord sync request failed: ${response.status}`
  );
}
