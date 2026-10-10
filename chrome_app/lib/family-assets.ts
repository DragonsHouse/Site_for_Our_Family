import type { FamilyAssetDefinition, FamilyAssetSlot } from './family-types';

export const DRAGON_HOUSE_ASSETS = {
  crest: '/assets/dragon-house/dragon-house-logo.png',
  appIcon16: '/icon/16.png',
  appIcon32: '/icon/32.png',
  appIcon48: '/icon/48.png',
  appIcon128: '/icon/128.png',
  appIcon256: '/icon/256.png',
  appIcon512: '/icon/512.png',
  hallBackground: '/assets/dragon-house/dragon-hall-bg.png',
  emberGateBackground: '/assets/dragon-house/illustrations/dragon-house-login-entrance.png',
  loginPortalBackground: '/assets/dragon-house/backgrounds/login-portal-background.png',
  loginPortalMotion: '/assets/dragon-house/backgrounds/login-portal-background.mp4',
  postLoginBackground: '/assets/dragon-house/backgrounds/post-login-background.png',
  portalAmbientAudio: '/assets/dragon-house/audio/dragon_house_portal_fire_dragon_mix.mp3',
  futureDragonLayer: '/assets/dragon-house/dragon-3d-placeholder.png',
  questImageBase: '/assets/dragon-house/quests'
} as const;

export const FAMILY_ASSETS_UPDATED_EVENT = 'dragon-house-family-assets-updated';

export function questImagePath(fileName: string) {
  return `${DRAGON_HOUSE_ASSETS.questImageBase}/${fileName}`;
}

export const FAMILY_ASSET_DEFINITIONS: FamilyAssetDefinition[] = [
  {
    slot: 'dragon_house_logo',
    title: 'Герб Dragon House',
    usedIn: 'Логотип Family Hub, сімейні картки та резервний герб.',
    defaultUrl: DRAGON_HOUSE_ASSETS.crest
  },
  {
    slot: 'header_logo',
    title: 'Герб у шапці',
    usedIn: 'Верхня шапка Family Hub.',
    defaultUrl: DRAGON_HOUSE_ASSETS.crest
  },
  {
    slot: 'family_hub_background',
    title: 'Фон Family Hub',
    usedIn: 'Основний фон оболонки Dragon House.',
    defaultUrl: DRAGON_HOUSE_ASSETS.hallBackground
  },
  {
    slot: 'login_background',
    title: 'Фон входу',
    usedIn: 'Повноекранний фон входу Dragon House Ember Gate. Рекомендовано: 3840x2160 або 2560x1440, wide 16:9.',
    defaultUrl: DRAGON_HOUSE_ASSETS.emberGateBackground
  },
  {
    slot: 'login_portal_background',
    title: 'Фон порталу входу',
    usedIn: 'Додатковий шар текстури або картинки всередині прозорої арки входу.',
    defaultUrl: DRAGON_HOUSE_ASSETS.loginPortalBackground
  },
  {
    slot: 'post_login_background',
    title: 'Фон після входу',
    usedIn: 'Основний фон Family Hub після авторизації.',
    defaultUrl: DRAGON_HOUSE_ASSETS.postLoginBackground
  },
  {
    slot: 'background_dragon',
    title: 'Дракон на фоні',
    usedIn: 'Декоративний шар дракона позаду вмісту Hub.',
    defaultUrl: DRAGON_HOUSE_ASSETS.futureDragonLayer
  },
  {
    slot: 'quest_help_citizens',
    title: 'Допомога громадянам',
    usedIn: 'Зображення квесту: допомога громадянам.',
    defaultUrl: questImagePath('dopomoga-gromadyanam.png')
  },
  {
    slot: 'quest_cleanup',
    title: 'Суботник',
    usedIn: 'Зображення квесту: суботник.',
    defaultUrl: questImagePath('subotnyk.png')
  },
  {
    slot: 'quest_hunting',
    title: 'Мисливський сезон',
    usedIn: 'Зображення квесту: мисливський сезон.',
    defaultUrl: questImagePath('myslyvskyi-sezon.png')
  },
  {
    slot: 'quest_forest_trophies',
    title: 'Лісові трофеї',
    usedIn: 'Зображення квесту: лісові трофеї.',
    defaultUrl: questImagePath('lisovi-trofei.png')
  },
  {
    slot: 'quest_lumberjack',
    title: 'Заклик лісоруба',
    usedIn: 'Зображення квесту: заклик лісоруба.',
    defaultUrl: questImagePath('zaklyk-lisoruba.png')
  },
  {
    slot: 'quest_goods_explosion',
    title: 'Товарний вибух',
    usedIn: 'Зображення квесту: товарний вибух.',
    defaultUrl: questImagePath('tovarnyi-vybukh.png')
  },
  {
    slot: 'quest_fishing',
    title: 'Рибний день',
    usedIn: 'Зображення квесту: рибний день.',
    defaultUrl: questImagePath('rybnyi-den.png')
  },
  {
    slot: 'quest_guardians',
    title: 'Вартові свого',
    usedIn: 'Зображення квесту: вартові свого.',
    defaultUrl: questImagePath('vartovi-svogo.png')
  },
  {
    slot: 'quest_blood_power',
    title: 'Влада через кров',
    usedIn: 'Зображення квесту: влада через кров.',
    defaultUrl: questImagePath('vlada-cherez-krov.png')
  },
  {
    slot: 'quest_fuel_progress',
    title: 'Паливо прогресу',
    usedIn: 'Зображення квесту: паливо прогресу.',
    defaultUrl: questImagePath('palyvo-progresu.png')
  },
  {
    slot: 'quest_mining',
    title: 'Шахтарська справа',
    usedIn: 'Зображення квесту: шахтарська справа.',
    defaultUrl: questImagePath('shahtarska-sprava.png')
  }
];

export const QUEST_TEMPLATE_ASSET_SLOTS: Record<string, FamilyAssetSlot> = {
  'help-citizens': 'quest_help_citizens',
  subotnyk: 'quest_cleanup',
  'hunting-season': 'quest_hunting',
  'forest-trophies': 'quest_forest_trophies',
  'woodcutter-call': 'quest_lumberjack',
  'cargo-boom': 'quest_goods_explosion',
  'fish-day': 'quest_fishing',
  guardians: 'quest_guardians',
  'blood-power': 'quest_blood_power',
  'fuel-progress': 'quest_fuel_progress',
  'mining-work': 'quest_mining'
};

export function getFamilyAssetDefinition(slot: FamilyAssetSlot) {
  return FAMILY_ASSET_DEFINITIONS.find((definition) => definition.slot === slot);
}

export function getFamilyAssetDefaultUrl(slot: FamilyAssetSlot) {
  return getFamilyAssetDefinition(slot)?.defaultUrl ?? DRAGON_HOUSE_ASSETS.crest;
}

export function getQuestTemplateAssetSlot(templateId: string): FamilyAssetSlot | null {
  return QUEST_TEMPLATE_ASSET_SLOTS[templateId] ?? null;
}
