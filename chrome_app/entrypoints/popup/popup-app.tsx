import { useEffect, useMemo, useRef, useState } from 'react';
import { DRAGON_HOUSE_HUB_PRODUCT_NAME, DRAGON_HOUSE_LABEL } from '../../lib/extension-branding';
import { readFamilyPosts } from '../../lib/family-data';
import {
  getFamilyNotificationsForUser,
  markFamilyNotificationRead,
  syncFamilyNotificationsFromLocalState
} from '../../lib/family-notifications';
import {
  getBuyerPagesLatestData,
  getBuyerWatchRules,
  getEventSchedules,
  getEventWatchRules
} from '../../lib/db';
import { getActiveSlot, getNextSlotOccurrence } from '../../lib/events-time';
import { getSettings } from '../../lib/storage';
import { loginWithDiscord } from '../../lib/family-backend-auth-client';
import { loadCurrentBackendFamilyUser } from '../../lib/family-backend-user-session';
import { translateDiscordLoginError } from '../../lib/family-discord-login-errors';
import { openOrFocusFamilyHubTab } from '../../lib/extension-tabs';
import type { BuyerWatchRule, PollState } from '../../lib/types';
import type { FamilyNotification, FamilyPost, FamilySection, FamilyUser } from '../../lib/family-types';
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
  if (!value) return 'немає даних';
  return new Date(value).toLocaleString('uk-UA');
}

function fmtMoney(value: number | null) {
  return value == null ? 'немає ціни' : `${value.toLocaleString('uk-UA')} $`;
}

function fmtPercent(value: number | null) {
  return value == null
    ? 'немає %'
    : `${value.toLocaleString('uk-UA', { maximumFractionDigits: 2 })}%`;
}

function popupAssetUrl(path: string, fallbackUrl: string) {
  return typeof chrome !== 'undefined' && chrome.runtime?.getURL ? chrome.runtime.getURL(path) : fallbackUrl;
}

function openDashboard(params: Record<string, string>) {
  void openOrFocusFamilyHubTab(params);
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
  const crestUrl = popupAssetUrl('icon/128.png', logoUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsText, setSettingsText] = useState('Статус: завантаження...');
  const [pollStatusText, setPollStatusText] = useState('Синхронізація: завантаження...');
  const [currentUser, setCurrentUser] = useState<FamilyUser | null>(null);
  const [notifications, setNotifications] = useState<FamilyNotification[]>([]);
  const [posts, setPosts] = useState<FamilyPost[]>([]);
  const [buyerRows, setBuyerRows] = useState<BuyerPopupRow[]>([]);
  const [eventsSummary, setEventsSummary] = useState<EventsPopupSummary | null>(null);
  const discordLoginInFlightRef = useRef(false);

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
      const user = await loadPopupCurrentUser();
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

  async function loadPopupCurrentUser() {
    return loadCurrentBackendFamilyUser().catch(() => null);
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
        : 'немає даних';

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

  async function handleDiscordLogin() {
    if (discordLoginInFlightRef.current) return;
    discordLoginInFlightRef.current = true;
    setLoading(true);
    setError(null);
    try {
      await loginWithDiscord();
      setCurrentUser(await loadPopupCurrentUser());
      openDashboard({ tab: 'cabinet' });
      window.close();
    } catch (err) {
      setError(
        err instanceof Error
          ? translateDiscordLoginError(err.message)
          : 'Не вдалося завершити Discord-вхід.'
      );
    } finally {
      discordLoginInFlightRef.current = false;
      setLoading(false);
    }
  }

  return (
    <main
      className="dh-popup max-h-[600px] w-[min(384px,100vw)] overflow-x-hidden overflow-y-auto p-3 text-[#f7f1e7]"
      aria-label={DRAGON_HOUSE_HUB_PRODUCT_NAME}
    >
      <header className="dh-popup-hero">
        <button
          type="button"
          onClick={() => openDashboard({ tab: 'cabinet' })}
          className="dh-brand-lockup"
          title="Відкрити Dragon House Hub"
          aria-label="Відкрити Dragon House Hub"
        >
          <span className="dh-crest-frame" aria-hidden="true">
            <img src={crestUrl} alt="" className="dh-crest-image" />
          </span>
          <span className="min-w-0">
            <span className="dh-kicker">{DRAGON_HOUSE_LABEL}</span>
            <span className="dh-title">{DRAGON_HOUSE_HUB_PRODUCT_NAME}</span>
            <span className="dh-member-line">
              {currentUser ? currentUser.displayName || currentUser.nickname : 'Вхід потрібен для приватних даних'}
            </span>
          </span>
        </button>
      </header>

      <section className="dh-primary-card" aria-labelledby="dh-primary-action-title">
        <div>
          <p id="dh-primary-action-title" className="dh-section-eyebrow">
            Family Hub
          </p>
          <p className="dh-section-copy">
            {currentUser
              ? `Поточний профіль: ${currentUser.nickname}`
              : 'Відкрий Hub, щоб увійти й побачити особисті дані.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => openDashboard({ tab: 'family' })}
          className="dh-open-hub-button"
          aria-label="Open Family Hub in Dragon House Hub"
        >
          Open Family Hub
          <span aria-hidden="true">→</span>
        </button>
      </section>

      {!currentUser ? (
        <section className="dh-card dh-signin-card" aria-labelledby="dh-signin-title">
          <div>
            <h2 id="dh-signin-title" className="dh-card-title">
              Приватний доступ
            </h2>
            <p className="dh-muted-text">
              Увійди через Discord, щоб відкрити персональні повідомлення й кабінет Dragon House.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleDiscordLogin()}
            disabled={loading}
            className="dh-secondary-button"
          >
            {loading ? 'Відкриваємо Discord...' : 'Увійти через Discord'}
          </button>
        </section>
      ) : null}

      <section className="dh-card" aria-labelledby="dh-notifications-title">
        <div className="dh-card-heading">
          <div>
            <p className="dh-section-eyebrow">Особисте</p>
            <h2 id="dh-notifications-title" className="dh-card-title">
              Мої повідомлення
            </h2>
          </div>
          <span className="dh-count-badge" aria-label={`Непрочитаних повідомлень: ${unreadCount}`}>
            {unreadCount}
          </span>
        </div>

        {!currentUser ? (
          <p className="dh-empty-text">Особисті повідомлення зʼявляться після входу.</p>
        ) : notifications.length ? (
          <div className="dh-stack">
            {notifications.slice(0, 5).map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => void handleNotificationClick(notification)}
                className={`dh-list-button ${notification.readAt ? 'dh-list-button-read' : 'dh-list-button-unread'}`}
              >
                <span className="dh-item-main">
                  <span className="dh-item-title">{notification.title}</span>
                  <span className="dh-item-preview">{notification.message}</span>
                  <span className="dh-item-meta">
                    {new Date(notification.createdAt).toLocaleString('uk-UA')}
                  </span>
                </span>
                <span className="dh-item-arrow" aria-hidden="true">
                  →
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="dh-empty-text">Нових персональних повідомлень немає.</p>
        )}
      </section>

      <section className="dh-card" aria-labelledby="dh-news-title">
        <div className="dh-card-heading">
          <div>
            <p className="dh-section-eyebrow">Оголошення</p>
            <h2 id="dh-news-title" className="dh-card-title">
              Важливе від Dragon House
            </h2>
          </div>
          <button type="button" onClick={() => openFamilySection('feed')} className="dh-link-button">
            Новини
          </button>
        </div>

        {importantPosts.length ? (
          <div className="dh-stack">
            {importantPosts.map((post) => (
              <button
                key={post.id}
                type="button"
                onClick={() => openFamilySection('feed', post.id)}
                className="dh-list-button"
              >
                <span className="dh-news-rune" aria-hidden="true">
                  {post.type === 'urgent' ? '!' : '◆'}
                </span>
                <span className="dh-item-main">
                  <span className="dh-item-title">{post.title}</span>
                  <span className="dh-item-preview">{post.body}</span>
                </span>
                <span className="dh-item-arrow" aria-hidden="true">
                  →
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="dh-empty-text">Важливих новин поки немає.</p>
        )}
      </section>

      <section className="dh-card" aria-labelledby="dh-buyers-title">
        <div className="dh-card-heading">
          <div>
            <p className="dh-section-eyebrow">Скарбниця</p>
            <h2 id="dh-buyers-title" className="dh-card-title">
              Скупники
            </h2>
          </div>
          <div className="dh-heading-actions">
            <button type="button" onClick={() => openDashboard({ tab: 'buyers' })} className="dh-link-button">
              Всі скупники
            </button>
            <button
              type="button"
              onClick={handleRunBuyerPollNow}
              disabled={loading}
              className="dh-icon-action"
              aria-label="Оновити скупників зараз"
              title="Оновити скупників зараз"
            >
              ↻
            </button>
          </div>
        </div>

        {buyerRows.length ? (
          <div className="dh-buyers-grid">
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
                className="dh-buyer-row"
              >
                <span className="dh-item-main">
                  <span className="dh-item-title">{row.pageTitle}</span>
                  <span className="dh-item-preview">{row.productName}</span>
                </span>
                <span className="dh-buyer-value">
                  <span>{fmtMoney(row.currentPrice)}</span>
                  <span>{fmtPercent(row.percentValue)}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="dh-empty-text">Даних скупників ще немає.</p>
        )}
      </section>

      <section className="dh-card dh-status-card" aria-labelledby="dh-status-title">
        <div className="dh-card-heading">
          <h2 id="dh-status-title" className="dh-card-title">
            Статус
          </h2>
          <button type="button" onClick={() => void refreshAll()} className="dh-link-button">
            Оновити
          </button>
        </div>
        {eventsSummary ? (
          <div className="dh-status-grid">
            <p>
              <span>Зараз</span>
              {eventsSummary.activeEventText}
            </p>
            <p>
              <span>Далі</span>
              {eventsSummary.nextEventText}
            </p>
            <p>
              <span>Івенти</span>
              {eventsSummary.totalEvents} · відстежується {eventsSummary.trackedEvents}
            </p>
            <p>
              <span>Оновлено</span>
              {fmtDateTime(eventsSummary.fetchedAt)}
            </p>
          </div>
        ) : (
          <p className="dh-empty-text" role="status" aria-live="polite">
            Завантаження статусу...
          </p>
        )}
        <p className="dh-status-line" role="status" aria-live="polite">
          {settingsText}
        </p>
        <p className="dh-status-line dh-status-line-muted" role="status" aria-live="polite">
          {pollStatusText}
        </p>
      </section>

      {error ? (
        <div className="dh-error" role="alert">
          <strong>Dragon House Hub тимчасово недоступний.</strong>
          <span>{error}</span>
        </div>
      ) : null}
    </main>
  );
}
