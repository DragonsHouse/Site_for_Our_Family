import {
  DRAGON_ACHIEVEMENT_RARITY_META,
  type DragonAchievement,
  type DragonAchievementCategory,
  type DragonAchievementFilters,
  type DragonAchievementRarity,
  type DragonAchievementStatistics,
  type DragonAchievementVisibility
} from './achievement-models';

export const DEFAULT_ACHIEVEMENT_FILTERS: DragonAchievementFilters = {
  category: 'all',
  rarity: 'all',
  visibility: 'all',
  completion: 'all',
  search: ''
};

export function unlockDragonAchievement(achievement: DragonAchievement, completedAt = currentDragonDate()): DragonAchievement {
  return {
    ...achievement,
    completed: true,
    completedAt,
    progress: achievement.progressMax,
    requirements: achievement.requirements.map((requirement) => ({ ...requirement, current: requirement.target }))
  };
}

export function updateDragonAchievementProgress(achievement: DragonAchievement, progress: number): DragonAchievement {
  const nextProgress = clampAchievementProgress(progress, achievement.progressMax);
  const completed = nextProgress >= achievement.progressMax;

  return {
    ...achievement,
    progress: nextProgress,
    completed,
    completedAt: completed ? achievement.completedAt ?? currentDragonDate() : achievement.completedAt,
    requirements: achievement.requirements.map((requirement) => ({
      ...requirement,
      current: clampAchievementProgress(requirement.current + (nextProgress - achievement.progress), requirement.target)
    }))
  };
}

export function getDragonAchievementProgressPercent(achievement: DragonAchievement) {
  if (achievement.progressMax <= 0) return achievement.completed ? 100 : 0;
  return Math.round((clampAchievementProgress(achievement.progress, achievement.progressMax) / achievement.progressMax) * 100);
}

export function isDragonAchievementVisible(achievement: DragonAchievement, revealSecrets = false) {
  if (achievement.completed) return true;
  if (achievement.visibility === 'secret') return revealSecrets;
  if (achievement.hiddenUntilUnlocked) return false;
  return achievement.visibility === 'visible' || achievement.visibility === 'hidden';
}

export function filterDragonAchievements(
  achievements: DragonAchievement[],
  filters: DragonAchievementFilters = DEFAULT_ACHIEVEMENT_FILTERS,
  revealSecrets = false
) {
  const search = filters.search.trim().toLowerCase();

  return achievements.filter((achievement) => {
    if (!isDragonAchievementVisible(achievement, revealSecrets)) return false;
    if (filters.category !== 'all' && achievement.category !== filters.category) return false;
    if (filters.rarity !== 'all' && achievement.rarity !== filters.rarity) return false;
    if (filters.visibility !== 'all' && achievement.visibility !== filters.visibility) return false;
    if (filters.completion === 'locked' && achievement.completed) return false;
    if (filters.completion === 'unlocked' && !achievement.completed) return false;
    if (!search) return true;

    return [achievement.title, achievement.description, achievement.backendAchievementId].some((value) => value.toLowerCase().includes(search));
  });
}

export function sortDragonAchievements(achievements: DragonAchievement[]) {
  return [...achievements].sort((left, right) => {
    const byCompletion = Number(right.completed) - Number(left.completed);
    if (byCompletion) return byCompletion;

    const byRarity = DRAGON_ACHIEVEMENT_RARITY_META[right.rarity].score - DRAGON_ACHIEVEMENT_RARITY_META[left.rarity].score;
    if (byRarity) return byRarity;

    const byProgress = getDragonAchievementProgressPercent(right) - getDragonAchievementProgressPercent(left);
    return byProgress || left.title.localeCompare(right.title);
  });
}

export function groupDragonAchievementsByCategory(achievements: DragonAchievement[]) {
  return achievements.reduce<Record<DragonAchievementCategory, DragonAchievement[]>>((groups, achievement) => {
    groups[achievement.category] = [...(groups[achievement.category] ?? []), achievement];
    return groups;
  }, {} as Record<DragonAchievementCategory, DragonAchievement[]>);
}

export function getDragonAchievementStatistics(achievements: DragonAchievement[]): DragonAchievementStatistics {
  const unlocked = achievements.filter((achievement) => achievement.completed);
  const totalXp = achievements.reduce((sum, achievement) => sum + achievement.xp, 0);
  const currentXp = unlocked.reduce((sum, achievement) => sum + achievement.xp, 0);

  return {
    unlocked: unlocked.length,
    locked: achievements.length - unlocked.length,
    completionPercent: achievements.length ? Math.round((unlocked.length / achievements.length) * 100) : 0,
    legendaryCount: unlocked.filter((achievement) => achievement.rarity === 'legendary' || achievement.rarity === 'mythic').length,
    currentXp,
    totalXp,
    recentUnlocks: getRecentDragonAchievementUnlocks(achievements)
  };
}

export function getRecentDragonAchievementUnlocks(achievements: DragonAchievement[], limit = 3) {
  return achievements
    .filter((achievement) => achievement.completed && achievement.completedAt)
    .sort((left, right) => (right.completedAt ?? '').localeCompare(left.completedAt ?? ''))
    .slice(0, limit);
}

export function compareDragonAchievementRarity(left: DragonAchievementRarity, right: DragonAchievementRarity) {
  return DRAGON_ACHIEVEMENT_RARITY_META[left].score - DRAGON_ACHIEVEMENT_RARITY_META[right].score;
}

export function getDragonAchievementVisibilityLabel(visibility: DragonAchievementVisibility) {
  return visibility === 'secret' ? 'Secret' : visibility === 'hidden' ? 'Hidden' : 'Visible';
}

function clampAchievementProgress(value: number, max: number) {
  return Math.max(0, Math.min(max, value));
}

function currentDragonDate() {
  return new Date().toISOString().slice(0, 10);
}
