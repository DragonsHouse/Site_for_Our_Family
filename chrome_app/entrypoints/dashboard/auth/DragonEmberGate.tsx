import { cloneElement, isValidElement, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';

import { DRAGON_HOUSE_ASSETS } from '../../../lib/family-assets';
import { useFamilyAssetUrl } from '../family/use-family-asset-url';

const ENTRANCE_SOURCE = {
  width: 1726,
  height: 911,
} as const;

const ARCH_OPENING = {
  left: 1132,
  top: 259,
  width: 261,
  height: 518,
} as const;

const PORTAL_AMBIENCE_VOLUME = 0.16;

type PortalSoundControlChild = {
  portalSoundControl?: ReactNode;
};

type GateStyle = CSSProperties & {
  '--ember-gate-opening-left': string;
  '--ember-gate-opening-top': string;
  '--ember-gate-opening-width': string;
  '--ember-gate-opening-height': string;
  '--ember-gate-portal-asset'?: string;
};

function calculateCoverOpening(viewportWidth: number, viewportHeight: number): GateStyle {
  const scale = Math.max(viewportWidth / ENTRANCE_SOURCE.width, viewportHeight / ENTRANCE_SOURCE.height);
  const renderedWidth = ENTRANCE_SOURCE.width * scale;
  const renderedHeight = ENTRANCE_SOURCE.height * scale;
  const horizontalOffset = (viewportWidth - renderedWidth) / 2;
  const verticalOffset = (viewportHeight - renderedHeight) / 2;

  return {
    '--ember-gate-opening-left': `${horizontalOffset + ARCH_OPENING.left * scale}px`,
    '--ember-gate-opening-top': `${verticalOffset + ARCH_OPENING.top * scale}px`,
    '--ember-gate-opening-width': `${ARCH_OPENING.width * scale}px`,
    '--ember-gate-opening-height': `${ARCH_OPENING.height * scale}px`,
  };
}

function getViewportSize() {
  return {
    width: window.visualViewport?.width ?? window.innerWidth,
    height: window.visualViewport?.height ?? window.innerHeight,
  };
}

export function DragonEmberGate({ children }: { children: ReactNode }) {
  const [gateStyle, setGateStyle] = useState<GateStyle>(() => calculateCoverOpening(1726, 911));
  const [portalSoundEnabled, setPortalSoundEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const portalBackgroundUrl = useFamilyAssetUrl('login_portal_background');

  useEffect(() => {
    function updateGateStyle() {
      const viewport = getViewportSize();
      setGateStyle(calculateCoverOpening(viewport.width, viewport.height));
    }

    updateGateStyle();
    window.addEventListener('resize', updateGateStyle);
    window.visualViewport?.addEventListener('resize', updateGateStyle);

    return () => {
      window.removeEventListener('resize', updateGateStyle);
      window.visualViewport?.removeEventListener('resize', updateGateStyle);
    };
  }, []);

  async function togglePortalSound() {
    const audio = audioRef.current;
    if (!audio) return;

    if (portalSoundEnabled) {
      audio.pause();
      audio.volume = 0;
      setPortalSoundEnabled(false);
      return;
    }

    try {
      audio.volume = PORTAL_AMBIENCE_VOLUME;
      await audio.play();
      setPortalSoundEnabled(true);
    } catch {
      audio.volume = 0;
      setPortalSoundEnabled(false);
    }
  }

  const portalSoundControl = (
    <button
      type="button"
      className="dh-ember-gate-sound-toggle"
      onClick={togglePortalSound}
      aria-pressed={portalSoundEnabled}
      aria-label={portalSoundEnabled ? 'Вимкнути звук порталу' : 'Увімкнути звук порталу'}
      title={portalSoundEnabled ? 'Вимкнути звук порталу' : 'Увімкнути звук порталу'}
    >
      <span className="dh-ember-gate-sound-icon" aria-hidden="true">
        {portalSoundEnabled ? '♪' : '♩'}
      </span>
      <span className="dh-ember-gate-sound-label">{portalSoundEnabled ? 'Звук увімкнено' : 'Звук порталу'}</span>
    </button>
  );

  const content = isValidElement<PortalSoundControlChild>(children)
    ? cloneElement(children as ReactElement<PortalSoundControlChild>, { portalSoundControl })
    : children;

  return (
    <main
      className="dh-ember-gate"
      style={
        {
          ...gateStyle,
          '--ember-gate-portal-asset': `url('${portalBackgroundUrl}')`,
        } as GateStyle
      }
      aria-labelledby="ember-gate-heading"
    >
      <section className="dh-ember-gate-citadel" aria-label="Dragon House entrance">
        <div className="dh-ember-gate-scene">
          <img className="dh-ember-gate-frame" src={DRAGON_HOUSE_ASSETS.emberGateBackground} alt="" aria-hidden="true" />
          <div className="dh-ember-gate-arch-opening">
            <div className="dh-ember-gate-portal" aria-hidden="true">
              <div className="dh-ember-gate-portal-asset" />
              <div className="dh-ember-gate-portal-fire" />
              <div className="dh-ember-gate-portal-smoke" />
              <div className="dh-ember-gate-portal-embers" />
              <div className="dh-ember-gate-portal-vignette" />
            </div>
            <div className="dh-ember-gate-form-panel">{content}</div>
            <audio ref={audioRef} src={DRAGON_HOUSE_ASSETS.portalAmbientAudio} loop preload="none" />
          </div>
        </div>
      </section>
      <h1 id="ember-gate-heading" className="dh-sr-only">
        Dragon House Family Hub
      </h1>
    </main>
  );
}
