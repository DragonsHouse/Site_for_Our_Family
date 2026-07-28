import { useMemo } from 'react';
import type { FamilyUser } from '../../../lib/family-types';
import { useDragonCollection } from '../data/hooks/use-dragon-collection';
import {
  buildDragonProfileForUser,
  getDragonProfilePrimaryStats,
  mockDragonProfileRepository,
  sortDragonAchievements,
  sortDragonTimeline,
  type DragonProfileCreateInput,
  type DragonProfileFilters,
  type DragonProfileRepository,
  type DragonProfileUpdateInput
} from './profile-service';
import type { DragonProfile } from './profile-models';

const DEFAULT_FILTERS: DragonProfileFilters = {
  memberId: 'current'
};

export function useDragonProfileState(user: FamilyUser, repository: DragonProfileRepository = mockDragonProfileRepository) {
  const collection = useDragonCollection<DragonProfile, DragonProfileFilters, DragonProfileCreateInput, DragonProfileUpdateInput>(
    repository,
    { ...DEFAULT_FILTERS, memberId: user.id },
    {
      page: 1,
      pageSize: 20
    }
  );
  const profile = useMemo(() => buildDragonProfileForUser(collection.items[0] ?? null, user), [collection.items, user]);
  const primaryStats = useMemo(() => getDragonProfilePrimaryStats(profile), [profile]);
  const achievements = useMemo(() => sortDragonAchievements(profile.achievements), [profile.achievements]);
  const timeline = useMemo(() => sortDragonTimeline(profile.timeline), [profile.timeline]);

  return {
    loading: collection.loading,
    refreshing: collection.refreshing,
    error: collection.error,
    refresh: collection.refresh,
    profile,
    primaryStats,
    achievements,
    timeline,
    backendIntegration: {
      filters: collection.filters,
      memberId: user.id
    }
  };
}
