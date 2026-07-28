export type DragonPagination = {
  page: number;
  pageSize: number;
};

export type DragonListQuery<TFilters = Record<string, never>> = {
  filters?: TFilters;
  pagination?: DragonPagination;
  search?: string;
};

export type DragonListResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export const DRAGON_DEFAULT_PAGINATION: DragonPagination = {
  page: 1,
  pageSize: 25
};
