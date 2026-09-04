export type BackendMemberActivityType =
  | 'tower_defense_responded'
  | 'tower_defense_confirmed'
  | 'tower_defense_attended'
  | 'tower_defense_late'
  | 'tower_defense_commanded'
  | 'tower_defense_defended'
  | 'tower_defense_lost'
  | 'quest_joined'
  | 'quest_helped'
  | 'quest_completed'
  | 'quest_best_participant'
  | 'quest_reward_earned'
  | 'quest_paid'
  | 'event_joined'
  | 'event_confirmed'
  | 'event_attended'
  | 'event_late'
  | 'event_organized'
  | 'event_completed'
  | 'achievement_earned'
  | 'reward_earned'
  | 'reward_approved'
  | 'reward_received'
  | 'accounting_accrual'
  | 'accounting_payout';

export type BackendMemberActivitySourceModule = 'tower_defense' | 'family_quests' | 'family_events' | 'achievements' | 'rewards' | 'accounting';

export type BackendMemberActivityItemDto = {
  id: string;
  type: BackendMemberActivityType;
  sourceModule: BackendMemberActivitySourceModule;
  sourceId: string;
  sourceSubId: string | null;
  occurredAt: string;
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  xpDelta?: number;
};

export type BackendMemberActivityResponse = {
  items: BackendMemberActivityItemDto[];
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export type BackendMemberProfileReportDto = {
  memberId: string;
  quests: {
    questsParticipated: number;
    questsHelped: number;
    questsCompleted: number;
    bestParticipantCount: number;
  };
  towerDefense: {
    defensesResponded: number;
    defensesAttended: number;
    defensesCommanded: number;
    towersDefended: number;
    towersLost: number;
    attendancePresent: number;
    attendanceLate: number;
    attendanceAbsent: number;
    attendanceExcused: number;
  };
  events: {
    eventsJoined: number;
    eventsAttended: number;
    eventsOrganized: number;
    eventAttendancePresent: number;
    eventAttendanceLate: number;
    eventAttendanceAbsent: number;
    eventAttendanceExcused: number;
  };
  xp: {
    available: boolean;
    totalEarned: number | null;
  };
  finance: null | {
    accruedTotal: number;
    paidTotal: number;
    unpaidTotal: number;
    currency: string;
  };
  achievements?: {
    achievementsTotal: number;
  };
  rewards?: {
    rewardsEarned: number;
    rewardsApproved?: number;
    rewardsIssued: number;
    rewardMoneyEarned?: number;
  };
  leaderboard?: null | {
    rank: number;
    place: number;
    score: number;
    period: 'current_month' | 'previous_month' | 'all_time';
    category: 'overall' | 'tower_defense' | 'quests' | 'events';
  };
  permissions: {
    canViewFinance: boolean;
  };
};

export class FamilyMemberActivityApiError extends Error {
  readonly code: 'BACKEND_UNAVAILABLE' | 'REQUEST_FAILED' | 'MALFORMED_RESPONSE';
  readonly status: number;

  constructor(
    message: string,
    code: 'BACKEND_UNAVAILABLE' | 'REQUEST_FAILED' | 'MALFORMED_RESPONSE',
    status = 0,
  ) {
    super(message);
    this.name = 'FamilyMemberActivityApiError';
    this.code = code;
    this.status = status;
  }
}

export async function parseBackendMemberActivityResponse(response: Response): Promise<BackendMemberActivityResponse> {
  return assertBackendMemberActivityResponse(await parseJson(response));
}

export async function parseBackendMemberProfileReportResponse(response: Response): Promise<BackendMemberProfileReportDto> {
  return assertBackendMemberProfileReport(await parseJson(response));
}

async function parseJson(response: Response): Promise<unknown> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const message = isRecord(body) && typeof body.message === 'string' ? body.message : `Member activity request failed: ${response.status}`;
    throw new FamilyMemberActivityApiError(message, 'REQUEST_FAILED', response.status);
  }
  return body;
}

function assertBackendMemberActivityResponse(value: unknown): BackendMemberActivityResponse {
  if (!isRecord(value) || !Array.isArray(value.items) || !isRecord(value.pagination)) {
    throw new FamilyMemberActivityApiError('Member activity response was malformed', 'MALFORMED_RESPONSE');
  }
  const items = value.items.map(assertActivityItem);
  const pagination = value.pagination;
  if (
    typeof pagination.limit !== 'number' ||
    (pagination.nextCursor !== null && typeof pagination.nextCursor !== 'string') ||
    typeof pagination.hasMore !== 'boolean'
  ) {
    throw new FamilyMemberActivityApiError('Member activity pagination was malformed', 'MALFORMED_RESPONSE');
  }
  return { items, pagination: { limit: pagination.limit, nextCursor: pagination.nextCursor, hasMore: pagination.hasMore } };
}

function assertActivityItem(value: unknown): BackendMemberActivityItemDto {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.type !== 'string' ||
    typeof value.sourceModule !== 'string' ||
    typeof value.sourceId !== 'string' ||
    (value.sourceSubId !== null && typeof value.sourceSubId !== 'string') ||
    typeof value.occurredAt !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.description !== 'string' ||
    !isRecord(value.metadata) ||
    (value.xpDelta !== undefined && typeof value.xpDelta !== 'number')
  ) {
    throw new FamilyMemberActivityApiError('Member activity item was malformed', 'MALFORMED_RESPONSE');
  }
  return value as BackendMemberActivityItemDto;
}

function assertBackendMemberProfileReport(value: unknown): BackendMemberProfileReportDto {
  if (!isRecord(value) || typeof value.memberId !== 'string' || !isRecord(value.quests) || !isRecord(value.towerDefense) || !isRecord(value.events) || !isRecord(value.xp) || !isRecord(value.permissions)) {
    throw new FamilyMemberActivityApiError('Member profile report was malformed', 'MALFORMED_RESPONSE');
  }
  return value as BackendMemberProfileReportDto;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
