import type { DragonCalendarEvent } from './calendar-models';
import type { DragonMember } from './members-models';
import type {
  DragonBirthdayData,
  DragonBirthdayDate,
  DragonBirthdayOccurrence,
  DragonBirthdayValidationResult
} from './birthday-models';

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;
const MONTH_DAY_PATTERN = /^(?:--)?(\d{2})-(\d{2})$/u;
const MIN_BIRTHDAY_DATE = '1970-01-01';
const DRAGON_BIRTHDAY_MONTH_LABELS: Record<string, string> = {
  '01': 'January',
  '02': 'February',
  '03': 'March',
  '04': 'April',
  '05': 'May',
  '06': 'June',
  '07': 'July',
  '08': 'August',
  '09': 'September',
  '10': 'October',
  '11': 'November',
  '12': 'December'
};

export function parseDragonBirthday(value?: string | null): DragonBirthdayDate | null {
  const input = value?.trim();
  if (!input) return null;

  const fullDate = DATE_ONLY_PATTERN.exec(input);
  if (fullDate) {
    const [, yearText, monthText, dayText] = fullDate;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    if (!isValidDragonBirthdayDate(year, month, day)) return null;
    return { year, month, day, isoDate: input };
  }

  const monthDay = MONTH_DAY_PATTERN.exec(input);
  if (monthDay) {
    const [, monthText, dayText] = monthDay;
    const month = Number(monthText);
    const day = Number(dayText);
    if (!isValidDragonBirthdayMonthDay(month, day, true)) return null;
    return { month, day };
  }

  return null;
}

export function validateDragonBirthdayValue(value: string, today = todayDateKey()): DragonBirthdayValidationResult {
  const input = value.trim();
  if (!input) return { valid: false, code: 'required', message: 'Date of birth is required' };

  const match = DATE_ONLY_PATTERN.exec(input);
  if (!match) return { valid: false, code: 'invalid_format', message: 'Use YYYY-MM-DD' };

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!isValidDragonBirthdayDate(year, month, day)) return { valid: false, code: 'invalid_date', message: 'Date of birth is invalid' };
  if (input < MIN_BIRTHDAY_DATE) return { valid: false, code: 'too_early', message: 'Date of birth must be on or after 1970-01-01' };
  if (input > today) return { valid: false, code: 'future', message: 'Date of birth cannot be in the future' };

  return { valid: true, birthday: { year, month, day, isoDate: input } };
}

export function formatDragonBirthday(value?: string | DragonBirthdayDate | null, options: { showYear?: boolean; hiddenLabel?: string } = {}) {
  const birthday = typeof value === 'string' ? parseDragonBirthday(value) : value;
  if (!birthday) return options.hiddenLabel ?? 'Hidden';

  const month = DRAGON_BIRTHDAY_MONTH_LABELS[padDatePart(birthday.month)];
  const day = padDatePart(birthday.day);
  if (options.showYear && birthday.year) return `${day} ${month} ${birthday.year}`;
  return `${day} ${month}`;
}

export function calculateDragonBirthdayAge(birthday: DragonBirthdayDate | null, today = todayDateKey()) {
  if (!birthday?.year) return null;
  const todayParts = parseDateKey(today);
  const observed = getObservedBirthdayInYear(birthday, todayParts.year);
  const hadBirthday = today >= observed;
  return todayParts.year - birthday.year - (hadBirthday ? 0 : 1);
}

export function getNextDragonBirthday(birthday: DragonBirthdayDate | null, today = todayDateKey()) {
  if (!birthday) return null;
  const todayParts = parseDateKey(today);
  const thisYear = getObservedBirthdayInYear(birthday, todayParts.year);
  return thisYear >= today ? thisYear : getObservedBirthdayInYear(birthday, todayParts.year + 1);
}

export function getDragonBirthdayDaysUntil(birthday: DragonBirthdayDate | null, today = todayDateKey()) {
  const next = getNextDragonBirthday(birthday, today);
  if (!next) return null;
  return daysBetweenDateKeys(today, next);
}

export function toDragonBirthdayData(member: DragonMember, source: DragonBirthdayData['source'] = 'member_profile'): DragonBirthdayData {
  const birthday = parseDragonBirthday(member.birthday);
  return {
    id: `birthday-${member.id}`,
    memberId: member.id,
    memberName: member.discordNickname,
    discordUsername: member.discordNickname,
    avatarUrl: member.avatarUrl,
    date: birthday,
    visibility: member.birthdayVisibility ?? (birthday ? 'visible' : 'hidden'),
    showAge: Boolean(member.showBirthdayAge),
    source,
    backendField: 'dateOfBirth',
    discordMemberField: 'discordUserId',
    notifications: {
      enabled: birthday ? true : false,
      daysBefore: [0, 1, 7],
      channels: ['hub', 'popup', 'discord']
    },
    metadata: {
      staticId: member.staticId,
      rankLevel: member.rankLevel
    }
  };
}

export function getVisibleDragonBirthdays(birthdays: DragonBirthdayData[]) {
  return birthdays.filter((birthday) => birthday.date && birthday.visibility === 'visible');
}

export function getDragonBirthdayOccurrence(birthday: DragonBirthdayData, today = todayDateKey()): DragonBirthdayOccurrence | null {
  if (!birthday.date || birthday.visibility !== 'visible') return null;
  const date = getNextDragonBirthday(birthday.date, today);
  const daysUntil = getDragonBirthdayDaysUntil(birthday.date, today);
  if (!date || daysUntil === null) return null;

  return {
    birthday,
    date,
    age: birthday.showAge ? calculateDragonBirthdayAge(birthday.date, today) : null,
    daysUntil,
    isToday: daysUntil === 0
  };
}

export function sortUpcomingDragonBirthdays(birthdays: DragonBirthdayData[], today = todayDateKey()) {
  return birthdays
    .map((birthday) => getDragonBirthdayOccurrence(birthday, today))
    .filter((occurrence): occurrence is DragonBirthdayOccurrence => Boolean(occurrence))
    .sort((left, right) => left.daysUntil - right.daysUntil || left.birthday.memberName.localeCompare(right.birthday.memberName));
}

export function groupDragonBirthdaysByMonth(birthdays: DragonBirthdayData[]) {
  return getVisibleDragonBirthdays(birthdays).reduce<Record<string, DragonBirthdayData[]>>((groups, birthday) => {
    if (!birthday.date) return groups;
    const month = padDatePart(birthday.date.month);
    groups[month] = [...(groups[month] ?? []), birthday].sort((left, right) => {
      const leftDay = left.date?.day ?? 0;
      const rightDay = right.date?.day ?? 0;
      return leftDay - rightDay || left.memberName.localeCompare(right.memberName);
    });
    return groups;
  }, {});
}

export function getDragonBirthdayMonths(birthdays: DragonBirthdayData[]) {
  return Object.keys(groupDragonBirthdaysByMonth(birthdays)).sort();
}

export function buildDragonBirthdayCalendarEvents(birthdays: DragonBirthdayData[], year: number, today = todayDateKey()): DragonCalendarEvent[] {
  return getVisibleDragonBirthdays(birthdays).flatMap((birthday) => {
    if (!birthday.date) return [];
    const date = getObservedBirthdayInYear(birthday.date, year);
    const age = birthday.showAge ? calculateDragonBirthdayAge(birthday.date, date) : null;
    const ageText = age === null ? '' : ` Turns ${age}.`;

    return [
      {
        id: `birthday-${birthday.memberId}-${year}`,
        title: `Birthday: ${birthday.memberName}`,
        description: `Dragon House birthday seal for ${birthday.memberName}.${ageText}`,
        date,
        startTime: '00:00',
        category: 'birthday',
        priority: date === today ? 'high' : 'normal',
        participants: [{ id: birthday.memberId, name: birthday.memberName, role: 'Birthday Dragon' }],
        createdBy: 'Birthday Engine',
        hall: 'Celebration Chamber',
        attachments: [],
        activity: birthday.backendField
      } satisfies DragonCalendarEvent
    ];
  });
}

export function mergeDragonCalendarBirthdayEvents(events: DragonCalendarEvent[], birthdayEvents: DragonCalendarEvent[]) {
  const birthdayKeys = new Set(events.filter((event) => event.category === 'birthday').map((event) => getBirthdayEventKey(event)));
  const uniqueBirthdayEvents = birthdayEvents.filter((event) => !birthdayKeys.has(getBirthdayEventKey(event)));
  return [...events, ...uniqueBirthdayEvents];
}

export function isValidDragonBirthdayDate(year: number, month: number, day: number) {
  if (!Number.isInteger(year) || year < 1) return false;
  if (!isValidDragonBirthdayMonthDay(month, day, isLeapYear(year))) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isValidDragonBirthdayMonthDay(month: number, day: number, allowLeapDay = false) {
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1) return false;
  const monthLengths = [31, allowLeapDay ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= monthLengths[month - 1];
}

export function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function getObservedBirthdayInYear(birthday: DragonBirthdayDate, year: number) {
  const month = birthday.month;
  const day = birthday.month === 2 && birthday.day === 29 && !isLeapYear(year) ? 28 : birthday.day;
  return `${year}-${padDatePart(month)}-${padDatePart(day)}`;
}

function parseDateKey(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
}

function daysBetweenDateKeys(left: string, right: string) {
  const leftParts = parseDateKey(left);
  const rightParts = parseDateKey(right);
  const leftTime = Date.UTC(leftParts.year, leftParts.month - 1, leftParts.day);
  const rightTime = Date.UTC(rightParts.year, rightParts.month - 1, rightParts.day);
  return Math.round((rightTime - leftTime) / 86_400_000);
}

function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

function getBirthdayEventKey(event: DragonCalendarEvent) {
  const participantId = event.participants[0]?.id ?? event.id;
  return `${event.category}:${participantId}:${event.date}`;
}
