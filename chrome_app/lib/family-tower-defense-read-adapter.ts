import type { BackendTowerDefenseFilters } from './family-tower-defense-backend-client.ts';
import type {
  BackendFireGuardRosterResponse,
  BackendTowerDefenseListResponse,
  BackendTowerListResponse
} from './family-tower-defense-backend-response.ts';
import {
  mapBackendFireGuardRosterEntry,
  mapBackendTower,
  mapBackendTowerDefense
} from './family-tower-defense-backend-mapper.ts';
import type {
  DragonFireGuardRosterEntry,
  DragonTowerDefinition,
  DragonTowerDefense
} from '../entrypoints/dashboard/family/tower-defense-models.ts';
import { DRAGON_TOWER_DEFENSE_MOCK_DATA } from '../entrypoints/dashboard/family/tower-defense-mock-data.ts';
import { buildDragonFireGuardRoster } from '../entrypoints/dashboard/family/tower-defense-service.ts';
import { DRAGON_MEMBERS_MOCK_DATA } from '../entrypoints/dashboard/family/members-mock-data.ts';

export type DragonTowerDefenseReadSource = 'backend_loading' | 'backend' | 'backend_error' | 'dev_mock_fallback' | 'local';

type TowerDefenseSourceEnvironment = {
  mode?: string;
  dev?: boolean;
  prod?: boolean;
  allowMockFallback?: string;
};

export type DragonTowerDefenseReadState = {
  source: DragonTowerDefenseReadSource;
  towers: DragonTowerDefinition[];
  defenses: DragonTowerDefense[];
  roster: DragonFireGuardRosterEntry[];
  error: Error | null;
};

export type DragonTowerDefenseReadDependencies = {
  listTowers?: (signal?: AbortSignal) => Promise<BackendTowerListResponse>;
  listDefenses?: (filters?: BackendTowerDefenseFilters, signal?: AbortSignal) => Promise<BackendTowerDefenseListResponse>;
  listRoster?: (signal?: AbortSignal) => Promise<BackendFireGuardRosterResponse>;
  readLocalDefenses?: () => DragonTowerDefense[];
  allowDevMockFallback?: boolean;
  env?: TowerDefenseSourceEnvironment;
};

export async function loadDragonTowerDefenseReadState(
  filters: BackendTowerDefenseFilters = {},
  signal?: AbortSignal,
  dependencies: DragonTowerDefenseReadDependencies = {}
): Promise<DragonTowerDefenseReadState> {
  const defaults = dependencies.listTowers && dependencies.listDefenses && dependencies.listRoster
    ? null
    : await import('./family-tower-defense-backend-client.ts');
  const listTowers = dependencies.listTowers ?? defaults!.listBackendFamilyTowers;
  const listDefenses = dependencies.listDefenses ?? defaults!.listBackendTowerDefenses;
  const listRoster = dependencies.listRoster ?? defaults!.listBackendFireGuardRoster;
  try {
    const [towerResponse, defenseResponse, rosterResponse] = await Promise.all([
      listTowers(signal),
      listDefenses(filters, signal),
      listRoster(signal),
    ]);
    const defenses = defenseResponse.items.map(mapBackendTowerDefense);
    const activeDefense =
      defenses.find((defense) => defense.status === 'active') ??
      defenses.find((defense) => defense.status === 'gathering') ??
      defenses.find((defense) => defense.status === 'scheduled') ??
      null;
    return {
      source: 'backend',
      towers: towerResponse.items.map(mapBackendTower),
      defenses,
      roster: rosterResponse.items.map((entry) => mapBackendFireGuardRosterEntry(entry, activeDefense)),
      error: null
    };
  } catch (error) {
    const backendError = error instanceof Error ? error : new Error('Tower Defense backend read failed');
    if (!(dependencies.allowDevMockFallback ?? isTowerDefenseMockFallbackAllowed(dependencies.env))) {
      return {
        source: 'backend_error',
        towers: [],
        defenses: [],
        roster: [],
        error: backendError
      };
    }
    const defenses = (dependencies.readLocalDefenses ?? (() => DRAGON_TOWER_DEFENSE_MOCK_DATA))().map((defense) => ({
      ...defense,
      dataSource: 'local' as const
    }));
    const activeDefense =
      defenses.find((defense) => defense.status === 'active') ??
      defenses.find((defense) => defense.status === 'gathering') ??
      defenses.find((defense) => defense.status === 'scheduled') ??
      null;
    return {
      source: 'dev_mock_fallback',
      towers: localTowersFromDefenses(defenses),
      defenses,
      roster: buildDragonFireGuardRoster(activeDefense, DRAGON_MEMBERS_MOCK_DATA).map((entry) => ({ ...entry, source: 'local' as const })),
      error: backendError
    };
  }
}

export function isTowerDefenseMockFallbackAllowed(env: TowerDefenseSourceEnvironment = getImportMetaEnv()): boolean {
  if (env.prod || env.mode === 'production') return false;
  return env.dev === true && env.allowMockFallback === 'true';
}

function getImportMetaEnv(): TowerDefenseSourceEnvironment {
  try {
    const env = (import.meta as unknown as { env?: Record<string, unknown> }).env ?? {};
    return {
      mode: String(env.MODE ?? ''),
      dev: env.DEV === true,
      prod: env.PROD === true,
      allowMockFallback: String(env.TOWER_DEFENSE_ALLOW_MOCK_FALLBACK ?? '')
    };
  } catch {
    return {};
  }
}

function localTowersFromDefenses(defenses: DragonTowerDefense[]): DragonTowerDefinition[] {
  const byId = new Map<string, DragonTowerDefinition>();
  for (const defense of defenses) {
    if (byId.has(defense.tower.towerId)) continue;
    byId.set(defense.tower.towerId, {
      id: defense.tower.towerId,
      towerCode: defense.tower.towerCode,
      towerName: defense.tower.towerName,
      location: defense.tower.location,
      map: defense.tower.map,
      visual: defense.tower.visual,
      active: true,
      source: 'local'
    });
  }
  return [...byId.values()];
}
