export type BackendFamilyEventResponseDto = {
  id: string;
  eventId: string;
  familyMemberId: string;
  displayName: string;
  response: string;
  respondedAt: string;
  note: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type BackendFamilyEventAttendanceDto = {
  id: string;
  eventId: string;
  familyMemberId: string;
  displayName: string;
  status: string;
  confirmedByFamilyMemberId: string;
  confirmedAt: string;
  note: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type BackendFamilyEventDto = {
  id: string;
  title: string;
  description: string;
  eventType: string;
  category: string;
  status: string;
  priority: string;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  allDay: boolean;
  locationLabel: string | null;
  createdByFamilyMemberId: string;
  createdByDisplayName: string | null;
  organizerFamilyMemberId: string;
  organizerDisplayName: string | null;
  maxParticipants: number | null;
  visibility: string;
  notes: string | null;
  completedByFamilyMemberId: string | null;
  completedAt: string | null;
  cancelledByFamilyMemberId: string | null;
  cancelledAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  responses: BackendFamilyEventResponseDto[];
  attendance: BackendFamilyEventAttendanceDto[];
  participantCount: number;
  confirmedCount: number;
  presentCount: number;
};

export type BackendFamilyEventListResponse = { items: BackendFamilyEventDto[] };
export type BackendCompleteFamilyEventResponse = { event: BackendFamilyEventDto; completion: unknown };

export type BackendFamilyCalendarItemDto = {
  id: string;
  sourceModule: 'family_events' | 'tower_defense' | 'family_quests';
  sourceId: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  status: string;
  type: string;
  metadata: Record<string, unknown>;
};

export type BackendFamilyCalendarResponse = { items: BackendFamilyCalendarItemDto[] };

export class FamilyEventsApiError extends Error {
  readonly code: 'BACKEND_UNAVAILABLE' | 'MALFORMED_RESPONSE' | 'REQUEST_FAILED';
  readonly status?: number;

  constructor(message: string, code: FamilyEventsApiError['code'], status?: number) {
    super(message);
    this.name = 'FamilyEventsApiError';
    this.code = code;
    this.status = status;
  }
}

export function assertBackendEventListResponse(value: unknown): BackendFamilyEventListResponse {
  if (!isRecord(value) || !Array.isArray(value.items) || !value.items.every(isBackendEventDto)) {
    throw new FamilyEventsApiError('Family events response was malformed', 'MALFORMED_RESPONSE');
  }
  return { items: value.items };
}

export function assertBackendEventResponse(value: unknown): BackendFamilyEventDto {
  if (!isBackendEventDto(value)) throw new FamilyEventsApiError('Family event response was malformed', 'MALFORMED_RESPONSE');
  return value;
}

export function assertBackendEventResponseRecord(value: unknown): BackendFamilyEventResponseDto {
  if (!isBackendEventResponseDto(value)) throw new FamilyEventsApiError('Family event response record was malformed', 'MALFORMED_RESPONSE');
  return value;
}

export function assertBackendEventAttendanceRecord(value: unknown): BackendFamilyEventAttendanceDto {
  if (!isBackendEventAttendanceDto(value)) throw new FamilyEventsApiError('Family event attendance record was malformed', 'MALFORMED_RESPONSE');
  return value;
}

export function assertBackendCompleteEventResponse(value: unknown): BackendCompleteFamilyEventResponse {
  if (!isRecord(value) || !isBackendEventDto(value.event)) throw new FamilyEventsApiError('Complete family event response was malformed', 'MALFORMED_RESPONSE');
  return { event: value.event, completion: value.completion };
}

export function assertBackendCalendarResponse(value: unknown): BackendFamilyCalendarResponse {
  if (!isRecord(value) || !Array.isArray(value.items) || !value.items.every(isBackendCalendarItemDto)) {
    throw new FamilyEventsApiError('Family calendar response was malformed', 'MALFORMED_RESPONSE');
  }
  return { items: value.items };
}

function isBackendEventDto(value: unknown): value is BackendFamilyEventDto {
  return isRecord(value) &&
    isString(value.id) &&
    isString(value.title) &&
    isString(value.description) &&
    isString(value.eventType) &&
    isString(value.category) &&
    isString(value.status) &&
    isString(value.priority) &&
    isString(value.startsAt) &&
    isNullableString(value.endsAt) &&
    isString(value.timezone) &&
    typeof value.allDay === 'boolean' &&
    isNullableString(value.locationLabel) &&
    isString(value.createdByFamilyMemberId) &&
    isNullableString(value.createdByDisplayName) &&
    isString(value.organizerFamilyMemberId) &&
    isNullableString(value.organizerDisplayName) &&
    isNullableNumber(value.maxParticipants) &&
    isString(value.visibility) &&
    isNullableString(value.notes) &&
    isRecord(value.metadata) &&
    Array.isArray(value.responses) &&
    value.responses.every(isBackendEventResponseDto) &&
    Array.isArray(value.attendance) &&
    value.attendance.every(isBackendEventAttendanceDto) &&
    isNumber(value.participantCount) &&
    isNumber(value.confirmedCount) &&
    isNumber(value.presentCount);
}

function isBackendEventResponseDto(value: unknown): value is BackendFamilyEventResponseDto {
  return isRecord(value) &&
    isString(value.id) &&
    isString(value.eventId) &&
    isString(value.familyMemberId) &&
    isString(value.displayName) &&
    isString(value.response) &&
    isString(value.respondedAt) &&
    isNullableString(value.note) &&
    isRecord(value.metadata) &&
    isString(value.createdAt) &&
    isString(value.updatedAt);
}

function isBackendEventAttendanceDto(value: unknown): value is BackendFamilyEventAttendanceDto {
  return isRecord(value) &&
    isString(value.id) &&
    isString(value.eventId) &&
    isString(value.familyMemberId) &&
    isString(value.displayName) &&
    isString(value.status) &&
    isString(value.confirmedByFamilyMemberId) &&
    isString(value.confirmedAt) &&
    isNullableString(value.note) &&
    isRecord(value.metadata) &&
    isString(value.createdAt) &&
    isString(value.updatedAt);
}

function isBackendCalendarItemDto(value: unknown): value is BackendFamilyCalendarItemDto {
  return isRecord(value) &&
    isString(value.id) &&
    (value.sourceModule === 'family_events' || value.sourceModule === 'tower_defense' || value.sourceModule === 'family_quests') &&
    isString(value.sourceId) &&
    isString(value.title) &&
    isString(value.startsAt) &&
    isNullableString(value.endsAt) &&
    isString(value.status) &&
    isString(value.type) &&
    isRecord(value.metadata);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isNumber(value);
}
