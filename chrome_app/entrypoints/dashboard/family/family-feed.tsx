import { useMemo, useState } from 'react';
import type { FamilyPost, FamilyPostType } from '../../../lib/family-types';
import { DragonButton, DragonEmptyState, DragonHero, DragonPanel, DragonStatusMessage } from '../dragon-ui/dragon-ui';
import { FamilyPostCard } from './family-post-card';

const FILTERS: Array<{ key: FamilyPostType | 'all'; label: string }> = [
  { key: 'all', label: 'Усі' },
  { key: 'urgent', label: 'Термінові' },
  { key: 'family_news', label: 'Новини сім’ї' },
  { key: 'recruitment', label: 'Набір' },
  { key: 'event', label: 'Події' },
  { key: 'info', label: 'Інформація' }
];

export function FamilyFeed({ posts, error }: { posts: FamilyPost[]; error?: string | null }) {
  const [filter, setFilter] = useState<FamilyPostType | 'all'>('all');
  const urgentPosts = posts.filter((post) => post.type === 'urgent');
  const pinnedPosts = posts.filter((post) => post.isPinned && post.type !== 'urgent');
  const filteredPosts = useMemo(
    () => posts.filter((post) => filter === 'all' || post.type === filter),
    [filter, posts]
  );

  return (
    <section className="space-y-4">
      <DragonHero
        eyebrow="Family bulletin"
        title="Новини Dragon House"
        description="Рішення керівництва, зміни в сім’ї, підвищення, досягнення, активності, оголошення і збори."
        className="dh-command-hero"
      >
        <div className="grid gap-2 text-sm">
          <div className="dh-status-pill is-active">{posts.length} записів</div>
          {urgentPosts.length ? <div className="dh-status-pill is-danger">{urgentPosts.length} терміново</div> : null}
        </div>
      </DragonHero>

      {error ? (
        <DragonStatusMessage tone="error" title="Новини тимчасово недоступні">
          {error}
        </DragonStatusMessage>
      ) : null}

      {urgentPosts.length ? (
        <DragonPanel variant="critical" className="p-4">
          <p className="dh-command-kicker">Терміново</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {urgentPosts.slice(0, 2).map((post) => (
              <FamilyPostCard key={post.id} post={post} />
            ))}
          </div>
        </DragonPanel>
      ) : null}

      {pinnedPosts.length ? (
        <DragonPanel variant="sealed" className="p-4">
          <p className="dh-command-kicker">Закріплено</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {pinnedPosts.slice(0, 4).map((post) => (
              <FamilyPostCard key={post.id} post={post} />
            ))}
          </div>
        </DragonPanel>
      ) : null}

      <DragonPanel variant="raised" className="p-4">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Фільтр новин">
          {FILTERS.map((item) => (
            <DragonButton
              key={item.key}
              type="button"
              variant={filter === item.key ? 'primary' : 'quiet'}
              onClick={() => setFilter(item.key)}
              aria-pressed={filter === item.key}
            >
              {item.label}
            </DragonButton>
          ))}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {filteredPosts.map((post) => (
            <FamilyPostCard key={post.id} post={post} />
          ))}
        </div>

        {!filteredPosts.length ? (
          <div className="mt-4">
            <DragonEmptyState
              title="У цій категорії поки тихо"
              description="Коли з’явиться відповідна новина, вона буде тут без локальних чернеток і дублювання."
            />
          </div>
        ) : null}
      </DragonPanel>
    </section>
  );
}
