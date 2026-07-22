import { useCallback, useEffect, useRef, useState } from 'react';
import { DRAGON_FIRE_AUDIO } from '../../../lib/dragon-loading-config';

type AudioState = 'idle' | 'playing' | 'muted' | 'blocked' | 'unavailable';

function readSoundPreference() {
  try {
    return window.localStorage.getItem(DRAGON_FIRE_AUDIO.preferenceKey) !== 'muted';
  } catch {
    return true;
  }
}

function saveSoundPreference(enabled: boolean) {
  try {
    window.localStorage.setItem(DRAGON_FIRE_AUDIO.preferenceKey, enabled ? 'enabled' : 'muted');
  } catch {
    // Non-sensitive preference only; failing to store it must not block login.
  }
}

export function useFireAudio(active: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const [enabled, setEnabled] = useState(readSoundPreference);
  const [state, setState] = useState<AudioState>(enabled ? 'idle' : 'muted');

  const stopFade = useCallback(() => {
    if (fadeTimerRef.current !== null) {
      window.clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }, []);

  const fadeTo = useCallback(
    (target: number, after?: () => void) => {
      const audio = audioRef.current;
      if (!audio) return;
      stopFade();
      fadeTimerRef.current = window.setInterval(() => {
        const current = audio.volume;
        const next = current + (target > current ? 0.025 : -0.035);
        audio.volume = Math.max(0, Math.min(DRAGON_FIRE_AUDIO.volume, target > current ? Math.min(next, target) : Math.max(next, target)));
        if (Math.abs(audio.volume - target) < 0.01) {
          audio.volume = target;
          stopFade();
          after?.();
        }
      }, DRAGON_FIRE_AUDIO.fadeStepMs);
    },
    [stopFade],
  );

  useEffect(() => {
    if (!active || !enabled) return undefined;
    const audio = new Audio(DRAGON_FIRE_AUDIO.loopUrl);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;
    audioRef.current = audio;
    let cancelled = false;

    void audio
      .play()
      .then(() => {
        if (cancelled) return;
        setState('playing');
        fadeTo(DRAGON_FIRE_AUDIO.volume);
      })
      .catch(() => {
        if (cancelled) return;
        setState('blocked');
      });

    return () => {
      cancelled = true;
      stopFade();
      if (audioRef.current) {
        const cleanupAudio = audioRef.current;
        fadeTo(0, () => {
          cleanupAudio.pause();
          cleanupAudio.currentTime = 0;
        });
        window.setTimeout(() => {
          cleanupAudio.pause();
          cleanupAudio.currentTime = 0;
        }, 520);
      }
      audioRef.current = null;
    };
  }, [active, enabled, fadeTo, stopFade]);

  useEffect(() => {
    if (!active) {
      setState(enabled ? 'idle' : 'muted');
    }
  }, [active, enabled]);

  const toggle = useCallback(() => {
    setEnabled((current) => {
      const next = !current;
      saveSoundPreference(next);
      if (!next && audioRef.current) {
        const audio = audioRef.current;
        audio.pause();
        audio.currentTime = 0;
        audioRef.current = null;
      }
      setState(next ? 'idle' : 'muted');
      return next;
    });
  }, []);

  return {
    enabled,
    state,
    toggle,
  };
}
