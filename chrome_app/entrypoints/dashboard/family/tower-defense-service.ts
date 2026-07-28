import type { DragonEvent, DragonEventPriority, DragonEventStatus } from './dragon-event-models';
import type { DragonMember } from './members-models';
import type {
  DragonDefenseAttendanceStatus,
  DragonFireGuardRole,
  DragonDefenseReadiness,
  DragonDefenseResult,
  DragonDefenseStatus,
  DragonFireGuardAvailability,
  DragonFireGuardRosterEntry,
  DragonGuardResponseStatus,
  DragonTowerDefense,
  DragonTowerDefenseCompletionOutput,
  DragonTowerDefenseCreateInput,
  DragonTowerDefenseFilters,
  DragonTowerDefenseHistoryEntry,
  DragonTowerDefenseProfileTimelineEntry,
  DragonTowerDefenseStatistics
} from './tower-defense-models';

export type DragonTowerDefenseDomainErrorCode =
  | 'invalid_time_range'
  | 'invalid_transition'
  | 'duplicate_active_event'
  | 'missing_commander'
  | 'not_editable'
  | 'not_completable';

export class DragonTowerDefenseDomainError extends Error {
  readonly code: DragonTowerDefenseDomainErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: DragonTowerDefenseDomainErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DragonTowerDefenseDomainError';
    this.code = code;
    this.details = details;
  }
}

export const DRAGON_DEFENSE_STATUS_LABELS: Record<DragonDefenseStatus, string> = {
  draft: 'Draft',
  scheduled: 'Захист заплановано',
  gathering: 'Варта збирається',
  active: 'Захист активний',
  completed: 'Захист завершено',
  cancelled: 'Захист скасовано'
};

export const DRAGON_DEFENSE_RESULT_LABELS: Record<DragonDefenseResult, string> = {
  pending: 'Очікує результат',
  defended: 'Вишку захищено',
  lost: 'Вишку втрачено',
  cancelled: 'Скасовано'
};

export const DEFAULT_DRAGON_TOWER_DEFENSE_FILTERS: DragonTowerDefenseFilters = {
  status: 'all',
  result: 'all',
  priority: 'all',
  tower: '',
  commander: '',
  participant: '',
  search: ''
};

export const DRAGON_TOWER_DEFENSE_TRANSITIONS: Record<DragonDefenseStatus, DragonDefenseStatus[]> = {
  draft: ['scheduled', 'cancelled'],
  scheduled: ['gathering', 'cancelled'],
  gathering: ['active', 'cancelled'],
  active: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
};

const RESPONSE_ORDER: Record<DragonGuardResponseStatus, number> = {
  confirmed: 5,
  joining: 4,
  available: 3,
  unavailable: 2,
  'no-response': 1
};

const ATTENDANCE_ORDER: Record<DragonDefenseAttendanceStatus, number> = {
  present: 5,
  late: 4,
  excused: 3,
  absent: 2,
  unconfirmed: 1
};

export function createDragonTowerDefense(input: DragonTowerDefenseCreateInput, now = new Date()): DragonTowerDefense {
  validateDragonTowerDefenseTimeRange(input.startsAt, input.endedAt);

  const createdAt = now.toISOString();
  const defenseId = input.id ?? `defense-${stableKey(input.towerCode)}-${input.startsAt.slice(0, 10)}`;

  return recalculateDragonTowerDefenseCounts({
    id: defenseId,
    backendDefenseId: input.backendDefenseId ?? `tower-defense:${defenseId}`,
    eventId: input.eventId ?? buildDragonTowerDefenseEventId(defenseId),
    title: input.title,
    description: input.description,
    tower: {
      towerId: input.towerId,
      towerName: input.towerName,
      towerCode: input.towerCode,
      location: input.location,
      map: input.map,
      visual: input.visual
    },
    status: input.status ?? 'scheduled',
    priority: input.priority ?? 'high',
    scheduledAt: input.scheduledAt ?? createdAt,
    startsAt: input.startsAt,
    endedAt: input.endedAt ?? null,
    timezone: input.timezone,
    allDay: input.allDay ?? false,
    wave: input.wave ?? 1,
    phase: input.phase ?? 'forming',
    commanderMemberId: input.commanderMemberId,
    createdByMemberId: input.createdByMemberId,
    minimumGuardCount: input.minimumGuardCount,
    recommendedGuardCount: input.recommendedGuardCount,
    maximumGuardCount: input.maximumGuardCount,
    responses: input.responses ?? [],
    attendance: input.attendance ?? [],
    participantCount: 0,
    confirmedCount: 0,
    result: input.result ?? 'pending',
    score: input.score,
    contribution: input.contribution,
    notes: input.notes,
    failureReason: input.failureReason,
    completedByMemberId: input.completedByMemberId,
    completedAt: input.completedAt,
    xp: input.xp ?? 0,
    rewardIds: input.rewardIds ?? [],
    achievementIds: input.achievementIds ?? [],
    leaderboardEligible: input.leaderboardEligible ?? true,
    statisticsEligible: input.statisticsEligible ?? true,
    source: input.source ?? { sourceModule: 'tower_defense', sourceId: defenseId },
    discord: input.discord,
    backendMetadata: input.backendMetadata,
    createdAt,
    updatedAt: createdAt
  });
}

export function editDragonTowerDefense(
  defense: DragonTowerDefense,
  updates: Partial<DragonTowerDefenseCreateInput>,
  now = new Date()
) {
  if (!['draft', 'scheduled', 'gathering'].includes(defense.status)) {
    throw new DragonTowerDefenseDomainError('not_editable', 'Only draft, scheduled or gathering defenses can be edited.', {
      defenseId: defense.id,
      status: defense.status
    });
  }

  const startsAt = updates.startsAt ?? defense.startsAt;
  const endedAt = updates.endedAt ?? defense.endedAt;
  validateDragonTowerDefenseTimeRange(startsAt, endedAt);

  return recalculateDragonTowerDefenseCounts({
    ...defense,
    ...updates,
    tower: {
      towerId: updates.towerId ?? defense.tower.towerId,
      towerName: updates.towerName ?? defense.tower.towerName,
      towerCode: updates.towerCode ?? defense.tower.towerCode,
      location: updates.location ?? defense.tower.location,
      map: updates.map ?? defense.tower.map,
      visual: updates.visual ?? defense.tower.visual
    },
    updatedAt: now.toISOString()
  });
}

export function assignDragonDefenseCommander(defense: DragonTowerDefense, commanderMemberId: string, now = new Date()) {
  if (!commanderMemberId.trim()) {
    throw new DragonTowerDefenseDomainError('missing_commander', 'Commander member id is required.', { defenseId: defense.id });
  }

  return {
    ...defense,
    commanderMemberId,
    updatedAt: now.toISOString()
  };
}

export function transitionDragonDefense(defense: DragonTowerDefense, nextStatus: DragonDefenseStatus, now = new Date()) {
  if (!DRAGON_TOWER_DEFENSE_TRANSITIONS[defense.status].includes(nextStatus)) {
    throw new DragonTowerDefenseDomainError('invalid_transition', `Cannot move defense from ${defense.status} to ${nextStatus}.`, {
      defenseId: defense.id,
      from: defense.status,
      to: nextStatus
    });
  }

  return {
    ...defense,
    status: nextStatus,
    phase: nextStatus === 'active' ? 'combat' : nextStatus === 'completed' || nextStatus === 'cancelled' ? 'closed' : defense.phase,
    updatedAt: now.toISOString()
  };
}

export function respondToDragonDefense(
  defense: DragonTowerDefense,
  memberId: string,
  response: DragonGuardResponseStatus,
  now = new Date(),
  note?: string
) {
  const updatedResponses = [
    ...defense.responses.filter((entry) => entry.memberId !== memberId),
    {
      memberId,
      response,
      respondedAt: now.toISOString(),
      note,
      source: 'manual' as const
    }
  ];

  return recalculateDragonTowerDefenseCounts({
    ...defense,
    responses: updatedResponses,
    updatedAt: now.toISOString()
  });
}

export function withdrawDragonDefenseResponse(defense: DragonTowerDefense, memberId: string, now = new Date()) {
  return recalculateDragonTowerDefenseCounts({
    ...defense,
    responses: [
      ...defense.responses.filter((entry) => entry.memberId !== memberId),
      {
        memberId,
        response: 'no-response',
        respondedAt: now.toISOString(),
        source: 'manual'
      }
    ],
    updatedAt: now.toISOString()
  });
}

export function confirmDragonDefenseAttendance(
  defense: DragonTowerDefense,
  memberId: string,
  status: DragonDefenseAttendanceStatus,
  confirmedByMemberId: string,
  now = new Date(),
  contribution?: DragonTowerDefense['contribution'],
  note?: string
) {
  const updatedAttendance = [
    ...defense.attendance.filter((entry) => entry.memberId !== memberId),
    {
      memberId,
      status,
      confirmedAt: now.toISOString(),
      confirmedByMemberId,
      contribution,
      note
    }
  ];

  return recalculateDragonTowerDefenseCounts({
    ...defense,
    attendance: updatedAttendance,
    updatedAt: now.toISOString()
  });
}

export function startDragonDefense(defense: DragonTowerDefense, now = new Date()) {
  return transitionDragonDefense(defense, 'active', now);
}

export function completeDragonDefense(
  defense: DragonTowerDefense,
  result: Exclude<DragonDefenseResult, 'pending' | 'cancelled'>,
  completedByMemberId: string,
  now = new Date(),
  notes?: string,
  failureReason?: string
) {
  if (defense.status !== 'active') {
    throw new DragonTowerDefenseDomainError('invalid_transition', 'Only active defenses can be completed.', {
      defenseId: defense.id,
      status: defense.status
    });
  }

  return recalculateDragonTowerDefenseCounts({
    ...defense,
    status: 'completed',
    phase: 'closed',
    result,
    endedAt: defense.endedAt ?? now.toISOString(),
    completedAt: now.toISOString(),
    completedByMemberId,
    notes,
    failureReason: result === 'lost' ? failureReason : undefined,
    updatedAt: now.toISOString()
  });
}

export function cancelDragonDefense(defense: DragonTowerDefense, cancelledByMemberId: string, now = new Date(), reason?: string) {
  if (!['draft', 'scheduled', 'gathering', 'active'].includes(defense.status)) {
    throw new DragonTowerDefenseDomainError('invalid_transition', 'This defense can no longer be cancelled.', {
      defenseId: defense.id,
      status: defense.status
    });
  }

  return recalculateDragonTowerDefenseCounts({
    ...defense,
    status: 'cancelled',
    phase: 'closed',
    result: 'cancelled',
    completedByMemberId: cancelledByMemberId,
    completedAt: now.toISOString(),
    endedAt: defense.endedAt ?? now.toISOString(),
    notes: reason ?? defense.notes,
    updatedAt: now.toISOString()
  });
}

export function validateDragonTowerDefenseTimeRange(startsAt: string, endedAt?: string | null) {
  if (!isValidTimestamp(startsAt)) {
    throw new DragonTowerDefenseDomainError('invalid_time_range', 'Defense start time must be a valid timestamp.', { startsAt });
  }

  if (endedAt && (!isValidTimestamp(endedAt) || Date.parse(endedAt) < Date.parse(startsAt))) {
    throw new DragonTowerDefenseDomainError('invalid_time_range', 'Defense end time cannot be before start time.', { startsAt, endedAt });
  }
}

export function preventDuplicateActiveDefenseForEvent(defenses: DragonTowerDefense[], candidate: DragonTowerDefense) {
  const duplicate = defenses.find(
    (defense) =>
      defense.id !== candidate.id &&
      defense.eventId === candidate.eventId &&
      ['scheduled', 'gathering', 'active'].includes(defense.status) &&
      ['scheduled', 'gathering', 'active'].includes(candidate.status)
  );

  if (duplicate) {
    throw new DragonTowerDefenseDomainError('duplicate_active_event', 'A live defense already exists for this event.', {
      eventId: candidate.eventId,
      existingDefenseId: duplicate.id
    });
  }
}

export function calculateDragonDefenseRosterCounts(defense: DragonTowerDefense) {
  return {
    noResponse: defense.responses.filter((entry) => entry.response === 'no-response').length,
    available: defense.responses.filter((entry) => entry.response === 'available').length,
    joining: defense.responses.filter((entry) => entry.response === 'joining').length,
    confirmed: defense.responses.filter((entry) => entry.response === 'confirmed').length,
    unavailable: defense.responses.filter((entry) => entry.response === 'unavailable').length,
    present: defense.attendance.filter((entry) => entry.status === 'present').length,
    late: defense.attendance.filter((entry) => entry.status === 'late').length,
    absent: defense.attendance.filter((entry) => entry.status === 'absent').length,
    excused: defense.attendance.filter((entry) => entry.status === 'excused').length
  };
}

export function calculateDragonDefenseReadiness(defense: DragonTowerDefense): DragonDefenseReadiness {
  const confirmed = defense.responses.filter((entry) => entry.response === 'confirmed' || entry.response === 'joining').length;
  if (confirmed === 0) return 'critical';
  if (confirmed < defense.minimumGuardCount) return 'insufficient';
  if (confirmed >= defense.recommendedGuardCount) return 'reinforced';
  return 'ready';
}

export function recalculateDragonTowerDefenseCounts(defense: DragonTowerDefense): DragonTowerDefense {
  return {
    ...defense,
    participantCount: defense.responses.filter((entry) => entry.response !== 'no-response' && entry.response !== 'unavailable').length,
    confirmedCount: defense.responses.filter((entry) => entry.response === 'confirmed').length
  };
}

export function filterDragonTowerDefenses(defenses: DragonTowerDefense[], filters: DragonTowerDefenseFilters) {
  const search = filters.search.trim().toLowerCase();

  return defenses.filter((defense) => {
    if (filters.status !== 'all' && defense.status !== filters.status) return false;
    if (filters.result !== 'all' && defense.result !== filters.result) return false;
    if (filters.priority !== 'all' && defense.priority !== filters.priority) return false;
    if (filters.tower && defense.tower.towerId !== filters.tower && defense.tower.towerCode !== filters.tower) return false;
    if (filters.commander && defense.commanderMemberId !== filters.commander) return false;
    if (filters.participant && !defense.responses.some((response) => response.memberId === filters.participant)) return false;
    if (!search) return true;

    return [
      defense.title,
      defense.description,
      defense.tower.towerName,
      defense.tower.towerCode,
      defense.tower.location.label,
      defense.notes ?? '',
      defense.failureReason ?? ''
    ].some((value) => value.toLowerCase().includes(search));
  });
}

export function sortDragonTowerDefenses(defenses: DragonTowerDefense[]) {
  return [...defenses].sort((left, right) => {
    const leftLive = Number(['gathering', 'active'].includes(left.status));
    const rightLive = Number(['gathering', 'active'].includes(right.status));
    return rightLive - leftLive || left.startsAt.localeCompare(right.startsAt);
  });
}

export function getDragonTowerDefenseStatistics(defenses: DragonTowerDefense[]): DragonTowerDefenseStatistics {
  const eligible = defenses.filter((defense) => defense.statisticsEligible);
  const completed = eligible.filter((defense) => defense.status === 'completed');
  const defended = completed.filter((defense) => defense.result === 'defended').length;
  const lost = completed.filter((defense) => defense.result === 'lost').length;
  const confirmedAttendance = eligible.reduce((sum, defense) => {
    return sum + defense.attendance.filter((entry) => entry.status === 'present' || entry.status === 'late').length;
  }, 0);

  return {
    totalDefenses: eligible.length,
    defended,
    lost,
    successRate: completed.length === 0 ? 0 : Math.round((defended / completed.length) * 100),
    totalConfirmedAttendance: confirmedAttendance,
    averageGuardCount: completed.length === 0 ? 0 : Math.round((confirmedAttendance / completed.length) * 10) / 10,
    mostDefendedTower: getMostDefendedTower(completed)
  };
}

export function buildDragonDefenseHistory(defenses: DragonTowerDefense[], members: DragonMember[] = []): DragonTowerDefenseHistoryEntry[] {
  return defenses
    .filter((defense) => defense.status === 'completed' || defense.status === 'cancelled')
    .sort((left, right) => (right.completedAt ?? right.startsAt).localeCompare(left.completedAt ?? left.startsAt))
    .map((defense) => ({
      id: `history-${defense.id}`,
      defenseId: defense.id,
      eventId: defense.eventId,
      towerName: defense.tower.towerName,
      occurredAt: defense.completedAt ?? defense.startsAt,
      result: defense.result,
      commanderName: getMemberName(members, defense.commanderMemberId),
      participantCount: defense.participantCount,
      confirmedAttendance: defense.attendance.filter((entry) => entry.status === 'present' || entry.status === 'late').length,
      xp: defense.xp,
      rewardIds: defense.rewardIds,
      durationMinutes: getDefenseDurationMinutes(defense)
    }));
}

export function buildDragonFireGuardRoster(defense: DragonTowerDefense | null, members: DragonMember[]): DragonFireGuardRosterEntry[] {
  return members
    .map((member) => {
      const response = defense?.responses.find((entry) => entry.memberId === member.id);
      const attendance = defense?.attendance.find((entry) => entry.memberId === member.id);
      const availability = getMockFireGuardAvailability(member);

      return {
        memberId: member.id,
        displayName: member.discordNickname,
        avatarUrl: member.avatarUrl,
        familyRank: member.rank,
        fireGuardRole: getFireGuardRole(member),
        fireGuardStatus: member.status === 'offline' ? 'reserve' as const : 'active' as const,
        availability,
        currentResponse: response?.response ?? 'no-response',
        attendance: attendance?.status ?? 'unconfirmed',
        contribution: attendance?.contribution,
        note: response?.note ?? attendance?.note,
        discord: {
          discordUserId: member.discordNickname,
          discordUsername: member.discordNickname
        },
        onlineStatus: {
          mode: 'mock_manual' as const,
          label: availability === 'manual-online' || availability === 'mock-available' ? 'Manual/mock available' : 'Manual/mock unavailable',
          observedAt: member.lastActiveAt
        }
      };
    })
    .sort((left, right) => RESPONSE_ORDER[right.currentResponse] - RESPONSE_ORDER[left.currentResponse] || left.displayName.localeCompare(right.displayName));
}

export function filterDragonFireGuardRoster(roster: DragonFireGuardRosterEntry[], filter: string) {
  if (filter === 'all') return roster;
  if (filter === 'available') return roster.filter((entry) => entry.availability === 'manual-online' || entry.availability === 'mock-available');
  if (filter === 'responded') return roster.filter((entry) => !['no-response', 'unavailable'].includes(entry.currentResponse));
  if (filter === 'confirmed') return roster.filter((entry) => entry.currentResponse === 'confirmed');
  if (filter === 'unavailable') return roster.filter((entry) => entry.currentResponse === 'unavailable' || entry.availability === 'mock-busy');
  return roster.filter((entry) => entry.currentResponse === 'no-response');
}

export function projectTowerDefenseToDragonEvent(defense: DragonTowerDefense, members: DragonMember[] = []): DragonEvent {
  const commander = getMember(defense.commanderMemberId, members);
  const creator = getMember(defense.createdByMemberId, members);
  const participants = defense.responses
    .filter((response) => response.response !== 'no-response' && response.response !== 'unavailable')
    .sort((left, right) => RESPONSE_ORDER[right.response] - RESPONSE_ORDER[left.response])
    .map((response) => {
      const member = getMember(response.memberId, members);
      return {
        id: response.memberId,
        name: member?.discordNickname ?? response.memberId,
        role: response.response === 'confirmed' ? 'Confirmed Fire Guard' : 'Fire Guard'
      };
    });

  return {
    id: defense.eventId,
    backendEventId: `tower-defense:${defense.backendDefenseId}`,
    title: defense.title,
    description: `${defense.description} Readiness: ${calculateDragonDefenseReadiness(defense)}.`,
    type: 'tower_defense',
    category: 'defense',
    status: mapDefenseStatusToEventStatus(defense.status),
    priority: defense.priority as DragonEventPriority,
    visibility: 'members',
    owner: {
      id: defense.commanderMemberId,
      name: commander?.discordNickname ?? 'Fire Guard Command',
      role: 'Commander'
    },
    creator: {
      id: defense.createdByMemberId,
      name: creator?.discordNickname ?? 'Dragon House',
      role: 'Defense creator'
    },
    participants,
    participantCount: participants.length,
    maxParticipants: defense.maximumGuardCount,
    location: {
      label: `${defense.tower.towerName} - ${defense.tower.location.label}`,
      kind: 'map_zone',
      backendLocationId: defense.tower.location.backendLocationId
    },
    calendar: {
      enabled: true,
      calendarEventId: defense.eventId,
      stableEventKey: buildDragonTowerDefenseStableEventKey(defense),
      colorKey: `tower-defense-${calculateDragonDefenseReadiness(defense)}`
    },
    startsAt: defense.startsAt,
    endsAt: defense.endedAt,
    allDay: defense.allDay,
    timezone: defense.timezone,
    repeat: { frequency: 'none' },
    tags: ['tower-defense', 'fire-guard', defense.tower.towerCode, defense.status],
    rewards: defense.rewardIds.map((rewardId) => ({ id: rewardId, type: 'xp', label: rewardId, value: defense.xp, backendRewardId: rewardId })),
    xp: defense.xp,
    achievementIds: defense.achievementIds,
    questIds: [],
    towerDefense: {
      defenseId: defense.id,
      towerId: defense.tower.towerId,
      towerName: defense.tower.towerName,
      towerCode: defense.tower.towerCode,
      commanderMemberId: defense.commanderMemberId,
      readiness: calculateDragonDefenseReadiness(defense),
      defenseStatus: defense.status,
      waveId: defense.wave ? `wave-${defense.wave}` : undefined,
      attendance: defense.attendance.map((entry) => ({ memberId: entry.memberId, status: entry.status })),
      result: mapDefenseResultToEventResult(defense),
      rewardId: defense.rewardIds[0],
      futureFields: {
        participantCount: defense.participantCount,
        confirmedCount: defense.confirmedCount,
        leaderboardEligible: defense.leaderboardEligible,
        statisticsEligible: defense.statisticsEligible
      }
    },
    notifications: {
      enabled: true,
      channels: ['hub', 'popup', 'discord'],
      reminders: [{ offsetMinutes: 30 }, { offsetMinutes: 5 }]
    },
    discord: defense.discord ? {
      guildId: defense.discord.guildId ?? undefined,
      channelId: defense.discord.channelId ?? undefined,
      messageId: defense.discord.messageId ?? undefined,
      voiceChannelId: defense.discord.voiceChannelId ?? undefined,
      syncedAt: defense.discord.syncedAt ?? undefined
    } : undefined,
    createdAt: defense.createdAt,
    updatedAt: defense.updatedAt,
    source: {
      sourceModule: 'tower_defense',
      sourceId: defense.id
    },
    futureMetadata: {
      achievementLinks: defense.achievementIds,
      completionMetadata: {
        defenseId: defense.id,
        eventId: defense.eventId,
        result: defense.result,
        xp: defense.xp
      },
      extensionSlots: {
        towerDefense: defense.backendMetadata ?? {}
      }
    }
  };
}

export function reconcileTowerDefenseEvent(events: DragonEvent[], defense: DragonTowerDefense, members: DragonMember[] = []) {
  const projected = projectTowerDefenseToDragonEvent(defense, members);
  const stableKey = projected.calendar.stableEventKey;
  const withoutDuplicate = events.filter((event) => event.id !== projected.id && event.calendar.stableEventKey !== stableKey);
  return [...withoutDuplicate, projected];
}

export function buildTowerDefenseCompletionOutput(defense: DragonTowerDefense): DragonTowerDefenseCompletionOutput {
  return {
    defenseId: defense.id,
    eventId: defense.eventId,
    participantIds: defense.attendance
      .filter((entry) => entry.status === 'present' || entry.status === 'late')
      .map((entry) => entry.memberId),
    commanderMemberId: defense.commanderMemberId,
    attendance: defense.attendance,
    result: defense.result,
    xp: defense.xp,
    rewardIds: defense.rewardIds,
    achievementIds: defense.achievementIds,
    leaderboardEligible: defense.leaderboardEligible,
    statisticsEligible: defense.statisticsEligible
  };
}

export function buildTowerDefenseProfileTimeline(defenses: DragonTowerDefense[], memberId: string): DragonTowerDefenseProfileTimelineEntry[] {
  return defenses.flatMap((defense) => {
    const entries: DragonTowerDefenseProfileTimelineEntry[] = [];
    const response = defense.responses.find((entry) => entry.memberId === memberId);
    const attendance = defense.attendance.find((entry) => entry.memberId === memberId);

    if (response && response.response !== 'no-response' && response.response !== 'unavailable') {
      entries.push({
        id: `td-response-${defense.id}-${memberId}`,
        defenseId: defense.id,
        eventId: defense.eventId,
        memberId,
        occurredAt: response.respondedAt ?? defense.updatedAt,
        action: 'responded',
        title: 'Responded to tower defense',
        description: `${memberId} responded to ${defense.tower.towerName}.`
      });
    }

    if (response?.response === 'confirmed') {
      entries.push({
        id: `td-confirmed-${defense.id}-${memberId}`,
        defenseId: defense.id,
        eventId: defense.eventId,
        memberId,
        occurredAt: response.respondedAt ?? defense.updatedAt,
        action: 'confirmed',
        title: 'Confirmed Fire Guard response',
        description: `${memberId} confirmed participation for ${defense.tower.towerName}.`
      });
    }

    if (attendance && ['present', 'late'].includes(attendance.status)) {
      entries.push({
        id: `td-attended-${defense.id}-${memberId}`,
        defenseId: defense.id,
        eventId: defense.eventId,
        memberId,
        occurredAt: attendance.confirmedAt ?? defense.updatedAt,
        action: 'attended',
        title: 'Attended tower defense',
        description: `${memberId} was marked ${attendance.status} at ${defense.tower.towerName}.`
      });
    }

    if (defense.commanderMemberId === memberId && defense.status === 'completed') {
      entries.push({
        id: `td-commanded-${defense.id}-${memberId}`,
        defenseId: defense.id,
        eventId: defense.eventId,
        memberId,
        occurredAt: defense.completedAt ?? defense.startsAt,
        action: 'commanded',
        title: 'Commanded tower defense',
        description: `${memberId} commanded ${defense.tower.towerName}.`
      });
    }

    if (defense.status === 'completed' && attendance && ['present', 'late'].includes(attendance.status)) {
      entries.push({
        id: `td-result-${defense.id}-${memberId}`,
        defenseId: defense.id,
        eventId: defense.eventId,
        memberId,
        occurredAt: defense.completedAt ?? defense.startsAt,
        action: defense.result === 'defended' ? 'defended' : 'lost',
        title: DRAGON_DEFENSE_RESULT_LABELS[defense.result],
        description: `${defense.tower.towerName}: ${DRAGON_DEFENSE_RESULT_LABELS[defense.result]}.`
      });
    }

    return entries;
  }).sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
}

export function buildDragonTowerDefenseStableEventKey(defense: DragonTowerDefense) {
  return `tower-defense:${defense.id}`;
}

export function buildDragonTowerDefenseEventId(defenseId: string) {
  return `event-${defenseId}`;
}

export function formatDragonDefenseDateTime(value: string) {
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

export function getDragonDefenseStatusLabel(status: DragonDefenseStatus) {
  return DRAGON_DEFENSE_STATUS_LABELS[status];
}

export function getDragonDefenseResultLabel(result: DragonDefenseResult) {
  return DRAGON_DEFENSE_RESULT_LABELS[result];
}

function mapDefenseStatusToEventStatus(status: DragonDefenseStatus): DragonEventStatus {
  if (status === 'active') return 'active';
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'draft') return 'draft';
  return 'scheduled';
}

function mapDefenseResultToEventResult(defense: DragonTowerDefense) {
  if (defense.result === 'defended') return 'victory' as const;
  if (defense.result === 'lost') return 'defeat' as const;
  if (defense.status === 'active' || defense.status === 'gathering') return 'in_progress' as const;
  return 'scheduled' as const;
}

function getDefenseDurationMinutes(defense: DragonTowerDefense) {
  if (!defense.endedAt) return undefined;
  return Math.max(0, Math.round((Date.parse(defense.endedAt) - Date.parse(defense.startsAt)) / 60000));
}

function getMostDefendedTower(defenses: DragonTowerDefense[]) {
  const counts = new Map<string, { towerName: string; count: number }>();
  defenses
    .filter((defense) => defense.result === 'defended')
    .forEach((defense) => {
      const current = counts.get(defense.tower.towerId) ?? { towerName: defense.tower.towerName, count: 0 };
      counts.set(defense.tower.towerId, { ...current, count: current.count + 1 });
    });

  return Array.from(counts.values()).sort((left, right) => right.count - left.count)[0];
}

function getMember(memberId: string, members: DragonMember[]) {
  return members.find((member) => member.id === memberId) ?? null;
}

function getMemberName(members: DragonMember[], memberId: string) {
  return getMember(memberId, members)?.discordNickname ?? memberId;
}

function getMockFireGuardAvailability(member: DragonMember): DragonFireGuardAvailability {
  if (member.status === 'online' || member.status === 'in_voice') return 'manual-online';
  if (member.status === 'recently_active') return 'mock-available';
  if (member.status === 'away') return 'manual-away';
  return 'mock-busy';
}

function getFireGuardRole(member: DragonMember): DragonFireGuardRole {
  if (member.rankLevel >= 5) return 'commander';
  if (member.rankLevel >= 4) return 'vanguard';
  if (member.rankLevel >= 2) return 'support';
  return 'reserve';
}

function isValidTimestamp(value: string) {
  return value.includes('T') && !Number.isNaN(Date.parse(value));
}

function stableKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '') || 'tower';
}
