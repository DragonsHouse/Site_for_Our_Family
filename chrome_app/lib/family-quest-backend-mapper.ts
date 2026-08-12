import type {
  BackendFamilyQuestDto,
  BackendFamilyQuestPersonDto,
  BackendFamilyQuestPayoutDto,
  BackendFamilyQuestRewardDto,
  BackendFamilyQuestTemplateDto
} from './family-quest-backend-response.ts';
import type {
  FamilyQuest,
  FamilyQuestAuditEntry,
  FamilyQuestCategory,
  FamilyQuestParticipant,
  FamilyQuestPayout,
  FamilyQuestPayoutStatus,
  FamilyQuestReport,
  FamilyQuestRewardItem,
  FamilyQuestRewardMode,
  FamilyQuestStatus,
  FamilyQuestTemplate
} from './family-types.ts';

const FRONTEND_CATEGORIES: FamilyQuestCategory[] = ['Громадський', 'Бізнес', 'Бойовий'];
const FRONTEND_STATUSES: FamilyQuestStatus[] = [
  'draft',
  'recruiting',
  'scheduled',
  'active',
  'paused',
  'stopped',
  'completed',
  'reported',
  'sent_to_accounting',
  'paid',
  'cooldown',
  'closed',
  'in_progress',
  'submitted',
  'approved',
  'rejected'
];
const FRONTEND_REWARD_MODES: FamilyQuestRewardMode[] = ['equal', 'percentage', 'fixed', 'mixed', 'manual'];
const FRONTEND_PAYOUT_STATUSES: FamilyQuestPayoutStatus[] = ['pending', 'paid', 'unpaid'];

export function mapBackendQuestTemplate(template: BackendFamilyQuestTemplateDto): FamilyQuestTemplate {
  const category = mapCategory(template.category);
  return {
    id: template.id,
    source: 'backend',
    backendTemplateId: template.id,
    backendQuestId: null,
    backendCategory: template.category,
    title: template.title,
    category,
    recommendedTeamSize: Math.max(1, template.recommendedTeamSize),
    rewardAmount: template.memberRewardPool,
    totalReward: template.totalReward,
    memberRewardPool: template.memberRewardPool,
    familyBankShare: template.familyReward,
    familyReward: template.familyReward,
    splitMode: mapRewardMode(template.rewardMode),
    rewardMode: mapRewardMode(template.rewardMode),
    cooldownUntil: template.cooldownUntil,
    cooldownHours: template.cooldownHours,
    rewardLabel: `${template.memberRewardPool.toLocaleString('uk-UA')} $ для людей`,
    steps: template.steps,
    hint: template.description,
    route: null,
    items: template.requiredItems,
    requiredItems: template.requiredItems,
    imageUrl: '',
    imageAsset: template.imageAssetId ?? '',
    imageSlot: null,
    isActive: template.isActive,
    createdBy: 'backend',
    updatedAt: template.updatedAt,
  };
}

export function mapBackendQuest(quest: BackendFamilyQuestDto): FamilyQuest {
  const participants = uniquePeople(quest.participants.map((person) => mapBackendPerson(person, 'participant', quest.rewards)));
  const participantIds = new Set(participants.map((person) => person.userId));
  const helpers = uniquePeople(quest.helpers.map((person) => mapBackendPerson(person, 'helper', quest.rewards)).filter((person) => !participantIds.has(person.userId)));
  return {
    id: quest.id,
    source: 'backend',
    backendQuestId: quest.id,
    backendTemplateId: quest.templateId,
    backendCategory: quest.category,
    templateId: quest.templateId ?? quest.id,
    title: quest.title,
    description: quest.description,
    category: mapCategory(quest.category),
    scheduledAt: quest.scheduledAt ?? quest.startsAt ?? quest.createdAt,
    recommendedTeamSize: Math.max(1, participants.length + helpers.length || 1),
    maxTeamSize: Math.max(1, participants.length + helpers.length || 1),
    rewardAmount: quest.memberRewardPool,
    totalReward: quest.totalReward,
    memberRewardPool: quest.memberRewardPool,
    familyBankShare: quest.familyReward,
    familyReward: quest.familyReward,
    splitMode: mapRewardMode(quest.rewardMode),
    rewardMode: mapRewardMode(quest.rewardMode),
    rewardLabel: `${quest.memberRewardPool.toLocaleString('uk-UA')} $ для людей`,
    steps: quest.description ? [quest.description] : [],
    hint: quest.description || null,
    route: quest.startsAt,
    items: quest.requiredItems,
    requiredItems: quest.requiredItems,
    imageUrl: '',
    organizer: quest.organizerFamilyMemberId ?? 'backend',
    participants,
    helpers,
    totalAmount: quest.memberRewardPool,
    payouts: quest.payouts.map(mapBackendPayout),
    status: mapQuestStatus(quest.status),
    approvedBy: quest.report?.confirmedByFamilyMemberId ?? null,
    reportId: quest.reportId,
    reportSentToAccountingAt: quest.reportSentToAccountingAt ?? quest.report?.transferredToAccountingAt ?? null,
    paidAt: quest.paidAt,
    paidBy: quest.paidByFamilyMemberId,
    cooldownUntil: null,
    cooldownHours: 24,
    auditTrail: quest.auditTrail.map(mapBackendAudit),
    createdAt: quest.createdAt,
    updatedAt: quest.updatedAt,
    bestParticipantFamilyMemberId: quest.bestParticipantFamilyMemberId,
    bestParticipantReason: quest.bestParticipantReason,
    syncSource: 'family_hub',
    syncStatus: 'synced',
  };
}

export function mapBackendQuestReport(quest: FamilyQuest): FamilyQuestReport | null {
  if (!quest.reportId) return null;
  return {
    id: quest.reportId,
    questId: quest.id,
    templateId: quest.templateId,
    title: quest.title,
    participants: quest.participants.map((person) => person.userId),
    helpers: (quest.helpers ?? []).map((person) => person.userId),
    participation: [...quest.participants, ...(quest.helpers ?? [])],
    totalAmount: quest.memberRewardPool,
    totalReward: quest.totalReward,
    memberRewardPool: quest.memberRewardPool,
    familyBankShare: quest.familyReward ?? quest.familyBankShare,
    familyReward: quest.familyReward ?? quest.familyBankShare,
    splitMode: quest.rewardMode ?? quest.splitMode,
    rewardMode: quest.rewardMode ?? quest.splitMode,
    payouts: quest.payouts,
    confirmedBy: quest.approvedBy ?? 'backend',
    comment: null,
    transferredToAccountingAt: quest.reportSentToAccountingAt ?? null,
    createdAt: quest.createdAt,
    updatedAt: quest.updatedAt,
    syncSource: 'family_hub',
    syncStatus: 'synced',
  };
}

export function includeBackendQuestViewTemplates(templates: FamilyQuestTemplate[], quests: FamilyQuest[]) {
  const byId = new Set(templates.map((template) => template.id));
  const derived = quests
    .filter((quest) => quest.templateId && !byId.has(quest.templateId))
    .map<FamilyQuestTemplate>((quest) => ({
      id: quest.templateId ?? quest.id,
      source: 'backend',
      backendTemplateId: quest.backendTemplateId ?? null,
      backendQuestId: quest.id,
      backendCategory: quest.backendCategory ?? null,
      title: quest.title,
      category: quest.category,
      recommendedTeamSize: quest.recommendedTeamSize,
      rewardAmount: quest.memberRewardPool,
      totalReward: quest.totalReward,
      memberRewardPool: quest.memberRewardPool,
      familyBankShare: quest.familyReward ?? quest.familyBankShare,
      familyReward: quest.familyReward ?? quest.familyBankShare,
      splitMode: quest.rewardMode ?? quest.splitMode,
      rewardMode: quest.rewardMode ?? quest.splitMode,
      cooldownUntil: null,
      cooldownHours: quest.cooldownHours ?? 24,
      rewardLabel: quest.rewardLabel,
      steps: quest.steps,
      hint: quest.hint,
      route: quest.route,
      items: quest.items,
      requiredItems: quest.requiredItems,
      imageUrl: quest.imageUrl,
      imageAsset: '',
      imageSlot: null,
      isActive: true,
      createdBy: quest.organizer,
      updatedAt: quest.updatedAt,
    }));
  return [...templates, ...derived];
}

function mapBackendPerson(person: BackendFamilyQuestPersonDto, type: 'participant' | 'helper', rewards: BackendFamilyQuestRewardDto[]): FamilyQuestParticipant {
  return {
    userId: person.familyMemberId ?? person.displayName,
    backendQuestPersonId: person.id,
    backendFamilyMemberId: person.familyMemberId,
    nickname: person.displayName,
    type,
    joinedAt: person.joinedAt,
    leftAt: person.leftAt,
    joinedLate: person.joinedLate,
    participationNote: person.participationNote,
    addedManually: person.addedManually,
    addedBy: person.addedByFamilyMemberId,
    rewardPercent: person.rewardPercent,
    rewardAmount: person.rewardAmount,
    rewardItems: rewards.filter((reward) => reward.questPersonId === person.id && reward.rewardType !== 'money').map(mapBackendRewardItem),
    bonusAmount: person.bonusAmount,
    bonusPercent: person.bonusPercent,
    isBestParticipant: person.isBestParticipant,
    bestParticipantReason: person.bestParticipantReason,
    payoutStatus: mapPayoutStatus(person.payoutStatus),
    paidAt: person.paidAt,
    paidBy: person.paidByFamilyMemberId,
    paidByFamilyMemberId: person.paidByFamilyMemberId,
  };
}

function mapBackendRewardItem(reward: BackendFamilyQuestRewardDto): FamilyQuestRewardItem {
  return {
    id: reward.id,
    backendRewardId: reward.id,
    backendQuestPersonId: reward.questPersonId,
    title: reward.title,
    quantity: Math.max(1, reward.quantity ?? 1),
    status: reward.status === 'issued' ? 'issued' : 'prepared',
    issuedAt: reward.issuedAt,
    issuedBy: reward.issuedByFamilyMemberId,
    issuedByFamilyMemberId: reward.issuedByFamilyMemberId,
    rewardType: reward.rewardType === 'custom' ? 'custom' : 'item',
    amount: reward.amount,
    currency: reward.currency,
  };
}

function mapBackendPayout(payout: BackendFamilyQuestPayoutDto): FamilyQuestPayout {
  return {
    userId: payout.familyMemberId ?? payout.questPersonId ?? payout.displayName,
    amount: payout.amount,
    finalAmount: payout.amount,
    source: 'backend',
    backendPayoutId: payout.id,
    backendQuestPersonId: payout.questPersonId,
    backendFamilyMemberId: payout.familyMemberId,
    status: mapPayoutStatus(payout.status),
    paidBy: payout.paidByFamilyMemberId,
    paidAt: payout.paidAt,
    paidByFamilyMemberId: payout.paidByFamilyMemberId,
    issuedAt: payout.issuedAt,
    rewardPercent: payout.rewardPercent,
    rewardItems: payout.rewardItems.map(mapRawRewardItem),
    bonusAmount: payout.bonusAmount,
    bonusPercent: payout.bonusPercent,
    payoutEventKey: payout.payoutEventKey ?? undefined,
    idempotencyKey: payout.idempotencyKey,
    accrualId: payout.accrualId,
    accountingTransactionId: payout.accountingTransactionId,
  };
}

function mapRawRewardItem(value: Record<string, unknown>, index: number): FamilyQuestRewardItem {
  return {
    id: typeof value.id === 'string' ? value.id : `backend-payout-item-${index}`,
    title: typeof value.title === 'string' ? value.title : 'Backend reward item',
    quantity: typeof value.quantity === 'number' ? Math.max(1, value.quantity) : 1,
    status: value.status === 'issued' ? 'issued' : 'prepared',
    issuedAt: typeof value.issuedAt === 'string' ? value.issuedAt : null,
    issuedBy: typeof value.issuedBy === 'string' ? value.issuedBy : null,
  };
}

function mapBackendAudit(audit: { id: string; action: string; actorFamilyMemberId: string | null; comment: string | null; previousStatus: string | null; newStatus: string | null; relatedFamilyMemberId: string | null; createdAt: string }): FamilyQuestAuditEntry {
  return {
    id: audit.id,
    action: audit.action as FamilyQuestAuditEntry['action'],
    actor: audit.actorFamilyMemberId ?? 'backend',
    timestamp: audit.createdAt,
    comment: audit.comment,
    previousState: audit.previousStatus ? mapQuestStatus(audit.previousStatus) : null,
    newState: audit.newStatus ? mapQuestStatus(audit.newStatus) : null,
    relatedUserId: audit.relatedFamilyMemberId,
  };
}

function uniquePeople(people: FamilyQuestParticipant[]) {
  const seen = new Set<string>();
  const result: FamilyQuestParticipant[] = [];
  for (const person of people) {
    if (seen.has(person.userId)) continue;
    seen.add(person.userId);
    result.push(person);
  }
  return result;
}

function mapCategory(category: string): FamilyQuestCategory {
  return FRONTEND_CATEGORIES.includes(category as FamilyQuestCategory) ? (category as FamilyQuestCategory) : 'Громадський';
}

function mapRewardMode(mode: string): FamilyQuestRewardMode {
  return FRONTEND_REWARD_MODES.includes(mode as FamilyQuestRewardMode) ? (mode as FamilyQuestRewardMode) : 'manual';
}

function mapQuestStatus(status: string): FamilyQuestStatus {
  return FRONTEND_STATUSES.includes(status as FamilyQuestStatus) ? (status as FamilyQuestStatus) : 'draft';
}

function mapPayoutStatus(status: string): FamilyQuestPayoutStatus {
  return FRONTEND_PAYOUT_STATUSES.includes(status as FamilyQuestPayoutStatus) ? (status as FamilyQuestPayoutStatus) : 'pending';
}
