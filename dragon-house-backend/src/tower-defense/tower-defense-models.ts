export type TowerDefenseStatus = 'draft' | 'scheduled' | 'gathering' | 'active' | 'completed' | 'cancelled';
export type TowerDefenseResult = 'pending' | 'defended' | 'lost' | 'cancelled';
export type TowerDefensePriority = 'low' | 'normal' | 'high' | 'critical';
export type TowerDefenseResponseStatus = 'no-response' | 'available' | 'joining' | 'confirmed' | 'unavailable';
export type TowerDefenseAttendanceStatus = 'unconfirmed' | 'present' | 'late' | 'absent' | 'excused';
export type FireGuardRole = 'commander' | 'vanguard' | 'driver' | 'scout' | 'support' | 'reserve';
export type FireGuardStatus = 'active' | 'reserve' | 'resting' | 'unavailable';
export type TowerDefenseSource = 'manual' | 'discord' | 'api';

export type TowerRecord = {
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

export type FireGuardRosterRecord = {
  id: string;
  familyMemberId: string;
  displayName: string;
  role: FireGuardRole;
  status: FireGuardStatus;
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

export type TowerDefenseResponseRecord = {
  id: string;
  defenseId: string;
  familyMemberId: string;
  displayName: string;
  response: TowerDefenseResponseStatus;
  respondedAt: string;
  note: string | null;
  source: TowerDefenseSource;
  externalSource: string | null;
  externalId: string | null;
  idempotencyKey: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type TowerDefenseAttendanceRecord = {
  id: string;
  defenseId: string;
  familyMemberId: string;
  displayName: string;
  status: TowerDefenseAttendanceStatus;
  confirmedByFamilyMemberId: string | null;
  confirmedAt: string | null;
  note: string | null;
  score: number | null;
  damageBlocked: number | null;
  suppliesUsed: number | null;
  contributionNotes: string | null;
  source: TowerDefenseSource;
  externalSource: string | null;
  externalId: string | null;
  idempotencyKey: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type TowerDefenseRecord = {
  id: string;
  tower: TowerRecord;
  title: string;
  description: string;
  status: TowerDefenseStatus;
  priority: TowerDefensePriority;
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
  result: TowerDefenseResult;
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
  responses: TowerDefenseResponseRecord[];
  attendance: TowerDefenseAttendanceRecord[];
};

export type TowerDefenseListQuery = {
  status?: TowerDefenseStatus | 'all' | null;
  result?: TowerDefenseResult | 'all' | null;
  priority?: TowerDefensePriority | 'all' | null;
  tower?: string | null;
  commander?: string | null;
  participant?: string | null;
  search?: string | null;
};

export type CreateTowerDefenseInput = {
  towerId: string;
  title: string;
  description?: string;
  status?: TowerDefenseStatus;
  priority?: TowerDefensePriority;
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
  discord?: Partial<TowerDefenseRecord['discord']>;
  externalSource?: string | null;
  externalId?: string | null;
  syncIdempotencyKey?: string | null;
  metadata?: Record<string, unknown>;
};

export type UpdateTowerDefenseInput = Partial<Omit<CreateTowerDefenseInput, 'syncIdempotencyKey'>> & {
  result?: TowerDefenseResult;
  score?: number | null;
  failureReason?: string | null;
  completedByFamilyMemberId?: string | null;
  completedAt?: string | null;
};

export type TowerDefenseCompletionOutput = {
  defenseId: string;
  eventProjectionKey: string;
  participantIds: string[];
  commanderFamilyMemberId: string;
  attendance: TowerDefenseAttendanceRecord[];
  result: TowerDefenseResult;
  xp: number;
  leaderboardEligible: boolean;
  statisticsEligible: boolean;
  rewardSource: {
    sourceType: 'tower_defense';
    sourceId: string;
    sourceKey: string;
  };
};

export type TowerDefenseDerivedCounts = {
  participantCount: number;
  confirmedCount: number;
  presentCount: number;
};
