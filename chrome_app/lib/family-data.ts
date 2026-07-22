import { QUANTFUN_BASE_URL } from './constants';
import { assertNoMojibakeSeed, sanitizeFamilyTextDeep } from './text-sanitizer';
import type {
  FamilyAccountingMonth,
  FamilyBonus,
  FamilyEconomyEntry,
  FamilyMapReference,
  FamilyMapZone,
  FamilyPermission,
  FamilyPost,
  FamilyQuest,
  FamilyResource,
  FamilyRole,
  FamilyTask,
  FamilyUser,
  FamilyUserStats,
  QuantNewsItem,
  QuantNewsAdapter,
  RecruitmentSettings,
  ResourceCategory,
  ResourceLink
} from './family-types';

export const FAMILY_POSTS_KEY = 'dragon_house_family_posts_v1';

export const FAMILY_ROLE_LABELS: Record<FamilyRole, string> = {
  owner: 'Власник',
  deputy: 'Заступник',
  moderator: 'Модератор',
  member: 'Учасник'
};

export const ROLE_PERMISSIONS: Record<FamilyRole, FamilyPermission[]> = {
  owner: [
    'manage_users',
    'view_members',
    'manage_members',
    'manage_member_roles',
    'manage_member_auth',
    'delete_members',
    'restore_members',
    'view_member_private_fields',
    'manage_tasks',
    'manage_ranks',
    'view_private_notes',
    'manage_family_map',
    'manage_events',
    'manage_buyers',
    'manage_family_posts',
    'manage_family_news',
    'manage_news',
    'view_family_history',
    'manage_family_economy',
    'manage_family_quests',
    'manage_family_assets',
    'manage_discord_integration',
    'manage_backups',
    'manage_accounting',
    'manage_treasury',
    'manage_recruitment',
    'manage_resources',
    'manage_roles'
  ],
  deputy: [
    'manage_users',
    'view_members',
    'manage_members',
    'manage_member_roles',
    'manage_member_auth',
    'view_member_private_fields',
    'manage_tasks',
    'manage_ranks',
    'manage_family_map',
    'manage_events',
    'manage_buyers',
    'manage_family_posts',
    'manage_family_news',
    'manage_family_economy',
    'manage_family_quests',
    'manage_backups',
    'manage_accounting',
    'manage_treasury',
    'manage_recruitment',
    'manage_resources'
  ],
  moderator: [],
  member: []
};

export const DEFAULT_STATS: FamilyUserStats = {
  tasksDone: 0,
  eventsJoined: 0,
  weeklyActivity: 0,
  contributionPoints: 0,
  questsTotal: 0,
  daysInFamily: 0,
  marks: 0,
  captureOrDefenseCount: 0,
  questsOrganized: 0,
  weeklyActivityDays: 0,
  brigadeLeadDays: 0,
  newMembersTrained: 0
};

function defaultTasks(nickname: string, role: FamilyRole): FamilyTask[] {
  const now = '2026-07-07T00:00:00.000Z';
  if (role === 'owner') {
    return [
      {
        id: `${nickname}-family-hub-command`,
        title: 'Затвердити структуру Dragon House Family Hub',
        description: 'Перевірити навігацію, ролі, ресурси та сімейні секції.',
        status: 'in_progress',
        priority: 'high',
        assignedBy: nickname,
        assignedTo: nickname,
        source: 'manual',
        dueAt: null,
        createdAt: now,
        updatedAt: now
      }
    ];
  }

  if (role === 'deputy') {
    return [
      {
        id: `${nickname}-family-roster`,
        title: 'Підготувати список активних учасників',
        description: 'Перевірити nickname, static ID і ранги для майбутнього керування сім’єю.',
        status: 'todo',
        priority: 'normal',
        assignedBy: 'Anastasia_Dragons',
        assignedTo: nickname,
        source: 'manual',
        dueAt: null,
        createdAt: now,
        updatedAt: now
      }
    ];
  }

  return [
    {
      id: `${nickname}-first-family-task`,
      title: 'Виконати перше сімейне завдання',
      description: 'Деталі завдання уточнить старший склад Dragon House.',
      status: 'todo',
      priority: 'normal',
      assignedBy: 'Dragon House',
      assignedTo: nickname,
      source: 'manual',
      dueAt: null,
      createdAt: now,
      updatedAt: now
    }
  ];
}

function createUser(input: {
  id: string;
  nickname: string;
  staticId: string;
  role: FamilyRole;
  rank: string;
  rankLevel: number;
  nextRank: string | null;
  promotionProgress: number;
  joinedAt: string;
  statusMessage?: string | null;
  stats?: Partial<FamilyUserStats>;
}): FamilyUser {
  return {
    id: input.id,
    nickname: input.nickname,
    staticId: input.staticId,
    passwordHash: null,
    mustChangePassword: true,
    role: input.role,
    rank: input.rank,
    rankLevel: input.rankLevel,
    promotionProgress: input.promotionProgress,
    promotionRequirements: { completed: [], remaining: [] },
    lastActive: null,
    isOnline: false,
    displayName: input.nickname,
    avatarUrl: null,
    avatarDataUrl: null,
    status: 'offline',
    accountStatus: 'active',
    statusMessage: input.statusMessage ?? null,
    nextRank: input.nextRank,
    promotionUpdatedAt: '2026-07-07T00:00:00.000Z',
    joinedAt: input.joinedAt,
    notes: null,
    permissions: ROLE_PERMISSIONS[input.role],
    stats: { ...DEFAULT_STATS, ...input.stats },
    tasks: defaultTasks(input.nickname, input.role),
    deletedAt: null,
    discordUserId: null,
    discordUsername: null,
    discordDisplayName: null,
    discordAvatarUrl: null,
    discordLinkedAt: null,
    discordSyncedAt: null,
    discordLinkStatus: 'not_linked',
    externalSource: 'family_hub',
    externalId: null,
    externalRevision: null,
    externalCreatedAt: null,
    externalUpdatedAt: null,
    lastSyncedAt: null,
    syncStatus: 'local_only',
    syncError: null
  };
}

export const DEMO_FAMILY_USERS: FamilyUser[] = [
  createUser({
    id: 'a0b1c2d3-0001-4a00-8000-000000000001',
    nickname: 'Anastasia_Dragons',
    staticId: '41384',
    role: 'owner',
    rank: 'Володарка Предвічного Полум’я / Засновник',
    rankLevel: 10,
    nextRank: null,
    promotionProgress: 100,
    joinedAt: '2026-03-07',
    statusMessage: 'Найвищий рівень доступу',
    stats: {
      tasksDone: 12,
      eventsJoined: 8,
      weeklyActivity: 100,
      contributionPoints: 250,
      questsTotal: 80,
      daysInFamily: 122,
      marks: 0,
      captureOrDefenseCount: 10,
      questsOrganized: 12,
      weeklyActivityDays: 7,
      brigadeLeadDays: 40,
      newMembersTrained: 5
    }
  }),
  createUser({
    id: 'a0b1c2d3-0002-4a00-8000-000000000002',
    nickname: 'Marcel_Dragons',
    staticId: '6966',
    role: 'deputy',
    rank: 'Хранитель Полум’я',
    rankLevel: 9,
    nextRank: null,
    promotionProgress: 100,
    joinedAt: '2026-03-10',
    statusMessage: 'Хранитель Полум’я',
    stats: {
      tasksDone: 9,
      eventsJoined: 6,
      weeklyActivity: 82,
      contributionPoints: 180,
      questsTotal: 62,
      daysInFamily: 119,
      marks: 0,
      captureOrDefenseCount: 7,
      questsOrganized: 6,
      weeklyActivityDays: 5,
      brigadeLeadDays: 22,
      newMembersTrained: 3
    }
  }),
  createUser({
    id: 'a0b1c2d3-0003-4a00-8000-000000000003',
    nickname: 'Anatolii_Dragons',
    staticId: '1003',
    role: 'member',
    rank: 'Старійшина',
    rankLevel: 8,
    nextRank: 'Хранитель Полум’я',
    promotionProgress: 50,
    joinedAt: '2026-04-02',
    stats: {
      tasksDone: 5,
      eventsJoined: 4,
      weeklyActivity: 74,
      contributionPoints: 120,
      questsTotal: 48,
      daysInFamily: 96,
      marks: 0,
      captureOrDefenseCount: 4,
      questsOrganized: 3,
      weeklyActivityDays: 4,
      brigadeLeadDays: 16,
      newMembersTrained: 2
    }
  }),
  createUser({
    id: 'a0b1c2d3-0004-4a00-8000-000000000004',
    nickname: 'Rolex_Dragons',
    staticId: '1004',
    role: 'member',
    rank: 'Старійшина',
    rankLevel: 8,
    nextRank: 'Хранитель Полум’я',
    promotionProgress: 50,
    joinedAt: '2026-04-08',
    stats: {
      tasksDone: 4,
      eventsJoined: 7,
      weeklyActivity: 68,
      contributionPoints: 105,
      questsTotal: 44,
      daysInFamily: 90,
      marks: 0,
      captureOrDefenseCount: 5,
      questsOrganized: 2,
      weeklyActivityDays: 4,
      brigadeLeadDays: 12,
      newMembersTrained: 1
    }
  }),
  createUser({
    id: 'a0b1c2d3-0005-4a00-8000-000000000005',
    nickname: 'Nazar_Dragons',
    staticId: '2001',
    role: 'member',
    rank: 'Півкрило Полум’я',
    rankLevel: 5,
    nextRank: 'Гримуча Луска',
    promotionProgress: 66,
    joinedAt: '2026-05-01',
    stats: {
      tasksDone: 2,
      eventsJoined: 1,
      weeklyActivity: 56,
      contributionPoints: 62,
      questsTotal: 24,
      daysInFamily: 67,
      marks: 0,
      captureOrDefenseCount: 2,
      questsOrganized: 2,
      weeklyActivityDays: 3,
      brigadeLeadDays: 4,
      newMembersTrained: 0
    }
  }),
  createUser({
    id: 'a0b1c2d3-0006-4a00-8000-000000000006',
    nickname: 'Maks_Dragons',
    staticId: '2002',
    role: 'member',
    rank: 'Жаринка Луската',
    rankLevel: 4,
    nextRank: 'Півкрило Полум’я',
    promotionProgress: 66,
    joinedAt: '2026-05-05',
    stats: {
      tasksDone: 1,
      eventsJoined: 2,
      weeklyActivity: 49,
      contributionPoints: 44,
      questsTotal: 14,
      daysInFamily: 63,
      marks: 0,
      captureOrDefenseCount: 1,
      questsOrganized: 1,
      weeklyActivityDays: 3,
      brigadeLeadDays: 0,
      newMembersTrained: 0
    }
  }),
  createUser({
    id: 'a0b1c2d3-0007-4a00-8000-000000000007',
    nickname: 'Danylo_Dragons',
    staticId: '2003',
    role: 'member',
    rank: 'Димохвіст',
    rankLevel: 3,
    nextRank: 'Жаринка Луската',
    promotionProgress: 60,
    joinedAt: '2026-05-09',
    stats: {
      tasksDone: 3,
      eventsJoined: 3,
      weeklyActivity: 61,
      contributionPoints: 74,
      questsTotal: 8,
      daysInFamily: 59,
      marks: 0,
      captureOrDefenseCount: 1,
      questsOrganized: 0,
      weeklyActivityDays: 4,
      brigadeLeadDays: 0,
      newMembersTrained: 0
    }
  }),
  createUser({
    id: 'a0b1c2d3-0008-4a00-8000-000000000008',
    nickname: 'Roma_Dragons',
    staticId: '3001',
    role: 'member',
    rank: 'Яйце дракона',
    rankLevel: 1,
    nextRank: 'Міні-Спопелялка',
    promotionProgress: 60,
    joinedAt: '2026-06-01',
    stats: {
      tasksDone: 0,
      eventsJoined: 0,
      weeklyActivity: 28,
      contributionPoints: 12,
      questsTotal: 1,
      daysInFamily: 36,
      marks: 0,
      captureOrDefenseCount: 0,
      questsOrganized: 0,
      weeklyActivityDays: 2,
      brigadeLeadDays: 0,
      newMembersTrained: 0
    }
  }),
  createUser({
    id: 'a0b1c2d3-0009-4a00-8000-000000000009',
    nickname: 'Artem_Dragons',
    staticId: '3002',
    role: 'member',
    rank: 'Яйце дракона',
    rankLevel: 1,
    nextRank: 'Міні-Спопелялка',
    promotionProgress: 40,
    joinedAt: '2026-06-03',
    stats: {
      tasksDone: 0,
      eventsJoined: 0,
      weeklyActivity: 18,
      contributionPoints: 8,
      questsTotal: 0,
      daysInFamily: 34,
      marks: 0,
      captureOrDefenseCount: 0,
      questsOrganized: 0,
      weeklyActivityDays: 1,
      brigadeLeadDays: 0,
      newMembersTrained: 0
    }
  })
];

export const DEFAULT_FAMILY_POSTS: FamilyPost[] = [
  {
    id: 'post-dragon-hub-launch',
    type: 'urgent',
    title: 'Dragon House Family Hub переходить у штабний режим',
    body: 'Перевіряємо кабінети, ролі, ранги та доступи. Усі важливі сімейні матеріали збираються тут.',
    createdBy: 'Anastasia_Dragons',
    createdAt: '2026-07-07T12:00:00.000Z',
    updatedAt: '2026-07-07T12:00:00.000Z',
    expiresAt: null,
    isPinned: true,
    target: 'all',
    targetRoles: [],
    targetUserIds: [],
    serverName: 'Quant RP',
    isReadBy: []
  },
  {
    id: 'post-economy-base',
    type: 'important',
    title: 'Скарбниця тепер зберігає вигідні місця',
    body: 'Заправки, магазини, одяг і зброя без націнки винесені в окрему базу знань.',
    createdBy: 'Marcel_Dragons',
    createdAt: '2026-07-07T13:00:00.000Z',
    updatedAt: '2026-07-07T13:00:00.000Z',
    expiresAt: null,
    isPinned: true,
    target: 'all',
    targetRoles: [],
    targetUserIds: [],
    serverName: 'Quant RP',
    isReadBy: []
  },
  {
    id: 'post-rank-model',
    type: 'family_news',
    title: 'Підготовлено модель рангів Dragon House',
    body: 'Прогрес підвищення тепер рахується за структурованими вимогами, а не простими текстовими рядками.',
    createdBy: 'Anastasia_Dragons',
    createdAt: '2026-07-07T14:00:00.000Z',
    updatedAt: '2026-07-07T14:00:00.000Z',
    expiresAt: null,
    isPinned: false,
    target: 'all',
    targetRoles: [],
    targetUserIds: [],
    serverName: 'Quant RP',
    isReadBy: []
  }
];

export function readFamilyPosts(): FamilyPost[] {
  if (typeof window === 'undefined') return DEFAULT_FAMILY_POSTS;
  try {
    const raw = window.localStorage.getItem(FAMILY_POSTS_KEY);
    if (!raw) {
      const seed = sanitizeFamilyTextDeep(DEFAULT_FAMILY_POSTS);
      assertNoMojibakeSeed('DEFAULT_FAMILY_POSTS', seed);
      window.localStorage.setItem(FAMILY_POSTS_KEY, JSON.stringify(seed));
      return seed;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_FAMILY_POSTS;
    const sanitized = sanitizeFamilyTextDeep(parsed as FamilyPost[]);
    if (JSON.stringify(sanitized) !== raw) saveFamilyPosts(sanitized);
    return sanitized;
  } catch {
    return DEFAULT_FAMILY_POSTS;
  }
}

export function saveFamilyPosts(posts: FamilyPost[]) {
  window.localStorage.setItem(FAMILY_POSTS_KEY, JSON.stringify(sanitizeFamilyTextDeep(posts)));
}

export const FAMILY_ECONOMY_ENTRIES: FamilyEconomyEntry[] = [
  {
    id: 'fuel-21',
    category: 'fuel',
    title: 'Заправка №21',
    locationNumber: '21',
    description: 'Дешева заправка для сімейних поїздок.',
    price: null,
    note: 'Пріоритетне місце для економії на паливі.',
    createdBy: 'Anastasia_Dragons',
    createdAt: '2026-07-07T00:00:00.000Z',
    updatedAt: '2026-07-07T00:00:00.000Z',
    isActive: true
  },
  {
    id: 'fuel-20',
    category: 'fuel',
    title: 'Заправка №20',
    locationNumber: '20',
    description: 'Альтернативна вигідна заправка.',
    price: null,
    note: null,
    createdBy: 'Anastasia_Dragons',
    createdAt: '2026-07-07T00:00:00.000Z',
    updatedAt: '2026-07-07T00:00:00.000Z',
    isActive: true
  },
  {
    id: 'clothing-9-13',
    category: 'clothing',
    title: 'Одяг 9/13',
    locationNumber: '9/13',
    description: 'Одяг без націнки.',
    price: 'без націнки',
    note: null,
    createdBy: 'Anastasia_Dragons',
    createdAt: '2026-07-07T00:00:00.000Z',
    updatedAt: '2026-07-07T00:00:00.000Z',
    isActive: true
  },
  {
    id: 'weapon-4-11',
    category: 'weapons',
    title: 'Зброя 4/11',
    locationNumber: '4/11',
    description: 'Зброя без націнки.',
    price: 'без націнки',
    note: null,
    createdBy: 'Anastasia_Dragons',
    createdAt: '2026-07-07T00:00:00.000Z',
    updatedAt: '2026-07-07T00:00:00.000Z',
    isActive: true
  },
  ...([
    ['shop-29', '№29', null],
    ['shop-151', '№151', null],
    ['shop-44', '№44', null],
    ['shop-130', '№130', null],
    ['shop-45', '№45', null],
    ['shop-30', '№30', 'особливо вигідний'],
    ['shop-18-22', '24/7 №18/22', 'без націнки'],
    ['shop-19-22', '24/7 №19/22', 'лопатки по 5300']
  ] satisfies Array<[string, string, string | null]>).map(([id, title, note]) => ({
    id,
    category: 'shops' as const,
    title,
    locationNumber: title.replace('№', ''),
    description: note ?? 'Вигідна точка Dragon House.',
    price: note,
    note,
    createdBy: 'Anastasia_Dragons',
    createdAt: '2026-07-07T00:00:00.000Z',
    updatedAt: '2026-07-07T00:00:00.000Z',
    isActive: true
  }))
];

export const RECRUITMENT_SETTINGS: RecruitmentSettings = {
  isOpen: true,
  text: 'Dragon House приймає активних гравців, які поважають сім’ю, дисципліну та внутрішні правила лігва.',
  requirements: [
    'Адекватна поведінка',
    'Готовність брати участь у сімейних активностях',
    'Зміна прізвища на Dragons після прийняття',
    'Без токсичності й зливу внутрішньої інформації'
  ],
  contact: 'Anastasia_Dragons / Marcel_Dragons',
  author: 'Anastasia_Dragons',
  updatedAt: '2026-07-07T00:00:00.000Z'
};

export const FAMILY_MAP_ZONES: FamilyMapZone[] = [
  {
    id: 'dragon-house-zone',
    name: 'Dragon House',
    owner: 'Dragon House',
    type: 'dragon_house',
    color: '#f97316',
    polygon: null,
    description: 'Placeholder для майбутніх сімейних зон. Координати ще не задані.',
    source: 'family',
    updatedAt: '2026-07-07T00:00:00.000Z',
    updatedBy: 'Anastasia_Dragons',
    isVisible: true
  },
  {
    id: 'redox-ally-zone',
    name: 'Redox',
    owner: 'Redox',
    type: 'ally',
    color: '#22c55e',
    polygon: null,
    description: 'Союзна сім’я. Координати не вигадані й поки не рендеряться на мапі.',
    source: 'family',
    updatedAt: '2026-07-07T00:00:00.000Z',
    updatedBy: 'Anastasia_Dragons',
    isVisible: true
  }
];

export const FAMILY_RESOURCES: FamilyResource[] = [
  {
    id: 'hydra-redux-1-36',
    title: 'Hydra Redux v1.36',
    date: '07.03.2026',
    fileDescription: 'update.rpf',
    url: 'https://drive.google.com/drive/folders/1X72vyid16sr9IEb-W21hM2O1dptEMUCM?usp=sharing',
    status: 'актуальна версія',
    updatedBy: 'Anastasia_Dragons',
    updatedAt: '2026-03-07'
  }
];

const RULES_FALLBACK_URL = `${QUANTFUN_BASE_URL}go/quant-rp-rules/`;

function ruleLink(
  id: string,
  category: ResourceCategory,
  title: string,
  description = 'Оригінальне джерело правил Quant RP.'
): ResourceLink {
  return {
    id,
    category,
    title,
    url: RULES_FALLBACK_URL,
    description,
    source: 'Quant RP rules',
    isPinned: category === 'general',
    updatedAt: '2026-07-07T00:00:00.000Z'
  };
}

export const RESOURCE_LINKS: ResourceLink[] = [
  ruleLink('general-rules', 'general', 'Загальні правила Quant RP'),
  ruleLink('crime-general', 'crime', 'Загальні правила кримінальних структур'),
  ruleLink('crime-title-territories', 'crime', 'Титульні території кримінальних організацій'),
  ruleLink('crime-robbery-kidnapping', 'crime', 'Правила пограбувань та викрадень'),
  ruleLink('crime-case-van', 'crime', 'Правила Кейсу та Фургону'),
  ruleLink('crime-vzg-vzh-vza', 'crime', 'Правила ВЗГ/ВЗХ/ВЗА'),
  ruleLink('crime-judgement-night', 'crime', 'Правила Судної ночі'),
  ruleLink('crime-green-zones', 'crime', 'Правила Зелених Зон'),
  ruleLink('crime-interrogations', 'crime', 'Правила допитів для кримінальних структур'),
  ruleLink('crime-materials', 'crime', 'Правила доставки/перехоплення матеріалів'),
  ruleLink('captures-business-war', 'captures_business', 'Війна за бізнес'),
  ruleLink('captures-territories', 'captures_business', 'Захоплення територій'),
  ruleLink('government-general', 'government', 'Загальні правила для державних структур'),
  ruleLink('government-behavior', 'government', 'Регламент поведінки працівників державних структур'),
  ruleLink('law-procedure', 'codes_laws', 'Процесуальний кодекс штату Quant'),
  ruleLink('law-administrative', 'codes_laws', 'Адміністративний кодекс'),
  ruleLink('law-criminal', 'codes_laws', 'Кримінальний кодекс'),
  ruleLink('law-labor', 'codes_laws', 'Трудовий кодекс'),
  ruleLink('law-road', 'codes_laws', 'Дорожній кодекс'),
  ruleLink('law-ethics', 'codes_laws', 'Етичний кодекс'),
  ruleLink('law-court', 'codes_laws', 'Судовий кодекс'),
  ruleLink('law-constitution', 'codes_laws', 'Конституція штату Quant'),
  ruleLink('law-weapons', 'codes_laws', 'Закон про обіг зброї на території штату'),
  ruleLink('law-closed-areas', 'codes_laws', 'Закон про закриті та охороняємі території'),
  ruleLink('law-interrogations', 'codes_laws', 'Правила допитів'),
  ruleLink('statute-fib', 'statutes', 'Статут FIB'),
  ruleLink('statute-lspd', 'statutes', 'Статут LSPD'),
  ruleLink('statute-ng', 'statutes', 'Статут NG'),
  ruleLink('statute-ems', 'statutes', 'Статут EMS'),
  ruleLink('statute-liv', 'statutes', 'Статут LIV')
];

export const QUANT_NEWS_ITEMS: QuantNewsItem[] = [
  {
    id: 'quant-news-adapter-ready',
    title: 'Підготовлено місце для новин Quant',
    body: 'Новини будуть підтягуватись через офіційний Discord bot/backend integration. User token, self-bot і scraping не використовуються.',
    publishedAt: '2026-07-07T00:00:00.000Z',
    sourceUrl: 'https://discord.com/channels/981163624980680714/981254995435458590',
    sourceName: 'Quant Discord news'
  },
  {
    id: 'quant-news-demo',
    title: 'Demo news item',
    body: 'Це локальний демонстраційний запис для UI, поки немає офіційного backend adapter.',
    publishedAt: '2026-07-06T00:00:00.000Z',
    sourceUrl: 'https://discord.com/channels/981163624980680714/981254995435458590',
    sourceName: 'Quant Discord news'
  }
];
