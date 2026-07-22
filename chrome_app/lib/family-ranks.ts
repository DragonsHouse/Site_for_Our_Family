import type {
  FamilyRank,
  FamilyUser,
  MemberRankProgress,
  PromotionRequirement,
  RankProgression,
  RankRequirement
} from './family-types';

export const FAMILY_RANKS: FamilyRank[] = [
  { level: 10, title: 'Володарка Предвічного Полум’я / Засновник', subtitle: 'Засновник', isFounderOnly: true },
  { level: 9, title: 'Хранитель Полум’я' },
  { level: 8, title: 'Старійшина' },
  { level: 7, title: 'Буревогонь / Крилатий' },
  { level: 6, title: 'Гримуча Луска' },
  {
    level: 5,
    title: 'Півкрило Полум’я',
    isLeaderRank: true,
    access: ['Сейф', 'Активація квестів', 'Підтвердження звітів']
  },
  { level: 4, title: 'Жаринка Луската' },
  { level: 3, title: 'Димохвіст' },
  { level: 2, title: 'Міні-Спопелялка' },
  { level: 1, title: 'Яйце дракона' }
];

const req = (
  id: string,
  type: RankRequirement['type'],
  label: string,
  requiredValue?: number | boolean | string,
  verifierRankLevel?: number,
  verifierLabel?: string
): RankRequirement => ({ id, type, label, requiredValue, verifierRankLevel, verifierLabel });

export const RANK_PROGRESSIONS: RankProgression[] = [
  {
    fromLevel: 1,
    toLevel: 2,
    title: '1 Яйце дракона → 2 Міні-Спопелялка',
    requirements: [
      req('r1-quests', 'quests_total', '2 квести сумарно', 2),
      req('r1-days', 'days_in_family', '3 дні у сім’ї', 3),
      req('r1-surname', 'surname_dragons', 'Зміна прізвища на Dragons', true),
      req('r1-marks', 'marks_max', '0 міток', 0),
      req('r1-verify', 'recommendation', 'Підтверджує Вожак 5+', true, 5, 'Вожак 5+')
    ],
    notes: ['Можна допомагати, не обов’язково стартувати квест.']
  },
  {
    fromLevel: 2,
    toLevel: 3,
    title: '2 → 3 Димохвіст',
    requirements: [
      req('r2-quests', 'quests_total', '5 квестів сумарно', 5),
      req('r2-days', 'days_in_family', '1 тиждень у сім’ї', 7),
      req('r2-marks', 'marks_max', '0 міток', 0),
      req('r2-verify', 'recommendation', 'Підтверджує Вожак 5+', true, 5, 'Вожак 5+')
    ]
  },
  {
    fromLevel: 3,
    toLevel: 4,
    title: '3 → 4 Жаринка Луската',
    requirements: [
      req('r3-quests', 'quests_total', '10 квестів сумарно', 10),
      req('r3-days', 'days_in_family', '2 тижні у сім’ї', 14),
      req('r3-capture', 'capture_or_defense', 'Участь в 1 захопленні або обороні', 1),
      req('r3-marks', 'marks_max', '0 міток', 0),
      req('r3-verify', 'recommendation', 'Підтверджує Старший дракон 6+', true, 6, 'Старший дракон 6+')
    ]
  },
  {
    fromLevel: 4,
    toLevel: 5,
    title: '4 → 5 Півкрило Полум’я',
    requirements: [
      req('r4-quests', 'quests_total', '18 квестів сумарно', 18),
      req('r4-days', 'days_in_family', '3 тижні у сім’ї', 21),
      req('r4-organized', 'quests_organized', 'Сам організував 2 квести від початку до кінця', 2),
      req('r4-recommendation', 'recommendation', 'Рекомендація від Крилатого 7+', true, 7, 'Крилатий 7+'),
      req('r4-marks', 'marks_max', '0 міток', 0),
      req('r4-verify', 'recommendation', 'Підтверджує Крилатий 7+', true, 7, 'Крилатий 7+')
    ],
    notes: ['З рангу 5 користувач є Вожаком.']
  },
  {
    fromLevel: 5,
    toLevel: 6,
    title: '5 → 6 Гримуча Луска',
    requirements: [
      req('r5-quests', 'quests_total', '30 квестів сумарно', 30),
      req('r5-days', 'days_in_family', '1 місяць у сім’ї', 30),
      req('r5-capture', 'capture_or_defense', '3+ захоплення або оборони', 3),
      req('r5-weekly', 'weekly_activity_days', 'Стабільна активність 4+ днів на тиждень', 4),
      req('r5-recommendation', 'recommendation', 'Рекомендація від Крилатого 7+', true, 7, 'Крилатий 7+'),
      req('r5-verify', 'manual_council_decision', 'Підтверджує Старійшина 8+', true, 8, 'Старійшина 8+')
    ],
    notes: ['З рангу 6 підвищення не за заявкою. Рішення приймає Лігво Старійшин.']
  },
  {
    fromLevel: 6,
    toLevel: 7,
    title: '6 → 7 Буревогонь / Крилатий',
    requirements: [
      req('r6-quests', 'quests_total', '50 квестів сумарно', 50),
      req('r6-days', 'days_in_family', '2 місяці у сім’ї', 60),
      req('r6-brigade', 'brigade_lead_days', 'Керував бригадою мінімум 2 тижні', 14),
      req('r6-trained', 'new_members_trained', 'Навчив 2+ новачків', 2),
      req('r6-council', 'manual_council_decision', 'Рішення Лігва Старійшин', true)
    ]
  },
  {
    fromLevel: 7,
    toLevel: 8,
    title: '7 → 8 Старійшина',
    requirements: [
      req('r7-days', 'days_in_family', '3+ місяці у сім’ї', 90),
      req('r7-clean', 'clean_history', 'Чиста історія', true),
      req('r7-contribution', 'manual_council_decision', 'Значний внесок у розвиток Дому', true),
      req('r7-owner', 'manual_owner_decision', 'Особисте рішення Володарки', true)
    ]
  },
  {
    fromLevel: 8,
    toLevel: 9,
    title: '8 → 9 Хранитель Полум’я',
    requirements: [
      req('r8-owner', 'manual_owner_decision', 'Тільки за рішенням Володарки', true),
      req('r8-trust', 'clean_history', 'Абсолютна довіра', true)
    ]
  }
];

export function getFamilyRank(level: number): FamilyRank {
  return FAMILY_RANKS.find((rank) => rank.level === level) ?? FAMILY_RANKS[FAMILY_RANKS.length - 1];
}

function getStatValue(user: FamilyUser, requirement: RankRequirement): number | boolean | string | null {
  switch (requirement.type) {
    case 'quests_total':
      return user.stats.questsTotal;
    case 'days_in_family':
      return user.stats.daysInFamily;
    case 'surname_dragons':
      return user.nickname.endsWith('_Dragons');
    case 'marks_max':
      return user.stats.marks;
    case 'capture_or_defense':
      return user.stats.captureOrDefenseCount;
    case 'quests_organized':
      return user.stats.questsOrganized;
    case 'weekly_activity_days':
      return user.stats.weeklyActivityDays;
    case 'brigade_lead_days':
      return user.stats.brigadeLeadDays;
    case 'new_members_trained':
      return user.stats.newMembersTrained;
    case 'clean_history':
    case 'manual_owner_decision':
    case 'manual_council_decision':
    case 'recommendation': {
      const manual = [...user.promotionRequirements.completed, ...user.promotionRequirements.remaining]
        .find((item) => item.type === requirement.type || item.id === requirement.id);
      return manual?.completed ?? false;
    }
    default:
      return null;
  }
}

function isRequirementComplete(value: number | boolean | string | null, requirement: RankRequirement): boolean {
  if (typeof requirement.requiredValue === 'number') {
    if (requirement.type === 'marks_max') {
      return typeof value === 'number' && value <= requirement.requiredValue;
    }
    return typeof value === 'number' && value >= requirement.requiredValue;
  }
  if (typeof requirement.requiredValue === 'boolean') {
    return value === requirement.requiredValue;
  }
  if (typeof requirement.requiredValue === 'string') {
    return value === requirement.requiredValue;
  }
  return Boolean(value);
}

function toPromotionRequirement(user: FamilyUser, requirement: RankRequirement): PromotionRequirement {
  const currentValue = getStatValue(user, requirement);
  return {
    id: requirement.id,
    label: requirement.label,
    type: requirement.type,
    completed: isRequirementComplete(currentValue, requirement),
    currentValue,
    requiredValue: requirement.requiredValue ?? null,
    completedAt: null
  };
}

export function getMemberRankProgress(user: FamilyUser): MemberRankProgress {
  const currentRank = getFamilyRank(user.rankLevel);
  const progression = RANK_PROGRESSIONS.find((item) => item.fromLevel === user.rankLevel) ?? null;
  const nextRank = progression ? getFamilyRank(progression.toLevel) : null;
  const requirements = progression
    ? progression.requirements.map((requirement) => toPromotionRequirement(user, requirement))
    : [];
  const completedRequirements = requirements.filter((requirement) => requirement.completed);
  const remainingRequirements = requirements.filter((requirement) => !requirement.completed);
  const progressPercent = requirements.length
    ? Math.round((completedRequirements.length / requirements.length) * 100)
    : 100;

  return {
    currentRank,
    nextRank,
    progression,
    progressPercent,
    completedRequirements,
    remainingRequirements,
    nextStep: remainingRequirements[0] ?? null
  };
}
