import { authenticatedFetch } from './family-backend-auth-client.ts';
import {
  FamilyAchievementsApiError,
  assertAchievementListResponse,
  assertLeaderboardResponse,
  assertMemberAchievementListResponse,
  assertMemberRewardListResponse,
  assertRewardPendingResponse,
  assertRewardListResponse,
  isRecord,
  type BackendLeaderboardResponse,
  type BackendMemberAchievementDto,
  type BackendMemberRewardGrantDto,
  type BackendRewardQueueItemDto,
} from './family-achievements-backend-response.ts';

export async function listBackendAchievements(signal?: AbortSignal) {
  return assertAchievementListResponse(await requestJson('/api/family/achievements', { method: 'GET', signal }));
}

export async function listBackendMemberAchievements(memberId: string, signal?: AbortSignal): Promise<{ items: BackendMemberAchievementDto[] }> {
  return assertMemberAchievementListResponse(await requestJson(`/api/family/members/${encodeURIComponent(memberId)}/achievements`, { method: 'GET', signal }));
}

export async function listBackendRewards(signal?: AbortSignal) {
  return assertRewardListResponse(await requestJson('/api/family/rewards', { method: 'GET', signal }));
}

export async function listBackendMemberRewards(memberId: string, signal?: AbortSignal): Promise<{ items: BackendMemberRewardGrantDto[]; permissions: { canViewSensitiveRewards: boolean } }> {
  return assertMemberRewardListResponse(await requestJson(`/api/family/members/${encodeURIComponent(memberId)}/rewards`, { method: 'GET', signal }));
}

export async function listBackendPendingRewards(query: {
  status?: string;
  rewardType?: string;
  sourceModule?: string;
  memberId?: string;
  from?: string;
  to?: string;
  limit?: number;
} = {}, signal?: AbortSignal): Promise<{ items: BackendRewardQueueItemDto[] }> {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.rewardType) params.set('rewardType', query.rewardType);
  if (query.sourceModule) params.set('sourceModule', query.sourceModule);
  if (query.memberId) params.set('memberId', query.memberId);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.limit) params.set('limit', String(query.limit));
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return assertRewardPendingResponse(await requestJson(`/api/family/rewards/pending${suffix}`, { method: 'GET', signal }));
}

export async function approveBackendRewardGrant(grantId: string): Promise<BackendMemberRewardGrantDto> {
  return assertSingleRewardGrant(await requestJson(`/api/family/rewards/grants/${encodeURIComponent(grantId)}/approve`, { method: 'POST' }));
}

export async function issueBackendRewardGrant(grantId: string): Promise<BackendMemberRewardGrantDto> {
  return assertSingleRewardGrant(await requestJson(`/api/family/rewards/grants/${encodeURIComponent(grantId)}/issue`, { method: 'POST' }));
}

export async function cancelBackendRewardGrant(grantId: string): Promise<BackendMemberRewardGrantDto> {
  return assertSingleRewardGrant(await requestJson(`/api/family/rewards/grants/${encodeURIComponent(grantId)}/cancel`, { method: 'POST' }));
}

export async function reconcileBackendQuestRewards(questId: string): Promise<unknown> {
  return requestJson(`/api/family/rewards/reconcile/quests/${encodeURIComponent(questId)}`, { method: 'POST' });
}

export async function reconcileBackendTowerDefenseRewards(defenseId: string): Promise<unknown> {
  return requestJson(`/api/family/rewards/reconcile/tower-defenses/${encodeURIComponent(defenseId)}`, { method: 'POST' });
}

export async function reconcileBackendFamilyEventRewards(eventId: string): Promise<unknown> {
  return requestJson(`/api/family/rewards/reconcile/events/${encodeURIComponent(eventId)}`, { method: 'POST' });
}

export async function getBackendLeaderboard(query: { period?: string; category?: string } = {}, signal?: AbortSignal): Promise<BackendLeaderboardResponse> {
  const params = new URLSearchParams();
  if (query.period) params.set('period', query.period);
  if (query.category) params.set('category', query.category);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return assertLeaderboardResponse(await requestJson(`/api/family/leaderboard${suffix}`, { method: 'GET', signal }));
}

async function requestJson(path: string, init: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await authenticatedFetch(path, init);
  } catch (error) {
    if (error instanceof FamilyAchievementsApiError) throw error;
    throw new FamilyAchievementsApiError('Achievements backend is unavailable', 'BACKEND_UNAVAILABLE');
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message = isRecord(body) && typeof body.message === 'string' ? body.message : `Achievements request failed: ${response.status}`;
    throw new FamilyAchievementsApiError(message, 'REQUEST_FAILED', response.status);
  }
  return body;
}

function assertSingleRewardGrant(value: unknown): BackendMemberRewardGrantDto {
  return assertMemberRewardListResponse({ items: [value], permissions: { canViewSensitiveRewards: true } }).items[0]!;
}
