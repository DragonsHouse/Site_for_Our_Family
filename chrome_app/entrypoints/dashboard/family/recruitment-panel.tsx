import { useEffect, useState } from 'react';
import {
  getBackendRecruitmentSettings,
  updateBackendRecruitmentSettings
} from '../../../lib/family-content-backend-client';
import { canManageFamilyContent } from '../../../lib/family-permissions';
import type { FamilyUser, RecruitmentSettings } from '../../../lib/family-types';

const EMPTY_RECRUITMENT: RecruitmentSettings = {
  isOpen: false,
  text: '',
  requirements: [],
  contact: '',
  author: 'Dragon House',
  updatedAt: new Date(0).toISOString(),
  version: 1,
};

export function RecruitmentPanel({ currentUser }: { currentUser: FamilyUser }) {
  const canManage = canManageFamilyContent(currentUser);
  const [settings, setSettings] = useState<RecruitmentSettings>(EMPTY_RECRUITMENT);
  const [draft, setDraft] = useState<RecruitmentSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    getBackendRecruitmentSettings(controller.signal)
      .then(setSettings)
      .catch((loadError) => {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : 'Набір тимчасово недоступний.');
      });
    return () => controller.abort();
  }, []);

  async function refresh() {
    setError(null);
    setSettings(await getBackendRecruitmentSettings());
    setDraft(null);
  }

  async function saveDraft() {
    if (!draft || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateBackendRecruitmentSettings(draft);
      setSettings(updated);
      setDraft(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не вдалося зберегти набір.');
    } finally {
      setSaving(false);
    }
  }

  const active = draft ?? settings;

  return (
    <section className="rounded-2xl border border-red-950/70 bg-slate-950/75 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Набір у Dragon House</h2>
          <p className="mt-1 text-sm text-slate-400">
            Статус, опис, вимоги й контакт зберігаються в backend, тому всі учасники бачать одну версію.
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            {draft ? (
              <>
                <button type="button" onClick={() => setDraft(null)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-100">
                  Скасувати
                </button>
                <button
                  type="button"
                  onClick={() => void saveDraft()}
                  disabled={saving || !active.text.trim() || !active.contact.trim() || active.requirements.every((item) => !item.trim())}
                  className="rounded-lg border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100 disabled:opacity-50"
                >
                  Зберегти
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setDraft(settings)} className="rounded-lg border border-amber-500/60 px-3 py-2 text-xs text-amber-100">
                Редагувати
              </button>
            )}
            <button type="button" onClick={() => void refresh()} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-100">
              Оновити дані
            </button>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="text-xs uppercase tracking-[0.22em] text-amber-300">Статус</div>
        {draft ? (
          <label className="mt-2 flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={active.isOpen}
              onChange={(event) => setDraft({ ...active, isOpen: event.target.checked })}
            />
            Набір відкритий
          </label>
        ) : (
          <div className="mt-1 text-2xl font-semibold text-white">
            {settings.isOpen ? 'Набір відкритий' : 'Набір закритий'}
          </div>
        )}

        {draft ? (
          <div className="mt-4 grid gap-3">
            <textarea
              rows={5}
              value={active.text}
              onChange={(event) => setDraft({ ...active, text: event.target.value })}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm leading-6 text-slate-100"
              aria-label="Опис набору"
            />
            <textarea
              rows={5}
              value={active.requirements.join('\n')}
              onChange={(event) => setDraft({ ...active, requirements: event.target.value.split('\n') })}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm leading-6 text-slate-100"
              aria-label="Вимоги набору"
            />
            <input
              value={active.contact}
              onChange={(event) => setDraft({ ...active, contact: event.target.value })}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              aria-label="Контакт набору"
            />
          </div>
        ) : (
          <>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-300">{settings.text}</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="font-semibold text-white">Вимоги</h3>
                <ul className="mt-2 space-y-2 text-sm text-slate-300">
                  {settings.requirements.map((item) => (
                    <li key={item} className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm">
                <div className="text-slate-500">Контакт</div>
                <div className="mt-1 text-slate-100">{settings.contact}</div>
                <div className="mt-3 text-slate-500">Оновлено</div>
                <div className="mt-1 text-slate-100">{new Date(settings.updatedAt).toLocaleString('uk-UA')}</div>
                <div className="mt-3 text-slate-500">Версія</div>
                <div className="mt-1 text-slate-100">{settings.version ?? 1}</div>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
