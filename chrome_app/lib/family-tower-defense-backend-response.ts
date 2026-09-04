export type BackendTowerDto = {
  id: string;
  towerCode: string;
  name: string;
  locationLabel: string;
  mapMetadata: Record<string, unknown>;
  imageAssetId: string | null;
  iconAssetId: string | null;
  isActive: boolean;
  externalSource: string | null;
  externalId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type BackendTowerDefenseDto = {
  id: string;
  tower: BackendTowerDto;
  title: string;
  description: string;
  status: string;
  priority: string;
  scheduledAt: string | null;
  startsAt: string;
  endedAt: string | null;
  timezone: string;
  phase: string;
  wave: number;
  commanderFamilyMemberId: string;
  commanderDisplayName: string | null;
  createdByFamilyMemberId: string;
  minimumGuardCount: number;
  recommendedGuardCount: number;
  maximumGuardCount: number;
  result: string;
  score: number | null;
  notes: string | null;
  failureReason: string | null;
  completedByFamilyMemberId: string | null;
  completedAt: string | null;
  xp: number;
  leaderboardEligible: boolean;
  statisticsEligible: boolean;
  discord: {
    guildId: string | null;
    channelId: string | null;
    messageId: string | null;
    voiceChannelId: string | null;
    syncedAt: string | null;
  };
  externalSource: string | null;
  externalId: string | null;
  syncIdempotencyKey: string | null;
  eventProjectionKey: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  responses: BackendDefenseResponseDto[];
  attendance: BackendDefenseAttendanceDto[];
  participantCount: number;
  confirmedCount: number;
  presentCount: number;
};

export type BackendDefenseResponseDto = {
  id: string;
  defenseId: string;
  familyMemberId: string;
  displayName: string;
  response: string;
  respondedAt: string;
  note: string | null;
  source: string;
  externalSource: string | null;
  externalId: string | null;
  idempotencyKey: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type BackendDefenseAttendanceDto = {
  id: string;
  defenseId: string;
  familyMemberId: string;
  displayName: string;
  status: string;
  confirmedByFamilyMemberId: string | null;
  confirmedAt: string | null;
  note: string | null;
  score: number | null;
  damageBlocked: number | null;
  suppliesUsed: number | null;
  contributionNotes: string | null;
  source: string;
  externalSource: string | null;
  externalId: string | null;
  idempotencyKey: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type BackendFireGuardRosterDto = {
  id: string;
  familyMemberId: string;
  displayName: string;
  role: string;
  status: string;
  note: string | null;
  assignedByFamilyMemberId: string | null;
  discordUserId: string | null;
  discordUsername: string | null;
  guildId: string | null;
  externalSource: string | null;
  externalId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type BackendTowerDefenseListResponse = { items: BackendTowerDefenseDto[] };
export type BackendTowerListResponse = { items: BackendTowerDto[] };
export type BackendFireGuardRosterResponse = { items: BackendFireGuardRosterDto[] };
export type BackendCompleteDefenseResponse = { defense: BackendTowerDefenseDto; completion: unknown };

export class FamilyTowerDefenseApiError extends Error {
  readonly code: 'BACKEND_UNAVAILABLE' | 'MALFORMED_RESPONSE' | 'REQUEST_FAILED';
  readonly status?: number;

  constructor(
    message: string,
    code: 'BACKEND_UNAVAILABLE' | 'MALFORMED_RESPONSE' | 'REQUEST_FAILED',
    status?: number,
  ) {
    super(message);
    this.name = 'FamilyTowerDefenseApiError';
    this.code = code;
    this.status = status;
  }
}

export function assertBackendTowerListResponse(value: unknown): BackendTowerListResponse {
  if (!isRecord(value) || !Array.isArray(value.items) || !value.items.every(isBackendTowerDto)) {
    throw new FamilyTowerDefenseApiError('Tower list response was malformed', 'MALFORMED_RESPONSE');
  }
  return { items: value.items };
}

export function assertBackendDefenseListResponse(value: unknown): BackendTowerDefenseListResponse {
  if (!isRecord(value) || !Array.isArray(value.items) || !value.items.every(isBackendDefenseDto)) {
    throw new FamilyTowerDefenseApiError('Tower defense list response was malformed', 'MALFORMED_RESPONSE');
  }
  return { items: value.items };
}

export function assertBackendDefenseResponse(value: unknown): BackendTowerDefenseDto {
  if (!isBackendDefenseDto(value)) throw new FamilyTowerDefenseApiError('Tower defense response was malformed', 'MALFORMED_RESPONSE');
  return value;
}

export function assertBackendRosterResponse(value: unknown): BackendFireGuardRosterResponse {
  if (!isRecord(value) || !Array.isArray(value.items) || !value.items.every(isBackendRosterDto)) {
    throw new FamilyTowerDefenseApiError('Fire Guard roster response was malformed', 'MALFORMED_RESPONSE');
  }
  return { items: value.items };
}

export function assertBackendCompleteDefenseResponse(value: unknown): BackendCompleteDefenseResponse {
  if (!isRecord(value) || !isBackendDefenseDto(value.defense)) {
    throw new FamilyTowerDefenseApiError('Complete defense response was malformed', 'MALFORMED_RESPONSE');
  }
  return { defense: value.defense, completion: value.completion };
}

function isBackendDefenseDto(value: unknown): value is BackendTowerDefenseDto {
  return isRecord(value) &&
    isString(value.id) &&
    isBackendTowerDto(value.tower) &&
    isString(value.title) &&
    isString(value.description) &&
    isString(value.status) &&
    isString(value.priority) &&
    isNullableString(value.scheduledAt) &&
    isString(value.startsAt) &&
    isNullableString(value.endedAt) &&
    isString(value.timezone) &&
    isString(value.phase) &&
    isNumber(value.wave) &&
    isString(value.commanderFamilyMemberId) &&
    isNullableString(value.commanderDisplayName) &&
    isString(value.createdByFamilyMemberId) &&
    isNumber(value.minimumGuardCount) &&
    isNumber(value.recommendedGuardCount) &&
    isNumber(value.maximumGuardCount) &&
    isString(value.result) &&
    isNullableNumber(value.score) &&
    isNullableString(value.notes) &&
    isNullableString(value.failureReason) &&
    isNullableString(value.completedByFamilyMemberId) &&
    isNullableString(value.completedAt) &&
    isNumber(value.xp) &&
    typeof value.leaderboardEligible === 'boolean' &&
    typeof value.statisticsEligible === 'boolean' &&
    isRecord(value.discord) &&
    isString(value.eventProjectionKey) &&
    isRecord(value.metadata) &&
    isString(value.createdAt) &&
    isString(value.updatedAt) &&
    Array.isArray(value.responses) &&
    value.responses.every(isBackendResponseDto) &&
    Array.isArray(value.attendance) &&
    value.attendance.every(isBackendAttendanceDto) &&
    isNumber(value.participantCount) &&
    isNumber(value.confirmedCount) &&
    isNumber(value.presentCount);
}

function isBackendTowerDto(value: unknown): value is BackendTowerDto {
  return isRecord(value) &&
    isString(value.id) &&
    isString(value.towerCode) &&
    isString(value.name) &&
    isString(value.locationLabel) &&
    isRecord(value.mapMetadata) &&
    isNullableString(value.imageAssetId) &&
    isNullableString(value.iconAssetId) &&
    typeof value.isActive === 'boolean' &&
    isNullableString(value.externalSource) &&
    isNullableString(value.externalId) &&
    isRecord(value.metadata) &&
    isString(value.createdAt) &&
    isString(value.updatedAt);
}

function isBackendResponseDto(value: unknown): value is BackendDefenseResponseDto {
  return isRecord(value) &&
    isString(value.id) &&
    isString(value.defenseId) &&
    isString(value.familyMemberId) &&
    isString(value.displayName) &&
    isString(value.response) &&
    isString(value.respondedAt) &&
    isNullableString(value.note) &&
    isString(value.source) &&
    isNullableString(value.externalSource) &&
    isNullableString(value.externalId) &&
    isNullableString(value.idempotencyKey) &&
    isRecord(value.metadata) &&
    isString(value.createdAt) &&
    isString(value.updatedAt);
}

function isBackendAttendanceDto(value: unknown): value is BackendDefenseAttendanceDto {
  return isRecord(value) &&
    isString(value.id) &&
    isString(value.defenseId) &&
    isString(value.familyMemberId) &&
    isString(value.displayName) &&
    isString(value.status) &&
    isNullableString(value.confirmedByFamilyMemberId) &&
    isNullableString(value.confirmedAt) &&
    isNullableString(value.note) &&
    isNullableNumber(value.score) &&
    isNullableNumber(value.damageBlocked) &&
    isNullableNumber(value.suppliesUsed) &&
    isNullableString(value.contributionNotes) &&
    isString(value.source) &&
    isNullableString(value.externalSource) &&
    isNullableString(value.externalId) &&
    isNullableString(value.idempotencyKey) &&
    isRecord(value.metadata) &&
    isString(value.createdAt) &&
    isString(value.updatedAt);
}

function isBackendRosterDto(value: unknown): value is BackendFireGuardRosterDto {
  return isRecord(value) &&
    isString(value.id) &&
    isString(value.familyMemberId) &&
    isString(value.displayName) &&
    isString(value.role) &&
    isString(value.status) &&
    isNullableString(value.note) &&
    isNullableString(value.assignedByFamilyMemberId) &&
    isNullableString(value.discordUserId) &&
    isNullableString(value.discordUsername) &&
    isNullableString(value.guildId) &&
    isNullableString(value.externalSource) &&
    isNullableString(value.externalId) &&
    isRecord(value.metadata) &&
    isString(value.createdAt) &&
    isString(value.updatedAt);
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
