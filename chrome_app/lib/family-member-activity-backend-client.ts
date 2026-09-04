import { authenticatedFetch } from './family-backend-auth-client.ts';
import {
  FamilyMemberActivityApiError,
  parseBackendMemberActivityResponse,
  parseBackendMemberProfileReportResponse,
  type BackendMemberActivityResponse,
  type BackendMemberActivitySourceModule,
  type BackendMemberActivityType,
  type BackendMemberProfileReportDto
} from './family-member-activity-backend-response.ts';

export type BackendMemberActivityQuery = {
  limit?: number;
  cursor?: string | null;
  sourceModule?: BackendMemberActivitySourceModule | null;
  type?: BackendMemberActivityType | null;
  from?: string | null;
  to?: string | null;
  signal?: AbortSignal;
};

export async function listBackendMemberActivity(memberId: string, query: BackendMemberActivityQuery = {}): Promise<BackendMemberActivityResponse> {
  const params = new URLSearchParams();
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.cursor) params.set('cursor', query.cursor);
  if (query.sourceModule) params.set('sourceModule', query.sourceModule);
  if (query.type) params.set('type', query.type);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  try {
    return await parseBackendMemberActivityResponse(await authenticatedFetch(`/api/family/members/${encodeURIComponent(memberId)}/activity${suffix}`, { method: 'GET', signal: query.signal }));
  } catch (error) {
    if (error instanceof FamilyMemberActivityApiError) throw error;
    throw new FamilyMemberActivityApiError('Member activity backend is unavailable', 'BACKEND_UNAVAILABLE');
  }
}

export async function getBackendMemberProfileReport(memberId: string, signal?: AbortSignal): Promise<BackendMemberProfileReportDto> {
  try {
    return await parseBackendMemberProfileReportResponse(await authenticatedFetch(`/api/family/members/${encodeURIComponent(memberId)}/report`, { method: 'GET', signal }));
  } catch (error) {
    if (error instanceof FamilyMemberActivityApiError) throw error;
    throw new FamilyMemberActivityApiError('Member profile report backend is unavailable', 'BACKEND_UNAVAILABLE');
  }
}
