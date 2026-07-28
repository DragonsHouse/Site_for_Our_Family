import { createMockRepository } from '../data/repositories/mock-repository';
import type { Repository } from '../data/repositories/repository';
import { DRAGON_TOWER_DEFENSE_MOCK_DATA } from './tower-defense-mock-data';
import type { DragonTowerDefense, DragonTowerDefenseFilters } from './tower-defense-models';

export type DragonTowerDefenseCreateRepositoryInput = DragonTowerDefense;
export type DragonTowerDefenseUpdateRepositoryInput = Partial<DragonTowerDefense>;

export type DragonTowerDefenseRepository = Repository<
  DragonTowerDefense,
  DragonTowerDefenseCreateRepositoryInput,
  DragonTowerDefenseUpdateRepositoryInput,
  Partial<DragonTowerDefenseFilters>
>;

export const mockDragonTowerDefenseRepository: DragonTowerDefenseRepository = createMockRepository<
  DragonTowerDefense,
  DragonTowerDefenseCreateRepositoryInput,
  DragonTowerDefenseUpdateRepositoryInput,
  Partial<DragonTowerDefenseFilters>
>(DRAGON_TOWER_DEFENSE_MOCK_DATA, (input) => ({
  ...input,
  id: input.id ?? globalThis.crypto?.randomUUID?.() ?? `tower-defense-${Date.now()}`
}));
