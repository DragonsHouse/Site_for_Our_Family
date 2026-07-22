import { useEffect, useMemo, useRef, useState } from 'react';
import { QUANTFUN_BASE_URL } from '../../lib/constants';
import {
  getBuyerPagesLatestData,
  getBuyerWatchRules,
  getEventSchedules,
  getEventWatchRules,
  saveBuyerWatchRule,
  saveEventWatchRule
} from '../../lib/db';
import { createTranslator } from '../../lib/i18n';
import { getSettings, saveSettings } from '../../lib/storage';
import type {
  AppSettings,
  BuyerPageLatestData,
  BuyerRowRecord,
  BuyerWatchCondition,
  BuyerWatchRule,
  EventNotificationStyle,
  EventScheduleRecord,
  EventWatchRule
} from '../../lib/types';
import {
  type BuyerRuleEditorState,
  type EventRuleEditorState,
  BuyerRuleModal,
  DashboardHeader,
  EventRuleModal
} from './dashboard-components';
import { BuyersTabPanel } from './panels/buyers-panel';
import { EventsTabPanel } from './panels/events-panel';
import { MapPanel } from './panels/map-panel';
type BackgroundStatusResponse =
  | {
      ok: true;
      data: {
        pollState: {
          lastRunAt: string | null;
          lastSuccessAt: string | null;
          lastError: string | null;
          running: boolean;
          pagesDiscovered: number;
          pagesProcessed: number;
          rowsStored: number;
          buyerTotalPages: number;
          buyerBatchSize: number;
          buyerCursor: number;
          cyclesCompleted: number;
          consecutiveFailures: number;
          nextEligibleRunAt: string | null;
          lastTrigger: string;
        };
        dbStats: { pages: number; snapshots: number; rows: number };
        alarms: Array<{ name: string; scheduledTime?: number; periodInMinutes?: number }>;
        alarmRunMarks: Record<string, string>;
        settings: { pollingEnabled: boolean; pollIntervalMinutes: number };
        now: string;
      };
    }
  | { ok: false; error: string };

type BackgroundStatusData = Extract<BackgroundStatusResponse, { ok: true }>['data'];

type BackgroundStatusView = BackgroundStatusData | null;

function fmtDateTime(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleString('uk-UA');
}

function fmtNextIn(targetIso: string | null | undefined, nowIso: string | undefined) {
  if (!targetIso) return '—';
  const target = new Date(targetIso).getTime();
  const now = nowIso ? new Date(nowIso).getTime() : Date.now();
  const diffMs = target - now;
  const mins = Math.max(0, Math.ceil(diffMs / 60_000));
  return `~${mins} хв (${new Date(targetIso).toLocaleTimeString('uk-UA')})`;
}

function fmtNextInFromNow(targetIso: string | null | undefined, now: Date) {
  if (!targetIso) return '—';
  const targetMs = Date.parse(targetIso);
  if (!Number.isFinite(targetMs)) return '—';
  const diffMs = targetMs - now.getTime();
  if (diffMs <= 0) return `~0 с (${new Date(targetIso).toLocaleTimeString('uk-UA')})`;

  const totalSeconds = Math.ceil(diffMs / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;

  if (mins > 0) {
    return `~${mins} хв ${secs} с (${new Date(targetIso).toLocaleTimeString('uk-UA')})`;
  }
  return `~${secs} с (${new Date(targetIso).toLocaleTimeString('uk-UA')})`;
}

function alarmLabel(name: string) {
  if (name === 'quant-buyer-poll') return 'Buyer polling';
  if (name === 'quant-event-local-tick') return 'Events local tick';
  if (name === 'quant-event-schedule-sync') return 'Events schedule sync';
  return name;
}

function alarmColorClasses(name: string) {
  if (name === 'quant-buyer-poll') {
    return {
      bar: 'bg-blue-500',
      border: 'border-blue-900/50',
      accent: 'text-blue-300'
    };
  }
  if (name === 'quant-event-local-tick') {
    return {
      bar: 'bg-emerald-500',
      border: 'border-emerald-900/50',
      accent: 'text-emerald-300'
    };
  }
  if (name === 'quant-event-schedule-sync') {
    return {
      bar: 'bg-amber-500',
      border: 'border-amber-900/50',
      accent: 'text-amber-300'
    };
  }
  return {
    bar: 'bg-indigo-500',
    border: 'border-indigo-900/50',
    accent: 'text-indigo-300'
  };
}

function getNextUpdateProgress(status: BackgroundStatusView): number | null {
  if (!status) return null;
  const nowMs = Date.parse(status.now);
  if (!Number.isFinite(nowMs)) return null;

  const pollState = status.pollState;
  if (pollState.running) return 100;

  const targetIso =
    pollState.nextEligibleRunAt ??
    (pollState.lastSuccessAt
      ? new Date(
          Date.parse(pollState.lastSuccessAt) +
            status.settings.pollIntervalMinutes * 60_000
        ).toISOString()
      : null);
  if (!targetIso) return null;

  const targetMs = Date.parse(targetIso);
  if (!Number.isFinite(targetMs)) return null;

  const startIso = pollState.lastRunAt ?? pollState.lastSuccessAt;
  const startMs = startIso ? Date.parse(startIso) : NaN;
  if (!Number.isFinite(startMs) || targetMs <= startMs) return null;

  const ratio = (nowMs - startMs) / (targetMs - startMs);
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

function getBuyerNextTargetIso(status: BackgroundStatusView): string | null {
  if (!status) return null;
  return (
    status.pollState.nextEligibleRunAt ??
    (status.pollState.lastSuccessAt
      ? new Date(
          Date.parse(status.pollState.lastSuccessAt) +
            status.settings.pollIntervalMinutes * 60_000
        ).toISOString()
      : null)
  );
}

function getNextUpdateProgressLive(status: BackgroundStatusView, now: Date): number | null {
  if (!status) return null;
  if (status.pollState.running) return 100;

  const targetIso = getBuyerNextTargetIso(status);
  if (!targetIso) return null;
  const targetMs = Date.parse(targetIso);
  if (!Number.isFinite(targetMs)) return null;

  const startIso = status.pollState.lastRunAt ?? status.pollState.lastSuccessAt;
  const startMs = startIso ? Date.parse(startIso) : NaN;
  if (!Number.isFinite(startMs) || targetMs <= startMs) return null;

  const ratio = (now.getTime() - startMs) / (targetMs - startMs);
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

function formatCountdownLive(targetMs: number | undefined, now: Date): string {
  if (!targetMs) return '—';
  const diffMs = targetMs - now.getTime();
  if (diffMs <= 0) return 'зараз';
  const totalSeconds = Math.ceil(diffMs / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return mins > 0 ? `${mins} хв ${secs} с` : `${secs} с`;
}

function getAlarmProgressLive(
  alarm: { scheduledTime?: number; periodInMinutes?: number },
  now: Date
): number | null {
  if (!alarm.scheduledTime || !alarm.periodInMinutes || alarm.periodInMinutes <= 0) return null;
  const periodMs = alarm.periodInMinutes * 60_000;
  const remainingMs = Math.max(0, alarm.scheduledTime - now.getTime());
  return Math.max(0, Math.min(100, Math.round(((periodMs - remainingMs) / periodMs) * 100)));
}

function getDashboardInitialUrl() {
  return new URL(window.location.href);
}

function normalizeUrlKey(url: string | null | undefined) {
  if (!url) return '';
  return url.trim().replace(/\/+$/, '').toLowerCase();
}


type DashboardAppProps = {
  familyTab?: 'buyers' | 'events' | 'map';
};

export function DashboardApp({ familyTab }: DashboardAppProps = {}) {
  const t = createTranslator('dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<'buyers' | 'events' | 'map'>(() => {
    if (familyTab) return familyTab;
    const url = getDashboardInitialUrl();
    const tab = url.searchParams.get('tab');
    if (tab === 'map') return 'map';
    return tab === 'events' ? 'events' : 'buyers';
  });

  const [pagesData, setPagesData] = useState<BuyerPageLatestData[]>([]);
  const [buyerRules, setBuyerRules] = useState<BuyerWatchRule[]>([]);
  const [activePageUrl, setActivePageUrl] = useState<string | null>(() => {
    const page = getDashboardInitialUrl().searchParams.get('page');
    return page ? page : null;
  });
  const [highlightedProductName] = useState<string | null>(() => {
    const product = getDashboardInitialUrl().searchParams.get('product');
    return product ? product : null;
  });
  const [highlightedEventKey] = useState<string | null>(() => {
    const eventKey = getDashboardInitialUrl().searchParams.get('event');
    return eventKey ? eventKey : null;
  });
  const [buyerEditor, setBuyerEditor] = useState<BuyerRuleEditorState | null>(null);
  const [buyerRuleEnabled, setBuyerRuleEnabled] = useState(true);
  const [buyerRuleCondition, setBuyerRuleCondition] = useState<BuyerWatchCondition>('gte');
  const [buyerRulePriceThreshold, setBuyerRulePriceThreshold] = useState('');
  const [buyerRulePercentThreshold, setBuyerRulePercentThreshold] = useState('');

  const [eventSchedules, setEventSchedules] = useState<EventScheduleRecord[]>([]);
  const [eventRules, setEventRules] = useState<EventWatchRule[]>([]);
  const [eventsFetchedAt, setEventsFetchedAt] = useState<string | null>(null);
  const [eventEditor, setEventEditor] = useState<EventRuleEditorState | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>(() => {
    try {
      const raw = window.localStorage.getItem('quant_dashboard_expanded_events');
      if (!raw) return {};
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') return {};
      const next: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === 'boolean') next[k] = v;
      }
      return next;
    } catch {
      return {};
    }
  });
  const [eventOrderKeys, setEventOrderKeys] = useState<string[]>([]);
  const eventOrderKeysRef = useRef<string[]>([]);
  const [eventRuleEnabled, setEventRuleEnabled] = useState(true);
  const [eventLeadMinutes, setEventLeadMinutes] = useState<2 | 5 | 10 | 15>(5);
  const [eventNotificationStyle, setEventNotificationStyle] =
    useState<EventNotificationStyle>('standard');

  const [clockNow, setClockNow] = useState(new Date());
  const [backgroundStatus, setBackgroundStatus] = useState<BackgroundStatusView>(null);
  const [dashboardSettings, setDashboardSettings] = useState<Pick<
    AppSettings,
    'dashboardShowBackgroundService'
  > | null>(null);
  const [backgroundServiceExpanded, setBackgroundServiceExpanded] = useState<boolean>(() => {
    try {
      const raw = window.localStorage.getItem('quant_dashboard_background_service_expanded');
      if (raw == null) return true;
      return raw === '1';
    } catch {
      return true;
    }
  });
  const [favoriteBuyerKeys, setFavoriteBuyerKeys] = useState<string[]>([]);
  const [buyerCalcQuantities, setBuyerCalcQuantities] = useState<Record<string, number>>({});
  const [buyerMutedNotificationKeys, setBuyerMutedNotificationKeys] = useState<string[]>([]);
  const [contactDeveloperOpen, setContactDeveloperOpen] = useState(false);
  const [contactDeveloperSending, setContactDeveloperSending] = useState(false);
  const [contactDeveloperSentAt, setContactDeveloperSentAt] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    contact: '',
    category: 'bug',
    subject: '',
    message: ''
  });

  useEffect(() => {
    if (familyTab) {
      setMainTab(familyTab);
    }
  }, [familyTab]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('quant_dashboard_favorite_buyer_keys');
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        setFavoriteBuyerKeys(parsed.filter((v): v is string => typeof v === 'string'));
      }
    } catch {
      // ignore localStorage parse errors
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        'quant_dashboard_favorite_buyer_keys',
        JSON.stringify(favoriteBuyerKeys)
      );
    } catch {
      // ignore localStorage write errors
    }
  }, [favoriteBuyerKeys]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('quant_dashboard_buyer_calc_quantities');
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') return;
      const next: Record<string, number> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
          next[k] = Math.floor(v);
        }
      }
      setBuyerCalcQuantities(next);
    } catch {
      // ignore localStorage parse errors
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        'quant_dashboard_buyer_calc_quantities',
        JSON.stringify(buyerCalcQuantities)
      );
    } catch {
      // ignore localStorage write errors
    }
  }, [buyerCalcQuantities]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('quant_dashboard_event_order_keys');
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        setEventOrderKeys(parsed.filter((v): v is string => typeof v === 'string'));
      }
    } catch {
      // ignore localStorage parse errors
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('quant_dashboard_event_order_keys', JSON.stringify(eventOrderKeys));
    } catch {
      // ignore localStorage write errors
    }
  }, [eventOrderKeys]);

  useEffect(() => {
    eventOrderKeysRef.current = eventOrderKeys;
  }, [eventOrderKeys]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        'quant_dashboard_expanded_events',
        JSON.stringify(expandedEvents)
      );
    } catch {
      // ignore localStorage write errors
    }
  }, [expandedEvents]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        'quant_dashboard_background_service_expanded',
        backgroundServiceExpanded ? '1' : '0'
      );
    } catch {
      // ignore localStorage write errors
    }
  }, [backgroundServiceExpanded]);

  async function loadBackgroundStatus() {
    const response = (await chrome.runtime.sendMessage({
      type: 'QUANT_GET_BACKGROUND_STATUS'
    })) as BackgroundStatusResponse;
    if (!response.ok) {
      throw new Error(response.error);
    }
    setBackgroundStatus({
      pollState: response.data.pollState,
      dbStats: response.data.dbStats ?? { pages: 0, snapshots: 0, rows: 0 },
      alarms: Array.isArray(response.data.alarms) ? response.data.alarms : [],
      alarmRunMarks:
        response.data && 'alarmRunMarks' in response.data && response.data.alarmRunMarks
          ? response.data.alarmRunMarks
          : {},
      settings:
        response.data && 'settings' in response.data && response.data.settings
          ? response.data.settings
          : { pollingEnabled: true, pollIntervalMinutes: 5 },
      now: response.data.now ?? new Date().toISOString()
    });
  }

  async function loadUiSettings() {
    const settings = await getSettings();
    setDashboardSettings({
      dashboardShowBackgroundService: settings.dashboardShowBackgroundService
    });
    setBuyerMutedNotificationKeys(settings.buyerMutedNotificationKeys ?? []);
  }

  async function loadDashboardData() {
    setError(null);
    const [pages, watchRules, schedules, allEventRules] = await Promise.all([
      getBuyerPagesLatestData(),
      getBuyerWatchRules(),
      getEventSchedules(),
      getEventWatchRules()
    ]);

    setPagesData(pages);
    setBuyerRules(watchRules);
    setActivePageUrl((prev) => {
      if (!pages.length) return null;
      if (!prev) return pages[0].page.url;

      const prevNorm = normalizeUrlKey(prev);
      const matched = pages.find((p) => normalizeUrlKey(p.page.url) === prevNorm);
      return matched?.page.url ?? pages[0].page.url;
    });

    const orderIndex = new Map(eventOrderKeysRef.current.map((key, idx) => [key, idx]));
    const sortedSchedules = [...schedules].sort((a, b) => {
      const ai = orderIndex.get(a.eventKey);
      const bi = orderIndex.get(b.eventKey);
      if (ai == null && bi == null) return a.eventName.localeCompare(b.eventName, 'uk');
      if (ai == null) return 1;
      if (bi == null) return -1;
      return ai - bi;
    });

    setEventSchedules(sortedSchedules);
    setEventRules(allEventRules);
    setEventsFetchedAt(
      sortedSchedules
        .map((s) => s.fetchedAt)
        .sort((a, b) => b.localeCompare(a))[0] ?? null
    );
    setExpandedEvents((prev) => {
      if (sortedSchedules.length === 0) return prev;
      const base =
        Object.keys(prev).length > 0 ? prev : { [sortedSchedules[0].eventKey]: true };
      if (!highlightedEventKey) return base;
      return { ...base, [highlightedEventKey]: true };
    });
    setEventOrderKeys((prev) => {
      const existing = prev.filter((key) => sortedSchedules.some((s) => s.eventKey === key));
      const missing = sortedSchedules.map((s) => s.eventKey).filter((key) => !existing.includes(key));
      const next = [...existing, ...missing];
      return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
    });
  }

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, [highlightedEventKey]);

  useEffect(() => {
    const refreshTimer = window.setInterval(() => {
      void Promise.all([loadDashboardData(), loadBackgroundStatus(), loadUiSettings()]).catch((err) =>
        setError(err instanceof Error ? err.message : t('error_auto_refresh'))
      );
    }, 60_000);
    return () => window.clearInterval(refreshTimer);
  }, []);

  useEffect(() => {
    const bgTimer = window.setInterval(() => {
      void loadBackgroundStatus().catch((err) =>
        setError(err instanceof Error ? err.message : t('error_auto_refresh'))
      );
    }, 10_000);
    return () => window.clearInterval(bgTimer);
  }, []);

  useEffect(() => {
    void Promise.all([loadDashboardData(), loadBackgroundStatus(), loadUiSettings()]).catch((err) => {
      setError(err instanceof Error ? err.message : t('error_load'));
    });
  }, []);

  const activeBuyerPage = useMemo(
    () => pagesData.find((pageData) => pageData.page.url === activePageUrl) ?? null,
    [pagesData, activePageUrl]
  );

  const buyerRuleMap = useMemo(() => {
    const map = new Map<string, BuyerWatchRule>();
    for (const rule of buyerRules) {
      map.set(`${rule.pageUrl}::${rule.productName}`, rule);
    }
    return map;
  }, [buyerRules]);

  const eventRuleMap = useMemo(() => {
    const map = new Map<string, EventWatchRule>();
    for (const rule of eventRules) {
      map.set(rule.eventKey, rule);
    }
    return map;
  }, [eventRules]);

  async function handleRunBuyerSyncNow() {
    setLoading(true);
    setError(null);
    try {
      await chrome.runtime.sendMessage({ type: 'QUANT_RUN_BUYER_POLL_NOW' });
      window.setTimeout(() => {
        void loadDashboardData().catch((err) =>
          setError(err instanceof Error ? err.message : t('error_refresh'))
        );
      }, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_start_sync'));
    } finally {
      setLoading(false);
    }
  }

  async function handleSyncEventsSchedule() {
    setLoading(true);
    setError(null);
    try {
      await chrome.runtime.sendMessage({ type: 'QUANT_SYNC_EVENTS_SCHEDULE' });
      await loadDashboardData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_events_schedule_refresh'));
    } finally {
      setLoading(false);
    }
  }

  function toggleEventExpanded(eventKey: string) {
    setExpandedEvents((prev) => ({ ...prev, [eventKey]: !prev[eventKey] }));
  }

  function reorderEvents(draggedEventKey: string, targetEventKey: string) {
    if (draggedEventKey === targetEventKey) return;
    setEventSchedules((prev) => {
      const next = [...prev];
      const from = next.findIndex((event) => event.eventKey === draggedEventKey);
      const to = next.findIndex((event) => event.eventKey === targetEventKey);
      if (from < 0 || to < 0) return prev;
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      setEventOrderKeys(next.map((event) => event.eventKey));
      return next;
    });
  }

  function openBuyerRuleEditor(page: BuyerPageLatestData, row: BuyerRowRecord) {
    const existingRule = buyerRuleMap.get(`${page.page.url}::${row.productName}`) ?? null;
    setBuyerEditor({
      pageUrl: page.page.url,
      pageTitle: page.page.title,
      productName: row.productName,
      currentPrice: row.currentPrice,
      percentValue: row.percentValue,
      rule: existingRule
    });
    setBuyerRuleEnabled(existingRule?.enabled ?? true);
    setBuyerRuleCondition(existingRule?.condition ?? 'gte');
    setBuyerRulePriceThreshold(
      existingRule?.priceThreshold != null ? String(existingRule.priceThreshold) : ''
    );
    setBuyerRulePercentThreshold(
      existingRule?.percentThreshold != null ? String(existingRule.percentThreshold) : ''
    );
  }

  async function saveBuyerRule() {
    if (!buyerEditor) return;
    const priceThreshold = buyerRulePriceThreshold.trim() ? Number(buyerRulePriceThreshold) : null;
    const percentThreshold = buyerRulePercentThreshold.trim()
      ? Number(buyerRulePercentThreshold)
      : null;

    await saveBuyerWatchRule({
      pageUrl: buyerEditor.pageUrl,
      pageTitle: buyerEditor.pageTitle,
      productName: buyerEditor.productName,
      enabled: buyerRuleEnabled,
      condition: buyerRuleCondition,
      priceThreshold:
        priceThreshold != null && Number.isFinite(priceThreshold) ? priceThreshold : null,
      percentThreshold:
        percentThreshold != null && Number.isFinite(percentThreshold) ? percentThreshold : null,
      createdAt: buyerEditor.rule?.createdAt
    });

    await loadDashboardData();
    setBuyerEditor(null);
  }

  function openEventRuleEditor(event: EventScheduleRecord) {
    const existingRule = eventRuleMap.get(event.eventKey) ?? null;
    setEventEditor({ event, rule: existingRule });
    setEventRuleEnabled(existingRule?.enabled ?? true);
    setEventLeadMinutes(existingRule?.leadMinutes ?? 5);
    setEventNotificationStyle(existingRule?.notificationStyle ?? 'standard');
  }

  async function saveEventRule() {
    if (!eventEditor) return;
    await saveEventWatchRule({
      eventKey: eventEditor.event.eventKey,
      eventName: eventEditor.event.eventName,
      enabled: eventRuleEnabled,
      leadMinutes: eventLeadMinutes,
      notificationStyle: eventNotificationStyle,
      createdAt: eventEditor.rule?.createdAt
    });
    await loadDashboardData();
    setEventEditor(null);
  }

  function toggleFavoriteBuyer(pageUrl: string, productName: string) {
    const key = `${pageUrl}::${productName}`;
    setFavoriteBuyerKeys((prev) =>
      prev.includes(key) ? prev.filter((v) => v !== key) : [...prev, key]
    );
  }

  function setBuyerCalcQuantity(pageUrl: string, productName: string, quantity: number) {
    const key = `${pageUrl}::${productName}`;
    const nextValue = Math.max(0, Math.floor(quantity || 0));
    setBuyerCalcQuantities((prev) => {
      if (nextValue <= 0) {
        if (!(key in prev)) return prev;
        const { [key]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: nextValue };
    });
  }

  function adjustBuyerCalcQuantity(pageUrl: string, productName: string, delta: number) {
    const key = `${pageUrl}::${productName}`;
    const current = buyerCalcQuantities[key] ?? 0;
    setBuyerCalcQuantity(pageUrl, productName, current + delta);
  }

  async function toggleBuyerNotificationsMuted(pageUrl: string, productName: string) {
    const key = `${pageUrl}::${productName}`;
    const currentSettings = await getSettings();
    const current = currentSettings.buyerMutedNotificationKeys ?? [];
    const next = current.includes(key) ? current.filter((v) => v !== key) : [...current, key];
    await saveSettings({
      ...currentSettings,
      buyerMutedNotificationKeys: next
    });
    setBuyerMutedNotificationKeys(next);
  }

  function openContactDeveloperModal() {
    setContactDeveloperOpen(true);
    setContactDeveloperSentAt(null);
  }

  function closeContactDeveloperModal() {
    if (contactDeveloperSending) return;
    setContactDeveloperOpen(false);
  }

  async function submitContactDeveloperMock() {
    if (contactDeveloperSending) return;
    setContactDeveloperSending(true);
    setContactDeveloperSentAt(null);
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    setContactDeveloperSending(false);
    setContactDeveloperSentAt(new Date().toLocaleTimeString('uk-UA'));
  }

  const buyerCalculatorTotal = useMemo(() => {
    let total = 0;
    for (const pageData of pagesData) {
      for (const row of pageData.rows) {
        const qty = buyerCalcQuantities[`${pageData.page.url}::${row.productName}`] ?? 0;
        if (!qty || row.currentPrice == null) continue;
        total += row.currentPrice * qty;
      }
    }
    return total;
  }, [pagesData, buyerCalcQuantities]);

  const nextUpdateProgress = useMemo(
    () => getNextUpdateProgressLive(backgroundStatus, clockNow),
    [backgroundStatus, clockNow]
  );
  const buyerNextTargetIso = useMemo(() => getBuyerNextTargetIso(backgroundStatus), [backgroundStatus]);

  return (
    <main className={familyTab ? 'text-slate-100' : 'min-h-screen bg-slate-950 px-4 py-6 text-slate-100'}>
      <div className="mx-auto max-w-7xl">
        {!familyTab ? (
          <DashboardHeader
            t={t}
            clockNow={clockNow}
            mainTab={mainTab}
            onSwitchTab={setMainTab}
          />
        ) : null}

        {error ? (
          <div className="mb-4 rounded-lg border border-rose-700/40 bg-rose-950/30 p-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {dashboardSettings?.dashboardShowBackgroundService !== false && backgroundStatus ? (
          <section className="mb-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-100">Фонова служба</h2>
                <button
                  type="button"
                  onClick={() => setBackgroundServiceExpanded((v) => !v)}
                  className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                >
                  {backgroundServiceExpanded ? 'Сховати' : 'Показати'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void Promise.all([loadBackgroundStatus(), loadUiSettings()]).catch((err) =>
                      setError(err instanceof Error ? err.message : t('error_refresh'))
                    )
                  }
                  className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-200"
                >
                  Оновити статус
                </button>
              </div>
            </div>

            <div className="mb-3 rounded-lg border border-slate-800 bg-slate-950 p-3">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-slate-400">До наступного оновлення</span>
                <span className="text-slate-200">
                  {fmtNextInFromNow(buyerNextTargetIso, clockNow)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    backgroundStatus.pollState.running ? 'bg-emerald-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${nextUpdateProgress ?? 0}%` }}
                />
              </div>
            </div>

            {backgroundServiceExpanded ? (
              <>
            <div className="grid gap-2 text-xs md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg bg-slate-950 p-3">
                <div className="text-slate-500">Стан polling</div>
                <div className="mt-1 text-slate-100">
                  {backgroundStatus.pollState.running ? 'Виконується' : 'Очікування'}
                </div>
                <div className="mt-1 text-slate-400">
                  Trigger: {backgroundStatus.pollState.lastTrigger}
                </div>
              </div>

              <div className="rounded-lg bg-slate-950 p-3">
                <div className="text-slate-500">Останні запуски</div>
                <div className="mt-1 text-slate-100">
                  Run: {fmtDateTime(backgroundStatus.pollState.lastRunAt)}
                </div>
                <div className="mt-1 text-slate-400">
                  Success: {fmtDateTime(backgroundStatus.pollState.lastSuccessAt)}
                </div>
              </div>

              <div className="rounded-lg bg-slate-950 p-3">
                <div className="text-slate-500">Наступний запуск / backoff</div>
                <div className="mt-1 text-slate-100">
                  {fmtNextIn(
                    backgroundStatus.pollState.nextEligibleRunAt,
                    clockNow.toISOString()
                  )}
                </div>
                <div className="mt-1 text-slate-400">
                  Failures: {backgroundStatus.pollState.consecutiveFailures}
                </div>
              </div>

              <div className="rounded-lg bg-slate-950 p-3">
                <div className="text-slate-500">Batch / cursor / БД</div>
                <div className="mt-1 text-slate-100">
                  {backgroundStatus.pollState.buyerBatchSize}/{backgroundStatus.pollState.buyerTotalPages}
                  {' '}стор.
                </div>
                <div className="mt-1 text-slate-400">
                  Cursor: {backgroundStatus.pollState.buyerCursor} | Rows: {backgroundStatus.dbStats.rows}
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950 p-3">
              <div className="mb-2 text-xs font-medium text-slate-300">Alarms</div>
              <div className="grid gap-2 text-xs md:grid-cols-2 xl:grid-cols-3">
                {backgroundStatus.alarms.length ? (
                  backgroundStatus.alarms.map((alarm) => {
                    const alarmColors = alarmColorClasses(alarm.name);
                    return (
                    <div
                      key={alarm.name}
                      className={`rounded border bg-slate-900 p-2 ${alarmColors.border}`}
                    >
                      <div className={`font-medium ${alarmColors.accent}`}>{alarmLabel(alarm.name)}</div>
                      <div className="mt-1 text-slate-400">
                        Next: {alarm.scheduledTime ? new Date(alarm.scheduledTime).toLocaleTimeString('uk-UA') : '—'}
                      </div>
                      <div className="mt-1 text-slate-400">
                          Last run: {fmtDateTime(backgroundStatus.alarmRunMarks?.[alarm.name] ?? null)}
                      </div>
                      <div className="mt-1 text-slate-300">
                        До запуску: {formatCountdownLive(alarm.scheduledTime, clockNow)}
                      </div>
                      <div className="text-slate-500">
                        Period: {alarm.periodInMinutes ? `${alarm.periodInMinutes} хв` : '—'}
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${alarmColors.bar}`}
                          style={{ width: `${getAlarmProgressLive(alarm, clockNow) ?? 0}%` }}
                        />
                      </div>
                    </div>
                    );
                  })
                ) : (
                  <div className="text-slate-500">Немає активних alarms</div>
                )}
              </div>
              {backgroundStatus.pollState.lastError ? (
                <div className="mt-3 rounded border border-rose-700/40 bg-rose-950/30 p-2 text-xs text-rose-200">
                  Остання помилка: {backgroundStatus.pollState.lastError}
                </div>
              ) : null}
            </div>
              </>
            ) : (
              <div className="rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
                Деталі фонової служби приховано.
              </div>
            )}
          </section>
        ) : null}

        {mainTab === 'buyers' ? (
          <BuyersTabPanel
            t={t}
            loading={loading}
            pagesData={pagesData}
            activePageUrl={activePageUrl}
            activeBuyerPage={activeBuyerPage}
            highlightedProductName={highlightedProductName}
            buyerRuleMap={buyerRuleMap}
            favoriteBuyerKeys={favoriteBuyerKeys}
            buyerMutedNotificationKeys={buyerMutedNotificationKeys}
            buyerCalcQuantities={buyerCalcQuantities}
            buyerCalculatorTotal={buyerCalculatorTotal}
            onSyncNow={() => void handleRunBuyerSyncNow()}
            onSelectPage={setActivePageUrl}
            onOpenBuyerRule={openBuyerRuleEditor}
            onToggleFavoriteBuyer={toggleFavoriteBuyer}
            onToggleBuyerNotificationsMuted={(pageUrl, productName) =>
              void toggleBuyerNotificationsMuted(pageUrl, productName).catch((err) =>
                setError(err instanceof Error ? err.message : t('error_refresh'))
              )
            }
            onSetBuyerCalcQuantity={setBuyerCalcQuantity}
            onAdjustBuyerCalcQuantity={adjustBuyerCalcQuantity}
          />
        ) : null}

        {mainTab === 'events' ? (
          <EventsTabPanel
            t={t}
            loading={loading}
            clockNow={clockNow}
            eventsFetchedAt={eventsFetchedAt}
            eventSchedules={eventSchedules}
            highlightedEventKey={highlightedEventKey}
            eventRuleMap={eventRuleMap}
            expandedEvents={expandedEvents}
            onSyncScheduleNow={() => void handleSyncEventsSchedule()}
            onToggleExpanded={toggleEventExpanded}
            onReorderEvent={reorderEvents}
            onOpenEventRule={openEventRuleEditor}
          />
        ) : null}

        {mainTab === 'map' ? <MapPanel /> : null}

        {!familyTab ? (
        <footer className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => chrome.tabs.create({ url: QUANTFUN_BASE_URL })}
                className="rounded-md border border-emerald-500 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/10"
                title={QUANTFUN_BASE_URL}
              >
                Перейти на QuantFun
              </button>
              <button
                type="button"
                onClick={() => setAboutOpen(true)}
                className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              >
                Про себе
              </button>
              <button
                type="button"
                onClick={openContactDeveloperModal}
                className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              >
                Написати розробнику
              </button>
            </div>
            <div className="text-xs text-slate-500">
              В© {new Date().getFullYear()} Quant RP Helper
            </div>
          </div>
        </footer>
        ) : null}
      </div>

      {buyerEditor ? (
        <BuyerRuleModal
          t={t}
          buyerEditor={buyerEditor}
          buyerRuleEnabled={buyerRuleEnabled}
          buyerRuleCondition={buyerRuleCondition}
          buyerRulePriceThreshold={buyerRulePriceThreshold}
          buyerRulePercentThreshold={buyerRulePercentThreshold}
          setBuyerRuleEnabled={setBuyerRuleEnabled}
          setBuyerRuleCondition={setBuyerRuleCondition}
          setBuyerRulePriceThreshold={setBuyerRulePriceThreshold}
          setBuyerRulePercentThreshold={setBuyerRulePercentThreshold}
          onClose={() => setBuyerEditor(null)}
          onSave={() =>
            void saveBuyerRule().catch((err) =>
              setError(err instanceof Error ? err.message : t('error_save_rule'))
            )
          }
        />
      ) : null}

      {eventEditor ? (
        <EventRuleModal
          t={t}
          eventEditor={eventEditor}
          eventRuleEnabled={eventRuleEnabled}
          eventLeadMinutes={eventLeadMinutes}
          eventNotificationStyle={eventNotificationStyle}
          setEventRuleEnabled={setEventRuleEnabled}
          setEventLeadMinutes={setEventLeadMinutes}
          setEventNotificationStyle={setEventNotificationStyle}
          onClose={() => setEventEditor(null)}
          onSave={() =>
            void saveEventRule().catch((err) =>
              setError(err instanceof Error ? err.message : t('error_save_event_alert'))
            )
          }
        />
      ) : null}

      {contactDeveloperOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl shadow-black/60">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Написати розробнику</h2>
                <p className="text-xs text-slate-400">
                  Емуляція форми: зараз повідомлення нікуди не відправляється.
                </p>
              </div>
              <button
                type="button"
                onClick={closeContactDeveloperModal}
                disabled={contactDeveloperSending}
                className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-60"
              >
                ?
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs text-slate-300">Ім?я</span>
                <input
                  type="text"
                  value={contactForm.name}
                  onChange={(e) => setContactForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ваше ім?я"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-orange-400/30 focus:ring"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-300">Контакт</span>
                <input
                  type="text"
                  value={contactForm.contact}
                  onChange={(e) =>
                    setContactForm((prev) => ({ ...prev, contact: e.target.value }))
                  }
                  placeholder="@telegram / discord / email"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-orange-400/30 focus:ring"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-300">Категорія</span>
                <select
                  value={contactForm.category}
                  onChange={(e) =>
                    setContactForm((prev) => ({ ...prev, category: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-orange-400/30 focus:ring"
                >
                  <option value="bug">Баг / помилка</option>
                  <option value="feature">Побажання / функція</option>
                  <option value="ui">UI / зручність</option>
                  <option value="question">Питання</option>
                  <option value="other">Інше</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-300">Тема</span>
                <input
                  type="text"
                  value={contactForm.subject}
                  onChange={(e) =>
                    setContactForm((prev) => ({ ...prev, subject: e.target.value }))
                  }
                  placeholder="Коротко про звернення"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-orange-400/30 focus:ring"
                />
              </label>
            </div>

            <label className="mt-3 block">
              <span className="mb-1 block text-xs text-slate-300">Повідомлення</span>
              <textarea
                rows={6}
                value={contactForm.message}
                onChange={(e) =>
                  setContactForm((prev) => ({ ...prev, message: e.target.value }))
                }
                placeholder="Опиши проблему або ідею. Наприклад: вкладка, категорія, що очікував, що отримав."
                className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-orange-400/30 focus:ring"
              />
            </label>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-slate-400">
                {contactDeveloperSentAt
                  ? `Емуляція: повідомлення відправлено о ${contactDeveloperSentAt}`
                  : 'Поки що локальна форма без реального API'}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setContactForm({
                      name: '',
                      contact: '',
                      category: 'bug',
                      subject: '',
                      message: ''
                    })
                  }
                  disabled={contactDeveloperSending}
                  className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-60"
                >
                  Очистити
                </button>
                <button
                  type="button"
                  onClick={() => void submitContactDeveloperMock()}
                  disabled={
                    contactDeveloperSending ||
                    !contactForm.subject.trim() ||
                    !contactForm.message.trim()
                  }
                  className="rounded-md border border-orange-400 px-3 py-1.5 text-xs text-orange-300 hover:bg-orange-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {contactDeveloperSending ? 'Відправка...' : 'Надіслати (емуляція)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {aboutOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl shadow-black/60">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Про себе</h2>
                <p className="text-xs text-slate-400">Корисні посилання Quant RP / Quant Fun</p>
              </div>
              <button
                type="button"
                onClick={() => setAboutOpen(false)}
                className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                ?
              </button>
            </div>

            <div className="space-y-3">
              <section className="rounded-xl border border-slate-700 bg-slate-950/50 p-3">
                <h3 className="mb-2 text-base font-semibold text-slate-100">Корисні посилання</h3>
                <div className="divide-y divide-slate-800 overflow-hidden rounded-lg border border-slate-800">
                  <a
                    href={`${QUANTFUN_BASE_URL}go/quant-rp/`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                  >
                    <span className="text-slate-400">??</span>
                    Сайт Quant RP
                  </a>
                  <a
                    href={`${QUANTFUN_BASE_URL}go/quant-rp-forum/`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                  >
                    <span className="text-slate-400">??</span>
                    Форум Quant RP
                  </a>
                  <a
                    href={`${QUANTFUN_BASE_URL}go/quant-rp-rules/`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                  >
                    <span className="text-slate-400">??</span>
                    Правила серверу
                  </a>
                </div>
              </section>

              <section className="rounded-xl border border-slate-700 bg-slate-950/50 p-3">
                <h3 className="mb-2 text-base font-semibold text-slate-100">Discord посилання</h3>
                <div className="divide-y divide-slate-800 overflow-hidden rounded-lg border border-slate-800">
                  <a
                    href={`${QUANTFUN_BASE_URL}go/discord-qf/`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                  >
                    <span className="text-slate-400">??</span>
                    Quant Fun
                  </a>
                  <a
                    href={`${QUANTFUN_BASE_URL}go/discord-quant-rp/`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                  >
                    <span className="text-slate-400">??</span>
                    Quant RP
                  </a>
                  <a
                    href={`${QUANTFUN_BASE_URL}go/discord-quant-tp/`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                  >
                    <span className="text-slate-400">??</span>
                    Торговий майданчик
                  </a>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}









