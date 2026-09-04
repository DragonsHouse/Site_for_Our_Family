import type { DragonAchievement, DragonAchievementCategory, DragonAchievementRewardType } from '../entrypoints/dashboard/family/achievement-models.ts';
import type { BackendAchievementDefinitionDto, BackendMemberAchievementDto, BackendMemberRewardGrantDto } from './family-achievements-backend-response.ts';

export function mapBackendAchievement(definition: BackendAchievementDefinitionDto, awards: BackendMemberAchievementDto[] = [], rewards: BackendMemberRewardGrantDto[] = []): DragonAchievement {
  const award = awards.find((item) => item.achievementId === definition.id || item.achievement.achievementKey === definition.achievementKey);
  const completed = Boolean(award);
  return {
    id: `achievement:${definition.id}`,
    backendAchievementId: definition.id,
    title: definition.name,
    description: definition.description,
    category: mapCategory(definition.category),
    rarity: definition.rarity,
    visibility: definition.hidden ? 'hidden' : 'visible',
    icon: definition.icon ?? definition.achievementKey,
    points: completed ? rarityPoints(definition.rarity) : 0,
    xp: rewards.filter((grant) => grant.reward.rewardType === 'xp').reduce((sum, grant) => sum + (grant.reward.amount ?? 0), 0),
    progress: completed ? 1 : 0,
    progressMax: 1,
    completed,
    completedAt: award?.awardedAt ?? null,
    requirements: [{
      id: `requirement:${definition.achievementKey}`,
      label: definition.name,
      target: 1,
      current: completed ? 1 : 0,
      backendField: String(definition.ruleMetadata.rule ?? definition.achievementKey),
    }],
    rewards: rewards.map((grant) => ({
      id: grant.id,
      type: mapRewardType(grant.reward.rewardType),
      label: grant.reward.name,
      value: grant.reward.value ?? grant.reward.amount ?? grant.status,
      backendRewardId: grant.reward.id,
    })),
    seasonal: false,
    hiddenUntilUnlocked: definition.hidden,
    repeatable: definition.repeatable,
    futureMetadata: {
      sourceModule: mapSourceModule(definition.category),
      backendFields: { achievementKey: definition.achievementKey },
    },
  };
}

function mapCategory(category: BackendAchievementDefinitionDto['category']): DragonAchievementCategory {
  if (category === 'quests') return 'quest';
  if (category === 'events') return 'events';
  if (category === 'streak') return 'activity';
  if (category === 'special') return 'special';
  return category;
}

function mapSourceModule(category: BackendAchievementDefinitionDto['category']): DragonAchievement['futureMetadata']['sourceModule'] {
  if (category === 'quests') return 'quest_board';
  if (category === 'tower_defense') return 'tower_defense';
  if (category === 'events') return 'calendar';
  return 'profile';
}

function mapRewardType(type: BackendMemberRewardGrantDto['reward']['rewardType']): DragonAchievementRewardType {
  if (type === 'item') return 'inventory_item';
  if (type === 'custom') return 'artifact';
  return type;
}

function rarityPoints(rarity: BackendAchievementDefinitionDto['rarity']): number {
  return { common: 10, uncommon: 20, rare: 40, epic: 80, legendary: 150, mythic: 300 }[rarity];
}
