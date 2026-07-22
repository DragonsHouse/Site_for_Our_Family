import { FAMILY_RANKS, RANK_PROGRESSIONS } from '../../../lib/family-ranks';

export function FamilyRanks() {
  return (
    <section className="rounded-2xl border border-red-950/70 bg-slate-950/75 p-5">
      <h2 className="text-lg font-semibold text-white">Ранги та підвищення</h2>
      <p className="mt-1 text-sm text-slate-400">
        Структурована модель підвищення. “Мій кабінет” рахує прогрес на її основі.
      </p>
      <div className="mt-5 grid gap-4 xl:grid-cols-[320px_1fr]">
        <aside className="space-y-2">
          {FAMILY_RANKS.map((rank) => (
            <div key={rank.level} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="text-xs text-amber-300">Ранг {rank.level}</div>
              <div className="text-sm font-medium text-white">{rank.title}</div>
            </div>
          ))}
        </aside>
        <div className="space-y-4">
          {RANK_PROGRESSIONS.map((progression) => (
            <article key={progression.title} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <h3 className="font-semibold text-white">{progression.title}</h3>
              <ul className="mt-3 space-y-2">
                {progression.requirements.map((requirement) => (
                  <li key={requirement.id} className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-200">
                    {requirement.label}
                    {requirement.verifierLabel ? (
                      <span className="ml-2 text-xs text-amber-300">({requirement.verifierLabel})</span>
                    ) : null}
                  </li>
                ))}
              </ul>
              {progression.notes?.length ? (
                <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                  {progression.notes.join(' ')}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
