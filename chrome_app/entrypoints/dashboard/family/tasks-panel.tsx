import type { FamilyTab, FamilyUser } from '../../../lib/family-types';

const STATUS_LABELS: Record<FamilyUser['tasks'][number]['status'], string> = {
  todo: 'Очікує',
  in_progress: 'В роботі',
  done: 'Виконано',
  rejected: 'Відхилено'
};

const PRIORITY_LABELS: Record<FamilyUser['tasks'][number]['priority'], string> = {
  low: 'низький',
  normal: 'звичайний',
  high: 'важливий'
};

export function TasksPanel({
  user,
  onOpenTab
}: {
  user: FamilyUser;
  onOpenTab: (tab: FamilyTab) => void;
}) {
  return (
    <article className="rounded-2xl border border-red-950/70 bg-slate-950/80 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Персональні завдання</h2>
          <p className="mt-1 text-sm text-slate-400">Тут будуть сімейні доручення, квести й задачі від старших.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onOpenTab('buyers')} className="rounded-lg border border-amber-500/60 px-3 py-2 text-xs text-amber-200 hover:bg-amber-500/10">
            До скупників
          </button>
          <button type="button" onClick={() => onOpenTab('events')} className="rounded-lg border border-amber-500/60 px-3 py-2 text-xs text-amber-200 hover:bg-amber-500/10">
            До івентів
          </button>
          <button type="button" onClick={() => onOpenTab('map')} className="rounded-lg border border-amber-500/60 px-3 py-2 text-xs text-amber-200 hover:bg-amber-500/10">
            До мапи
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {user.tasks.length ? (
          user.tasks.map((task) => (
            <section key={task.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-medium text-slate-100">{task.title}</h3>
                  {task.description ? <p className="mt-1 text-sm text-slate-400">{task.description}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-red-800 bg-red-950/50 px-2 py-1 text-red-100">
                    {STATUS_LABELS[task.status]}
                  </span>
                  <span className="rounded-full border border-amber-800 bg-amber-950/30 px-2 py-1 text-amber-100">
                    {PRIORITY_LABELS[task.priority]}
                  </span>
                </div>
              </div>
            </section>
          ))
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400">
            Завдань поки немає.
          </div>
        )}
      </div>
    </article>
  );
}
