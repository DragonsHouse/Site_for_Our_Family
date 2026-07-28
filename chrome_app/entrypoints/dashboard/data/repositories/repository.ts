import type { DragonEntity, DragonId } from '../models/entity';
import type { DragonListQuery, DragonListResult } from '../types/pagination';

export type Repository<T extends DragonEntity, TCreate = Omit<T, 'id'>, TUpdate = Partial<T>, TFilters = Record<string, never>> = {
  list: (query?: DragonListQuery<TFilters>) => Promise<DragonListResult<T>>;
  getById: (id: DragonId) => Promise<T | null>;
  create: (input: TCreate) => Promise<T>;
  update: (id: DragonId, input: TUpdate) => Promise<T>;
  delete: (id: DragonId) => Promise<void>;
};

export type RepositoryMode = 'mock' | 'api';
