import type { FamilyUser } from '../../../lib/family-auth';

export function RequirementsPanel({ user }: { user: FamilyUser }) {
  return (
    <article className="rounded-2xl border border-red-950/70 bg-slate-950/80 p-5">
      <h2 className="text-lg font-semibold text-white">Вимоги до підвищення</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section>
          <div className="mb-2 text-sm font-medium text-red-100">Ще потрібно</div>
          {user.promotionRequirements.remaining.length ? (
            <ul className="space-y-2">
              {user.promotionRequirements.remaining.map((item) => (
                <li key={item.id} className="rounded-xl border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-50">
                  {item.label}
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-100">
              Усі вимоги виконані.
            </div>
          )}
        </section>

        <section>
          <div className="mb-2 text-sm font-medium text-emerald-100">Виконано</div>
          {user.promotionRequirements.completed.length ? (
            <ul className="space-y-2">
              {user.promotionRequirements.completed.map((item) => (
                <li key={item.id} className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-200">
                  <span className="mr-2 text-emerald-300">✓</span>
                  {item.label}
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-400">
              Виконаних вимог поки немає.
            </div>
          )}
        </section>
      </div>
    </article>
  );
}
