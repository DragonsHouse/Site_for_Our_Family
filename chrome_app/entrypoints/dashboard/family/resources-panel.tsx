import { useMemo, useState } from 'react';
import { FAMILY_RESOURCES, QUANT_NEWS_ITEMS } from '../../../lib/family-data';
import { canManageResources } from '../../../lib/family-permissions';
import { QUANT_NEWS_PROVIDER, QUANT_RP_RESOURCE_LINKS } from '../../../lib/family-resources';
import type { FamilyUser, ResourceCategory } from '../../../lib/family-types';

const CATEGORY_LABELS: Record<ResourceCategory, string> = {
  general: 'Загальні правила',
  crime: 'Crime',
  captures_business: 'Капти / бізнеси',
  government: 'Державні структури',
  codes_laws: 'Кодекси / закони',
  statutes: 'Статути',
  quant_news: 'Новини Quant'
};

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ResourceCategory[];

export function ResourcesPanel({ currentUser }: { currentUser: FamilyUser }) {
  const [category, setCategory] = useState<ResourceCategory>('general');
  const [query, setQuery] = useState('');
  const canManageResourceData = canManageResources(currentUser);

  const links = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return QUANT_RP_RESOURCE_LINKS.filter((link) => {
      if (link.category !== category) return false;
      if (!normalizedQuery) return true;
      return [link.title, link.description, link.source, ...(link.tags ?? [])].some((value) =>
        value.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [category, query]);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-red-950/70 bg-slate-950/75 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Ресурси Dragon House</h2>
            <p className="mt-1 text-sm text-slate-400">
              Внутрішні файли сім’ї та зовнішня база знань Quant RP. Тексти правил не копіюються, відкривається оригінальне джерело.
            </p>
          </div>
          {canManageResourceData ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              Майбутні дії: редагувати версію, дату, посилання й опис ресурсів.
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {FAMILY_RESOURCES.map((resource) => (
            <article key={resource.id} className="rounded-2xl border border-amber-500/30 bg-amber-950/10 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-amber-300">Family file</div>
              <h3 className="mt-1 text-base font-semibold text-white">{resource.title}</h3>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Дата</dt>
                  <dd className="text-slate-100">{resource.date}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Файл / опис</dt>
                  <dd className="text-slate-100">{resource.fileDescription}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Статус</dt>
                  <dd className="text-emerald-100">{resource.status}</dd>
                </div>
              </dl>
              <a
                href={resource.url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex rounded-lg border border-amber-500/60 px-3 py-2 text-sm text-amber-100 hover:bg-amber-500/10"
              >
                Відкрити файл
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-red-950/70 bg-slate-950/75 p-5">
        <h2 className="text-lg font-semibold text-white">База знань Quant RP</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={
                category === item
                  ? 'rounded-xl bg-gradient-to-r from-red-700 to-amber-500 px-3 py-2 text-sm font-semibold text-white'
                  : 'rounded-xl border border-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-900'
              }
            >
              {CATEGORY_LABELS[item]}
            </button>
          ))}
        </div>

        {category !== 'quant_news' ? (
          <>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              placeholder="Пошук ресурсу"
            />
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {links.map((link) => (
                <article key={link.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-amber-300">
                    {CATEGORY_LABELS[link.category]}
                  </div>
                  <h3 className="mt-1 font-semibold text-white">{link.title}</h3>
                  <p className="mt-2 text-sm text-slate-400">{link.description}</p>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                  >
                    Відкрити джерело
                  </a>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-amber-300">Офіційне джерело</div>
              <h3 className="mt-1 font-semibold text-white">{QUANT_NEWS_PROVIDER.sourceName}</h3>
              <p className="mt-2 text-sm text-amber-100">
                Новини відкриваються з офіційного джерела. Приватні токени й неофіційний доступ не використовуються.
              </p>
              <a
                href={QUANT_NEWS_PROVIDER.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex rounded-lg border border-amber-500/60 px-3 py-2 text-sm text-amber-100 hover:bg-amber-500/10"
              >
                Відкрити джерело
              </a>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {QUANT_NEWS_ITEMS.map((item) => (
                <article key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-amber-300">{item.sourceName}</div>
                  <h3 className="mt-1 font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm text-slate-400">{item.body}</p>
                  <div className="mt-3 text-xs text-slate-500">
                    {new Date(item.publishedAt).toLocaleString('uk-UA')}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
