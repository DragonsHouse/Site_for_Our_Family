import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toDragonError } from '../errors/dragon-errors';
import type { DragonEntity } from '../models/entity';
import type { Repository } from '../repositories/repository';
import type { DragonCollectionState } from '../state/resource-state';
import { DRAGON_DEFAULT_PAGINATION, type DragonPagination } from '../types/pagination';

export function useDragonCollection<T extends DragonEntity, TFilters, TCreate = unknown, TUpdate = unknown>(
  repository: Repository<T, TCreate, TUpdate, TFilters>,
  initialFilters: TFilters,
  initialPagination: DragonPagination = DRAGON_DEFAULT_PAGINATION
) {
  const [items, setItems] = useState<T[]>([]);
  const [filters, setFilters] = useState<TFilters>(initialFilters);
  const [pagination, setPagination] = useState(initialPagination);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [optimisticIds, setOptimisticIds] = useState<string[]>([]);
  const [status, setStatus] = useState<DragonCollectionState<T, TFilters>['status']>('idle');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<DragonCollectionState<T, TFilters>['error']>(null);
  const statusRef = useRef(status);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const refresh = useCallback(async () => {
    setRefreshing((current) => current || statusRef.current === 'ready');
    setStatus((current) => (current === 'ready' ? current : 'loading'));
    setError(null);

    try {
      const result = await repository.list({ filters, pagination });
      setItems(result.items);
      setStatus('ready');
    } catch (caught) {
      setError(toDragonError(caught));
      setStatus('error');
    } finally {
      setRefreshing(false);
    }
  }, [filters, pagination, repository]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectedItem = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId]);

  return {
    status,
    loading: status === 'idle' || status === 'loading',
    refreshing,
    error,
    items,
    setItems,
    filters,
    setFilters,
    pagination,
    setPagination,
    selectedId,
    selectedItem,
    setSelectedId,
    optimisticIds,
    setOptimisticIds,
    refresh
  };
}
