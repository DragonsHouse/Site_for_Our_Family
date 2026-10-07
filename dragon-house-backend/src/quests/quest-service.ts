import type { FamilyAuthContext } from '../types.js';
import type { FamilyMemberRepository } from '../members/member-repository.js';
import { FamilyQuestError } from './quest-errors.js';
import type {
  FamilyQuestListQuery,
  FamilyQuestRecord,
  FamilyQuestRewardMode,
  FamilyQuestStatus,
  FamilyQuestTemplateWriteInput,
  FamilyQuestTemplateRecord,
  FamilyQuestWriteInput,
} from './quest-models.js';
import type { FamilyQuestRepository } from './quest-repository.js';

export type FamilyQuestTemplateDto = {
  id: string;
  templateKey: string;
  title: string;
  category: string;
  description: string | null;
  steps: string[];
  recommendedTeamSize: number;
  totalReward: number;
  memberRewardPool: number;
  familyReward: number;
  rewardMode: string;
  requiredItems: string | null;
  imageAssetId: string | null;
  isActive: boolean;
  cooldownHours: number;
  cooldownUntil: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type FamilyQuestDto = {
  id: string;
  templateId: string | null;
  title: string;
  description: string;
  category: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  scheduledAt: string | null;
  organizerFamilyMemberId: string | null;
  totalReward: number;
  memberRewardPool: number;
  familyReward: number;
  rewardMode: string;
  requiredItems: string | null;
  bestParticipantFamilyMemberId: string | null;
  bestParticipantReason: string | null;
  reportId: string | null;
  reportSentToAccountingAt: string | null;
  paidAt: string | null;
  paidByFamilyMemberId: string | null;
  version: number;
  participants: FamilyQuestPersonDto[];
  helpers: FamilyQuestPersonDto[];
  rewards: FamilyQuestRewardDto[];
  report: FamilyQuestReportDto | null;
  payouts: FamilyQuestPayoutDto[];
  auditTrail: FamilyQuestAuditDto[];
  createdAt: string;
  updatedAt: string;
};

export type FamilyQuestPersonDto = {
  id: string;
  familyMemberId: string | null;
  displayName: string;
  role: string;
  joinedAt: string;
  leftAt: string | null;
  joinedLate: boolean;
  participationNote: string | null;
  addedManually: boolean;
  addedByFamilyMemberId: string | null;
  rewardPercent: number | null;
  rewardAmount: number;
  bonusAmount: number;
  bonusPercent: number;
  isBestParticipant: boolean;
  bestParticipantReason: string | null;
  payoutStatus: string;
  paidAt: string | null;
  paidByFamilyMemberId: string | null;
};

export type FamilyQuestRewardDto = {
  id: string;
  questPersonId: string | null;
  rewardType: string;
  title: string;
  amount: number | null;
  currency: string | null;
  quantity: number | null;
  status: string;
  issuedAt: string | null;
  issuedByFamilyMemberId: string | null;
};

export type FamilyQuestReportDto = {
  id: string;
  title: string;
  comment: string | null;
  confirmedByFamilyMemberId: string | null;
  totalReward: number;
  memberRewardPool: number;
  familyReward: number;
  transferredToAccountingAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FamilyQuestPayoutDto = {
  id: string;
  reportId: string | null;
  questPersonId: string | null;
  familyMemberId: string | null;
  displayName: string;
  amount: number;
  rewardPercent: number | null;
  rewardItems: Array<Record<string, unknown>>;
  bonusAmount: number;
  bonusPercent: number;
  status: string;
  paidAt: string | null;
  paidByFamilyMemberId: string | null;
  idempotencyKey: string | null;
  accrualId: string | null;
  accountingTransactionId: string | null;
  issuedAt: string | null;
  issuedByFamilyMemberId: string | null;
  payoutEventKey: string | null;
};

export type FamilyQuestAuditDto = {
  id: string;
  actorFamilyMemberId: string | null;
  action: string;
  comment: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  relatedFamilyMemberId: string | null;
  createdAt: string;
};

export class FamilyQuestService {
  constructor(
    private readonly repository: FamilyQuestRepository,
    private readonly memberRepository: FamilyMemberRepository | null = null,
  ) {}

  async listTemplates(auth: FamilyAuthContext): Promise<{ items: FamilyQuestTemplateDto[] }> {
    this.assertCanRead(auth);
    return { items: (await this.repository.listTemplates()).map(toTemplateDto) };
  }

  async createTemplate(input: FamilyQuestTemplateWriteInput, auth: FamilyAuthContext, now = new Date()): Promise<FamilyQuestTemplateDto> {
    this.assertCanManage(auth);
    const normalized = normalizeTemplateInput(input);
    return toTemplateDto(await this.repository.createTemplate(normalized, auth.familyMemberId, now.toISOString()));
  }

  async updateTemplate(id: string, input: Partial<FamilyQuestTemplateWriteInput>, auth: FamilyAuthContext, now = new Date()): Promise<FamilyQuestTemplateDto> {
    this.assertCanManage(auth);
    if (!input.expectedVersion) throw new FamilyQuestError('VALIDATION_ERROR', 'expectedVersion is required.', 400);
    const current = (await this.repository.listTemplates()).find((template) => template.id === id);
    if (!current) throw new FamilyQuestError('QUEST_NOT_FOUND', 'Quest template not found', 404);
    if (current.version !== input.expectedVersion) throw new FamilyQuestError('QUEST_VERSION_CONFLICT', 'Quest template was already changed.', 409);
    const normalized = normalizeTemplateInput(input, true);
    const updated = await this.repository.updateTemplate(id, normalized, auth.familyMemberId, now.toISOString());
    if (!updated) throw new FamilyQuestError('QUEST_VERSION_CONFLICT', 'Quest template was already changed.', 409);
    return toTemplateDto(updated);
  }

  async listQuests(query: FamilyQuestListQuery, auth: FamilyAuthContext): Promise<{ items: FamilyQuestDto[] }> {
    this.assertCanRead(auth);
    return { items: (await this.repository.listQuests(query)).map(toQuestDto) };
  }

  async getQuest(id: string, auth: FamilyAuthContext): Promise<FamilyQuestDto> {
    this.assertCanRead(auth);
    const quest = await this.repository.findQuestById(id);
    if (!quest) throw new FamilyQuestError('QUEST_NOT_FOUND', 'Quest not found', 404);
    return toQuestDto(quest);
  }

  async createQuest(input: FamilyQuestWriteInput, auth: FamilyAuthContext, now = new Date()): Promise<FamilyQuestDto> {
    this.assertCanManage(auth);
    await this.assertMemberExists(auth.familyMemberId);
    const normalized = normalizeQuestInput(input);
    return toQuestDto(await this.repository.createQuest(normalized, auth.familyMemberId, now.toISOString()));
  }

  async updateQuest(id: string, input: Partial<FamilyQuestWriteInput>, auth: FamilyAuthContext, now = new Date()): Promise<FamilyQuestDto> {
    this.assertCanManage(auth);
    const current = await this.requireQuest(id);
    if (!input.expectedVersion) throw new FamilyQuestError('VALIDATION_ERROR', 'expectedVersion is required.', 400);
    if (current.version !== input.expectedVersion) throw new FamilyQuestError('QUEST_VERSION_CONFLICT', 'Quest was already changed.', 409);
    if (['sent_to_accounting', 'paid'].includes(current.status)) {
      throw new FamilyQuestError('QUEST_INVALID_TRANSITION', 'Quest cannot be edited after accounting handoff.', 409, { status: current.status });
    }
    const normalized = normalizeQuestInput(input, true);
    const updated = await this.repository.updateQuest(id, normalized, auth.familyMemberId, now.toISOString());
    if (!updated) throw new FamilyQuestError('QUEST_VERSION_CONFLICT', 'Quest was already changed.', 409);
    return toQuestDto(updated);
  }

  async joinQuest(
    id: string,
    input: { role: 'participant' | 'helper'; note?: string | null; metadata?: Record<string, unknown> },
    auth: FamilyAuthContext,
    now = new Date(),
  ): Promise<FamilyQuestPersonDto> {
    this.assertCanRead(auth);
    const quest = await this.requireQuest(id);
    this.assertQuestOpenForParticipation(quest);
    await this.assertMemberExists(auth.familyMemberId);
    const member = this.memberRepository ? await this.memberRepository.findById(auth.familyMemberId) : null;
    const person = await this.repository.upsertQuestPerson({
      questId: id,
      familyMemberId: auth.familyMemberId,
      displayName: member?.nickname ?? auth.familyMemberId,
      role: input.role,
      joinedAt: now.toISOString(),
      addedByFamilyMemberId: auth.familyMemberId,
      metadata: {
        ...(input.metadata ?? {}),
        source: input.metadata?.source ?? 'api',
        note: input.note ?? undefined,
      },
    });
    return toPersonDto(person);
  }

  async withdrawQuest(id: string, auth: FamilyAuthContext, now = new Date()): Promise<FamilyQuestPersonDto> {
    this.assertCanRead(auth);
    const quest = await this.requireQuest(id);
    this.assertQuestOpenForParticipation(quest);
    const currentPerson = quest.people.find((person) => person.familyMemberId === auth.familyMemberId);
    if (!currentPerson) {
      throw new FamilyQuestError('QUEST_MEMBER_NOT_FOUND', 'Quest participant not found.', 404, { questId: id, familyMemberId: auth.familyMemberId });
    }
    if (currentPerson.leftAt) return toPersonDto(currentPerson);
    const person = await this.repository.removeQuestPerson(id, auth.familyMemberId, now.toISOString());
    return toPersonDto(person);
  }

  async completeQuest(id: string, input: { comment?: string | null }, auth: FamilyAuthContext, now = new Date()): Promise<FamilyQuestDto> {
    this.assertCanManage(auth);
    const quest = await this.requireQuest(id);
    if (['completed', 'reported', 'sent_to_accounting', 'paid', 'cooldown', 'stopped'].includes(quest.status)) {
      throw new FamilyQuestError('QUEST_INVALID_TRANSITION', 'Quest is already closed.', 409, { status: quest.status });
    }
    const updated = await this.repository.updateQuestStatus(id, {
      status: 'completed',
      actorFamilyMemberId: auth.familyMemberId,
      now: now.toISOString(),
      comment: input.comment ?? null,
    });
    if (!updated) throw new FamilyQuestError('QUEST_NOT_FOUND', 'Quest not found', 404);
    return toQuestDto(updated);
  }

  async createQuestReport(id: string, input: { comment?: string | null }, auth: FamilyAuthContext, now = new Date()): Promise<FamilyQuestDto> {
    this.assertCanManage(auth);
    const quest = await this.requireQuest(id);
    if (!['completed', 'reported'].includes(quest.status)) {
      throw new FamilyQuestError('QUEST_INVALID_TRANSITION', 'Quest must be completed before reporting.', 409, { status: quest.status });
    }
    if (quest.status === 'reported' && quest.report) return toQuestDto(quest);
    const updated = await this.repository.createQuestReport(id, {
      actorFamilyMemberId: auth.familyMemberId,
      title: `${quest.title}: звіт`,
      comment: cleanNullable(input.comment) ?? null,
      now: now.toISOString(),
    });
    if (!updated) throw new FamilyQuestError('QUEST_NOT_FOUND', 'Quest not found', 404);
    return toQuestDto(updated);
  }

  async transferQuestReportToAccounting(id: string, auth: FamilyAuthContext, now = new Date()): Promise<FamilyQuestDto> {
    this.assertCanManage(auth);
    const quest = await this.requireQuest(id);
    if (!quest.report && quest.status !== 'reported') {
      throw new FamilyQuestError('QUEST_INVALID_TRANSITION', 'Quest report is required before accounting handoff.', 409, { status: quest.status });
    }
    if (quest.status === 'paid') {
      throw new FamilyQuestError('QUEST_INVALID_TRANSITION', 'Paid quest cannot be transferred again.', 409, { status: quest.status });
    }
    if (quest.status === 'sent_to_accounting' || quest.reportSentToAccountingAt) return toQuestDto(quest);
    const updated = await this.repository.transferQuestReportToAccounting(id, {
      actorFamilyMemberId: auth.familyMemberId,
      now: now.toISOString(),
    });
    if (!updated) throw new FamilyQuestError('QUEST_NOT_FOUND', 'Quest not found', 404);
    return toQuestDto(updated);
  }

  private async requireQuest(id: string): Promise<FamilyQuestRecord> {
    const quest = await this.repository.findQuestById(id);
    if (!quest) throw new FamilyQuestError('QUEST_NOT_FOUND', 'Quest not found', 404);
    return quest;
  }

  private assertQuestOpenForParticipation(quest: FamilyQuestRecord): void {
    if (['completed', 'reported', 'sent_to_accounting', 'paid', 'cooldown', 'stopped'].includes(quest.status)) {
      throw new FamilyQuestError('QUEST_INVALID_TRANSITION', 'Cannot change participation for a closed quest.', 409, { status: quest.status });
    }
  }

  private async assertMemberExists(id: string): Promise<void> {
    if (!(await this.repository.familyMemberExists(id))) {
      throw new FamilyQuestError('QUEST_MEMBER_NOT_FOUND', 'Family member not found.', 404, { familyMemberId: id });
    }
  }

  private assertCanRead(auth: FamilyAuthContext): void {
    if (auth.status !== 'active') {
      throw new FamilyQuestError('QUEST_PERMISSION_DENIED', 'Inactive members cannot view quests', 403);
    }
  }

  private assertCanManage(auth: FamilyAuthContext): void {
    if (auth.role === 'owner' || auth.rank >= 8 || auth.permissions.includes('manage_family_quests')) return;
    throw new FamilyQuestError('QUEST_PERMISSION_DENIED', 'Permission denied.', 403);
  }
}

const REWARD_MODES = new Set<FamilyQuestRewardMode>(['equal', 'percentage', 'fixed', 'mixed', 'manual']);
const QUEST_STATUSES = new Set<FamilyQuestStatus>(['recruiting', 'scheduled', 'active', 'paused', 'stopped', 'completed', 'reported', 'sent_to_accounting', 'paid', 'cooldown']);

function normalizeTemplateInput<T extends Partial<FamilyQuestTemplateWriteInput>>(input: T, partial = false): T {
  const title = input.title?.trim();
  const category = input.category?.trim();
  if (!partial || input.title !== undefined) assertText(title, 'title');
  if (!partial || input.category !== undefined) assertText(category, 'category');
  const totalReward = positiveMoney(input.totalReward, 'totalReward', partial);
  const memberRewardPool = positiveMoney(input.memberRewardPool, 'memberRewardPool', partial);
  const familyReward = positiveMoney(input.familyReward, 'familyReward', partial);
  if (totalReward !== undefined && memberRewardPool !== undefined && familyReward !== undefined && memberRewardPool + familyReward > totalReward) {
    throw new FamilyQuestError('VALIDATION_ERROR', 'Quest reward split exceeds total reward.', 400);
  }
  if (input.rewardMode !== undefined && !REWARD_MODES.has(input.rewardMode)) throw new FamilyQuestError('VALIDATION_ERROR', 'Invalid reward mode.', 400);
  if (input.recommendedTeamSize !== undefined && (!Number.isInteger(input.recommendedTeamSize) || input.recommendedTeamSize < 1)) {
    throw new FamilyQuestError('VALIDATION_ERROR', 'Team size must be positive.', 400);
  }
  if (input.cooldownHours !== undefined && (!Number.isInteger(input.cooldownHours) || input.cooldownHours < 1)) {
    throw new FamilyQuestError('VALIDATION_ERROR', 'Cooldown must be positive.', 400);
  }
  return {
    ...input,
    title,
    category,
    description: cleanNullable(input.description),
    steps: input.steps?.map((step) => step.trim()).filter(Boolean),
    requiredItems: cleanNullable(input.requiredItems),
    imageAssetId: cleanNullable(input.imageAssetId),
    totalReward,
    memberRewardPool,
    familyReward,
  };
}

function normalizeQuestInput<T extends Partial<FamilyQuestWriteInput>>(input: T, partial = false): T {
  const title = input.title?.trim();
  const category = input.category?.trim();
  if (!partial || input.title !== undefined) assertText(title, 'title');
  if (!partial || input.category !== undefined) assertText(category, 'category');
  if (input.status !== undefined && !QUEST_STATUSES.has(input.status)) throw new FamilyQuestError('VALIDATION_ERROR', 'Invalid quest status.', 400);
  if (input.rewardMode !== undefined && !REWARD_MODES.has(input.rewardMode)) throw new FamilyQuestError('VALIDATION_ERROR', 'Invalid reward mode.', 400);
  const totalReward = positiveMoney(input.totalReward, 'totalReward', partial);
  const memberRewardPool = positiveMoney(input.memberRewardPool, 'memberRewardPool', partial);
  const familyReward = positiveMoney(input.familyReward, 'familyReward', partial);
  if (totalReward !== undefined && memberRewardPool !== undefined && familyReward !== undefined && memberRewardPool + familyReward > totalReward) {
    throw new FamilyQuestError('VALIDATION_ERROR', 'Quest reward split exceeds total reward.', 400);
  }
  return {
    ...input,
    title,
    category,
    description: cleanNullable(input.description),
    requiredItems: cleanNullable(input.requiredItems),
    totalReward,
    memberRewardPool,
    familyReward,
  };
}

function assertText(value: string | undefined, field: string): void {
  if (!value) throw new FamilyQuestError('VALIDATION_ERROR', `${field} is required.`, 400);
}

function cleanNullable(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const next = value?.trim();
  return next || null;
}

function positiveMoney(value: number | undefined, field: string, _partial: boolean): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value < 0) throw new FamilyQuestError('VALIDATION_ERROR', `${field} must be zero or positive.`, 400);
  return Math.round(value * 100) / 100;
}

function toTemplateDto(template: FamilyQuestTemplateRecord): FamilyQuestTemplateDto {
  return {
    id: template.id,
    templateKey: template.templateKey,
    title: template.title,
    category: template.category,
    description: template.description,
    steps: template.steps,
    recommendedTeamSize: template.recommendedTeamSize,
    totalReward: template.totalReward,
    memberRewardPool: template.memberRewardPool,
    familyReward: template.familyReward,
    rewardMode: template.rewardMode,
    requiredItems: template.requiredItems,
    imageAssetId: template.imageAssetId,
    isActive: template.isActive,
    cooldownHours: template.cooldownHours,
    cooldownUntil: template.cooldownUntil,
    version: template.version,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

function toQuestDto(quest: FamilyQuestRecord): FamilyQuestDto {
  return {
    id: quest.id,
    templateId: quest.templateId,
    title: quest.title,
    description: quest.description,
    category: quest.category,
    status: quest.status,
    startsAt: quest.startsAt,
    endsAt: quest.endsAt,
    scheduledAt: quest.scheduledAt,
    organizerFamilyMemberId: quest.organizerFamilyMemberId,
    totalReward: quest.totalReward,
    memberRewardPool: quest.memberRewardPool,
    familyReward: quest.familyReward,
    rewardMode: quest.rewardMode,
    requiredItems: quest.requiredItems,
    bestParticipantFamilyMemberId: quest.bestParticipantFamilyMemberId,
    bestParticipantReason: quest.bestParticipantReason,
    reportId: quest.reportId,
    reportSentToAccountingAt: quest.reportSentToAccountingAt,
    paidAt: quest.paidAt,
    paidByFamilyMemberId: quest.paidByFamilyMemberId,
    version: quest.version,
    participants: quest.people.filter((person) => person.role === 'participant').map(toPersonDto),
    helpers: quest.people.filter((person) => person.role === 'helper').map(toPersonDto),
    rewards: quest.rewards.map(toRewardDto),
    report: quest.report ? toReportDto(quest.report) : null,
    payouts: quest.payouts.map(toPayoutDto),
    auditTrail: quest.auditTrail.map(toAuditDto),
    createdAt: quest.createdAt,
    updatedAt: quest.updatedAt,
  };
}

function toPersonDto(person: FamilyQuestRecord['people'][number]): FamilyQuestPersonDto {
  return {
    id: person.id,
    familyMemberId: person.familyMemberId,
    displayName: person.displayName,
    role: person.role,
    joinedAt: person.joinedAt,
    leftAt: person.leftAt,
    joinedLate: person.joinedLate,
    participationNote: person.participationNote,
    addedManually: person.addedManually,
    addedByFamilyMemberId: person.addedByFamilyMemberId,
    rewardPercent: person.rewardPercent,
    rewardAmount: person.rewardAmount,
    bonusAmount: person.bonusAmount,
    bonusPercent: person.bonusPercent,
    isBestParticipant: person.isBestParticipant,
    bestParticipantReason: person.bestParticipantReason,
    payoutStatus: person.payoutStatus,
    paidAt: person.paidAt,
    paidByFamilyMemberId: person.paidByFamilyMemberId,
  };
}

function toRewardDto(reward: FamilyQuestRecord['rewards'][number]): FamilyQuestRewardDto {
  return {
    id: reward.id,
    questPersonId: reward.questPersonId,
    rewardType: reward.rewardType,
    title: reward.title,
    amount: reward.amount,
    currency: reward.currency,
    quantity: reward.quantity,
    status: reward.status,
    issuedAt: reward.issuedAt,
    issuedByFamilyMemberId: reward.issuedByFamilyMemberId,
  };
}

function toReportDto(report: NonNullable<FamilyQuestRecord['report']>): FamilyQuestReportDto {
  return {
    id: report.id,
    title: report.title,
    comment: report.comment,
    confirmedByFamilyMemberId: report.confirmedByFamilyMemberId,
    totalReward: report.totalReward,
    memberRewardPool: report.memberRewardPool,
    familyReward: report.familyReward,
    transferredToAccountingAt: report.transferredToAccountingAt,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
  };
}

function toPayoutDto(payout: FamilyQuestRecord['payouts'][number]): FamilyQuestPayoutDto {
  return {
    id: payout.id,
    reportId: payout.reportId,
    questPersonId: payout.questPersonId,
    familyMemberId: payout.familyMemberId,
    displayName: payout.displayName,
    amount: payout.amount,
    rewardPercent: payout.rewardPercent,
    rewardItems: payout.rewardItems,
    bonusAmount: payout.bonusAmount,
    bonusPercent: payout.bonusPercent,
    status: payout.status,
    paidAt: payout.paidAt,
    paidByFamilyMemberId: payout.paidByFamilyMemberId,
    idempotencyKey: payout.idempotencyKey,
    accrualId: payout.accrualId,
    accountingTransactionId: payout.accountingTransactionId,
    issuedAt: payout.issuedAt,
    issuedByFamilyMemberId: payout.issuedByFamilyMemberId,
    payoutEventKey: payout.payoutEventKey,
  };
}

function toAuditDto(audit: FamilyQuestRecord['auditTrail'][number]): FamilyQuestAuditDto {
  return {
    id: audit.id,
    actorFamilyMemberId: audit.actorFamilyMemberId,
    action: audit.action,
    comment: audit.comment,
    previousStatus: audit.previousStatus,
    newStatus: audit.newStatus,
    relatedFamilyMemberId: audit.relatedFamilyMemberId,
    createdAt: audit.createdAt,
  };
}
