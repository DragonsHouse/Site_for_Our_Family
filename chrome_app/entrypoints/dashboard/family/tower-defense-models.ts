import type { DragonEntity } from '../data/models/entity';
import type { DragonEvent } from './dragon-event-models';

export type DragonDefenseStatus = 'draft' | 'scheduled' | 'gathering' | 'active' | 'completed' | 'cancelled';
export type DragonDefenseResult = 'pending' | 'defended' | 'lost' | 'cancelled';
export type DragonGuardResponseStatus = 'no-response' | 'available' | 'joining' | 'confirmed' | 'unavailable';
export type DragonDefenseAttendanceStatus = 'unconfirmed' | 'present' | 'late' | 'absent' | 'excused';
export type DragonDefensePriority = 'low' | 'normal' | 'high' | 'critical';
export type DragonDefenseReadiness = 'critical' | 'insufficient' | 'ready' | 'reinforced';
export type DragonDefensePhase = 'planning' | 'signal' | 'forming' | 'combat' | 'reporting' | 'closed';
export type DragonFireGuardRole = 'commander' | 'vanguard' | 'driver' | 'scout' | 'support' | 'reserve';
export type DragonFireGuardAvailability = 'manual-online' | 'manual-away' | 'manual-offline' | 'mock-available' | 'mock-busy';
export type DragonTowerDefenseRosterFilter = 'all' | 'available' | 'responded' | 'confirmed' | 'unavailable' | 'no-response';

export type DragonTowerMapMetadata = {
  x?: number;
  y?: number;
  zone?: string;
  backendMapId?: string;
};

export type DragonTowerVisualMetadata = {
  icon?: string;
  imageUrl?: string | null;
  markerColor?: string;
};

export type DragonGuardContribution = {
  score?: number;
  damageBlocked?: number;
  suppliesUsed?: number;
  notes?: string;
};

export type DragonGuardResponse = {
  memberId: string;
  response: DragonGuardResponseStatus;
  respondedAt?: string | null;
  note?: string | null;
  source?: 'manual' | 'discord' | 'api';
};

export type DragonDefenseAttendance = {
  memberId: string;
  status: DragonDefenseAttendanceStatus;
  confirmedByMemberId?: string | null;
  confirmedAt?: string | null;
  contribution?: DragonGuardContribution;
  note?: string | null;
};

export type DragonFireGuardRosterEntry = {
  memberId: string;
  displayName: string;
  avatarUrl?: string | null;
  familyRank: string;
  fireGuardRole: DragonFireGuardRole;
  fireGuardStatus: 'active' | 'reserve' | 'resting' | 'unavailable';
  availability: DragonFireGuardAvailability;
  currentResponse: DragonGuardResponseStatus;
  attendance: DragonDefenseAttendanceStatus;
  contribution?: DragonGuardContribution;
  note?: string | null;
  discord?: {
    discordUserId?: string | null;
    discordUsername?: string | null;
  };
  onlineStatus?: {
    mode: 'mock_manual' | 'discord_live' | 'api';
    label: string;
    observedAt?: string | null;
    backendPresenceField?: string;
  };
};

export type DragonTowerDefenseCompletionOutput = {
  defenseId: string;
  eventId: string;
  participantIds: string[];
  commanderMemberId: string;
  attendance: DragonDefenseAttendance[];
  result: DragonDefenseResult;
  xp: number;
  rewardIds: string[];
  achievementIds: string[];
  leaderboardEligible: boolean;
  statisticsEligible: boolean;
};

export type DragonTowerDefenseHistoryEntry = {
  id: string;
  defenseId: string;
  eventId: string;
  towerName: string;
  occurredAt: string;
  result: DragonDefenseResult;
  commanderName: string;
  participantCount: number;
  confirmedAttendance: number;
  xp: number;
  rewardIds: string[];
  durationMinutes?: number | null;
};

export type DragonTowerDefenseProfileTimelineEntry = {
  id: string;
  defenseId: string;
  eventId: string;
  memberId: string;
  occurredAt: string;
  action: 'responded' | 'confirmed' | 'attended' | 'commanded' | 'defended' | 'lost';
  title: string;
  description: string;
};

export type DragonTowerDefenseStatistics = {
  totalDefenses: number;
  defended: number;
  lost: number;
  successRate: number;
  totalConfirmedAttendance: number;
  averageGuardCount: number;
  mostDefendedTower?: { towerName: string; count: number };
};

export type DragonTowerDefense = DragonEntity & {
  backendDefenseId: string;
  eventId: string;
  title: string;
  description: string;
  tower: {
    towerId: string;
    towerName: string;
    towerCode: string;
    location: {
      label: string;
      backendLocationId?: string;
    };
    map: DragonTowerMapMetadata;
    visual?: DragonTowerVisualMetadata;
  };
  status: DragonDefenseStatus;
  priority: DragonDefensePriority;
  scheduledAt: string;
  startsAt: string;
  endedAt?: string | null;
  timezone: string;
  allDay: boolean;
  wave: number;
  phase: DragonDefensePhase;
  commanderMemberId: string;
  createdByMemberId: string;
  minimumGuardCount: number;
  recommendedGuardCount: number;
  maximumGuardCount: number;
  responses: DragonGuardResponse[];
  attendance: DragonDefenseAttendance[];
  participantCount: number;
  confirmedCount: number;
  result: DragonDefenseResult;
  score?: number | null;
  contribution?: DragonGuardContribution;
  notes?: string | null;
  failureReason?: string | null;
  completedByMemberId?: string | null;
  completedAt?: string | null;
  xp: number;
  rewardIds: string[];
  achievementIds: string[];
  leaderboardEligible: boolean;
  statisticsEligible: boolean;
  source: {
    sourceModule: 'tower_defense';
    sourceId: string;
    backendFields?: Record<string, string>;
  };
  discord?: {
    guildId?: string | null;
    channelId?: string | null;
    messageId?: string | null;
    voiceChannelId?: string | null;
    syncedAt?: string | null;
  };
  backendMetadata?: Record<string, string | number | boolean | null>;
  createdAt: string;
  updatedAt: string;
};

export type DragonTowerDefenseFilters = {
  status: DragonDefenseStatus | 'all';
  result: DragonDefenseResult | 'all';
  priority: DragonDefensePriority | 'all';
  tower: string;
  commander: string;
  participant: string;
  search: string;
};

export type DragonTowerDefenseCreateInput = {
  id?: string;
  backendDefenseId?: string;
  eventId?: string;
  title: string;
  description: string;
  towerId: string;
  towerName: string;
  towerCode: string;
  location: DragonTowerDefense['tower']['location'];
  map: DragonTowerMapMetadata;
  visual?: DragonTowerVisualMetadata;
  status?: DragonDefenseStatus;
  priority?: DragonDefensePriority;
  scheduledAt?: string;
  startsAt: string;
  endedAt?: string | null;
  timezone: string;
  allDay?: boolean;
  wave?: number;
  phase?: DragonDefensePhase;
  commanderMemberId: string;
  createdByMemberId: string;
  minimumGuardCount: number;
  recommendedGuardCount: number;
  maximumGuardCount: number;
  responses?: DragonGuardResponse[];
  attendance?: DragonDefenseAttendance[];
  result?: DragonDefenseResult;
  score?: number | null;
  contribution?: DragonGuardContribution;
  notes?: string | null;
  failureReason?: string | null;
  completedByMemberId?: string | null;
  completedAt?: string | null;
  xp?: number;
  rewardIds?: string[];
  achievementIds?: string[];
  leaderboardEligible?: boolean;
  statisticsEligible?: boolean;
  source?: DragonTowerDefense['source'];
  discord?: DragonTowerDefense['discord'];
  backendMetadata?: DragonTowerDefense['backendMetadata'];
};

export type DragonTowerDefenseEventProjection = {
  defense: DragonTowerDefense;
  event: DragonEvent;
  completion?: DragonTowerDefenseCompletionOutput;
};
