/** Existing route coercion semantics; do not replace with parseInt/clamping. */
export function positiveInt(value: unknown, fallback: number, min: number, max: number): number {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
}

export function stringQuery(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
