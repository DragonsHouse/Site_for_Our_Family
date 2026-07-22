import { useMemo, useState } from 'react';
import type { FamilyPost, FamilyPostType } from '../../../lib/family-types';
import { FamilyPostCard } from './family-post-card';

const FILTERS: Array<{ key: FamilyPostType | 'all'; label: string }> = [
  { key: 'all', label: 'Усі' },
  { key: 'urgent', label: 'Термінові' },
  { key: 'family_news', label: "Новини сім’ї" },
  { key: 'recruitment', label: 'Набір' },
  { key: 'event', label: 'Події' },
  { key: 'info', label: 'Інформація' }
];

export function FamilyFeed({ posts }: { posts: FamilyPost[] }) {
  const [filter, setFilter] = useState<FamilyPostType | 'all'>('all');
  const urgentPosts = posts.filter((post) => post.type === 'urgent');
  const filteredPosts = useMemo(
    () => posts.filter((post) => filter === 'all' || post.type === filter),
    [filter, posts]
  );

  return (
    <section className="rounded-2xl border border-red-950/70 bg-slate-950/75 p-5">
      <h2 className="text-lg font-semibold text-white">Новини Dragon House</h2>
      <p className="mt-1 text-sm text-slate-400">
        Рішення керівництва, зміни в сім’ї, підвищення, досягнення, активності, оголошення і збори.
      </p>

      {urgentPosts.length ? (
        <div className="dh-news-card dh-news-card-urgent mt-4 rounded-2xl p-4 pl-5">
          <div className="relative text-xs font-semibold uppercase tracking-[0.25em] text-red-200">
            Терміново
          </div>
          <div className="relative mt-1 text-base font-semibold text-white">{urgentPosts[0].title}</div>
          <p className="relative mt-2 text-sm text-red-100">{urgentPosts[0].body}</p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={
              filter === item.key
                ? 'dh-tab-active rounded-xl px-3 py-2 text-sm font-semibold'
                : 'dh-tab rounded-xl px-3 py-2 text-sm font-semibold'
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {filteredPosts.map((post) => (
          <FamilyPostCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}
