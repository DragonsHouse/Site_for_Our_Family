import { FAMILY_ROLE_LABELS } from '../../../lib/family-data';
import { useState } from 'react';
import { getCurrentUserBonus, getUserPremiumArchive } from '../../../lib/family-repositories';
import { getMemberRankProgress } from '../../../lib/family-ranks';
import type { FamilyPost, FamilyTab, FamilyUser } from '../../../lib/family-types';
import { FamilyPostCard } from './family-post-card';
import { LinkedAccountsPanel } from './linked-accounts-panel';
import { ProfileCard } from './profile-card';
import { TasksPanel } from './tasks-panel';

export function PersonalCabinet({
  user,
  posts,
  onOpenTab,
  onAvatarChange
}: {
  user: FamilyUser;
  posts: FamilyPost[];
  onOpenTab: (tab: FamilyTab) => void;
  onAvatarChange: (avatarDataUrl: string | null) => void;
}) {
  const [showPremiumArchive, setShowPremiumArchive] = useState(false);
  const rankProgress = getMemberRankProgress(user);
  const currentBonus = getCurrentUserBonus(user.nickname);
  const premiumArchive = getUserPremiumArchive(user.nickname);
  const currentPremium = premiumArchive[0];
  const pinnedPosts = posts
    .filter((post) => post.isPinned && (post.type === 'urgent' || post.type === 'important'))
    .slice(0, 2);

  return (
    <div className="space-y-4">
      <ProfileCard user={user} onAvatarChange={onAvatarChange} />
      <LinkedAccountsPanel />

      <section className="dh-reward-card rounded-3xl p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">Премія поточного місяця</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Зароблено: {(currentPremium?.earning ?? 0).toLocaleString('uk-UA')} $
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Премія рахується тільки з виплат за сімейні квести поточного місяця.
            </p>
          </div>
          <span className="w-fit rounded-full border border-amber-400/50 bg-amber-500/10 px-3 py-1 text-sm text-amber-100">
            {currentBonus?.status === 'paid'
              ? 'Видано'
              : currentBonus?.status === 'pending_payout'
                ? 'Очікує видачі'
                : currentBonus?.status === 'calculated'
                  ? 'Підтверджено'
                  : 'Без премії'}
          </span>
        </div>
        <div className="mt-5 grid gap-3 text-sm md:grid-cols-4">
            <div>
              <div className="text-slate-500">Місячний заробіток</div>
              <div className="mt-1 font-medium text-slate-100">{(currentPremium?.earning ?? 0).toLocaleString('uk-UA')} $</div>
            </div>
            <div>
              <div className="text-slate-500">Претендує на премію</div>
              <div className="mt-1 font-medium text-slate-100">
                {(currentBonus?.amount ?? currentPremium?.deservedAmount ?? 0).toLocaleString('uk-UA')} $
              </div>
            </div>
            <div>
              <div className="text-slate-500">За що</div>
              <div className="mt-1 font-medium text-slate-100">{currentBonus?.reason ?? currentPremium?.deservedTitle ?? 'Поки немає заробітку за квести'}</div>
            </div>
            <div>
              <div className="text-slate-500">Дата</div>
              <div className="mt-1 font-medium text-slate-100">
                {currentBonus?.paidAt ? new Date(currentBonus.paidAt).toLocaleDateString('uk-UA') : currentBonus ? new Date(currentBonus.updatedAt).toLocaleDateString('uk-UA') : 'очікує'}
              </div>
            </div>
        </div>
        <button
          type="button"
          onClick={() => setShowPremiumArchive((value) => !value)}
          className="mt-4 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-amber-100 hover:border-amber-500/40"
        >
          Архів премій
        </button>
        {showPremiumArchive ? (
          <div className="mt-4 grid gap-2">
            {premiumArchive.map((item) => (
              <div key={item.month.id} className="rounded-xl border border-white/10 bg-black/25 p-3 text-sm">
                <div className="font-medium text-white">
                  {String(item.month.month).padStart(2, '0')}.{item.month.year}
                </div>
                <div className="mt-1 text-slate-300">
                  Зароблено: {item.earning.toLocaleString('uk-UA')} $ · премія: {item.deservedAmount.toLocaleString('uk-UA')} $ · {item.status}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <article className="rounded-2xl border border-red-950/70 bg-slate-950/75 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Прогрес до наступного рангу</h2>
              <p className="mt-1 text-sm text-slate-400">
                Поточний ранг: <span className="text-amber-200">{user.rank}</span>
              </p>
              <p className="text-sm text-slate-400">
                Наступний ранг:{' '}
                <span className="text-amber-200">{rankProgress.nextRank?.title ?? 'найвищий рівень'}</span>
              </p>
            </div>
            <div className="text-3xl font-bold text-amber-300">{rankProgress.progressPercent}%</div>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-black/45 shadow-inner shadow-black">
            <div
              className="dh-fire-progress h-full rounded-full"
              style={{ width: `${rankProgress.progressPercent}%` }}
            />
          </div>
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <div className="text-xs uppercase tracking-[0.22em] text-amber-300">Найближчий крок</div>
            <div className="mt-1 text-sm text-amber-50">
              {rankProgress.nextStep?.label ?? 'Усі вимоги виконані або потрібне рішення керівництва.'}
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-emerald-100">Виконано</h3>
              <ul className="space-y-2">
                {rankProgress.completedRequirements.map((item) => (
                  <li key={item.id} className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-slate-200">
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-red-100">Ще потрібно</h3>
              <ul className="space-y-2">
                {rankProgress.remainingRequirements.map((item) => (
                  <li key={item.id} className="rounded-xl border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-50">
                    {item.label}
                  </li>
                ))}
                {!rankProgress.remainingRequirements.length ? (
                  <li className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-100">
                    Немає невиконаних вимог.
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-red-950/70 bg-slate-950/75 p-5">
          <h2 className="text-lg font-semibold text-white">Зараз у Dragon House</h2>
          <p className="mt-1 text-sm text-slate-400">
            {FAMILY_ROLE_LABELS[user.role]} бачить закріплені важливі повідомлення сім’ї.
          </p>
          <div className="mt-4 space-y-3">
            {pinnedPosts.map((post) => (
              <FamilyPostCard key={post.id} post={post} />
            ))}
          </div>
        </article>
      </section>

      <TasksPanel user={user} onOpenTab={onOpenTab} />
    </div>
  );
}
