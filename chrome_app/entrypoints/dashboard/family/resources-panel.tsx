import { useMemo, useState } from 'react';
import { FAMILY_RESOURCES, QUANT_NEWS_ITEMS } from '../../../lib/family-data';
import { canManageResources } from '../../../lib/family-permissions';
import { QUANT_NEWS_PROVIDER, QUANT_RP_RESOURCE_LINKS } from '../../../lib/family-resources';
import type { FamilyUser, ResourceCategory } from '../../../lib/family-types';
import { DragonBadge, DragonButton, DragonCard, DragonEmptyState, DragonHero, DragonInput, DragonPanel } from '../dragon-ui/dragon-ui';

const CATEGORY_LABELS: Record<ResourceCategory, string> = {
  general: 'Загальні правила',
  crime: 'Кримінал',
  captures_business: 'Капти / бізнеси',
  government: 'Державні структури',
  codes_laws: 'Кодекси / закони',
  statutes: 'Статути',
  quant_news: 'Новини Quant'
};

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ResourceCategory[];

function categoryDescription(category: ResourceCategory) {
  const descriptions: Record<ResourceCategory, string> = {
    general: 'Базові правила сервера й поведінки.',
    crime: 'Матеріали для кримінальних структур і активностей.',
    captures_business: 'Зони, капти, бізнеси та території.',
    government: 'Державні структури, регламенти та взаємодія.',
    codes_laws: 'Кодекси, закони й процедурні документи.',
    statutes: 'Статути фракцій і організацій.',
    quant_news: 'Офіційна стрічка новин Quant.'
  };
  return descriptions[category];
}

function formatResourceDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('uk-UA');
}

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
      <DragonHero
        eyebrow="Dragon archives"
        title="Ресурси Dragon House"
        description="Внутрішні файли сімʼї та зовнішня база знань Quant RP. Hub відкриває оригінальні джерела й не копіює тексти правил."
        className="dh-command-hero"
      >
        <div className="grid gap-2 text-sm">
          <div className="dh-status-pill is-active">{FAMILY_RESOURCES.length} сімейний файл</div>
          <div className="dh-status-pill">{QUANT_RP_RESOURCE_LINKS.length} зовнішніх джерел</div>
        </div>
      </DragonHero>

      <DragonPanel variant="raised" className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="dh-command-kicker">Сімейні матеріали</p>
            <h3 className="mt-1 text-2xl font-semibold text-white">Файли штабу</h3>
            <p className="dh-command-copy mt-2">Поточні матеріали, які команда використовує як оперативні посилання.</p>
          </div>
          {canManageResourceData ? (
            <DragonBadge tone="gold">Керування через конфігурацію ресурсів</DragonBadge>
          ) : (
            <DragonBadge tone="muted">Перегляд</DragonBadge>
          )}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {FAMILY_RESOURCES.map((resource) => (
            <DragonCard key={resource.id} className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="dh-command-kicker">Файл сімʼї</p>
                  <h4 className="mt-1 text-lg font-semibold text-white">{resource.title}</h4>
                </div>
                <DragonBadge tone="success">{resource.status}</DragonBadge>
              </div>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="dh-command-label">Дата</dt>
                  <dd className="text-stone-100">{formatResourceDate(resource.date)}</dd>
                </div>
                <div>
                  <dt className="dh-command-label">Файл / опис</dt>
                  <dd className="text-stone-100">{resource.fileDescription}</dd>
                </div>
                <div>
                  <dt className="dh-command-label">Оновив</dt>
                  <dd className="text-stone-100">{resource.updatedBy ?? 'Dragon House'}</dd>
                </div>
                <div>
                  <dt className="dh-command-label">Оновлено</dt>
                  <dd className="text-stone-100">{resource.updatedAt ? formatResourceDate(resource.updatedAt) : 'невідомо'}</dd>
                </div>
              </dl>
              <DragonButton href={resource.url} target="_blank" rel="noreferrer" className="mt-4">
                Відкрити файл
              </DragonButton>
            </DragonCard>
          ))}
        </div>
      </DragonPanel>

      <DragonPanel variant="raised" className="p-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="dh-command-kicker">База знань Quant RP</p>
            <h3 className="mt-1 text-2xl font-semibold text-white">Офіційні джерела</h3>
            <p className="dh-command-copy mt-2">{categoryDescription(category)}</p>
          </div>
          <DragonInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="lg:max-w-sm"
            placeholder="Пошук ресурсу"
            aria-label="Пошук ресурсу"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Категорії ресурсів">
          {CATEGORIES.map((item) => (
            <DragonButton
              key={item}
              type="button"
              variant={category === item ? 'primary' : 'quiet'}
              onClick={() => setCategory(item)}
              aria-pressed={category === item}
            >
              {CATEGORY_LABELS[item]}
            </DragonButton>
          ))}
        </div>

        {category !== 'quant_news' ? (
          <>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {links.map((link) => (
                <DragonCard key={link.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="dh-command-kicker">{CATEGORY_LABELS[link.category]}</p>
                    {link.isPinned ? <DragonBadge tone="gold">Важливе</DragonBadge> : null}
                  </div>
                  <h4 className="mt-2 text-base font-semibold text-white">{link.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-stone-300">{link.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(link.tags ?? []).map((tag) => (
                      <DragonBadge key={tag} tone="muted">{tag}</DragonBadge>
                    ))}
                  </div>
                  <DragonButton href={link.url} target="_blank" rel="noreferrer" variant="secondary" className="mt-4">
                    Відкрити джерело
                  </DragonButton>
                </DragonCard>
              ))}
            </div>
            {!links.length ? (
              <div className="mt-4">
                <DragonEmptyState title="Нічого не знайдено" description="Зміни запит або обери іншу категорію ресурсів." />
              </div>
            ) : null}
          </>
        ) : (
          <div className="mt-4 space-y-4">
            <DragonCard className="p-4">
              <p className="dh-command-kicker">Офіційне джерело</p>
              <h4 className="mt-1 text-base font-semibold text-white">{QUANT_NEWS_PROVIDER.sourceName}</h4>
              <p className="mt-2 text-sm leading-6 text-stone-300">
                Новини відкриваються з офіційного джерела. Приватні токени й неофіційний доступ не використовуються.
              </p>
              <DragonButton href={QUANT_NEWS_PROVIDER.sourceUrl} target="_blank" rel="noreferrer" className="mt-4">
                Відкрити джерело
              </DragonButton>
            </DragonCard>
            <div className="grid gap-4 md:grid-cols-2">
              {QUANT_NEWS_ITEMS.map((item) => (
                <DragonCard key={item.id} className="p-4">
                  <p className="dh-command-kicker">{item.sourceName}</p>
                  <h4 className="mt-1 text-base font-semibold text-white">{item.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-stone-300">{item.body}</p>
                  <div className="mt-3 text-xs text-stone-500">
                    {new Date(item.publishedAt).toLocaleString('uk-UA')}
                  </div>
                </DragonCard>
              ))}
            </div>
          </div>
        )}
      </DragonPanel>
    </div>
  );
}
