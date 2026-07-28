import { useMemo, useState } from 'react';
import { useDragonCollection } from '../data/hooks/use-dragon-collection';
import {
  filterDragonMembers,
  getDragonMemberBirthdayMonths,
  getDragonMemberJoinYears,
  getDragonMembersStats,
  mockDragonMembersRepository,
  type DragonMemberCreateInput,
  type DragonMembersRepository,
  type DragonMemberUpdateInput
} from './members-service';
import type { DragonMember, DragonMembersFilters, DragonMembersView } from './members-models';

const DEFAULT_FILTERS: DragonMembersFilters = {
  search: '',
  role: 'all',
  status: 'all',
  joinYear: '',
  birthdayMonth: '',
  sort: 'role',
  direction: 'desc'
};

export function useDragonMembersState(repository: DragonMembersRepository = mockDragonMembersRepository) {
  const [view, setView] = useState<DragonMembersView>('grid');
  const [selectedMember, setSelectedMember] = useState<DragonMember | null>(null);
  const collection = useDragonCollection<DragonMember, DragonMembersFilters, DragonMemberCreateInput, DragonMemberUpdateInput>(
    repository,
    DEFAULT_FILTERS,
    {
      page: 1,
      pageSize: 200
    }
  );
  const members = collection.items;
  const filteredMembers = useMemo(() => filterDragonMembers(members, collection.filters), [members, collection.filters]);
  const stats = useMemo(() => getDragonMembersStats(filteredMembers), [filteredMembers]);
  const joinYears = useMemo(() => getDragonMemberJoinYears(members), [members]);
  const birthdayMonths = useMemo(() => getDragonMemberBirthdayMonths(members), [members]);

  return {
    view,
    setView,
    filters: collection.filters,
    setFilters: collection.setFilters,
    loading: collection.loading,
    refreshing: collection.refreshing,
    error: collection.error,
    refresh: collection.refresh,
    members,
    filteredMembers,
    stats,
    joinYears,
    birthdayMonths,
    selectedMember,
    setSelectedMember,
    clearFilters: () => collection.setFilters(DEFAULT_FILTERS)
  };
}
