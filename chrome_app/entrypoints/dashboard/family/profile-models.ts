import type { FamilyPermission } from '../../../lib/family-types';
import type { DragonEntity } from '../data/models/entity';

export type DragonProfileStatus = 'online' | 'offline' | 'away' | 'in_voice' | 'recently_active';
export type DragonProfileAchievementState = 'locked' | 'unlocked' | 'secret';
export type DragonProfileAchievementRarity = 'common' | 'rare' | 'legendary';
export type DragonProfileTimelineKind =
  | 'joined'
  | 'nickname_changed'
  | 'promotion'
  | 'birthday'
  | 'quest_completed'
  | 'tower_defense'
  | 'family_meeting'
  | 'discord_sync';

export type DragonProfileIdentity = {
  avatarUrl?: string | null;
  dragonName: string;
  discordNickname: string;
  dragonTitle: string;
  currentRank: string;
  rankLevel: number;
  element: string;
  birthday?: string | null;
  joinDate?: string | null;
  currentStatus: DragonProfileStatus;
  staticId: string;
  familyBranch: string;
  bannerTitle: string;
};

export type DragonProfileStatistic = {
  id: string;
  label: string;
  value: string;
  detail: string;
  trend: string;
  progress?: number;
  backendMetricKey: string;
};

export type DragonProfileAchievement = DragonEntity & {
  backendAchievementId: string;
  icon: string;
  title: string;
  description: string;
  state: DragonProfileAchievementState;
  rarity: DragonProfileAchievementRarity;
  unlockedAt?: string | null;
  progress: number;
};

export type DragonProfileTimelineEvent = DragonEntity & {
  backendEventId: string;
  kind: DragonProfileTimelineKind;
  occurredAt: string;
  title: string;
  description: string;
  source: 'manual' | 'discord' | 'calendar' | 'quest' | 'system';
};

export type DragonInventoryCategory = {
  id: string;
  title: string;
  description: string;
  slots: Array<{
    id: string;
    label: string;
    state: 'empty' | 'reserved' | 'earned';
    backendItemId?: string | null;
  }>;
};

export type DragonPermissionSeal = {
  id: FamilyPermission | 'discord_administration';
  label: string;
  description: string;
  granted: boolean;
  backendPermissionKey: string;
};

export type DragonActivityDay = {
  date: string;
  value: number;
  backendActivityId?: string;
};

export type DragonRankRequirement = {
  id: string;
  label: string;
  completed: boolean;
  currentValue?: string;
  requiredValue?: string;
};

export type DragonDiscordPlaceholder = {
  id: string;
  label: string;
  value: string;
  state: 'linked' | 'pending' | 'reserved';
  backendField: string;
};

export type DragonProfile = DragonEntity & {
  identity: DragonProfileIdentity;
  statistics: DragonProfileStatistic[];
  achievements: DragonProfileAchievement[];
  timeline: DragonProfileTimelineEvent[];
  inventory: DragonInventoryCategory[];
  permissions: DragonPermissionSeal[];
  activity: DragonActivityDay[];
  progress: {
    currentRank: string;
    nextRank: string;
    progress: number;
    futureXp: number | null;
    requirements: DragonRankRequirement[];
  };
  discord: DragonDiscordPlaceholder[];
};

export const DRAGON_PROFILE_STATUS_META: Record<
  DragonProfileStatus,
  { label: string; tone: 'ember' | 'gold' | 'success' | 'muted' | 'danger'; className: string }
> = {
  online: { label: 'Online', tone: 'success', className: 'dh-profile-status-online' },
  offline: { label: 'Offline', tone: 'muted', className: 'dh-profile-status-offline' },
  away: { label: 'Away', tone: 'gold', className: 'dh-profile-status-away' },
  in_voice: { label: 'In Voice', tone: 'ember', className: 'dh-profile-status-voice' },
  recently_active: { label: 'Recently Active', tone: 'success', className: 'dh-profile-status-recent' }
};

export const DRAGON_ACHIEVEMENT_RARITY_META: Record<
  DragonProfileAchievementRarity,
  { label: string; tone: 'ember' | 'gold' | 'success' | 'muted' | 'danger'; className: string }
> = {
  common: { label: 'Common', tone: 'muted', className: 'dh-achievement-common' },
  rare: { label: 'Rare', tone: 'success', className: 'dh-achievement-rare' },
  legendary: { label: 'Legendary', tone: 'gold', className: 'dh-achievement-legendary' }
};
