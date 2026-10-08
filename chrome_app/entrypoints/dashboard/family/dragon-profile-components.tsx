import { DragonBadge, DragonCard, DragonProgress } from '../dragon-ui/dragon-ui';
import {
  DRAGON_ACHIEVEMENT_RARITY_META,
  type DragonActivityDay,
  type DragonProfileAchievement,
  type DragonProfileStatistic
} from './profile-models';
import { DRAGON_EVENT_TYPE_META, type DragonEventTimelineEntry } from './dragon-event-models';
import { formatDragonProfileDate, getActivityIntensity } from './profile-service';

export function DragonStatisticCard({ statistic }: { statistic: DragonProfileStatistic }) {
  return (
    <DragonCard className="dh-profile-stat-card">
      <span className="dh-dragon-eyebrow">{statistic.label}</span>
      <strong>{statistic.value}</strong>
      <p>{statistic.detail}</p>
      <small>{statistic.trend}</small>
      {typeof statistic.progress === 'number' ? <DragonProgress value={statistic.progress} label={`${statistic.label} progress`} /> : null}
    </DragonCard>
  );
}

export function DragonAchievementCard({ achievement }: { achievement: DragonProfileAchievement }) {
  const rarityMeta = DRAGON_ACHIEVEMENT_RARITY_META[achievement.rarity];
  const isSecret = achievement.state === 'secret';
  const stateLabel = getAchievementStateLabel(achievement.state);

  return (
    <DragonCard interactive className={`dh-achievement-card ${rarityMeta.className} is-${achievement.state}`}>
      <div className="dh-achievement-icon" aria-hidden="true">
        {isSecret ? '?' : achievement.icon}
      </div>
      <div className="dh-achievement-head">
        <div>
          <h3>{isSecret ? 'Таємна відзнака' : achievement.title}</h3>
          <p>{isSecret ? 'Приховано до відкриття цієї печатки.' : achievement.description}</p>
        </div>
        <DragonBadge tone={rarityMeta.tone}>{rarityMeta.label}</DragonBadge>
      </div>
      <DragonProgress value={achievement.progress} label={`Прогрес відзнаки ${achievement.title}`} />
      <footer>
        <span>{stateLabel}</span>
        <span>{achievement.unlockedAt ? formatDragonProfileDate(achievement.unlockedAt) : 'Очікує відкриття'}</span>
      </footer>
    </DragonCard>
  );
}

export function DragonTimeline({ events }: { events: DragonEventTimelineEntry[] }) {
  return (
    <div className="dh-profile-timeline">
      {events.map((event) => {
        const meta = DRAGON_EVENT_TYPE_META[event.type];
        return (
          <DragonCard key={event.id} className={`dh-timeline-card ${meta.className}`}>
            <time dateTime={event.occurredAt}>{formatDragonProfileDate(event.occurredAt)}</time>
            <div>
              <h3>{event.title}</h3>
              <p>{event.description}</p>
              <DragonBadge tone={meta.tone}>{getTimelineSourceLabel(event.sourceModule)}</DragonBadge>
            </div>
          </DragonCard>
        );
      })}
    </div>
  );
}

function getAchievementStateLabel(state: DragonProfileAchievement['state']) {
  if (state === 'unlocked') return 'Відкрито';
  if (state === 'secret') return 'Приховано';
  return 'Не відкрито';
}

function getTimelineSourceLabel(sourceModule: DragonEventTimelineEntry['sourceModule']) {
  const labels: Record<DragonEventTimelineEntry['sourceModule'], string> = {
    events: 'Події',
    calendar: 'Календар',
    birthday: 'Дні народження',
    profile: 'Профіль',
    quest_board: 'Квести',
    tower_defense: 'Оборона вишок',
    resources: 'Ресурси',
    discord: 'Discord',
    manual: 'Запис',
  };
  return labels[sourceModule];
}

export function DragonActivityHeatmap({ days }: { days: DragonActivityDay[] }) {
  return (
    <div className="dh-profile-heatmap" aria-label="Dragon activity heatmap">
      {days.map((day) => (
        <span
          key={day.date}
          className={`dh-profile-heatmap-cell level-${getActivityIntensity(day)}`}
          title={`${day.date}: ${day.value} activity`}
          aria-label={`${day.date}: ${day.value} activity`}
        />
      ))}
    </div>
  );
}
