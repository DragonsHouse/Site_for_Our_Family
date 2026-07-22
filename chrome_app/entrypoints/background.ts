import { QUANTFUN_EVENTS_URL } from '../lib/constants';
import { DRAGON_HOUSE_ASSETS } from '../lib/family-assets';
import {
  getDbStats,
  getAlarmRunMarks,
  getEnabledBuyerPages,
  getEnabledBuyerWatchRules,
  getEnabledEventWatchRules,
  getEventSchedules,
  getEventWatchRules,
  getPollState,
  getTransportCheckpoint,
  hasEventAlertMark,
  saveEventSchedules,
  setAlarmRunMark,
  setEventAlertMark,
  setPollState,
  setTransportCheckpoint,
  upsertBuyerPages
} from '../lib/db';
import { ingestBuyerPageData } from '../lib/buyer-ingest';
import { BuyerSocketTransport } from '../lib/buyer-socket-transport';
import { getNextSlotOccurrence } from '../lib/events-time';
import { parseQuantBuyerPage } from '../lib/quantfun-buyer-parser';
import { parseQuantEventsPage } from '../lib/quantfun-events-parser';
import { getSettings } from '../lib/storage';
import type {
  BuyerPageRecord,
  BuyerWatchRule,
  EventNotificationStyle,
  EventWatchRule,
  ParseResult,
  PollState
} from '../lib/types';

const POLL_ALARM_NAME = 'quant-buyer-poll';
const EVENT_TICK_ALARM_NAME = 'quant-event-local-tick';
const EVENT_SCHEDULE_SYNC_ALARM_NAME = 'quant-event-schedule-sync';
const EVENTS_SOURCE_URL = QUANTFUN_EVENTS_URL;
const DRAGON_HOUSE_NOTIFICATION_ICON = DRAGON_HOUSE_ASSETS.crest.replace(/^\//, '');
let isPollingNow = false;
let isEventTickRunning = false;
let isEventScheduleSyncRunning = false;
let buyerSocketTransport: BuyerSocketTransport | null = null;

type RuntimeRequest =
  | { type: 'QUANT_PARSE_ACTIVE_TAB' }
  | { type: 'QUANT_RUN_BUYER_POLL_NOW' }
  | { type: 'QUANT_GET_POLL_STATUS' }
  | { type: 'QUANT_GET_BACKGROUND_STATUS' }
  | { type: 'QUANT_REFRESH_POLL_SCHEDULE' }
  | { type: 'QUANT_SYNC_EVENTS_SCHEDULE' }
  | { type: 'QUANT_GET_EVENTS_DATA' };
type RuntimeResponse =
  | { ok: true; data: ParseResult }
  | { ok: true; data: { pollState: PollState; dbStats: Awaited<ReturnType<typeof getDbStats>> } }
  | { ok: true; data: { started: true } }
  | {
      ok: true;
      data: {
        pollState: PollState;
        dbStats: Awaited<ReturnType<typeof getDbStats>>;
        alarms: Array<{
          name: string;
          scheduledTime?: number;
          periodInMinutes?: number;
        }>;
        alarmRunMarks: Record<string, string>;
        settings: {
          pollingEnabled: boolean;
          pollIntervalMinutes: number;
        };
        now: string;
      };
    }
  | {
      ok: true;
      data: {
        schedules: Awaited<ReturnType<typeof getEventSchedules>>;
        rules: Awaited<ReturnType<typeof getEnabledEventWatchRules>>;
      };
    }
  | { ok: false; error: string };

function shouldNotify(result: ParseResult, settings: Awaited<ReturnType<typeof getSettings>>) {
  return (
    settings.notificationEnabled &&
    (result.hasKeyword || result.totalNumbersFound >= settings.minNumbersFound)
  );
}

async function notify(result: ParseResult) {
  await chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL(DRAGON_HOUSE_NOTIFICATION_ICON),
    title: 'Dragon House Family Hub',
    message: `Знайдено дані: чисел ${result.totalNumbersFound}, keyword=${result.hasKeyword ? 'так' : 'ні'}`
  });
}

async function notifyBuyerAlert(
  pageTitle: string,
  pageUrl: string,
  productName: string,
  percentValue: number
) {
  const firedAt = new Date().toLocaleString('uk-UA');
  const notificationId = `buyer|${encodeURIComponent(pageUrl)}|${encodeURIComponent(productName)}|${Date.now()}`;
  await chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL(DRAGON_HOUSE_NOTIFICATION_ICON),
    title: `Quant RP: ${pageTitle}`,
    message: `${productName}: ${percentValue.toFixed(2)}%\n${firedAt}`
  });
}

async function notifyBuyerPriceRule(
  rule: BuyerWatchRule,
  currentPrice: number | null,
  percentValue: number | null
) {
  const firedAt = new Date().toLocaleString('uk-UA');
  const notificationId = `buyer|${encodeURIComponent(rule.pageUrl)}|${encodeURIComponent(rule.productName)}|${Date.now()}`;
  await chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL(DRAGON_HOUSE_NOTIFICATION_ICON),
    title: `Сповіщення: ${rule.pageTitle}`,
    message: `${rule.productName}: ціна ${currentPrice ?? '—'}$, % ${percentValue ?? '—'}\n${firedAt}`
  });
}

function parseBuyerNotificationTarget(notificationId: string): {
  pageUrl: string;
  productName: string;
} | null {
  if (!notificationId.startsWith('buyer|')) return null;
  const parts = notificationId.split('|');
  if (parts.length < 3) return null;
  try {
    return {
      pageUrl: decodeURIComponent(parts[1]),
      productName: decodeURIComponent(parts[2])
    };
  } catch {
    return null;
  }
}

async function openDashboardForBuyerNotification(pageUrl: string, productName: string) {
  const dashboardUrl = chrome.runtime.getURL(
    `dashboard.html?tab=buyers&page=${encodeURIComponent(pageUrl)}&product=${encodeURIComponent(productName)}`
  );
  await chrome.tabs.create({ url: dashboardUrl });
}

function eventStyleTitlePrefix(style: EventNotificationStyle): string {
  if (style === 'important') return 'Увага';
  if (style === 'compact') return 'Нагадування';
  return 'Івент';
}

async function notifyEventLead(
  rule: EventWatchRule,
  slotLabel: string,
  minutesBefore: number
) {
  const prefix = eventStyleTitlePrefix(rule.notificationStyle);
  const extra =
    rule.notificationStyle === 'important'
      ? 'Підготуйся зараз.'
      : rule.notificationStyle === 'compact'
        ? ''
        : 'Перевір готовність.';

  const notificationId = `event|${encodeURIComponent(rule.eventKey)}|${Date.now()}`;
  await chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL(DRAGON_HOUSE_NOTIFICATION_ICON),
    title: `${prefix}: ${rule.eventName}`,
    message: `Початок через ${minutesBefore} хв (${slotLabel}). ${extra}`.trim()
  });
}

function parseEventNotificationTarget(notificationId: string): { eventKey: string } | null {
  if (!notificationId.startsWith('event|')) return null;
  const parts = notificationId.split('|');
  if (parts.length < 2) return null;
  try {
    return {
      eventKey: decodeURIComponent(parts[1])
    };
  } catch {
    return null;
  }
}

async function openDashboardForEventNotification(eventKey: string) {
  const dashboardUrl = chrome.runtime.getURL(
    `dashboard.html?tab=events&event=${encodeURIComponent(eventKey)}`
  );
  await chrome.tabs.create({ url: dashboardUrl });
}

function normalizeBuyerPageRecords(navPages: ReturnType<typeof parseQuantBuyerPage>['navLinks']): BuyerPageRecord[] {
  const now = new Date().toISOString();
  return navPages.map((link) => ({
    url: link.url,
    title: link.title,
    serverId: link.serverId,
    buyerId: link.buyerId,
    sortOrder: link.sortOrder,
    enabled: true,
    discoveredAt: now,
    updatedAt: now
  }));
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    credentials: 'include'
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
}

async function ensureBuyerSocketTransportInitialized() {
  if (buyerSocketTransport) {
    return;
  }

  buyerSocketTransport = new BuyerSocketTransport({
    endpointUrl: null,
    transportKey: 'buyer-socket',
    checkpointStore: {
      get: getTransportCheckpoint,
      set: setTransportCheckpoint
    },
    onBuyerPageData: async (event) => {
      const settings = await getSettings();
      const watchRules = await getEnabledBuyerWatchRules();
      await ingestBuyerPageData({
        parsed: event.payload,
        settings,
        watchRules,
        callbacks: {
          notifyPercentAlert: async ({ pageTitle, pageUrl, productName, percentValue }) => {
            try {
              await notifyBuyerAlert(pageTitle, pageUrl, productName, percentValue);
            } catch (error) {
              console.warn('Buyer alert notification failed:', error);
            }
          },
          notifyRuleAlert: async ({ rule, currentPrice, percentValue }) => {
            try {
              await notifyBuyerPriceRule(rule, currentPrice, percentValue);
            } catch (error) {
              console.warn('Buyer price rule notification failed:', error);
            }
          }
        }
      });
    }
  });

  await buyerSocketTransport.start();
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function randomJitterMs(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

function computeBuyerBatchSize(totalPages: number, intervalMinutes: number): number {
  if (totalPages <= 0) return 0;
  if (intervalMinutes <= 2) return 1;
  if (intervalMinutes <= 5) return Math.min(2, totalPages);
  if (intervalMinutes <= 10) return Math.min(3, totalPages);
  return Math.min(4, totalPages);
}

function pickBatchByCursor<T>(items: T[], cursor: number, batchSize: number) {
  if (!items.length || batchSize <= 0) {
    return { batch: [] as T[], nextCursor: 0 };
  }
  const normalizedCursor = ((cursor % items.length) + items.length) % items.length;
  const batch: T[] = [];
  for (let i = 0; i < Math.min(batchSize, items.length); i += 1) {
    batch.push(items[(normalizedCursor + i) % items.length]);
  }
  return { batch, nextCursor: (normalizedCursor + batch.length) % items.length };
}

async function schedulePollingFromSettings() {
  const settings = await getSettings();
  await chrome.alarms.clear(POLL_ALARM_NAME);

  if (!settings.pollingEnabled) {
    return;
  }

  const interval = Math.max(1, Number(settings.pollIntervalMinutes) || 1);
  const startDelayMinutes = randomJitterMs(6, 30) / 60;
  await chrome.alarms.create(POLL_ALARM_NAME, {
    delayInMinutes: startDelayMinutes,
    periodInMinutes: interval
  });
}

async function ensureEventTickAlarm() {
  await chrome.alarms.clear(EVENT_TICK_ALARM_NAME);
  await chrome.alarms.create(EVENT_TICK_ALARM_NAME, {
    delayInMinutes: 0.2,
    periodInMinutes: 1
  });
}

async function ensureEventScheduleSyncAlarm() {
  await chrome.alarms.clear(EVENT_SCHEDULE_SYNC_ALARM_NAME);
  await chrome.alarms.create(EVENT_SCHEDULE_SYNC_ALARM_NAME, {
    delayInMinutes: 0.3,
    periodInMinutes: 360
  });
}

async function syncEventsSchedule(): Promise<void> {
  if (isEventScheduleSyncRunning) return;
  isEventScheduleSyncRunning = true;
  try {
    const html = await fetchHtml(EVENTS_SOURCE_URL);
    const schedules = parseQuantEventsPage(html, EVENTS_SOURCE_URL);
    await saveEventSchedules(schedules);
  } finally {
    isEventScheduleSyncRunning = false;
  }
}

function makeEventAlertMarkKey(rule: EventWatchRule, occurrenceStart: Date): string {
  return `${rule.eventKey}|${rule.leadMinutes}|${occurrenceStart.toISOString()}`;
}

async function runEventLocalTick() {
  if (isEventTickRunning) return;
  isEventTickRunning = true;
  try {
    const [schedules, rules] = await Promise.all([getEventSchedules(), getEnabledEventWatchRules()]);
    if (!schedules.length || !rules.length) return;

    const now = new Date();
    for (const rule of rules) {
      const schedule = schedules.find((s) => s.eventKey === rule.eventKey);
      if (!schedule?.slots.length) continue;

      const next = getNextSlotOccurrence(schedule.slots, now);
      if (!next) continue;

      const diffMs = next.startAt.getTime() - now.getTime();
      const leadMs = rule.leadMinutes * 60_000;
      const toleranceMs = 59_000;
      if (diffMs > leadMs || diffMs < leadMs - toleranceMs) continue;

      const markKey = makeEventAlertMarkKey(rule, next.startAt);
      if (await hasEventAlertMark(markKey)) continue;

      try {
        await notifyEventLead(rule, next.slot.label, rule.leadMinutes);
        await setEventAlertMark(markKey, new Date().toISOString());
      } catch (error) {
        console.warn('Event lead notification failed:', error);
      }
    }
  } catch (error) {
    console.warn('Event local tick failed:', error);
  } finally {
    isEventTickRunning = false;
  }
}

async function runBuyerPollingCycle(
  trigger: 'alarm' | 'manual' | 'startup' | 'install'
): Promise<void> {
  if (isPollingNow) {
    return;
  }
  isPollingNow = true;

  const cycleStartedAt = new Date();
  const cycleStartedAtIso = cycleStartedAt.toISOString();
  const previousPollState = await getPollState();

  if (
    trigger === 'alarm' &&
    previousPollState.nextEligibleRunAt &&
    Date.parse(previousPollState.nextEligibleRunAt) > cycleStartedAt.getTime()
  ) {
    await setPollState({
      running: false,
      lastRunAt: cycleStartedAtIso,
      lastTrigger: trigger
    });
    isPollingNow = false;
    return;
  }

  await setPollState({
    running: true,
    lastRunAt: cycleStartedAtIso,
    lastError: null,
    lastTrigger: trigger
  });

  try {
    const settings = await getSettings();
    if (!settings.pollingEnabled && trigger !== 'manual') {
      await setPollState({
        running: false,
        lastError: null,
        lastTrigger: trigger
      });
      return;
    }

    const seedUrl = settings.buyerSeedUrl.trim();
    if (!seedUrl) {
      throw new Error('Не вказано seed URL для buyer-сторінок');
    }

    const shouldRefreshSeed =
      !previousPollState.lastSuccessAt ||
      previousPollState.cyclesCompleted % 6 === 0 ||
      previousPollState.buyerTotalPages === 0 ||
      trigger === 'manual' ||
      trigger === 'install';

    let seedHtml: string | null = null;
    let seedParsed: ReturnType<typeof parseQuantBuyerPage> | null = null;
    let discoveredPages: BuyerPageRecord[] = [];

    if (shouldRefreshSeed) {
      seedHtml = await fetchHtml(seedUrl);
      seedParsed = parseQuantBuyerPage(seedHtml, seedUrl);
      discoveredPages = normalizeBuyerPageRecords(seedParsed.navLinks);
    }

    if (discoveredPages.length > 0) {
      await upsertBuyerPages(discoveredPages);
    } else if (seedParsed) {
      await upsertBuyerPages([
        {
          url: seedParsed.pageUrl,
          title: seedParsed.pageTitle,
          serverId: null,
          buyerId: null,
          sortOrder: 0,
          enabled: true,
          discoveredAt: seedParsed.fetchedAt,
          updatedAt: seedParsed.fetchedAt
        }
      ]);
    }

    const pages = await getEnabledBuyerPages();
    const intervalMinutes = Math.max(1, Number(settings.pollIntervalMinutes) || 1);
    const autoBatchSize = computeBuyerBatchSize(pages.length, intervalMinutes);
    const effectiveBatchSize =
      trigger === 'manual' ? Math.max(autoBatchSize, pages.length) : autoBatchSize;
    const { batch: pagesBatch, nextCursor } = pickBatchByCursor(
      pages,
      previousPollState.buyerCursor,
      effectiveBatchSize
    );

    let pagesProcessed = 0;
    let rowsStored = 0;

    const watchRules = await getEnabledBuyerWatchRules();

    for (let index = 0; index < pagesBatch.length; index += 1) {
      const page = pagesBatch[index];
      const canReuseSeed = Boolean(seedParsed && seedHtml && page.url === seedParsed.pageUrl);
      const html = canReuseSeed ? (seedHtml as string) : await fetchHtml(page.url);
      const parsed = canReuseSeed
        ? (seedParsed as ReturnType<typeof parseQuantBuyerPage>)
        : parseQuantBuyerPage(html, page.url);

      pagesProcessed += 1;
      const ingestResult = await ingestBuyerPageData({
        parsed,
        settings,
        watchRules,
        callbacks: {
          notifyPercentAlert: async ({ pageTitle, pageUrl, productName, percentValue }) => {
            try {
              await notifyBuyerAlert(pageTitle, pageUrl, productName, percentValue);
            } catch (error) {
              console.warn('Buyer alert notification failed:', error);
            }
          },
          notifyRuleAlert: async ({ rule, currentPrice, percentValue }) => {
            try {
              await notifyBuyerPriceRule(rule, currentPrice, percentValue);
            } catch (error) {
              console.warn('Buyer price rule notification failed:', error);
            }
          }
        }
      });
      rowsStored += ingestResult.rowsStored;

      if (index < pagesBatch.length - 1) {
        await sleep(randomJitterMs(250, 900));
      }
    }

    await setPollState({
      running: false,
      lastSuccessAt: new Date().toISOString(),
      lastError: null,
      pagesDiscovered: discoveredPages.length || pages.length,
      pagesProcessed,
      rowsStored,
      buyerTotalPages: pages.length,
      buyerBatchSize: pagesBatch.length,
      buyerCursor: nextCursor,
      cyclesCompleted: previousPollState.cyclesCompleted + 1,
      consecutiveFailures: 0,
      nextEligibleRunAt: null,
      lastTrigger: trigger
    });
    console.info(
      `Buyer polling cycle completed (${trigger}) batch=${pagesBatch.length}/${pages.length} nextCursor=${nextCursor}`
    );
  } catch (error) {
    const failures = previousPollState.consecutiveFailures + 1;
    const backoffMinutes = Math.min(60, Math.max(1, 2 ** Math.min(failures - 1, 5)));
    const nextEligibleRunAt = new Date(Date.now() + backoffMinutes * 60_000).toISOString();
    await setPollState({
      running: false,
      lastError: error instanceof Error ? error.message : 'Помилка polling циклу',
      consecutiveFailures: failures,
      nextEligibleRunAt,
      lastTrigger: trigger
    });
    console.error(`Buyer polling cycle failed (backoff ${backoffMinutes}m):`, error);
  } finally {
    isPollingNow = false;
  }
}

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    void ensureBuyerSocketTransportInitialized();
    void schedulePollingFromSettings();
    void ensureEventTickAlarm();
    void ensureEventScheduleSyncAlarm();
    void syncEventsSchedule();
    void runBuyerPollingCycle('install');
  });

  chrome.runtime.onStartup.addListener(() => {
    void ensureBuyerSocketTransportInitialized();
    void schedulePollingFromSettings();
    void ensureEventTickAlarm();
    void ensureEventScheduleSyncAlarm();
    void syncEventsSchedule();
    void runBuyerPollingCycle('startup');
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    void setAlarmRunMark(alarm.name, new Date().toISOString());

    if (alarm.name === POLL_ALARM_NAME) {
      void runBuyerPollingCycle('alarm');
      return;
    }

    if (alarm.name === EVENT_TICK_ALARM_NAME) {
      void runEventLocalTick();
      return;
    }

    if (alarm.name === EVENT_SCHEDULE_SYNC_ALARM_NAME) {
      void syncEventsSchedule();
    }
  });

  chrome.notifications.onClicked.addListener((notificationId) => {
    const buyerTarget = parseBuyerNotificationTarget(notificationId);
    if (buyerTarget) {
      void openDashboardForBuyerNotification(buyerTarget.pageUrl, buyerTarget.productName);
      void chrome.notifications.clear(notificationId);
      return;
    }

    const eventTarget = parseEventNotificationTarget(notificationId);
    if (eventTarget) {
      void openDashboardForEventNotification(eventTarget.eventKey);
      void chrome.notifications.clear(notificationId);
    }
  });

  chrome.runtime.onMessage.addListener((message: RuntimeRequest, _sender, sendResponse) => {
    void (async () => {
      try {
        if (message?.type === 'QUANT_PARSE_ACTIVE_TAB') {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tab?.id) {
            sendResponse({
              ok: false,
              error: 'Активна вкладка не знайдена'
            } satisfies RuntimeResponse);
            return;
          }

          const response = (await chrome.tabs.sendMessage(tab.id, {
            type: 'QUANT_PARSE_PAGE'
          })) as ParseResult | undefined;

          if (!response) {
            sendResponse({
              ok: false,
              error: 'Content script не відповів. Відкрий сторінку та онови її.'
            } satisfies RuntimeResponse);
            return;
          }

          const settings = await getSettings();
          if (shouldNotify(response, settings)) {
            try {
              await notify(response);
            } catch (notificationError) {
              console.warn('Notification failed:', notificationError);
            }
          }

          sendResponse({ ok: true, data: response } satisfies RuntimeResponse);
          return;
        }

        if (message?.type === 'QUANT_RUN_BUYER_POLL_NOW') {
          void runBuyerPollingCycle('manual');
          sendResponse({ ok: true, data: { started: true } } satisfies RuntimeResponse);
          return;
        }

        if (message?.type === 'QUANT_GET_POLL_STATUS') {
          const [pollState, dbStats] = await Promise.all([getPollState(), getDbStats()]);
          sendResponse({ ok: true, data: { pollState, dbStats } } satisfies RuntimeResponse);
          return;
        }

        if (message?.type === 'QUANT_GET_BACKGROUND_STATUS') {
          const [pollState, dbStats, alarms, settings, alarmRunMarks] = await Promise.all([
            getPollState(),
            getDbStats(),
            chrome.alarms.getAll(),
            getSettings(),
            getAlarmRunMarks()
          ]);
          sendResponse({
            ok: true,
            data: {
              pollState,
              dbStats,
              alarms: alarms.map((alarm) => ({
                name: alarm.name,
                scheduledTime: alarm.scheduledTime,
                periodInMinutes: alarm.periodInMinutes
              })),
              alarmRunMarks,
              settings: {
                pollingEnabled: settings.pollingEnabled,
                pollIntervalMinutes: settings.pollIntervalMinutes
              },
              now: new Date().toISOString()
            }
          } satisfies RuntimeResponse);
          return;
        }

        if (message?.type === 'QUANT_REFRESH_POLL_SCHEDULE') {
          await schedulePollingFromSettings();
          sendResponse({ ok: true, data: { started: true } } satisfies RuntimeResponse);
          return;
        }

        if (message?.type === 'QUANT_SYNC_EVENTS_SCHEDULE') {
          await syncEventsSchedule();
          sendResponse({ ok: true, data: { started: true } } satisfies RuntimeResponse);
          return;
        }

        if (message?.type === 'QUANT_GET_EVENTS_DATA') {
          const [schedules, rules] = await Promise.all([getEventSchedules(), getEventWatchRules()]);
          sendResponse({ ok: true, data: { schedules, rules } } satisfies RuntimeResponse);
          return;
        }

        sendResponse({ ok: false, error: 'Непідтримуваний тип повідомлення' } satisfies RuntimeResponse);
      } catch (error) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : 'Невідома помилка'
        } satisfies RuntimeResponse);
      }
    })();

    return true;
  });
});
