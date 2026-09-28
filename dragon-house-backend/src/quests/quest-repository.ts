import type {
  FamilyQuestListQuery,
  FamilyQuestPersonRecord,
  FamilyQuestPersonRole,
  FamilyQuestRecord,
  FamilyQuestStatus,
  FamilyQuestTemplateWriteInput,
  FamilyQuestTemplateRecord,
  FamilyQuestWriteInput,
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
  createTemplate(input: FamilyQuestTemplateWriteInput, actorFamilyMemberId: string, now: string): Promise<FamilyQuestTemplateRecord>;
  updateTemplate(id: string, input: Partial<FamilyQuestTemplateWriteInput>, actorFamilyMemberId: string, now: string): Promise<FamilyQuestTemplateRecord | null>;
  listQuests(query?: FamilyQuestListQuery): Promise<FamilyQuestRecord[]>;
  findQuestById(id: string): Promise<FamilyQuestRecord | null>;
  createQuest(input: FamilyQuestWriteInput, actorFamilyMemberId: string, now: string): Promise<FamilyQuestRecord>;
  updateQuest(id: string, input: Partial<FamilyQuestWriteInput>, actorFamilyMemberId: string, now: string): Promise<FamilyQuestRecord | null>;
  familyMemberExists(id: string): Promise<boolean>;
  upsertQuestPerson(input: UpsertQuestPersonInput): Promise<FamilyQuestPersonRecord>;
  removeQuestPerson(questId: string, familyMemberId: string, leftAt: string): Promise<FamilyQuestPersonRecord>;
  updateQuestStatus(id: string, input: { status: FamilyQuestStatus; actorFamilyMemberId: string; now: string; comment?: string | null }): Promise<FamilyQuestRecord | null>;
  createQuestReport(id: string, input: { actorFamilyMemberId: string; title: string; comment?: string | null; now: string }): Promise<FamilyQuestRecord | null>;
  transferQuestReportToAccounting(id: string, input: { actorFamilyMemberId: string; now: string }): Promise<FamilyQuestRecord | null>;
}

export class MemoryFamilyQuestRepository implements FamilyQuestRepository {
  constructor(
    private readonly templates: FamilyQuestTemplateRecord[] = [],
    private readonly quests: FamilyQuestRecord[] = [],
  ) {}

  async listTemplates(): Promise<FamilyQuestTemplateRecord[]> {
    return [...this.templates].sort((left, right) => left.title.localeCompare(right.title));
  }

  async createTemplate(input: FamilyQuestTemplateWriteInput, _actorFamilyMemberId: string, now: string): Promise<FamilyQuestTemplateRecord> {
    const template: FamilyQuestTemplateRecord = {
      id: input.id ?? `template-${this.templates.length + 1}`,
      templateKey: input.templateKey ?? slug(input.title),
      title: input.title,
      category: input.category,
      description: input.description ?? null,
      steps: input.steps ?? [],
      recommendedTeamSize: input.recommendedTeamSize ?? 1,
      totalReward: input.totalReward ?? 0,
      memberRewardPool: input.memberRewardPool ?? 0,
      familyReward: input.familyReward ?? 0,
      rewardMode: input.rewardMode ?? 'equal',
      requiredItems: input.requiredItems ?? null,
      imageAssetId: input.imageAssetId ?? null,
      isActive: input.isActive ?? true,
      cooldownHours: input.cooldownHours ?? 24,
      cooldownUntil: null,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };
    this.templates.unshift(template);
    return template;
  }

  async updateTemplate(id: string, input: Partial<FamilyQuestTemplateWriteInput>, _actorFamilyMemberId: string, now: string): Promise<FamilyQuestTemplateRecord | null> {
    const index = this.templates.findIndex((template) => template.id === id);
    if (index < 0) return null;
    const current = this.templates[index];
    const next: FamilyQuestTemplateRecord = {
      ...current,
      title: input.title ?? current.title,
      category: input.category ?? current.category,
      description: input.description !== undefined ? input.description : current.description,
      steps: input.steps ?? current.steps,
      recommendedTeamSize: input.recommendedTeamSize ?? current.recommendedTeamSize,
      totalReward: input.totalReward ?? current.totalReward,
      memberRewardPool: input.memberRewardPool ?? current.memberRewardPool,
      familyReward: input.familyReward ?? current.familyReward,
      rewardMode: input.rewardMode ?? current.rewardMode,
      requiredItems: input.requiredItems !== undefined ? input.requiredItems : current.requiredItems,
      imageAssetId: input.imageAssetId !== undefined ? input.imageAssetId : current.imageAssetId,
      isActive: input.isActive ?? current.isActive,
      cooldownHours: input.cooldownHours ?? current.cooldownHours,
      updatedAt: now,
    };
    this.templates[index] = next;
    return next;
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

  async createQuest(input: FamilyQuestWriteInput, actorFamilyMemberId: string, now: string): Promise<FamilyQuestRecord> {
    const quest: FamilyQuestRecord = {
      id: input.id ?? `quest-${this.quests.length + 1}`,
      templateId: input.templateId ?? null,
      title: input.title,
      description: input.description ?? '',
      category: input.category,
      status: input.status ?? 'recruiting',
      startsAt: input.startsAt ?? null,
      endsAt: null,
      scheduledAt: input.scheduledAt ?? input.startsAt ?? null,
      organizerFamilyMemberId: actorFamilyMemberId,
      totalReward: input.totalReward ?? 0,
      memberRewardPool: input.memberRewardPool ?? 0,
      familyReward: input.familyReward ?? 0,
      rewardMode: input.rewardMode ?? 'equal',
      requiredItems: input.requiredItems ?? null,
      bestParticipantFamilyMemberId: null,
      bestParticipantReason: null,
      reportId: null,
      reportSentToAccountingAt: null,
      paidAt: null,
      paidByFamilyMemberId: null,
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now,
      people: [],
      rewards: [],
      report: null,
      payouts: [],
      auditTrail: [{
        id: `quest-audit-${Date.now()}`,
        questId: input.id ?? `quest-${this.quests.length + 1}`,
        actorFamilyMemberId,
        action: 'quest_created',
        comment: null,
        previousStatus: null,
        newStatus: input.status ?? 'recruiting',
        relatedFamilyMemberId: null,
        metadata: {},
        createdAt: now,
      }],
    };
    this.quests.unshift(quest);
    return quest;
  }

  async updateQuest(id: string, input: Partial<FamilyQuestWriteInput>, actorFamilyMemberId: string, now: string): Promise<FamilyQuestRecord | null> {
    const quest = this.quests.find((item) => item.id === id);
    if (!quest) return null;
    const previousStatus = quest.status;
    quest.templateId = input.templateId !== undefined ? input.templateId : quest.templateId;
    quest.title = input.title ?? quest.title;
    quest.description = input.description !== undefined ? input.description ?? '' : quest.description;
    quest.category = input.category ?? quest.category;
    quest.status = input.status ?? quest.status;
    quest.startsAt = input.startsAt !== undefined ? input.startsAt : quest.startsAt;
    quest.scheduledAt = input.scheduledAt !== undefined ? input.scheduledAt : quest.scheduledAt;
    quest.totalReward = input.totalReward ?? quest.totalReward;
    quest.memberRewardPool = input.memberRewardPool ?? quest.memberRewardPool;
    quest.familyReward = input.familyReward ?? quest.familyReward;
    quest.rewardMode = input.rewardMode ?? quest.rewardMode;
    quest.requiredItems = input.requiredItems !== undefined ? input.requiredItems : quest.requiredItems;
    quest.metadata = { ...quest.metadata, ...(input.metadata ?? {}) };
    quest.updatedAt = now;
    quest.auditTrail.unshift({
      id: `quest-audit-${Date.now()}`,
      questId: id,
      actorFamilyMemberId,
      action: 'quest_updated',
      comment: null,
      previousStatus,
      newStatus: quest.status,
      relatedFamilyMemberId: null,
      metadata: {},
      createdAt: now,
    });
    return quest;
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

  async createQuestReport(id: string, input: { actorFamilyMemberId: string; title: string; comment?: string | null; now: string }): Promise<FamilyQuestRecord | null> {
    const quest = this.quests.find((item) => item.id === id);
    if (!quest) return null;
    const report = quest.report ?? {
      id: `quest-report-${this.quests.length + 1}`,
      questId: id,
      title: input.title,
      comment: input.comment ?? null,
      confirmedByFamilyMemberId: input.actorFamilyMemberId,
      totalReward: quest.totalReward,
      memberRewardPool: quest.memberRewardPool,
      familyReward: quest.familyReward,
      transferredToAccountingAt: null,
      metadata: {},
      createdAt: input.now,
      updatedAt: input.now,
    };
    quest.report = report;
    quest.reportId = report.id;
    quest.status = 'reported';
    quest.updatedAt = input.now;
    return quest;
  }

  async transferQuestReportToAccounting(id: string, input: { actorFamilyMemberId: string; now: string }): Promise<FamilyQuestRecord | null> {
    const quest = this.quests.find((item) => item.id === id);
    if (!quest?.report) return quest ?? null;
    quest.report.transferredToAccountingAt = quest.report.transferredToAccountingAt ?? input.now;
    quest.report.updatedAt = input.now;
    quest.reportSentToAccountingAt = quest.report.transferredToAccountingAt;
    quest.status = 'sent_to_accounting';
    quest.updatedAt = input.now;
    const payablePeople = quest.people.filter((person) => !person.leftAt && person.role === 'participant' && person.familyMemberId);
    const fallback = payablePeople.length ? Math.round((quest.memberRewardPool / payablePeople.length) * 100) / 100 : 0;
    quest.payouts = quest.payouts.length ? quest.payouts : payablePeople.map((person, index) => ({
      id: `quest-payout-${index + 1}`,
      questId: quest.id,
      reportId: quest.report?.id ?? null,
      questPersonId: person.id,
      familyMemberId: person.familyMemberId,
      displayName: person.displayName,
      amount: person.rewardAmount > 0 ? person.rewardAmount : fallback,
      rewardPercent: person.rewardPercent,
      rewardItems: [],
      bonusAmount: person.bonusAmount,
      bonusPercent: person.bonusPercent,
      status: 'pending',
      paidAt: null,
      paidByFamilyMemberId: null,
      idempotencyKey: null,
      accrualId: null,
      accountingTransactionId: null,
      issuedAt: null,
      issuedByFamilyMemberId: null,
      payoutEventKey: null,
      metadata: {},
      createdAt: input.now,
      updatedAt: input.now,
    }));
    return quest;
  }
}

function slug(value: string): string {
  const slugged = value.trim().toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '');
  return slugged || `template-${Date.now()}`;
}
