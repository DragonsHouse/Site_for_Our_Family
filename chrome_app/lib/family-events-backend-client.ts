import { authenticatedFetch } from './family-backend-auth-client.ts';
import {
  FamilyEventsApiError,
  assertBackendCalendarResponse,
  assertBackendCompleteEventResponse,
  assertBackendEventAttendanceRecord,
  assertBackendEventListResponse,
  assertBackendEventResponse,
  assertBackendEventResponseRecord,
  type BackendCompleteFamilyEventResponse,
  type BackendFamilyCalendarResponse,
  type BackendFamilyEventAttendanceDto,
  type BackendFamilyEventDto,
  type BackendFamilyEventListResponse,
  type BackendFamilyEventResponseDto
} from './family-events-backend-response.ts';

export type BackendFamilyEventFilters = {
  status?: string;
  category?: string;
  type?: string;
  from?: string;
  to?: string;
  organizer?: string;
  participant?: string;
  search?: string;
};

export type CreateBackendFamilyEventPayload = {
  title: string;
  description?: string;
  eventType: string;
  category?: string;
  status?: string;
  priority?: string;
  startsAt: string;
  endsAt?: string | null;
  timezone?: string;
  allDay?: boolean;
  locationLabel?: string | null;
  organizerFamilyMemberId?: string;
  maxParticipants?: number | null;
  visibility?: string;
  notes?: string | null;
  metadata?: Record<string, unknown>;
};

export type UpdateBackendFamilyEventPayload = Partial<CreateBackendFamilyEventPayload>;

export async function listBackendFamilyEvents(filters: BackendFamilyEventFilters = {}, signal?: AbortSignal): Promise<BackendFamilyEventListResponse> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && value !== 'all') params.set(key, value);
  }
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return assertBackendEventListResponse(await requestJson(`/api/family/events${suffix}`, { method: 'GET', signal }));
}

export async function getBackendFamilyEvent(eventId: string, signal?: AbortSignal): Promise<BackendFamilyEventDto> {
  return assertBackendEventResponse(await requestJson(`/api/family/events/${encodeURIComponent(eventId)}`, { method: 'GET', signal }));
}

export async function createBackendFamilyEvent(payload: CreateBackendFamilyEventPayload): Promise<BackendFamilyEventDto> {
  return assertBackendEventResponse(await requestJson('/api/family/events', { method: 'POST', body: JSON.stringify(payload) }));
}

export async function updateBackendFamilyEvent(eventId: string, payload: UpdateBackendFamilyEventPayload): Promise<BackendFamilyEventDto> {
  return assertBackendEventResponse(await requestJson(`/api/family/events/${encodeURIComponent(eventId)}`, { method: 'PATCH', body: JSON.stringify(payload) }));
}

export async function respondBackendFamilyEvent(eventId: string, payload: { familyMemberId?: string; response: string; note?: string | null }): Promise<BackendFamilyEventResponseDto> {
  return assertBackendEventResponseRecord(await requestJson(`/api/family/events/${encodeURIComponent(eventId)}/respond`, { method: 'POST', body: JSON.stringify(payload) }));
}

export async function withdrawBackendFamilyEventResponse(eventId: string): Promise<BackendFamilyEventResponseDto> {
  return assertBackendEventResponseRecord(await requestJson(`/api/family/events/${encodeURIComponent(eventId)}/responses/me/withdraw`, { method: 'POST' }));
}

export async function confirmBackendFamilyEventAttendance(eventId: string, payload: { familyMemberId: string; status: string; note?: string | null }): Promise<BackendFamilyEventAttendanceDto> {
  return assertBackendEventAttendanceRecord(await requestJson(`/api/family/events/${encodeURIComponent(eventId)}/attendance`, { method: 'POST', body: JSON.stringify(payload) }));
}

export async function startBackendFamilyEvent(eventId: string): Promise<BackendFamilyEventDto> {
  return assertBackendEventResponse(await requestJson(`/api/family/events/${encodeURIComponent(eventId)}/start`, { method: 'POST' }));
}

export async function completeBackendFamilyEvent(eventId: string): Promise<BackendCompleteFamilyEventResponse> {
  return assertBackendCompleteEventResponse(await requestJson(`/api/family/events/${encodeURIComponent(eventId)}/complete`, { method: 'POST' }));
}

export async function cancelBackendFamilyEvent(eventId: string, payload: { reason?: string | null }): Promise<BackendFamilyEventDto> {
  return assertBackendEventResponse(await requestJson(`/api/family/events/${encodeURIComponent(eventId)}/cancel`, { method: 'POST', body: JSON.stringify(payload) }));
}

export async function listBackendFamilyCalendar(filters: { from?: string; to?: string; sourceModule?: string } = {}, signal?: AbortSignal): Promise<BackendFamilyCalendarResponse> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && value !== 'all') params.set(key, value);
  }
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return assertBackendCalendarResponse(await requestJson(`/api/family/calendar${suffix}`, { method: 'GET', signal }));
}

async function requestJson(path: string, init: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body) headers.set('Content-Type', 'application/json');
    response = await authenticatedFetch(path, { ...init, headers });
  } catch (error) {
    if (error instanceof Error) throw new FamilyEventsApiError(error.message, 'BACKEND_UNAVAILABLE');
    throw new FamilyEventsApiError('Family events backend is unavailable', 'BACKEND_UNAVAILABLE');
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message = isRecord(body) && typeof body.message === 'string' ? body.message : `Family events request failed: ${response.status}`;
    throw new FamilyEventsApiError(message, 'REQUEST_FAILED', response.status);
  }
  return body;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
