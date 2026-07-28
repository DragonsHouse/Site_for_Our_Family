import { useMemo } from 'react';
import { useDragonCollection } from '../data/hooks/use-dragon-collection';
import type { DragonMember, DragonMembersFilters } from './members-models';
import {
  mockDragonMembersRepository,
  type DragonMemberCreateInput,
  type DragonMembersRepository,
  type DragonMemberUpdateInput
} from './members-service';
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

export function useDragonBirthdayState(repository: DragonMembersRepository = mockDragonMembersRepository, year = new Date().getFullYear()) {
  const collection = useDragonCollection<DragonMember, DragonMembersFilters, DragonMemberCreateInput, DragonMemberUpdateInput>(
    repository,
    BIRTHDAY_FILTERS,
    {
      page: 1,
      pageSize: 200
    }
  );
  const birthdays = useMemo(() => collection.items.map((member) => toDragonBirthdayData(member)), [collection.items]);
  const upcomingBirthdays = useMemo(() => sortUpcomingDragonBirthdays(birthdays), [birthdays]);
  const birthdaysByMonth = useMemo(() => groupDragonBirthdaysByMonth(birthdays), [birthdays]);
  const calendarEvents = useMemo(() => buildDragonBirthdayCalendarEvents(birthdays, year), [birthdays, year]);

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
