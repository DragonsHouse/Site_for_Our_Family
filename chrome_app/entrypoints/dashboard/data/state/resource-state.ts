import type { DragonError } from '../errors/dragon-errors';
import type { DragonPagination } from '../types/pagination';

export type DragonAsyncStatus = 'idle' | 'loading' | 'ready' | 'error';

export type DragonCollectionState<T, TFilters> = {
  status: DragonAsyncStatus;
  loading: boolean;
  refreshing: boolean;
  error: DragonError | null;
  items: T[];
  filters: TFilters;
  pagination: DragonPagination;
  selectedId: string | null;
  optimisticIds: string[];
};

export type DragonSelectionState<T> = {
  selectedId: string | null;
  selectedItem: T | null;
};
