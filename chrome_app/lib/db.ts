import type {
  BuyerPageLatestData,
  BuyerPageRecord,
  BuyerRowRecord,
  BuyerSnapshotRecord,
  BuyerWatchRule,
  EventScheduleRecord,
  EventWatchRule,
  MapUserPoint,
  MapZone,
  PollState,
  TransportCheckpoint
} from './types';

const DB_NAME = 'quant-rp-helper-db';
const DB_VERSION = 5;

const DEFAULT_POLL_STATE: PollState = {
  lastRunAt: null,
  lastSuccessAt: null,
  lastError: null,
  running: false,
  pagesDiscovered: 0,
  pagesProcessed: 0,
  rowsStored: 0,
  buyerTotalPages: 0,
  buyerBatchSize: 0,
  buyerCursor: 0,
  cyclesCompleted: 0,
  consecutiveFailures: 0,
  nextEligibleRunAt: null,
  lastTrigger: 'unknown'
};

type KvRecord = {
  key: string;
  value: unknown;
};

async function getKvRecord(key: string): Promise<KvRecord | undefined> {
  const db = await openDb();
  const tx = db.transaction('kv', 'readonly');
  const kv = tx.objectStore('kv');
  const record = (await requestToPromise(kv.get(key))) as KvRecord | undefined;
  await transactionDone(tx);
  db.close();
  return record;
}

async function putKvRecord(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('kv', 'readwrite');
  tx.objectStore('kv').put({ key, value } satisfies KvRecord);
  await transactionDone(tx);
  db.close();
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

async function openDb(): Promise<IDBDatabase> {
  const request = indexedDB.open(DB_NAME, DB_VERSION);

  request.onupgradeneeded = () => {
    const db = request.result;

    if (!db.objectStoreNames.contains('buyerPages')) {
      const pages = db.createObjectStore('buyerPages', { keyPath: 'url' });
      pages.createIndex('updatedAt', 'updatedAt', { unique: false });
      pages.createIndex('sortOrder', 'sortOrder', { unique: false });
    }

    if (!db.objectStoreNames.contains('buyerSnapshots')) {
      const snapshots = db.createObjectStore('buyerSnapshots', {
        keyPath: 'id',
        autoIncrement: true
      });
      snapshots.createIndex('pageUrl', 'pageUrl', { unique: false });
      snapshots.createIndex('fetchedAt', 'fetchedAt', { unique: false });
      snapshots.createIndex('pageUrl_fetchedAt', ['pageUrl', 'fetchedAt'], { unique: false });
    }

    if (!db.objectStoreNames.contains('buyerRows')) {
      const rows = db.createObjectStore('buyerRows', { keyPath: 'id', autoIncrement: true });
      rows.createIndex('snapshotId', 'snapshotId', { unique: false });
      rows.createIndex('pageUrl', 'pageUrl', { unique: false });
      rows.createIndex('productName', 'productName', { unique: false });
      rows.createIndex('percentValue', 'percentValue', { unique: false });
    }

    if (!db.objectStoreNames.contains('kv')) {
      db.createObjectStore('kv', { keyPath: 'key' });
    }

    if (!db.objectStoreNames.contains('buyerWatchRules')) {
      const rules = db.createObjectStore('buyerWatchRules', { keyPath: 'ruleKey' });
      rules.createIndex('pageUrl', 'pageUrl', { unique: false });
      rules.createIndex('enabled', 'enabled', { unique: false });
      rules.createIndex('updatedAt', 'updatedAt', { unique: false });
    }

    if (!db.objectStoreNames.contains('eventSchedules')) {
      const events = db.createObjectStore('eventSchedules', { keyPath: 'eventKey' });
      events.createIndex('eventName', 'eventName', { unique: false });
      events.createIndex('fetchedAt', 'fetchedAt', { unique: false });
    }

    if (!db.objectStoreNames.contains('eventWatchRules')) {
      const eventRules = db.createObjectStore('eventWatchRules', { keyPath: 'eventKey' });
      eventRules.createIndex('enabled', 'enabled', { unique: false });
      eventRules.createIndex('updatedAt', 'updatedAt', { unique: false });
    }

    if (!db.objectStoreNames.contains('mapUserPoints')) {
      const points = db.createObjectStore('mapUserPoints', { keyPath: 'id', autoIncrement: true });
      points.createIndex('updatedAt', 'updatedAt', { unique: false });
      points.createIndex('createdAt', 'createdAt', { unique: false });
    }

    if (!db.objectStoreNames.contains('mapZones')) {
      db.createObjectStore('mapZones', { keyPath: 'id' });
    }
  };

  return requestToPromise(request);
}

export async function upsertBuyerPages(pages: BuyerPageRecord[]): Promise<void> {
  if (!pages.length) return;
  const db = await openDb();
  const tx = db.transaction('buyerPages', 'readwrite');
  const store = tx.objectStore('buyerPages');

  for (const page of pages) {
    store.put(page);
  }

  await transactionDone(tx);
  db.close();
}

export async function getBuyerPages(): Promise<BuyerPageRecord[]> {
  const db = await openDb();
  const tx = db.transaction('buyerPages', 'readonly');
  const store = tx.objectStore('buyerPages');
  const pages = (await requestToPromise(store.getAll())) as BuyerPageRecord[];
  await transactionDone(tx);
  db.close();

  return pages.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, 'uk'));
}

export async function getEnabledBuyerPages(): Promise<BuyerPageRecord[]> {
  const pages = await getBuyerPages();
  return pages.filter((page) => page.enabled);
}

export async function saveBuyerSnapshot(
  snapshot: BuyerSnapshotRecord,
  rows: Omit<BuyerRowRecord, 'snapshotId' | 'id'>[]
): Promise<number> {
  const db = await openDb();
  const tx = db.transaction(['buyerSnapshots', 'buyerRows'], 'readwrite');
  const snapshotsStore = tx.objectStore('buyerSnapshots');
  const rowsStore = tx.objectStore('buyerRows');

  const snapshotId = (await requestToPromise(snapshotsStore.add(snapshot))) as unknown as number;

  for (const row of rows) {
    rowsStore.add({
      ...row,
      snapshotId
    });
  }

  await transactionDone(tx);
  db.close();
  return snapshotId;
}

export async function setPollState(patch: Partial<PollState>): Promise<PollState> {
  const existing = await getKvRecord('pollState');
  const nextState: PollState = {
    ...DEFAULT_POLL_STATE,
    ...((existing?.value as PollState | undefined) ?? {}),
    ...patch
  };
  await putKvRecord('pollState', nextState);
  return nextState;
}

export async function getPollState(): Promise<PollState> {
  const record = await getKvRecord('pollState');
  return {
    ...DEFAULT_POLL_STATE,
    ...((record?.value as PollState | undefined) ?? {})
  };
}

export async function getDbStats(): Promise<{
  pages: number;
  snapshots: number;
  rows: number;
}> {
  const db = await openDb();
  const tx = db.transaction(['buyerPages', 'buyerSnapshots', 'buyerRows'], 'readonly');
  const pagesStore = tx.objectStore('buyerPages');
  const snapshotsStore = tx.objectStore('buyerSnapshots');
  const rowsStore = tx.objectStore('buyerRows');

  const [pages, snapshots, rows] = await Promise.all([
    requestToPromise(pagesStore.count()),
    requestToPromise(snapshotsStore.count()),
    requestToPromise(rowsStore.count())
  ]);

  await transactionDone(tx);
  db.close();
  return { pages, snapshots, rows };
}

export function makeBuyerRuleKey(pageUrl: string, productName: string): string {
  return `${pageUrl}::${productName}`.toLowerCase();
}

export async function saveBuyerWatchRule(
  rule: Omit<BuyerWatchRule, 'ruleKey' | 'createdAt' | 'updatedAt'> &
    Partial<Pick<BuyerWatchRule, 'createdAt'>>
): Promise<BuyerWatchRule> {
  const now = new Date().toISOString();
  const normalized: BuyerWatchRule = {
    ruleKey: makeBuyerRuleKey(rule.pageUrl, rule.productName),
    createdAt: rule.createdAt ?? now,
    updatedAt: now,
    ...rule
  };

  const db = await openDb();
  const tx = db.transaction('buyerWatchRules', 'readwrite');
  tx.objectStore('buyerWatchRules').put(normalized);
  await transactionDone(tx);
  db.close();
  return normalized;
}

export async function getBuyerWatchRules(): Promise<BuyerWatchRule[]> {
  const db = await openDb();
  const tx = db.transaction('buyerWatchRules', 'readonly');
  const rules = (await requestToPromise(
    tx.objectStore('buyerWatchRules').getAll()
  )) as BuyerWatchRule[];
  await transactionDone(tx);
  db.close();
  return rules.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getEnabledBuyerWatchRules(): Promise<BuyerWatchRule[]> {
  const rules = await getBuyerWatchRules();
  return rules.filter((rule) => rule.enabled);
}

export async function getBuyerWatchRule(
  pageUrl: string,
  productName: string
): Promise<BuyerWatchRule | null> {
  const db = await openDb();
  const tx = db.transaction('buyerWatchRules', 'readonly');
  const rule = (await requestToPromise(
    tx.objectStore('buyerWatchRules').get(makeBuyerRuleKey(pageUrl, productName))
  )) as BuyerWatchRule | undefined;
  await transactionDone(tx);
  db.close();
  return rule ?? null;
}

async function getLatestSnapshotForPageUrl(pageUrl: string): Promise<BuyerSnapshotRecord | null> {
  const db = await openDb();
  const tx = db.transaction('buyerSnapshots', 'readonly');
  const index = tx.objectStore('buyerSnapshots').index('pageUrl');
  const snapshots = (await requestToPromise(index.getAll(IDBKeyRange.only(pageUrl)))) as BuyerSnapshotRecord[];
  await transactionDone(tx);
  db.close();

  if (!snapshots.length) return null;
  snapshots.sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt));
  return snapshots[0] ?? null;
}

export async function getRowsForSnapshot(snapshotId: number): Promise<BuyerRowRecord[]> {
  const db = await openDb();
  const tx = db.transaction('buyerRows', 'readonly');
  const index = tx.objectStore('buyerRows').index('snapshotId');
  const rows = (await requestToPromise(
    index.getAll(IDBKeyRange.only(snapshotId))
  )) as BuyerRowRecord[];
  await transactionDone(tx);
  db.close();
  return rows.sort((a, b) => a.rowIndex - b.rowIndex);
}

export async function getBuyerPagesLatestData(): Promise<BuyerPageLatestData[]> {
  const pages = await getBuyerPages();
  const result: BuyerPageLatestData[] = [];

  for (const page of pages) {
    const snapshot = await getLatestSnapshotForPageUrl(page.url);
    const rows =
      snapshot?.id != null ? await getRowsForSnapshot(snapshot.id) : [];
    result.push({ page, snapshot, rows });
  }

  return result;
}

export async function saveEventSchedules(records: EventScheduleRecord[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('eventSchedules', 'readwrite');
  const store = tx.objectStore('eventSchedules');

  store.clear();
  for (const record of records) {
    store.put(record);
  }

  await transactionDone(tx);
  db.close();
}

export async function getEventSchedules(): Promise<EventScheduleRecord[]> {
  const db = await openDb();
  const tx = db.transaction('eventSchedules', 'readonly');
  const records = (await requestToPromise(
    tx.objectStore('eventSchedules').getAll()
  )) as EventScheduleRecord[];
  await transactionDone(tx);
  db.close();
  return records.sort((a, b) => a.eventName.localeCompare(b.eventName, 'uk'));
}

export async function saveEventWatchRule(
  rule: Omit<EventWatchRule, 'createdAt' | 'updatedAt'> & Partial<Pick<EventWatchRule, 'createdAt'>>
): Promise<EventWatchRule> {
  const now = new Date().toISOString();
  const normalized: EventWatchRule = {
    ...rule,
    createdAt: rule.createdAt ?? now,
    updatedAt: now
  };

  const db = await openDb();
  const tx = db.transaction('eventWatchRules', 'readwrite');
  tx.objectStore('eventWatchRules').put(normalized);
  await transactionDone(tx);
  db.close();
  return normalized;
}

export async function getEventWatchRules(): Promise<EventWatchRule[]> {
  const db = await openDb();
  const tx = db.transaction('eventWatchRules', 'readonly');
  const rules = (await requestToPromise(
    tx.objectStore('eventWatchRules').getAll()
  )) as EventWatchRule[];
  await transactionDone(tx);
  db.close();
  return rules.sort((a, b) => a.eventName.localeCompare(b.eventName, 'uk'));
}

export async function getEnabledEventWatchRules(): Promise<EventWatchRule[]> {
  const rules = await getEventWatchRules();
  return rules.filter((rule) => rule.enabled);
}

type EventAlertMarkMap = Record<string, string>;
type AlarmRunMarkMap = Record<string, string>;

export async function hasEventAlertMark(key: string): Promise<boolean> {
  const record = await getKvRecord('eventAlertMarks');
  const marks = ((record?.value as EventAlertMarkMap | undefined) ?? {});
  return Boolean(marks[key]);
}

export async function setEventAlertMark(key: string, value: string): Promise<void> {
  const record = await getKvRecord('eventAlertMarks');
  const marks = ((record?.value as EventAlertMarkMap | undefined) ?? {});
  const next: EventAlertMarkMap = { ...marks, [key]: value };

  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const [k, ts] of Object.entries(next)) {
    const ms = Date.parse(ts);
    if (Number.isFinite(ms) && ms < cutoff) {
      delete next[k];
    }
  }

  await putKvRecord('eventAlertMarks', next);
}

export async function getAlarmRunMarks(): Promise<AlarmRunMarkMap> {
  const record = await getKvRecord('alarmRunMarks');
  return ((record?.value as AlarmRunMarkMap | undefined) ?? {});
}

export async function setAlarmRunMark(alarmName: string, value: string): Promise<void> {
  const record = await getKvRecord('alarmRunMarks');
  const marks = ((record?.value as AlarmRunMarkMap | undefined) ?? {});
  const next: AlarmRunMarkMap = { ...marks, [alarmName]: value };

  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  for (const [name, ts] of Object.entries(next)) {
    const ms = Date.parse(ts);
    if (!Number.isFinite(ms) || ms < cutoff) {
      delete next[name];
    }
  }

  await putKvRecord('alarmRunMarks', next);
}

export async function getTransportCheckpoint(
  transportKey: string
): Promise<TransportCheckpoint | null> {
  const record = await getKvRecord(`transportCheckpoint:${transportKey}`);
  return (record?.value as TransportCheckpoint | undefined) ?? null;
}

export async function setTransportCheckpoint(
  checkpoint: Omit<TransportCheckpoint, 'updatedAt'> & Partial<Pick<TransportCheckpoint, 'updatedAt'>>
): Promise<TransportCheckpoint> {
  const next: TransportCheckpoint = {
    ...checkpoint,
    updatedAt: checkpoint.updatedAt ?? new Date().toISOString()
  };
  await putKvRecord(`transportCheckpoint:${checkpoint.transportKey}`, next);
  return next;
}

export async function getMapUserPoints(): Promise<MapUserPoint[]> {
  const db = await openDb();
  const tx = db.transaction('mapUserPoints', 'readonly');
  const rawPoints = (await requestToPromise(tx.objectStore('mapUserPoints').getAll())) as MapUserPoint[];
  await transactionDone(tx);
  db.close();
  const points = rawPoints.map((point) => {
    const legacyHidden = (point as Omit<MapUserPoint, 'hidden'> & { hidden?: boolean | string }).hidden;
    return {
      ...point,
      iconUrl: point.iconUrl ?? null,
      customIconDataUrl: point.customIconDataUrl ?? null,
      detailImageDataUrl: point.detailImageDataUrl ?? null,
      zoneId: point.zoneId ?? null,
      filterLabel: point.filterLabel ?? null,
      note: point.note ?? null,
      sourceMarkerId: point.sourceMarkerId ?? null,
      hidden:
        typeof legacyHidden === 'string'
          ? legacyHidden.toLowerCase() === 'true'
          : Boolean(legacyHidden)
    };
  });
  return points.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function saveMapUserPoint(
  point: Omit<MapUserPoint, 'id' | 'createdAt' | 'updatedAt'> &
    Partial<Pick<MapUserPoint, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<MapUserPoint> {
  const now = new Date().toISOString();
  const safeId =
    typeof point.id === 'number' && Number.isFinite(point.id) && point.id > 0
      ? point.id
      : undefined;
  const normalized: MapUserPoint = {
    id: safeId,
    x: point.x,
    y: point.y,
    title: point.title,
    icon: point.icon,
    iconUrl: point.iconUrl ?? null,
    customIconDataUrl: point.customIconDataUrl ?? null,
    detailImageDataUrl: point.detailImageDataUrl ?? null,
    zoneId: point.zoneId ?? null,
    filterLabel: point.filterLabel ?? null,
    color: point.color,
    note: point.note ?? null,
    sourceMarkerId: point.sourceMarkerId ?? null,
    hidden: point.hidden ?? false,
    createdAt: point.createdAt ?? now,
    updatedAt: point.updatedAt ?? now
  };

  const db = await openDb();
  const tx = db.transaction('mapUserPoints', 'readwrite');
  const store = tx.objectStore('mapUserPoints');
  let id: number;
  if (typeof safeId === 'number') {
    id = (await requestToPromise(store.put(normalized))) as number;
  } else {
    const payload = { ...normalized };
    delete (payload as { id?: number }).id;
    try {
      id = (await requestToPromise(store.add(payload))) as number;
    } catch {
      // Backward compatibility: some local DBs may have mapUserPoints without autoIncrement.
      const keys = (await requestToPromise(store.getAllKeys())) as IDBValidKey[];
      const numericKeys = keys
        .map((key) => (typeof key === 'number' && Number.isFinite(key) ? key : null))
        .filter((key): key is number => key !== null);
      const nextId = (numericKeys.length ? Math.max(...numericKeys) : 0) + 1;
      id = (await requestToPromise(store.put({ ...payload, id: nextId }))) as number;
    }
  }
  await transactionDone(tx);
  db.close();
  return { ...normalized, id };
}

export async function deleteMapUserPoint(id: number): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('mapUserPoints', 'readwrite');
  tx.objectStore('mapUserPoints').delete(id);
  await transactionDone(tx);
  db.close();
}

function ensureZoneId(zone: Partial<MapZone>): string {
  if (zone.id) return zone.id;
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `zone-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export async function saveMapZone(zone: Partial<MapZone> & { name: string; points: MapZone['points'] }): Promise<MapZone> {
  const now = new Date().toISOString();
  const normalized: MapZone = {
    id: ensureZoneId(zone),
    name: zone.name,
    color: zone.color ?? '#22c55e',
    opacity: zone.opacity ?? 0.2,
    points: zone.points ?? [],
    imageDataUrl: zone.imageDataUrl ?? null,
    imageX: zone.imageX ?? null,
    imageY: zone.imageY ?? null,
    imageWidth: zone.imageWidth ?? null,
    imageHeight: zone.imageHeight ?? null,
    imageRotation: zone.imageRotation ?? 0,
    imageOpacity: zone.imageOpacity ?? 0.35,
    cropTop: zone.cropTop ?? 0,
    cropRight: zone.cropRight ?? 0,
    cropBottom: zone.cropBottom ?? 0,
    cropLeft: zone.cropLeft ?? 0,
    createdAt: zone.createdAt ?? now,
    updatedAt: now
  };

  const db = await openDb();
  const tx = db.transaction('mapZones', 'readwrite');
  tx.objectStore('mapZones').put(normalized);
  await transactionDone(tx);
  db.close();
  return normalized;
}

export async function getMapZones(): Promise<MapZone[]> {
  const db = await openDb();
  const tx = db.transaction('mapZones', 'readonly');
  const zones = (await requestToPromise(tx.objectStore('mapZones').getAll())) as MapZone[];
  await transactionDone(tx);
  db.close();
  return zones.sort((a, b) => a.name.localeCompare(b.name));
}

export async function deleteMapZone(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(['mapZones', 'mapUserPoints'], 'readwrite');
  tx.objectStore('mapZones').delete(id);
  // also detach zone from user points
  const pointsStore = tx.objectStore('mapUserPoints');
  const points = (await requestToPromise(pointsStore.getAll())) as MapUserPoint[];
  points
    .filter((p) => p.zoneId === id)
    .forEach((p) => {
      pointsStore.put({ ...p, zoneId: null, updatedAt: new Date().toISOString() });
    });
  await transactionDone(tx);
  db.close();
}
