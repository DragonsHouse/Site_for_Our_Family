import { useMemo, useState } from 'react';
import { useDragonCollection } from '../data/hooks/use-dragon-collection';
import type { DragonAchievement, DragonAchievementFilters } from './achievement-models';
import type {
  DragonAchievementCreateInput,
  DragonAchievementRepository,
  DragonAchievementUpdateInput
} from './achievement-repository';
import { mockDragonAchievementRepository } from './achievement-repository';
import {
  DEFAULT_ACHIEVEMENT_FILTERS,
  filterDragonAchievements,
  getDragonAchievementStatistics,
  groupDragonAchievementsByCategory,
  sortDragonAchievements
} from './achievement-service';

export function useDragonAchievementState(repository: DragonAchievementRepository = mockDragonAchievementRepository) {
  const [filters, setFilters] = useState<DragonAchievementFilters>(DEFAULT_ACHIEVEMENT_FILTERS);
  const collection = useDragonCollection<
    DragonAchievement,
    Partial<DragonAchievementFilters>,
    DragonAchievementCreateInput,
    DragonAchievementUpdateInput
  >(
    repository,
    {},
    {
      page: 1,
      pageSize: 100
    }
  );

  const achievements = useMemo(() => sortDragonAchievements(collection.items), [collection.items]);
  const visibleAchievements = useMemo(() => filterDragonAchievements(achievements, filters), [achievements, filters]);
  const groupedAchievements = useMemo(() => groupDragonAchievementsByCategory(visibleAchievements), [visibleAchievements]);
  const statistics = useMemo(() => getDragonAchievementStatistics(achievements), [achievements]);

  return {
    loading: collection.loading,
    refreshing: collection.refreshing,
    error: collection.error,
    refresh: collection.refresh,
    achievements,
    visibleAchievements,
    groupedAchievements,
    statistics,
    filters,
    setFilters,
    backendIntegration: {
      repositoryBoundary: 'Repository<DragonAchievement>',
      filters,
      pageSize: 100
    }
  };
}
