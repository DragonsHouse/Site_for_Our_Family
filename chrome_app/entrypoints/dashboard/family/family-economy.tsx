import { useEffect, useMemo, useState } from 'react';
import { canManageFamilyEconomy } from '../../../lib/family-permissions';
import {
  archiveFamilyTreasuryEntry,
  createFamilyTreasuryEntry,
  FamilyTreasuryApiError,
  listFamilyTreasuryEntries,
  updateFamilyTreasuryEntry
} from '../../../lib/family-treasury-backend-client';
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
const SAVE_ERROR = 'Не вдалося зберегти дані.';
const TREASURY_CONFLICT_MESSAGE = 'Дані Скарбниці вже змінилися в іншому вікні. Натисни «Оновити дані», щоб побачити актуальну версію.';

export function FamilyEconomy({ currentUser }: { currentUser: FamilyUser }) {
  const [entries, setEntries] = useState<FamilyEconomyEntry[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FamilyEconomyCategory | 'all'>('all');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftCategory, setDraftCategory] = useState<FamilyEconomyCategory>('shops');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<'reload' | 'retry'>('retry');
  const canManage = canManageFamilyEconomy(currentUser);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    setErrorAction('retry');
    listFamilyTreasuryEntries(controller.signal)
      .then((result) => setEntries(result.items))
      .catch((loadError) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Не вдалося завантажити дані.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, []);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (!entry.isActive) return false;
      if (category !== 'all' && entry.category !== category) return false;
      if (!normalizedQuery) return true;
      return [entry.title, entry.description, entry.note, entry.priceNote, entry.price, entry.priceAmount, entry.locationNumber, entry.locationReference]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [category, entries, query]);

  async function reload() {
    setIsLoading(true);
    setError(null);
    setErrorAction('retry');
    try {
      const result = await listFamilyTreasuryEntries();
      setEntries(result.items);
    } catch (reloadError) {
      setError(reloadError instanceof Error ? reloadError.message : 'Не вдалося завантажити дані.');
    } finally {
      setIsLoading(false);
    }
  }

  async function addEntry() {
    const title = draftTitle.trim();
    if (!title || isSaving) return;
    setIsSaving(true);
    setError(null);
    setErrorAction('retry');
    try {
      const created = await createFamilyTreasuryEntry({
        category: draftCategory,
        title,
        description: 'Новий запис Скарбниці Dragon House.',
      });
      setEntries((current) => [created, ...current]);
      setDraftTitle('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : SAVE_ERROR);
    } finally {
      setIsSaving(false);
    }
  }

  async function deactivateEntry(entryId: string) {
    if (isSaving) return;
    const entry = entries.find((item) => item.id === entryId);
    if (!entry) return;
    setIsSaving(true);
    setError(null);
    setErrorAction('retry');
    try {
      const archived = await archiveFamilyTreasuryEntry(entryId, entry.version ?? 1);
      setEntries((current) => current.map((entry) => (entry.id === entryId ? archived : entry)));
    } catch (saveError) {
      showSaveError(saveError);
    } finally {
      setIsSaving(false);
    }
  }

  async function updateEntry(
    entryId: string,
    updates: Partial<Pick<FamilyEconomyEntry, 'category' | 'title' | 'locationNumber' | 'locationReference' | 'description' | 'price' | 'priceAmount' | 'priceNote' | 'note'>>
  ) {
    const currentEntry = entries.find((entry) => entry.id === entryId);
    if (!currentEntry) return;
    const previous = entries;
    const optimistic = entries.map((entry) =>
      entry.id === entryId ? { ...entry, ...updates, updatedAt: new Date().toISOString() } : entry
    );
    setEntries(optimistic);
    setError(null);
    setErrorAction('retry');
    try {
      const updated = await updateFamilyTreasuryEntry(entryId, { ...updates, expectedVersion: currentEntry.version ?? 1 });
      setEntries((current) => current.map((entry) => (entry.id === entryId ? updated : entry)));
    } catch (saveError) {
      setEntries(previous);
      showSaveError(saveError);
    }
  }

  function showSaveError(saveError: unknown) {
    if (saveError instanceof FamilyTreasuryApiError && saveError.status === 409) {
      setError(TREASURY_CONFLICT_MESSAGE);
      setErrorAction('reload');
      return;
    }
    setError(saveError instanceof Error ? saveError.message : SAVE_ERROR);
    setErrorAction('retry');
  }

  return (
    <section className="rounded-2xl border border-red-950/70 bg-slate-950/75 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Скарбниця Dragon House</h2>
          <p className="mt-1 text-sm text-slate-400">
            Це сімейна база ресурсів: паливо, одяг, зброя, магазини та інші корисні точки.
          </p>
        </div>
        {canManage ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Доступно: додати, редагувати або архівувати запис.
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100" role="alert" data-testid="treasury-error">
          {error}
          <button type="button" data-testid="treasury-conflict-refresh" onClick={() => void reload()} className="ml-3 underline">
            {errorAction === 'reload' ? 'Оновити дані' : 'Спробувати ще раз'}
          </button>
        </div>
      ) : null}

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
            placeholder="Новий запис, наприклад: Магазин №30"
          />
          <button
            type="button"
            onClick={() => void addEntry()}
            disabled={!draftTitle.trim() || isSaving}
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

      {isLoading ? <div className="mt-4 text-sm text-slate-300">Завантаження...</div> : null}
      {!isLoading && filteredEntries.length === 0 ? <div className="mt-4 text-sm text-slate-300">Даних поки немає.</div> : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredEntries.map((entry) => (
          <article key={entry.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4" data-testid="treasury-entry-card" data-entry-id={entry.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                {canManage ? (
                  <>
                    <select
                      data-testid="treasury-entry-category"
                      value={entry.category}
                      onChange={(event) => void updateEntry(entry.id, { category: event.target.value as FamilyEconomyCategory })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs uppercase tracking-[0.14em] text-amber-200"
                      aria-label="Категорія запису"
                    >
                      {CATEGORIES.filter((item) => item !== 'all').map((item) => (
                        <option key={item} value={item}>
                          {CATEGORY_LABELS[item]}
                        </option>
                      ))}
                    </select>
                    <input
                      data-testid="treasury-entry-title"
                      value={entry.title}
                      onChange={(event) => void updateEntry(entry.id, { title: event.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-base font-semibold text-white"
                      aria-label="Назва запису"
                    />
                  </>
                ) : (
                  <>
                    <div className="text-xs uppercase tracking-[0.2em] text-amber-300">
                      {CATEGORY_LABELS[entry.category]}
                    </div>
                    <h3 className="mt-1 text-base font-semibold text-white">{entry.title}</h3>
                  </>
                )}
              </div>
              <span className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-300">
                {entry.locationNumber ?? entry.locationReference ?? 'без номера'}
              </span>
            </div>
            {canManage ? (
              <div className="mt-3 grid gap-2">
                <input
                  data-testid="treasury-entry-location"
                  value={entry.locationNumber ?? ''}
                  onChange={(event) => void updateEntry(entry.id, { locationNumber: event.target.value.trim() || null })}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                  placeholder="Номер або коротка локація"
                  aria-label="Номер або локація"
                />
                <textarea
                  data-testid="treasury-entry-description"
                  value={entry.description}
                  onChange={(event) => void updateEntry(entry.id, { description: event.target.value })}
                  rows={3}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                  aria-label="Опис запису"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    data-testid="treasury-entry-price-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={entry.priceAmount ?? ''}
                    onChange={(event) => void updateEntry(entry.id, { priceAmount: event.target.value.trim() ? Number(event.target.value) : null })}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                    placeholder="Ціна"
                    aria-label="Ціна"
                  />
                  <input
                    data-testid="treasury-entry-price-note"
                    value={entry.priceNote ?? entry.price ?? ''}
                    onChange={(event) => void updateEntry(entry.id, { priceNote: event.target.value.trim() || null })}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                    placeholder="Примітка до ціни"
                    aria-label="Примітка до ціни"
                  />
                  <input
                    value={entry.price ?? ''}
                    onChange={(event) => void updateEntry(entry.id, { price: event.target.value.trim() || null })}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                    placeholder="Ціна / умови"
                    aria-label="Ціна або умови"
                  />
                  <input
                    value={entry.note ?? ''}
                    onChange={(event) => void updateEntry(entry.id, { note: event.target.value.trim() || null })}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                    placeholder="Примітка"
                    aria-label="Примітка"
                  />
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-300">{entry.description}</p>
            )}
            {entry.note || entry.price ? (
              <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                {entry.note ?? entry.price}
              </div>
            ) : null}
            {canManage ? (
              <button
                type="button"
                data-testid="treasury-entry-archive"
                onClick={() => void deactivateEntry(entry.id)}
                disabled={isSaving}
                className="mt-3 rounded-lg border border-red-500/50 px-3 py-1.5 text-xs text-red-100 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Архівувати
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
