import { mockDragonEventRepository, type DragonEventRepository } from './dragon-event-repository';
import { mockDragonMembersRepository, type DragonMembersRepository } from './members-service';
import { mockDragonTowerDefenseRepository, type DragonTowerDefenseRepository } from './tower-defense-repository';

export type DragonTowerDefenseStateDependencies = {
  towerDefenseRepository: DragonTowerDefenseRepository;
  eventRepository: DragonEventRepository;
  membersRepository: DragonMembersRepository;
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
