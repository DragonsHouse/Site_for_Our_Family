// Legacy compatibility data and UI preferences only; never canonical shared state.
import { assertNoMojibakeSeed, sanitizeFamilyTextDeep } from './text-sanitizer';

export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      const seed = sanitizeFamilyTextDeep(fallback);
      assertNoMojibakeSeed(key, seed);
      window.localStorage.setItem(key, JSON.stringify(seed));
      return seed;
    }
    const parsed = JSON.parse(raw) as T;
    const sanitized = sanitizeFamilyTextDeep(parsed);
    if (JSON.stringify(sanitized) !== raw) writeJson(key, sanitized);
    return sanitized;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(sanitizeFamilyTextDeep(value)));
}
