import type {
  DragonDefenseAttendanceStatus,
  DragonDefensePhase,
  DragonDefensePriority,
  DragonDefenseResult,
  DragonDefenseStatus,
  DragonFireGuardAvailability,
  DragonFireGuardRole,
  DragonGuardResponseStatus,
  DragonTowerDefinition,
  DragonTowerDefense,
  DragonTowerMapMetadata,
  DragonTowerVisualMetadata
} from '../entrypoints/dashboard/family/tower-defense-models.ts';
import type {
  BackendDefenseAttendanceDto,
  BackendDefenseResponseDto,
  BackendFireGuardRosterDto,
  BackendTowerDefenseDto,
  BackendTowerDto
} from './family-tower-defense-backend-response.ts';

const DEFENSE_STATUSES: DragonDefenseStatus[] = ['draft', 'scheduled', 'gathering', 'active', 'completed', 'cancelled'];
const DEFENSE_RESULTS: DragonDefenseResult[] = ['pending', 'defended', 'lost', 'cancelled'];
const DEFENSE_PRIORITIES: DragonDefensePriority[] = ['low', 'normal', 'high', 'critical'];
const DEFENSE_PHASES: DragonDefensePhase[] = ['planning', 'signal', 'forming', 'combat', 'reporting', 'closed'];
const RESPONSE_STATUSES: DragonGuardResponseStatus[] = ['no-response', 'available', 'joining', 'confirmed', 'unavailable'];
const ATTENDANCE_STATUSES: DragonDefenseAttendanceStatus[] = ['unconfirmed', 'present', 'late', 'absent', 'excused'];
const FIRE_GUARD_ROLES: DragonFireGuardRole[] = ['commander', 'vanguard', 'driver', 'scout', 'support', 'reserve'];

export function mapBackendTower(tower: BackendTowerDto): DragonTowerDefinition {
  return {
    id: tower.id,
    backendTowerId: tower.id,
    towerCode: tower.towerCode,
    towerName: tower.name,
    location: {
      label: tower.locationLabel,
      backendLocationId: readString(tower.metadata.backendLocationId)
    },
    map: mapTowerMap(tower.mapMetadata),
    visual: mapTowerVisual(tower),
    active: tower.isActive,
    source: 'backend'
  };
}

export function mapBackendTowerDefense(defense: BackendTowerDefenseDto): DragonTowerDefense {
  const tower = mapBackendTower(defense.tower);
  return {
    id: defense.id,
    dataSource: 'backend',
    backendDefenseId: defense.id,
    eventId: defense.eventProjectionKey,
    title: defense.title,
    description: defense.description,
    tower: {
      towerId: defense.tower.id,
      towerName: defense.tower.name,
      towerCode: defense.tower.towerCode,
      location: tower.location,
      map: tower.map,
      visual: tower.visual
    },
    status: safeEnum(defense.status, DEFENSE_STATUSES, 'draft'),
    priority: safeEnum(defense.priority, DEFENSE_PRIORITIES, 'normal'),
    scheduledAt: defense.scheduledAt ?? defense.startsAt,
    startsAt: defense.startsAt,
    endedAt: defense.endedAt,
    timezone: defense.timezone,
    allDay: false,
    wave: Math.max(1, defense.wave),
    phase: safeEnum(defense.phase, DEFENSE_PHASES, phaseForStatus(defense.status)),
    commanderMemberId: defense.commanderFamilyMemberId,
    createdByMemberId: defense.createdByFamilyMemberId,
    minimumGuardCount: defense.minimumGuardCount,
    recommendedGuardCount: defense.recommendedGuardCount,
    maximumGuardCount: defense.maximumGuardCount,
    responses: defense.responses.map(mapBackendDefenseResponse),
    attendance: defense.attendance.map(mapBackendDefenseAttendance),
    participantCount: defense.participantCount,
    confirmedCount: defense.confirmedCount,
    result: safeEnum(defense.result, DEFENSE_RESULTS, 'pending'),
    score: defense.score,
    contribution: undefined,
    notes: defense.notes,
    failureReason: defense.failureReason,
    completedByMemberId: defense.completedByFamilyMemberId,
    completedAt: defense.completedAt,
    xp: defense.xp,
    rewardIds: [],
    achievementIds: [],
    leaderboardEligible: defense.leaderboardEligible,
    statisticsEligible: defense.statisticsEligible,
    source: {
      sourceModule: 'tower_defense',
      sourceId: defense.id,
      backendFields: {
        defenseId: 'id',
        towerId: 'tower.id',
        eventProjectionKey: 'eventProjectionKey'
      }
    },
    discord: defense.discord,
    backendMetadata: {
      dataSource: 'backend',
      presentCount: defense.presentCount,
      externalSource: defense.externalSource,
      externalId: defense.externalId,
      syncIdempotencyKey: defense.syncIdempotencyKey
    },
    createdAt: defense.createdAt,
    updatedAt: defense.updatedAt
  };
}

export function mapBackendFireGuardRosterEntry(entry: BackendFireGuardRosterDto, activeDefense?: DragonTowerDefense | null) {
  const response = activeDefense?.responses.find((item) => item.memberId === entry.familyMemberId);
  const attendance = activeDefense?.attendance.find((item) => item.memberId === entry.familyMemberId);
  return {
    memberId: entry.familyMemberId,
    backendRosterId: entry.id,
    backendFamilyMemberId: entry.familyMemberId,
    displayName: entry.displayName,
    avatarUrl: readString(entry.metadata.avatarUrl) ?? null,
    familyRank: readString(entry.metadata.familyRank) ?? 'Fire Guard',
    fireGuardRole: safeEnum(entry.role, FIRE_GUARD_ROLES, 'support'),
    fireGuardStatus: safeFireGuardStatus(entry.status),
    availability: availabilityForStatus(entry.status),
    currentResponse: response?.response ?? 'no-response',
    attendance: attendance?.status ?? 'unconfirmed',
    contribution: attendance?.contribution,
    note: entry.note,
    discord: {
      discordUserId: entry.discordUserId,
      discordUsername: entry.discordUsername
    },
    onlineStatus: {
      mode: 'api' as const,
      label: `Backend roster: ${safeFireGuardStatus(entry.status)}`,
      observedAt: entry.updatedAt,
      backendPresenceField: 'family_fire_guard_roster.status'
    },
    source: 'backend' as const
  };
}

function mapBackendDefenseResponse(response: BackendDefenseResponseDto) {
  return {
    memberId: response.familyMemberId,
    backendResponseId: response.id,
    backendFamilyMemberId: response.familyMemberId,
    response: safeEnum(response.response, RESPONSE_STATUSES, 'no-response'),
    respondedAt: response.respondedAt,
    note: response.note,
    source: safeSource(response.source)
  };
}

function mapBackendDefenseAttendance(attendance: BackendDefenseAttendanceDto) {
  return {
    memberId: attendance.familyMemberId,
    backendAttendanceId: attendance.id,
    backendFamilyMemberId: attendance.familyMemberId,
    status: safeEnum(attendance.status, ATTENDANCE_STATUSES, 'unconfirmed'),
    confirmedByMemberId: attendance.confirmedByFamilyMemberId,
    confirmedAt: attendance.confirmedAt,
    note: attendance.note,
    contribution: {
      score: attendance.score ?? undefined,
      damageBlocked: attendance.damageBlocked ?? undefined,
      suppliesUsed: attendance.suppliesUsed ?? undefined,
      notes: attendance.contributionNotes ?? undefined
    }
  };
}

function mapTowerMap(metadata: Record<string, unknown>): DragonTowerMapMetadata {
  return {
    x: readNumber(metadata.x),
    y: readNumber(metadata.y),
    zone: readString(metadata.zone),
    backendMapId: readString(metadata.backendMapId)
  };
}

function mapTowerVisual(tower: BackendTowerDto): DragonTowerVisualMetadata | undefined {
  const visual = isRecord(tower.metadata.visual) ? tower.metadata.visual : {};
  const mapped = {
    icon: readString(visual.icon) ?? tower.iconAssetId ?? undefined,
    imageUrl: tower.imageAssetId,
    markerColor: readString(visual.markerColor)
  };
  return mapped.icon || mapped.imageUrl || mapped.markerColor ? mapped : undefined;
}

function safeSource(source: string): 'manual' | 'discord' | 'api' {
  return source === 'discord' || source === 'api' ? source : 'manual';
}

function safeFireGuardStatus(status: string): 'active' | 'reserve' | 'resting' | 'unavailable' {
  return status === 'active' || status === 'reserve' || status === 'resting' || status === 'unavailable' ? status : 'unavailable';
}

function availabilityForStatus(status: string): DragonFireGuardAvailability {
  if (status === 'active') return 'manual-online';
  if (status === 'reserve' || status === 'resting') return 'manual-away';
  return 'manual-offline';
}

function phaseForStatus(status: string): DragonDefensePhase {
  if (status === 'gathering') return 'forming';
  if (status === 'active') return 'combat';
  if (status === 'completed' || status === 'cancelled') return 'closed';
  return 'planning';
}

function safeEnum<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
