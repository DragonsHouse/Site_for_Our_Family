import type {
  FamilyQuestListQuery,
  FamilyQuestPersonRecord,
  FamilyQuestPersonRole,
  FamilyQuestRecord,
  FamilyQuestStatus,
  FamilyQuestTemplateRecord,
} from './quest-models.js';

export type UpsertQuestPersonInput = {
  questId: string;
  familyMemberId: string;
  displayName: string;
  role: FamilyQuestPersonRole;
  joinedAt: string;
  addedByFamilyMemberId: string | null;
  metadata?: Record<string, unknown>;
};

export interface FamilyQuestRepository {
  listTemplates(): Promise<FamilyQuestTemplateRecord[]>;
  listQuests(query?: FamilyQuestListQuery): Promise<FamilyQuestRecord[]>;
  findQuestById(id: string): Promise<FamilyQuestRecord | null>;
  familyMemberExists(id: string): Promise<boolean>;
  upsertQuestPerson(input: UpsertQuestPersonInput): Promise<FamilyQuestPersonRecord>;
  removeQuestPerson(questId: string, familyMemberId: string, leftAt: string): Promise<FamilyQuestPersonRecord>;
  updateQuestStatus(id: string, input: { status: FamilyQuestStatus; actorFamilyMemberId: string; now: string; comment?: string | null }): Promise<FamilyQuestRecord | null>;
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

  async familyMemberExists(id: string): Promise<boolean> {
    return this.quests.some((quest) => quest.people.some((person) => person.familyMemberId === id)) || id.length > 0;
  }

  async upsertQuestPerson(input: UpsertQuestPersonInput): Promise<FamilyQuestPersonRecord> {
    const quest = this.quests.find((item) => item.id === input.questId);
    if (!quest) throw new Error('Quest not found');
    const current = quest.people.find((person) => person.familyMemberId === input.familyMemberId && !person.leftAt);
    const now = new Date().toISOString();
    if (current) {
      current.role = input.role;
      current.displayName = input.displayName;
      current.updatedAt = now;
      return current;
    }
    const person: FamilyQuestPersonRecord = {
      id: `quest-person-${quest.people.length + 1}`,
      questId: input.questId,
      familyMemberId: input.familyMemberId,
      displayName: input.displayName,
      role: input.role,
      joinedAt: input.joinedAt,
      leftAt: null,
      joinedLate: false,
      participationNote: null,
      addedManually: false,
      addedByFamilyMemberId: input.addedByFamilyMemberId,
      rewardPercent: null,
      rewardAmount: 0,
      bonusAmount: 0,
      bonusPercent: 0,
      isBestParticipant: false,
      bestParticipantReason: null,
      payoutStatus: 'pending',
      paidAt: null,
      paidByFamilyMemberId: null,
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };
    quest.people.push(person);
    return person;
  }

  async removeQuestPerson(questId: string, familyMemberId: string, leftAt: string): Promise<FamilyQuestPersonRecord> {
    const quest = this.quests.find((item) => item.id === questId);
    const person = quest?.people.find((item) => item.familyMemberId === familyMemberId && !item.leftAt);
    if (!person) throw new Error('Quest person not found');
    person.leftAt = leftAt;
    person.updatedAt = leftAt;
    return person;
  }

  async updateQuestStatus(id: string, input: { status: FamilyQuestStatus; actorFamilyMemberId: string; now: string; comment?: string | null }): Promise<FamilyQuestRecord | null> {
    const quest = this.quests.find((item) => item.id === id);
    if (!quest) return null;
    const previous = quest.status;
    quest.status = input.status;
    quest.endsAt = quest.endsAt ?? input.now;
    quest.updatedAt = input.now;
    quest.auditTrail.push({
      id: `quest-audit-${quest.auditTrail.length + 1}`,
      questId: id,
      actorFamilyMemberId: input.actorFamilyMemberId,
      action: `quest_${input.status}`,
      comment: input.comment ?? null,
      previousStatus: previous,
      newStatus: input.status,
      relatedFamilyMemberId: null,
      metadata: {},
      createdAt: input.now,
    });
    return quest;
  }
}
