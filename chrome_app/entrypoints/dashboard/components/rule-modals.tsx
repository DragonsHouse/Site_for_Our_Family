import type { BuyerWatchCondition, EventNotificationStyle } from '../../../lib/types';
import type { TFn, BuyerRuleEditorState, EventRuleEditorState } from './dashboard-types';
import { fmtMoney, fmtPercent } from './dashboard-format';

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
