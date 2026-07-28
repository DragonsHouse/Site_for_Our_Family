import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  DiscordRoleSnapshot,
  DiscordSyncApplyResult,
  DiscordSyncAuditRecord,
  DiscordSyncIntegrationStatus,
  DiscordSyncPlan,
  DiscordSyncPlanFilter,
  DiscordSyncPlanItem
} from './discord-sync-models';
import { createDragonDiscordSyncService, type DragonDiscordSyncService } from './discord-sync-service';

export type DragonDiscordSyncStateDependencies = {
  service: DragonDiscordSyncService;
};

export function createDragonDiscordSyncStateDependencies(
  overrides: Partial<DragonDiscordSyncStateDependencies> = {}
): DragonDiscordSyncStateDependencies {
  return {
    service: createDragonDiscordSyncService(),
    ...overrides
  };
}

export function useDragonDiscordSyncState(
  dependencies: DragonDiscordSyncStateDependencies = createDragonDiscordSyncStateDependencies()
) {
  const [status, setStatus] = useState<DiscordSyncIntegrationStatus | null>(null);
  const [plan, setPlan] = useState<DiscordSyncPlan | null>(null);
  const [history, setHistory] = useState<DiscordSyncAuditRecord[]>([]);
  const [roleMappings, setRoleMappings] = useState<DiscordRoleSnapshot[]>([]);
  const [applyResult, setApplyResult] = useState<DiscordSyncApplyResult | null>(null);
  const [filter, setFilter] = useState<DiscordSyncPlanFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<DiscordSyncPlanItem | null>(null);
  const [selectedAudit, setSelectedAudit] = useState<DiscordSyncAuditRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningDryRun, setRunningDryRun] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextStatus, nextHistory, nextRoleMappings] = await Promise.all([
        dependencies.service.getStatus(),
        dependencies.service.getHistory(),
        dependencies.service.getRoleMappings()
      ]);
      setStatus(nextStatus);
      setHistory(nextHistory);
      setRoleMappings(nextRoleMappings);
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error('Discord synchronization state failed to load.'));
    } finally {
      setLoading(false);
    }
  }, [dependencies.service]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const generateDryRun = useCallback(async () => {
    setRunningDryRun(true);
    setError(null);
    try {
      const nextPlan = await dependencies.service.generateDryRunPlan();
      setPlan(nextPlan);
      setApplyResult(null);
      setHistory(await dependencies.service.getHistory());
      return nextPlan;
    } catch (caught) {
      const error = caught instanceof Error ? caught : new Error('Discord synchronization dry-run failed.');
      setError(error);
      throw error;
    } finally {
      setRunningDryRun(false);
    }
  }, [dependencies.service]);

  const applyPlan = useCallback(async () => {
    if (!plan) return null;
    setApplying(true);
    setError(null);
    try {
      const result = await dependencies.service.applyPlan(plan.planId, dependencies.service.createIdempotencyKey(plan.planId));
      setApplyResult(result);
      setPlan({ ...plan, applied: true });
      setHistory(await dependencies.service.getHistory());
      setStatus(await dependencies.service.getStatus());
      return result;
    } catch (caught) {
      const error = caught instanceof Error ? caught : new Error('Discord synchronization apply failed.');
      setError(error);
      throw error;
    } finally {
      setApplying(false);
    }
  }, [dependencies.service, plan]);

  const visibleItems = useMemo(
    () => dependencies.service.filterPlanItems(plan, filter, search),
    [dependencies.service, filter, plan, search]
  );

  return {
    status,
    plan,
    history,
    roleMappings,
    applyResult,
    loading,
    runningDryRun,
    applying,
    error,
    refresh,
    generateDryRun,
    applyPlan,
    canApply: dependencies.service.canApplyPlan(plan),
    filter,
    setFilter,
    search,
    setSearch,
    visibleItems,
    selectedItem,
    setSelectedItem,
    selectedAudit,
    setSelectedAudit,
    backendIntegration: {
      routeBoundary: 'Discord Sync UI -> sync state -> sync service/client -> backend API',
      noDirectDiscordApi: true,
      towerDefenseRosterMetadata: 'DiscordTowerDefenseRosterMetadata'
    }
  };
}
