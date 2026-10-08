import type { DragonAchievement, DragonAchievementCategory, DragonAchievementRewardType } from '../entrypoints/dashboard/family/achievement-models.ts';
import type { BackendAchievementDefinitionDto, BackendMemberAchievementDto, BackendMemberRewardGrantDto } from './family-achievements-backend-response.ts';

export function mapBackendAchievement(definition: BackendAchievementDefinitionDto, awards: BackendMemberAchievementDto[] = [], rewards: BackendMemberRewardGrantDto[] = []): DragonAchievement {
  const award = awards.find((item) => item.achievementId === definition.id || item.achievement.achievementKey === definition.achievementKey);
  const completed = Boolean(award);
  return {
    id: `achievement:${definition.id}`,
    backendAchievementId: definition.id,
    title: localizeAchievementTitle(definition.name, definition.achievementKey),
    description: localizeAchievementDescription(definition.description, definition.achievementKey),
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
      label: localizeAchievementRequirement(definition.achievementKey, definition.name),
      target: 1,
      current: completed ? 1 : 0,
      backendField: String(definition.ruleMetadata.rule ?? definition.achievementKey),
    }],
    rewards: rewards.map((grant) => ({
      id: grant.id,
      type: mapRewardType(grant.reward.rewardType),
      label: localizeRewardName(grant.reward.name),
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

function localizeAchievementTitle(name: string, key: string): string {
  const byKey: Record<string, string> = {
    quest_best_participant: 'Кращий учасник',
    event_organizer: 'Організатор подій',
    tower_commander: 'Командир вишки',
    watchtower_guardian: 'Вартовий вишки',
    tower_first_attended: 'Перший захист вишки',
    council_voice: 'Голос ради',
    first_flight: 'Перший політ',
    watchtower_initiate: 'Новачок вишки',
  };
  const byName: Record<string, string> = {
    'Best Participant': 'Кращий учасник',
    'Event Organizer': 'Організатор подій',
    'Tower Commander': 'Командир вишки',
    'Watchtower Guardian': 'Вартовий вишки',
    'Council Voice': 'Голос ради',
    'First Flight': 'Перший політ',
    'Watchtower Initiate': 'Новачок вишки',
  };
  const productTitles: Record<string, string> = {
    event_first_attended: 'Голос ради',
    tower_first_defended: 'Вартовий вишки',
    quest_first_completed: 'Перший політ',
  };
  return productTitles[key] ?? byKey[key] ?? byName[name] ?? name;
}

function localizeAchievementDescription(description: string, key: string): string {
  const descriptions: Record<string, string> = {
    quest_best_participant: 'Стати кращим учасником сімейного квесту.',
    event_organizer: 'Організувати сімейну подію.',
    tower_commander: 'Командувати обороною вишки.',
    watchtower_guardian: 'Брати участь в обороні вишок.',
    tower_first_attended: 'Узяти участь у першому захисті вишки.',
    council_voice: 'Брати участь у сімейних зустрічах.',
    first_flight: 'Узяти участь у першому сімейному квесті.',
    watchtower_initiate: 'Вперше відповісти на оборону вишки.',
  };
  const productDescriptions: Record<string, string> = {
    event_first_attended: 'Взяти участь у сімейній події.',
    tower_first_defended: 'Допомогти успішно захистити вишку.',
    quest_first_completed: 'Завершити перший сімейний квест і потрапити до спільної хроніки.',
  };
  return productDescriptions[key] ?? descriptions[key] ?? description;
}

function localizeAchievementRequirement(key: string, fallback: string): string {
  const requirements: Record<string, string> = {
    quest_best_participant: 'Стати кращим учасником квесту',
    event_organizer: 'Організувати подію',
    tower_commander: 'Командувати обороною',
    watchtower_guardian: 'Узяти участь в обороні вишки',
    tower_first_attended: 'Бути присутнім на захисті вишки',
    council_voice: 'Відвідати сімейну зустріч',
    first_flight: 'Узяти участь у першому сімейному квесті',
    watchtower_initiate: 'Відповісти на першу оборону вишки',
  };
  const productRequirements: Record<string, string> = {
    event_first_attended: 'Відвідати сімейну подію',
    tower_first_defended: 'Допомогти захистити вишку',
    quest_first_completed: 'Завершити перший сімейний квест',
  };
  return productRequirements[key] ?? requirements[key] ?? fallback;
}

function localizeRewardName(name: string): string {
  const names: Record<string, string> = {
    XP: 'XP',
    Badge: 'Відзнака',
    Money: 'Грошова нагорода',
    'Family bonus': 'Сімейна премія',
  };
  return names[name] ?? name;
}
