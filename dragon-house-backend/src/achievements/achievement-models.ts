export type AchievementCategory = 'quests' | 'tower_defense' | 'events' | 'activity' | 'leadership' | 'streak' | 'special';
export type AchievementRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type AchievementSourceModule = AchievementCategory | 'manual';
export type RewardType = 'money' | 'xp' | 'item' | 'badge' | 'custom';
export type RewardSourceModule = 'quests' | 'tower_defense' | 'events' | 'achievements' | 'activity' | 'manual';
export type RewardGrantStatus = 'earned' | 'approved' | 'issued' | 'cancelled';

export type AchievementDefinitionRecord = {
  id: string;
  achievementKey: string;
  name: string;
  description: string;
  category: AchievementCategory;
  icon: string | null;
  imageMetadata: Record<string, unknown>;
  rarity: AchievementRarity;
  active: boolean;
  repeatable: boolean;
  hidden: boolean;
  ruleMetadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type MemberAchievementRecord = {
  id: string;
  familyMemberId: string;
  achievementId: string;
  sourceModule: AchievementSourceModule;
  sourceId: string;
  sourceKey: string;
  awardedAt: string;
  awardedByFamilyMemberId: string | null;
  metadata: Record<string, unknown>;
  achievement: AchievementDefinitionRecord;
  createdAt: string;
};

export type RewardDefinitionRecord = {
  id: string;
  rewardKey: string;
  name: string;
  description: string;
  rewardType: RewardType;
  amount: number | null;
  value: string | null;
  currency: string | null;
  metadata: Record<string, unknown>;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MemberRewardGrantRecord = {
  id: string;
  familyMemberId: string;
  rewardId: string;
  sourceModule: RewardSourceModule;
  sourceId: string;
  sourceKey: string;
  status: RewardGrantStatus;
  grantedAt: string;
  approvedAt: string | null;
  approvedByFamilyMemberId: string | null;
  issuedAt: string | null;
  issuedByFamilyMemberId: string | null;
  financeAccrualId: string | null;
  financeTransferredAt: string | null;
  metadata: Record<string, unknown>;
  reward: RewardDefinitionRecord;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type AwardAchievementInput = {
  familyMemberId: string;
  achievementKey: string;
  sourceModule: AchievementSourceModule;
  sourceId: string;
  sourceKey: string;
  awardedAt: string;
  awardedByFamilyMemberId?: string | null;
  metadata?: Record<string, unknown>;
};

export type GrantRewardInput = {
  familyMemberId: string;
  rewardKey: string;
  sourceModule: RewardSourceModule;
  sourceId: string;
  sourceKey: string;
  status?: RewardGrantStatus;
  grantedAt: string;
  approvedAt?: string | null;
  approvedByFamilyMemberId?: string | null;
  issuedAt?: string | null;
  issuedByFamilyMemberId?: string | null;
  metadata?: Record<string, unknown>;
};

export type RewardGrantHistoryQuery = {
  status?: RewardGrantStatus | 'all' | null;
  rewardType?: RewardType | 'all' | null;
  sourceModule?: RewardSourceModule | 'all' | null;
  memberId?: string | null;
  from?: string | null;
  to?: string | null;
  limit: number;
};

export type RewardGrantListItem = MemberRewardGrantRecord & {
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

export type LeaderboardPeriod = 'current_month' | 'previous_month' | 'all_time';
export type LeaderboardCategory = 'overall' | 'tower_defense' | 'quests' | 'events';

export type LeaderboardMetrics = {
  towerDefenseAttended: number;
  towerDefenseDefended: number;
  towerDefenseCommanded: number;
  questsParticipated: number;
  questsCompleted: number;
  questBestParticipant: number;
  eventsAttended: number;
  eventsOrganized: number;
};

export type LeaderboardEntry = {
  familyMemberId: string;
  displayName: string;
  rank: number;
  place: number;
  score: number;
  metrics: LeaderboardMetrics;
};

export type LeaderboardResponse = {
  period: LeaderboardPeriod;
  category: LeaderboardCategory;
  scoring: Record<keyof LeaderboardMetrics, number>;
  items: LeaderboardEntry[];
};
