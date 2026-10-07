import { authenticatedFetch } from './family-backend-auth-client.ts';

export type FamilyAuditLogRecord = {
  id: string;
  actorFamilyMemberId: string | null;
  actorType: 'user' | 'system' | 'discord';
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeData: unknown;
  afterData: unknown;
  metadata: unknown;
  createdAt: string;
};

export type FamilyAuditLogFilters = {
  entityType?: string;
  action?: string;
  actorFamilyMemberId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export type FamilyAuditLogPage = {
  items: FamilyAuditLogRecord[];
  page: {
    limit: number;
    offset: number;
    nextOffset: number | null;
  };
};

export async function listFamilyAuditLog(filters: FamilyAuditLogFilters = {}): Promise<FamilyAuditLogPage> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const response = await authenticatedFetch(`/api/family/audit-log${suffix}`, { method: 'GET', headers: { Accept: 'application/json' } });
  if (!response.ok) {
    let message = 'Не вдалося завантажити історію змін.';
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // Keep the friendly fallback.
    }
    throw new Error(message);
  }
  return (await response.json()) as FamilyAuditLogPage;
}
