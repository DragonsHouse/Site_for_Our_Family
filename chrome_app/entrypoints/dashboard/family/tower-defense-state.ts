import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDragonCollection } from '../data/hooks/use-dragon-collection';
import type { DragonEvent, DragonEventFilters } from './dragon-event-models';
import type { DragonEventCreateInput, DragonEventUpdateInput } from './dragon-event-repository';
import type { DragonMember, DragonMembersFilters } from './members-models';
import type { DragonMemberCreateInput, DragonMemberUpdateInput } from './members-service';
import type { DragonTowerDefenseStateDependencies } from './tower-defense-composition';
import {
  buildDragonDefenseHistory,
  buildDragonFireGuardRoster,
  buildDragonTowerDefenseEventId,
  buildTowerDefenseCompletionOutput,
  buildTowerDefenseProfileTimeline,
  calculateDragonDefenseReadiness,
  cancelDragonDefense,
  completeDragonDefense,
  createDragonTowerDefense,
  DEFAULT_DRAGON_TOWER_DEFENSE_FILTERS,
  editDragonTowerDefense,
  filterDragonFireGuardRoster,
  filterDragonTowerDefenses,
  getDragonTowerDefenseStatistics,
  preventDuplicateActiveDefenseForEvent,
  reconcileTowerDefenseEvent,
  respondToDragonDefense,
  sortDragonTowerDefenses,
  startDragonDefense,
  confirmDragonDefenseAttendance,
  withdrawDragonDefenseResponse
} from './tower-defense-service';
import type {
  DragonDefenseAttendanceStatus,
  DragonDefenseResult,
  DragonGuardResponseStatus,
  DragonFireGuardRosterEntry,
  DragonTowerDefinition,
  DragonTowerDefense,
  DragonTowerDefenseCreateInput,
  DragonTowerDefenseFilters,
  DragonTowerDefenseRosterFilter
} from './tower-defense-models';
import type { DragonTowerDefenseUpdateRepositoryInput } from './tower-defense-repository';
import type { DragonTowerDefenseReadSource as BackendReadSource } from '../../../lib/family-tower-defense-read-adapter.ts';

const DEFAULT_MEMBERS_FILTERS: DragonMembersFilters = {
  search: '',
  role: 'all',
  status: 'all',
  joinYear: '',
  birthdayMonth: '',
  sort: 'role',
  direction: 'desc'
};

export function useDragonTowerDefenseState(dependencies: DragonTowerDefenseStateDependencies) {
  const now = useMemo(() => dependencies.now ?? new Date(), [dependencies.now]);
  const [filters, setFilters] = useState<DragonTowerDefenseFilters>(DEFAULT_DRAGON_TOWER_DEFENSE_FILTERS);
  const [rosterFilter, setRosterFilter] = useState<DragonTowerDefenseRosterFilter>('all');
  const [selectedDefenseId, setSelectedDefenseId] = useState<string | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);
  const backendReadEnabled = Boolean(dependencies.loadTowerDefenseReadState);
  const [readSource, setReadSource] = useState<BackendReadSource>(backendReadEnabled ? 'backend_loading' : 'local');
  const [backendLoading, setBackendLoading] = useState(backendReadEnabled);
  const [backendError, setBackendError] = useState<Error | null>(null);
  const [mutating, setMutating] = useState(false);
  const [towerDefinitions, setTowerDefinitions] = useState<DragonTowerDefinition[]>([]);
  const [backendRoster, setBackendRoster] = useState<DragonFireGuardRosterEntry[] | null>(null);

  const defenseCollection = useDragonCollection<
    DragonTowerDefense,
    Partial<DragonTowerDefenseFilters>,
    DragonTowerDefense,
    DragonTowerDefenseUpdateRepositoryInput
  >(dependencies.towerDefenseRepository, {}, { page: 1, pageSize: 100 });
  const eventCollection = useDragonCollection<DragonEvent, Partial<DragonEventFilters>, DragonEventCreateInput, DragonEventUpdateInput>(
    dependencies.eventRepository,
    {},
    { page: 1, pageSize: 200 }
  );
  const memberCollection = useDragonCollection<DragonMember, DragonMembersFilters, DragonMemberCreateInput, DragonMemberUpdateInput>(
    dependencies.membersRepository,
    DEFAULT_MEMBERS_FILTERS,
    { page: 1, pageSize: 100 }
  );

  const defenses = useMemo(
    () => sortDragonTowerDefenses(filterDragonTowerDefenses(defenseCollection.items, filters)),
    [defenseCollection.items, filters]
  );
  const activeDefense = useMemo(
    () =>
      defenses.find((defense) => defense.status === 'active') ??
      defenses.find((defense) => defense.status === 'gathering') ??
      defenses.find((defense) => defense.status === 'scheduled') ??
      null,
    [defenses]
  );
  const selectedDefense = useMemo(
    () => defenseCollection.items.find((defense) => defense.id === selectedDefenseId) ?? activeDefense,
    [activeDefense, defenseCollection.items, selectedDefenseId]
  );
  const upcomingDefenses = useMemo(
    () => defenses.filter((defense) => defense.status === 'draft' || defense.status === 'scheduled' || defense.status === 'gathering'),
    [defenses]
  );
  const history = useMemo(() => buildDragonDefenseHistory(defenseCollection.items, memberCollection.items), [defenseCollection.items, memberCollection.items]);
  const statistics = useMemo(() => getDragonTowerDefenseStatistics(defenseCollection.items), [defenseCollection.items]);
  const roster = useMemo(
    () => (backendReadEnabled ? backendRoster ?? [] : buildDragonFireGuardRoster(activeDefense, memberCollection.items)),
    [activeDefense, backendReadEnabled, backendRoster, memberCollection.items]
  );
  const filteredRoster = useMemo(() => filterDragonFireGuardRoster(roster, rosterFilter), [roster, rosterFilter]);
  const readiness = useMemo(() => (activeDefense ? calculateDragonDefenseReadiness(activeDefense) : null), [activeDefense]);
  const eventProjections = useMemo(
    () => defenseCollection.items.map((defense) => reconcileTowerDefenseEvent([], defense, memberCollection.items)[0]),
    [defenseCollection.items, memberCollection.items]
  );

  const loadBackendReadState = useCallback(async () => {
    if (!dependencies.loadTowerDefenseReadState) return null;
    setBackendLoading(true);
    setBackendError(null);
    setReadSource('backend_loading');
    try {
      const result = await dependencies.loadTowerDefenseReadState({
        status: filters.status,
        result: filters.result,
        priority: filters.priority,
        tower: filters.tower,
        commander: filters.commander,
        participant: filters.participant,
        search: filters.search
      });
      setReadSource(result.source);
      setTowerDefinitions(result.towers);
      setBackendRoster(result.roster);
      defenseCollection.setItems(result.defenses);
      setBackendError(result.source === 'backend_error' ? result.error : null);
      return result;
    } catch (error) {
      const backendReadError = error instanceof Error ? error : new Error('Tower Defense backend read failed');
      setReadSource('backend_error');
      setTowerDefinitions([]);
      setBackendRoster([]);
      defenseCollection.setItems([]);
      setBackendError(backendReadError);
      return null;
    } finally {
      setBackendLoading(false);
    }
  }, [dependencies.loadTowerDefenseReadState, filters]);

  useEffect(() => {
    if (!dependencies.loadTowerDefenseReadState) return;
    void loadBackendReadState();
  }, [dependencies.loadTowerDefenseReadState, loadBackendReadState]);

  const refresh = useCallback(() => {
    if (dependencies.loadTowerDefenseReadState) void loadBackendReadState();
    else defenseCollection.refresh();
    eventCollection.refresh();
    memberCollection.refresh();
  }, [defenseCollection, dependencies.loadTowerDefenseReadState, eventCollection, loadBackendReadState, memberCollection]);

  const replaceDefense = useCallback(
    (saved: DragonTowerDefense) => {
      defenseCollection.setItems((items) => items.some((item) => item.id === saved.id) ? items.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...items]);
      eventCollection.setItems((items) => reconcileTowerDefenseEvent(items, saved, memberCollection.items));
      return saved;
    },
    [defenseCollection, eventCollection, memberCollection.items]
  );

  const persistDefense = useCallback(
    async (defense: DragonTowerDefense) => {
      setDomainError(null);
      preventDuplicateActiveDefenseForEvent(defenseCollection.items, defense);
      const currentExists = defenseCollection.items.some((item) => item.id === defense.id);
      const saved = currentExists
        ? await dependencies.towerDefenseRepository.update(defense.id, defense)
        : await dependencies.towerDefenseRepository.create(defense);
      return replaceDefense(saved);
    },
    [defenseCollection, dependencies.towerDefenseRepository, replaceDefense]
  );

  const runMutation = useCallback(
    async <T,>(operation: () => Promise<T>) => {
      if (mutating) throw new Error('Tower Defense request is already in progress');
      setDomainError(null);
      setMutating(true);
      try {
        return await operation();
      } finally {
        setMutating(false);
      }
    },
    [mutating]
  );

  const createDefense = useCallback(
    async (input: DragonTowerDefenseCreateInput) => {
      return runMutation(async () => {
        if (dependencies.backendOperations && readSource === 'backend') {
          const saved = await dependencies.backendOperations.createDefense(input);
          return replaceDefense(saved);
        }
        if (dependencies.backendOperations && (readSource === 'backend_loading' || readSource === 'backend_error')) {
          throw new Error('Tower Defense backend is not ready. Retry loading before creating a defense.');
        }
        const defense = createDragonTowerDefense(
          {
            ...input,
            eventId: input.eventId ?? buildDragonTowerDefenseEventId(input.id ?? `${input.towerCode}-${input.startsAt}`)
          },
          now
        );
        return persistDefense(defense);
      });
    },
    [dependencies.backendOperations, now, persistDefense, readSource, replaceDefense, runMutation]
  );

  const updateDefense = useCallback(
    async (defense: DragonTowerDefense, updates: Partial<DragonTowerDefenseCreateInput>) => {
      return runMutation(async () => {
        if (isBackendDefense(defense)) {
          if (!dependencies.backendOperations) throw new Error('Tower Defense backend operations are unavailable');
          return replaceDefense(await dependencies.backendOperations.updateDefense(defense, updates));
        }
        return persistDefense(editDragonTowerDefense(defense, updates, now));
      });
    },
    [dependencies.backendOperations, now, persistDefense, replaceDefense, runMutation]
  );

  const respond = useCallback(
    async (defense: DragonTowerDefense, memberId: string, response: DragonGuardResponseStatus, note?: string) => {
      return runMutation(async () => {
        if (isBackendDefense(defense)) {
          if (!dependencies.backendOperations) throw new Error('Tower Defense backend operations are unavailable');
          return replaceDefense(await dependencies.backendOperations.respond(defense, memberId, response, note));
        }
        return persistDefense(respondToDragonDefense(defense, memberId, response, now, note));
      });
    },
    [dependencies.backendOperations, now, persistDefense, replaceDefense, runMutation]
  );

  const withdrawResponse = useCallback(
    async (defense: DragonTowerDefense, memberId: string) => {
      return runMutation(async () => {
        if (isBackendDefense(defense)) {
          if (!dependencies.backendOperations) throw new Error('Tower Defense backend operations are unavailable');
          return replaceDefense(await dependencies.backendOperations.withdrawResponse(defense));
        }
        return persistDefense(withdrawDragonDefenseResponse(defense, memberId, now));
      });
    },
    [dependencies.backendOperations, now, persistDefense, replaceDefense, runMutation]
  );

  const confirmAttendance = useCallback(
    async (defense: DragonTowerDefense, memberId: string, status: DragonDefenseAttendanceStatus, confirmedByMemberId: string, note?: string) => {
      return runMutation(async () => {
        if (isBackendDefense(defense)) {
          if (!dependencies.backendOperations) throw new Error('Tower Defense backend operations are unavailable');
          return replaceDefense(await dependencies.backendOperations.confirmAttendance(defense, memberId, status, note));
        }
        return persistDefense(confirmDragonDefenseAttendance(defense, memberId, status, confirmedByMemberId, now, undefined, note));
      });
    },
    [dependencies.backendOperations, now, persistDefense, replaceDefense, runMutation]
  );

  const startDefense = useCallback(
    (defense: DragonTowerDefense) => {
      return runMutation(async () => {
        if (isBackendDefense(defense)) {
          if (!dependencies.backendOperations) throw new Error('Tower Defense backend operations are unavailable');
          return dependencies.backendOperations.startDefense(defense).then(replaceDefense);
        }
        return persistDefense(startDragonDefense(defense, now));
      });
    },
    [dependencies.backendOperations, now, persistDefense, replaceDefense, runMutation]
  );
  const completeDefense = useCallback(
    (defense: DragonTowerDefense, result: Exclude<DragonDefenseResult, 'pending' | 'cancelled'>, completedByMemberId: string, notes?: string, failureReason?: string) => {
      return runMutation(async () => {
        if (isBackendDefense(defense)) {
          if (!dependencies.backendOperations) throw new Error('Tower Defense backend operations are unavailable');
          return dependencies.backendOperations.completeDefense(defense, result, notes, failureReason).then(replaceDefense);
        }
        return persistDefense(completeDragonDefense(defense, result, completedByMemberId, now, notes, failureReason));
      });
    },
    [dependencies.backendOperations, now, persistDefense, replaceDefense, runMutation]
  );
  const cancelDefense = useCallback(
    (defense: DragonTowerDefense, cancelledByMemberId: string, reason?: string) => {
      return runMutation(async () => {
        if (isBackendDefense(defense)) {
          if (!dependencies.backendOperations) throw new Error('Tower Defense backend operations are unavailable');
          return dependencies.backendOperations.cancelDefense(defense, reason).then(replaceDefense);
        }
        return persistDefense(cancelDragonDefense(defense, cancelledByMemberId, now, reason));
      });
    },
    [dependencies.backendOperations, now, persistDefense, replaceDefense, runMutation]
  );

  return {
    now,
    filters,
    setFilters,
    rosterFilter,
    setRosterFilter,
    selectedDefense,
    setSelectedDefenseId,
    loading: backendReadEnabled ? backendLoading : defenseCollection.loading || eventCollection.loading || memberCollection.loading,
    refreshing: backendReadEnabled ? backendLoading : defenseCollection.refreshing || eventCollection.refreshing || memberCollection.refreshing,
    error: backendReadEnabled ? backendError : defenseCollection.error ?? eventCollection.error ?? memberCollection.error,
    domainError,
    setDomainError,
    refresh,
    defenses,
    allDefenses: defenseCollection.items,
    events: eventCollection.items,
    eventProjections,
    members: memberCollection.items,
    activeDefense,
    upcomingDefenses,
    history,
    statistics,
    roster,
    filteredRoster,
    readiness,
    readSource,
    mutating,
    towerDefinitions,
    createDefense,
    updateDefense,
    respond,
    withdrawResponse,
    confirmAttendance,
    startDefense,
    completeDefense,
    cancelDefense,
    buildCompletionOutput: buildTowerDefenseCompletionOutput,
    buildProfileTimeline: buildTowerDefenseProfileTimeline
  };
}

function isBackendDefense(defense: DragonTowerDefense): boolean {
  return defense.dataSource === 'backend' || defense.backendMetadata?.dataSource === 'backend';
}
