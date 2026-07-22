import { readFamilyAccountingMonths, readFamilyQuestReports } from './family-repositories';
import { sanitizeFamilyTextDeep } from './text-sanitizer';
import type {
  FamilyBonus,
  FamilyNotification,
  FamilyNotificationRelatedEntityType,
  FamilyNotificationType,
  FamilyQuestReport
} from './family-types';

const DB_NAME = 'dragon_house_family_notifications_db';
const DB_VERSION = 1;
const STORE_NAME = 'notifications';

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
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      store.createIndex('eventKey', 'eventKey', { unique: true });
      store.createIndex('userId', 'userId', { unique: false });
      store.createIndex('createdAt', 'createdAt', { unique: false });
    }
  };
  return requestToPromise(request);
}

function notificationId(eventKey: string) {
  return `family-notification:${eventKey}`;
}

export async function addFamilyNotificationOnce(input: {
  eventKey: string;
  userId: string;
  staticId?: string;
  type: FamilyNotificationType;
  title: string;
  message: string;
  createdAt?: string;
  relatedEntityType?: FamilyNotificationRelatedEntityType | null;
  relatedEntityId?: string | null;
}) {
  const db = await openDb();
  const readTx = db.transaction(STORE_NAME, 'readonly');
  const existing = (await requestToPromise(
    readTx.objectStore(STORE_NAME).index('eventKey').get(input.eventKey)
  )) as FamilyNotification | undefined;
  await transactionDone(readTx);

  if (existing) {
    db.close();
    return existing;
  }

  const notification: FamilyNotification = sanitizeFamilyTextDeep({
    id: notificationId(input.eventKey),
    eventKey: input.eventKey,
    userId: input.userId,
    staticId: input.staticId ?? '',
    type: input.type,
    title: input.title,
    message: input.message,
    createdAt: input.createdAt ?? new Date().toISOString(),
    readAt: null,
    relatedEntityType: input.relatedEntityType ?? null,
    relatedEntityId: input.relatedEntityId ?? null
  });

  const writeTx = db.transaction(STORE_NAME, 'readwrite');
  writeTx.objectStore(STORE_NAME).put(notification);
  await transactionDone(writeTx);
  db.close();
  return notification;
}

export async function getFamilyNotificationsForUser(userId: string): Promise<FamilyNotification[]> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const records = (await requestToPromise(
    tx.objectStore(STORE_NAME).index('userId').getAll(IDBKeyRange.only(userId))
  )) as FamilyNotification[];
  await transactionDone(tx);
  db.close();
  const sanitized = records.map((record) => sanitizeFamilyTextDeep(record));
  return sanitized.sort((a, b) => {
    if (!a.readAt && b.readAt) return -1;
    if (a.readAt && !b.readAt) return 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export async function markFamilyNotificationRead(id: string) {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const notification = (await requestToPromise(store.get(id))) as FamilyNotification | undefined;
  if (notification && !notification.readAt) {
    store.put({ ...notification, readAt: new Date().toISOString() } satisfies FamilyNotification);
  }
  await transactionDone(tx);
  db.close();
}

function bonusTitle(bonus: FamilyBonus) {
  return bonus.amount != null ? `${bonus.amount.toLocaleString('uk-UA')} $` : (bonus.rewardLabel ?? 'премія');
}

export async function notifyBonusCreated(bonus: FamilyBonus) {
  await addFamilyNotificationOnce({
    eventKey: `bonus-created:${bonus.id}:${bonus.updatedAt}`,
    userId: bonus.userId,
    type: 'bonus_created',
    title: 'Премію нараховано',
    message: `Тобі нараховано премію ${bonusTitle(bonus)}`,
    createdAt: bonus.updatedAt,
    relatedEntityType: 'accounting',
    relatedEntityId: bonus.id
  });
}

export async function notifyBonusPaid(bonus: FamilyBonus) {
  await addFamilyNotificationOnce({
    eventKey: `bonus-paid:${bonus.id}:${bonus.paidAt ?? bonus.updatedAt}`,
    userId: bonus.userId,
    type: 'bonus_paid',
    title: 'Виплату видано',
    message: `Виплату ${bonusTitle(bonus)} видано`,
    createdAt: bonus.paidAt ?? bonus.updatedAt,
    relatedEntityType: 'accounting',
    relatedEntityId: bonus.id
  });
}

export async function notifyBonusStatusChanged(bonus: FamilyBonus) {
  await addFamilyNotificationOnce({
    eventKey: `bonus-status:${bonus.id}:${bonus.status}:${bonus.updatedAt}`,
    userId: bonus.userId,
    type: 'bonus_status_changed',
    title: 'Статус премії змінено',
    message: `Статус твоєї премії: ${bonus.status}`,
    createdAt: bonus.updatedAt,
    relatedEntityType: 'accounting',
    relatedEntityId: bonus.id
  });
}

export async function notifyQuestPayoutUpdated(bonus: FamilyBonus) {
  if (!bonus.questReportId) return;
  await addFamilyNotificationOnce({
    eventKey: `quest-payout:${bonus.questReportId}:${bonus.userId}:${bonus.updatedAt}`,
    userId: bonus.userId,
    type: 'quest_payout_updated',
    title: 'Винагороду за квест оновлено',
    message: `Винагороду за квест оновлено: ${bonusTitle(bonus)}`,
    createdAt: bonus.updatedAt,
    relatedEntityType: 'accounting',
    relatedEntityId: bonus.id
  });
}

export async function notifyQuestReportAccepted(report: FamilyQuestReport) {
  await Promise.all(
    report.participants.map((userId) =>
      addFamilyNotificationOnce({
        eventKey: `quest-report-accepted:${report.id}:${userId}`,
        userId,
        type: 'quest_report_accepted',
        title: 'Звіт квесту прийнято',
        message: `Твій quest report "${report.title}" прийнято`,
        createdAt: report.updatedAt,
        relatedEntityType: 'quest_report',
        relatedEntityId: report.id
      })
    )
  );
}

export async function syncFamilyNotificationsFromLocalState() {
  const months = readFamilyAccountingMonths();
  const reports = readFamilyQuestReports();
  const bonusTasks = months.flatMap((month) =>
    month.bonuses.flatMap((bonus) =>
      bonus.status === 'paid'
        ? [notifyBonusCreated(bonus), notifyBonusPaid(bonus)]
        : [notifyBonusCreated(bonus)]
    )
  );
  const reportTasks = reports
    .filter((report) => report.transferredToAccountingAt)
    .map((report) => notifyQuestReportAccepted(report));
  await Promise.all([...bonusTasks, ...reportTasks]);
}
