export type BackendAchievementDefinitionDto = {
  id: string;
  achievementKey: string;
  name: string;
  description: string;
  category: 'quests' | 'tower_defense' | 'events' | 'activity' | 'leadership' | 'streak' | 'special';
  icon: string | null;
  imageMetadata: Record<string, unknown>;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  active: boolean;
  repeatable: boolean;
  hidden: boolean;
  ruleMetadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type BackendMemberAchievementDto = {
  id: string;
  familyMemberId: string;
  achievementId: string;
  sourceModule: string;
  sourceId: string;
  sourceKey: string;
  awardedAt: string;
  awardedByFamilyMemberId: string | null;
  metadata: Record<string, unknown>;
  achievement: BackendAchievementDefinitionDto;
  createdAt: string;
};

export type BackendRewardDefinitionDto = {
  id: string;
  rewardKey: string;
  name: string;
  description: string;
  rewardType: 'money' | 'xp' | 'item' | 'badge' | 'custom';
  amount: number | null;
  value: string | null;
  currency: string | null;
  metadata: Record<string, unknown>;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BackendMemberRewardGrantDto = {
  id: string;
  familyMemberId: string;
  rewardId: string;
  sourceModule: string;
  sourceId: string;
  sourceKey: string;
  status: 'earned' | 'approved' | 'issued' | 'cancelled';
  grantedAt: string;
  approvedAt: string | null;
  approvedByFamilyMemberId: string | null;
  issuedAt: string | null;
  issuedByFamilyMemberId: string | null;
  financeAccrualId: string | null;
  financeTransferredAt: string | null;
  metadata: Record<string, unknown>;
  reward: BackendRewardDefinitionDto;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type BackendRewardQueueItemDto = BackendMemberRewardGrantDto & {
  member: {
    id: string;
    displayName: string;
  } | null;
  finance: {
    accrualId: string | null;
    transferredAt: string | null;
    status: 'not_applicable' | 'not_transferred' | 'accrued';
  };
};

export type BackendLeaderboardResponse = {
  period: 'current_month' | 'previous_month' | 'all_time';
  category: 'overall' | 'tower_defense' | 'quests' | 'events';
  scoring: Record<string, number>;
  items: Array<{
    familyMemberId: string;
    displayName: string;
    rank: number;
    place: number;
    score: number;
    metrics: Record<string, number>;
  }>;
};

export class FamilyAchievementsApiError extends Error {
  readonly code: 'BACKEND_UNAVAILABLE' | 'REQUEST_FAILED' | 'MALFORMED_RESPONSE';
  readonly status: number;

  constructor(message: string, code: 'BACKEND_UNAVAILABLE' | 'REQUEST_FAILED' | 'MALFORMED_RESPONSE', status = 0) {
    super(message);
    this.name = 'FamilyAchievementsApiError';
    this.code = code;
    this.status = status;
  }
}

export function assertAchievementListResponse(value: unknown): { items: BackendAchievementDefinitionDto[] } {
  if (!isRecord(value) || !Array.isArray(value.items)) throw malformed('Achievement catalog response was malformed');
  return { items: value.items.map(assertAchievementDefinition) };
}

export function assertMemberAchievementListResponse(value: unknown): { items: BackendMemberAchievementDto[] } {
  if (!isRecord(value) || !Array.isArray(value.items)) throw malformed('Member achievement response was malformed');
  return { items: value.items.map(assertMemberAchievement) };
}

export function assertRewardListResponse(value: unknown): { items: BackendRewardDefinitionDto[] } {
  if (!isRecord(value) || !Array.isArray(value.items)) throw malformed('Reward catalog response was malformed');
  return { items: value.items.map(assertRewardDefinition) };
}

export function assertMemberRewardListResponse(value: unknown): { items: BackendMemberRewardGrantDto[]; permissions: { canViewSensitiveRewards: boolean } } {
  if (!isRecord(value) || !Array.isArray(value.items) || !isRecord(value.permissions) || typeof value.permissions.canViewSensitiveRewards !== 'boolean') {
    throw malformed('Member reward response was malformed');
  }
  return { items: value.items.map(assertMemberRewardGrant), permissions: { canViewSensitiveRewards: value.permissions.canViewSensitiveRewards } };
}

export function assertRewardPendingResponse(value: unknown): { items: BackendRewardQueueItemDto[] } {
  if (!isRecord(value) || !Array.isArray(value.items)) throw malformed('Pending reward response was malformed');
  return { items: value.items.map(assertRewardQueueItem) };
}

export function assertLeaderboardResponse(value: unknown): BackendLeaderboardResponse {
  if (!isRecord(value) || typeof value.period !== 'string' || typeof value.category !== 'string' || !isRecord(value.scoring) || !Array.isArray(value.items)) {
    throw malformed('Leaderboard response was malformed');
  }
  return value as BackendLeaderboardResponse;
}

function assertAchievementDefinition(value: unknown): BackendAchievementDefinitionDto {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.achievementKey !== 'string' || typeof value.name !== 'string' || typeof value.description !== 'string' || typeof value.category !== 'string' || typeof value.rarity !== 'string') {
    throw malformed('Achievement definition was malformed');
  }
  return value as BackendAchievementDefinitionDto;
}

function assertMemberAchievement(value: unknown): BackendMemberAchievementDto {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.familyMemberId !== 'string' || !isRecord(value.achievement)) {
    throw malformed('Member achievement was malformed');
  }
  return { ...value, achievement: assertAchievementDefinition(value.achievement) } as BackendMemberAchievementDto;
}

function assertRewardDefinition(value: unknown): BackendRewardDefinitionDto {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.rewardKey !== 'string' || typeof value.name !== 'string' || typeof value.rewardType !== 'string') {
    throw malformed('Reward definition was malformed');
  }
  return value as BackendRewardDefinitionDto;
}

function assertMemberRewardGrant(value: unknown): BackendMemberRewardGrantDto {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.familyMemberId !== 'string' || typeof value.status !== 'string' || !isRecord(value.reward)) {
    throw malformed('Member reward grant was malformed');
  }
  return {
    ...value,
    approvedAt: typeof value.approvedAt === 'string' ? value.approvedAt : null,
    approvedByFamilyMemberId: typeof value.approvedByFamilyMemberId === 'string' ? value.approvedByFamilyMemberId : null,
    financeAccrualId: typeof value.financeAccrualId === 'string' ? value.financeAccrualId : null,
    financeTransferredAt: typeof value.financeTransferredAt === 'string' ? value.financeTransferredAt : null,
    version: typeof value.version === 'number' ? value.version : 1,
    reward: assertRewardDefinition(value.reward),
  } as BackendMemberRewardGrantDto;
}

function assertRewardQueueItem(value: unknown): BackendRewardQueueItemDto {
  const grant = assertMemberRewardGrant(value);
  const record = value as Record<string, unknown>;
  return {
    ...grant,
    member: isRecord(record.member) && typeof record.member.id === 'string' && typeof record.member.displayName === 'string'
      ? { id: record.member.id, displayName: record.member.displayName }
      : null,
    finance: isRecord(record.finance)
      ? {
        accrualId: typeof record.finance.accrualId === 'string' ? record.finance.accrualId : null,
        transferredAt: typeof record.finance.transferredAt === 'string' ? record.finance.transferredAt : null,
        status: record.finance.status === 'accrued' || record.finance.status === 'not_transferred' || record.finance.status === 'not_applicable' ? record.finance.status : 'not_applicable',
      }
      : { accrualId: null, transferredAt: null, status: 'not_applicable' },
  };
}

function malformed(message: string): FamilyAchievementsApiError {
  return new FamilyAchievementsApiError(message, 'MALFORMED_RESPONSE');
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
