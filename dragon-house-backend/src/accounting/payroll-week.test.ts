import { describe, expect, it } from 'vitest';
import { getPayrollWeekBoundary, isCanonicalWeeklyPeriod, PAYROLL_TIMEZONE } from './payroll-week.js';

describe('payroll week boundaries', () => {
  it('uses Europe/Kyiv as the canonical payroll timezone', () => {
    expect(PAYROLL_TIMEZONE).toBe('Europe/Kyiv');
  });

  it('starts at Kyiv Monday midnight in winter time', () => {
    const week = getPayrollWeekBoundary(new Date('2026-01-14T12:00:00.000Z'));

    expect(week.startsAt.toISOString()).toBe('2026-01-11T22:00:00.000Z');
    expect(week.endsAt.toISOString()).toBe('2026-01-18T22:00:00.000Z');
    expect(isCanonicalWeeklyPeriod(week.startsAt, week.endsAt)).toBe(true);
  });

  it('starts at Kyiv Monday midnight in summer time', () => {
    const week = getPayrollWeekBoundary(new Date('2026-08-13T12:00:00.000Z'));

    expect(week.startsAt.toISOString()).toBe('2026-08-09T21:00:00.000Z');
    expect(week.endsAt.toISOString()).toBe('2026-08-16T21:00:00.000Z');
    expect(isCanonicalWeeklyPeriod(week.startsAt, week.endsAt)).toBe(true);
  });

  it('keeps Sunday activity in the current Kyiv week and moves next Monday midnight to the next week', () => {
    const sunday = getPayrollWeekBoundary(new Date('2026-08-16T20:59:59.000Z'));
    const nextMonday = getPayrollWeekBoundary(new Date('2026-08-16T21:00:00.000Z'));

    expect(sunday.startsAt.toISOString()).toBe('2026-08-09T21:00:00.000Z');
    expect(nextMonday.startsAt.toISOString()).toBe('2026-08-16T21:00:00.000Z');
  });

  it('handles Kyiv DST transition weeks by local Monday midnights, not fixed 168-hour assumptions', () => {
    const spring = getPayrollWeekBoundary(new Date('2026-03-25T12:00:00.000Z'));
    const autumn = getPayrollWeekBoundary(new Date('2026-10-28T12:00:00.000Z'));

    expect(spring.startsAt.toISOString()).toBe('2026-03-22T22:00:00.000Z');
    expect(spring.endsAt.toISOString()).toBe('2026-03-29T21:00:00.000Z');
    expect(autumn.startsAt.toISOString()).toBe('2026-10-25T22:00:00.000Z');
    expect(autumn.endsAt.toISOString()).toBe('2026-11-01T22:00:00.000Z');
    expect(isCanonicalWeeklyPeriod(spring.startsAt, spring.endsAt)).toBe(true);
    expect(isCanonicalWeeklyPeriod(autumn.startsAt, autumn.endsAt)).toBe(true);
  });
});
