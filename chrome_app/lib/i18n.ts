type LocaleCode = 'uk' | 'en';
type Namespace = 'dashboard';

type Dictionary = Record<string, string>;

const dictionaries: Record<LocaleCode, Record<Namespace, Dictionary>> = {
  uk: {
    dashboard: {
      countdown_now: 'зараз',
      countdown_hours_minutes: '{hours} год {minutes} хв',
      countdown_minutes: '{minutes} хв',
      error_auto_refresh: 'Помилка автооновлення',
      error_load: 'Помилка завантаження',
      error_refresh: 'Помилка оновлення',
      error_start_sync: 'Помилка запуску синхронізації',
      error_events_schedule_refresh: 'Помилка оновлення розкладу івентів',
      title_description: 'Скупники та Івенти: локальні дані з IndexedDB + правила сповіщень.',
      open_quantfun: 'Відкрити QuantFun',
      local_time: 'Локальний час',
      tab_buyers: 'Скупники',
      tab_events: 'Івенти',
      sync_buyers_loading: 'Синхронізація...',
      sync_buyers_now: 'Синхронізувати скупників',
      refresh_ui: 'Оновити UI',
      no_buyers_data: 'Даних ще немає. Натисни `Синхронізувати скупників`.',
      page_label: 'Сторінка',
      last_price_update: 'Останнє оновлення цін',
      next_price_update: 'Наступне оновлення',
      fetched_at: 'Зчитано',
      col_product: 'Товар',
      col_min_price: 'Мін. ціна',
      col_max_price: 'Макс. ціна',
      col_current_price: 'Поточна ціна',
      col_actions: 'Дії',
      tracking_label: 'Відстеження',
      configure: 'Налаштувати',
      track: 'Відстежувати',
      no_rows_for_buyer: 'Для цього скупника ще немає рядків. Запусти синхронізацію.',
      sync_now_optional_title: 'Резервне ручне оновлення, якщо треба примусово.',
      sync_events_loading: 'Оновлення...',
      sync_events_optional: 'Оновити зараз (опц.)',
      events_auto_sync_note: 'Розклад оновлюється автоматично у фоні (рідко) і зберігається локально.',
      last_events_schedule_update: 'Останнє оновлення розкладу',
      events_local_time_note:
        'Попередження працюють по локальному часу комп’ютера, навіть якщо розклад парситься нечасто.',
      no_events_schedule: 'Розклад івентів ще не завантажений. Натисни `Оновити розклад івентів`.',
      current_slot: 'Зараз',
      current_slot_inactive: 'не активний',
      next_slot: 'Наступний',
      until_next: 'До наступного',
      alerts_summary: 'Попередження: за {minutes} хв • {style}',
      alerts_disabled: 'Попередження вимкнено',
      configure_alert: 'Налаштувати попередження',
      track_event: 'Відслідковувати івент',
      hide_schedule: 'Сховати розклад',
      show_schedule: 'Показати розклад',
      site_status: 'Статус на сайті',
      schedule_hidden: 'Розклад слотів приховано. Натисни `Показати розклад`.',
      buyer_rule_title: 'Відстеження товару',
      current_price_label: 'Поточна ціна',
      close: 'Закрити',
      enable_item_tracking: 'Увімкнути відстеження для цього товару',
      condition_by_price: 'Умова по ціні',
      condition_gte: 'Поточна ціна >= сума',
      condition_lte: 'Поточна ціна <= сума',
      price_amount_label: 'Сума (ціна), $',
      placeholder_example_800: 'Напр. 800',
      optional_min_percent: 'Додатково: мінімальний % (необов’язково)',
      placeholder_example_95: 'Напр. 95',
      cancel: 'Скасувати',
      error_save_rule: 'Помилка збереження правила',
      save_rule: 'Зберегти правило',
      event_alert_title: 'Попередження по івенту',
      event_alert_subtitle:
        'Вибери, за скільки хвилин попереджати до початку наступного слоту.',
      track_this_event: 'Відслідковувати цей івент',
      alert_before_start_label: 'Попередити за скільки хвилин до початку',
      minutes_option: '{minutes} хв',
      notification_type: 'Тип попередження',
      notification_standard: 'Стандартне',
      notification_important: 'Важливе',
      notification_compact: 'Коротке',
      error_save_event_alert: 'Помилка збереження попередження',
      save_event_alert: 'Зберегти попередження'
    }
  },
  en: {
    dashboard: {
      countdown_now: 'now',
      countdown_hours_minutes: '{hours}h {minutes}m',
      countdown_minutes: '{minutes}m',
      error_auto_refresh: 'Auto-refresh error',
      error_load: 'Load error',
      error_refresh: 'Refresh error',
      error_start_sync: 'Failed to start sync',
      error_events_schedule_refresh: 'Failed to refresh events schedule',
      title_description: 'Buyers and Events: local IndexedDB data + notification rules.',
      open_quantfun: 'Open QuantFun',
      local_time: 'Local time',
      tab_buyers: 'Buyers',
      tab_events: 'Events',
      sync_buyers_loading: 'Syncing...',
      sync_buyers_now: 'Sync buyers',
      refresh_ui: 'Refresh UI',
      no_buyers_data: 'No data yet. Click `Sync buyers`.',
      page_label: 'Page',
      last_price_update: 'Last price update',
      next_price_update: 'Next update',
      fetched_at: 'Fetched',
      col_product: 'Product',
      col_min_price: 'Min price',
      col_max_price: 'Max price',
      col_current_price: 'Current price',
      col_actions: 'Actions',
      tracking_label: 'Tracking',
      configure: 'Configure',
      track: 'Track',
      no_rows_for_buyer: 'No rows saved for this buyer yet. Run sync.',
      sync_now_optional_title: 'Manual fallback refresh if you need to force update.',
      sync_events_loading: 'Updating...',
      sync_events_optional: 'Update now (opt.)',
      events_auto_sync_note: 'Schedule auto-refreshes in background (rarely) and is stored locally.',
      last_events_schedule_update: 'Last schedule update',
      events_local_time_note:
        'Notifications use your local computer time even if schedule parsing is infrequent.',
      no_events_schedule: 'Events schedule is not loaded yet. Click `Update events schedule`.',
      current_slot: 'Current',
      current_slot_inactive: 'inactive',
      next_slot: 'Next',
      until_next: 'Until next',
      alerts_summary: 'Alerts: {minutes} min before • {style}',
      alerts_disabled: 'Alerts disabled',
      configure_alert: 'Configure alert',
      track_event: 'Track event',
      hide_schedule: 'Hide schedule',
      show_schedule: 'Show schedule',
      site_status: 'Site status',
      schedule_hidden: 'Schedule slots are hidden. Click `Show schedule`.',
      buyer_rule_title: 'Item tracking',
      current_price_label: 'Current price',
      close: 'Close',
      enable_item_tracking: 'Enable tracking for this item',
      condition_by_price: 'Price condition',
      condition_gte: 'Current price >= amount',
      condition_lte: 'Current price <= amount',
      price_amount_label: 'Amount (price), $',
      placeholder_example_800: 'e.g. 800',
      optional_min_percent: 'Optional: minimum %',
      placeholder_example_95: 'e.g. 95',
      cancel: 'Cancel',
      error_save_rule: 'Failed to save rule',
      save_rule: 'Save rule',
      event_alert_title: 'Event alert',
      event_alert_subtitle: 'Choose how many minutes before start to notify.',
      track_this_event: 'Track this event',
      alert_before_start_label: 'Notify before start',
      minutes_option: '{minutes} min',
      notification_type: 'Notification type',
      notification_standard: 'Standard',
      notification_important: 'Important',
      notification_compact: 'Compact',
      error_save_event_alert: 'Failed to save alert',
      save_event_alert: 'Save alert'
    }
  }
};

function resolveLocale(): LocaleCode {
  const lang =
    (typeof navigator !== 'undefined' ? navigator.language : 'uk').toLowerCase();
  if (lang.startsWith('en')) return 'en';
  return 'uk';
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : `{${key}}`
  );
}

export function createTranslator(namespace: Namespace) {
  return (key: string, vars?: Record<string, string | number>) => {
    const locale = resolveLocale();
    const localized =
      dictionaries[locale][namespace][key] ??
      dictionaries.uk[namespace][key] ??
      key;
    return interpolate(localized, vars);
  };
}

