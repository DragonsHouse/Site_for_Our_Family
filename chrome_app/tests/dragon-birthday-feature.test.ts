import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildDragonBirthdayCalendarEvents,
  calculateDragonBirthdayAge,
  formatDragonBirthday,
  getDragonBirthdayDaysUntil,
  getNextDragonBirthday,
  groupDragonBirthdaysByMonth,
  parseDragonBirthday,
  sortUpcomingDragonBirthdays,
  toDragonBirthdayData,
  validateDragonBirthdayValue
} from '../entrypoints/dashboard/family/birthday-service.ts';
import type { DragonBirthdayData } from '../entrypoints/dashboard/family/birthday-models.ts';
import type { DragonMember } from '../entrypoints/dashboard/family/members-models.ts';

const serviceSource = readFileSync(new URL('../entrypoints/dashboard/family/birthday-service.ts', import.meta.url), 'utf8');
const stateSource = readFileSync(new URL('../entrypoints/dashboard/family/birthday-state.ts', import.meta.url), 'utf8');
const calendarStateSource = readFileSync(new URL('../entrypoints/dashboard/family/calendar-state.ts', import.meta.url), 'utf8');
const calendarMockSource = readFileSync(new URL('../entrypoints/dashboard/family/calendar-mock-data.ts', import.meta.url), 'utf8');
const membersSource = readFileSync(new URL('../entrypoints/dashboard/family/dragon-members.tsx', import.meta.url), 'utf8');
const profileSource = readFileSync(new URL('../entrypoints/dashboard/family/dragon-profile.tsx', import.meta.url), 'utf8');
const popupSource = readFileSync(new URL('../entrypoints/popup/popup-app.tsx', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

function birthday(overrides: Partial<DragonBirthdayData>): DragonBirthdayData {
  return {
    id: overrides.id ?? `birthday-${overrides.memberId ?? 'member'}`,
    memberId: overrides.memberId ?? 'member',
    memberName: overrides.memberName ?? 'Member',
    date: overrides.date ?? { year: 2000, month: 1, day: 1, isoDate: '2000-01-01' },
    visibility: overrides.visibility ?? 'visible',
    showAge: overrides.showAge ?? false,
    source: overrides.source ?? 'mock',
    backendField: overrides.backendField ?? 'dateOfBirth',
    notifications: overrides.notifications ?? { enabled: true, daysBefore: [0, 1, 7], channels: ['hub'] }
  };
}

describe('Dragon Birthday feature', () => {
  it('parses valid birthdays, missing years and rejects impossible dates', () => {
    assert.deepEqual(parseDragonBirthday('1998-07-27'), { year: 1998, month: 7, day: 27, isoDate: '1998-07-27' });
    assert.deepEqual(parseDragonBirthday('--07-27'), { month: 7, day: 27 });
    assert.equal(parseDragonBirthday('2025-02-29'), null);
    assert.equal(parseDragonBirthday('2025-13-01'), null);
    assert.equal(parseDragonBirthday('not-a-date'), null);
  });

  it('validates date-of-birth values without timezone conversion', () => {
    assert.equal(validateDragonBirthdayValue('2000-02-29', '2026-07-28').valid, true);
    assert.deepEqual(validateDragonBirthdayValue('2025-02-29', '2026-07-28'), {
      valid: false,
      code: 'invalid_date',
      message: 'Date of birth is invalid'
    });
    assert.equal(validateDragonBirthdayValue('1969-12-31', '2026-07-28').code, 'too_early');
    assert.equal(validateDragonBirthdayValue('2026-07-29', '2026-07-28').code, 'future');
  });

  it('calculates next birthday, days remaining and age around birthdays', () => {
    const date = parseDragonBirthday('2000-07-27');
    assert.equal(getNextDragonBirthday(date, '2026-07-26'), '2026-07-27');
    assert.equal(getDragonBirthdayDaysUntil(date, '2026-07-26'), 1);
    assert.equal(calculateDragonBirthdayAge(date, '2026-07-26'), 25);
    assert.equal(calculateDragonBirthdayAge(date, '2026-07-27'), 26);
    assert.equal(calculateDragonBirthdayAge(parseDragonBirthday('--07-27'), '2026-07-27'), null);
  });

  it('handles February 29 by observing it on February 28 in non-leap years', () => {
    const leap = parseDragonBirthday('2004-02-29');
    assert.equal(getNextDragonBirthday(leap, '2025-02-27'), '2025-02-28');
    assert.equal(getDragonBirthdayDaysUntil(leap, '2025-02-27'), 1);
    assert.equal(calculateDragonBirthdayAge(leap, '2025-02-27'), 20);
    assert.equal(calculateDragonBirthdayAge(leap, '2025-02-28'), 21);
    assert.equal(getNextDragonBirthday(leap, '2028-02-28'), '2028-02-29');
  });

  it('sorts upcoming birthdays across the year boundary and hides private birthdays', () => {
    const upcoming = sortUpcomingDragonBirthdays(
      [
        birthday({ memberId: 'jan', memberName: 'January', date: parseDragonBirthday('2000-01-02') }),
        birthday({ memberId: 'dec', memberName: 'December', date: parseDragonBirthday('2000-12-31') }),
        birthday({ memberId: 'hidden', memberName: 'Hidden', date: parseDragonBirthday('2000-01-01'), visibility: 'private' })
      ],
      '2026-12-30'
    );

    assert.deepEqual(
      upcoming.map((item) => item.birthday.memberName),
      ['December', 'January']
    );
  });

  it('groups birthdays by month and generates stable calendar events from member data', () => {
    const member = {
      id: 'dragon-1',
      discordNickname: 'Dragon_One',
      dragonTitle: 'Flame',
      role: 'dragon',
      rank: 'Dragon',
      rankLevel: 2,
      joinedAt: '2025-01-01',
      birthday: '2000-07-27',
      birthdayVisibility: 'visible',
      showBirthdayAge: false,
      status: 'online',
      staticId: '1001'
    } satisfies DragonMember;
    const birthdayData = toDragonBirthdayData(member);

    assert.equal(formatDragonBirthday(member.birthday), '27 July');
    assert.deepEqual(Object.keys(groupDragonBirthdaysByMonth([birthdayData])), ['07']);

    const [event] = buildDragonBirthdayCalendarEvents([birthdayData], 2026, '2026-07-27');
    assert.equal(event.id, 'birthday-dragon-1-2026');
    assert.equal(event.category, 'birthday');
    assert.equal(event.date, '2026-07-27');
    assert.equal(event.priority, 'high');
  });

  it('keeps birthday architecture out of React mock imports and calendar mock duplication', () => {
    assert.match(stateSource, /Repository<DragonMember>|sourceRepository: 'Repository<DragonMember>'/);
    assert.match(calendarStateSource, /useDragonBirthdayState/);
    assert.match(calendarStateSource, /mergeDragonCalendarBirthdayEvents/);
    assert.doesNotMatch(calendarMockSource, /category: 'birthday'/);
    assert.doesNotMatch(membersSource, /members-mock-data|DRAGON_MEMBERS_MOCK_DATA/);
    assert.doesNotMatch(profileSource, /profile-mock-data|DRAGON_PROFILE_MOCK_DATA/);
    assert.doesNotMatch(popupSource, /DRAGON_MEMBERS_MOCK_DATA|DRAGON_CALENDAR_MOCK_EVENTS/);
    assert.equal(serviceSource.includes('T00:00:00'), false);
  });

  it('runs in the frontend test suite', () => {
    assert.match(packageJson.scripts['test:auth-source'], /tests\/dragon-birthday-feature\.test\.ts/);
  });
});
