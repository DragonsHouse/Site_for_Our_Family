export type DragonResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: Error };

export function ok<T>(value: T): DragonResult<T> {
  return { ok: true, value };
}

export function fail<T = never>(error: Error): DragonResult<T> {
  return { ok: false, error };
}
