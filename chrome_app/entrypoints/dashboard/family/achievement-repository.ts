import { createMockRepository } from '../data/repositories/mock-repository';
import type { Repository } from '../data/repositories/repository';
import { DRAGON_ACHIEVEMENT_MOCK_DATA } from './achievement-mock-data';
import type { DragonAchievement, DragonAchievementFilters } from './achievement-models';

export type DragonAchievementCreateInput = Omit<DragonAchievement, 'id'>;
export type DragonAchievementUpdateInput = Partial<DragonAchievement>;

export type DragonAchievementRepository = Repository<
  DragonAchievement,
  DragonAchievementCreateInput,
  DragonAchievementUpdateInput,
  Partial<DragonAchievementFilters>
>;

export const mockDragonAchievementRepository: DragonAchievementRepository = createMockRepository<
  DragonAchievement,
  DragonAchievementCreateInput,
  DragonAchievementUpdateInput,
  Partial<DragonAchievementFilters>
>(DRAGON_ACHIEVEMENT_MOCK_DATA, (input) => ({
  id: globalThis.crypto?.randomUUID?.() ?? `achievement-${Date.now()}`,
  ...input
}));
