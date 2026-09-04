import { mockDragonEventRepository, type DragonEventRepository } from './dragon-event-repository';
import { mockDragonMembersRepository, type DragonMembersRepository } from './members-service';
import { emptyDragonTowerDefenseRepository, mockDragonTowerDefenseRepository, type DragonTowerDefenseRepository } from './tower-defense-repository';
import { loadDragonTowerDefenseReadState } from '../../../lib/family-tower-defense-read-adapter.ts';
import { dragonTowerDefenseBackendOperations, type DragonTowerDefenseBackendOperations } from '../../../lib/family-tower-defense-backend-operations.ts';
import type { DragonTowerDefenseReadState } from '../../../lib/family-tower-defense-read-adapter.ts';

export type DragonTowerDefenseStateDependencies = {
  towerDefenseRepository: DragonTowerDefenseRepository;
  eventRepository: DragonEventRepository;
  membersRepository: DragonMembersRepository;
  currentFamilyMemberId?: string;
  loadTowerDefenseReadState?: typeof loadDragonTowerDefenseReadState;
  backendOperations?: DragonTowerDefenseBackendOperations;
  allowDevMockFallback?: boolean;
  now?: Date;
};

export function createDragonTowerDefenseStateDependencies(
  dependencies: DragonTowerDefenseStateDependencies
): DragonTowerDefenseStateDependencies {
  return dependencies;
}

export function createMockDragonTowerDefenseStateDependencies(
  overrides: Partial<DragonTowerDefenseStateDependencies> = {}
): DragonTowerDefenseStateDependencies {
  return {
    towerDefenseRepository: overrides.towerDefenseRepository ?? mockDragonTowerDefenseRepository,
    eventRepository: overrides.eventRepository ?? mockDragonEventRepository,
    membersRepository: overrides.membersRepository ?? mockDragonMembersRepository,
    now: overrides.now
  };
}

export function createBackendDragonTowerDefenseStateDependencies(
  currentFamilyMemberId: string,
  overrides: Partial<DragonTowerDefenseStateDependencies> = {}
): DragonTowerDefenseStateDependencies {
  return {
    towerDefenseRepository: overrides.towerDefenseRepository ?? emptyDragonTowerDefenseRepository,
    eventRepository: overrides.eventRepository ?? mockDragonEventRepository,
    membersRepository: overrides.membersRepository ?? mockDragonMembersRepository,
    currentFamilyMemberId,
    loadTowerDefenseReadState: overrides.loadTowerDefenseReadState ?? ((filters, signal) =>
      loadDragonTowerDefenseReadState(filters, signal, { allowDevMockFallback: overrides.allowDevMockFallback })),
    backendOperations: overrides.backendOperations ?? dragonTowerDefenseBackendOperations,
    now: overrides.now
  };
}

export type { DragonTowerDefenseReadState };
