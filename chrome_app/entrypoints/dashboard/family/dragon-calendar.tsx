import type { FamilyUser } from '../../../lib/family-types';
import {
  DragonBadge,
  DragonButton,
  DragonCard,
  DragonDivider,
  DragonEmptyState,
  DragonHero,
  DragonInput,
  DragonPanel,
  DragonProgress,
  DragonSection,
  DragonSelect
} from '../dragon-ui/dragon-ui';

type CalendarEventKind = 'birthday' | 'family' | 'quest' | 'council';

type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  time: string;
  kind: CalendarEventKind;
  hall: string;
  description: string;
  readiness: number;
};

const CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: 'birthday-anastasia',
    title: 'День народження Anastasia_Dragons',
    date: '29.02',
    time: 'цілий день',
    kind: 'birthday',
    hall: 'Family Calendar',
    description: 'Сімейна дата без публікації року народження.',
    readiness: 100
  },
  {
    id: 'war-council',
    title: 'War Council',
    date: '30.07',
    time: '20:30',
    kind: 'council',
    hall: 'Hall of Chronicles',
    description: 'Планування активностей, ролей і пріоритетів Dragon House.',
    readiness: 68
  },
  {
    id: 'weekly-quests',
    title: 'Сімейні квести тижня',
    date: '01.08',
    time: '19:00',
    kind: 'quest',
    hall: 'Quest Forge',
    description: 'Підготовка задач, звітів і нагород для учасників.',
    readiness: 44
  }
];

const KIND_LABEL: Record<CalendarEventKind, string> = {
  birthday: 'Народження',
  family: 'Сім’я',
  quest: 'Квест',
  council: 'Рада'
};

const KIND_TONE: Record<CalendarEventKind, 'ember' | 'gold' | 'success' | 'muted'> = {
  birthday: 'gold',
  family: 'ember',
  quest: 'success',
  council: 'ember'
};

export function DragonCalendar({ currentUser }: { currentUser: FamilyUser }) {
  const visibleEvents = CALENDAR_EVENTS;

  return (
    <div className="dh-calendar-room">
      <DragonHero
        eyebrow="HALL OF CHRONICLES"
        title="Dragon Calendar"
        description="Сімейні дати, ради, квести й важливі ритуали Dragon House в одному залі хронік."
      >
        <div className="dh-calendar-hero-seals" aria-label="Поточний стан календаря">
          <DragonBadge tone="gold">Перший модуль Design System</DragonBadge>
          <DragonBadge tone="success">{currentUser.nickname}</DragonBadge>
        </div>
      </DragonHero>

      <div className="dh-calendar-grid">
        <DragonSection
          eyebrow="CHRONICLE FILTERS"
          title="Пошук у хроніках"
          description="Початковий інтерфейс календаря вже використовує Dragon UI primitives. Backend-підключення прийде окремим кроком."
        >
          <div className="dh-calendar-filters">
            <label>
              <span>Назва або учасник</span>
              <DragonInput placeholder="Наприклад: рада, квест, день народження" aria-label="Назва або учасник" />
            </label>
            <label>
              <span>Тип події</span>
              <DragonSelect aria-label="Тип події" defaultValue="all">
                <option value="all">Усі печаті</option>
                <option value="birthday">Дні народження</option>
                <option value="council">War Council</option>
                <option value="quest">Квести</option>
              </DragonSelect>
            </label>
            <DragonButton type="button">Оновити залу</DragonButton>
          </div>
        </DragonSection>

        <DragonPanel variant="elevated" className="dh-calendar-month">
          <div className="dh-calendar-month-head">
            <div>
              <p className="dh-dragon-eyebrow">EMBER MONTH</p>
              <h2>Липень 2026</h2>
            </div>
            <DragonBadge tone="ember">{visibleEvents.length} події</DragonBadge>
          </div>

          <div className="dh-calendar-weekdays" aria-hidden="true">
            <span>Пн</span>
            <span>Вт</span>
            <span>Ср</span>
            <span>Чт</span>
            <span>Пт</span>
            <span>Сб</span>
            <span>Нд</span>
          </div>
          <div className="dh-calendar-days" aria-label="Попередній перегляд місяця">
            {Array.from({ length: 35 }, (_, index) => {
              const day = index + 1;
              const hasEvent = day === 29 || day === 30 || day === 32;
              return (
                <span key={day} className={hasEvent ? 'has-event' : undefined}>
                  {day <= 31 ? day : ''}
                </span>
              );
            })}
          </div>
        </DragonPanel>
      </div>

      <DragonDivider label="Upcoming Seals" />

      <section className="dh-calendar-events" aria-label="Найближчі події Dragon Calendar">
        {visibleEvents.length ? (
          visibleEvents.map((event) => (
            <DragonCard key={event.id} interactive className="dh-calendar-event">
              <div className="dh-calendar-event-date">
                <strong>{event.date}</strong>
                <span>{event.time}</span>
              </div>
              <div className="dh-calendar-event-main">
                <div className="dh-calendar-event-title">
                  <h3>{event.title}</h3>
                  <DragonBadge tone={KIND_TONE[event.kind]}>{KIND_LABEL[event.kind]}</DragonBadge>
                </div>
                <p>{event.description}</p>
                <div className="dh-calendar-event-meta">
                  <span>{event.hall}</span>
                  <span>Готовність: {event.readiness}%</span>
                </div>
                <DragonProgress value={event.readiness} label={`Готовність події ${event.title}`} />
              </div>
            </DragonCard>
          ))
        ) : (
          <DragonEmptyState title="Хроніки ще порожні" description="Коли Dragon House додасть події, вони з’являться у цій залі." />
        )}
      </section>
    </div>
  );
}
