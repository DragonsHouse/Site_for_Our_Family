import { getQuestTemplateAssetSlot, questImagePath } from './family-assets';
import type { FamilyAssetSlot, FamilyQuestTemplate } from './family-types';

const UPDATED_AT = '2026-07-07T00:00:00.000Z';

function template(input: Omit<
  FamilyQuestTemplate,
  | 'imageUrl'
  | 'imageAsset'
  | 'createdBy'
  | 'updatedAt'
  | 'isActive'
  | 'totalReward'
  | 'memberRewardPool'
  | 'familyBankShare'
  | 'splitMode'
  | 'cooldownUntil'
  | 'cooldownHours'
  | 'requiredItems'
> & {
  imageFile: string;
  imageSlot?: FamilyAssetSlot;
  totalReward?: number;
  memberRewardPool?: number;
  familyBankShare?: number;
  splitMode?: FamilyQuestTemplate['splitMode'];
  cooldownUntil?: string | null;
  cooldownHours?: number;
  requiredItems?: string | null;
}): FamilyQuestTemplate {
  const memberRewardPool = input.memberRewardPool ?? input.rewardAmount ?? 0;
  const totalReward = input.totalReward ?? memberRewardPool;
  return {
    ...input,
    totalReward,
    memberRewardPool,
    familyBankShare: input.familyBankShare ?? Math.max(0, totalReward - memberRewardPool),
    splitMode: input.splitMode ?? 'equal',
    cooldownUntil: input.cooldownUntil ?? null,
    cooldownHours: input.cooldownHours ?? 24,
    requiredItems: input.requiredItems ?? input.items ?? null,
    imageUrl: questImagePath(input.imageFile),
    imageAsset: `public/assets/dragon-house/quests/${input.imageFile}`,
    imageSlot: input.imageSlot ?? getQuestTemplateAssetSlot(input.id),
    isActive: true,
    createdBy: 'Anastasia_Dragons',
    updatedAt: UPDATED_AT
  };
}

export const DEFAULT_FAMILY_QUEST_TEMPLATES: FamilyQuestTemplate[] = [
  template({
    id: 'help-citizens',
    title: 'Допомога громадянам',
    category: 'Громадський',
    recommendedTeamSize: 2,
    rewardAmount: 700000,
    rewardLabel: '$700 000 на всіх',
    steps: [
      'Продати 100 хот-догів',
      'Передати 25 різним гравцям до 10-го рівня включно по $1000 кожному'
    ],
    hint:
      'Продаж хот-догів у людних місцях: лікарня, казино, парковки, інкасатори. Роздача грошей: шукати нових гравців по static ID.',
    route: null,
    items: null,
    imageFile: 'dopomoga-gromadyanam.png'
  }),
  template({
    id: 'subotnyk',
    title: 'Суботник',
    category: 'Громадський',
    recommendedTeamSize: 4,
    rewardAmount: 900000,
    rewardLabel: '$900 000 на всіх',
    steps: ['Знайти всі сміттєві пакети в 5 зонах'],
    hint: 'Йти у жовту зону на мапі. Пакети можуть бути всюди в зоні, навіть на дахах.',
    route: 'Жовта зона на мапі',
    items: null,
    imageFile: 'subotnyk.png'
  }),
  template({
    id: 'hunting-season',
    title: 'Мисливський сезон',
    category: 'Бізнес',
    recommendedTeamSize: 3,
    rewardAmount: 400000,
    rewardLabel: '$400 000 на всіх',
    steps: ['Продати 250 шкур скупнику на ринку'],
    hint:
      'Шкури можна купити, актуальна ціна 1400-1500 за штуку. Одна людина продає 100 шкур за раз.',
    route: null,
    items: null,
    imageFile: 'myslyvskyi-sezon.png'
  }),
  template({
    id: 'forest-trophies',
    title: 'Лісові трофеї',
    category: 'Бізнес',
    recommendedTeamSize: 2,
    rewardAmount: 600000,
    rewardLabel: '$600 000 на всіх',
    steps: [
      'Зібрати 500 печериць',
      'Зібрати 400 глив',
      'Продати 500 печериць',
      'Продати 400 глив'
    ],
    hint: 'Виконувати квест у строгому порядку. Не продати гливи раніше печериць.',
    route: null,
    items: null,
    imageFile: 'lisovi-trofei.png'
  }),
  template({
    id: 'woodcutter-call',
    title: 'Заклик лісоруба',
    category: 'Бізнес',
    recommendedTeamSize: 2,
    rewardAmount: 400000,
    rewardLabel: '$400 000 на всіх',
    steps: [
      'Зібрати 500 соснових колод',
      'Зібрати 400 дубових колод',
      'Продати 500 соснових колод',
      'Продати 400 дубових колод'
    ],
    hint: 'Виконувати в строгому порядку. Не продати дуб раніше сосни.',
    route: null,
    items: null,
    imageFile: 'zaklyk-lisoruba.png'
  }),
  template({
    id: 'cargo-boom',
    title: 'Товарний вибух',
    category: 'Бізнес',
    recommendedTeamSize: 4,
    rewardAmount: 700000,
    rewardLabel: '$700 000 на всіх',
    steps: ['Перевезти 1000 кг продуктів'],
    hint: 'Тільки на сімейних машинах і відповідних для завдання. Машини: Raptor F-150 або Гелік 6x6.',
    route: 'Завантаження — в горах біля Палето Бей. Розвантаження — на пірсі біля далекобійника.',
    items: null,
    imageFile: 'tovarnyi-vybukh.png'
  }),
  template({
    id: 'fish-day',
    title: 'Рибний день',
    category: 'Бізнес',
    recommendedTeamSize: 10,
    rewardAmount: 700000,
    rewardLabel: '$700 000 на всіх',
    steps: ['Наловити 2000 риб'],
    hint:
      'Перед виходом купити вудку і прикормку в магазині 24/7. Краще ловити з човна. Щоб човен не трусило, кинути якір на F2.',
    route: null,
    items: 'Вудка, прикормка, човен',
    imageFile: 'rybnyi-den.png'
  }),
  template({
    id: 'guardians',
    title: 'Вартові свого',
    category: 'Бойовий',
    recommendedTeamSize: 8,
    rewardAmount: null,
    rewardLabel: '100% від банку, приблизно $750 000 на всіх',
    steps: ['Захистити 2 території у війні сімей'],
    hint: null,
    route: null,
    items: null,
    imageFile: 'vartovi-svogo.png'
  }),
  template({
    id: 'blood-power',
    title: 'Влада через кров',
    category: 'Бойовий',
    recommendedTeamSize: 8,
    rewardAmount: null,
    rewardLabel: '100% від банку, приблизно $1 000 000 на всіх',
    steps: ['Здобути 3 перемоги у війні сімей'],
    hint: null,
    route: null,
    items: null,
    imageFile: 'vlada-cherez-krov.png'
  }),
  template({
    id: 'fuel-progress',
    title: 'Паливо прогресу',
    category: 'Бізнес',
    recommendedTeamSize: 6,
    rewardAmount: 400000,
    rewardLabel: '$400 000 на всіх',
    steps: ['Видобути паливо 500 разів на нафтокачці'],
    hint: null,
    route: null,
    items: "6 бочок з паливом -> банк сім’ї",
    imageFile: 'palyvo-progresu.png'
  }),
  template({
    id: 'mining-work',
    title: 'Шахтарська справа',
    category: 'Бізнес',
    recommendedTeamSize: 6,
    rewardAmount: 600000,
    rewardLabel: '$600 000 на всіх',
    steps: ['Видобути 500 кг заліза', 'Видобути 200 кг міді', 'Видобути 500 г срібла'],
    hint: null,
    route: null,
    items: null,
    imageFile: 'shahtarska-sprava.png'
  })
];
