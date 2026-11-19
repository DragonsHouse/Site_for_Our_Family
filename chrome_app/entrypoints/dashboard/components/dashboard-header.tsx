import type { TFn } from './dashboard-types';

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
