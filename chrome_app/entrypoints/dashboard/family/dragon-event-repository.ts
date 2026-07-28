import { createMockRepository } from '../data/repositories/mock-repository';
import type { Repository } from '../data/repositories/repository';
import { DRAGON_EVENT_MOCK_DATA } from './dragon-event-mock-data';
import type { DragonEvent, DragonEventFilters } from './dragon-event-models';

export type DragonEventCreateInput = Omit<DragonEvent, 'id'>;
export type DragonEventUpdateInput = Partial<DragonEvent>;

export type DragonEventRepository = Repository<DragonEvent, DragonEventCreateInput, DragonEventUpdateInput, Partial<DragonEventFilters>>;

export const mockDragonEventRepository: DragonEventRepository = createMockRepository<
  DragonEvent,
  DragonEventCreateInput,
  DragonEventUpdateInput,
  Partial<DragonEventFilters>
>(DRAGON_EVENT_MOCK_DATA, (input) => ({
  id: globalThis.crypto?.randomUUID?.() ?? `event-${Date.now()}`,
  ...input
}));
