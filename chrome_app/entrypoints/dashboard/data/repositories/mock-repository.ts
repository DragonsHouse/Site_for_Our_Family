import { UnknownError } from '../errors/dragon-errors';
import type { DragonEntity, DragonId } from '../models/entity';
import { DRAGON_DEFAULT_PAGINATION, type DragonListQuery, type DragonListResult } from '../types/pagination';
import type { Repository } from './repository';

export function createMockRepository<T extends DragonEntity, TCreate = Omit<T, 'id'>, TUpdate = Partial<T>, TFilters = Record<string, never>>(
  seed: T[],
  createEntity: (input: TCreate) => T = (input) => ({ id: crypto.randomUUID(), ...(input as object) }) as T
): Repository<T, TCreate, TUpdate, TFilters> {
  let records = [...seed];

  return {
    async list(query?: DragonListQuery<TFilters>): Promise<DragonListResult<T>> {
      const pagination = query?.pagination ?? DRAGON_DEFAULT_PAGINATION;
      const start = (pagination.page - 1) * pagination.pageSize;
      const items = records.slice(start, start + pagination.pageSize);

      return {
        items,
        total: records.length,
        page: pagination.page,
        pageSize: pagination.pageSize
      };
    },

    async getById(id: DragonId) {
      return records.find((record) => record.id === id) ?? null;
    },

    async create(input: TCreate) {
      const entity = createEntity(input);
      records = [entity, ...records];
      return entity;
    },

    async update(id: DragonId, input: TUpdate) {
      const current = records.find((record) => record.id === id);
      if (!current) {
        throw new UnknownError('Запис не знайдено', { id });
      }

      const updated = { ...current, ...(input as object), id } as T;
      records = records.map((record) => (record.id === id ? updated : record));
      return updated;
    },

    async delete(id: DragonId) {
      records = records.filter((record) => record.id !== id);
    }
  };
}
