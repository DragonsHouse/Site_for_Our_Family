import type { DragonEntity } from '../models/entity';
import type { Repository } from '../repositories/repository';

export type DragonService<T extends DragonEntity, TCreate = Omit<T, 'id'>, TUpdate = Partial<T>, TFilters = Record<string, never>> = {
  repository: Repository<T, TCreate, TUpdate, TFilters>;
};
