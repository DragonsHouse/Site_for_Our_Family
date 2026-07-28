import type { FamilyUser } from '../../../lib/family-types';
import { createMockRepository } from '../data/repositories/mock-repository';
import type { Repository } from '../data/repositories/repository';
import { DRAGON_PROFILE_MOCK_DATA } from './profile-mock-data';
import type {
  DragonActivityDay,
  DragonProfile,
  DragonProfileAchievement,
  DragonProfileStatistic,
  DragonProfileTimelineEvent
} from './profile-models';

export type DragonProfileCreateInput = Omit<DragonProfile, 'id'>;
export type DragonProfileUpdateInput = Partial<DragonProfile>;
export type DragonProfileFilters = {
  memberId: string;
};

export type DragonProfileRepository = Repository<
  DragonProfile,
  DragonProfileCreateInput,
  DragonProfileUpdateInput,
  DragonProfileFilters
>;

export const mockDragonProfileRepository: DragonProfileRepository = createMockRepository<
  DragonProfile,
  DragonProfileCreateInput,
  DragonProfileUpdateInput,
  DragonProfileFilters
>(DRAGON_PROFILE_MOCK_DATA, (input) => ({
  id: globalThis.crypto?.randomUUID?.() ?? `profile-${Date.now()}`,
  ...input
}));

export function buildDragonProfileForUser(profile: DragonProfile | null, user: FamilyUser): DragonProfile {
  const base = profile ?? DRAGON_PROFILE_MOCK_DATA[0];
  const avatarUrl = user.discordAvatarUrl ?? user.avatarDataUrl ?? user.avatarUrl ?? base.identity.avatarUrl;
  const discordNickname = user.discordServerNickname ?? user.discordDisplayName ?? user.discordUsername ?? user.nickname;

  return {
    ...base,
    id: user.id,
    identity: {
      ...base.identity,
      avatarUrl,
      dragonName: user.displayName || user.nickname || base.identity.dragonName,
      discordNickname,
      dragonTitle: user.rank || base.identity.dragonTitle,
      currentRank: user.rank || base.identity.currentRank,
      rankLevel: user.rankLevel,
      birthday: base.identity.birthday,
      joinDate: user.joinedAt ?? base.identity.joinDate,
      currentStatus: user.isOnline ? 'online' : user.status === 'away' ? 'away' : user.lastActive ? 'recently_active' : 'offline',
      staticId: user.staticId || base.identity.staticId
    },
    statistics: mergeUserStatistics(base.statistics, user),
    permissions: base.permissions.map((permission) => ({
      ...permission,
      granted: permission.id === 'discord_administration' ? user.permissions.includes('manage_discord_integration') : user.permissions.includes(permission.id)
    })),
    progress: {
      ...base.progress,
      currentRank: user.rank || base.progress.currentRank,
      nextRank: user.nextRank ?? base.progress.nextRank,
      progress: clampProgress(user.promotionProgress || base.progress.progress)
    }
  };
}

export function getDragonProfilePrimaryStats(profile: DragonProfile) {
  return {
    achievementsUnlocked: profile.achievements.filter((achievement) => achievement.state === 'unlocked').length,
    legendaryAchievements: profile.achievements.filter((achievement) => achievement.rarity === 'legendary').length,
    grantedPermissions: profile.permissions.filter((permission) => permission.granted).length,
    activityTotal: profile.activity.reduce((total, day) => total + day.value, 0)
  };
}

export function sortDragonTimeline(timeline: DragonProfileTimelineEvent[]) {
  return [...timeline].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
}

export function sortDragonAchievements(achievements: DragonProfileAchievement[]) {
  const stateOrder = { unlocked: 3, locked: 2, secret: 1 } satisfies Record<DragonProfileAchievement['state'], number>;
  const rarityOrder = { legendary: 3, rare: 2, common: 1 } satisfies Record<DragonProfileAchievement['rarity'], number>;

  return [...achievements].sort((left, right) => {
    const byState = stateOrder[right.state] - stateOrder[left.state];
    if (byState) return byState;
    const byRarity = rarityOrder[right.rarity] - rarityOrder[left.rarity];
    return byRarity || left.title.localeCompare(right.title);
  });
}

export function getActivityIntensity(day: DragonActivityDay) {
  if (day.value <= 0) return 0;
  if (day.value <= 2) return 1;
  if (day.value <= 5) return 2;
  if (day.value <= 8) return 3;
  return 4;
}

export function formatDragonProfileDate(date?: string | null) {
  if (!date) return 'Reserved';
  return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${date}T00:00:00`));
}

function mergeUserStatistics(statistics: DragonProfileStatistic[], user: FamilyUser) {
  return statistics.map((statistic) => {
    const updates: Partial<Record<string, string>> = {
      events_joined: String(user.stats.eventsJoined || statistic.value),
      quests_completed: String(user.stats.questsTotal || statistic.value),
      activity_score: String(user.stats.contributionPoints || statistic.value),
      promotion_progress: `${clampProgress(user.promotionProgress || 0)}%`
    };

    return {
      ...statistic,
      value: updates[statistic.backendMetricKey] ?? statistic.value,
      progress: statistic.backendMetricKey === 'promotion_progress' ? clampProgress(user.promotionProgress || statistic.progress || 0) : statistic.progress
    };
  });
}

function clampProgress(value: number) {
  return Math.max(0, Math.min(100, value));
}
