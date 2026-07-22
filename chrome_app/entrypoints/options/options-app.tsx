import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getBuyerPagesLatestData } from '../../lib/db';
import { getSettings, saveSettings } from '../../lib/storage';
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type BuyerPageLatestData,
  type PopupSectionsConfig
} from '../../lib/types';

function inputClassName() {
  return 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-orange-400/30 focus:ring';
}

function HelpTip({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-600 text-[11px] text-slate-300 hover:border-slate-500 hover:text-white"
        aria-label={`Пояснення: ${title}`}
      >
        ?
      </button>
      {open ? (
        <div className="absolute left-0 top-7 z-20 w-72 rounded-xl border border-slate-700 bg-slate-950 p-3 text-left shadow-2xl shadow-black/50">
          <div className="mb-1 text-xs font-semibold text-slate-100">{title}</div>
          <div className="text-xs leading-5 text-slate-300">{children}</div>
        </div>
      ) : null}
    </span>
  );
}

function LabelWithHelp({
  label,
  hint,
  helpTitle,
  helpText
}: {
  label: string;
  hint?: string;
  helpTitle?: string;
  helpText?: ReactNode;
}) {
  return (
    <div className="mb-1">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-200">{label}</span>
        {helpTitle && helpText ? <HelpTip title={helpTitle}>{helpText}</HelpTip> : null}
      </div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
  helpTitle,
  helpText
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  helpTitle?: string;
  helpText?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-slate-100">{title}</h2>
        {helpTitle && helpText ? <HelpTip title={helpTitle}>{helpText}</HelpTip> : null}
      </div>
      {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function OptionsApp() {
  const [keyword, setKeyword] = useState(DEFAULT_SETTINGS.keyword);
  const [minNumbersFound, setMinNumbersFound] = useState(DEFAULT_SETTINGS.minNumbersFound);
  const [notificationEnabled, setNotificationEnabled] = useState(DEFAULT_SETTINGS.notificationEnabled);
  const [pollingEnabled, setPollingEnabled] = useState(DEFAULT_SETTINGS.pollingEnabled);
  const [pollIntervalMinutes, setPollIntervalMinutes] = useState(
    DEFAULT_SETTINGS.pollIntervalMinutes
  );
  const [buyerSeedUrl, setBuyerSeedUrl] = useState(DEFAULT_SETTINGS.buyerSeedUrl);
  const [buyerAlertPercentMin, setBuyerAlertPercentMin] = useState(
    DEFAULT_SETTINGS.buyerAlertPercentMin
  );
  const [buyerMutedNotificationKeys, setBuyerMutedNotificationKeys] = useState<string[]>(
    DEFAULT_SETTINGS.buyerMutedNotificationKeys
  );
  const [popupSections, setPopupSections] = useState<PopupSectionsConfig>(
    DEFAULT_SETTINGS.popupSections
  );
  const [popupBuyerTopSort, setPopupBuyerTopSort] = useState(DEFAULT_SETTINGS.popupBuyerTopSort);
  const [popupBuyerTopCount, setPopupBuyerTopCount] = useState(DEFAULT_SETTINGS.popupBuyerTopCount);
  const [popupBuyerShowTrackedList, setPopupBuyerShowTrackedList] = useState(
    DEFAULT_SETTINGS.popupBuyerShowTrackedList
  );
  const [popupBuyerAllowedPageUrls, setPopupBuyerAllowedPageUrls] = useState<string[]>(
    DEFAULT_SETTINGS.popupBuyerAllowedPageUrls
  );
  const [popupBuyerAllowedProductKeys, setPopupBuyerAllowedProductKeys] = useState<string[]>(
    DEFAULT_SETTINGS.popupBuyerAllowedProductKeys
  );
  const [popupBuyerFilterSearch, setPopupBuyerFilterSearch] = useState('');
  const [popupBuyerProductsCategoryFilter, setPopupBuyerProductsCategoryFilter] = useState('__all__');
  const [buyerPagesLatestData, setBuyerPagesLatestData] = useState<BuyerPageLatestData[]>([]);
  const [dashboardShowBackgroundService, setDashboardShowBackgroundService] = useState(
    DEFAULT_SETTINGS.dashboardShowBackgroundService
  );
  const [status, setStatus] = useState('Завантаження...');

  const hydratedRef = useRef(false);
  const saveSeqRef = useRef(0);

  useEffect(() => {
    void getSettings().then((settings) => {
      setKeyword(settings.keyword);
      setMinNumbersFound(settings.minNumbersFound);
      setNotificationEnabled(settings.notificationEnabled);
      setPollingEnabled(settings.pollingEnabled);
      setPollIntervalMinutes(settings.pollIntervalMinutes);
      setBuyerSeedUrl(settings.buyerSeedUrl);
      setBuyerAlertPercentMin(settings.buyerAlertPercentMin);
      setBuyerMutedNotificationKeys(settings.buyerMutedNotificationKeys ?? []);
      setPopupSections(settings.popupSections);
      setPopupBuyerTopSort(settings.popupBuyerTopSort);
      setPopupBuyerTopCount(settings.popupBuyerTopCount);
      setPopupBuyerShowTrackedList(settings.popupBuyerShowTrackedList);
      setPopupBuyerAllowedPageUrls(settings.popupBuyerAllowedPageUrls ?? []);
      setPopupBuyerAllowedProductKeys(settings.popupBuyerAllowedProductKeys ?? []);
      setDashboardShowBackgroundService(settings.dashboardShowBackgroundService);
      hydratedRef.current = true;
      setStatus('Автозбереження увімкнено');
    });
    void getBuyerPagesLatestData().then(setBuyerPagesLatestData).catch(() => {
      setBuyerPagesLatestData([]);
    });
  }, []);

  const normalizedSettings = useMemo<AppSettings>(
    () => ({
      keyword,
      minNumbersFound: Math.max(0, Number(minNumbersFound) || 0),
      notificationEnabled,
      pollingEnabled,
      pollIntervalMinutes: Math.max(1, Number(pollIntervalMinutes) || 1),
      buyerSeedUrl: buyerSeedUrl.trim(),
      buyerAlertPercentMin: Math.max(0, Number(buyerAlertPercentMin) || 0),
      buyerMutedNotificationKeys,
      popupSections,
      popupBuyerTopSort,
      popupBuyerTopCount: Math.max(1, Number(popupBuyerTopCount) || 5),
      popupBuyerShowTrackedList,
      popupBuyerAllowedPageUrls,
      popupBuyerAllowedProductKeys,
      dashboardShowBackgroundService
    }),
    [
      keyword,
      minNumbersFound,
      notificationEnabled,
      pollingEnabled,
      pollIntervalMinutes,
      buyerSeedUrl,
      buyerAlertPercentMin,
      buyerMutedNotificationKeys,
      popupSections,
      popupBuyerTopSort,
      popupBuyerTopCount,
      popupBuyerShowTrackedList,
      popupBuyerAllowedPageUrls,
      popupBuyerAllowedProductKeys,
      dashboardShowBackgroundService
    ]
  );

  useEffect(() => {
    if (!hydratedRef.current) return;

    const seq = ++saveSeqRef.current;
    setStatus('Збереження...');

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          await saveSettings(normalizedSettings);
          await chrome.runtime.sendMessage({ type: 'QUANT_REFRESH_POLL_SCHEDULE' });
          if (seq === saveSeqRef.current) {
            setStatus(`Збережено автоматично: ${new Date().toLocaleTimeString('uk-UA')}`);
          }
        } catch (err) {
          if (seq === saveSeqRef.current) {
            setStatus(
              `Помилка збереження: ${err instanceof Error ? err.message : 'unknown error'}`
            );
          }
        }
      })();
    }, 450);

    return () => window.clearTimeout(timer);
  }, [normalizedSettings]);

  function togglePopupSection<K extends keyof PopupSectionsConfig>(key: K) {
    setPopupSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const popupBuyerCategoryOptions = useMemo(
    () =>
      buyerPagesLatestData.map((pageData) => ({
        pageUrl: pageData.page.url,
        title: pageData.page.title
      })),
    [buyerPagesLatestData]
  );

  const popupBuyerProductOptions = useMemo(() => {
    const rows = buyerPagesLatestData.flatMap((pageData) =>
      pageData.rows.map((row) => ({
        key: `${pageData.page.url}::${row.productName}`,
        pageUrl: pageData.page.url,
        pageTitle: pageData.page.title,
        productName: row.productName
      }))
    );
    rows.sort((a, b) => {
      const byPage = a.pageTitle.localeCompare(b.pageTitle, 'uk');
      if (byPage !== 0) return byPage;
      return a.productName.localeCompare(b.productName, 'uk');
    });
    return rows;
  }, [buyerPagesLatestData]);

  const filteredPopupBuyerProductOptions = useMemo(() => {
    const q = popupBuyerFilterSearch.trim().toLowerCase();
    return popupBuyerProductOptions.filter((item) => {
      if (
        popupBuyerProductsCategoryFilter !== '__all__' &&
        item.pageUrl !== popupBuyerProductsCategoryFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        item.productName.toLowerCase().includes(q) || item.pageTitle.toLowerCase().includes(q)
      );
    });
  }, [popupBuyerProductOptions, popupBuyerFilterSearch, popupBuyerProductsCategoryFilter]);

  function togglePopupBuyerCategory(pageUrl: string) {
    setPopupBuyerAllowedPageUrls((prev) => {
      const all = popupBuyerCategoryOptions.map((item) => item.pageUrl);
      if (!all.length) return prev;
      const base = prev.length === 0 ? [...all] : [...prev];
      const next = base.includes(pageUrl) ? base.filter((v) => v !== pageUrl) : [...base, pageUrl];
      if (next.length === all.length) return [];
      return next;
    });
  }

  function togglePopupBuyerProduct(productKey: string) {
    setPopupBuyerAllowedProductKeys((prev) => {
      const all = popupBuyerProductOptions.map((item) => item.key);
      if (!all.length) return prev;
      const base = prev.length === 0 ? [...all] : [...prev];
      const next = base.includes(productKey)
        ? base.filter((v) => v !== productKey)
        : [...base, productKey];
      if (next.length === all.length) return [];
      return next;
    });
  }

  const input = inputClassName();

  return (
    <main className="dh-options px-5 py-8 text-slate-100">
      <div className="mx-auto max-w-[1400px]">
        <div className="dh-options-hero mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold">Quant RP Helper - Налаштування</h1>
              <p className="mt-2 max-w-4xl text-sm text-slate-400">
                Сторінка з автозбереженням. Будь-яка зміна зберігається автоматично через коротку
                паузу, без кнопки "Зберегти".
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300" role="status" aria-live="polite">
              {status}
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Card
              title="Фоновий збір скупників"
              subtitle="Налаштування автоматичного polling buyer-сторінок QuantFun"
              helpTitle="Як це працює"
              helpText={
                <>
                  Розширення працює у фоні через <code>chrome.alarms</code>: періодично парсить
                  сторінки скупників, оновлює локальну БД та перевіряє правила сповіщень.
                </>
              }
            >
              <label className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 p-3">
                <input
                  type="checkbox"
                  checked={pollingEnabled}
                  onChange={(e) => setPollingEnabled(e.target.checked)}
                  className="h-4 w-4"
                />
                <span className="text-sm">Увімкнути автопарсинг buyer-сторінок</span>
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <LabelWithHelp
                    label="Інтервал перевірки (хв)"
                    helpTitle="Що це?"
                    helpText="Як часто фонова служба запускає цикл оновлення скупників."
                  />
                  <input
                    type="number"
                    min={1}
                    value={pollIntervalMinutes}
                    onChange={(e) => setPollIntervalMinutes(Number(e.target.value))}
                    className={input}
                  />
                </label>

                <label className="block">
                  <LabelWithHelp
                    label="Поріг сповіщення по % (>=)"
                    helpTitle="Навіщо?"
                    helpText="Якщо рядок товару має відсоток не менший за це значення, може прийти сповіщення (за умови, що сповіщення увімкнені)."
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={buyerAlertPercentMin}
                    onChange={(e) => setBuyerAlertPercentMin(Number(e.target.value))}
                    className={input}
                  />
                </label>
              </div>

              <label className="block">
                <LabelWithHelp
                  label="Стартова сторінка скупників (Seed URL)"
                  hint="З цієї сторінки розширення автоматично збирає посилання на інші вкладки скупників"
                  helpTitle="Що таке Seed URL?"
                  helpText="Це стартова сторінка, з якої розширення бере кнопки/посилання на всі інші скупники (врожаю, грибів, дерева тощо). Тобі не потрібно вручну вносити всі URL."
                />
                <input
                  type="url"
                  value={buyerSeedUrl}
                  onChange={(e) => setBuyerSeedUrl(e.target.value)}
                  className={input}
                  placeholder="https://quantfun.com.ua/server/1/buyer/8/"
                />
              </label>
            </Card>

            <Card
              title="Popup: що показувати"
              subtitle="Керування секціями popup і блоком скупників"
              helpTitle="Що це впливає?"
              helpText="Ці параметри змінюють тільки вигляд popup. На фоновий збір даних та нотифікації вони не впливають."
            >
              <div className="grid gap-2 md:grid-cols-2">
                {(
                  [
                    ['quickActions', 'Швидкі кнопки'],
                    ['buyerSummary', 'Блок "Скупники"'],
                    ['eventsSummary', 'Блок "Івенти"'],
                    ['pollingStatus', 'Блок "Статус"']
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 p-3"
                  >
                    <input
                      type="checkbox"
                      checked={popupSections[key]}
                      onChange={() => togglePopupSection(key)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-100">Блок "Скупники" у popup</h3>
                  <HelpTip title="Як формується список">
                    Розширення бере актуальні рядки з локальної БД. "Топ" формується по всіх
                    категоріях одразу, а "Відстежувані" показує тільки товари, для яких ти створив
                    правило.
                  </HelpTip>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <LabelWithHelp
                      label="Сортування топ-товарів"
                      helpTitle="Варіанти"
                      helpText="За % або за поточною ціною. Це впливає і на список топу, і на порядок відстежуваних товарів у popup."
                    />
                    <select
                      value={popupBuyerTopSort}
                      onChange={(e) =>
                        setPopupBuyerTopSort(e.target.value as typeof popupBuyerTopSort)
                      }
                      className={input}
                    >
                      <option value="percent">За % (спочатку найвищі)</option>
                      <option value="price">За ціною (спочатку найдорожчі)</option>
                    </select>
                  </label>

                  <label className="block">
                    <LabelWithHelp
                      label="Кількість товарів у popup"
                      helpTitle="Навіщо обмеження?"
                      helpText="Щоб popup не був занадто довгим і без зайвого скролу."
                    />
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={popupBuyerTopCount}
                      onChange={(e) => setPopupBuyerTopCount(Number(e.target.value))}
                      className={input}
                    />
                  </label>
                </div>

                <label className="mt-4 flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 p-3">
                  <input
                    type="checkbox"
                    checked={popupBuyerShowTrackedList}
                    onChange={(e) => setPopupBuyerShowTrackedList(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Показувати список "Відстежувані товари"</span>
                </label>                <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900 p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-medium text-slate-100">Фільтр для popup (Скупники)</h4>
                      <p className="text-xs text-slate-400">Додатковий фільтр: якщо нічого не відмічено, popup показує все.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPopupBuyerAllowedPageUrls([]);
                        setPopupBuyerAllowedProductKeys([]);
                        setPopupBuyerFilterSearch('');
                        setPopupBuyerProductsCategoryFilter('__all__');
                      }}
                      className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                    >
                      Скинути
                    </button>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                    <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Категорії скупника</div>
                      {popupBuyerCategoryOptions.length ? (
                        <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                          {popupBuyerCategoryOptions.map((item) => (
                            <label key={item.pageUrl} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-slate-200 hover:bg-slate-900">
                              <input type="checkbox" checked={popupBuyerAllowedPageUrls.length === 0 || popupBuyerAllowedPageUrls.includes(item.pageUrl)} onChange={() => togglePopupBuyerCategory(item.pageUrl)} className="h-4 w-4" />
                              <span className="truncate">{item.title}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">Немає категорій у локальній БД. Зроби sync скупників.</div>
                      )}
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Товари</div>
                        <div className="text-[11px] text-slate-500">{popupBuyerAllowedProductKeys.length ? `Обрано: ${popupBuyerAllowedProductKeys.length}` : 'Всі'}</div>
                      </div>
                      <select
                        value={popupBuyerProductsCategoryFilter}
                        onChange={(e) => setPopupBuyerProductsCategoryFilter(e.target.value)}
                        className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-orange-400/30 focus:ring"
                      >
                        <option value="__all__">Всі категорії</option>
                        {popupBuyerCategoryOptions.map((item) => (
                          <option key={`popup-products-category-${item.pageUrl}`} value={item.pageUrl}>
                            {item.title}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={popupBuyerFilterSearch}
                        onChange={(e) => setPopupBuyerFilterSearch(e.target.value)}
                        className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-orange-400/30 focus:ring"
                        placeholder="Пошук товару/категорії..."
                      />
                      {popupBuyerProductOptions.length ? (
                        <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                          {filteredPopupBuyerProductOptions.map((item) => (
                            <label key={item.key} className="flex items-start gap-2 rounded-md px-2 py-1 hover:bg-slate-900">
                              <input type="checkbox" checked={popupBuyerAllowedProductKeys.length === 0 || popupBuyerAllowedProductKeys.includes(item.key)} onChange={() => togglePopupBuyerProduct(item.key)} className="mt-0.5 h-4 w-4" />
                              <span className="min-w-0 text-xs">
                                <span className="block truncate text-slate-200">{item.productName}</span>
                                <span className="block truncate text-slate-500">{item.pageTitle}</span>
                              </span>
                            </label>
                          ))}
                          {!filteredPopupBuyerProductOptions.length ? (
                            <div className="rounded-md border border-slate-800 px-2 py-2 text-xs text-slate-500">Нічого не знайдено</div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">Немає товарів у локальній БД. Зроби sync скупників.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Card
              title="Dashboard"
              subtitle="Налаштування блоків на сторінці dashboard"
              helpTitle="Що це?"
              helpText="Ці параметри керують відображенням блоків у dashboard розширення."
            >
              <label className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 p-3">
                <input
                  type="checkbox"
                  checked={dashboardShowBackgroundService}
                  onChange={(e) => setDashboardShowBackgroundService(e.target.checked)}
                  className="h-4 w-4"
                />
                <span className="text-sm">Показувати блок "Фонова служба"</span>
              </label>
            </Card>
          </div>

          <div className="space-y-6">
            <Card
              title="Загальні сповіщення"
              subtitle="Базові параметри нотифікацій та ручного сканування"
            >
              <label className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 p-3">
                <input
                  type="checkbox"
                  checked={notificationEnabled}
                  onChange={(e) => setNotificationEnabled(e.target.checked)}
                  className="h-4 w-4"
                />
                <span className="text-sm">Увімкнути браузерні сповіщення</span>
              </label>

              <label className="block">
                <LabelWithHelp
                  label="Keyword для ручного сканування"
                  helpTitle="Де використовується?"
                  helpText="Це поле використовувалось для старого ручного сканування сторінки. Можна залишити порожнім, якщо цей сценарій не використовуєш."
                />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className={input}
                  placeholder="Напр. quant, status, online"
                />
              </label>

              <label className="block">
                <LabelWithHelp
                  label="Мінімальна кількість чисел (ручне сканування)"
                  helpTitle="Де використовується?"
                  helpText="Також стосується тільки ручного сканування сторінки. На скупників/івенти не впливає."
                />
                <input
                  type="number"
                  min={0}
                  value={minNumbersFound}
                  onChange={(e) => setMinNumbersFound(Number(e.target.value))}
                  className={input}
                />
              </label>
            </Card>

            <Card title="Підказка" subtitle="Що зберігається автоматично">
              <ul className="space-y-2 text-sm text-slate-300">
                <li>• Інтервал і параметри фонового polling</li>
                <li>• Seed URL для автозбору вкладок скупників</li>
                <li>• Параметри popup (секції, топ, відстежувані)</li>
                <li>• Базові прапорці сповіщень</li>
              </ul>
              <p className="mt-3 text-xs text-slate-500">
                Зміни зберігаються автоматично після короткої паузи, щоб не робити зайві записи при
                наборі тексту.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}



