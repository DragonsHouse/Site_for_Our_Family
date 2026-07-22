import { DragonHouseCrest } from '../family/dragon-house-crest';
import { useFireAudio } from '../hooks/use-fire-audio';
import { useLoadingSequence } from '../hooks/use-loading-sequence';
import { EmberParticles } from './EmberParticles';
import { FireProgressBar } from './FireProgressBar';
import { SoundToggle } from './SoundToggle';

export function DragonLoadingScreen({
  active,
  onComplete,
}: {
  active: boolean;
  onComplete: () => void;
}) {
  const { progress, message, quote, phase } = useLoadingSequence(active, onComplete);
  const audio = useFireAudio(active);
  const flare = phase === 'flare';

  if (!active) return null;

  return (
    <div className={flare ? 'dh-loading-screen is-flare' : 'dh-loading-screen'} role="status" aria-live="polite">
      <div className="dh-loading-backdrop" aria-hidden="true" />
      <EmberParticles intense={flare} />

      <section className="dh-loading-panel">
        <div className="dh-loading-heading">
          <DragonHouseCrest slot="dragon_house_logo" size="lg" />
          <div>
            <p>DRAGON HOUSE</p>
            <h2>Запалюємо Вічне Полум’я</h2>
          </div>
        </div>

        <div className="dh-loading-inner">
          <div className="dh-loading-label">
            <span className="dh-loading-dragon-mark" aria-hidden="true">D</span>
            <div>
              <strong>Dragon House</strong>
              <span>{message}</span>
            </div>
          </div>

          <FireProgressBar progress={progress} flare={flare} />

          <p className="dh-loading-secondary">
            {flare ? 'Ворота штабу відчинено.' : 'Завантаження штабу...'}
          </p>
        </div>

        <div className="dh-loading-footer">
          <blockquote>{quote}</blockquote>
          <SoundToggle enabled={audio.enabled} state={audio.state} onToggle={audio.toggle} />
        </div>
      </section>
    </div>
  );
}
