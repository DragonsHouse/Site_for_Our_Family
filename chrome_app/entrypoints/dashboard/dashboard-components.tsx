import { useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { getActiveSlot, getNextSlotOccurrence } from '../../lib/events-time';
import type {
  BuyerPageLatestData,
  BuyerRowRecord,
  BuyerWatchCondition,
  BuyerWatchRule,
  EventNotificationStyle,
  EventScheduleRecord,
  EventWatchRule
} from '../../lib/types';

export type TFn = (key: string, vars?: Record<string, string | number>) => string;

export type BuyerRuleEditorState = {
  pageUrl: string;
  pageTitle: string;
  productName: string;
  currentPrice: number | null;
  percentValue: number | null;
  rule: BuyerWatchRule | null;
};

export type EventRuleEditorState = {
  event: EventScheduleRecord;
  rule: EventWatchRule | null;
};

export function fmtMoney(value: number | null) {
  return value == null ? '—' : `${value.toLocaleString('uk-UA')} $`;
}

export function fmtPercent(value: number | null) {
  return value == null ? '—' : `${value.toLocaleString('uk-UA', { maximumFractionDigits: 2 })} %`;
}

function IconActionButton({
  tooltip,
  showPopover = true,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tooltip: string;
  children: ReactNode;
  showPopover?: boolean;
}) {
  if (!showPopover) {
    return (
      <button type="button" aria-label={tooltip} title={tooltip} className={className} {...props}>
        {children}
      </button>
    );
  }

  return (
    <span className="group relative inline-flex">
      <button type="button" aria-label={tooltip} title={tooltip} className={className} {...props}>
        {children}
      </button>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-200 shadow-xl shadow-black/40 group-hover:block group-focus-within:block">
        {tooltip}
      </span>
    </span>
  );
}

function deriveBuyerPercent(row: BuyerRowRecord): number | null {
  if (row.currentPrice != null && row.maxPrice != null && row.maxPrice > 0) {
    return (row.currentPrice / row.maxPrice) * 100;
  }
  return row.percentValue;
}

export function rowColor(percentValue: number | null): string {
  if (percentValue == null) return 'bg-slate-900';
  if (percentValue >= 95) return 'bg-emerald-950/30';
  if (percentValue >= 80) return 'bg-amber-950/30';
  return 'bg-rose-950/30';
}

const DEFAULT_BUYER_VISIBLE_COLUMNS = {
  product: true,
  min: true,
  max: true,
  current: true,
  percent: true,
  actions: true
} as const;

const BUYER_LAYOUT_STORAGE_KEY = 'quant_dashboard_buyers_layout_v1';

type BuyerSummaryChipKey =
  | 'pageLabel'
  | 'lastPriceUpdate'
  | 'nextPriceUpdate'
  | 'fetchedAt'
  | 'pageTotal'
  | 'grandTotal';

const DEFAULT_BUYER_SUMMARY_CHIPS: Record<BuyerSummaryChipKey, boolean> = {
  pageLabel: true,
  lastPriceUpdate: true,
  nextPriceUpdate: true,
  fetchedAt: true,
  pageTotal: true,
  grandTotal: true
};

const BUYER_SUMMARY_CHIP_OPTIONS: Array<{ key: BuyerSummaryChipKey; label: string }> = [
  { key: 'pageLabel', label: 'Сторінка' },
  { key: 'lastPriceUpdate', label: 'Останнє оновлення цін' },
  { key: 'nextPriceUpdate', label: 'Наступне оновлення' },
  { key: 'fetchedAt', label: 'Зчитано' },
  { key: 'pageTotal', label: 'Підсумок (вкладка)' },
  { key: 'grandTotal', label: 'Підсумок (всього)' }
];

type BuyerLayoutStorageValue = {
  hiddenPageUrls: string[];
  pageOrder: string[];
  defaultPageUrl: string | null;
  visibleSummaryChips: Record<BuyerSummaryChipKey, boolean>;
};

function readBuyerLayoutStorage(): BuyerLayoutStorageValue {
  const fallback: BuyerLayoutStorageValue = {
    hiddenPageUrls: [],
    pageOrder: [],
    defaultPageUrl: null,
    visibleSummaryChips: { ...DEFAULT_BUYER_SUMMARY_CHIPS }
  };

  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(BUYER_LAYOUT_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return fallback;
    const data = parsed as Record<string, unknown>;

    const hiddenPageUrls = Array.isArray(data.hiddenPageUrls)
      ? data.hiddenPageUrls.filter((v): v is string => typeof v === 'string')
      : [];
    const pageOrder = Array.isArray(data.pageOrder)
      ? data.pageOrder.filter((v): v is string => typeof v === 'string')
      : [];
    const defaultPageUrl =
      typeof data.defaultPageUrl === 'string' || data.defaultPageUrl === null
        ? (data.defaultPageUrl as string | null)
        : null;
    const visibleSummaryChips =
      data.visibleSummaryChips && typeof data.visibleSummaryChips === 'object'
        ? ({
            ...DEFAULT_BUYER_SUMMARY_CHIPS,
            ...(data.visibleSummaryChips as Partial<Record<BuyerSummaryChipKey, boolean>>)
          } as Record<BuyerSummaryChipKey, boolean>)
        : { ...DEFAULT_BUYER_SUMMARY_CHIPS };

    return { hiddenPageUrls, pageOrder, defaultPageUrl, visibleSummaryChips };
  } catch {
    return fallback;
  }
}

const METAL_DETECTOR_ITEMS = new Set(
  [
    'Перлина',
    'Рапана',
    'Морська зірка',
    'Розбитий телефон',
    'Золота каблучка',
    'Іржавий пістолет',
    'Ланцюг',
    'Годинник',
    'Монета',
    'Пивна пробка',
    'Цвях',
    'Залізна каска'
  ].map((name) => name.toLowerCase())
);

function isMetalDetectorItem(productName: string): boolean {
  return METAL_DETECTOR_ITEMS.has(productName.trim().toLowerCase());
}

export function formatCountdown(target: Date, now: Date, t: TFn) {
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return t('countdown_now');
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours} год ${minutes} хв ${seconds} с`;
  }
  return `${minutes} хв ${seconds} с`;
}

export function formatTimeOnly(date: Date) {
  return date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}

type EventSlotVisualState = 'active' | 'next' | 'past' | 'future';

function getEventSlotVisualState(
  slot: EventScheduleRecord['slots'][number],
  now: Date,
  isActiveLocal: boolean,
  isNext: boolean
): EventSlotVisualState {
  if (isActiveLocal) return 'active';
  if (isNext) return 'next';

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const endMinutes = slot.isRange && slot.endMinutes != null ? slot.endMinutes : slot.startMinutes;
  return nowMinutes > endMinutes ? 'past' : 'future';
}

export function slotButtonClass(state: EventSlotVisualState) {
  if (state === 'active') return 'bg-emerald-600 text-white border-emerald-500 shadow-sm shadow-emerald-500/20';
  if (state === 'next') return 'bg-blue-600 text-white border-blue-500 shadow-sm shadow-blue-500/20';
  if (state === 'past') return 'bg-slate-950/40 text-slate-500 border-slate-800 opacity-75';
  return 'bg-slate-950 text-slate-200 border-slate-700';
}

type HeaderProps = {
  t: TFn;
  clockNow: Date;
  mainTab: 'buyers' | 'events' | 'map';
  onSwitchTab: (tab: 'buyers' | 'events' | 'map') => void;
};

export function DashboardHeader({
  t,
  clockNow,
  mainTab,
  onSwitchTab
}: HeaderProps) {
  return (
    <header className="mb-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Quant RP Helper • Dashboard</h1>
          <p className="text-sm text-slate-400">{t('title_description')}</p>
        </div>
        <div className="text-xs text-slate-400">
          {t('local_time')}: {clockNow.toLocaleString('uk-UA')}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSwitchTab('buyers')}
          className={
            mainTab === 'buyers'
              ? 'rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium'
              : 'rounded-lg border border-blue-500 px-4 py-2 text-sm text-blue-300'
          }
        >
          {t('tab_buyers')}
        </button>
        <button
          type="button"
          onClick={() => onSwitchTab('events')}
          className={
            mainTab === 'events'
              ? 'rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium'
              : 'rounded-lg border border-blue-500 px-4 py-2 text-sm text-blue-300'
          }
        >
          {t('tab_events')}
        </button>
        <button
          type="button"
          onClick={() => onSwitchTab('map')}
          className={
            mainTab === 'map'
              ? 'rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium'
              : 'rounded-lg border border-blue-500 px-4 py-2 text-sm text-blue-300'
          }
        >
          Карта
        </button>
      </div>
    </header>
  );
}

type BuyersPanelProps = {
  t: TFn;
  loading: boolean;
  pagesData: BuyerPageLatestData[];
  activePageUrl: string | null;
  activeBuyerPage: BuyerPageLatestData | null;
  highlightedProductName: string | null;
  buyerRuleMap: Map<string, BuyerWatchRule>;
  favoriteBuyerKeys: string[];
  buyerMutedNotificationKeys: string[];
  buyerCalcQuantities: Record<string, number>;
  buyerCalculatorTotal: number;
  onSyncNow: () => void;
  onSelectPage: (url: string) => void;
  onOpenBuyerRule: (page: BuyerPageLatestData, row: BuyerRowRecord) => void;
  onToggleFavoriteBuyer: (pageUrl: string, productName: string) => void;
  onToggleBuyerNotificationsMuted: (pageUrl: string, productName: string) => void;
  onSetBuyerCalcQuantity: (pageUrl: string, productName: string, quantity: number) => void;
  onAdjustBuyerCalcQuantity: (pageUrl: string, productName: string, delta: number) => void;
};

export function BuyersPanel({
  t,
  loading,
  pagesData,
  activePageUrl,
  activeBuyerPage,
  highlightedProductName,
  buyerRuleMap,
  favoriteBuyerKeys,
  buyerMutedNotificationKeys,
  buyerCalcQuantities,
  buyerCalculatorTotal,
  onSyncNow,
  onSelectPage,
  onOpenBuyerRule,
  onToggleFavoriteBuyer,
  onToggleBuyerNotificationsMuted,
  onSetBuyerCalcQuantity,
  onAdjustBuyerCalcQuantity
}: BuyersPanelProps) {
  const [buyerFilterText, setBuyerFilterText] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [metalDetectorOnly, setMetalDetectorOnly] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [tableSettingsOpen, setTableSettingsOpen] = useState(false);
  const [tableSettingsProductSearch, setTableSettingsProductSearch] = useState('');
  const [visibleColumnsByPage, setVisibleColumnsByPage] = useState<
    Record<string, typeof DEFAULT_BUYER_VISIBLE_COLUMNS>
  >({});
  const [hiddenProductsByPage, setHiddenProductsByPage] = useState<Record<string, string[]>>({});
  const [percentFilterMin, setPercentFilterMin] = useState('');
  const [percentFilterMax, setPercentFilterMax] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'product' | 'min' | 'max' | 'current' | 'percent'>(
    'default'
  );
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const buyerLayoutInitialRef = useRef<BuyerLayoutStorageValue | null>(null);
  if (buyerLayoutInitialRef.current == null) {
    buyerLayoutInitialRef.current = readBuyerLayoutStorage();
  }
  const [buyersLayoutOpen, setBuyersLayoutOpen] = useState(false);
  const [buyerHiddenPageUrls, setBuyerHiddenPageUrls] = useState<string[]>(
    () => buyerLayoutInitialRef.current?.hiddenPageUrls ?? []
  );
  const [buyerPageOrder, setBuyerPageOrder] = useState<string[]>(
    () => buyerLayoutInitialRef.current?.pageOrder ?? []
  );
  const [buyerDefaultPageUrl, setBuyerDefaultPageUrl] = useState<string | null>(
    () => buyerLayoutInitialRef.current?.defaultPageUrl ?? null
  );
  const [buyerVisibleSummaryChips, setBuyerVisibleSummaryChips] = useState(
    () => buyerLayoutInitialRef.current?.visibleSummaryChips ?? DEFAULT_BUYER_SUMMARY_CHIPS
  );
  const [draggingBuyerPageUrl, setDraggingBuyerPageUrl] = useState<string | null>(null);
  const [dragOverBuyerPageUrl, setDragOverBuyerPageUrl] = useState<string | null>(null);
  const didApplyBuyerDefaultRef = useRef(false);
  const [tableSettingsHydrated, setTableSettingsHydrated] = useState(false);

  const isMotlohBuyerPage = Boolean(activeBuyerPage?.page.title?.toLowerCase().includes('мотлох'));
  const activePageKey = activeBuyerPage?.page.url ?? null;
  const visibleColumns = activePageKey
    ? (visibleColumnsByPage[activePageKey] ?? DEFAULT_BUYER_VISIBLE_COLUMNS)
    : DEFAULT_BUYER_VISIBLE_COLUMNS;
  const hiddenProductsForPage = activePageKey ? hiddenProductsByPage[activePageKey] ?? [] : [];

  const pagesByCustomOrder = useMemo(() => {
    const orderIndex = new Map(buyerPageOrder.map((url, idx) => [url, idx]));
    return [...pagesData].sort((a, b) => {
      const ai = orderIndex.get(a.page.url);
      const bi = orderIndex.get(b.page.url);
      if (ai == null && bi == null) return a.page.title.localeCompare(b.page.title, 'uk');
      if (ai == null) return 1;
      if (bi == null) return -1;
      return ai - bi;
    });
  }, [pagesData, buyerPageOrder]);

  const visiblePagesData = useMemo(
    () =>
      pagesByCustomOrder.filter(
        (page) =>
          !buyerHiddenPageUrls.includes(page.page.url) || page.page.url === activePageUrl
      ),
    [pagesByCustomOrder, buyerHiddenPageUrls, activePageUrl]
  );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('quant_dashboard_buyer_table_settings_v1');
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') return;
      const record = parsed as Record<string, unknown>;
      const cols = record.visibleColumnsByPage;
      const hidden = record.hiddenProductsByPage;
      if (cols && typeof cols === 'object') {
        setVisibleColumnsByPage(cols as Record<string, typeof DEFAULT_BUYER_VISIBLE_COLUMNS>);
      }
      if (hidden && typeof hidden === 'object') {
        setHiddenProductsByPage(hidden as Record<string, string[]>);
      }
    } catch {
      // ignore localStorage parse errors
    } finally {
      setTableSettingsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!tableSettingsHydrated) {
      return;
    }
    try {
      window.localStorage.setItem(
        'quant_dashboard_buyer_table_settings_v1',
        JSON.stringify({
          visibleColumnsByPage,
          hiddenProductsByPage
        })
      );
    } catch {
      // ignore localStorage write errors
    }
  }, [visibleColumnsByPage, hiddenProductsByPage, tableSettingsHydrated]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        BUYER_LAYOUT_STORAGE_KEY,
        JSON.stringify({
          hiddenPageUrls: buyerHiddenPageUrls,
          pageOrder: buyerPageOrder,
          defaultPageUrl: buyerDefaultPageUrl,
          visibleSummaryChips: buyerVisibleSummaryChips
        })
      );
    } catch {
      // ignore localStorage write errors
    }
  }, [
    buyerHiddenPageUrls,
    buyerPageOrder,
    buyerDefaultPageUrl,
    buyerVisibleSummaryChips
  ]);

  useEffect(() => {
    if (!pagesData.length) return;
    setBuyerPageOrder((prev) => {
      const existing = prev.filter((url) => pagesData.some((p) => p.page.url === url));
      const missing = pagesData.map((p) => p.page.url).filter((url) => !existing.includes(url));
      const next = [...existing, ...missing];
      return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
    });
    setBuyerHiddenPageUrls((prev) => prev.filter((url) => pagesData.some((p) => p.page.url === url)));
    setBuyerDefaultPageUrl((prev) =>
      prev && pagesData.some((p) => p.page.url === prev) ? prev : (pagesData[0]?.page.url ?? null)
    );
  }, [pagesData]);

  useEffect(() => {
    if (!visiblePagesData.length) return;

    const activeVisible = activePageUrl && visiblePagesData.some((p) => p.page.url === activePageUrl);

    if (!didApplyBuyerDefaultRef.current) {
      didApplyBuyerDefaultRef.current = true;
      if (
        buyerDefaultPageUrl &&
        visiblePagesData.some((p) => p.page.url === buyerDefaultPageUrl) &&
        activePageUrl !== buyerDefaultPageUrl
      ) {
        onSelectPage(buyerDefaultPageUrl);
        return;
      }
    }

    if (!activeVisible) {
      onSelectPage(visiblePagesData[0].page.url);
    }
  }, [activePageUrl, buyerDefaultPageUrl, onSelectPage, visiblePagesData]);

  useEffect(() => {
    setTableSettingsOpen(false);
    setTableSettingsProductSearch('');
  }, [activePageKey]);

  const filteredRows = useMemo(() => {
    if (!activeBuyerPage) return [];

    const query = buyerFilterText.trim().toLowerCase();
    const minPercent = percentFilterMin.trim() === '' ? null : Number(percentFilterMin);
    const maxPercent = percentFilterMax.trim() === '' ? null : Number(percentFilterMax);
    const hiddenProductsSet = new Set(hiddenProductsForPage);

    const rows = activeBuyerPage.rows.filter((row) => {
      const rowKey = `${activeBuyerPage.page.url}::${row.productName}`;
      const effectivePercent = deriveBuyerPercent(row);

      if (favoritesOnly && !favoriteBuyerKeys.includes(rowKey)) return false;
      if (hiddenProductsSet.has(row.productName)) return false;
      if (isMotlohBuyerPage && metalDetectorOnly && !isMetalDetectorItem(row.productName)) {
        return false;
      }
      if (minPercent != null && Number.isFinite(minPercent)) {
        if (effectivePercent == null || effectivePercent < minPercent) return false;
      }
      if (maxPercent != null && Number.isFinite(maxPercent)) {
        if (effectivePercent == null || effectivePercent > maxPercent) return false;
      }
      if (query && !row.productName.toLowerCase().includes(query)) return false;

      return true;
    });

    return rows.sort((a, b) => {
      const aFav = favoriteBuyerKeys.includes(`${activeBuyerPage.page.url}::${a.productName}`);
      const bFav = favoriteBuyerKeys.includes(`${activeBuyerPage.page.url}::${b.productName}`);
      if (aFav !== bFav) return aFav ? -1 : 1;

      if (sortBy === 'default') return a.rowIndex - b.rowIndex;
      const dir = sortDir === 'asc' ? 1 : -1;

      if (sortBy === 'product') {
        const byName = a.productName.localeCompare(b.productName, 'uk');
        return byName === 0 ? a.rowIndex - b.rowIndex : byName * dir;
      }

      const pick = (row: BuyerRowRecord): number | null => {
        if (sortBy === 'min') return row.minPrice;
        if (sortBy === 'max') return row.maxPrice;
        if (sortBy === 'current') return row.currentPrice;
        if (sortBy === 'percent') return deriveBuyerPercent(row);
        return null;
      };

      const aVal = pick(a);
      const bVal = pick(b);
      if (aVal == null && bVal == null) return a.rowIndex - b.rowIndex;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (aVal === bVal) return a.rowIndex - b.rowIndex;
      return (aVal - bVal) * dir;
    });
  }, [
    activeBuyerPage,
    buyerFilterText,
    favoriteBuyerKeys,
    favoritesOnly,
    isMotlohBuyerPage,
    hiddenProductsForPage,
    metalDetectorOnly,
    percentFilterMin,
    percentFilterMax,
    sortBy,
    sortDir
  ]);

  const activePageCalculatorTotal = useMemo(() => {
    if (!activeBuyerPage) return 0;
    let total = 0;
    for (const row of activeBuyerPage.rows) {
      const key = `${activeBuyerPage.page.url}::${row.productName}`;
      const qty = buyerCalcQuantities[key] ?? 0;
      if (!qty || row.currentPrice == null) continue;
      total += row.currentPrice * qty;
    }
    return total;
  }, [activeBuyerPage, buyerCalcQuantities]);

  function toggleSort(nextSortBy: 'product' | 'min' | 'max' | 'current' | 'percent') {
    if (sortBy === nextSortBy) {
      setSortDir((v) => (v === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(nextSortBy);
    setSortDir(nextSortBy === 'product' ? 'asc' : 'desc');
  }

  function sortArrow(column: 'product' | 'min' | 'max' | 'current' | 'percent') {
    if (sortBy !== column) return '↕';
    return sortDir === 'asc' ? '↑' : '↓';
  }

  function toggleVisibleColumn(key: keyof typeof DEFAULT_BUYER_VISIBLE_COLUMNS) {
    if (!activePageKey) return;
    setVisibleColumnsByPage((prev) => {
      const current = prev[activePageKey] ?? DEFAULT_BUYER_VISIBLE_COLUMNS;
      return {
        ...prev,
        [activePageKey]: {
          ...current,
          [key]: !current[key]
        }
      };
    });
  }

  const visibleColumnCount = Object.values(visibleColumns).filter(Boolean).length || 1;

  const settingsProductRows = useMemo(() => {
    if (!activeBuyerPage) return [];
    const q = tableSettingsProductSearch.trim().toLowerCase();
    return [...activeBuyerPage.rows]
      .sort((a, b) => a.rowIndex - b.rowIndex)
      .filter((row) => (q ? row.productName.toLowerCase().includes(q) : true));
  }, [activeBuyerPage, tableSettingsProductSearch]);

  function toggleProductVisibility(productName: string) {
    if (!activePageKey) return;
    setHiddenProductsByPage((prev) => {
      const current = prev[activePageKey] ?? [];
      const next = current.includes(productName)
        ? current.filter((name) => name !== productName)
        : [...current, productName];
      return { ...prev, [activePageKey]: next };
    });
  }

  function showAllProductsForPage() {
    if (!activePageKey) return;
    setHiddenProductsByPage((prev) => ({ ...prev, [activePageKey]: [] }));
  }

  function toggleBuyerPageVisible(pageUrl: string) {
    setBuyerHiddenPageUrls((prev) =>
      prev.includes(pageUrl) ? prev.filter((url) => url !== pageUrl) : [...prev, pageUrl]
    );
  }

  function toggleBuyerSummaryChipVisible(key: BuyerSummaryChipKey) {
    setBuyerVisibleSummaryChips((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function reorderBuyerPages(draggedPageUrl: string, targetPageUrl: string) {
    if (draggedPageUrl === targetPageUrl) return;
    setBuyerPageOrder((prev) => {
      const next = prev.length ? [...prev] : pagesData.map((p) => p.page.url);
      const from = next.indexOf(draggedPageUrl);
      const to = next.indexOf(targetPageUrl);
      if (from < 0 || to < 0) return prev;
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-3 flex flex-wrap items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          {visiblePagesData.map((pageData) => {
            const isActive = pageData.page.url === activePageUrl;
            return (
              <button
                key={pageData.page.url}
                type="button"
                onClick={() => onSelectPage(pageData.page.url)}
                className={
                  isActive
                    ? 'rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white'
                    : 'rounded-lg border border-blue-500 px-4 py-2 text-sm text-blue-300 hover:bg-blue-500/10'
                }
              >
                {pageData.page.title}
              </button>
            );
          })}
        </div>
        <div className="relative self-start">
          <IconActionButton
            onClick={() => setBuyersLayoutOpen((v) => !v)}
            tooltip="Налаштування верхнього блоку скупників"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-base text-slate-200 hover:bg-slate-800"
          >
            ⚙
          </IconActionButton>
          {buyersLayoutOpen ? (
            <div className="absolute right-0 z-30 mt-2 w-[min(95vw,560px)] rounded-xl border border-slate-700 bg-slate-950 p-3 shadow-2xl shadow-black/50">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-slate-100">Налаштування блоку "Скупники"</div>
                  <div className="text-xs text-slate-400">Групи, порядок, вкладка за замовчуванням, інфо-чіпи</div>
                </div>
                <button
                  type="button"
                  onClick={() => setBuyersLayoutOpen(false)}
                  className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                >
                  ✕
                </button>
              </div>

              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onSyncNow}
                  disabled={loading}
                  className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-slate-950 disabled:opacity-60"
                >
                  {loading ? t('sync_buyers_loading') : t('sync_buyers_now')}
                </button>
                <label className="text-xs text-slate-300">
                  Вкладка при відкритті:
                  <select
                    value={buyerDefaultPageUrl ?? ''}
                    onChange={(e) => setBuyerDefaultPageUrl(e.target.value || null)}
                    className="ml-2 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                  >
                    {visiblePagesData.map((page) => (
                      <option key={`default-${page.page.url}`} value={page.page.url}>
                        {page.page.title}
                      </option>
                    ))}
                    {!visiblePagesData.length && <option value="">Немає доступних категорій</option>}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-300">
                    Групи скупників (показ / порядок)
                  </div>
                  <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                    {pagesByCustomOrder.map((page) => {
                      const visible = !buyerHiddenPageUrls.includes(page.page.url);
                      const isDragOver =
                        dragOverBuyerPageUrl === page.page.url && draggingBuyerPageUrl !== page.page.url;
                      return (
                        <div
                          key={`buyers-layout-${page.page.url}`}
                          onDragOver={(e) => {
                            e?.preventDefault?.();
                            if (dragOverBuyerPageUrl !== page.page.url) {
                              setDragOverBuyerPageUrl(page.page.url);
                            }
                          }}
                          onDrop={(e) => {
                            e?.preventDefault?.();
                            const dragged = e.dataTransfer.getData('text/plain') || draggingBuyerPageUrl;
                            if (dragged && dragged !== page.page.url) {
                              reorderBuyerPages(dragged, page.page.url);
                            }
                            setDraggingBuyerPageUrl(null);
                            setDragOverBuyerPageUrl(null);
                          }}
                          className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${
                            isDragOver ? 'border-blue-500/60 bg-blue-500/5' : 'border-slate-800 bg-slate-950/60'
                          }`}
                        >
                          <IconActionButton
                            draggable
                            onDragStart={(e) => {
                              setDraggingBuyerPageUrl(page.page.url);
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/plain', page.page.url);
                            }}
                            onDragEnd={() => {
                              setDraggingBuyerPageUrl(null);
                              setDragOverBuyerPageUrl(null);
                            }}
                            tooltip="Перетягни для зміни порядку"
                            showPopover={false}
                            className="cursor-grab rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-800 active:cursor-grabbing"
                          >
                            ⋮⋮
                          </IconActionButton>
                          <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-200">
                            <input
                              type="checkbox"
                              checked={visible}
                              onChange={() => toggleBuyerPageVisible(page.page.url)}
                              className="h-4 w-4 shrink-0"
                            />
                            <span className="truncate">{page.page.title}</span>
                          </label>
                          {buyerDefaultPageUrl === page.page.url ? (
                            <span className="rounded border border-amber-500/40 bg-amber-950/20 px-1.5 py-0.5 text-[10px] text-amber-300">
                              default
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-300">
                    Інфо-чіпи (2 нижні рядки)
                  </div>
                  <div className="space-y-1">
                    {BUYER_SUMMARY_CHIP_OPTIONS.map((option) => (
                      <label
                        key={`buyer-chip-${option.key}`}
                        className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-slate-200 hover:bg-slate-800/60"
                      >
                        <input
                          type="checkbox"
                          checked={buyerVisibleSummaryChips[option.key]}
                          onChange={() => toggleBuyerSummaryChipVisible(option.key)}
                          className="h-4 w-4"
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {!visiblePagesData.length && pagesData.length ? (
        <div className="mb-3 rounded-lg border border-amber-700/40 bg-amber-950/20 p-3 text-sm text-amber-200">
          Усі категорії приховані. Відкрий ★ і увімкни хоча б одну.
        </div>
      ) : null}

      {!pagesData.length ? (
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
          {t('no_buyers_data')}
        </div>
      ) : null}

      {activeBuyerPage ? (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            {buyerVisibleSummaryChips.pageLabel ? (
              <span className="rounded-md bg-slate-950 px-3 py-1">
                {t('page_label')}: {activeBuyerPage.snapshot?.pageTitle ?? activeBuyerPage.page.title}
              </span>
            ) : null}
            {buyerVisibleSummaryChips.lastPriceUpdate ? (
              <span className="rounded-md bg-slate-950 px-3 py-1 text-slate-300">
                {t('last_price_update')}: {activeBuyerPage.snapshot?.lastUpdatedText ?? '—'}
              </span>
            ) : null}
            {buyerVisibleSummaryChips.nextPriceUpdate ? (
              <span className="rounded-md bg-slate-950 px-3 py-1 text-slate-300">
                {t('next_price_update')}: {activeBuyerPage.snapshot?.nextUpdateText ?? '—'}
              </span>
            ) : null}
            {buyerVisibleSummaryChips.fetchedAt ? (
              <span className="rounded-md bg-slate-950 px-3 py-1 text-slate-300">
                {t('fetched_at')}:{' '}
                {activeBuyerPage.snapshot?.fetchedAt
                  ? new Date(activeBuyerPage.snapshot.fetchedAt).toLocaleString('uk-UA')
                  : '—'}
              </span>
            ) : null}
            {buyerVisibleSummaryChips.pageTotal || buyerVisibleSummaryChips.grandTotal ? (
              <span className="rounded-md border border-emerald-700/50 bg-emerald-950/20 px-3 py-1 text-emerald-200">
                Підсумок:
                {buyerVisibleSummaryChips.pageTotal ? ` вкладка ${fmtMoney(activePageCalculatorTotal)}` : ''}
                {buyerVisibleSummaryChips.pageTotal && buyerVisibleSummaryChips.grandTotal ? ' /' : ''}
                {buyerVisibleSummaryChips.grandTotal ? ` всього ${fmtMoney(buyerCalculatorTotal)}` : ''}
              </span>
            ) : null}
          </div>

          <div className="mb-3 rounded-lg border border-slate-800 bg-slate-950 p-3">
            <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
              <div
                className={`min-w-[220px] flex-1 transition-all duration-300 ease-out ${
                  isSearchFocused ? 'xl:basis-[520px]' : 'xl:basis-[340px]'
                }`}
              >
                <input
                  type="text"
                  value={buyerFilterText}
                  onChange={(e) => setBuyerFilterText(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  placeholder="Пошук по слову..."
                  className={`w-full rounded-lg border bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-orange-400/30 transition-all duration-300 focus:ring ${
                    isSearchFocused
                      ? 'border-orange-500/70 shadow-[0_0_0_1px_rgba(249,115,22,0.25)]'
                      : 'border-slate-700'
                  }`}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={percentFilterMin}
                  onChange={(e) => setPercentFilterMin(e.target.value)}
                  placeholder="% від"
                  className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100 outline-none ring-orange-400/30 focus:ring"
                />
                <input
                  type="number"
                  value={percentFilterMax}
                  onChange={(e) => setPercentFilterMax(e.target.value)}
                  placeholder="% до"
                  className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100 outline-none ring-orange-400/30 focus:ring"
                />
              </div>

              <IconActionButton
                onClick={() => setFavoritesOnly((v) => !v)}
                tooltip={favoritesOnly ? 'Показуються тільки обрані товари' : 'Показувати тільки обране'}
                className={
                  favoritesOnly
                    ? 'rounded-lg border border-amber-400 bg-amber-400/10 px-2.5 py-2 text-sm text-amber-300'
                    : 'rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-sm text-slate-300 hover:bg-slate-800'
                }
              >
                {favoritesOnly ? '★' : '☆'}
              </IconActionButton>

              {isMotlohBuyerPage ? (
                <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-cyan-200">
                  <input
                    type="checkbox"
                    checked={metalDetectorOnly}
                    onChange={(e) => setMetalDetectorOnly(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Металошукач
                </label>
              ) : null}

              <div className="text-xs text-slate-400">
                Показано: {filteredRows.length}/{activeBuyerPage.rows.length}
              </div>

              <div className="relative ml-auto">
                <IconActionButton
                  onClick={() => setTableSettingsOpen((v) => !v)}
                  tooltip="Налаштування таблиці для поточної категорії"
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-sm text-slate-200 hover:bg-slate-800"
                >
                  <span aria-hidden="true">⚙</span>
                </IconActionButton>
                {tableSettingsOpen ? (
                  <div className="absolute right-0 z-20 mt-2 w-[min(92vw,420px)] rounded-xl border border-slate-700 bg-slate-950 p-3 shadow-2xl shadow-black/50">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium text-slate-100">Налаштування таблиці</div>
                        <div className="text-[11px] text-slate-400">
                          Окремо для категорії: {activeBuyerPage.page.title}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTableSettingsOpen(false)}
                        className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                      <div className="mb-2 text-xs font-medium text-slate-200">Колонки</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <label className="flex items-center gap-2 text-slate-200">
                          <input type="checkbox" checked={visibleColumns.product} onChange={() => toggleVisibleColumn('product')} className="h-4 w-4" />
                          Товар
                        </label>
                        <label className="flex items-center gap-2 text-slate-200">
                          <input type="checkbox" checked={visibleColumns.min} onChange={() => toggleVisibleColumn('min')} className="h-4 w-4" />
                          Мін. ціна
                        </label>
                        <label className="flex items-center gap-2 text-slate-200">
                          <input type="checkbox" checked={visibleColumns.max} onChange={() => toggleVisibleColumn('max')} className="h-4 w-4" />
                          Макс. ціна
                        </label>
                        <label className="flex items-center gap-2 text-slate-200">
                          <input type="checkbox" checked={visibleColumns.current} onChange={() => toggleVisibleColumn('current')} className="h-4 w-4" />
                          Поточна ціна
                        </label>
                        <label className="flex items-center gap-2 text-slate-200">
                          <input type="checkbox" checked={visibleColumns.percent} onChange={() => toggleVisibleColumn('percent')} className="h-4 w-4" />
                          Відсоток
                        </label>
                        <label className="flex items-center gap-2 text-slate-200">
                          <input type="checkbox" checked={visibleColumns.actions} onChange={() => toggleVisibleColumn('actions')} className="h-4 w-4" />
                          Дії
                        </label>
                      </div>
                    </div>

                    <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="text-xs font-medium text-slate-200">Товари (що показувати)</div>
                        <button
                          type="button"
                          onClick={showAllProductsForPage}
                          className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
                        >
                          Показати все
                        </button>
                      </div>
                      <input
                        type="text"
                        value={tableSettingsProductSearch}
                        onChange={(e) => setTableSettingsProductSearch(e.target.value)}
                        placeholder="Пошук товару в налаштуваннях..."
                        className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none ring-orange-400/30 focus:ring"
                      />
                      <div className="max-h-56 space-y-1 overflow-y-auto pr-1 text-xs">
                        {settingsProductRows.map((row) => {
                          const checked = !hiddenProductsForPage.includes(row.productName);
                          return (
                            <label
                              key={`settings-row-${row.rowIndex}-${row.productName}`}
                              className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-slate-800/60"
                            >
                              <span className="truncate text-slate-200">{row.productName}</span>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleProductVisibility(row.productName)}
                                className="h-4 w-4 shrink-0"
                              />
                            </label>
                          );
                        })}
                        {!settingsProductRows.length ? (
                          <div className="rounded-md border border-slate-800 px-2 py-2 text-slate-400">
                            Нічого не знайдено
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-950 text-slate-300">
                <tr>
                  {visibleColumns.product ? (
                  <th className="px-3 py-2 text-left">
                    <button
                      type="button"
                      onClick={() => toggleSort('product')}
                      className="inline-flex items-center gap-1 hover:text-white"
                      title="Сортувати за назвою"
                    >
                      {t('col_product')}
                      <span className="text-[10px] opacity-80">{sortArrow('product')}</span>
                    </button>
                  </th>
                  ) : null}
                  {visibleColumns.min ? (
                  <th className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('min')}
                      className="inline-flex items-center gap-1 hover:text-white"
                      title="Сортувати за мін. ціною"
                    >
                      {t('col_min_price')}
                      <span className="text-[10px] opacity-80">{sortArrow('min')}</span>
                    </button>
                  </th>
                  ) : null}
                  {visibleColumns.max ? (
                  <th className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('max')}
                      className="inline-flex items-center gap-1 hover:text-white"
                      title="Сортувати за макс. ціною"
                    >
                      {t('col_max_price')}
                      <span className="text-[10px] opacity-80">{sortArrow('max')}</span>
                    </button>
                  </th>
                  ) : null}
                  {visibleColumns.current ? (
                  <th className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('current')}
                      className="inline-flex items-center gap-1 hover:text-white"
                      title="Сортувати за поточною ціною"
                    >
                      {t('col_current_price')}
                      <span className="text-[10px] opacity-80">{sortArrow('current')}</span>
                    </button>
                  </th>
                  ) : null}
                  {visibleColumns.percent ? (
                  <th className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('percent')}
                      className="inline-flex items-center gap-1 hover:text-white"
                      title="Сортувати за відсотком"
                    >
                      %
                      <span className="text-[10px] opacity-80">{sortArrow('percent')}</span>
                    </button>
                  </th>
                  ) : null}
                  {visibleColumns.actions ? (
                    <th className="px-3 py-2 text-right">{t('col_actions')}</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const rowKey = `${activeBuyerPage.page.url}::${row.productName}`;
                  const watchRule = buyerRuleMap.get(rowKey) ?? null;
                  const isFavorite = favoriteBuyerKeys.includes(rowKey);
                  const isMutedNotifications = buyerMutedNotificationKeys.includes(rowKey);
                  const isMetalDetector = isMetalDetectorItem(row.productName);
                  const isNotificationTarget =
                    Boolean(highlightedProductName) &&
                    row.productName.trim().toLowerCase() ===
                      highlightedProductName?.trim().toLowerCase();
                  const qty = buyerCalcQuantities[rowKey] ?? 0;
                  const rowTotal = row.currentPrice != null ? row.currentPrice * qty : null;
                  const effectivePercent = deriveBuyerPercent(row);

                  return (
                    <tr
                      key={`${row.snapshotId}-${row.rowIndex}`}
                      className={`border-t border-slate-800 ${rowColor(effectivePercent)} ${
                        isNotificationTarget
                          ? 'ring-2 ring-inset ring-amber-400/80 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.45)]'
                          : isMetalDetector
                            ? 'ring-1 ring-inset ring-cyan-700/50'
                            : ''
                      }`}
                    >
                      {visibleColumns.product ? (
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium">{row.productName}</div>
                          {isNotificationTarget ? (
                            <span className="rounded-full border border-amber-500/50 bg-amber-950/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200">
                              зі сповіщення
                            </span>
                          ) : null}
                          {isMetalDetector ? (
                            <span className="rounded-full border border-cyan-500/40 bg-cyan-950/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-cyan-200">
                              Металошукач
                            </span>
                          ) : null}
                          {isMutedNotifications ? (
                            <span className="rounded-full border border-rose-500/40 bg-rose-950/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-rose-200">
                              Без сповіщень
                            </span>
                          ) : null}
                        </div>
                        {watchRule?.enabled ? (
                          <div className="text-xs text-orange-300">
                            {t('tracking_label')}: {watchRule.condition === 'gte' ? '>=' : '<='}{' '}
                            {watchRule.priceThreshold ?? '—'}$
                            {watchRule.percentThreshold != null
                              ? `, % >= ${watchRule.percentThreshold}`
                              : ''}
                          </div>
                        ) : null}
                      </td>
                      ) : null}
                      {visibleColumns.min ? (
                        <td className="px-3 py-2 text-right">{fmtMoney(row.minPrice)}</td>
                      ) : null}
                      {visibleColumns.max ? (
                        <td className="px-3 py-2 text-right">{fmtMoney(row.maxPrice)}</td>
                      ) : null}
                      {visibleColumns.current ? (
                      <td className="px-3 py-2 text-right font-semibold text-white">
                        {fmtMoney(row.currentPrice)}
                      </td>
                      ) : null}
                      {visibleColumns.percent ? (
                        <td className="px-3 py-2 text-right">{fmtPercent(effectivePercent)}</td>
                      ) : null}
                      {visibleColumns.actions ? (
                      <td className="px-3 py-2 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <div className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-950 px-1 py-1">
                            <IconActionButton
                              onClick={() => onAdjustBuyerCalcQuantity(activeBuyerPage.page.url, row.productName, -1)}
                              tooltip="Зменшити кількість"
                              showPopover={false}
                              className="rounded border border-slate-700 px-1.5 py-0.5 text-xs text-slate-300 hover:bg-slate-800"
                            >
                              -
                            </IconActionButton>
                            <input
                              type="number"
                              min={0}
                              value={qty}
                              onChange={(e) =>
                                onSetBuyerCalcQuantity(
                                  activeBuyerPage.page.url,
                                  row.productName,
                                  Number(e.target.value)
                                )
                              }
                              className="w-14 rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-center text-xs text-slate-100"
                              title="Кількість"
                            />
                            <IconActionButton
                              onClick={() => onAdjustBuyerCalcQuantity(activeBuyerPage.page.url, row.productName, 1)}
                              tooltip="Збільшити кількість"
                              showPopover={false}
                              className="rounded border border-slate-700 px-1.5 py-0.5 text-xs text-slate-300 hover:bg-slate-800"
                            >
                              +
                            </IconActionButton>
                            <span className="ml-1 min-w-[72px] text-right text-[11px] text-slate-300">
                              {rowTotal != null ? fmtMoney(rowTotal) : '—'}
                            </span>
                          </div>

                          <IconActionButton
                            onClick={() => onToggleBuyerNotificationsMuted(activeBuyerPage.page.url, row.productName)}
                            tooltip={
                              isMutedNotifications
                                ? 'Увімкнути сповіщення для товару'
                                : 'Заборонити сповіщення для товару'
                            }
                            showPopover={false}
                            className={
                              isMutedNotifications
                                ? 'rounded-md border border-rose-400 px-2 py-1 text-xs text-rose-300 hover:bg-rose-400/10'
                                : 'rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800'
                            }
                          >
                            ⊘
                          </IconActionButton>

                          <IconActionButton
                            onClick={() => onToggleFavoriteBuyer(activeBuyerPage.page.url, row.productName)}
                            tooltip={isFavorite ? 'Прибрати з обраного' : 'Додати в обране'}
                            showPopover={false}
                            className={
                              isFavorite
                                ? 'rounded-md border border-amber-400 px-2 py-1 text-xs text-amber-300 hover:bg-amber-400/10'
                                : 'rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800'
                            }
                          >
                            {isFavorite ? '★' : '☆'}
                          </IconActionButton>

                          <IconActionButton
                            onClick={() => onOpenBuyerRule(activeBuyerPage, row)}
                            tooltip={watchRule ? t('configure') : t('track')}
                            showPopover={false}
                            className="rounded-md border border-orange-400 px-2 py-1 text-xs text-orange-300 hover:bg-orange-400/10"
                          >
                            {watchRule ? '⚙' : '🔔'}
                          </IconActionButton>
                        </div>
                      </td>
                      ) : null}
                    </tr>
                  );
                })}
                {!filteredRows.length ? (
                  <tr>
                    <td colSpan={visibleColumnCount} className="px-3 py-6 text-center text-slate-400">
                      {t('no_rows_for_buyer')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
type EventsPanelProps = {
  t: TFn;
  loading: boolean;
  clockNow: Date;
  eventsFetchedAt: string | null;
  eventSchedules: EventScheduleRecord[];
  highlightedEventKey: string | null;
  eventRuleMap: Map<string, EventWatchRule>;
  expandedEvents: Record<string, boolean>;
  onSyncScheduleNow: () => void;
  onToggleExpanded: (eventKey: string) => void;
  onReorderEvent: (draggedEventKey: string, targetEventKey: string) => void;
  onOpenEventRule: (event: EventScheduleRecord) => void;
};

export function EventsPanel({
  t,
  loading,
  clockNow,
  eventsFetchedAt,
  eventSchedules,
  highlightedEventKey,
  eventRuleMap,
  expandedEvents,
  onSyncScheduleNow,
  onToggleExpanded,
  onReorderEvent,
  onOpenEventRule
}: EventsPanelProps) {
  const [draggingEventKey, setDraggingEventKey] = useState<string | null>(null);
  const [dragOverEventKey, setDragOverEventKey] = useState<string | null>(null);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onSyncScheduleNow}
          disabled={loading}
          className="rounded-lg border border-orange-500 px-4 py-2 text-sm text-orange-300 disabled:opacity-60"
          title={t('sync_now_optional_title')}
        >
          {loading ? t('sync_events_loading') : t('sync_events_optional')}
        </button>
        <span className="text-xs text-slate-400">{t('events_auto_sync_note')}</span>
      </div>

      <div className="mb-4 rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded px-2 py-1 text-xs text-slate-200">
            {t('last_events_schedule_update')}:
          </span>
          <span className="rounded bg-slate-900 px-2 py-1 text-xs text-slate-300">
            {eventsFetchedAt ? new Date(eventsFetchedAt).toLocaleString('uk-UA') : '—'}
          </span>
        </div>
        <div className="mt-2 text-xs text-slate-400">{t('events_local_time_note')}</div>
      </div>

      {!eventSchedules.length ? (
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
          {t('no_events_schedule')}
        </div>
      ) : null}

      <div className="space-y-4">
        {eventSchedules.map((event) => {
          const activeSlot = getActiveSlot(event.slots, clockNow);
          const nextOccurrence = getNextSlotOccurrence(event.slots, clockNow);
          const watchRule = eventRuleMap.get(event.eventKey) ?? null;

          const isDragOver = dragOverEventKey === event.eventKey && draggingEventKey !== event.eventKey;
          const isNotificationTarget = highlightedEventKey === event.eventKey;

          return (
            <article
              key={event.eventKey}
              onDragEnd={() => {
                setDraggingEventKey(null);
                setDragOverEventKey(null);
              }}
              onDragOver={(e) => {
                e?.preventDefault?.();
                if (dragOverEventKey !== event.eventKey) setDragOverEventKey(event.eventKey);
                e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(e) => {
                e?.preventDefault?.();
                const dragged = e.dataTransfer.getData('text/plain') || draggingEventKey;
                if (dragged && dragged !== event.eventKey) {
                  onReorderEvent(dragged, event.eventKey);
                }
                setDraggingEventKey(null);
                setDragOverEventKey(null);
              }}
              className={`rounded-xl border bg-slate-950 p-4 transition-colors ${
                isNotificationTarget
                  ? 'border-amber-400/70 ring-2 ring-amber-500/30'
                  : isDragOver
                  ? 'border-blue-500/60 ring-1 ring-inset ring-blue-500/40'
                  : 'border-slate-800'
              } ${draggingEventKey === event.eventKey ? 'opacity-70' : ''}`}
            >
              <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <IconActionButton
                      draggable
                      onDragStart={(e) => {
                        setDraggingEventKey(event.eventKey);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', event.eventKey);
                      }}
                      onDragEnd={() => {
                        setDraggingEventKey(null);
                        setDragOverEventKey(null);
                      }}
                      tooltip="Перетягни для сортування"
                      showPopover={false}
                      className="cursor-grab rounded border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 active:cursor-grabbing"
                    >
                      ⋮⋮
                    </IconActionButton>
                    <h2 className="text-xl font-semibold">{event.eventName}</h2>
                    {isNotificationTarget ? (
                      <span className="rounded-full border border-amber-500/50 bg-amber-950/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200">
                        зі сповіщення
                      </span>
                    ) : null}
                  </div>
                  {event.note ? <p className="mt-1 text-sm text-slate-400">{event.note}</p> : null}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded bg-slate-900 px-2 py-1 text-slate-200">
                      {t('current_slot')}: {activeSlot ? activeSlot.label : t('current_slot_inactive')}
                    </span>
                    <span className="rounded bg-slate-900 px-2 py-1 text-slate-300">
                      {t('next_slot')}:{' '}
                      {nextOccurrence
                        ? `${nextOccurrence.slot.label} (${formatTimeOnly(nextOccurrence.startAt)})`
                        : '—'}
                    </span>
                    <span className="rounded bg-slate-900 px-2 py-1 text-slate-300">
                      {t('until_next')}:{' '}
                      {nextOccurrence ? formatCountdown(nextOccurrence.startAt, clockNow, t) : '—'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-start gap-2 md:items-end">
                  {watchRule?.enabled ? (
                    <div className="rounded-md border border-orange-500/40 bg-orange-950/20 px-3 py-2 text-xs text-orange-200">
                      {t('alerts_summary', {
                        minutes: watchRule.leadMinutes,
                        style: watchRule.notificationStyle
                      })}
                    </div>
                  ) : (
                    <div className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-400">
                      {t('alerts_disabled')}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenEventRule(event)}
                    className="rounded-md border border-orange-400 px-3 py-1 text-xs text-orange-300 hover:bg-orange-400/10"
                  >
                    {watchRule ? t('configure_alert') : t('track_event')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleExpanded(event.eventKey)}
                    className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
                  >
                    {expandedEvents[event.eventKey] ? t('hide_schedule') : t('show_schedule')}
                  </button>
                </div>
              </div>

              {expandedEvents[event.eventKey] ? (
                <div className="flex flex-wrap gap-2">
                  {event.slots.map((slot) => {
                    const nextSlotLabel = nextOccurrence?.slot.label ?? null;
                    const isActiveLocal = activeSlot?.label === slot.label;
                    const isNext = !isActiveLocal && nextSlotLabel === slot.label;
                    const visualState = getEventSlotVisualState(slot, clockNow, isActiveLocal, isNext);

                    return (
                      <span
                        key={`${event.eventKey}-${slot.label}`}
                        className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-sm ${slotButtonClass(
                          visualState
                        )}`}
                        title={`${t('site_status')}: ${slot.siteStatus}`}
                      >
                        {slot.siteStatus === 'started' ? (
                          <span className="inline-block h-2 w-2 rounded-full bg-emerald-300" />
                        ) : slot.siteStatus === 'not-started' ? (
                          <span className="inline-block h-2 w-2 rounded-full bg-blue-300" />
                        ) : (
                          <span className="inline-block h-2 w-2 rounded-full bg-slate-500" />
                        )}
                        {slot.label}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-400">
                  {t('schedule_hidden')}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

type BuyerRuleModalProps = {
  t: TFn;
  buyerEditor: BuyerRuleEditorState;
  buyerRuleEnabled: boolean;
  buyerRuleCondition: BuyerWatchCondition;
  buyerRulePriceThreshold: string;
  buyerRulePercentThreshold: string;
  setBuyerRuleEnabled: (value: boolean) => void;
  setBuyerRuleCondition: (value: BuyerWatchCondition) => void;
  setBuyerRulePriceThreshold: (value: string) => void;
  setBuyerRulePercentThreshold: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
};

export function BuyerRuleModal(props: BuyerRuleModalProps) {
  const {
    t,
    buyerEditor,
    buyerRuleEnabled,
    buyerRuleCondition,
    buyerRulePriceThreshold,
    buyerRulePercentThreshold,
    setBuyerRuleEnabled,
    setBuyerRuleCondition,
    setBuyerRulePriceThreshold,
    setBuyerRulePercentThreshold,
    onClose,
    onSave
  } = props;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{t('buyer_rule_title')}</h2>
            <p className="text-sm text-slate-400">
              {buyerEditor.pageTitle} • {buyerEditor.productName}
            </p>
            <p className="text-xs text-slate-500">
              {t('current_price_label')}: {fmtMoney(buyerEditor.currentPrice)} •{' '}
              {fmtPercent(buyerEditor.percentValue)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 px-2 py-1 text-sm"
          >
            {t('close')}
          </button>
        </div>

        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={buyerRuleEnabled}
              onChange={(e) => setBuyerRuleEnabled(e.target.checked)}
            />
            <span className="text-sm">{t('enable_item_tracking')}</span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">{t('condition_by_price')}</span>
              <select
                value={buyerRuleCondition}
                onChange={(e) => setBuyerRuleCondition(e.target.value as BuyerWatchCondition)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              >
                <option value="gte">{t('condition_gte')}</option>
                <option value="lte">{t('condition_lte')}</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">{t('price_amount_label')}</span>
              <input
                type="number"
                min={0}
                step="1"
                value={buyerRulePriceThreshold}
                onChange={(e) => setBuyerRulePriceThreshold(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                placeholder={t('placeholder_example_800')}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">{t('optional_min_percent')}</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={buyerRulePercentThreshold}
              onChange={(e) => setBuyerRulePercentThreshold(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              placeholder={t('placeholder_example_95')}
            />
          </label>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-lg bg-orange-500 px-4 py-2 font-medium text-slate-950"
          >
            {t('save_rule')}
          </button>
        </div>
      </div>
    </div>
  );
}

type EventRuleModalProps = {
  t: TFn;
  eventEditor: EventRuleEditorState;
  eventRuleEnabled: boolean;
  eventLeadMinutes: 2 | 5 | 10 | 15;
  eventNotificationStyle: EventNotificationStyle;
  setEventRuleEnabled: (value: boolean) => void;
  setEventLeadMinutes: (value: 2 | 5 | 10 | 15) => void;
  setEventNotificationStyle: (value: EventNotificationStyle) => void;
  onClose: () => void;
  onSave: () => void;
};

export function EventRuleModal(props: EventRuleModalProps) {
  const {
    t,
    eventEditor,
    eventRuleEnabled,
    eventLeadMinutes,
    eventNotificationStyle,
    setEventRuleEnabled,
    setEventLeadMinutes,
    setEventNotificationStyle,
    onClose,
    onSave
  } = props;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{t('event_alert_title')}</h2>
            <p className="text-sm text-slate-400">{eventEditor.event.eventName}</p>
            <p className="text-xs text-slate-500">{t('event_alert_subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 px-2 py-1 text-sm"
          >
            {t('close')}
          </button>
        </div>

        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={eventRuleEnabled}
              onChange={(e) => setEventRuleEnabled(e.target.checked)}
            />
            <span className="text-sm">{t('track_this_event')}</span>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">{t('alert_before_start_label')}</span>
            <select
              value={String(eventLeadMinutes)}
              onChange={(e) => setEventLeadMinutes(Number(e.target.value) as 2 | 5 | 10 | 15)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            >
              <option value="2">{t('minutes_option', { minutes: 2 })}</option>
              <option value="5">{t('minutes_option', { minutes: 5 })}</option>
              <option value="10">{t('minutes_option', { minutes: 10 })}</option>
              <option value="15">{t('minutes_option', { minutes: 15 })}</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">{t('notification_type')}</span>
            <select
              value={eventNotificationStyle}
              onChange={(e) => setEventNotificationStyle(e.target.value as EventNotificationStyle)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            >
              <option value="standard">{t('notification_standard')}</option>
              <option value="important">{t('notification_important')}</option>
              <option value="compact">{t('notification_compact')}</option>
            </select>
          </label>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-lg bg-orange-500 px-4 py-2 font-medium text-slate-950"
          >
            {t('save_event_alert')}
          </button>
        </div>
      </div>
    </div>
  );
}





