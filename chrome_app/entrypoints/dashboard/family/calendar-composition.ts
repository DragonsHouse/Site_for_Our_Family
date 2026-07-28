import type { DragonCalendarStateDependencies } from './calendar-state';
import { mockDragonEventRepository } from './dragon-event-repository';
import { mockDragonMembersRepository } from './members-service';

export function createDragonCalendarStateDependencies(dependencies: DragonCalendarStateDependencies): DragonCalendarStateDependencies {
  return dependencies;
}

export function createMockDragonCalendarStateDependencies(
  overrides: Partial<DragonCalendarStateDependencies> = {}
): DragonCalendarStateDependencies {
  return {
    eventRepository: mockDragonEventRepository,
    membersRepository: mockDragonMembersRepository,
    ...overrides
  };
}
