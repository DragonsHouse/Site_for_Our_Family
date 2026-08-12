import type {
  FamilyQuestListQuery,
  FamilyQuestRecord,
  FamilyQuestTemplateRecord,
} from './quest-models.js';

export interface FamilyQuestRepository {
  listTemplates(): Promise<FamilyQuestTemplateRecord[]>;
  listQuests(query?: FamilyQuestListQuery): Promise<FamilyQuestRecord[]>;
  findQuestById(id: string): Promise<FamilyQuestRecord | null>;
}

export class MemoryFamilyQuestRepository implements FamilyQuestRepository {
  constructor(
    private readonly templates: FamilyQuestTemplateRecord[] = [],
    private readonly quests: FamilyQuestRecord[] = [],
  ) {}

  async listTemplates(): Promise<FamilyQuestTemplateRecord[]> {
    return [...this.templates].sort((left, right) => left.title.localeCompare(right.title));
  }

  async listQuests(query: FamilyQuestListQuery = {}): Promise<FamilyQuestRecord[]> {
    let items = [...this.quests];
    if (query.status && query.status !== 'all') items = items.filter((quest) => quest.status === query.status);
    if (query.activeOnly) items = items.filter((quest) => !['paid', 'stopped'].includes(quest.status));
    return items.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async findQuestById(id: string): Promise<FamilyQuestRecord | null> {
    return this.quests.find((quest) => quest.id === id) ?? null;
  }
}
