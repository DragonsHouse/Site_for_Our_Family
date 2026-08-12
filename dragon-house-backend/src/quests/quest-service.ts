import type { FamilyAuthContext } from '../types.js';
import { FamilyQuestError } from './quest-errors.js';
import type {
  FamilyQuestListQuery,
  FamilyQuestRecord,
  FamilyQuestTemplateRecord,
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
  constructor(private readonly repository: FamilyQuestRepository) {}

  async listTemplates(auth: FamilyAuthContext): Promise<{ items: FamilyQuestTemplateDto[] }> {
    this.assertCanRead(auth);
    return { items: (await this.repository.listTemplates()).map(toTemplateDto) };
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

  private assertCanRead(auth: FamilyAuthContext): void {
    if (auth.status !== 'active') {
      throw new FamilyQuestError('QUEST_PERMISSION_DENIED', 'Inactive members cannot view quests', 403);
    }
  }
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
