import { useState } from 'react';
import { getActiveSlot, getNextSlotOccurrence } from '../../../lib/events-time';
import type { EventScheduleRecord, EventWatchRule } from '../../../lib/types';
import type { TFn, EventSlotVisualState } from './dashboard-types';
import { formatCountdown, formatTimeOnly, slotButtonClass } from './dashboard-format';
import { IconActionButton } from './icon-action-button';

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
