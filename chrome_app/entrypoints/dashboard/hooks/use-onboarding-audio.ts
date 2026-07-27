import { useCallback, useEffect, useRef, useState } from 'react';

type OnboardingAudioState = 'idle' | 'playing' | 'muted' | 'blocked' | 'unavailable';

const ONBOARDING_AUDIO_PREFERENCE_KEY = 'dragon_house_onboarding_audio_v1';

function readPreference() {
  try {
    return window.localStorage.getItem(ONBOARDING_AUDIO_PREFERENCE_KEY) !== 'muted';
  } catch {
    return true;
  }
}

function savePreference(enabled: boolean) {
  try {
    window.localStorage.setItem(ONBOARDING_AUDIO_PREFERENCE_KEY, enabled ? 'enabled' : 'muted');
  } catch {
    // Audio is decorative; storage failures should never block onboarding.
  }
}

export function useOnboardingAudio() {
  const contextRef = useRef<AudioContext | null>(null);
  const crackleTimerRef = useRef<number | null>(null);
  const droneRef = useRef<OscillatorNode | null>(null);
  const droneGainRef = useRef<GainNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const [enabled, setEnabled] = useState(readPreference);
  const [state, setState] = useState<OnboardingAudioState>(enabled ? 'idle' : 'muted');

  const stop = useCallback(() => {
    if (crackleTimerRef.current !== null) {
      window.clearInterval(crackleTimerRef.current);
      crackleTimerRef.current = null;
    }
    const context = contextRef.current;
    try {
      droneRef.current?.stop();
    } catch {
      // The oscillator may already be stopped by browser cleanup.
    }
    droneRef.current = null;
    droneGainRef.current = null;
    context?.close().catch(() => undefined);
    contextRef.current = null;
    gainRef.current = null;
    setState(enabled ? 'idle' : 'muted');
  }, [enabled]);

  const createContext = useCallback((forceEnabled = false) => {
    if (!enabled && !forceEnabled) {
      setState('muted');
      return null;
    }
    if (contextRef.current) return contextRef.current;
    const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextClass) {
      setState('unavailable');
      return null;
    }

    try {
      const context = new AudioContextClass();
      const gain = context.createGain();
      gain.gain.value = 0.014;
      gain.connect(context.destination);
      contextRef.current = context;
      gainRef.current = gain;
      return context;
    } catch {
      setState('blocked');
      return null;
    }
  }, [enabled]);

  const start = useCallback((forceEnabled = false) => {
    if (contextRef.current) return;
    const context = createContext(forceEnabled);
    const gain = gainRef.current;
    if (!context || !gain) return;

    try {
      const drone = context.createOscillator();
      const droneGain = context.createGain();
      drone.type = 'sine';
      drone.frequency.value = 48;
      droneGain.gain.value = 0.004;
      drone.connect(droneGain);
      droneGain.connect(gain);
      drone.start();
      droneRef.current = drone;
      droneGainRef.current = droneGain;
      setState('playing');

      crackleTimerRef.current = window.setInterval(() => {
        const activeContext = contextRef.current;
        const activeGain = gainRef.current;
        if (!activeContext || !activeGain) return;
        const oscillator = activeContext.createOscillator();
        const emberGain = activeContext.createGain();
        const now = activeContext.currentTime;
        oscillator.type = 'triangle';
        oscillator.frequency.value = 90 + Math.random() * 160;
        emberGain.gain.setValueAtTime(0.0001, now);
        emberGain.gain.exponentialRampToValueAtTime(0.012 + Math.random() * 0.018, now + 0.018);
        emberGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18 + Math.random() * 0.12);
        oscillator.connect(emberGain);
        emberGain.connect(activeGain);
        oscillator.start(now);
        oscillator.stop(now + 0.34);
      }, 520);
    } catch {
      setState('blocked');
      stop();
    }
  }, [createContext, stop]);

  const playConfirmation = useCallback(() => {
    const context = createContext();
    const gain = gainRef.current;
    if (!context || !gain) return;
    const now = context.currentTime;
    const sealGain = context.createGain();
    sealGain.gain.setValueAtTime(0.0001, now);
    sealGain.gain.exponentialRampToValueAtTime(0.032, now + 0.03);
    sealGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);
    sealGain.connect(gain);

    for (const [index, frequency] of [132, 198, 264].entries()) {
      const oscillator = context.createOscillator();
      oscillator.type = index === 0 ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.045);
      oscillator.connect(sealGain);
      oscillator.start(now + index * 0.045);
      oscillator.stop(now + 0.74);
    }
  }, [createContext]);

  const enableAndStart = useCallback(() => {
    savePreference(true);
    setEnabled(true);
    setState('idle');
    start(true);
  }, [start]);

  const toggle = useCallback(() => {
    setEnabled((current) => {
      const next = !current;
      savePreference(next);
      if (!next) {
        if (crackleTimerRef.current !== null) {
          window.clearInterval(crackleTimerRef.current);
          crackleTimerRef.current = null;
        }
        contextRef.current?.close().catch(() => undefined);
        contextRef.current = null;
        gainRef.current = null;
        setState('muted');
      } else {
        setState('idle');
      }
      return next;
    });
  }, []);

  useEffect(() => stop, [stop]);

  return { enabled, state, start, stop, toggle, enableAndStart, playConfirmation };
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
