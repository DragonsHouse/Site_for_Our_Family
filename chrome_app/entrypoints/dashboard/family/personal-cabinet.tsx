import { FAMILY_ROLE_LABELS } from '../../../lib/family-data';
import type { FamilyPost, FamilyTab, FamilyUser } from '../../../lib/family-types';
import { DragonProfile } from './dragon-profile';
import { FamilyPostCard } from './family-post-card';
import { LinkedAccountsPanel } from './linked-accounts-panel';
import { ProfileCard } from './profile-card';
import { TasksPanel } from './tasks-panel';

export function PersonalCabinet({
  user,
  posts,
  onOpenTab,
  onAvatarChange,
  onAuthenticatedUserRefresh
}: {
  user: FamilyUser;
  posts: FamilyPost[];
  onOpenTab: (tab: FamilyTab) => void;
  onAvatarChange: (avatarDataUrl: string | null) => void;
  onAuthenticatedUserRefresh: () => Promise<FamilyUser | null>;
}) {
  const pinnedPosts = posts
    .filter((post) => post.isPinned && (post.type === 'urgent' || post.type === 'important'))
    .slice(0, 2);

  return (
    <div className="space-y-4">
      <ProfileCard user={user} onAvatarChange={onAvatarChange} />
      <LinkedAccountsPanel user={user} onAuthenticatedUserRefresh={onAuthenticatedUserRefresh} />
      <DragonProfile user={user} />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <article className="rounded-2xl border border-red-950/70 bg-slate-950/75 p-5">
          <h2 className="text-lg font-semibold text-white">Зараз у Dragon House</h2>
          <p className="mt-1 text-sm text-slate-300">
            {FAMILY_ROLE_LABELS[user.role]} бачить закріплені важливі повідомлення сімʼї, особисті задачі,
            профіль, нагороди й бухгалтерію в одному кабінеті.
          </p>
          <div className="mt-4 space-y-3">
            {pinnedPosts.length ? (
              pinnedPosts.map((post) => <FamilyPostCard key={post.id} post={post} />)
            ) : (
              <p className="rounded-xl border border-white/10 bg-black/25 p-3 text-sm text-slate-300">
                Закріплених термінових повідомлень зараз немає.
              </p>
            )}
          </div>
        </article>

        <TasksPanel user={user} onOpenTab={onOpenTab} />
      </section>
    </div>
  );
}
