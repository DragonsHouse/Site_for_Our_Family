import type { DragonEntity } from '../data/models/entity';

export type DragonAchievementRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type DragonAchievementVisibility = 'visible' | 'hidden' | 'secret';
export type DragonAchievementCategory =
  | 'tower_defense'
  | 'quest'
  | 'meeting'
  | 'attendance'
  | 'activity'
  | 'community'
  | 'leadership'
  | 'discord'
  | 'events'
  | 'seasonal'
  | 'founder'
  | 'special';

export type DragonAchievementRewardType =
  | 'xp'
  | 'money'
  | 'role_unlock'
  | 'badge'
  | 'decoration'
  | 'artifact'
  | 'inventory_item'
  | 'profile_frame'
  | 'title';

export type DragonAchievementRequirement = {
  id: string;
  label: string;
  target: number;
  current: number;
  backendField: string;
};

export type DragonAchievementReward = {
  id: string;
  type: DragonAchievementRewardType;
  label: string;
  value: string | number;
  backendRewardId?: string;
};

export type DragonAchievementFutureMetadata = {
  sourceModule?: 'profile' | 'tower_defense' | 'quest_board' | 'calendar' | 'members' | 'notifications' | 'discord';
  backendSeasonId?: string;
  startsAt?: string;
  endsAt?: string;
  backendFields?: Record<string, string>;
};

export type DragonAchievement = DragonEntity & {
  backendAchievementId: string;
  title: string;
  description: string;
  category: DragonAchievementCategory;
  rarity: DragonAchievementRarity;
  visibility: DragonAchievementVisibility;
  icon: string;
  points: number;
  xp: number;
  progress: number;
  progressMax: number;
  completed: boolean;
  completedAt?: string | null;
  requirements: DragonAchievementRequirement[];
  rewards: DragonAchievementReward[];
  seasonal: boolean;
  hiddenUntilUnlocked: boolean;
  repeatable: boolean;
  futureMetadata: DragonAchievementFutureMetadata;
};

export type DragonAchievementFilters = {
  category: DragonAchievementCategory | 'all';
  rarity: DragonAchievementRarity | 'all';
  visibility: DragonAchievementVisibility | 'all';
  completion: 'all' | 'locked' | 'unlocked';
  search: string;
};

export type DragonAchievementStatistics = {
  unlocked: number;
  locked: number;
  completionPercent: number;
  legendaryCount: number;
  currentXp: number;
  totalXp: number;
  recentUnlocks: DragonAchievement[];
};

export const DRAGON_ACHIEVEMENT_CATEGORY_LABELS: Record<DragonAchievementCategory, string> = {
  tower_defense: 'Оборона вишок',
  quest: 'Квести',
  meeting: 'Зустрічі',
  attendance: 'Відвідування',
  activity: 'Активність',
  community: 'Спільнота',
  leadership: 'Лідерство',
  discord: 'Discord',
  events: 'Події',
  seasonal: 'Сезонні',
  founder: 'Засновники',
  special: 'Особливі'
};

export const DRAGON_ACHIEVEMENT_RARITY_META: Record<
  DragonAchievementRarity,
  { label: string; score: number; tone: 'ember' | 'gold' | 'success' | 'muted' | 'danger'; className: string }
> = {
  common: { label: 'Звичайна', score: 1, tone: 'muted', className: 'dh-engine-rarity-common' },
  uncommon: { label: 'Незвичайна', score: 2, tone: 'success', className: 'dh-engine-rarity-uncommon' },
  rare: { label: 'Рідкісна', score: 3, tone: 'success', className: 'dh-engine-rarity-rare' },
  epic: { label: 'Епічна', score: 4, tone: 'ember', className: 'dh-engine-rarity-epic' },
  legendary: { label: 'Легендарна', score: 5, tone: 'gold', className: 'dh-engine-rarity-legendary' },
  mythic: { label: 'Міфічна', score: 6, tone: 'danger', className: 'dh-engine-rarity-mythic' }
};

export const DRAGON_ACHIEVEMENT_VISIBILITY_LABELS: Record<DragonAchievementVisibility, string> = {
  visible: 'Відкрита',
  hidden: 'Прихована',
  secret: 'Таємна'
};
