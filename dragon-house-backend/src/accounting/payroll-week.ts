export const PAYROLL_TIMEZONE = 'Europe/Kyiv';

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

const weekdayIndex: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: PAYROLL_TIMEZONE,
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export type PayrollWeekBoundary = {
  startsAt: Date;
  endsAt: Date;
  timezone: typeof PAYROLL_TIMEZONE;
};

export function getPayrollWeekBoundary(now = new Date()): PayrollWeekBoundary {
  const parts = getZonedParts(now);
  const daysSinceMonday = (parts.weekday + 6) % 7;
  const mondayDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day - daysSinceMonday));
  const startsAt = zonedTimeToUtc(mondayDate.getUTCFullYear(), mondayDate.getUTCMonth() + 1, mondayDate.getUTCDate());
  const nextMondayDate = new Date(Date.UTC(mondayDate.getUTCFullYear(), mondayDate.getUTCMonth(), mondayDate.getUTCDate() + 7));
  const endsAt = zonedTimeToUtc(nextMondayDate.getUTCFullYear(), nextMondayDate.getUTCMonth() + 1, nextMondayDate.getUTCDate());
  return { startsAt, endsAt, timezone: PAYROLL_TIMEZONE };
}

export function isCanonicalWeeklyPeriod(startsAt: Date, endsAt: Date): boolean {
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime())) return false;
  const parts = getZonedParts(startsAt);
  if (parts.weekday !== 1 || parts.hour !== 0 || parts.minute !== 0 || parts.second !== 0) return false;
  const expected = getPayrollWeekBoundary(startsAt);
  return startsAt.getTime() === expected.startsAt.getTime() && endsAt.getTime() === expected.endsAt.getTime();
}

function getZonedParts(date: Date): ZonedParts {
  const values: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') values[part.type] = part.value;
  }
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
    weekday: weekdayIndex[values.weekday ?? ''] ?? 0,
  };
}

function zonedTimeToUtc(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): Date {
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let instant = localAsUtc;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const offset = getTimezoneOffsetMs(new Date(instant));
    const next = localAsUtc - offset;
    if (next === instant) break;
    instant = next;
  }
  return new Date(instant);
}

function getTimezoneOffsetMs(date: Date): number {
  const parts = getZonedParts(date);
  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return localAsUtc - date.getTime();
}
