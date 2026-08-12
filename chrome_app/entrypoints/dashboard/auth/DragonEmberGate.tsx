import { cloneElement, isValidElement, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';

import { DRAGON_HOUSE_ASSETS } from '../../../lib/family-assets';

const ENTRANCE_SOURCE = {
  width: 1726,
  height: 911,
} as const;

const ARCH_FORM_REGION = {
  left: 1142,
  top: 245,
  width: 265,
  height: 547,
} as const;

const CENTER_ARCH_UNDER_ASPECT_RATIO = 1.15;
const PORTAL_AMBIENCE_VOLUME = 0.16;

type PortalSoundControlChild = {
  portalSoundControl?: ReactNode;
};

type GateStyle = CSSProperties & {
  '--ember-gate-rendered-left': string;
  '--ember-gate-rendered-top': string;
  '--ember-gate-rendered-width': string;
  '--ember-gate-rendered-height': string;
  '--ember-gate-form-left': string;
  '--ember-gate-form-top': string;
  '--ember-gate-form-width': string;
  '--ember-gate-form-height': string;
};

function calculateCoverFormRegion(viewportWidth: number, viewportHeight: number): GateStyle {
  const scale = Math.max(viewportWidth / ENTRANCE_SOURCE.width, viewportHeight / ENTRANCE_SOURCE.height);
  const renderedWidth = ENTRANCE_SOURCE.width * scale;
  const renderedHeight = ENTRANCE_SOURCE.height * scale;
  const archCenter = (ARCH_FORM_REGION.left + ARCH_FORM_REGION.width / 2) * scale;
  const horizontalOffset =
    viewportWidth / viewportHeight < CENTER_ARCH_UNDER_ASPECT_RATIO
      ? viewportWidth / 2 - archCenter
      : (viewportWidth - renderedWidth) / 2;
  const verticalOffset = (viewportHeight - renderedHeight) / 2;

  return {
    '--ember-gate-rendered-left': `${horizontalOffset}px`,
    '--ember-gate-rendered-top': `${verticalOffset}px`,
    '--ember-gate-rendered-width': `${renderedWidth}px`,
    '--ember-gate-rendered-height': `${renderedHeight}px`,
    '--ember-gate-form-left': `${horizontalOffset + ARCH_FORM_REGION.left * scale}px`,
    '--ember-gate-form-top': `${verticalOffset + ARCH_FORM_REGION.top * scale}px`,
    '--ember-gate-form-width': `${ARCH_FORM_REGION.width * scale}px`,
    '--ember-gate-form-height': `${ARCH_FORM_REGION.height * scale}px`,
  };
}

function getViewportSize() {
  return {
    width: window.visualViewport?.width ?? window.innerWidth,
    height: window.visualViewport?.height ?? window.innerHeight,
  };
}

export function DragonEmberGate({ children }: { children: ReactNode }) {
  const [gateStyle, setGateStyle] = useState<GateStyle>(() => calculateCoverFormRegion(1726, 911));
  const [portalSoundEnabled, setPortalSoundEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    function updateGateStyle() {
      const viewport = getViewportSize();
      setGateStyle(calculateCoverFormRegion(viewport.width, viewport.height));
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
    <main className="dh-ember-gate" style={gateStyle} aria-labelledby="ember-gate-heading">
      <section className="dh-ember-gate-citadel" aria-label="Dragon House entrance">
        <div className="dh-ember-gate-scene">
          <div className="dh-ember-gate-arch-backdrop" aria-hidden="true">
            <video
              className="dh-ember-gate-arch-video"
              src={DRAGON_HOUSE_ASSETS.loginPortalMotion}
              autoPlay
              muted
              loop
              playsInline
            />
            <div className="dh-ember-gate-matte-layer" />
          </div>
          <img className="dh-ember-gate-frame" src={DRAGON_HOUSE_ASSETS.emberGateBackground} alt="" aria-hidden="true" />
          <div className="dh-ember-gate-form-panel">{content}</div>
          <audio ref={audioRef} src={DRAGON_HOUSE_ASSETS.portalAmbientAudio} loop preload="none" />
        </div>
      </section>
      <h1 id="ember-gate-heading" className="dh-sr-only">
        Dragon House Family Hub
      </h1>
    </main>
  );
}
