import { FAMILY_RANKS, RANK_PROGRESSIONS } from '../../../lib/family-ranks';
import { DragonBadge, DragonCard, DragonEmptyState, DragonHero, DragonPanel } from '../dragon-ui/dragon-ui';

export function FamilyRanks() {
  return (
    <section className="space-y-4">
      <DragonHero
        eyebrow="Dragon hierarchy"
        title="Ранги та підвищення"
        description="Структурована модель росту в Dragon House. «Мій кабінет» рахує прогрес на її основі, а старші бачать чітку драбину відповідальності."
        className="dh-command-hero"
      >
        <div className="dh-status-pill is-active">Жива модель рангів</div>
      </DragonHero>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <DragonPanel className="p-4" variant="raised">
          <div className="mb-3">
            <p className="dh-command-kicker">Драбина</p>
            <h3 className="mt-1 text-lg font-semibold text-white">Рівні сім’ї</h3>
          </div>
          <div className="space-y-2">
            {FAMILY_RANKS.map((rank) => (
              <DragonCard key={rank.level} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="dh-command-meta">Ранг {rank.level}</div>
                    <div className="mt-1 text-sm font-semibold text-white">{rank.title}</div>
                  </div>
                  {rank.level >= 9 ? <DragonBadge tone="gold">Старші</DragonBadge> : null}
                </div>
              </DragonCard>
            ))}
          </div>
        </DragonPanel>

        <div className="space-y-4">
          {RANK_PROGRESSIONS.length ? (
            RANK_PROGRESSIONS.map((progression) => (
              <DragonPanel key={progression.title} variant="raised" className="p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="dh-command-kicker">Підвищення</p>
                    <h3 className="mt-1 text-xl font-semibold text-white">{progression.title}</h3>
                  </div>
                  <DragonBadge tone="ember">{progression.requirements.length} вимог</DragonBadge>
                </div>
                <ul className="mt-4 grid gap-2">
                  {progression.requirements.map((requirement) => (
                    <li key={requirement.id} className="dh-command-list-item px-3 py-2 text-sm text-stone-100">
                      <span>{requirement.label}</span>
                      {requirement.verifierLabel ? (
                        <span className="ml-2 text-xs font-semibold text-amber-200">({requirement.verifierLabel})</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {progression.notes?.length ? (
                  <div className="dh-command-note mt-3 p-3 text-sm text-amber-100">{progression.notes.join(' ')}</div>
                ) : null}
              </DragonPanel>
            ))
          ) : (
            <DragonEmptyState title="Модель рангів ще не заповнена" description="Коли з’являться вимоги, вони будуть видимі тут." />
          )}
        </div>
      </div>
    </section>
  );
}
