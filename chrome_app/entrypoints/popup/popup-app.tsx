import { useEffect, useMemo, useState } from 'react';
import { readFamilyPosts } from '../../lib/family-data';
import {
  getFamilyNotificationsForUser,
  markFamilyNotificationRead,
  syncFamilyNotificationsFromLocalState
} from '../../lib/family-notifications';
import { getCurrentFamilyUser } from '../../lib/family-auth';
import {
  getBuyerPagesLatestData,
  getBuyerWatchRules,
  getEventSchedules,
  getEventWatchRules
} from '../../lib/db';
import { getActiveSlot, getNextSlotOccurrence } from '../../lib/events-time';
import { getSettings } from '../../lib/storage';
import type { BuyerWatchRule, PollState } from '../../lib/types';
import type { FamilyNotification, FamilyPost, FamilySection } from '../../lib/family-types';
import { useFamilyAssetUrl } from '../dashboard/family/use-family-asset-url';

type PollStatusResponse =
  | {
      ok: true;
      data: {
        pollState: PollState;
        dbStats: { pages: number; snapshots: number; rows: number };
      };
    }
  | { ok: false; error: string };

type BuyerPopupRow = {
  pageTitle: string;
  productName: string;
  percentValue: number | null;
  currentPrice: number | null;
  pageUrl: string;
};

type EventsPopupSummary = {
  totalEvents: number;
  trackedEvents: number;
  nextEventText: string;
  activeEventText: string;
  fetchedAt: string | null;
};

function fmtDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('uk-UA');
}

function fmtMoney(value: number | null) {
  return value == null ? '—' : `${value.toLocaleString('uk-UA')} $`;
}

function fmtPercent(value: number | null) {
  return value == null
    ? '—'
    : `${value.toLocaleString('uk-UA', { maximumFractionDigits: 2 })}%`;
}

function dashboardUrl(params: Record<string, string>) {
  const url = new URL(chrome.runtime.getURL('/dashboard.html'));
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

function openDashboard(params: Record<string, string>) {
  void chrome.tabs.create({ url: dashboardUrl(params) });
}

function sectionForNotification(notification: FamilyNotification): FamilySection {
  if (notification.relatedEntityType === 'accounting' || notification.relatedEntityType === 'bonus') {
    return 'accounting';
  }
  if (notification.relatedEntityType === 'quest' || notification.relatedEntityType === 'quest_report') {
    return 'quests';
  }
  if (notification.relatedEntityType === 'member') return 'members';
  if (notification.relatedEntityType === 'post') return 'feed';
  return 'home';
}

function openFamilySection(section: FamilySection, relatedEntityId?: string | null) {
  openDashboard({
    tab: 'family',
    section,
    ...(relatedEntityId ? { entity: relatedEntityId } : {})
  });
}

function importantNewsRank(post: FamilyPost) {
  if (post.type === 'urgent') return 0;
  if (post.type === 'important') return 1;
  if (post.isPinned) return 2;
  return 3;
}

export function PopupApp() {
  const logoUrl = useFamilyAssetUrl('dragon_house_logo');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsText, setSettingsText] = useState('Статус: завантаження...');
  const [pollStatusText, setPollStatusText] = useState('Синхронізація: завантаження...');
  const [currentUser, setCurrentUser] = useState(() => getCurrentFamilyUser());
  const [notifications, setNotifications] = useState<FamilyNotification[]>([]);
  const [posts, setPosts] = useState<FamilyPost[]>([]);
  const [buyerRows, setBuyerRows] = useState<BuyerPopupRow[]>([]);
  const [eventsSummary, setEventsSummary] = useState<EventsPopupSummary | null>(null);

  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const importantPosts = useMemo(
    () =>
      posts
        .filter((post) => post.type === 'urgent' || post.type === 'important' || post.isPinned)
        .sort((a, b) => importantNewsRank(a) - importantNewsRank(b) || b.createdAt.localeCompare(a.createdAt))
        .slice(0, 4),
    [posts]
  );

  useEffect(() => {
    void refreshAll();
  }, []);

  async function refreshNotifications(userId: string) {
    await syncFamilyNotificationsFromLocalState();
    setNotifications(await getFamilyNotificationsForUser(userId));
  }

  async function refreshAll() {
    try {
      const user = getCurrentFamilyUser();
      setCurrentUser(user);
      setPosts(readFamilyPosts());

      const settings = await getSettings();
      setSettingsText(
        `Сповіщення: ${settings.notificationEnabled ? 'увімкнено' : 'вимкнено'} · ` +
          `Polling: ${settings.pollingEnabled ? `${settings.pollIntervalMinutes} хв` : 'вимкнено'}`
      );

      await Promise.all([
        user ? refreshNotifications(user.nickname) : Promise.resolve(setNotifications([])),
        refreshPollStatus(settings.pollIntervalMinutes),
        refreshBuyerSummary(),
        refreshEventsSummary()
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка завантаження popup');
    }
  }

  async function refreshPollStatus(pollIntervalMinutes?: number) {
    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'QUANT_GET_POLL_STATUS'
      })) as PollStatusResponse;

      if (!response.ok) {
        setPollStatusText(`Статус недоступний: ${response.error}`);
        return;
      }

      const interval = pollIntervalMinutes ?? (await getSettings()).pollIntervalMinutes ?? 5;
      const { pollState, dbStats } = response.data;
      const nextDate = pollState.nextEligibleRunAt
        ? new Date(pollState.nextEligibleRunAt)
        : pollState.lastSuccessAt
          ? new Date(new Date(pollState.lastSuccessAt).getTime() + interval * 60_000)
          : null;
      const nextText = nextDate
        ? `~${Math.max(0, Math.ceil((nextDate.getTime() - Date.now()) / 60_000))} хв`
        : '—';

      setPollStatusText(
        [
          pollState.running ? 'оновлення виконується' : 'очікування',
          `наступне: ${nextText}`,
          `сторінок: ${dbStats.pages}`,
          `рядків: ${dbStats.rows}`,
          pollState.lastError ? `помилка: ${pollState.lastError}` : null
        ]
          .filter(Boolean)
          .join(' · ')
      );
    } catch (err) {
      setPollStatusText(`Статус недоступний: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }

  async function refreshBuyerSummary() {
    const settings = await getSettings();
    const [pagesData, buyerRules] = await Promise.all([getBuyerPagesLatestData(), getBuyerWatchRules()]);
    const trackedRuleMap = new Map<string, BuyerWatchRule>();
    for (const rule of buyerRules.filter((rule) => rule.enabled)) {
      trackedRuleMap.set(`${rule.pageUrl}::${rule.productName}`, rule);
    }

    const allowedPages =
      settings.popupBuyerAllowedPageUrls && settings.popupBuyerAllowedPageUrls.length > 0
        ? new Set(settings.popupBuyerAllowedPageUrls)
        : null;
    const allowedProducts =
      settings.popupBuyerAllowedProductKeys && settings.popupBuyerAllowedProductKeys.length > 0
        ? new Set(settings.popupBuyerAllowedProductKeys)
        : null;

    const rows: BuyerPopupRow[] = pagesData
      .flatMap((pageData) =>
        pageData.rows.map((row) => ({
          pageTitle: pageData.page.title,
          pageUrl: pageData.page.url,
          productName: row.productName,
          percentValue: row.percentValue,
          currentPrice: row.currentPrice
        }))
      )
      .filter((row) => {
        if (allowedPages && !allowedPages.has(row.pageUrl)) return false;
        if (allowedProducts && !allowedProducts.has(`${row.pageUrl}::${row.productName}`)) return false;
        return true;
      });

    const sortedRows = [...rows].sort((a, b) => {
      const trackedA = trackedRuleMap.has(`${a.pageUrl}::${a.productName}`) ? 1 : 0;
      const trackedB = trackedRuleMap.has(`${b.pageUrl}::${b.productName}`) ? 1 : 0;
      if (trackedA !== trackedB) return trackedB - trackedA;
      if (settings.popupBuyerTopSort === 'price') {
        return (b.currentPrice ?? -Infinity) - (a.currentPrice ?? -Infinity);
      }
      return (b.percentValue ?? -Infinity) - (a.percentValue ?? -Infinity);
    });

    setBuyerRows(sortedRows.slice(0, Math.max(1, Number(settings.popupBuyerTopCount) || 5)));
  }

  async function refreshEventsSummary() {
    const [schedules, eventRules] = await Promise.all([getEventSchedules(), getEventWatchRules()]);
    const now = new Date();
    const activeEvent = schedules.find((event) => getActiveSlot(event.slots, now));
    const nextCandidates = schedules
      .map((event) => {
        const next = getNextSlotOccurrence(event.slots, now);
        return next ? { event, next } : null;
      })
      .filter(
        (
          value
        ): value is {
          event: (typeof schedules)[number];
          next: NonNullable<ReturnType<typeof getNextSlotOccurrence>>;
        } => Boolean(value)
      )
      .sort((a, b) => a.next.startAt.getTime() - b.next.startAt.getTime());

    setEventsSummary({
      totalEvents: schedules.length,
      trackedEvents: eventRules.filter((rule) => rule.enabled).length,
      activeEventText: activeEvent
        ? `${activeEvent.eventName} (${getActiveSlot(activeEvent.slots, now)?.label ?? 'зараз'})`
        : 'Немає активного івенту',
      nextEventText: nextCandidates[0]
        ? `${nextCandidates[0].event.eventName}: ${nextCandidates[0].next.slot.label} (${nextCandidates[0].next.startAt.toLocaleTimeString('uk-UA', {
            hour: '2-digit',
            minute: '2-digit'
          })})`
        : 'Немає даних',
      fetchedAt: schedules.map((schedule) => schedule.fetchedAt).sort((a, b) => b.localeCompare(a))[0] ?? null
    });
  }

  async function handleNotificationClick(notification: FamilyNotification) {
    await markFamilyNotificationRead(notification.id);
    if (currentUser) setNotifications(await getFamilyNotificationsForUser(currentUser.nickname));
    openFamilySection(sectionForNotification(notification), notification.relatedEntityId);
  }

  async function handleRunBuyerPollNow() {
    setLoading(true);
    setError(null);
    try {
      await chrome.runtime.sendMessage({ type: 'QUANT_RUN_BUYER_POLL_NOW' });
      setPollStatusText('Синхронізацію скупників запущено...');
      window.setTimeout(() => {
        void refreshAll();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка запуску sync');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="dh-popup max-h-[600px] w-[min(380px,100vw)] overflow-x-hidden overflow-y-auto p-3 text-[#f4f1ec]">
      <header className="mb-3 rounded-2xl border border-white/10 bg-[#191919]/95 p-3 shadow-xl shadow-black/30">
        <button
          type="button"
          onClick={() => openDashboard({ tab: 'cabinet' })}
          className="flex w-full items-center gap-3 text-left"
          title="Відкрити Dragon House Family Hub"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-amber-400/35 bg-black/40">
            <img src={logoUrl} alt="Dragon House" className="h-full w-full object-cover" />
          </span>
          <span>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.26em] text-[#d99a24]">
              Dragon House
            </span>
            <span className="mt-0.5 block text-lg font-semibold text-white">Dragon House Family</span>
            <span className="mt-0.5 block text-xs text-[#aaa39a]">
              {currentUser ? currentUser.nickname : 'Увійди у Family Hub'}
            </span>
          </span>
        </button>
      </header>

      <section className="mb-3 rounded-2xl border border-white/10 bg-[#151515]/95 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-white">Мої повідомлення</h2>
          <span className="rounded-full border border-orange-500/40 bg-orange-500/10 px-2 py-0.5 text-xs text-orange-100">
            {unreadCount}
          </span>
        </div>
        {!currentUser ? (
          <p className="text-xs text-[#77736d]">Авторизуйся у Family Hub, щоб бачити персональні повідомлення.</p>
        ) : notifications.length ? (
          <div className="space-y-2">
            {notifications.slice(0, 5).map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => void handleNotificationClick(notification)}
                className={`w-full rounded-xl border px-3 py-2 text-left text-xs ${
                  notification.readAt
                    ? 'border-white/10 bg-black/20 text-[#aaa39a]'
                    : 'border-orange-500/35 bg-[rgba(240,74,22,0.10)] text-[#f4f1ec] shadow-[0_0_18px_rgba(240,74,22,0.10)]'
                }`}
              >
                <span className="block font-semibold text-white">{notification.title}</span>
                <span className="mt-1 block leading-5">{notification.message}</span>
                <span className="mt-1 block text-[11px] text-[#77736d]">
                  {new Date(notification.createdAt).toLocaleString('uk-UA')}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[#77736d]">Нових персональних повідомлень немає.</p>
        )}
      </section>

      <section className="mb-3 rounded-2xl border border-white/10 bg-[#151515]/95 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-white">Важливе від Dragon House</h2>
          <button type="button" onClick={() => openFamilySection('feed')} className="text-xs text-[#f2b84b]">
            Новини
          </button>
        </div>
        {importantPosts.length ? (
          <div className="space-y-2">
            {importantPosts.map((post) => (
              <button
                key={post.id}
                type="button"
                onClick={() => openFamilySection('feed', post.id)}
                className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-left text-xs hover:border-orange-500/35"
              >
                <span className="block font-semibold text-white">{post.title}</span>
                <span className="mt-1 block truncate text-[#aaa39a]">{post.body}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[#77736d]">Важливих новин поки немає.</p>
        )}
      </section>

      <section className="mb-3 rounded-2xl border border-white/10 bg-[#151515]/95 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-white">Скупники</h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => openDashboard({ tab: 'buyers' })} className="text-xs text-[#f2b84b]">
              Всі скупники
            </button>
            <button
              type="button"
              onClick={handleRunBuyerPollNow}
              disabled={loading}
              className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-[#aaa39a] disabled:opacity-60"
            >
              Sync now
            </button>
          </div>
        </div>
        {buyerRows.length ? (
          <div className="space-y-1.5">
            {buyerRows.slice(0, 5).map((row, index) => (
              <button
                key={`${row.pageUrl}-${row.productName}-${index}`}
                type="button"
                onClick={() =>
                  openDashboard({
                    tab: 'buyers',
                    page: row.pageUrl,
                    product: row.productName
                  })
                }
                className="grid w-full grid-cols-[1fr_auto] gap-2 rounded-xl bg-black/25 px-3 py-2 text-left text-xs"
              >
                <span className="min-w-0">
                  <span className="block truncate text-white">{row.pageTitle}</span>
                  <span className="block truncate text-[#aaa39a]">{row.productName}</span>
                </span>
                <span className="text-right">
                  <span className="block text-[#f2b84b]">{fmtMoney(row.currentPrice)}</span>
                  <span className="block text-[#aaa39a]">{fmtPercent(row.percentValue)}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[#77736d]">Ще немає збережених рядків.</p>
        )}
      </section>

      <section className="mb-3 rounded-2xl border border-white/10 bg-[#151515]/95 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-white">Івенти</h2>
          <button type="button" onClick={() => openDashboard({ tab: 'events' })} className="text-xs text-[#f2b84b]">
            Всі івенти
          </button>
        </div>
        {eventsSummary ? (
          <div className="space-y-2 text-xs text-[#aaa39a]">
            <p>
              <span className="text-[#77736d]">Зараз:</span> {eventsSummary.activeEventText}
            </p>
            <p>
              <span className="text-[#77736d]">Далі:</span> {eventsSummary.nextEventText}
            </p>
            <p className="text-[#77736d]">
              Івентів: {eventsSummary.totalEvents} · Відстежується: {eventsSummary.trackedEvents}
            </p>
            <p className="text-[#77736d]">Оновлено: {fmtDateTime(eventsSummary.fetchedAt)}</p>
          </div>
        ) : (
          <p className="text-xs text-[#77736d]">Завантаження...</p>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#151515]/95 p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Статус</h2>
          <button type="button" onClick={() => void refreshAll()} className="text-xs text-[#f2b84b]">
            Оновити
          </button>
        </div>
        <p className="text-xs text-[#aaa39a]" role="status" aria-live="polite">{settingsText}</p>
        <p className="mt-1 text-xs text-[#77736d]" role="status" aria-live="polite">{pollStatusText}</p>
      </section>

      {error ? (
        <div className="mt-3 rounded-xl border border-red-500/40 bg-red-950/40 p-2 text-sm text-red-100" role="alert">
          {error}
        </div>
      ) : null}
    </main>
  );
}
