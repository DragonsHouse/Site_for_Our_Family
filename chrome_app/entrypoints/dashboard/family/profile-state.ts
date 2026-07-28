import { useMemo } from 'react';
import type { FamilyUser } from '../../../lib/family-types';
import { useDragonCollection } from '../data/hooks/use-dragon-collection';
import type { DragonEvent, DragonEventFilters } from './dragon-event-models';
import type { DragonEventCreateInput, DragonEventRepository, DragonEventUpdateInput } from './dragon-event-repository';
import { mockDragonEventRepository } from './dragon-event-repository';
import { getDragonEventTimeline } from './dragon-event-service';
import {
  buildDragonProfileForUser,
  getDragonProfilePrimaryStats,
  mockDragonProfileRepository,
  sortDragonAchievements,
  type DragonProfileCreateInput,
  type DragonProfileFilters,
  type DragonProfileRepository,
  type DragonProfileUpdateInput
} from './profile-service';
import type { DragonProfile } from './profile-models';

const DEFAULT_FILTERS: DragonProfileFilters = {
  memberId: 'current'
};

export type DragonProfileStateDependencies = {
  profileRepository?: DragonProfileRepository;
  eventRepository?: DragonEventRepository;
};

export function useDragonProfileState(user: FamilyUser, dependencies: DragonProfileStateDependencies = {}) {
  const collection = useDragonCollection<DragonProfile, DragonProfileFilters, DragonProfileCreateInput, DragonProfileUpdateInput>(
    dependencies.profileRepository ?? mockDragonProfileRepository,
    { ...DEFAULT_FILTERS, memberId: user.id },
    {
      page: 1,
      pageSize: 20
    }
  );
  const eventCollection = useDragonCollection<DragonEvent, Partial<DragonEventFilters>, DragonEventCreateInput, DragonEventUpdateInput>(
    dependencies.eventRepository ?? mockDragonEventRepository,
    {},
    {
      page: 1,
      pageSize: 100
    }
  );
  const profile = useMemo(() => buildDragonProfileForUser(collection.items[0] ?? null, user), [collection.items, user]);
  const primaryStats = useMemo(() => getDragonProfilePrimaryStats(profile), [profile]);
  const achievements = useMemo(() => sortDragonAchievements(profile.achievements), [profile.achievements]);
  const timeline = useMemo(() => getDragonEventTimeline(eventCollection.items), [eventCollection.items]);

  return {
    loading: collection.loading || eventCollection.loading,
    refreshing: collection.refreshing || eventCollection.refreshing,
    error: collection.error ?? eventCollection.error,
    refresh: () => {
      collection.refresh();
      eventCollection.refresh();
    },
    profile,
    primaryStats,
    achievements,
    timeline,
    backendIntegration: {
      filters: collection.filters,
      memberId: user.id,
      timelineRepositoryBoundary: 'Repository<DragonEvent>'
    }
  };
}
