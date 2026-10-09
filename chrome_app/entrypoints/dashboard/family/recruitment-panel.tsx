import { useEffect, useState } from 'react';
import {
  getBackendRecruitmentSettings,
  updateBackendRecruitmentSettings
} from '../../../lib/family-content-backend-client';
import { canManageFamilyContent } from '../../../lib/family-permissions';
import type { FamilyUser, RecruitmentSettings } from '../../../lib/family-types';
import {
  DragonBadge,
  DragonButton,
  DragonCard,
  DragonCheckbox,
  DragonHero,
  DragonInput,
  DragonPanel,
  DragonStatusMessage,
  DragonTextarea
} from '../dragon-ui/dragon-ui';

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
  const hasUsableDraft = active.text.trim() && active.contact.trim() && active.requirements.some((item) => item.trim());

  return (
    <section className="space-y-4">
      <DragonHero
        eyebrow="Recruitment"
        title="Набір у Dragon House"
        description="Статус, опис, вимоги й контакт зберігаються в backend, тому всі учасники бачать одну версію."
        className="dh-command-hero"
      >
        <div className={settings.isOpen ? 'dh-status-pill is-open' : 'dh-status-pill is-closed'}>
          {settings.isOpen ? 'Набір відкритий' : 'Набір закритий'}
        </div>
      </DragonHero>

      {error ? (
        <DragonStatusMessage tone="error" title="Набір не синхронізовано">
          {error}
        </DragonStatusMessage>
      ) : null}

      <DragonPanel variant="raised" className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="dh-command-kicker">Поточний статус</p>
            <h3 className="mt-1 text-2xl font-semibold text-white">
              {active.isOpen ? 'Ворота відкриті для кандидатів' : 'Набір поставлено на паузу'}
            </h3>
            <p className="dh-command-copy mt-2">
              {active.isOpen
                ? 'Кандидати можуть звертатись до контактної особи та проходити вимоги.'
                : 'Зовнішній набір зараз неактивний. Інформація лишається видимою для сім’ї.'}
            </p>
          </div>
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              {draft ? (
                <>
                  <DragonButton type="button" variant="quiet" onClick={() => setDraft(null)}>
                    Скасувати
                  </DragonButton>
                  <DragonButton
                    type="button"
                    onClick={() => void saveDraft()}
                    loading={saving}
                    disabled={saving || !hasUsableDraft}
                  >
                    Зберегти
                  </DragonButton>
                </>
              ) : (
                <DragonButton type="button" onClick={() => setDraft(settings)}>
                  Редагувати
                </DragonButton>
              )}
              <DragonButton type="button" variant="secondary" onClick={() => void refresh()}>
                Оновити дані
              </DragonButton>
            </div>
          ) : null}
        </div>

        {draft ? (
          <div className="mt-5 grid gap-4">
            <DragonCheckbox
              checked={active.isOpen}
              onCheckedChange={(checked) => setDraft({ ...active, isOpen: checked })}
              label="Набір відкритий"
              description="Перемикач змінює спільний backend-статус після збереження."
            />
            <DragonTextarea
              rows={5}
              value={active.text}
              onChange={(event) => setDraft({ ...active, text: event.target.value })}
              aria-label="Опис набору"
              placeholder="Коротко поясни, кого шукає Dragon House."
            />
            <DragonTextarea
              rows={5}
              value={active.requirements.join('\n')}
              onChange={(event) => setDraft({ ...active, requirements: event.target.value.split('\n') })}
              aria-label="Вимоги набору"
              placeholder="Кожна вимога з нового рядка"
            />
            <DragonInput
              value={active.contact}
              onChange={(event) => setDraft({ ...active, contact: event.target.value })}
              label="Контакт"
              aria-label="Контакт набору"
              placeholder="Хто відповідає за кандидатів"
            />
          </div>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <DragonCard className="p-4">
              <DragonBadge tone={settings.isOpen ? 'success' : 'muted'}>{settings.isOpen ? 'Відкрито' : 'Закрито'}</DragonBadge>
              <p className="mt-4 whitespace-pre-line text-sm leading-7 text-stone-200">{settings.text || 'Опис набору ще не заповнений.'}</p>
              <div className="mt-5">
                <h4 className="text-base font-semibold text-white">Вимоги</h4>
                {settings.requirements.length ? (
                  <ul className="mt-3 grid gap-2">
                    {settings.requirements.map((item) => (
                      <li key={item} className="dh-command-list-item px-3 py-2 text-sm text-stone-200">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="dh-command-empty mt-3 text-sm">Вимоги ще не заповнені.</p>
                )}
              </div>
            </DragonCard>

            <DragonCard className="p-4">
              <dl className="grid gap-4 text-sm">
                <div>
                  <dt className="dh-command-label">Контакт</dt>
                  <dd className="mt-1 text-stone-100">{settings.contact || 'Не вказано'}</dd>
                </div>
                <div>
                  <dt className="dh-command-label">Оновлено</dt>
                  <dd className="mt-1 text-stone-100">{new Date(settings.updatedAt).toLocaleString('uk-UA')}</dd>
                </div>
              </dl>
              <details className="dh-technical-details">
                <summary>Технічні деталі</summary>
                <p className="mt-2 text-sm">Версія backend-запису: {settings.version ?? 1}</p>
              </details>
            </DragonCard>
          </div>
        )}
      </DragonPanel>
    </section>
  );
}
