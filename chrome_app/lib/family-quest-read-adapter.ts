import {
  listBackendFamilyQuestTemplates,
  listBackendFamilyQuests
} from './family-quest-backend-client.ts';
import {
  includeBackendQuestViewTemplates,
  mapBackendQuest,
  mapBackendQuestReport,
  mapBackendQuestTemplate
} from './family-quest-backend-mapper.ts';
import {
  readFamilyQuestReports,
  readFamilyQuestTemplates,
  readFamilyQuests
} from './family-repositories.ts';
import type { FamilyQuest, FamilyQuestReport, FamilyQuestTemplate } from './family-types.ts';

export type FamilyQuestReadSource = 'backend_loading' | 'backend' | 'backend_error' | 'dev_local_fallback' | 'local';

type FamilyQuestSourceEnvironment = {
  mode?: string;
  dev?: boolean;
  prod?: boolean;
  allowLocalFallback?: string;
};

export type FamilyQuestReadState = {
  source: FamilyQuestReadSource;
  templates: FamilyQuestTemplate[];
  quests: FamilyQuest[];
  reports: FamilyQuestReport[];
  error: Error | null;
};

export type FamilyQuestReadDependencies = {
  listBackendTemplates?: typeof listBackendFamilyQuestTemplates;
  listBackendQuests?: typeof listBackendFamilyQuests;
  readLocalTemplates?: typeof readFamilyQuestTemplates;
  readLocalQuests?: typeof readFamilyQuests;
  readLocalReports?: typeof readFamilyQuestReports;
  allowDevLocalFallback?: boolean;
  env?: FamilyQuestSourceEnvironment;
};

export async function loadFamilyQuestReadState(signal?: AbortSignal, dependencies: FamilyQuestReadDependencies = {}): Promise<FamilyQuestReadState> {
  const listTemplates = dependencies.listBackendTemplates ?? listBackendFamilyQuestTemplates;
  const listQuests = dependencies.listBackendQuests ?? listBackendFamilyQuests;
  try {
    const [templateResponse, questResponse] = await Promise.all([
      listTemplates(signal),
      listQuests({ signal }),
    ]);
    const quests = questResponse.items.map(mapBackendQuest);
    return {
      source: 'backend',
      templates: includeBackendQuestViewTemplates(templateResponse.items.map(mapBackendQuestTemplate), quests),
      quests,
      reports: quests.map(mapBackendQuestReport).filter((report): report is FamilyQuestReport => Boolean(report)),
      error: null,
    };
  } catch (error) {
    const backendError = error instanceof Error ? error : new Error('Backend quest read failed');
    if (!(dependencies.allowDevLocalFallback ?? isFamilyQuestLocalFallbackAllowed(dependencies.env))) {
      return {
        source: 'backend_error',
        templates: [],
        quests: [],
        reports: [],
        error: backendError,
      };
    }
    return {
      source: 'dev_local_fallback',
      templates: (dependencies.readLocalTemplates ?? readFamilyQuestTemplates)(),
      quests: (dependencies.readLocalQuests ?? readFamilyQuests)(),
      reports: (dependencies.readLocalReports ?? readFamilyQuestReports)(),
      error: backendError,
    };
  }
}

export function isFamilyQuestLocalFallbackAllowed(env: FamilyQuestSourceEnvironment = getImportMetaEnv()): boolean {
  if (env.prod || env.mode === 'production') return false;
  return env.dev === true && env.allowLocalFallback === 'true';
}

function getImportMetaEnv(): FamilyQuestSourceEnvironment {
  try {
    const env = (import.meta as unknown as { env?: Record<string, unknown> }).env ?? {};
    return {
      mode: String(env.MODE ?? ''),
      dev: env.DEV === true,
      prod: env.PROD === true,
      allowLocalFallback: String(env.FAMILY_QUEST_ALLOW_LOCAL_FALLBACK ?? '')
    };
  } catch {
    return {};
  }
}
