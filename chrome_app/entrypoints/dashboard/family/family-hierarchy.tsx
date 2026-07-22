import { FAMILY_RANKS } from '../../../lib/family-ranks';

export function FamilyHierarchy() {
  return (
    <section className="rounded-2xl border border-red-950/70 bg-slate-950/75 p-5">
      <h2 className="text-lg font-semibold text-white">Ієрархія Dragon House</h2>
      <p className="mt-1 text-sm text-slate-400">Драконова драбина влади. Ранг 10 - засновник і не передається.</p>
      <div className="mt-5 space-y-3">
        {FAMILY_RANKS.map((rank) => (
          <article
            key={rank.level}
            className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-950 to-slate-900 p-4"
          >
            <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-amber-300 via-orange-600 to-red-900" />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-amber-300">Ранг {rank.level}</div>
                <h3 className="mt-1 text-base font-semibold text-white">{rank.title}</h3>
                {rank.subtitle ? <p className="text-sm text-slate-400">{rank.subtitle}</p> : null}
              </div>
              {rank.isFounderOnly ? (
                <span className="rounded-full border border-amber-400/40 px-3 py-1 text-xs text-amber-100">
                  Не передається
                </span>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
