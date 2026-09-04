import type { DragonListQuery, DragonListResult } from '../entrypoints/dashboard/data/types/pagination.ts';
import type { DragonAchievement, DragonAchievementFilters } from '../entrypoints/dashboard/family/achievement-models.ts';
import type { DragonAchievementCreateInput, DragonAchievementRepository, DragonAchievementUpdateInput } from '../entrypoints/dashboard/family/achievement-repository.ts';
import { listBackendAchievements, listBackendMemberAchievements, listBackendMemberRewards } from './family-achievements-backend-client.ts';
import { mapBackendAchievement } from './family-achievements-backend-mapper.ts';

export function createBackendDragonAchievementRepository(memberId: string): DragonAchievementRepository {
  return {
    async list(query?: DragonListQuery<Partial<DragonAchievementFilters>>): Promise<DragonListResult<DragonAchievement>> {
      const [catalog, awards, rewards] = await Promise.all([
        listBackendAchievements(),
        listBackendMemberAchievements(memberId),
        listBackendMemberRewards(memberId),
      ]);
      const items = catalog.items
        .map((definition) => mapBackendAchievement(definition, awards.items, rewards.items))
        .filter((achievement) => !query?.filters?.category || query.filters.category === 'all' || achievement.category === query.filters.category)
        .filter((achievement) => !query?.filters?.rarity || query.filters.rarity === 'all' || achievement.rarity === query.filters.rarity)
        .filter((achievement) => !query?.filters?.completion || query.filters.completion === 'all' || (query.filters.completion === 'unlocked' ? achievement.completed : !achievement.completed));
      const page = query?.pagination?.page ?? 1;
      const pageSize = query?.pagination?.pageSize ?? (items.length || 100);
      const start = (page - 1) * pageSize;
      return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize };
    },
    async getById(id: string): Promise<DragonAchievement | null> {
      const result = await this.list();
      return result.items.find((item) => item.id === id || item.backendAchievementId === id) ?? null;
    },
    async create(_input: DragonAchievementCreateInput): Promise<DragonAchievement> {
      throw new Error('Achievements are backend-managed.');
    },
    async update(_id: string, _input: DragonAchievementUpdateInput): Promise<DragonAchievement> {
      throw new Error('Achievements are backend-managed.');
    },
    async delete(): Promise<void> {
      throw new Error('Achievements are backend-managed.');
    },
  };
}
