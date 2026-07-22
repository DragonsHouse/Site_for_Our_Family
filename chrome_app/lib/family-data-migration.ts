import {
  DEFAULT_FAMILY_POSTS,
  DEMO_FAMILY_USERS,
  FAMILY_ECONOMY_ENTRIES,
  FAMILY_POSTS_KEY
} from './family-data';
import { DEFAULT_FAMILY_QUEST_TEMPLATES } from './family-quest-data';
import {
  DEFAULT_FAMILY_CONTENT_BLOCKS,
  DEFAULT_FAMILY_QUESTS,
  DEFAULT_PREMIUM_RULES
} from './family-repositories';
import { hasMojibakeText, sanitizeFamilyTextDeep } from './text-sanitizer';
import type {
  FamilyEditableContentBlock,
  FamilyEconomyEntry,
  FamilyPost,
  FamilyPremiumRules,
  FamilyQuest,
  FamilyQuestTemplate,
  FamilyUser
} from './family-types';

const DATA_VERSION_KEY = 'dragonHouseDataVersion';
const DATA_VERSION = '2026-07-21-visible-ukrainian-storage-v2';

const FAMILY_USERS_KEY = 'dragon_house_family_users_v1';
const FAMILY_ECONOMY_KEY = 'dragon_house_family_economy_v1';
const FAMILY_CONTENT_BLOCKS_KEY = 'dragon_house_family_content_blocks_v1';
const FAMILY_QUEST_TEMPLATES_KEY = 'dragon_house_family_quest_templates_v1';
const FAMILY_QUESTS_KEY = 'dragon_house_family_quests_v1';
const FAMILY_PREMIUM_RULES_KEY = 'dragon_house_family_premium_rules_v1';

const FAMILY_LOCAL_STORAGE_PREFIXES = [
  'dragon_house_family_',
  'dragon_house_discord_family_'
];

const PROTECTED_STORAGE_KEY_PARTS = ['token', 'password', 'secret', 'auth'];

function shouldRepairStorageKey(key: string) {
  return FAMILY_LOCAL_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix)) &&
    !PROTECTED_STORAGE_KEY_PARTS.some((part) => key.toLowerCase().includes(part));
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function stringifyStorageValue(value: unknown) {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function repairDefaultArrayRecords<T extends { id: string }>(
  value: unknown,
  defaults: T[],
  mergeDefault: (stored: T, fallback: T) => T
): unknown {
  if (!Array.isArray(value)) return value;

  const byId = new Map(defaults.map((item) => [item.id, item]));
  return value.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const stored = item as T;
    const fallback = byId.get(stored.id);
    if (!fallback || !hasMojibakeText(stored)) return stored;
    return mergeDefault(stored, fallback);
  });
}

function repairDefaultUsers(value: unknown): unknown {
  return repairDefaultArrayRecords<FamilyUser>(value, DEMO_FAMILY_USERS, (user, fallback) => ({
    ...user,
    rank: fallback.rank,
    nextRank: fallback.nextRank,
    statusMessage: fallback.statusMessage,
    tasks: hasMojibakeText(user.tasks) ? fallback.tasks : user.tasks,
    updatedAt: new Date().toISOString()
  } as FamilyUser));
}

function repairDefaultEconomyEntries(value: unknown): unknown {
  return repairDefaultArrayRecords<FamilyEconomyEntry>(value, FAMILY_ECONOMY_ENTRIES, (entry, fallback) => ({
    ...entry,
    title: fallback.title,
    description: fallback.description,
    price: fallback.price,
    note: fallback.note,
    updatedAt: new Date().toISOString()
  }));
}

function repairDefaultContentBlocks(value: unknown): unknown {
  return repairDefaultArrayRecords<FamilyEditableContentBlock>(value, DEFAULT_FAMILY_CONTENT_BLOCKS, (block, fallback) => {
    return {
      ...block,
      title: fallback.title,
      body: fallback.body,
      contact: fallback.contact,
      updatedBy: block.updatedBy || fallback.updatedBy,
      updatedAt: new Date().toISOString()
    } satisfies FamilyEditableContentBlock;
  });
}

function repairDefaultPosts(value: unknown): unknown {
  return repairDefaultArrayRecords<FamilyPost>(value, DEFAULT_FAMILY_POSTS, (post, fallback) => {
    return {
      ...post,
      title: fallback.title,
      body: fallback.body,
      serverName: fallback.serverName,
      updatedAt: new Date().toISOString()
    } satisfies FamilyPost;
  });
}

function repairDefaultQuestTemplates(value: unknown): unknown {
  return repairDefaultArrayRecords<FamilyQuestTemplate>(value, DEFAULT_FAMILY_QUEST_TEMPLATES, (template, fallback) => {
    return {
      ...template,
      title: fallback.title,
      category: fallback.category,
      rewardLabel: fallback.rewardLabel,
      steps: fallback.steps,
      hint: fallback.hint,
      route: fallback.route,
      items: fallback.items,
      requiredItems: fallback.requiredItems,
      updatedAt: new Date().toISOString()
    } satisfies FamilyQuestTemplate;
  });
}

function repairDefaultQuests(value: unknown): unknown {
  return repairDefaultArrayRecords<FamilyQuest>(value, DEFAULT_FAMILY_QUESTS, (quest, fallback) => ({
    ...quest,
    title: fallback.title,
    description: fallback.description,
    category: fallback.category,
    rewardLabel: fallback.rewardLabel,
    steps: fallback.steps,
    hint: fallback.hint,
    route: fallback.route,
    items: fallback.items,
    requiredItems: fallback.requiredItems,
    updatedAt: new Date().toISOString()
  }));
}

function repairDefaultPremiumRules(value: unknown): unknown {
  if (!value || typeof value !== 'object' || !hasMojibakeText(value)) return value;
  const rules = value as FamilyPremiumRules;
  return {
    ...rules,
    tiers: rules.tiers.map((tier) => ({
      ...tier,
      title: DEFAULT_PREMIUM_RULES.tiers.find((fallback) => fallback.id === tier.id)?.title ?? tier.title
    })),
    updatedAt: new Date().toISOString()
  } satisfies FamilyPremiumRules;
}

function repairKnownSeedRecords(key: string, value: unknown): unknown {
  if (key === FAMILY_USERS_KEY) return repairDefaultUsers(value);
  if (key === FAMILY_ECONOMY_KEY) return repairDefaultEconomyEntries(value);
  if (key === FAMILY_CONTENT_BLOCKS_KEY) return repairDefaultContentBlocks(value);
  if (key === FAMILY_POSTS_KEY) return repairDefaultPosts(value);
  if (key === FAMILY_QUEST_TEMPLATES_KEY) return repairDefaultQuestTemplates(value);
  if (key === FAMILY_QUESTS_KEY) return repairDefaultQuests(value);
  if (key === FAMILY_PREMIUM_RULES_KEY) return repairDefaultPremiumRules(value);
  return value;
}

function repairStoragePayload(key: string, value: unknown): unknown {
  const seedRepaired = repairKnownSeedRecords(key, value);
  return sanitizeFamilyTextDeep(seedRepaired);
}

export function migrateDragonHouseLocalData() {
  if (typeof window === 'undefined') return;
  const currentVersion = window.localStorage.getItem(DATA_VERSION_KEY);
  if (currentVersion === DATA_VERSION) return;

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !shouldRepairStorageKey(key)) continue;
    const raw = window.localStorage.getItem(key);
    if (raw == null) continue;

    const parsed = parseJson(raw);
    const repaired = repairStoragePayload(key, parsed);
    const nextRaw = stringifyStorageValue(repaired);
    if (nextRaw !== raw) {
      window.localStorage.setItem(key, nextRaw);
    }
  }

  window.localStorage.setItem(DATA_VERSION_KEY, DATA_VERSION);
}

async function repairChromeStorageArea(
  area: chrome.storage.StorageArea | undefined,
  versionKey: string
) {
  if (!area) return;
  const current = await area.get(versionKey);
  if (current[versionKey] === DATA_VERSION) return;

  const data = await area.get(null);
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!shouldRepairStorageKey(key)) continue;
    const repaired = repairStoragePayload(key, value);
    if (JSON.stringify(repaired) !== JSON.stringify(value)) {
      patch[key] = repaired;
    }
  }
  patch[versionKey] = DATA_VERSION;
  await area.set(patch);
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

async function databaseExists(name: string) {
  if (!indexedDB.databases) return true;
  const databases = await indexedDB.databases();
  return databases.some((database) => database.name === name);
}

async function repairIndexedDbStore(databaseName: string, version: number, storeName: string) {
  if (typeof indexedDB === 'undefined' || !(await databaseExists(databaseName))) return;

  const request = indexedDB.open(databaseName, version);
  const db = await requestToPromise(request);
  if (!db.objectStoreNames.contains(storeName)) {
    db.close();
    return;
  }

  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  const records = await requestToPromise(store.getAll());
  for (const record of records as unknown[]) {
    const repaired = sanitizeFamilyTextDeep(record);
    if (hasMojibakeText(record) || JSON.stringify(repaired) !== JSON.stringify(record)) {
      store.put(repaired);
    }
  }
  await transactionDone(tx);
  db.close();
}

export async function migrateDragonHouseAsyncData() {
  if (typeof chrome !== 'undefined') {
    await Promise.all([
      repairChromeStorageArea(chrome.storage?.local, `${DATA_VERSION_KEY}:chromeLocal`),
      repairChromeStorageArea(chrome.storage?.session, `${DATA_VERSION_KEY}:chromeSession`)
    ]);
  }

  if (typeof indexedDB !== 'undefined') {
    await Promise.all([
      repairIndexedDbStore('dragon_house_family_notifications_db', 1, 'notifications'),
      repairIndexedDbStore('quant-rp-helper-db', 5, 'buyerPages'),
      repairIndexedDbStore('quant-rp-helper-db', 5, 'buyerRows'),
      repairIndexedDbStore('quant-rp-helper-db', 5, 'eventSchedules'),
      repairIndexedDbStore('quant-rp-helper-db', 5, 'mapUserPoints'),
      repairIndexedDbStore('quant-rp-helper-db', 5, 'mapZones')
    ]);
  }
}
