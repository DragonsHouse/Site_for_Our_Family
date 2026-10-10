import type { FamilyUser } from '../../../lib/family-types';
import {
  DragonBadge,
  DragonButton,
  DragonCard,
  DragonDialog,
  DragonDivider,
  DragonEmptyState,
  DragonHero,
  DragonInput,
  DragonLoader,
  DragonPanel,
  DragonProgress,
  DragonRetry,
  DragonSection,
  DragonSelect,
  DragonTabs,
  DragonTooltip
} from '../dragon-ui/dragon-ui';
import { getDayTitle, getMonthTitle } from './calendar-date';
import {
  DRAGON_CALENDAR_CATEGORY_META,
  DRAGON_CALENDAR_VIEW_TABS,
  type DragonCalendarCategory,
  type DragonCalendarDay,
  type DragonCalendarEvent,
  type DragonCalendarPriority,
  type DragonCalendarSourceModule
} from './calendar-models';
import { createMockDragonCalendarStateDependencies } from './calendar-composition';
import { useDragonCalendarState } from './calendar-state';
import type { DragonCalendarStateDependencies } from './calendar-state';

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

const PRIORITY_LABEL: Record<DragonCalendarPriority, string> = {
  low: 'низький',
  normal: 'звичайний',
  high: 'важливий',
  critical: 'критичний'
};

const CATEGORY_OPTIONS: Array<{ value: DragonCalendarCategory | 'all'; label: string }> = [
  { value: 'all', label: 'Усі печаті' },
  ...Object.entries(DRAGON_CALENDAR_CATEGORY_META).map(([value, meta]) => ({
    value: value as DragonCalendarCategory,
    label: `${meta.glyph} ${meta.label}`
  }))
];
const SOURCE_OPTIONS: Array<{ value: DragonCalendarSourceModule | 'all'; label: string }> = [
  { value: 'all', label: 'Усі джерела' },
  { value: 'family_events', label: 'Сімейні події' },
  { value: 'tower_defense', label: 'Оборона вишок' },
  { value: 'family_quests', label: 'Сімейні квести' },
  { value: 'birthday', label: 'Дні народження' }
];

function formatEventTime(event: DragonCalendarEvent) {
  if (!event.startTime) {
    return 'цілий день';
  }

  return event.endTime ? `${event.startTime} - ${event.endTime}` : event.startTime;
}

function getDayTooltip(day: DragonCalendarDay) {
  if (!day.events.length) {
    return `${getDayTitle(day.date)}: хроніка порожня`;
  }

  return `${getDayTitle(day.date)}: ${day.events.map((event) => event.title).join(', ')}`;
}

export function DragonCalendar({ currentUser, dependencies }: { currentUser: FamilyUser; dependencies?: DragonCalendarStateDependencies }) {
  const calendar = useDragonCalendarState(dependencies ?? createMockDragonCalendarStateDependencies());
  const title = calendar.view === 'week' ? `Тиждень від ${getDayTitle(calendar.weekDays[0].date)}` : getMonthTitle(calendar.anchorDate);
  const visibleAgendaEvents = calendar.filteredEvents.filter((event) => calendar.view !== 'agenda' || event.date >= calendar.todayKey);

  return (
    <div className="dh-calendar-room">
      <DragonHero
        eyebrow="Хроніки Dragon House"
        title="Календар"
        description="Зал хронік Dragon House: сімейні події, квести, оборона вишок, дні народження й операційні дедлайни в одному календарі."
      >
        <div className="dh-calendar-hero-seals" aria-label="Поточний стан календаря">
          <DragonBadge tone="gold">Сімейний календар</DragonBadge>
          <DragonBadge tone="success">{currentUser.nickname}</DragonBadge>
          <DragonBadge tone="muted">Europe/Kyiv</DragonBadge>
        </div>
      </DragonHero>

      <DragonPanel variant="ceremonial" className="dh-calendar-command-panel">
        <div className="dh-calendar-command-main">
          <p className="dh-dragon-eyebrow">Поточна хроніка</p>
          <h2>{title}</h2>
        </div>
        <div className="dh-calendar-command-actions" aria-label="Навігація календаря">
          <DragonButton type="button" variant="secondary" onClick={calendar.goToPrevious}>
            Попередній
          </DragonButton>
          <DragonButton type="button" onClick={calendar.goToToday}>
            Сьогодні
          </DragonButton>
          <DragonButton type="button" variant="secondary" onClick={calendar.goToNext}>
            Наступний
          </DragonButton>
        </div>
      </DragonPanel>

      {calendar.loading ? <DragonLoader label="Dragon Calendar відкриває хроніки" /> : null}
      {calendar.error ? (
        <DragonRetry title="Хроніки не відкрились" description={calendar.error.message} onRetry={calendar.refresh} />
      ) : null}

      <section className="dh-calendar-stats" aria-label="Швидка статистика Dragon Calendar">
        <DragonCard>
          <span className="dh-dragon-eyebrow">Події</span>
          <strong>{calendar.stats.totalEvents}</strong>
          <p>подій у поточному місяці</p>
          <DragonProgress value={Math.min(calendar.stats.totalEvents * 16, 100)} label="Щільність подій поточного місяця" />
        </DragonCard>
        <DragonCard>
          <span className="dh-dragon-eyebrow">Сімейний календар</span>
          <strong>{calendar.stats.birthdaysThisMonth}</strong>
          <p>днів народження цього місяця</p>
        </DragonCard>
        <DragonCard>
          <span className="dh-dragon-eyebrow">Заплановано</span>
          <strong>{calendar.stats.upcomingEvents}</strong>
          <p>майбутніх печатей</p>
        </DragonCard>
        <DragonCard>
          <span className="dh-dragon-eyebrow">Остання активність</span>
          <strong>{calendar.stats.recentActivity}</strong>
          <p>останній запис у хроніках</p>
        </DragonCard>
      </section>

      <div className="dh-calendar-workbench">
        <DragonSection
          eyebrow="Фільтри хроніки"
          title="Пошук у хроніках"
          description="Фільтри застосовуються до календаря з backend, не змішуючи джерела подій."
        >
          <div className="dh-calendar-filters">
            <label>
              <span>Пошук</span>
              <DragonInput
                value={calendar.filters.search}
                onChange={(event) => calendar.setFilters((filters) => ({ ...filters, search: event.currentTarget.value }))}
                placeholder="Назва, опис або учасник"
                aria-label="Пошук подій"
              />
            </label>
            <label>
              <span>Категорія</span>
              <DragonSelect
                value={calendar.filters.category}
                onChange={(event) => calendar.setFilters((filters) => ({ ...filters, category: event.currentTarget.value as DragonCalendarCategory | 'all' }))}
                aria-label="Фільтр за категорією"
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </DragonSelect>
            </label>
            <label>
              <span>Джерело</span>
              <DragonSelect
                value={calendar.filters.sourceModule}
                onChange={(event) => calendar.setFilters((filters) => ({ ...filters, sourceModule: event.currentTarget.value as DragonCalendarSourceModule | 'all' }))}
                aria-label="Фільтр за джерелом календаря"
              >
                {SOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </DragonSelect>
            </label>
            <label>
              <span>Учасник</span>
              <DragonSelect
                value={calendar.filters.member}
                onChange={(event) => calendar.setFilters((filters) => ({ ...filters, member: event.currentTarget.value }))}
                aria-label="Фільтр за учасником"
              >
                <option value="">Усі учасники</option>
                {calendar.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </DragonSelect>
            </label>
            <label>
              <span>Від</span>
              <DragonInput
                type="date"
                value={calendar.filters.dateFrom}
                onChange={(event) => calendar.setFilters((filters) => ({ ...filters, dateFrom: event.currentTarget.value }))}
                aria-label="Дата від"
              />
            </label>
            <label>
              <span>До</span>
              <DragonInput
                type="date"
                value={calendar.filters.dateTo}
                onChange={(event) => calendar.setFilters((filters) => ({ ...filters, dateTo: event.currentTarget.value }))}
                aria-label="Дата до"
              />
            </label>
            <DragonButton type="button" variant="ghost" onClick={calendar.clearFilters}>
              Очистити
            </DragonButton>
          </div>
        </DragonSection>

        <DragonPanel variant="elevated" className="dh-calendar-view-panel">
          <DragonTabs tabs={DRAGON_CALENDAR_VIEW_TABS} activeTab={calendar.view} onChange={calendar.setView} />

          {calendar.view === 'month' ? (
            <div className="dh-calendar-month-view" aria-label="Місячний перегляд Dragon Calendar">
              <div className="dh-calendar-weekdays" aria-hidden="true">
                {WEEKDAY_LABELS.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
              <div className="dh-calendar-days">
                {calendar.monthDays.map((day) => (
                  <DragonTooltip key={day.key} label={getDayTooltip(day)}>
                    <div
                      className={[
                        'dh-calendar-day-cell',
                        !day.inCurrentMonth && 'is-muted',
                        day.isToday && 'is-today',
                        day.events.some((event) => event.category === 'birthday') && 'has-birthday',
                        day.events.some((event) => event.priority === 'critical') && 'has-critical'
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <div className="dh-calendar-day-head">
                        <span>{day.dayNumber}</span>
                        {day.events.some((event) => event.category === 'birthday') ? <DragonBadge tone="success">День народження</DragonBadge> : null}
                      </div>
                      <div className="dh-calendar-day-events">
                        {day.events.slice(0, 3).map((event) => {
                          const meta = DRAGON_CALENDAR_CATEGORY_META[event.category];
                          return (
                            <button key={event.id} type="button" className={`dh-calendar-event-chip ${meta.className}`} onClick={() => calendar.setSelectedEvent(event)}>
                              <span aria-hidden="true">{meta.glyph}</span>
                              <strong>{event.title}</strong>
                              <small>{sourceLabel(event.sourceModule)}</small>
                            </button>
                          );
                        })}
                        {day.events.length > 3 ? <span className="dh-calendar-overflow">+{day.events.length - 3} ще</span> : null}
                      </div>
                    </div>
                  </DragonTooltip>
                ))}
              </div>
            </div>
          ) : null}

          {calendar.view === 'week' ? (
            <div className="dh-calendar-week-view" aria-label="Тижневий перегляд Dragon Calendar">
              {calendar.weekDays.map((day) => (
                <DragonCard key={day.key} className={['dh-calendar-week-day', day.isToday && 'is-today'].filter(Boolean).join(' ')}>
                  <div className="dh-calendar-week-day-head">
                    <span>{getDayTitle(day.date)}</span>
                    <strong>{day.dayNumber}</strong>
                  </div>
                  <div className="dh-calendar-week-events">
                    {day.events.length ? (
                      day.events.map((event) => {
                        const meta = DRAGON_CALENDAR_CATEGORY_META[event.category];
                        return (
                          <button key={event.id} type="button" className={`dh-calendar-event-row ${meta.className}`} onClick={() => calendar.setSelectedEvent(event)}>
                            <span aria-hidden="true">{meta.glyph}</span>
                            <strong>{formatEventTime(event)}</strong>
                            <span>{event.title}</span>
                            <small>{sourceLabel(event.sourceModule)}</small>
                          </button>
                        );
                      })
                    ) : (
                      <span className="dh-calendar-empty-line">Печатей немає</span>
                    )}
                  </div>
                </DragonCard>
              ))}
            </div>
          ) : null}

          {calendar.view === 'agenda' ? (
            <div className="dh-calendar-agenda-view" aria-label="Список подій Dragon Calendar">
              {visibleAgendaEvents.length ? (
                visibleAgendaEvents.map((event) => {
                  const meta = DRAGON_CALENDAR_CATEGORY_META[event.category];
                  return (
                    <DragonCard key={event.id} interactive className={`dh-calendar-agenda-event ${meta.className}`}>
                      <button type="button" onClick={() => calendar.setSelectedEvent(event)}>
                        <span className="dh-calendar-agenda-date">{event.date}</span>
                        <span aria-hidden="true">{meta.glyph}</span>
                        <strong>{event.title}</strong>
                        <small>{formatEventTime(event)} · {event.hall}</small>
                        <DragonBadge tone={meta.tone}>{meta.label}</DragonBadge>
                        <DragonBadge tone={sourceTone(event.sourceModule)}>{sourceLabel(event.sourceModule)}</DragonBadge>
                      </button>
                    </DragonCard>
                  );
                })
              ) : (
                <DragonEmptyState title="Хроніки порожні" description="Зміни фільтри або повернись до сьогоднішньої зали." />
              )}
            </div>
          ) : null}
        </DragonPanel>
      </div>

      <DragonDivider label="Печаті категорій" />

      <section className="dh-calendar-category-strip" aria-label="Категорії Dragon Calendar">
        {Object.entries(DRAGON_CALENDAR_CATEGORY_META).map(([category, meta]) => (
          <DragonBadge key={category} tone={meta.tone} className={meta.className}>
            <span aria-hidden="true">{meta.glyph}</span>
            {meta.label}: {calendar.stats.categoryCounts[category as DragonCalendarCategory]}
          </DragonBadge>
        ))}
      </section>

      {calendar.selectedEvent ? (
        <DragonDialog title={calendar.selectedEvent.title} onClose={() => calendar.setSelectedEvent(null)}>
          <div className="dh-calendar-dialog-content">
            <p>{calendar.selectedEvent.description}</p>
            <dl>
              <div>
                <dt>Дата</dt>
                <dd>{calendar.selectedEvent.date}</dd>
              </div>
              <div>
                <dt>Час</dt>
                <dd>{formatEventTime(calendar.selectedEvent)}</dd>
              </div>
              <div>
                <dt>Категорія</dt>
                <dd>{DRAGON_CALENDAR_CATEGORY_META[calendar.selectedEvent.category].label}</dd>
              </div>
              <div>
                <dt>Джерело</dt>
                <dd>{sourceLabel(calendar.selectedEvent.sourceModule)}</dd>
              </div>
              <div>
                <dt>Пріоритет</dt>
                <dd>{PRIORITY_LABEL[calendar.selectedEvent.priority]}</dd>
              </div>
              <div>
                <dt>Учасники</dt>
                <dd>{calendar.selectedEvent.participants.map((participant) => participant.name).join(', ')}</dd>
              </div>
              <div>
                <dt>Зала</dt>
                <dd>{calendar.selectedEvent.hall}</dd>
              </div>
            </dl>
            <DragonDivider label="Матеріали події" />
            <div className="dh-calendar-dialog-placeholders">
              <DragonCard>
                <strong>Файли та посилання</strong>
                <p>{calendar.selectedEvent.attachments.length ? `Додано матеріалів: ${calendar.selectedEvent.attachments.length}` : 'Матеріали ще не додані.'}</p>
              </DragonCard>
              <DragonCard>
                <strong>Коментарі</strong>
                <p>Коментарі ведуться через опис, нотатки й відповіді учасників у подіях.</p>
              </DragonCard>
            </div>
          </div>
        </DragonDialog>
      ) : null}
    </div>
  );
}

function sourceLabel(sourceModule?: DragonCalendarSourceModule) {
  if (sourceModule === 'tower_defense') return 'Оборона вишок';
  if (sourceModule === 'family_quests') return 'Сімейний квест';
  if (sourceModule === 'birthday') return 'День народження';
  return 'Сімейна подія';
}

function sourceTone(sourceModule?: DragonCalendarSourceModule): 'ember' | 'gold' | 'success' | 'muted' | 'danger' {
  if (sourceModule === 'tower_defense') return 'danger';
  if (sourceModule === 'family_quests') return 'ember';
  if (sourceModule === 'birthday') return 'success';
  return 'gold';
}
