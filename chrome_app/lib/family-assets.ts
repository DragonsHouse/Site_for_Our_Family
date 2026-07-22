import type { FamilyAssetDefinition, FamilyAssetSlot } from './family-types';

export const DRAGON_HOUSE_ASSETS = {
  crest: '/assets/dragon-house/dragon-house-logo.png',
  appIcon16: '/assets/dragon-house/dragon-house-logo.png',
  appIcon48: '/assets/dragon-house/dragon-house-logo.png',
  appIcon128: '/assets/dragon-house/dragon-house-logo.png',
  hallBackground: '/assets/dragon-house/dragon-hall-bg.png',
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
    title: 'Dragon House logo',
    usedIn: 'Family Hub logo, family cards, shared crest fallback',
    defaultUrl: DRAGON_HOUSE_ASSETS.crest
  },
  {
    slot: 'header_logo',
    title: 'Header logo',
    usedIn: 'Top header crest in Family Hub',
    defaultUrl: DRAGON_HOUSE_ASSETS.crest
  },
  {
    slot: 'family_hub_background',
    title: 'Family Hub background',
    usedIn: 'Main Dragon House shell background',
    defaultUrl: DRAGON_HOUSE_ASSETS.hallBackground
  },
  {
    slot: 'login_background',
    title: 'Login background',
    usedIn: 'Full-screen Dragon House login background',
    defaultUrl: DRAGON_HOUSE_ASSETS.hallBackground
  },
  {
    slot: 'background_dragon',
    title: 'Background dragon',
    usedIn: 'Decorative dragon layer behind Hub content',
    defaultUrl: DRAGON_HOUSE_ASSETS.futureDragonLayer
  },
  {
    slot: 'quest_help_citizens',
    title: 'Допомога громадянам',
    usedIn: 'Quest image: Допомога громадянам',
    defaultUrl: questImagePath('dopomoga-gromadyanam.png')
  },
  {
    slot: 'quest_cleanup',
    title: 'Суботник',
    usedIn: 'Quest image: Суботник',
    defaultUrl: questImagePath('subotnyk.png')
  },
  {
    slot: 'quest_hunting',
    title: 'Мисливський сезон',
    usedIn: 'Quest image: Мисливський сезон',
    defaultUrl: questImagePath('myslyvskyi-sezon.png')
  },
  {
    slot: 'quest_forest_trophies',
    title: 'Лісові трофеї',
    usedIn: 'Quest image: Лісові трофеї',
    defaultUrl: questImagePath('lisovi-trofei.png')
  },
  {
    slot: 'quest_lumberjack',
    title: 'Заклик лісоруба',
    usedIn: 'Quest image: Заклик лісоруба',
    defaultUrl: questImagePath('zaklyk-lisoruba.png')
  },
  {
    slot: 'quest_goods_explosion',
    title: 'Товарний вибух',
    usedIn: 'Quest image: Товарний вибух',
    defaultUrl: questImagePath('tovarnyi-vybukh.png')
  },
  {
    slot: 'quest_fishing',
    title: 'Рибний день',
    usedIn: 'Quest image: Рибний день',
    defaultUrl: questImagePath('rybnyi-den.png')
  },
  {
    slot: 'quest_guardians',
    title: 'Вартові свого',
    usedIn: 'Quest image: Вартові свого',
    defaultUrl: questImagePath('vartovi-svogo.png')
  },
  {
    slot: 'quest_blood_power',
    title: 'Влада через кров',
    usedIn: 'Quest image: Влада через кров',
    defaultUrl: questImagePath('vlada-cherez-krov.png')
  },
  {
    slot: 'quest_fuel_progress',
    title: 'Паливо прогресу',
    usedIn: 'Quest image: Паливо прогресу',
    defaultUrl: questImagePath('palyvo-progresu.png')
  },
  {
    slot: 'quest_mining',
    title: 'Шахтарська справа',
    usedIn: 'Quest image: Шахтарська справа',
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
