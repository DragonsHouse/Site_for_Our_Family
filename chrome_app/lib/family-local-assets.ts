// Local binaries remain supported until explicitly migrated to shared storage.
import { FAMILY_ASSETS_UPDATED_EVENT, getFamilyAssetDefaultUrl, getQuestTemplateAssetSlot } from './family-assets';
import { readJson, writeJson } from './family-local-storage';
import type { FamilyAssetSlot, FamilyCustomAsset, FamilyQuestTemplate } from './family-types';

const FAMILY_ASSETS_KEY = 'dragon_house_family_assets_v1';

const FAMILY_ASSETS_DB_NAME = 'dragon_house_family_assets_db';

const FAMILY_ASSETS_DB_VERSION = 1;

const FAMILY_ASSET_BLOBS_STORE = 'asset_blobs';

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
