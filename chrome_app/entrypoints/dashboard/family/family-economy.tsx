import { useMemo, useState } from 'react';
import { canManageFamilyEconomy } from '../../../lib/family-permissions';
import {
  readFamilyEconomyEntries,
  saveFamilyEconomyEntries
} from '../../../lib/family-repositories';
import type { FamilyEconomyCategory, FamilyEconomyEntry, FamilyUser } from '../../../lib/family-types';

const CATEGORY_LABELS: Record<FamilyEconomyCategory | 'all', string> = {
  all: 'Усе',
  fuel: 'Паливо',
  clothing: 'Одяг',
  weapons: 'Зброя',
  shops: 'Магазини',
  other: 'Інше'
};

const CATEGORIES = Object.keys(CATEGORY_LABELS) as Array<FamilyEconomyCategory | 'all'>;

export function FamilyEconomy({ currentUser }: { currentUser: FamilyUser }) {
  const [entries, setEntries] = useState<FamilyEconomyEntry[]>(() => readFamilyEconomyEntries());
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FamilyEconomyCategory | 'all'>('all');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftCategory, setDraftCategory] = useState<FamilyEconomyCategory>('shops');
  const canManage = canManageFamilyEconomy(currentUser);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (!entry.isActive) return false;
      if (category !== 'all' && entry.category !== category) return false;
      if (!normalizedQuery) return true;
      return [entry.title, entry.description, entry.note, entry.price, entry.locationNumber, entry.locationReference]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [category, entries, query]);

  function persist(nextEntries: FamilyEconomyEntry[]) {
    saveFamilyEconomyEntries(nextEntries);
    setEntries(nextEntries);
  }

  function addEntry() {
    const title = draftTitle.trim();
    if (!title) return;
    const now = new Date().toISOString();
    const nextEntry: FamilyEconomyEntry = {
      id: `economy-${Date.now()}`,
      category: draftCategory,
      title,
      locationNumber: null,
      locationReference: null,
      description: 'Локальний запис Dragon House. Опис можна деталізувати на наступному етапі.',
      price: null,
      note: null,
      createdBy: currentUser.nickname,
      createdAt: now,
      updatedAt: now,
      isActive: true
    };
    persist([nextEntry, ...entries]);
    setDraftTitle('');
  }

  function deactivateEntry(entryId: string) {
    persist(
      entries.map((entry) =>
        entry.id === entryId
          ? { ...entry, isActive: false, updatedAt: new Date().toISOString() }
          : entry
      )
    );
  }

  return (
    <section className="rounded-2xl border border-red-950/70 bg-slate-950/75 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Скарбниця Dragon House</h2>
          <p className="mt-1 text-sm text-slate-400">
            Це не бухгалтерія. Це сімейна база економії: місця, де можна витратити менше і отримати більше.
          </p>
        </div>
        {canManage ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Доступно: додати запис, деактивувати. Повне редагування полів підготовлено для наступного етапу.
          </div>
        ) : null}
      </div>

      {canManage ? (
        <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr_auto]">
          <select
            value={draftCategory}
            onChange={(event) => setDraftCategory(event.target.value as FamilyEconomyCategory)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            {CATEGORIES.filter((item) => item !== 'all').map((item) => (
              <option key={item} value={item}>
                {CATEGORY_LABELS[item]}
              </option>
            ))}
          </select>
          <input
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            placeholder="Новий запис, наприклад: Магазин #30"
          />
          <button
            type="button"
            onClick={addEntry}
            disabled={!draftTitle.trim()}
            className="rounded-xl border border-amber-500/60 px-3 py-2 text-sm text-amber-100 hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Додати
          </button>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          placeholder="Пошук за назвою, номером, приміткою"
        />
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as FamilyEconomyCategory | 'all')}
          className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        >
          {CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {CATEGORY_LABELS[item]}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredEntries.map((entry) => (
          <article key={entry.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-amber-300">
                  {CATEGORY_LABELS[entry.category]}
                </div>
                <h3 className="mt-1 text-base font-semibold text-white">{entry.title}</h3>
              </div>
              <span className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-300">
                {entry.locationNumber ?? entry.locationReference ?? 'без номера'}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-300">{entry.description}</p>
            {entry.note || entry.price ? (
              <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                {entry.note ?? entry.price}
              </div>
            ) : null}
            {canManage ? (
              <button
                type="button"
                onClick={() => deactivateEntry(entry.id)}
                className="mt-3 rounded-lg border border-red-500/50 px-3 py-1.5 text-xs text-red-100 hover:bg-red-500/10"
              >
                Деактивувати
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
