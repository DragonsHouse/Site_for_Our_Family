import type { FamilyPost } from '../../../lib/family-types';

const TYPE_LABELS: Record<FamilyPost['type'], string> = {
  urgent: 'Терміново',
  important: 'Важливо',
  family_news: "Новини сім’ї",
  announcement: 'Оголошення',
  recruitment: 'Набір',
  poll: 'Опитування',
  family: "Новини сім’ї",
  event: 'Подія',
  info: 'Інформація'
};

const TYPE_CLASSES: Record<FamilyPost['type'], string> = {
  urgent: 'dh-news-card-urgent text-red-100',
  important: 'dh-news-card-important text-amber-100',
  family_news: 'text-slate-100',
  announcement: 'text-orange-100',
  recruitment: 'text-emerald-100',
  poll: 'text-slate-100',
  family: 'text-slate-100',
  event: 'text-slate-100',
  info: 'text-slate-100'
};

export function FamilyPostCard({ post }: { post: FamilyPost }) {
  return (
    <article className={`dh-news-card rounded-2xl p-4 pl-5 ${TYPE_CLASSES[post.type]}`}>
      <div className="relative flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] opacity-80">
            {TYPE_LABELS[post.type]}
          </div>
          <h3 className="mt-1 text-base font-semibold text-white">{post.title}</h3>
        </div>
        {post.isPinned ? (
          <span className="w-fit rounded-full border border-amber-400/40 px-2 py-1 text-xs text-amber-100">
            Закріплено
          </span>
        ) : null}
      </div>
      <p className="relative mt-3 text-sm leading-6 text-slate-200">{post.body}</p>
      <div className="relative mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
        <span>{post.createdBy}</span>
        <span>{new Date(post.createdAt).toLocaleString('uk-UA')}</span>
        {post.serverName ? <span>{post.serverName}</span> : null}
      </div>
    </article>
  );
}
