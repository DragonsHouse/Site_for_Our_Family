import { z } from 'zod';
import { createFamilyMemberIdMigrationDraft } from './family-member-id-migration';
import type {
  FamilyAccountingMonth,
  FamilyNotification,
  FamilyPost,
  FamilyQuest,
  FamilyQuestReport,
  FamilyQuestTemplate,
  FamilyUser
} from './family-types';

export const DRAGON_HOUSE_BACKUP_SCHEMA_VERSION = 1;
export const DRAGON_HOUSE_BACKUP_FORMAT = 'dragon-house-family-hub-backup';

const MAX_BACKUP_FILE_SIZE_BYTES = 80 * 1024 * 1024;
const MAX_ASSET_BYTES = 15 * 1024 * 1024;
const BACKUP_AUDIT_KEY = 'dragon_house_family_backup_audit_v1';

export const FAMILY_HUB_LOCAL_STORAGE_KEYS = [
  'dragon_house_family_users_v1',
  'dragon_house_family_users_schema_version',
  'dragon_house_family_posts_v1',
  'dragon_house_family_economy_v1',
  'dragon_house_family_quest_templates_v1',
  'dragon_house_family_quests_v1',
  'dragon_house_family_quest_reports_v1',
  'dragon_house_family_accounting_v1',
  'dragon_house_family_premium_rules_v1',
  'dragon_house_family_notified_news_v1',
  'dragon_house_family_assets_v1',
  'dragon_house_family_content_blocks_v1',
  'dragon_house_discord_family_settings_v1',
  'quant_dashboard_buyers_layout_v1',
  'quant_dashboard_buyer_table_settings_v1',
  'quant_dashboard_expanded_events',
  'quant_dashboard_background_service_expanded',
  'quant_dashboard_favorite_buyer_keys',
  'quant_dashboard_buyer_calc_quantities',
  'quant_dashboard_event_order_keys',
  'quant_map_allow_default_marker_editing',
  'quant_map_allow_default_marker_add_button',
  'quant_map_allow_default_marker_edit_button',
  'quant_map_allow_default_marker_delete_button',
  'quant_map_custom_icons_v1',
  'quant_map_allow_point_add',
  'quant_map_allow_zone_add',
  'quant_map_allow_zone_edit',
  'quant_map_filter_state_v1'
] as const;

const SECRET_KEY_PATTERN = /(^|_|\b)(password|passwordhash|token|accesstoken|refreshtoken|bottoken|clientsecret|authorization|secret)(_|$|\b)/i;
const PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const backupSchema = z.object({
  format: z.literal(DRAGON_HOUSE_BACKUP_FORMAT),
  schemaVersion: z.number().int().positive(),
  applicationVersion: z.string().nullable().optional(),
  exportedAt: z.string(),
  exportedBy: z.object({
    familyMemberId: z.string().min(1),
    nickname: z.string().min(1)
  }),
  data: z.record(z.unknown()),
  indexedDb: z
    .object({
      assets: z
        .array(
          z.object({
            assetId: z.string().min(1),
            name: z.string().nullable().optional(),
            mimeType: z.string().min(1),
            size: z.number().int().nonnegative(),
            dataBase64: z.string()
          })
        )
        .optional(),
      notifications: z.array(z.record(z.unknown())).optional(),
      quantRpHelperStores: z.record(z.array(z.unknown())).optional()
    })
    .optional(),
  storage: z
    .object({
      localStorage: z.record(z.string()),
      chromeSync: z.record(z.unknown()).optional()
    })
    .optional(),
  integrity: z.object({
    algorithm: z.literal('SHA-256'),
    checksum: z.string().min(32)
  })
});

export type BackupAuditEntry = {
  id: string;
  action: 'export' | 'import_preview' | 'import_success' | 'import_failed' | 'rollback';
  performedByFamilyMemberId: string;
  performedAt: string;
  filename?: string | null;
  schemaVersion?: number | null;
  result: 'success' | 'failed';
  summary?: string | null;
};

export type DragonHouseBackup = z.infer<typeof backupSchema>;

export type BackupPreview = {
  backup: DragonHouseBackup;
  filename: string;
  fileSize: number;
  checksumValid: boolean;
  compatibilityStatus: 'compatible' | 'unsupported';
  warnings: string[];
  errors: string[];
  counts: {
    members: number;
    quests: number;
    accountingEntries: number;
    notifications: number;
    assets: number;
    unresolvedReferences: number;
    conflicts: number;
  };
};

function parseJsonValue<T = unknown>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)])
  );
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function checksumForBackupPayload(backup: Omit<DragonHouseBackup, 'integrity'> | DragonHouseBackup) {
  const { integrity: _integrity, ...payload } = backup as DragonHouseBackup;
  return sha256Hex(JSON.stringify(canonicalize(payload)));
}

function withoutSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutSecrets);
  if (!value || typeof value !== 'object') return value;
  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY_PATTERN.test(key)) continue;
    next[key] = withoutSecrets(item);
  }
  return next;
}

function assertNoUnsafeKeys(value: unknown, path = 'backup') {
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (PROTOTYPE_KEYS.has(key)) {
      throw new Error(`Prototype pollution key is not allowed at ${path}.${key}`);
    }
    assertNoUnsafeKeys(item, `${path}.${key}`);
  }
}

function collectSecretPaths(value: unknown, path = 'backup', paths: string[] = []) {
  if (!value || typeof value !== 'object') return paths;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const nextPath = `${path}.${key}`;
    if (SECRET_KEY_PATTERN.test(key)) paths.push(nextPath);
    collectSecretPaths(item, nextPath, paths);
  }
  return paths;
}

function collectSecretPathsInsideStorageStrings(localStorageData: Record<string, string> | undefined) {
  const paths: string[] = [];
  for (const [key, value] of Object.entries(localStorageData ?? {})) {
    try {
      collectSecretPaths(JSON.parse(value) as unknown, `backup.storage.localStorage.${key}`, paths);
    } catch {
      // Plain string setting, not a JSON domain record.
    }
  }
  return paths;
}

function sanitizeBackupStorage(backup: DragonHouseBackup): DragonHouseBackup {
  return {
    ...backup,
    storage: backup.storage
      ? {
          ...backup.storage,
          localStorage: Object.fromEntries(
            Object.entries(backup.storage.localStorage).map(([key, value]) => [key, sanitizeStorageString(value)])
          )
        }
      : backup.storage
  };
}

function readKnownLocalStorage() {
  const entries: Record<string, string> = {};
  for (const key of FAMILY_HUB_LOCAL_STORAGE_KEYS) {
    const value = window.localStorage.getItem(key);
    if (value != null) entries[key] = sanitizeStorageString(value);
  }
  return entries;
}

function sanitizeStorageString(value: string) {
  try {
    return JSON.stringify(withoutSecrets(JSON.parse(value) as unknown));
  } catch {
    return value;
  }
}

async function readChromeSyncSettings() {
  if (typeof chrome === 'undefined' || !chrome.storage?.sync) return {};
  const result = await chrome.storage.sync.get('quant_rp_helper_settings');
  return withoutSecrets(result) as Record<string, unknown>;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

async function openDb(name: string, version?: number, upgrade?: (db: IDBDatabase) => void) {
  const request = version ? indexedDB.open(name, version) : indexedDB.open(name);
  if (upgrade) request.onupgradeneeded = () => upgrade(request.result);
  return requestToPromise(request);
}

async function blobToBase64(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  let binary = '';
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBlob(dataBase64: string, mimeType: string) {
  const binary = atob(dataBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}

async function exportAssetBlobs() {
  const assets: NonNullable<NonNullable<DragonHouseBackup['indexedDb']>['assets']> = [];
  const metadata = parseJsonValue<Record<string, { blobKey?: string; name?: string; type?: string }>>(
    window.localStorage.getItem('dragon_house_family_assets_v1'),
    {}
  );
  if (!Object.keys(metadata).length) return assets;
  const db = await openDb('dragon_house_family_assets_db', 1, (database) => {
    if (!database.objectStoreNames.contains('asset_blobs')) database.createObjectStore('asset_blobs');
  });
  const tx = db.transaction('asset_blobs', 'readonly');
  const store = tx.objectStore('asset_blobs');
  for (const asset of Object.values(metadata)) {
    if (!asset.blobKey) continue;
    const blob = (await requestToPromise(store.get(asset.blobKey))) as Blob | undefined;
    if (!blob) continue;
    if (blob.size > MAX_ASSET_BYTES) continue;
    assets.push({
      assetId: asset.blobKey,
      name: asset.name ?? null,
      mimeType: blob.type || asset.type || 'application/octet-stream',
      size: blob.size,
      dataBase64: await blobToBase64(blob)
    });
  }
  await txDone(tx);
  db.close();
  return assets;
}

async function exportNotifications() {
  try {
    const db = await openDb('dragon_house_family_notifications_db', 1, (database) => {
      if (!database.objectStoreNames.contains('notifications')) database.createObjectStore('notifications', { keyPath: 'id' });
    });
    const tx = db.transaction('notifications', 'readonly');
    const notifications = (await requestToPromise(tx.objectStore('notifications').getAll())) as Record<string, unknown>[];
    await txDone(tx);
    db.close();
    return withoutSecrets(notifications) as Record<string, unknown>[];
  } catch {
    return [];
  }
}

async function exportQuantRpHelperStores() {
  const stores: Record<string, unknown[]> = {};
  try {
    const db = await openDb('quant-rp-helper-db');
    for (const storeName of Array.from(db.objectStoreNames)) {
      const tx = db.transaction(storeName, 'readonly');
      stores[storeName] = withoutSecrets(await requestToPromise(tx.objectStore(storeName).getAll())) as unknown[];
      await txDone(tx);
    }
    db.close();
  } catch {
    return stores;
  }
  return stores;
}

export async function createDragonHouseBackup(exportedBy: { familyMemberId: string; nickname: string }) {
  const localStorageData = readKnownLocalStorage();
  const members = parseJsonValue<FamilyUser[]>(localStorageData.dragon_house_family_users_v1 ?? null, []);
  const quests = parseJsonValue<FamilyQuest[]>(localStorageData.dragon_house_family_quests_v1 ?? null, []);
  const questReports = parseJsonValue<FamilyQuestReport[]>(localStorageData.dragon_house_family_quest_reports_v1 ?? null, []);
  const accounting = parseJsonValue<FamilyAccountingMonth[]>(localStorageData.dragon_house_family_accounting_v1 ?? null, []);
  const posts = parseJsonValue<FamilyPost[]>(localStorageData.dragon_house_family_posts_v1 ?? null, []);
  const questTemplates = parseJsonValue<FamilyQuestTemplate[]>(localStorageData.dragon_house_family_quest_templates_v1 ?? null, []);
  const notifications = await exportNotifications();
  const assets = await exportAssetBlobs();
  const backupWithoutIntegrity = withoutSecrets({
    format: DRAGON_HOUSE_BACKUP_FORMAT,
    schemaVersion: DRAGON_HOUSE_BACKUP_SCHEMA_VERSION,
    applicationVersion: null,
    exportedAt: new Date().toISOString(),
    exportedBy,
    data: {
      members,
      authMetadata: members.map((member) => ({
        familyMemberId: member.id,
        login: member.nickname,
        staticId: member.staticId,
        mustChangePassword: member.mustChangePassword,
        isActive: member.accountStatus === 'active'
      })),
      ranks: members.map((member) => ({ familyMemberId: member.id, rankLevel: member.rankLevel, rank: member.rank })),
      permissions: members.map((member) => ({ familyMemberId: member.id, role: member.role, permissions: member.permissions })),
      quests,
      questParticipants: quests.flatMap((quest) => [...quest.participants, ...(quest.helpers ?? [])]),
      questActions: quests.flatMap((quest) => quest.auditTrail ?? []),
      questTemplates,
      accounting,
      familyCapital: accounting.map((month) => ({ id: month.id, totalFund: month.totalFund })),
      monthlyEarnings: accounting.flatMap((month) => month.bonuses),
      payouts: [...quests.flatMap((quest) => quest.payouts), ...questReports.flatMap((report) => report.payouts)],
      notifications,
      news: posts,
      events: null,
      buyers: null,
      map: null,
      familyRules: parseJsonValue(localStorageData.dragon_house_family_content_blocks_v1 ?? null, []),
      discordConfig: parseJsonValue(localStorageData.dragon_house_discord_family_settings_v1 ?? null, null),
      discordAccountLinksMetadata: members.map((member) => ({
        familyMemberId: member.id,
        discordUserId: member.discordUserId,
        discordUsername: member.discordUsername,
        discordLinkStatus: member.discordLinkStatus
      })),
      assetsMetadata: parseJsonValue(localStorageData.dragon_house_family_assets_v1 ?? null, {}),
      applicationSettings: {
        localSchemaVersion: localStorageData.dragon_house_family_users_schema_version ?? null
      }
    },
    indexedDb: {
      assets,
      notifications,
      quantRpHelperStores: await exportQuantRpHelperStores()
    },
    storage: {
      localStorage: localStorageData,
      chromeSync: await readChromeSyncSettings()
    }
  }) as Omit<DragonHouseBackup, 'integrity'>;
  const checksum = await checksumForBackupPayload(backupWithoutIntegrity);
  return {
    ...backupWithoutIntegrity,
    integrity: { algorithm: 'SHA-256' as const, checksum }
  };
}

export function backupFilename(date = new Date()) {
  const stamp = date.toISOString().slice(0, 16).replace('T', '-').replace(':', '-');
  return `dragon-house-family-hub-backup-${stamp}.json`;
}

export async function downloadDragonHouseBackup(backup: DragonHouseBackup, filename = backupFilename()) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.replace(/[^\w.-]+/g, '-');
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return { filename, size: blob.size };
}

function countAccountingEntries(accounting: FamilyAccountingMonth[]) {
  return accounting.reduce(
    (count, month) => count + month.bonuses.length + (month.auditTrail?.length ?? 0) + (month.ledger?.length ?? 0),
    0
  );
}

export async function parseDragonHouseBackupFile(file: File): Promise<BackupPreview> {
  if (!file.name.toLowerCase().endsWith('.json')) throw new Error('Підтримуються тільки JSON-файли резервних копій');
  if (file.size > MAX_BACKUP_FILE_SIZE_BYTES) throw new Error('Файл резервної копії занадто великий');
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error('Не вдалося прочитати JSON резервної копії');
  }
  assertNoUnsafeKeys(parsed);
  const backup = backupSchema.parse(parsed);
  const expectedChecksum = await checksumForBackupPayload(backup);
  const checksumValid = expectedChecksum === backup.integrity.checksum;
  if (!checksumValid) throw new Error('Файл резервної копії пошкоджено або змінено');
  const secretPaths = [...collectSecretPaths(backup), ...collectSecretPathsInsideStorageStrings(backup.storage?.localStorage)];
  const members = (backup.data.members ?? []) as FamilyUser[];
  const quests = (backup.data.quests ?? []) as FamilyQuest[];
  const accounting = (backup.data.accounting ?? []) as FamilyAccountingMonth[];
  const notifications = (backup.indexedDb?.notifications ?? backup.data.notifications ?? []) as FamilyNotification[];
  const memberIds = new Set<string>();
  const staticIds = new Set<string>();
  const errors: string[] = [];
  let conflicts = 0;
  for (const member of members) {
    if (!member.id) errors.push(`Member without stable id: ${member.nickname ?? 'unknown'}`);
    if (memberIds.has(member.id)) conflicts += 1;
    if (staticIds.has(member.staticId)) conflicts += 1;
    memberIds.add(member.id);
    staticIds.add(member.staticId);
  }
  if (conflicts > 0) errors.push('Є duplicate member IDs або duplicate static IDs');
  const migrationDraft = createFamilyMemberIdMigrationDraft({
    users: members,
    quests,
    questReports: (backup.data.questReports ?? []) as FamilyQuestReport[],
    accountingMonths: accounting,
    notifications
  });
  const warnings = secretPaths.length ? [`Backup містить secret-like поля, вони не будуть імпортовані: ${secretPaths.length}`] : [];
  if (backup.schemaVersion > DRAGON_HOUSE_BACKUP_SCHEMA_VERSION) errors.push('Unsupported future backup schema');
  if (backup.schemaVersion < DRAGON_HOUSE_BACKUP_SCHEMA_VERSION) warnings.push('Старіша schema version: буде потрібна dry-run перевірка references');
  if (!migrationDraft.report.canApply) {
    errors.push('Є unresolved або ambiguous member references');
  }
  return {
    backup: sanitizeBackupStorage(withoutSecrets(backup) as DragonHouseBackup),
    filename: file.name,
    fileSize: file.size,
    checksumValid,
    compatibilityStatus: backup.schemaVersion <= DRAGON_HOUSE_BACKUP_SCHEMA_VERSION ? 'compatible' : 'unsupported',
    warnings,
    errors,
    counts: {
      members: members.length,
      quests: quests.length,
      accountingEntries: countAccountingEntries(accounting),
      notifications: notifications.length,
      assets: backup.indexedDb?.assets?.length ?? 0,
      unresolvedReferences: migrationDraft.report.unresolvedReferences.length,
      conflicts
    }
  };
}

async function restoreAssets(assets: NonNullable<DragonHouseBackup['indexedDb']>['assets'] = []) {
  const db = await openDb('dragon_house_family_assets_db', 1, (database) => {
    if (!database.objectStoreNames.contains('asset_blobs')) database.createObjectStore('asset_blobs');
  });
  const tx = db.transaction('asset_blobs', 'readwrite');
  const store = tx.objectStore('asset_blobs');
  await requestToPromise(store.clear());
  for (const asset of assets) {
    if (asset.size > MAX_ASSET_BYTES) throw new Error(`Asset too large: ${asset.assetId}`);
    store.put(base64ToBlob(asset.dataBase64, asset.mimeType), asset.assetId);
  }
  await txDone(tx);
  db.close();
}

async function restoreNotifications(notifications: Record<string, unknown>[] = []) {
  const db = await openDb('dragon_house_family_notifications_db', 1, (database) => {
    if (!database.objectStoreNames.contains('notifications')) database.createObjectStore('notifications', { keyPath: 'id' });
  });
  const tx = db.transaction('notifications', 'readwrite');
  const store = tx.objectStore('notifications');
  await requestToPromise(store.clear());
  for (const notification of notifications) store.put(notification);
  await txDone(tx);
  db.close();
}

async function restoreLocalStorage(localStorageData: Record<string, string>) {
  for (const key of FAMILY_HUB_LOCAL_STORAGE_KEYS) window.localStorage.removeItem(key);
  for (const [key, value] of Object.entries(localStorageData)) {
    if (FAMILY_HUB_LOCAL_STORAGE_KEYS.includes(key as (typeof FAMILY_HUB_LOCAL_STORAGE_KEYS)[number])) {
      window.localStorage.setItem(key, value);
    }
  }
}

export async function applyReplaceBackup(preview: BackupPreview, currentUser: { id: string; nickname: string }) {
  if (preview.errors.length) throw new Error(preview.errors[0]);
  const emergencyBackup = await createDragonHouseBackup({ familyMemberId: currentUser.id, nickname: currentUser.nickname });
  try {
    await restoreLocalStorage(preview.backup.storage?.localStorage ?? {});
    await restoreAssets(preview.backup.indexedDb?.assets ?? []);
    await restoreNotifications((preview.backup.indexedDb?.notifications ?? []) as Record<string, unknown>[]);
    await writeBackupAudit({
      action: 'import_success',
      performedByFamilyMemberId: currentUser.id,
      filename: preview.filename,
      schemaVersion: preview.backup.schemaVersion,
      result: 'success',
      summary: `Imported ${preview.counts.members} members, ${preview.counts.quests} quests`
    });
  } catch (error) {
    await restoreLocalStorage(emergencyBackup.storage?.localStorage ?? {});
    await restoreAssets(emergencyBackup.indexedDb?.assets ?? []);
    await restoreNotifications((emergencyBackup.indexedDb?.notifications ?? []) as Record<string, unknown>[]);
    await writeBackupAudit({
      action: 'rollback',
      performedByFamilyMemberId: currentUser.id,
      filename: preview.filename,
      schemaVersion: preview.backup.schemaVersion,
      result: 'failed',
      summary: error instanceof Error ? error.message : 'Import failed and rollback was executed'
    });
    throw error;
  }
}

export function readBackupAudit(): BackupAuditEntry[] {
  return parseJsonValue<BackupAuditEntry[]>(window.localStorage.getItem(BACKUP_AUDIT_KEY), []);
}

export async function writeBackupAudit(input: Omit<BackupAuditEntry, 'id' | 'performedAt'>) {
  const entry: BackupAuditEntry = {
    ...input,
    id: `backup-audit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    performedAt: new Date().toISOString()
  };
  window.localStorage.setItem(BACKUP_AUDIT_KEY, JSON.stringify([entry, ...readBackupAudit()].slice(0, 50)));
  return entry;
}
