import type { DragonListQuery, DragonListResult } from '../entrypoints/dashboard/data/types/pagination.ts';
import type { DragonEvent, DragonEventFilters } from '../entrypoints/dashboard/family/dragon-event-models.ts';
import type { DragonEventCreateInput, DragonEventRepository, DragonEventUpdateInput } from '../entrypoints/dashboard/family/dragon-event-repository.ts';
import {
  createBackendFamilyEvent,
  getBackendFamilyEvent,
  listBackendFamilyEvents,
  listBackendFamilyCalendar,
  updateBackendFamilyEvent
} from './family-events-backend-client.ts';
import { mapBackendCalendarItem, mapBackendFamilyEvent, mapDragonEventCreateInput, mapDragonEventUpdateInput } from './family-events-backend-mapper.ts';

export function createBackendDragonEventRepository(options: { mode?: 'standalone-events' | 'unified-calendar' } = {}): DragonEventRepository {
  const mode = options.mode ?? 'unified-calendar';
  return {
    async list(query?: DragonListQuery<Partial<DragonEventFilters>>): Promise<DragonListResult<DragonEvent>> {
      const filters = query?.filters ?? {};
      if (mode === 'standalone-events') {
        const response = await listBackendFamilyEvents({
          status: filters.status,
          type: filters.type && filters.type !== 'all' && filters.type !== 'quest' && filters.type !== 'tower_defense' && filters.type !== 'birthday' ? filters.type : undefined,
          from: filters.dateFrom || undefined,
          to: filters.dateTo || undefined,
          organizer: filters.owner || undefined,
          participant: filters.participant || undefined,
          search: filters.search || undefined
        });
        const items = response.items.map(mapBackendFamilyEvent);
        const pageSize = query?.pagination?.pageSize ?? (items.length || 25);
        return paginate(items, query?.pagination?.page ?? 1, pageSize);
      }
      const response = await listBackendFamilyCalendar({
        sourceModule: sourceFilter(filters.type),
        from: filters.dateFrom || undefined,
        to: filters.dateTo || undefined
      });
      const items = response.items.map(mapBackendCalendarItem);
      const pageSize = query?.pagination?.pageSize ?? (items.length || 25);
      return paginate(items, query?.pagination?.page ?? 1, pageSize);
    },
    async getById(id: string): Promise<DragonEvent | null> {
      const backendId = id.startsWith('family_events:') ? id.slice('family_events:'.length) : id;
      try {
        return mapBackendFamilyEvent(await getBackendFamilyEvent(backendId));
      } catch {
        return null;
      }
    },
    async create(input: DragonEventCreateInput): Promise<DragonEvent> {
      return mapBackendFamilyEvent(await createBackendFamilyEvent(mapDragonEventCreateInput(input)));
    },
    async update(id: string, input: DragonEventUpdateInput): Promise<DragonEvent> {
      const backendId = id.startsWith('family_events:') ? id.slice('family_events:'.length) : id;
      return mapBackendFamilyEvent(await updateBackendFamilyEvent(backendId, mapDragonEventUpdateInput(input)));
    },
    async delete(): Promise<void> {
      throw new Error('Family event delete is not supported; cancel events through the backend instead.');
    }
  };
}

function sourceFilter(type: DragonEventFilters['type'] | undefined): string | undefined {
  if (!type || type === 'all') return undefined;
  if (type === 'tower_defense') return 'tower_defense';
  if (type === 'quest') return 'family_quests';
  return 'family_events';
}

function paginate<T>(items: T[], page: number, pageSize: number): DragonListResult<T> {
  const start = Math.max(0, (page - 1) * pageSize);
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    pageSize
  };
}
