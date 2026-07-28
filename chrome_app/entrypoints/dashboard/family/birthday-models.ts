import type { DragonEntity } from '../data/models/entity';

export type DragonBirthdayVisibility = 'visible' | 'hidden' | 'private';

export type DragonBirthdaySource = 'member_profile' | 'onboarding' | 'discord' | 'mock' | 'api';

export type DragonBirthdayDate = {
  year?: number;
  month: number;
  day: number;
  isoDate?: string;
};

export type DragonBirthdayNotificationSettings = {
  enabled: boolean;
  daysBefore: number[];
  channels: Array<'hub' | 'popup' | 'discord'>;
};

export type DragonBirthdayData = DragonEntity & {
  memberId: string;
  memberName: string;
  discordUserId?: string | null;
  discordUsername?: string | null;
  avatarUrl?: string | null;
  date: DragonBirthdayDate | null;
  visibility: DragonBirthdayVisibility;
  showAge: boolean;
  source: DragonBirthdaySource;
  backendField: 'dateOfBirth' | 'birthday' | 'discordProfileBirthday';
  discordMemberField?: string;
  notifications: DragonBirthdayNotificationSettings;
  metadata?: Record<string, string | number | boolean | null>;
};

export type DragonBirthdayOccurrence = {
  birthday: DragonBirthdayData;
  date: string;
  age: number | null;
  daysUntil: number;
  isToday: boolean;
};

export type DragonBirthdayValidationResult =
  | { valid: true; birthday: DragonBirthdayDate }
  | { valid: false; code: 'required' | 'invalid_format' | 'invalid_date' | 'too_early' | 'future'; message: string };

export const DRAGON_BIRTHDAY_MONTH_LABELS: Record<string, string> = {
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
