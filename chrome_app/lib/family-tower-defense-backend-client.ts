import { authenticatedFetch } from './family-backend-auth-client.ts';
import {
  FamilyTowerDefenseApiError,
  assertBackendCompleteDefenseResponse,
  assertBackendDefenseListResponse,
  assertBackendDefenseResponse,
  assertBackendRosterResponse,
  assertBackendTowerListResponse,
  type BackendCompleteDefenseResponse,
  type BackendDefenseAttendanceDto,
  type BackendDefenseResponseDto,
  type BackendFireGuardRosterResponse,
  type BackendTowerDefenseDto,
  type BackendTowerDefenseListResponse,
  type BackendTowerListResponse
} from './family-tower-defense-backend-response.ts';

export type BackendTowerDefenseFilters = {
  status?: string;
  result?: string;
  priority?: string;
  tower?: string;
  commander?: string;
  participant?: string;
  search?: string;
};

export type CreateBackendTowerDefensePayload = {
  towerId: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  scheduledAt?: string | null;
  startsAt: string;
  endedAt?: string | null;
  timezone?: string;
  phase?: string;
  wave?: number;
  commanderFamilyMemberId: string;
  minimumGuardCount: number;
  recommendedGuardCount: number;
  maximumGuardCount: number;
  xp?: number;
  leaderboardEligible?: boolean;
  statisticsEligible?: boolean;
  notes?: string | null;
  metadata?: Record<string, unknown>;
};

export type UpdateBackendTowerDefensePayload = Partial<CreateBackendTowerDefensePayload> & {
  result?: string;
  score?: number | null;
  failureReason?: string | null;
};

export type BackendAttendancePayload = {
  familyMemberId: string;
  status: string;
  note?: string | null;
  score?: number | null;
  damageBlocked?: number | null;
  suppliesUsed?: number | null;
  contributionNotes?: string | null;
  source?: 'manual' | 'discord' | 'api';
};

export async function listBackendFamilyTowers(signal?: AbortSignal): Promise<BackendTowerListResponse> {
  return assertBackendTowerListResponse(await requestJson('/api/family/towers', { method: 'GET', signal }));
}

export async function listBackendTowerDefenses(filters: BackendTowerDefenseFilters = {}, signal?: AbortSignal): Promise<BackendTowerDefenseListResponse> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && value !== 'all') params.set(key, value);
  }
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return assertBackendDefenseListResponse(await requestJson(`/api/family/tower-defenses${suffix}`, { method: 'GET', signal }));
}

export async function getBackendTowerDefense(defenseId: string, signal?: AbortSignal): Promise<BackendTowerDefenseDto> {
  return assertBackendDefenseResponse(await requestJson(`/api/family/tower-defenses/${encodeURIComponent(defenseId)}`, { method: 'GET', signal }));
}

export async function listBackendFireGuardRoster(signal?: AbortSignal): Promise<BackendFireGuardRosterResponse> {
  return assertBackendRosterResponse(await requestJson('/api/family/fire-guard-roster', { method: 'GET', signal }));
}

export async function createBackendTowerDefense(payload: CreateBackendTowerDefensePayload): Promise<BackendTowerDefenseDto> {
  return assertBackendDefenseResponse(await requestJson('/api/family/tower-defenses', { method: 'POST', body: JSON.stringify(payload) }));
}

export async function updateBackendTowerDefense(defenseId: string, payload: UpdateBackendTowerDefensePayload): Promise<BackendTowerDefenseDto> {
  return assertBackendDefenseResponse(await requestJson(`/api/family/tower-defenses/${encodeURIComponent(defenseId)}`, { method: 'PATCH', body: JSON.stringify(payload) }));
}

export async function respondBackendTowerDefense(defenseId: string, payload: { familyMemberId?: string; response: string; note?: string | null; source?: 'manual' | 'discord' | 'api' }): Promise<BackendDefenseResponseDto> {
  return assertBackendResponseRecord(await requestJson(`/api/family/tower-defenses/${encodeURIComponent(defenseId)}/responses`, { method: 'POST', body: JSON.stringify(payload) }));
}

export async function withdrawBackendTowerDefenseResponse(defenseId: string): Promise<BackendDefenseResponseDto> {
  return assertBackendResponseRecord(await requestJson(`/api/family/tower-defenses/${encodeURIComponent(defenseId)}/responses/me/withdraw`, { method: 'POST' }));
}

export async function confirmBackendTowerDefenseAttendance(defenseId: string, payload: BackendAttendancePayload): Promise<BackendDefenseAttendanceDto> {
  return assertBackendAttendanceRecord(await requestJson(`/api/family/tower-defenses/${encodeURIComponent(defenseId)}/attendance`, { method: 'POST', body: JSON.stringify(payload) }));
}

export async function startBackendTowerDefense(defenseId: string): Promise<BackendTowerDefenseDto> {
  return assertBackendDefenseResponse(await requestJson(`/api/family/tower-defenses/${encodeURIComponent(defenseId)}/start`, { method: 'POST' }));
}

export async function completeBackendTowerDefense(defenseId: string, payload: { result: 'defended' | 'lost'; score?: number | null; notes?: string | null; failureReason?: string | null }): Promise<BackendCompleteDefenseResponse> {
  return assertBackendCompleteDefenseResponse(await requestJson(`/api/family/tower-defenses/${encodeURIComponent(defenseId)}/complete`, { method: 'POST', body: JSON.stringify(payload) }));
}

export async function cancelBackendTowerDefense(defenseId: string, payload: { reason?: string | null }): Promise<BackendTowerDefenseDto> {
  return assertBackendDefenseResponse(await requestJson(`/api/family/tower-defenses/${encodeURIComponent(defenseId)}/cancel`, { method: 'POST', body: JSON.stringify(payload) }));
}

async function requestJson(path: string, init: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    response = await authenticatedFetch(path, {
      ...init,
      headers
    });
  } catch (error) {
    if (error instanceof Error) throw new FamilyTowerDefenseApiError(error.message, 'BACKEND_UNAVAILABLE');
    throw new FamilyTowerDefenseApiError('Tower Defense backend is unavailable', 'BACKEND_UNAVAILABLE');
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message = isRecord(body) && typeof body.message === 'string' ? body.message : `Tower Defense request failed: ${response.status}`;
    throw new FamilyTowerDefenseApiError(message, 'REQUEST_FAILED', response.status);
  }
  return body;
}

function assertBackendResponseRecord(value: unknown): BackendDefenseResponseDto {
  if (!isBackendResponseRecord(value)) throw new FamilyTowerDefenseApiError('Tower defense response record was malformed', 'MALFORMED_RESPONSE');
  return value;
}

function assertBackendAttendanceRecord(value: unknown): BackendDefenseAttendanceDto {
  if (!isBackendAttendanceRecord(value)) throw new FamilyTowerDefenseApiError('Tower defense attendance record was malformed', 'MALFORMED_RESPONSE');
  return value;
}

function isBackendResponseRecord(value: unknown): value is BackendDefenseResponseDto {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.defenseId === 'string' &&
    typeof value.familyMemberId === 'string' &&
    typeof value.displayName === 'string' &&
    typeof value.response === 'string' &&
    typeof value.respondedAt === 'string' &&
    (value.note === null || typeof value.note === 'string') &&
    typeof value.source === 'string' &&
    isRecord(value.metadata) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string';
}

function isBackendAttendanceRecord(value: unknown): value is BackendDefenseAttendanceDto {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.defenseId === 'string' &&
    typeof value.familyMemberId === 'string' &&
    typeof value.displayName === 'string' &&
    typeof value.status === 'string' &&
    (value.confirmedByFamilyMemberId === null || typeof value.confirmedByFamilyMemberId === 'string') &&
    (value.confirmedAt === null || typeof value.confirmedAt === 'string') &&
    (value.note === null || typeof value.note === 'string') &&
    isRecord(value.metadata) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
