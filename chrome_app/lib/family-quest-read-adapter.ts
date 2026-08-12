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

export type FamilyQuestReadState = {
  source: 'backend' | 'local';
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
    return {
      source: 'local',
      templates: (dependencies.readLocalTemplates ?? readFamilyQuestTemplates)(),
      quests: (dependencies.readLocalQuests ?? readFamilyQuests)(),
      reports: (dependencies.readLocalReports ?? readFamilyQuestReports)(),
      error: error instanceof Error ? error : new Error('Backend quest read failed'),
    };
  }
}
