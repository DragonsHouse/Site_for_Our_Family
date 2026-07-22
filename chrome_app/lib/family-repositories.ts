import {
  FAMILY_ASSETS_UPDATED_EVENT,
  getFamilyAssetDefaultUrl,
  getQuestTemplateAssetSlot
} from './family-assets';
import { FAMILY_ECONOMY_ENTRIES } from './family-data';
import { DEFAULT_FAMILY_QUEST_TEMPLATES } from './family-quest-data';
import { assertNoMojibakeSeed, sanitizeFamilyTextDeep } from './text-sanitizer';
import type {
  FamilyAccountingAuditEntry,
  FamilyAccountingMonth,
  FamilyBonus,
  FamilyBonusStatus,
  FamilyLedgerEntry,
  FamilyAssetSlot,
  FamilyCustomAsset,
  FamilyEditableContentBlock,
  FamilyEconomyEntry,
  FamilyMapReference,
  FamilyPremiumRules,
  FamilyQuest,
  FamilyQuestAuditAction,
  FamilyQuestAuditEntry,
  FamilyQuestParticipant,
  FamilyQuestPayout,
  FamilyQuestReport,
  FamilyQuestRewardItem,
  FamilyQuestRewardMode,
  FamilyQuestStatus,
  FamilyQuestTemplate
} from './family-types';

const ECONOMY_KEY = 'dragon_house_family_economy_v1';
const QUEST_TEMPLATES_KEY = 'dragon_house_family_quest_templates_v1';
const QUESTS_KEY = 'dragon_house_family_quests_v1';
const QUEST_REPORTS_KEY = 'dragon_house_family_quest_reports_v1';
const ACCOUNTING_KEY = 'dragon_house_family_accounting_v1';
const PREMIUM_RULES_KEY = 'dragon_house_family_premium_rules_v1';
const NOTIFIED_NEWS_KEY = 'dragon_house_family_notified_news_v1';
const FAMILY_ASSETS_KEY = 'dragon_house_family_assets_v1';
const FAMILY_CONTENT_BLOCKS_KEY = 'dragon_house_family_content_blocks_v1';
const FAMILY_ASSETS_DB_NAME = 'dragon_house_family_assets_db';
const FAMILY_ASSETS_DB_VERSION = 1;
const FAMILY_ASSET_BLOBS_STORE = 'asset_blobs';

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      const seed = sanitizeFamilyTextDeep(fallback);
      assertNoMojibakeSeed(key, seed);
      window.localStorage.setItem(key, JSON.stringify(seed));
      return seed;
    }
    const parsed = JSON.parse(raw) as T;
    const sanitized = sanitizeFamilyTextDeep(parsed);
    if (JSON.stringify(sanitized) !== raw) writeJson(key, sanitized);
    return sanitized;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(sanitizeFamilyTextDeep(value)));
}

function notifyFamilyAssetsUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FAMILY_ASSETS_UPDATED_EVENT));
}

function openFamilyAssetsDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }

    const request = indexedDB.open(FAMILY_ASSETS_DB_NAME, FAMILY_ASSETS_DB_VERSION);
    request.addEventListener('upgradeneeded', () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FAMILY_ASSET_BLOBS_STORE)) {
        db.createObjectStore(FAMILY_ASSET_BLOBS_STORE);
      }
    });
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error ?? new Error('Cannot open IndexedDB')));
    request.addEventListener('blocked', () => reject(new Error('IndexedDB upgrade is blocked')));
  });
}

async function withFamilyAssetStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openFamilyAssetsDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(FAMILY_ASSET_BLOBS_STORE, mode);
    const store = transaction.objectStore(FAMILY_ASSET_BLOBS_STORE);
    const request = action(store);
    let result: T;

    request.addEventListener('success', () => {
      result = request.result;
    });
    request.addEventListener('error', () => reject(request.error ?? new Error('IndexedDB request failed')));
    transaction.addEventListener('complete', () => {
      db.close();
      resolve(result);
    });
    transaction.addEventListener('abort', () => {
      db.close();
      reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    });
    transaction.addEventListener('error', () => {
      db.close();
      reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    });
  });
}

export const FAMILY_MAP_REFERENCES: FamilyMapReference[] = [
  {
    id: 'redux-v1-36-update-rpf',
    title: 'Redux v1.36',
    version: 'v1.36',
    date: '07.03.2026',
    fileDescription: 'update.rpf',
    url: 'https://drive.google.com/drive/folders/1X72vyid16sr9IEb-W21hM2O1dptEMUCM?usp=sharing',
    type: 'redux_update_rpf',
    status: 'planned',
    notes:
      'Reference layer підготовлено. Для реальної інтеграції потрібен конкретний формат карти/assets з update.rpf; файл не завантажується і не парситься автоматично.'
  }
];

const LEGACY_STATUS_MAP: Partial<Record<FamilyQuestStatus, FamilyQuestStatus>> = {
  closed: 'scheduled',
  in_progress: 'active',
  submitted: 'sent_to_accounting',
  approved: 'sent_to_accounting',
  rejected: 'stopped'
};

const QUEST_TRANSITIONS: Record<FamilyQuestStatus, FamilyQuestStatus[]> = {
  draft: ['recruiting'],
  recruiting: ['scheduled', 'active', 'stopped'],
  scheduled: ['recruiting', 'active', 'stopped'],
  active: ['paused', 'stopped', 'completed'],
  paused: ['active', 'stopped', 'completed'],
  stopped: [],
  completed: ['reported', 'cooldown'],
  reported: ['sent_to_accounting'],
  sent_to_accounting: ['paid'],
  paid: ['cooldown'],
  cooldown: ['recruiting'],
  closed: ['active'],
  in_progress: ['paused', 'completed', 'stopped'],
  submitted: ['paid'],
  approved: ['paid'],
  rejected: []
};

function normalizeQuestStatus(status: FamilyQuestStatus): FamilyQuestStatus {
  return LEGACY_STATUS_MAP[status] ?? status;
}

function familyRewardOf(input: { familyReward?: number; familyBankShare?: number }) {
  return input.familyReward ?? input.familyBankShare ?? 0;
}

function rewardModeOf(input: { rewardMode?: FamilyQuestRewardMode; splitMode?: FamilyQuestRewardMode }) {
  return input.rewardMode ?? input.splitMode ?? 'equal';
}

function payoutEventKey(questId: string, userId: string) {
  return `quest-payout:${questId}:${userId}`;
}

function normalizeRewardItems(items: FamilyQuestRewardItem[] | undefined): FamilyQuestRewardItem[] {
  return (items ?? []).map((item, index) => ({
    id: item.id || `item-${index}-${item.title}`,
    title: item.title,
    quantity: Math.max(1, Number(item.quantity) || 1),
    status: item.status ?? 'prepared',
    issuedAt: item.issuedAt ?? null,
    issuedBy: item.issuedBy ?? null
  }));
}

function normalizeParticipant(
  participant: FamilyQuestParticipant,
  type: 'participant' | 'helper',
  questId: string,
  now: string
): FamilyQuestParticipant {
  return {
    userId: participant.userId,
    nickname: participant.nickname ?? participant.userId,
    type: participant.type ?? type,
    joinedAt: participant.joinedAt ?? now,
    leftAt: participant.leftAt ?? null,
    joinedLate: participant.joinedLate ?? false,
    participationNote: participant.participationNote ?? null,
    addedManually: participant.addedManually ?? false,
    addedBy: participant.addedBy ?? null,
    rewardPercent: participant.rewardPercent ?? null,
    rewardAmount: participant.rewardAmount ?? 0,
    rewardItems: normalizeRewardItems(participant.rewardItems),
    bonusAmount: participant.bonusAmount ?? 0,
    bonusPercent: participant.bonusPercent ?? 0,
    isBestParticipant: participant.isBestParticipant ?? false,
    bestParticipantReason: participant.bestParticipantReason ?? null,
    payoutStatus: participant.payoutStatus ?? 'pending',
    paidAt: participant.paidAt ?? null,
    paidBy: participant.paidBy ?? null,
    payoutEventKey: participant.payoutEventKey ?? payoutEventKey(questId, participant.userId)
  };
}

function uniqueParticipants(participants: FamilyQuestParticipant[], helpers: FamilyQuestParticipant[], questId: string, now: string) {
  const seen = new Set<string>();
  const normalizedParticipants: FamilyQuestParticipant[] = [];
  const normalizedHelpers: FamilyQuestParticipant[] = [];

  for (const participant of participants) {
    if (seen.has(participant.userId)) continue;
    seen.add(participant.userId);
    normalizedParticipants.push(normalizeParticipant(participant, 'participant', questId, now));
  }

  for (const helper of helpers) {
    if (seen.has(helper.userId)) continue;
    seen.add(helper.userId);
    normalizedHelpers.push(normalizeParticipant(helper, 'helper', questId, now));
  }

  return { participants: normalizedParticipants, helpers: normalizedHelpers };
}

function allQuestPeople(quest: Pick<FamilyQuest, 'participants' | 'helpers'>) {
  return [...quest.participants, ...(quest.helpers ?? [])];
}

function createQuestAuditEntry(
  input: {
    action: FamilyQuestAuditAction;
    actor: string;
    comment?: string | null;
    previousState?: FamilyQuestStatus | null;
    newState?: FamilyQuestStatus | null;
    relatedUserId?: string | null;
    metadata?: Record<string, string | number | boolean | null>;
  },
  now: string
): FamilyQuestAuditEntry {
  return {
    id: `quest-audit-${now}-${Math.random().toString(36).slice(2, 9)}`,
    action: input.action,
    actor: input.actor,
    timestamp: now,
    comment: input.comment ?? null,
    previousState: input.previousState ?? null,
    newState: input.newState ?? null,
    relatedUserId: input.relatedUserId ?? null,
    metadata: input.metadata
  };
}

export function canTransitionFamilyQuest(from: FamilyQuestStatus, to: FamilyQuestStatus) {
  const normalizedFrom = normalizeQuestStatus(from);
  const normalizedTo = normalizeQuestStatus(to);
  return normalizedFrom === normalizedTo || (QUEST_TRANSITIONS[normalizedFrom] ?? []).includes(normalizedTo);
}

function questFromTemplate(
  template: FamilyQuestTemplate,
  input: {
    id: string;
    organizer: string;
    participants: string[];
    status?: FamilyQuest['status'];
    createdAt: string;
  }
): FamilyQuest {
  const totalAmount = template.memberRewardPool ?? template.rewardAmount ?? 0;
  const payouts = input.participants.map((userId) => ({
    userId,
    amount: totalAmount > 0 ? Math.floor(totalAmount / input.participants.length) : 0,
    status: 'pending' as const,
    paidBy: null,
    paidAt: null,
    payoutEventKey: payoutEventKey(input.id, userId)
  }));

  return {
    id: input.id,
    templateId: template.id,
    title: template.title,
    description: template.hint ?? template.steps.join('. '),
    category: template.category,
    scheduledAt: input.createdAt,
    recommendedTeamSize: template.recommendedTeamSize,
    maxTeamSize: template.recommendedTeamSize,
    rewardAmount: template.rewardAmount,
    totalReward: template.totalReward,
    memberRewardPool: template.memberRewardPool,
    familyBankShare: template.familyBankShare,
    familyReward: template.familyReward ?? template.familyBankShare,
    splitMode: rewardModeOf(template),
    rewardMode: rewardModeOf(template),
    rewardLabel: template.rewardLabel,
    steps: template.steps,
    hint: template.hint,
    route: template.route,
    items: template.items,
    requiredItems: template.requiredItems ?? template.items,
    imageUrl: template.imageUrl,
    organizer: input.organizer,
    participants: input.participants.map((userId) =>
      normalizeParticipant({ userId, joinedAt: input.createdAt }, 'participant', input.id, input.createdAt)
    ),
    helpers: [],
    totalAmount,
    payouts,
    status: normalizeQuestStatus(input.status ?? 'recruiting'),
    approvedBy: null,
    reportId: null,
    reportSentToAccountingAt: null,
    paidAt: null,
    paidBy: null,
    cooldownUntil: null,
    cooldownHours: template.cooldownHours,
    syncSource: 'family_hub',
    auditTrail: [
      createQuestAuditEntry(
        {
          action: 'recruiting_opened',
          actor: input.organizer,
          previousState: 'draft',
          newState: normalizeQuestStatus(input.status ?? 'recruiting')
        },
        input.createdAt
      )
    ],
    createdAt: input.createdAt,
    updatedAt: input.createdAt
  };
}

export const DEFAULT_FAMILY_QUESTS: FamilyQuest[] = [
  questFromTemplate(DEFAULT_FAMILY_QUEST_TEMPLATES[0], {
    id: 'active-help-citizens',
    organizer: 'Marcel_Dragons',
    participants: ['Marcel_Dragons'],
    status: 'recruiting',
    createdAt: '2026-07-07T18:00:00.000Z'
  }),
  questFromTemplate(DEFAULT_FAMILY_QUEST_TEMPLATES[5], {
    id: 'active-cargo-boom',
    organizer: 'Anastasia_Dragons',
    participants: ['Anastasia_Dragons', 'Nazar_Dragons'],
    status: 'recruiting',
    createdAt: '2026-07-07T19:00:00.000Z'
  }),
  questFromTemplate(DEFAULT_FAMILY_QUEST_TEMPLATES[2], {
    id: 'active-hunting-season',
    organizer: 'Nazar_Dragons',
    participants: ['Nazar_Dragons', 'Maks_Dragons', 'Danylo_Dragons'],
    status: 'in_progress',
    createdAt: '2026-07-07T20:00:00.000Z'
  })
];

export const DEFAULT_ACCOUNTING_MONTHS: FamilyAccountingMonth[] = [
  {
    id: 'accounting-2026-7',
    month: 7,
    year: 2026,
    totalFund: 0,
    bonuses: [],
    questReports: [],
    auditTrail: [],
    ledger: [],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-07T00:00:00.000Z'
  }
];

export const DEFAULT_PREMIUM_RULES: FamilyPremiumRules = {
  id: 'dragon-house-premium-rules-v1',
  tiers: [
    { id: 'premium-bronze', minMonthlyEarning: 250000, premiumAmount: 50000, title: 'Базова премія' },
    { id: 'premium-silver', minMonthlyEarning: 500000, premiumAmount: 100000, title: 'Активна премія' },
    { id: 'premium-gold', minMonthlyEarning: 1000000, premiumAmount: 200000, title: 'Вогняна премія' }
  ],
  updatedBy: 'system',
  updatedAt: '2026-07-07T00:00:00.000Z'
};

export const DEFAULT_FAMILY_CONTENT_BLOCKS: FamilyEditableContentBlock[] = [
  {
    id: 'home-intro',
    title: "Внутрішній штаб сім’ї",
    body: 'Лігво, новини, квести, скарбниця і доступи.',
    contact: 'Dragon House',
    updatedBy: 'system',
    updatedAt: '2026-07-07T00:00:00.000Z'
  },
  {
    id: 'home-alert',
    title: 'Важливе',
    body: 'Важливе: сімейні квести тепер мають набір, учасників і звіти для бухгалтерії.',
    contact: 'Anastasia_Dragons',
    updatedBy: 'system',
    updatedAt: '2026-07-07T00:00:00.000Z'
  },
  {
    id: 'recruitment-info',
    title: 'Набір у Dragon House',
    body: 'Dragon House приймає активних гравців, які поважають сім’ю, дисципліну та внутрішні правила лігва.',
    contact: 'Anastasia_Dragons / Marcel_Dragons',
    updatedBy: 'Anastasia_Dragons',
    updatedAt: '2026-07-07T00:00:00.000Z'
  },
  {
    id: 'family-rule-honor',
    title: 'I. Честь і поведінка',
    body: 'Заборонені образи, токсичність і приниження членів сім’ї.\nВнутрішні конфлікти не виносяться назовні.\nДракони поважають своїх - навіть у гніві.',
    contact: null,
    updatedBy: 'system',
    updatedAt: '2026-07-07T00:00:00.000Z'
  },
  {
    id: 'family-rule-order',
    title: 'II. Порядок у лігві',
    body: 'Кожен канал використовується за призначенням.\nСпам, флуд і хаос заборонені.\nБезлад - ворог сили.',
    contact: null,
    updatedBy: 'system',
    updatedAt: '2026-07-07T00:00:00.000Z'
  },
  {
    id: 'family-rule-duty',
    title: 'III. Обов’язок перед сім’єю',
    body: 'Участь у важливих подіях - знак вірності.\nІгнорування зборів без причини - неповага до сім’ї.',
    contact: null,
    updatedBy: 'system',
    updatedAt: '2026-07-07T00:00:00.000Z'
  },
  {
    id: 'family-rule-treasury',
    title: 'IV. Скарбниця драконів',
    body: 'Скарби належать сім’ї, а не окремим особам.\nБрати кошти із сейфу дозволено лише за дозволом Володарки Предвічного Полум’я.\nСамовільне використання прирівнюється до крадіжки у сім’ї.',
    contact: null,
    updatedBy: 'system',
    updatedAt: '2026-07-07T00:00:00.000Z'
  },
  {
    id: 'family-rule-power',
    title: 'V. Влада та ієрархія',
    body: 'Сім’я тримається на силі старших.\nОбов’язково підкорятися рішенням керівництва, особливо Володарки Предвічного Полум’я та Крові Давніх Драконів.\nНепокора, ігнорування або саботаж - виклик владі сім’ї.',
    contact: null,
    updatedBy: 'system',
    updatedAt: '2026-07-07T00:00:00.000Z'
  },
  {
    id: 'family-rule-secrets',
    title: 'VI. Таємниці лігва',
    body: 'Заборонено передавати внутрішню інформацію стороннім.\nЗлив даних - зрада.',
    contact: null,
    updatedBy: 'system',
    updatedAt: '2026-07-07T00:00:00.000Z'
  },
  {
    id: 'family-rule-quests',
    title: 'VII. Сімейні квести та заробіток',
    body: 'Заробіток з квестів визначається сімейними правилами.\nСтаршим рангам обов’язково подавати звіти: хто брав участь і скільки кожен учасник отримує зарплати.',
    contact: null,
    updatedBy: 'system',
    updatedAt: '2026-07-07T00:00:00.000Z'
  },
  {
    id: 'family-rule-leavers',
    title: 'VIII. Відступники',
    body: 'Дракони не залишають лігво без причини.\nСамовільний вихід - знак невірності. Повторний вихід - остаточна зрада.\nТой, хто залишив сім’ю вдруге, викреслюється назавжди та заноситься до Чорного списку. Повернення після цього неможливе.',
    contact: null,
    updatedBy: 'system',
    updatedAt: '2026-07-07T00:00:00.000Z'
  },
  {
    id: 'family-rule-court',
    title: 'Суд полум’я',
    body: 'Перше порушення - попередження.\nДруге порушення - суворе покарання.\nТретє порушення - вигнання.\nЗа крадіжку, зраду, злив інформації або непокору владі вигнання можливе негайно.',
    contact: null,
    updatedBy: 'system',
    updatedAt: '2026-07-07T00:00:00.000Z'
  },
  {
    id: 'family-rule-final',
    title: 'Останнє слово',
    body: 'Ми не тримаємо силою.\nАле той, хто залишає нас, втрачає право повернутися.\nСім’я пам’ятає. Полум’я не забуває.',
    contact: null,
    updatedBy: 'system',
    updatedAt: '2026-07-07T00:00:00.000Z'
  }
];

function isModernQuest(quest: Partial<FamilyQuest>): quest is FamilyQuest {
  return Boolean(quest.templateId && quest.category && Array.isArray(quest.participants));
}

function normalizeQuestTemplate(template: FamilyQuestTemplate): FamilyQuestTemplate {
  const memberRewardPool = template.memberRewardPool ?? template.rewardAmount ?? 0;
  const familyReward = familyRewardOf(template);
  const totalReward = template.totalReward ?? memberRewardPool + familyReward;
  return {
    ...template,
    totalReward,
    memberRewardPool,
    familyBankShare: familyReward || Math.max(0, totalReward - memberRewardPool),
    familyReward: familyReward || Math.max(0, totalReward - memberRewardPool),
    splitMode: rewardModeOf(template),
    rewardMode: rewardModeOf(template),
    cooldownUntil: template.cooldownUntil ?? null,
    cooldownHours: template.cooldownHours ?? 24,
    requiredItems: template.requiredItems ?? template.items ?? null
  };
}

function normalizeQuest(quest: FamilyQuest): FamilyQuest {
  const memberRewardPool = quest.memberRewardPool ?? quest.totalAmount ?? quest.rewardAmount ?? 0;
  const familyReward = familyRewardOf(quest);
  const totalReward = quest.totalReward ?? memberRewardPool + familyReward;
  const now = quest.createdAt ?? new Date().toISOString();
  const { participants, helpers } = uniqueParticipants(quest.participants ?? [], quest.helpers ?? [], quest.id, now);
  const people = [...participants, ...helpers];
  const byUser = new Map(people.map((participant) => [participant.userId, participant]));
  return {
    ...quest,
    totalReward,
    memberRewardPool,
    familyBankShare: familyReward || Math.max(0, totalReward - memberRewardPool),
    familyReward: familyReward || Math.max(0, totalReward - memberRewardPool),
    splitMode: rewardModeOf(quest),
    rewardMode: rewardModeOf(quest),
    requiredItems: quest.requiredItems ?? quest.items ?? null,
    scheduledAt: quest.scheduledAt ?? quest.createdAt,
    maxTeamSize: quest.maxTeamSize ?? quest.recommendedTeamSize,
    participants,
    helpers,
    payouts: (quest.payouts ?? []).map((payout) => ({
      ...payout,
      amount: payout.amount ?? byUser.get(payout.userId)?.rewardAmount ?? 0,
      finalAmount: payout.finalAmount ?? payout.amount ?? byUser.get(payout.userId)?.rewardAmount ?? 0,
      rewardPercent: payout.rewardPercent ?? byUser.get(payout.userId)?.rewardPercent ?? null,
      rewardItems: normalizeRewardItems(payout.rewardItems ?? byUser.get(payout.userId)?.rewardItems),
      bonusAmount: payout.bonusAmount ?? byUser.get(payout.userId)?.bonusAmount ?? 0,
      bonusPercent: payout.bonusPercent ?? byUser.get(payout.userId)?.bonusPercent ?? 0,
      status: payout.status ?? byUser.get(payout.userId)?.payoutStatus ?? 'pending',
      paidBy: payout.paidBy ?? byUser.get(payout.userId)?.paidBy ?? null,
      paidAt: payout.paidAt ?? byUser.get(payout.userId)?.paidAt ?? null,
      payoutEventKey: payout.payoutEventKey ?? payoutEventKey(quest.id, payout.userId)
    })),
    status: normalizeQuestStatus(quest.status),
    totalAmount: quest.totalAmount ?? memberRewardPool,
    reportSentToAccountingAt: quest.reportSentToAccountingAt ?? null,
    paidAt: quest.paidAt ?? null,
    paidBy: quest.paidBy ?? null,
    cooldownUntil: quest.cooldownUntil ?? null,
    cooldownHours: quest.cooldownHours ?? 24,
    syncSource: quest.syncSource ?? 'family_hub',
    auditTrail: quest.auditTrail ?? []
  };
}

function ledgerSignedAmount(entry: FamilyLedgerEntry) {
  if (entry.type === 'income' || entry.type === 'adjustment') return entry.amount;
  return -entry.amount;
}

export function calculateFamilyCapital(months = readFamilyAccountingMonths()) {
  return months.flatMap((month) => month.ledger ?? []).reduce((total, entry) => total + ledgerSignedAmount(entry), 0);
}

export function calculateMonthlyEarning(month: FamilyAccountingMonth, userId: string) {
  return month.bonuses
    .filter((bonus) => bonus.userId === userId && bonus.source === 'quest_report' && bonus.status === 'paid')
    .reduce((total, bonus) => total + (bonus.amount ?? 0), 0);
}

export function calculatePremiumAmount(monthlyEarning: number, rules = readFamilyPremiumRules()) {
  const tier = [...rules.tiers]
    .sort((a, b) => b.minMonthlyEarning - a.minMonthlyEarning)
    .find((item) => monthlyEarning >= item.minMonthlyEarning);
  return tier ? { amount: tier.premiumAmount, title: tier.title } : { amount: 0, title: 'Премія не набрана' };
}

function premiumBonusId(year: number, month: number, userId: string) {
  return `premium-${year}-${month}-${userId}`;
}

function isSeedDemoBonus(bonus: FamilyBonus) {
  return ['bonus-anastasia-2026-7', 'bonus-marcel-2026-7', 'bonus-nazar-2026-7'].includes(bonus.id);
}

export function readFamilyEconomyEntries(): FamilyEconomyEntry[] {
  return readJson(ECONOMY_KEY, FAMILY_ECONOMY_ENTRIES);
}

export function saveFamilyEconomyEntries(entries: FamilyEconomyEntry[]) {
  writeJson(ECONOMY_KEY, entries);
}

export function readFamilyQuestTemplates(): FamilyQuestTemplate[] {
  const stored = readJson(QUEST_TEMPLATES_KEY, DEFAULT_FAMILY_QUEST_TEMPLATES);
  const byId = new Map(stored.map((template) => [template.id, normalizeQuestTemplate(template)]));
  for (const template of DEFAULT_FAMILY_QUEST_TEMPLATES) {
    const storedTemplate = byId.get(template.id);
    byId.set(
      template.id,
      normalizeQuestTemplate(storedTemplate ? { ...template, ...storedTemplate, imageSlot: template.imageSlot } : template)
    );
  }
  const merged = [...byId.values()];
  if (JSON.stringify(merged) !== JSON.stringify(stored)) saveFamilyQuestTemplates(merged);
  return merged;
}

export function saveFamilyQuestTemplates(templates: FamilyQuestTemplate[]) {
  writeJson(QUEST_TEMPLATES_KEY, templates);
}

export function readFamilyCustomAssets(): Partial<Record<FamilyAssetSlot, FamilyCustomAsset>> {
  const stored = readJson<Partial<Record<FamilyAssetSlot, FamilyCustomAsset>>>(FAMILY_ASSETS_KEY, {});
  let changed = false;
  const sanitized: Partial<Record<FamilyAssetSlot, FamilyCustomAsset>> = {};

  for (const [slot, asset] of Object.entries(stored) as Array<[FamilyAssetSlot, FamilyCustomAsset]>) {
    if (!asset?.blobKey) {
      changed = true;
      continue;
    }
    if (asset.dataUrl) changed = true;
    sanitized[slot] = { ...asset, dataUrl: undefined };
  }

  if (changed) writeJson(FAMILY_ASSETS_KEY, sanitized);
  return sanitized;
}

export function readFamilyAssetUrl(slot: FamilyAssetSlot): string {
  return getFamilyAssetDefaultUrl(slot);
}

export async function readFamilyAssetBlob(slot: FamilyAssetSlot): Promise<Blob | null> {
  const asset = readFamilyCustomAssets()[slot];
  if (!asset?.blobKey) return null;
  const blob = await withFamilyAssetStore<Blob | undefined>('readonly', (store) => store.get(asset.blobKey));
  return blob ?? null;
}

export function readQuestTemplateAssetUrl(template: Pick<FamilyQuestTemplate, 'id' | 'imageSlot' | 'imageUrl'>): string {
  const slot = template.imageSlot ?? getQuestTemplateAssetSlot(template.id);
  return slot ? readFamilyAssetUrl(slot) : template.imageUrl;
}

export async function saveFamilyCustomAsset(asset: FamilyCustomAsset, blob: Blob) {
  await withFamilyAssetStore<IDBValidKey>('readwrite', (store) => store.put(blob, asset.blobKey));
  const metadata: FamilyCustomAsset = { ...asset, dataUrl: undefined };
  writeJson(FAMILY_ASSETS_KEY, {
    ...readFamilyCustomAssets(),
    [asset.slot]: metadata
  });
  notifyFamilyAssetsUpdated();
}

export async function resetFamilyCustomAsset(slot: FamilyAssetSlot) {
  const assets = { ...readFamilyCustomAssets() };
  const blobKey = assets[slot]?.blobKey;
  if (blobKey) {
    await withFamilyAssetStore<undefined>('readwrite', (store) => store.delete(blobKey));
  }
  delete assets[slot];
  writeJson(FAMILY_ASSETS_KEY, assets);
  notifyFamilyAssetsUpdated();
}

export function readFamilyQuests(): FamilyQuest[] {
  const stored = readJson(QUESTS_KEY, DEFAULT_FAMILY_QUESTS);
  if (!Array.isArray(stored) || stored.some((quest) => !isModernQuest(quest))) {
    saveFamilyQuests(DEFAULT_FAMILY_QUESTS);
    return DEFAULT_FAMILY_QUESTS;
  }
  const normalized = stored.map(normalizeQuest);
  if (JSON.stringify(normalized) !== JSON.stringify(stored)) saveFamilyQuests(normalized);
  return normalized;
}

export function saveFamilyQuests(quests: FamilyQuest[]) {
  writeJson(QUESTS_KEY, quests);
}

export function readFamilyQuestReports(): FamilyQuestReport[] {
  return readJson(QUEST_REPORTS_KEY, []);
}

export function saveFamilyQuestReports(reports: FamilyQuestReport[]) {
  writeJson(QUEST_REPORTS_KEY, reports);
}

export function readFamilyAccountingMonths(): FamilyAccountingMonth[] {
  const stored = readJson(ACCOUNTING_KEY, DEFAULT_ACCOUNTING_MONTHS);
  let changed = false;
  const normalized = stored.map((month) => {
    const bonuses = month.bonuses.filter((bonus) => {
      if (isSeedDemoBonus(bonus)) {
        changed = true;
        return false;
      }
      return true;
    });
    const questReports = (month.questReports ?? []).map((report) => {
      const memberRewardPool = report.memberRewardPool ?? report.totalAmount ?? 0;
      const familyReward = familyRewardOf(report);
      const totalReward = report.totalReward ?? memberRewardPool + familyReward;
      return {
        ...report,
        totalReward,
        memberRewardPool,
        familyBankShare: familyReward || Math.max(0, totalReward - memberRewardPool),
        familyReward: familyReward || Math.max(0, totalReward - memberRewardPool),
        splitMode: rewardModeOf(report),
        rewardMode: rewardModeOf(report),
        helpers: report.helpers ?? [],
        participation: report.participation ?? []
      };
    });
    const next = {
      ...month,
      totalFund: 0,
      bonuses,
      questReports,
      auditTrail: month.auditTrail ?? [],
      ledger: month.ledger ?? []
    };
    if (month.totalFund !== 0 || bonuses.length !== month.bonuses.length || !month.ledger) changed = true;
    return next;
  });
  if (changed) saveFamilyAccountingMonths(normalized);
  return normalized;
}

export function saveFamilyAccountingMonths(months: FamilyAccountingMonth[]) {
  writeJson(ACCOUNTING_KEY, months);
}

export function readFamilyPremiumRules(): FamilyPremiumRules {
  return readJson(PREMIUM_RULES_KEY, DEFAULT_PREMIUM_RULES);
}

export function saveFamilyPremiumRules(rules: FamilyPremiumRules, actorId: string) {
  const now = new Date().toISOString();
  writeJson(PREMIUM_RULES_KEY, { ...rules, updatedBy: actorId, updatedAt: now });
}

export function readFamilyContentBlocks(): FamilyEditableContentBlock[] {
  const stored = readJson<FamilyEditableContentBlock[]>(FAMILY_CONTENT_BLOCKS_KEY, DEFAULT_FAMILY_CONTENT_BLOCKS);
  const byId = new Map(stored.map((block) => [block.id, block]));
  let changed = false;

  for (const fallback of DEFAULT_FAMILY_CONTENT_BLOCKS) {
    if (!byId.has(fallback.id)) {
      byId.set(fallback.id, fallback);
      changed = true;
    }
  }

  const merged = DEFAULT_FAMILY_CONTENT_BLOCKS.map((fallback) => ({
    ...fallback,
    ...byId.get(fallback.id)
  }));
  if (changed) writeJson(FAMILY_CONTENT_BLOCKS_KEY, merged);
  return merged;
}

export function saveFamilyContentBlocks(blocks: FamilyEditableContentBlock[]) {
  writeJson(FAMILY_CONTENT_BLOCKS_KEY, blocks);
}

export function saveFamilyContentBlock(
  block: FamilyEditableContentBlock,
  actorId: string
): FamilyEditableContentBlock[] {
  const nextBlock: FamilyEditableContentBlock = {
    ...block,
    title: block.title.trim(),
    body: block.body.trim(),
    contact: block.contact?.trim() || null,
    updatedBy: actorId,
    updatedAt: block.updatedAt || new Date().toISOString()
  };
  const blocks = readFamilyContentBlocks();
  const nextBlocks = blocks.some((item) => item.id === nextBlock.id)
    ? blocks.map((item) => (item.id === nextBlock.id ? nextBlock : item))
    : [...blocks, nextBlock];
  saveFamilyContentBlocks(nextBlocks);
  return nextBlocks;
}

export function getUserPremiumArchive(userId: string) {
  return readFamilyAccountingMonths().map((month) => {
    const earning = calculateMonthlyEarning(month, userId);
    const deserved = calculatePremiumAmount(earning);
    const premium =
      month.bonuses.find((bonus) => bonus.id === premiumBonusId(month.year, month.month, userId)) ??
      month.bonuses.find((bonus) => bonus.userId === userId && bonus.source === 'premium') ??
      null;
    return {
      month,
      earning,
      deservedAmount: premium?.amount ?? deserved.amount,
      deservedTitle: premium?.rewardLabel ?? deserved.title,
      bonus: premium,
      status: premium?.status ?? (deserved.amount > 0 ? 'calculated' : 'not_eligible')
    };
  });
}

export function getCurrentAccountingMonth(now = new Date()): FamilyAccountingMonth {
  const months = readFamilyAccountingMonths();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const existing = months.find((item) => item.month === month && item.year === year);
  if (existing) return existing;

  const created: FamilyAccountingMonth = {
    id: `accounting-${year}-${month}`,
    month,
    year,
    totalFund: 0,
    bonuses: [],
    questReports: [],
    auditTrail: [],
    ledger: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
  saveFamilyAccountingMonths([created, ...months]);
  return created;
}

export function getCurrentUserBonus(userId: string, now = new Date()): FamilyBonus | null {
  const month = getCurrentAccountingMonth(now);
  const archive = getUserPremiumArchive(userId).find((item) => item.month.id === month.id);
  if (archive?.bonus) return archive.bonus;
  if (!archive || archive.deservedAmount <= 0) return null;
  return {
    id: premiumBonusId(month.year, month.month, userId),
    userId,
    month: month.month,
    year: month.year,
    amount: archive.deservedAmount,
    rewardLabel: archive.deservedTitle,
    reason: `Премія за місячний заробіток ${archive.earning.toLocaleString('uk-UA')} $ із сімейних квестів`,
    status: 'calculated',
    approvedBy: null,
    paidBy: null,
    paidAt: null,
    comment: null,
    source: 'premium',
    questReportId: null,
    createdAt: month.createdAt,
    updatedAt: month.updatedAt
  };
}

export function ensurePremiumBonus(userId: string, actorId: string, comment: string | null = null) {
  const now = new Date().toISOString();
  const current = getCurrentAccountingMonth(new Date());
  const months = readFamilyAccountingMonths();
  const month = months.find((item) => item.id === current.id) ?? current;
  const earning = calculateMonthlyEarning(month, userId);
  const premium = calculatePremiumAmount(earning);
  const id = premiumBonusId(month.year, month.month, userId);
  const existing = month.bonuses.find((bonus) => bonus.id === id);
  const nextBonus: FamilyBonus = {
    id,
    userId,
    month: month.month,
    year: month.year,
    amount: premium.amount > 0 ? premium.amount : null,
    rewardLabel: premium.title,
    reason: `Премія за місячний заробіток ${earning.toLocaleString('uk-UA')} $ із сімейних квестів`,
    status: premium.amount > 0 ? existing?.status ?? 'calculated' : 'not_eligible',
    approvedBy: actorId,
    paidBy: existing?.paidBy ?? null,
    paidAt: existing?.paidAt ?? null,
    comment: comment ?? existing?.comment ?? null,
    source: 'premium',
    questReportId: null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  const updatedMonth = {
    ...month,
    bonuses: existing
      ? month.bonuses.map((bonus) => (bonus.id === id ? nextBonus : bonus))
      : [nextBonus, ...month.bonuses],
    updatedAt: now
  };
  saveFamilyAccountingMonths(months.map((item) => (item.id === updatedMonth.id ? updatedMonth : item)));
  return nextBonus;
}

function auditValue(value: string | number | null | undefined) {
  return value ?? null;
}

function createAccountingAuditEntry(input: Omit<FamilyAccountingAuditEntry, 'id' | 'createdAt'>, now: string): FamilyAccountingAuditEntry {
  return {
    ...input,
    id: `accounting-audit-${now}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: now
  };
}

function createLedgerEntry(input: Omit<FamilyLedgerEntry, 'id' | 'createdAt'>, now: string): FamilyLedgerEntry {
  return {
    ...input,
    id: `ledger-${now}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: now
  };
}

function hasLedgerEntry(month: FamilyAccountingMonth, type: FamilyLedgerEntry['type'], relatedEntityId: string) {
  return (month.ledger ?? []).some((entry) => entry.type === type && entry.relatedEntityId === relatedEntityId);
}

export function addManualLedgerExpense(input: {
  amount: number;
  title: string;
  comment: string | null;
  createdBy: string;
}) {
  const now = new Date().toISOString();
  const months = readFamilyAccountingMonths();
  const current = getCurrentAccountingMonth(new Date());
  const ledgerEntry = createLedgerEntry(
    {
      amount: Math.max(0, input.amount),
      type: 'expense',
      title: input.title,
      comment: input.comment,
      createdBy: input.createdBy,
      relatedEntityType: 'manual',
      relatedEntityId: null
    },
    now
  );
  const auditEntry = createAccountingAuditEntry(
    {
      actorId: input.createdBy,
      action: 'ledger_entry_created',
      entityType: 'ledger_entry',
      entityId: ledgerEntry.id,
      field: 'expense',
      before: null,
      after: ledgerEntry.amount
    },
    now
  );
  const updatedMonth: FamilyAccountingMonth = {
    ...current,
    ledger: [ledgerEntry, ...(current.ledger ?? [])],
    auditTrail: [auditEntry, ...(current.auditTrail ?? [])],
    updatedAt: now
  };
  saveFamilyAccountingMonths(
    months.some((month) => month.id === updatedMonth.id)
      ? months.map((month) => (month.id === updatedMonth.id ? updatedMonth : month))
      : [updatedMonth, ...months]
  );
  return ledgerEntry;
}

export function updateFamilyBonus(
  bonusId: string,
  actorId: string,
  updates: {
    status?: FamilyBonusStatus;
    amount?: number | null;
    comment?: string | null;
  }
): { month: FamilyAccountingMonth; before: FamilyBonus; after: FamilyBonus } | null {
  const now = new Date().toISOString();
  const months = readFamilyAccountingMonths();
  let result: { month: FamilyAccountingMonth; before: FamilyBonus; after: FamilyBonus } | null = null;

  const nextMonths = months.map((month) => {
    const bonus = month.bonuses.find((item) => item.id === bonusId);
    if (!bonus) return month;

    const nextStatus = updates.status ?? bonus.status;
    const statusBecamePaid = bonus.status !== 'paid' && nextStatus === 'paid';
    const statusBecameUnpaid = bonus.status === 'paid' && nextStatus !== 'paid';
    const nextBonus: FamilyBonus = {
      ...bonus,
      status: nextStatus,
      amount: updates.amount !== undefined ? updates.amount : bonus.amount,
      comment: updates.comment !== undefined ? updates.comment : bonus.comment,
      paidBy: statusBecamePaid ? actorId : statusBecameUnpaid ? null : bonus.paidBy,
      paidAt: statusBecamePaid ? now : statusBecameUnpaid ? null : bonus.paidAt,
      updatedAt: now
    };

    const auditTrail = [...(month.auditTrail ?? [])];
    if (bonus.status !== nextBonus.status) {
      auditTrail.unshift(
        createAccountingAuditEntry(
          {
            actorId,
            action: 'bonus_status_changed',
            entityType: 'bonus',
            entityId: bonus.id,
            field: 'status',
            before: bonus.status,
            after: nextBonus.status
          },
          now
        )
      );
    }
    if (bonus.amount !== nextBonus.amount) {
      auditTrail.unshift(
        createAccountingAuditEntry(
          {
            actorId,
            action: 'bonus_amount_changed',
            entityType: 'bonus',
            entityId: bonus.id,
            field: 'amount',
            before: auditValue(bonus.amount),
            after: auditValue(nextBonus.amount)
          },
          now
        )
      );
    }
    if ((bonus.comment ?? '') !== (nextBonus.comment ?? '')) {
      auditTrail.unshift(
        createAccountingAuditEntry(
          {
            actorId,
            action: 'bonus_comment_changed',
            entityType: 'bonus',
            entityId: bonus.id,
            field: 'comment',
            before: bonus.comment,
            after: nextBonus.comment
          },
          now
        )
      );
    }

    const questReports = (month.questReports ?? []).map((report) => {
      if (report.id !== bonus.questReportId) return report;
      const payouts = report.payouts.map((payout) => {
        if (payout.userId !== bonus.userId) return payout;
        const nextPayout = {
          ...payout,
          amount: nextBonus.amount ?? payout.amount,
          status: nextBonus.status === 'paid' ? ('paid' as const) : nextBonus.status === 'pending_payout' ? ('pending' as const) : ('unpaid' as const),
          paidBy: nextBonus.status === 'paid' ? actorId : null,
          paidAt: nextBonus.status === 'paid' ? now : null
        };
        if (payout.status !== nextPayout.status || payout.amount !== nextPayout.amount) {
          auditTrail.unshift(
            createAccountingAuditEntry(
              {
                actorId,
                action: 'quest_payout_changed',
                entityType: 'quest_payout',
                entityId: `${report.id}:${payout.userId}`,
                field: 'payout',
                before: `${payout.amount}:${payout.status ?? 'pending'}`,
                after: `${nextPayout.amount}:${nextPayout.status ?? 'pending'}`
              },
              now
            )
          );
        }
        return nextPayout;
      });
      return { ...report, payouts, updatedAt: now };
    });

    const ledger = [...(month.ledger ?? [])];
    if (statusBecamePaid && (nextBonus.amount ?? 0) > 0 && !hasLedgerEntry(month, 'payout', nextBonus.id)) {
      ledger.unshift(
        createLedgerEntry(
          {
            amount: nextBonus.amount ?? 0,
            type: 'payout',
            title: nextBonus.source === 'premium' ? `Премія: ${nextBonus.userId}` : `Виплата: ${nextBonus.userId}`,
            comment: nextBonus.comment,
            createdBy: actorId,
            relatedEntityType: 'bonus',
            relatedEntityId: nextBonus.id
          },
          now
        )
      );
    }

    const nextMonth: FamilyAccountingMonth = {
      ...month,
      bonuses: month.bonuses.map((item) => (item.id === bonus.id ? nextBonus : item)),
      questReports,
      ledger,
      auditTrail,
      updatedAt: now
    };
    result = { month: nextMonth, before: bonus, after: nextBonus };
    return nextMonth;
  });

  if (result) saveFamilyAccountingMonths(nextMonths);
  return result;
}

export function getFamilyQuestPeople(quest: FamilyQuest) {
  return allQuestPeople(quest);
}

export function calculateQuestRewardPlan(quest: FamilyQuest) {
  const people = allQuestPeople(quest);
  const mode = rewardModeOf(quest);
  const pool = Math.max(0, quest.memberRewardPool ?? quest.totalAmount ?? 0);
  const baseAmounts = new Map<string, number>();
  const percents = new Map<string, number>();
  let percentTotal = 0;

  if (mode === 'equal' && people.length > 0) {
    const base = Math.floor(pool / people.length);
    let remainder = pool - base * people.length;
    people.forEach((person) => {
      const amount = base + (remainder > 0 ? 1 : 0);
      remainder -= remainder > 0 ? 1 : 0;
      baseAmounts.set(person.userId, amount);
      percents.set(person.userId, pool > 0 ? (amount / pool) * 100 : 0);
    });
  } else if (mode === 'percentage') {
    people.forEach((person) => {
      const percent = Number(person.rewardPercent ?? 0);
      percentTotal += percent;
      percents.set(person.userId, percent);
      baseAmounts.set(person.userId, Math.round((pool * percent) / 100));
    });
  } else {
    people.forEach((person) => {
      const percent = Number(person.rewardPercent ?? 0);
      const amountFromPercent = percent > 0 ? Math.round((pool * percent) / 100) : 0;
      percentTotal += percent;
      percents.set(person.userId, percent);
      baseAmounts.set(person.userId, Number(person.rewardAmount ?? 0) || amountFromPercent);
    });
  }

  const payouts = people.map<FamilyQuestPayout>((person) => {
    const baseAmount = baseAmounts.get(person.userId) ?? 0;
    const bonusAmount = Number(person.bonusAmount ?? 0);
    const bonusPercent = Number(person.bonusPercent ?? 0);
    const bonusFromPercent = bonusPercent > 0 ? Math.round((pool * bonusPercent) / 100) : 0;
    const amount = baseAmount + bonusAmount + bonusFromPercent;
    const existing = quest.payouts.find((payout) => payout.userId === person.userId);
    return {
      userId: person.userId,
      amount,
      finalAmount: amount,
      rewardPercent: percents.get(person.userId) ?? null,
      rewardItems: normalizeRewardItems(person.rewardItems),
      bonusAmount,
      bonusPercent,
      status: existing?.status ?? person.payoutStatus ?? 'pending',
      paidBy: existing?.paidBy ?? person.paidBy ?? null,
      paidAt: existing?.paidAt ?? person.paidAt ?? null,
      payoutEventKey: existing?.payoutEventKey ?? person.payoutEventKey ?? payoutEventKey(quest.id, person.userId)
    };
  });

  const preparedAmount = payouts.reduce((total, payout) => total + payout.amount, 0);
  const paidToMembers = payouts
    .filter((payout) => payout.status === 'paid')
    .reduce((total, payout) => total + payout.amount, 0);
  const percentDistributed = mode === 'equal' ? (people.length > 0 ? 100 : 0) : percentTotal;
  const errors: string[] = [];
  if (quest.memberRewardPool + familyRewardOf(quest) > quest.totalReward) errors.push('memberRewardPool + familyReward cannot exceed totalReward');
  if (['percentage'].includes(mode) && Math.round(percentDistributed * 100) / 100 > 100) errors.push('percentage distribution exceeds 100%');
  if (['fixed', 'mixed', 'manual'].includes(mode) && preparedAmount > pool) errors.push('prepared payouts exceed memberRewardPool');
  if (mode === 'mixed' && preparedAmount > pool) errors.push('mixed payouts exceed memberRewardPool');

  return {
    mode,
    pool,
    payouts,
    preparedAmount,
    paidToMembers,
    remainingMemberPool: Math.max(0, pool - paidToMembers),
    undistributedAmount: Math.max(0, pool - preparedAmount),
    percentDistributed,
    percentRemaining: Math.max(0, 100 - percentDistributed),
    isComplete:
      mode === 'percentage'
        ? Math.round(percentDistributed * 100) / 100 === 100 && preparedAmount <= pool
        : preparedAmount <= pool,
    errors
  };
}

export function applyQuestRewardPlan(quest: FamilyQuest): FamilyQuest {
  const plan = calculateQuestRewardPlan(quest);
  const byUser = new Map(plan.payouts.map((payout) => [payout.userId, payout]));
  const updatePerson = (person: FamilyQuestParticipant): FamilyQuestParticipant => {
    const payout = byUser.get(person.userId);
    if (!payout) return person;
    return {
      ...person,
      rewardPercent: payout.rewardPercent ?? person.rewardPercent ?? null,
      rewardAmount: payout.amount,
      rewardItems: payout.rewardItems ?? [],
      bonusAmount: payout.bonusAmount ?? 0,
      bonusPercent: payout.bonusPercent ?? 0,
      payoutStatus: payout.status ?? 'pending',
      paidAt: payout.paidAt ?? null,
      paidBy: payout.paidBy ?? null,
      payoutEventKey: payout.payoutEventKey
    };
  };
  return {
    ...quest,
    participants: quest.participants.map(updatePerson),
    helpers: (quest.helpers ?? []).map(updatePerson),
    payouts: plan.payouts,
    totalAmount: quest.memberRewardPool
  };
}

export function updateFamilyQuestState(
  quest: FamilyQuest,
  nextStatus: FamilyQuestStatus,
  actor: string,
  comment: string | null = null
): FamilyQuest {
  const now = new Date().toISOString();
  const currentStatus = normalizeQuestStatus(quest.status);
  const normalizedNext = normalizeQuestStatus(nextStatus);
  if (!canTransitionFamilyQuest(currentStatus, normalizedNext)) return quest;
  const action: FamilyQuestAuditAction =
    normalizedNext === 'recruiting'
      ? 'recruiting_opened'
      : normalizedNext === 'scheduled'
        ? 'recruiting_closed'
        : normalizedNext === 'active' && currentStatus === 'paused'
          ? 'resumed'
          : normalizedNext === 'active'
            ? 'started'
            : normalizedNext === 'paused'
              ? 'paused'
              : normalizedNext === 'stopped' && comment
                ? 'stopped_with_comment'
                : normalizedNext === 'stopped'
                  ? 'stopped'
                  : normalizedNext === 'completed'
                    ? 'completed'
                    : normalizedNext === 'reported'
                      ? 'report_created'
                      : normalizedNext === 'sent_to_accounting'
                        ? 'report_sent_to_accounting'
                        : 'quest_edited';
  return {
    ...quest,
    status: normalizedNext,
    auditTrail: [
      createQuestAuditEntry(
        { action, actor, comment, previousState: currentStatus, newState: normalizedNext },
        now
      ),
      ...(quest.auditTrail ?? [])
    ],
    updatedAt: now
  };
}

export function upsertQuestPerson(
  quest: FamilyQuest,
  input: {
    userId: string;
    nickname?: string;
    type: 'participant' | 'helper';
    actor: string;
    joinedLate?: boolean;
    participationNote?: string | null;
    addedManually?: boolean;
  }
): FamilyQuest {
  const now = new Date().toISOString();
  const participant = quest.participants.find((item) => item.userId === input.userId);
  const helper = (quest.helpers ?? []).find((item) => item.userId === input.userId);
  const existing = participant ?? helper;
  const nextPerson = normalizeParticipant(
    {
      ...(existing ?? { userId: input.userId, joinedAt: now }),
      nickname: input.nickname ?? existing?.nickname ?? input.userId,
      type: input.type,
      joinedLate: input.joinedLate ?? existing?.joinedLate ?? false,
      participationNote: input.participationNote ?? existing?.participationNote ?? null,
      addedManually: input.addedManually ?? true,
      addedBy: existing?.addedBy ?? input.actor
    },
    input.type,
    quest.id,
    now
  );
  const participants = quest.participants.filter((item) => item.userId !== input.userId);
  const helpers = (quest.helpers ?? []).filter((item) => item.userId !== input.userId);
  const action: FamilyQuestAuditAction = existing
    ? input.type === 'participant'
      ? 'moved_to_participant'
      : 'moved_to_helper'
    : input.type === 'participant'
      ? 'participant_added'
      : 'helper_added';
  const nextQuest = {
    ...quest,
    participants: input.type === 'participant' ? [...participants, nextPerson] : participants,
    helpers: input.type === 'helper' ? [...helpers, nextPerson] : helpers,
    auditTrail: [
      createQuestAuditEntry({ action, actor: input.actor, relatedUserId: input.userId, comment: input.participationNote ?? null }, now),
      ...(quest.auditTrail ?? [])
    ],
    updatedAt: now
  };
  return applyQuestRewardPlan(nextQuest);
}

export function removeQuestPerson(quest: FamilyQuest, userId: string, actor: string, comment: string | null = null): FamilyQuest {
  const now = new Date().toISOString();
  const nextQuest = {
    ...quest,
    participants: quest.participants.filter((item) => item.userId !== userId),
    helpers: (quest.helpers ?? []).filter((item) => item.userId !== userId),
    payouts: quest.payouts.filter((item) => item.userId !== userId),
    auditTrail: [
      createQuestAuditEntry({ action: 'participant_removed', actor, relatedUserId: userId, comment }, now),
      ...(quest.auditTrail ?? [])
    ],
    updatedAt: now
  };
  return applyQuestRewardPlan(nextQuest);
}

export function createFamilyQuestReport(quest: FamilyQuest, confirmedBy: string, comment: string | null) {
  const now = new Date();
  const plannedQuest = applyQuestRewardPlan(quest);
  const plan = calculateQuestRewardPlan(plannedQuest);
  if (!plan.isComplete) {
    throw new Error('Quest reward distribution is not complete');
  }
  if (plan.errors.length) {
    throw new Error(plan.errors.join('; '));
  }
  const participants = plannedQuest.participants.map((participant) => participant.userId);
  const helpers = (plannedQuest.helpers ?? []).map((helper) => helper.userId);
  const totalAmount = plannedQuest.memberRewardPool || plannedQuest.totalAmount || plannedQuest.rewardAmount || 0;

  const report: FamilyQuestReport = {
    id: plannedQuest.reportId ?? `quest-report-${plannedQuest.id}`,
    questId: plannedQuest.id,
    templateId: plannedQuest.templateId,
    title: plannedQuest.title,
    participants,
    helpers,
    participation: allQuestPeople(plannedQuest),
    totalAmount,
    totalReward: plannedQuest.totalReward ?? totalAmount + familyRewardOf(plannedQuest),
    memberRewardPool: totalAmount,
    familyBankShare: familyRewardOf(plannedQuest),
    familyReward: familyRewardOf(plannedQuest),
    splitMode: rewardModeOf(plannedQuest),
    rewardMode: rewardModeOf(plannedQuest),
    payouts: plan.payouts,
    confirmedBy,
    comment,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    transferredToAccountingAt: null,
    discordGuildId: plannedQuest.discordGuildId ?? null,
    discordChannelId: plannedQuest.discordChannelId ?? null,
    discordMessageId: plannedQuest.discordMessageId ?? null,
    discordVoiceChannelId: plannedQuest.discordVoiceChannelId ?? null,
    discordCreatedById: plannedQuest.discordCreatedById ?? null,
    discordSyncedAt: plannedQuest.discordSyncedAt ?? null,
    syncSource: plannedQuest.syncSource ?? 'family_hub',
    externalRevision: plannedQuest.externalRevision ?? null
  };

  return report;
}

export function transferQuestReportToAccounting(report: FamilyQuestReport, paidBy: string) {
  const now = new Date();
  const months = readFamilyAccountingMonths();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const existing = months.find((item) => item.month === month && item.year === year) ?? getCurrentAccountingMonth(now);
  const nextReport: FamilyQuestReport = {
    ...report,
    transferredToAccountingAt: report.transferredToAccountingAt ?? now.toISOString(),
    updatedAt: now.toISOString()
  };
  const existingReportIds = new Set((existing.questReports ?? []).map((item) => item.id));
  const questReports = existingReportIds.has(nextReport.id)
    ? (existing.questReports ?? []).map((item) => (item.id === nextReport.id ? nextReport : item))
    : [nextReport, ...(existing.questReports ?? [])];

  const existingBonusIds = new Set(existing.bonuses.map((bonus) => bonus.id));
  const questBonuses = nextReport.payouts
    .filter((payout) => payout.amount > 0 || (payout.rewardItems ?? []).length > 0)
    .map<FamilyBonus>((payout) => ({
      id: `bonus-${nextReport.id}-${payout.userId}`,
      userId: payout.userId,
      month,
      year,
      amount: payout.amount,
      rewardLabel: null,
      reason: `Виплата за сімейний квест: ${nextReport.title}`,
      status: payout.status === 'paid' ? 'paid' : 'pending_payout',
      approvedBy: nextReport.confirmedBy,
      paidBy: payout.status === 'paid' ? paidBy : null,
      paidAt: payout.status === 'paid' ? now.toISOString() : null,
      comment: [
        nextReport.comment,
        payout.rewardPercent != null ? `rewardPercent: ${payout.rewardPercent}%` : null,
        (payout.rewardItems ?? []).length ? `items: ${(payout.rewardItems ?? []).map((item) => `${item.title} x${item.quantity}`).join(', ')}` : null
      ]
        .filter(Boolean)
        .join('\n') || null,
      source: 'quest_report',
      questReportId: nextReport.id,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    }))
    .filter((bonus) => !existingBonusIds.has(bonus.id));

  const updatedMonth: FamilyAccountingMonth = {
    ...existing,
    questReports,
    bonuses: [...questBonuses, ...existing.bonuses],
    ledger:
      familyRewardOf(nextReport) > 0 && !hasLedgerEntry(existing, 'income', nextReport.id)
        ? [
            createLedgerEntry(
              {
                amount: familyRewardOf(nextReport),
                type: 'income',
                title: `Частка сім’ї з квесту: ${nextReport.title}`,
                comment: nextReport.comment,
                createdBy: paidBy,
                relatedEntityType: 'quest_report',
                relatedEntityId: nextReport.id
              },
              now.toISOString()
            ),
            ...(existing.ledger ?? [])
          ]
        : existing.ledger ?? [],
    updatedAt: now.toISOString()
  };

  const nextMonths = months.some((item) => item.id === updatedMonth.id)
    ? months.map((item) => (item.id === updatedMonth.id ? updatedMonth : item))
    : [updatedMonth, ...months];
  saveFamilyAccountingMonths(nextMonths);

  const reports = readFamilyQuestReports();
  saveFamilyQuestReports(
    reports.some((item) => item.id === nextReport.id)
      ? reports.map((item) => (item.id === nextReport.id ? nextReport : item))
      : [nextReport, ...reports]
  );
  return updatedMonth;
}

export function issueFamilyQuestPayouts(input: {
  questId: string;
  actorId: string;
  userIds?: string[];
  comment?: string | null;
}) {
  const now = new Date().toISOString();
  const quests = readFamilyQuests();
  let quest = quests.find((item) => item.id === input.questId);
  if (!quest) return { quest: null, report: null, issuedBonuses: [] as FamilyBonus[] };

  quest = applyQuestRewardPlan(quest);
  const plan = calculateQuestRewardPlan(quest);
  if (!plan.isComplete || plan.errors.length) {
    throw new Error(plan.errors.join('; ') || 'Quest reward distribution is not complete');
  }

  const reports = readFamilyQuestReports();
  let report = reports.find((item) => item.id === quest?.reportId || item.questId === input.questId) ?? null;
  if (!report) {
    report = createFamilyQuestReport(quest, input.actorId, input.comment ?? 'Dragon House quest report.');
    saveFamilyQuestReports([report, ...reports]);
    quest = {
      ...updateFamilyQuestState(quest, 'reported', input.actorId, input.comment ?? null),
      reportId: report.id
    };
  }

  if (!report.transferredToAccountingAt) {
    transferQuestReportToAccounting(report, input.actorId);
    report = { ...report, transferredToAccountingAt: now, updatedAt: now };
    saveFamilyQuestReports(readFamilyQuestReports().map((item) => (item.id === report?.id ? report : item)));
    quest = {
      ...updateFamilyQuestState(quest, 'sent_to_accounting', input.actorId, input.comment ?? null),
      reportSentToAccountingAt: now
    };
  }

  const allowed = new Set(input.userIds ?? plan.payouts.map((payout) => payout.userId));
  const payable = plan.payouts.filter((payout) => allowed.has(payout.userId) && payout.status !== 'paid' && payout.amount >= 0);
  const issuedBonuses: FamilyBonus[] = [];

  for (const payout of payable) {
    const bonusId = `bonus-${report.id}-${payout.userId}`;
    const result = updateFamilyBonus(bonusId, input.actorId, {
      status: 'paid',
      amount: payout.amount,
      comment: input.comment ?? null
    });
    if (result) issuedBonuses.push(result.after);
  }

  const paidUsers = new Set([...plan.payouts.filter((payout) => payout.status === 'paid').map((payout) => payout.userId), ...payable.map((payout) => payout.userId)]);
  const markPerson = (person: FamilyQuestParticipant): FamilyQuestParticipant =>
    paidUsers.has(person.userId)
      ? { ...person, payoutStatus: 'paid', paidAt: person.paidAt ?? now, paidBy: person.paidBy ?? input.actorId }
      : person;
  const nextPayouts = plan.payouts.map((payout) =>
    paidUsers.has(payout.userId)
      ? { ...payout, status: 'paid' as const, paidAt: payout.paidAt ?? now, paidBy: payout.paidBy ?? input.actorId }
      : payout
  );
  const allPaid = nextPayouts.length > 0 && nextPayouts.every((payout) => payout.status === 'paid');
  const updatedQuest: FamilyQuest = {
    ...quest,
    status: allPaid ? 'paid' : quest.status,
    payouts: nextPayouts,
    participants: quest.participants.map(markPerson),
    helpers: (quest.helpers ?? []).map(markPerson),
    paidAt: allPaid ? quest.paidAt ?? now : quest.paidAt ?? null,
    paidBy: allPaid ? quest.paidBy ?? input.actorId : quest.paidBy ?? null,
    auditTrail: [
      createQuestAuditEntry(
        {
          action: input.userIds ? 'payout_issued' : 'issue_all_executed',
          actor: input.actorId,
          comment: input.comment ?? null,
          metadata: { issuedCount: payable.length }
        },
        now
      ),
      ...(quest.auditTrail ?? [])
    ],
    updatedAt: now
  };
  saveFamilyQuests(quests.map((item) => (item.id === updatedQuest.id ? updatedQuest : item)));

  const updatedReport: FamilyQuestReport = {
    ...report,
    payouts: nextPayouts,
    updatedAt: now
  };
  saveFamilyQuestReports(readFamilyQuestReports().map((item) => (item.id === updatedReport.id ? updatedReport : item)));

  return { quest: updatedQuest, report: updatedReport, issuedBonuses };
}

export function readNotifiedFamilyNewsIds(): string[] {
  return readJson(NOTIFIED_NEWS_KEY, []);
}

export function saveNotifiedFamilyNewsIds(ids: string[]) {
  writeJson(NOTIFIED_NEWS_KEY, ids);
}
