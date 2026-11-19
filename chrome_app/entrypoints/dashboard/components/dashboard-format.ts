import type { TFn, EventSlotVisualState } from './dashboard-types';

export function fmtMoney(value: number | null) {
  return value == null ? '—' : `${value.toLocaleString('uk-UA')} $`;
}

export function fmtPercent(value: number | null) {
  return value == null ? '—' : `${value.toLocaleString('uk-UA', { maximumFractionDigits: 2 })} %`;
}

export function rowColor(percentValue: number | null): string {
  if (percentValue == null) return 'bg-slate-900';
  if (percentValue >= 95) return 'bg-emerald-950/30';
  if (percentValue >= 80) return 'bg-amber-950/30';
  return 'bg-rose-950/30';
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

export function slotButtonClass(state: EventSlotVisualState) {
  if (state === 'active') return 'bg-emerald-600 text-white border-emerald-500 shadow-sm shadow-emerald-500/20';
  if (state === 'next') return 'bg-blue-600 text-white border-blue-500 shadow-sm shadow-blue-500/20';
  if (state === 'past') return 'bg-slate-950/40 text-slate-500 border-slate-800 opacity-75';
  return 'bg-slate-950 text-slate-200 border-slate-700';
}
