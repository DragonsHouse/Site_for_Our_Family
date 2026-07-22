import { useEffect, useMemo, useState } from 'react';
import { DRAGON_LOADING_DURATION, DRAGON_LOADING_MESSAGES, DRAGON_LOADING_QUOTES } from '../../../lib/dragon-loading-config';

export type DragonLoadingPhase = 'loading' | 'flare' | 'done';

export function useLoadingSequence(active: boolean, onComplete: () => void) {
  const durationMs = useMemo(
    () =>
      DRAGON_LOADING_DURATION.minMs +
      Math.round(Math.random() * (DRAGON_LOADING_DURATION.maxMs - DRAGON_LOADING_DURATION.minMs)),
    [active],
  );
  const quote = useMemo(
    () => DRAGON_LOADING_QUOTES[Math.floor(Math.random() * DRAGON_LOADING_QUOTES.length)],
    [active],
  );
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [phase, setPhase] = useState<DragonLoadingPhase>('loading');

  useEffect(() => {
    if (!active) return undefined;
    let frame = 0;
    let completed = false;
    const startedAt = performance.now();
    setProgress(0);
    setMessageIndex(0);
    setPhase('loading');

    const animate = (now: number) => {
      const elapsed = now - startedAt;
      const ratio = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - ratio, 2.4);
      const flicker = ratio < 1 ? Math.sin(now / 105) * 1.2 + Math.sin(now / 47) * 0.6 : 0;
      setProgress(Math.min(100, Math.max(0, Math.round(eased * 100 + flicker))));
      if (ratio < 1) {
        frame = requestAnimationFrame(animate);
      } else if (!completed) {
        completed = true;
        setProgress(100);
        setPhase('flare');
        window.setTimeout(() => {
          setPhase('done');
          onComplete();
        }, DRAGON_LOADING_DURATION.flareMs);
      }
    };

    frame = requestAnimationFrame(animate);
    const messageTimer = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % DRAGON_LOADING_MESSAGES.length);
    }, DRAGON_LOADING_DURATION.messageIntervalMs);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(messageTimer);
    };
  }, [active, durationMs, onComplete]);

  return {
    progress,
    phase,
    message: DRAGON_LOADING_MESSAGES[messageIndex],
    quote,
  };
}
