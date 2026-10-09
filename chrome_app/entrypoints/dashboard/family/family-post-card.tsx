import type { FamilyPost } from '../../../lib/family-types';
import { DragonBadge } from '../dragon-ui/dragon-ui';

const TYPE_LABELS: Record<FamilyPost['type'], string> = {
  urgent: 'Терміново',
  important: 'Важливо',
  family_news: 'Новини сім’ї',
  announcement: 'Оголошення',
  recruitment: 'Набір',
  poll: 'Опитування',
  family: 'Новини сім’ї',
  event: 'Подія',
  info: 'Інформація'
};

const TYPE_TONES: Record<FamilyPost['type'], 'danger' | 'warning' | 'ember' | 'success' | 'neutral'> = {
  urgent: 'danger',
  important: 'warning',
  family_news: 'ember',
  announcement: 'warning',
  recruitment: 'success',
  poll: 'neutral',
  family: 'ember',
  event: 'neutral',
  info: 'neutral'
};

const TYPE_CLASSES: Record<FamilyPost['type'], string> = {
  urgent: 'dh-news-card-urgent',
  important: 'dh-news-card-important',
  family_news: '',
  announcement: '',
  recruitment: '',
  poll: '',
  family: '',
  event: '',
  info: ''
};

export function FamilyPostCard({ post }: { post: FamilyPost }) {
  return (
    <article className={`dh-news-card rounded-2xl p-4 pl-5 ${TYPE_CLASSES[post.type]}`}>
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <DragonBadge tone={TYPE_TONES[post.type]}>{TYPE_LABELS[post.type]}</DragonBadge>
            {post.isPinned ? <DragonBadge tone="gold">Закріплено</DragonBadge> : null}
          </div>
          <h3 className="mt-3 text-lg font-semibold text-white">{post.title}</h3>
        </div>
        {post.notificationRequired ? <DragonBadge tone="danger">Потребує уваги</DragonBadge> : null}
      </div>
      <p className="relative mt-3 whitespace-pre-line text-sm leading-7 text-stone-200">{post.body}</p>
      <div className="relative mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-stone-400">
        <span>Автор: {post.createdBy}</span>
        <span>Оновлено: {new Date(post.createdAt).toLocaleString('uk-UA')}</span>
        {post.serverName ? <span>{post.serverName}</span> : null}
      </div>
    </article>
  );
}
