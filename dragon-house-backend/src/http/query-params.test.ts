import { describe, expect, it } from 'vitest';
import { positiveInt, stringQuery } from './query-params.js';

describe('shared route query coercion compatibility', () => {
  it('accepts existing Number coercions and boundary values without clamping', () => {
    for (const value of ['1', 1, ' 2 ', '1e2', 100]) {
      expect(positiveInt(value, 20, 1, 100)).toBe(Number(value));
    }
  });
  it('falls back for invalid, fractional and out-of-range values, unlike parseInt', () => {
    for (const value of [undefined, null, '', '10junk', '1.5', 0, -1, 101, Infinity, {}, ['1', '2']]) {
      expect(positiveInt(value, 20, 1, 100)).toBe(20);
    }
  });
  it('preserves the zero-minimum offset behavior', () => {
    expect(positiveInt('', 20, 0, 100)).toBe(0);
    expect(positiveInt(null, 20, 0, 100)).toBe(0);
    expect(positiveInt(undefined, 20, 0, 100)).toBe(20);
  });
  it('trims string queries without accepting arrays, numbers or objects', () => {
    expect(stringQuery('  owner  ')).toBe('owner');
    for (const value of ['', '   ', null, undefined, 1, ['owner'], {}]) {
      expect(stringQuery(value)).toBeNull();
    }
  });
});
