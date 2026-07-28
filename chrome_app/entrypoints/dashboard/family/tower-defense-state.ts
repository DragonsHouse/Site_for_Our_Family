import { useCallback, useMemo, useState } from 'react';
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
  DragonTowerDefense,
  DragonTowerDefenseCreateInput,
  DragonTowerDefenseFilters,
  DragonTowerDefenseRosterFilter
} from './tower-defense-models';
import type { DragonTowerDefenseUpdateRepositoryInput } from './tower-defense-repository';

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
  const roster = useMemo(() => buildDragonFireGuardRoster(activeDefense, memberCollection.items), [activeDefense, memberCollection.items]);
  const filteredRoster = useMemo(() => filterDragonFireGuardRoster(roster, rosterFilter), [roster, rosterFilter]);
  const readiness = useMemo(() => (activeDefense ? calculateDragonDefenseReadiness(activeDefense) : null), [activeDefense]);
  const eventProjections = useMemo(
    () => defenseCollection.items.map((defense) => reconcileTowerDefenseEvent([], defense, memberCollection.items)[0]),
    [defenseCollection.items, memberCollection.items]
  );

  const refresh = useCallback(() => {
    defenseCollection.refresh();
    eventCollection.refresh();
    memberCollection.refresh();
  }, [defenseCollection, eventCollection, memberCollection]);

  const persistDefense = useCallback(
    async (defense: DragonTowerDefense) => {
      setDomainError(null);
      preventDuplicateActiveDefenseForEvent(defenseCollection.items, defense);
      const currentExists = defenseCollection.items.some((item) => item.id === defense.id);
      const saved = currentExists
        ? await dependencies.towerDefenseRepository.update(defense.id, defense)
        : await dependencies.towerDefenseRepository.create(defense);
      defenseCollection.setItems((items) => (currentExists ? items.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...items]));
      eventCollection.setItems((items) => reconcileTowerDefenseEvent(items, saved, memberCollection.items));
      return saved;
    },
    [defenseCollection, dependencies.towerDefenseRepository, eventCollection, memberCollection.items]
  );

  const createDefense = useCallback(
    async (input: DragonTowerDefenseCreateInput) => {
      const defense = createDragonTowerDefense(
        {
          ...input,
          eventId: input.eventId ?? buildDragonTowerDefenseEventId(input.id ?? `${input.towerCode}-${input.startsAt}`)
        },
        now
      );
      return persistDefense(defense);
    },
    [now, persistDefense]
  );

  const updateDefense = useCallback(
    async (defense: DragonTowerDefense, updates: Partial<DragonTowerDefenseCreateInput>) => persistDefense(editDragonTowerDefense(defense, updates, now)),
    [now, persistDefense]
  );

  const respond = useCallback(
    async (defense: DragonTowerDefense, memberId: string, response: DragonGuardResponseStatus, note?: string) =>
      persistDefense(respondToDragonDefense(defense, memberId, response, now, note)),
    [now, persistDefense]
  );

  const withdrawResponse = useCallback(
    async (defense: DragonTowerDefense, memberId: string) => persistDefense(withdrawDragonDefenseResponse(defense, memberId, now)),
    [now, persistDefense]
  );

  const confirmAttendance = useCallback(
    async (defense: DragonTowerDefense, memberId: string, status: DragonDefenseAttendanceStatus, confirmedByMemberId: string, note?: string) =>
      persistDefense(confirmDragonDefenseAttendance(defense, memberId, status, confirmedByMemberId, now, undefined, note)),
    [now, persistDefense]
  );

  const startDefense = useCallback((defense: DragonTowerDefense) => persistDefense(startDragonDefense(defense, now)), [now, persistDefense]);
  const completeDefense = useCallback(
    (defense: DragonTowerDefense, result: Exclude<DragonDefenseResult, 'pending' | 'cancelled'>, completedByMemberId: string, notes?: string, failureReason?: string) =>
      persistDefense(completeDragonDefense(defense, result, completedByMemberId, now, notes, failureReason)),
    [now, persistDefense]
  );
  const cancelDefense = useCallback(
    (defense: DragonTowerDefense, cancelledByMemberId: string, reason?: string) =>
      persistDefense(cancelDragonDefense(defense, cancelledByMemberId, now, reason)),
    [now, persistDefense]
  );

  return {
    now,
    filters,
    setFilters,
    rosterFilter,
    setRosterFilter,
    selectedDefense,
    setSelectedDefenseId,
    loading: defenseCollection.loading || eventCollection.loading || memberCollection.loading,
    refreshing: defenseCollection.refreshing || eventCollection.refreshing || memberCollection.refreshing,
    error: defenseCollection.error ?? eventCollection.error ?? memberCollection.error,
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
