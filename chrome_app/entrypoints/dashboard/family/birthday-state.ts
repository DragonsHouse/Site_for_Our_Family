import { useMemo } from 'react';
import { useDragonCollection } from '../data/hooks/use-dragon-collection';
import type { DragonMember, DragonMembersFilters } from './members-models';
import type { DragonMemberCreateInput, DragonMembersRepository, DragonMemberUpdateInput } from './members-service';
import {
  buildDragonBirthdayCalendarEvents,
  groupDragonBirthdaysByMonth,
  sortUpcomingDragonBirthdays,
  toDragonBirthdayData
} from './birthday-service';

const BIRTHDAY_FILTERS: DragonMembersFilters = {
  search: '',
  role: 'all',
  status: 'all',
  joinYear: '',
  birthdayMonth: '',
  sort: 'nickname',
  direction: 'asc'
};

export type DragonBirthdayStateDependencies = {
  membersRepository: DragonMembersRepository;
  year?: number;
  todayKey?: string;
};

export function useDragonBirthdayState(dependencies: DragonBirthdayStateDependencies) {
  const year = dependencies.year ?? new Date().getFullYear();
  const collection = useDragonCollection<DragonMember, DragonMembersFilters, DragonMemberCreateInput, DragonMemberUpdateInput>(
    dependencies.membersRepository,
    BIRTHDAY_FILTERS,
    {
      page: 1,
      pageSize: 200
    }
  );
  const birthdays = useMemo(() => collection.items.map((member) => toDragonBirthdayData(member)), [collection.items]);
  const upcomingBirthdays = useMemo(() => sortUpcomingDragonBirthdays(birthdays, dependencies.todayKey), [birthdays, dependencies.todayKey]);
  const birthdaysByMonth = useMemo(() => groupDragonBirthdaysByMonth(birthdays), [birthdays]);
  const calendarEvents = useMemo(() => buildDragonBirthdayCalendarEvents(birthdays, year, dependencies.todayKey), [birthdays, dependencies.todayKey, year]);

  return {
    loading: collection.loading,
    refreshing: collection.refreshing,
    error: collection.error,
    refresh: collection.refresh,
    birthdays,
    upcomingBirthdays,
    birthdaysByMonth,
    calendarEvents,
    backendIntegration: {
      sourceRepository: 'Repository<DragonMember>',
      backendField: 'dateOfBirth',
      discordMemberField: 'discordUserId'
    }
  };
}
