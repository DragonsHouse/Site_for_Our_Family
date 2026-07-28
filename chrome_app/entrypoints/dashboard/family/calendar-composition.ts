import { mockDragonCalendarRepository } from './calendar-service';
import type { DragonCalendarStateDependencies } from './calendar-state';
import { mockDragonMembersRepository } from './members-service';

export function createDragonCalendarStateDependencies(dependencies: DragonCalendarStateDependencies): DragonCalendarStateDependencies {
  return dependencies;
}

export function createMockDragonCalendarStateDependencies(
  overrides: Partial<DragonCalendarStateDependencies> = {}
): DragonCalendarStateDependencies {
  return {
    calendarRepository: mockDragonCalendarRepository,
    membersRepository: mockDragonMembersRepository,
    ...overrides
  };
}
