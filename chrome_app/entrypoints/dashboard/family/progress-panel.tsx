import type { FamilyUser } from '../../../lib/family-auth';

function clampProgress(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function ProgressPanel({ user }: { user: FamilyUser }) {
  const progress = clampProgress(user.promotionProgress);
  const nextStep = user.promotionRequirements.remaining[0]?.label ?? 'Усі вимоги виконані';

  return (
    <article className="rounded-2xl border border-red-950/70 bg-slate-950/80 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Прогрес до підвищення</h2>
          <p className="mt-1 text-sm text-slate-400">
            Наступний ранг: <span className="text-amber-200">{user.nextRank ?? 'максимальний рівень'}</span>
          </p>
        </div>
        <div className="text-3xl font-bold text-amber-300">{progress}%</div>
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-900">
        <div
          className="h-full rounded-full bg-gradient-to-r from-red-700 via-orange-500 to-amber-300 shadow-lg shadow-orange-500/30"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
        <div className="text-xs uppercase tracking-[0.2em] text-amber-300">Найближчий крок</div>
        <div className="mt-1 text-sm text-amber-50">{nextStep}</div>
      </div>

      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <div className="text-slate-500">Завдань виконано</div>
          <div className="mt-1 text-xl font-semibold text-white">{user.stats.tasksDone}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <div className="text-slate-500">Івентів</div>
          <div className="mt-1 text-xl font-semibold text-white">{user.stats.eventsJoined}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <div className="text-slate-500">Внесок</div>
          <div className="mt-1 text-xl font-semibold text-white">{user.stats.contributionPoints}</div>
        </div>
      </div>
    </article>
  );
}
