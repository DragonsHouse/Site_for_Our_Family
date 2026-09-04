import { authenticatedFetch } from './family-backend-auth-client.ts';
import { FamilyAchievementsApiError, type BackendRewardDefinitionDto, isRecord } from './family-achievements-backend-response.ts';

export type BackendRewardAllocationDto = {
  id: string;
  sourceModule: 'tower_defense' | 'events';
  sourceId: string;
  familyMemberId: string;
  familyMemberDisplayName: string | null;
  rewardDefinitionId: string;
  reward: BackendRewardDefinitionDto;
  quantity: number | null;
  reason: string | null;
  sourceKey: string;
  createdByFamilyMemberId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type RewardAllocationPayload = {
  familyMemberId: string;
  rewardDefinitionId: string;
  quantity?: number | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
};

export async function listBackendTowerDefenseRewardAllocations(defenseId: string, signal?: AbortSignal): Promise<{ items: BackendRewardAllocationDto[] }> {
  return assertRewardAllocationList(await requestJson(`/api/family/tower-defenses/${encodeURIComponent(defenseId)}/reward-allocations`, { method: 'GET', signal }));
}

export async function createBackendTowerDefenseRewardAllocation(defenseId: string, payload: RewardAllocationPayload): Promise<BackendRewardAllocationDto> {
  return assertRewardAllocation(await requestJson(`/api/family/tower-defenses/${encodeURIComponent(defenseId)}/reward-allocations`, { method: 'POST', body: JSON.stringify(payload) }));
}

export async function updateBackendTowerDefenseRewardAllocation(defenseId: string, allocationId: string, payload: Partial<RewardAllocationPayload>): Promise<BackendRewardAllocationDto> {
  return assertRewardAllocation(await requestJson(`/api/family/tower-defenses/${encodeURIComponent(defenseId)}/reward-allocations/${encodeURIComponent(allocationId)}`, { method: 'PATCH', body: JSON.stringify(payload) }));
}

export async function deleteBackendTowerDefenseRewardAllocation(defenseId: string, allocationId: string): Promise<{ deleted: true }> {
  return assertDeleted(await requestJson(`/api/family/tower-defenses/${encodeURIComponent(defenseId)}/reward-allocations/${encodeURIComponent(allocationId)}`, { method: 'DELETE' }));
}

export async function listBackendFamilyEventRewardAllocations(eventId: string, signal?: AbortSignal): Promise<{ items: BackendRewardAllocationDto[] }> {
  return assertRewardAllocationList(await requestJson(`/api/family/events/${encodeURIComponent(eventId)}/reward-allocations`, { method: 'GET', signal }));
}

export async function createBackendFamilyEventRewardAllocation(eventId: string, payload: RewardAllocationPayload): Promise<BackendRewardAllocationDto> {
  return assertRewardAllocation(await requestJson(`/api/family/events/${encodeURIComponent(eventId)}/reward-allocations`, { method: 'POST', body: JSON.stringify(payload) }));
}

export async function updateBackendFamilyEventRewardAllocation(eventId: string, allocationId: string, payload: Partial<RewardAllocationPayload>): Promise<BackendRewardAllocationDto> {
  return assertRewardAllocation(await requestJson(`/api/family/events/${encodeURIComponent(eventId)}/reward-allocations/${encodeURIComponent(allocationId)}`, { method: 'PATCH', body: JSON.stringify(payload) }));
}

export async function deleteBackendFamilyEventRewardAllocation(eventId: string, allocationId: string): Promise<{ deleted: true }> {
  return assertDeleted(await requestJson(`/api/family/events/${encodeURIComponent(eventId)}/reward-allocations/${encodeURIComponent(allocationId)}`, { method: 'DELETE' }));
}

async function requestJson(path: string, init: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body) headers.set('Content-Type', 'application/json');
    response = await authenticatedFetch(path, { ...init, headers });
  } catch (error) {
    if (error instanceof Error) throw new FamilyAchievementsApiError(error.message, 'BACKEND_UNAVAILABLE');
    throw new FamilyAchievementsApiError('Reward allocation backend is unavailable', 'BACKEND_UNAVAILABLE');
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const message = isRecord(body) && typeof body.message === 'string' ? body.message : `Reward allocation request failed: ${response.status}`;
    throw new FamilyAchievementsApiError(message, 'REQUEST_FAILED', response.status);
  }
  return body;
}

function assertRewardAllocationList(value: unknown): { items: BackendRewardAllocationDto[] } {
  if (!isRecord(value) || !Array.isArray(value.items)) throw new FamilyAchievementsApiError('Reward allocation response was malformed', 'MALFORMED_RESPONSE');
  return { items: value.items.map(assertRewardAllocation) };
}

function assertRewardAllocation(value: unknown): BackendRewardAllocationDto {
  if (!isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.sourceModule !== 'string' ||
    typeof value.sourceId !== 'string' ||
    typeof value.familyMemberId !== 'string' ||
    (value.familyMemberDisplayName !== null && typeof value.familyMemberDisplayName !== 'string') ||
    typeof value.rewardDefinitionId !== 'string' ||
    !isRecord(value.reward) ||
    typeof value.reward.id !== 'string' ||
    typeof value.reward.rewardKey !== 'string' ||
    typeof value.reward.name !== 'string' ||
    typeof value.reward.rewardType !== 'string' ||
    (value.quantity !== null && typeof value.quantity !== 'number') ||
    (value.reason !== null && typeof value.reason !== 'string') ||
    typeof value.sourceKey !== 'string' ||
    typeof value.createdByFamilyMemberId !== 'string' ||
    !isRecord(value.metadata) ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string') {
    throw new FamilyAchievementsApiError('Reward allocation record was malformed', 'MALFORMED_RESPONSE');
  }
  return value as BackendRewardAllocationDto;
}

function assertDeleted(value: unknown): { deleted: true } {
  if (!isRecord(value) || value.deleted !== true) throw new FamilyAchievementsApiError('Reward allocation delete response was malformed', 'MALFORMED_RESPONSE');
  return { deleted: true };
}
