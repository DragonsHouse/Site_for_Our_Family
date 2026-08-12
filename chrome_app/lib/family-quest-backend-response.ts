import { FamilyQuestPayoutApiError } from './family-quest-payout-response.ts';

export type BackendFamilyQuestTemplateDto = {
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

export type BackendFamilyQuestPersonDto = {
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

export type BackendFamilyQuestRewardDto = {
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

export type BackendFamilyQuestReportDto = {
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

export type BackendFamilyQuestPayoutDto = {
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

export type BackendFamilyQuestAuditDto = {
  id: string;
  actorFamilyMemberId: string | null;
  action: string;
  comment: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  relatedFamilyMemberId: string | null;
  createdAt: string;
};

export type BackendFamilyQuestDto = {
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
  participants: BackendFamilyQuestPersonDto[];
  helpers: BackendFamilyQuestPersonDto[];
  rewards: BackendFamilyQuestRewardDto[];
  report: BackendFamilyQuestReportDto | null;
  payouts: BackendFamilyQuestPayoutDto[];
  auditTrail: BackendFamilyQuestAuditDto[];
  createdAt: string;
  updatedAt: string;
};

export async function parseBackendQuestTemplateListResponse(response: Response): Promise<{ items: BackendFamilyQuestTemplateDto[] }> {
  const body = await parseBackendJson(response);
  if (!isRecord(body) || !Array.isArray(body.items)) throw malformed();
  return { items: body.items.map(assertTemplate) };
}

export async function parseBackendQuestListResponse(response: Response): Promise<{ items: BackendFamilyQuestDto[] }> {
  const body = await parseBackendJson(response);
  if (!isRecord(body) || !Array.isArray(body.items)) throw malformed();
  return { items: body.items.map(assertQuest) };
}

export async function parseBackendQuestDetailResponse(response: Response): Promise<BackendFamilyQuestDto> {
  return assertQuest(await parseBackendJson(response));
}

async function parseBackendJson(response: Response): Promise<unknown> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const record = isRecord(body) ? body : {};
    throw new FamilyQuestPayoutApiError('UNKNOWN_ERROR', typeof record.message === 'string' ? record.message : `Quest backend request failed: ${response.status}`, response.status, isRecord(record.details) ? record.details : {});
  }
  return body;
}

function assertTemplate(value: unknown): BackendFamilyQuestTemplateDto {
  if (!isRecord(value)) throw malformed();
  return {
    id: stringField(value, 'id'),
    templateKey: stringField(value, 'templateKey'),
    title: stringField(value, 'title'),
    category: stringField(value, 'category'),
    description: nullableStringField(value, 'description'),
    steps: stringArrayField(value, 'steps'),
    recommendedTeamSize: numberField(value, 'recommendedTeamSize'),
    totalReward: numberField(value, 'totalReward'),
    memberRewardPool: numberField(value, 'memberRewardPool'),
    familyReward: numberField(value, 'familyReward'),
    rewardMode: stringField(value, 'rewardMode'),
    requiredItems: nullableStringField(value, 'requiredItems'),
    imageAssetId: nullableStringField(value, 'imageAssetId'),
    isActive: booleanField(value, 'isActive'),
    cooldownHours: numberField(value, 'cooldownHours'),
    cooldownUntil: nullableStringField(value, 'cooldownUntil'),
    createdAt: stringField(value, 'createdAt'),
    updatedAt: stringField(value, 'updatedAt'),
  };
}

function assertQuest(value: unknown): BackendFamilyQuestDto {
  if (!isRecord(value)) throw malformed();
  return {
    id: stringField(value, 'id'),
    templateId: nullableStringField(value, 'templateId'),
    title: stringField(value, 'title'),
    description: stringField(value, 'description'),
    category: stringField(value, 'category'),
    status: stringField(value, 'status'),
    startsAt: nullableStringField(value, 'startsAt'),
    endsAt: nullableStringField(value, 'endsAt'),
    scheduledAt: nullableStringField(value, 'scheduledAt'),
    organizerFamilyMemberId: nullableStringField(value, 'organizerFamilyMemberId'),
    totalReward: numberField(value, 'totalReward'),
    memberRewardPool: numberField(value, 'memberRewardPool'),
    familyReward: numberField(value, 'familyReward'),
    rewardMode: stringField(value, 'rewardMode'),
    requiredItems: nullableStringField(value, 'requiredItems'),
    bestParticipantFamilyMemberId: nullableStringField(value, 'bestParticipantFamilyMemberId'),
    bestParticipantReason: nullableStringField(value, 'bestParticipantReason'),
    reportId: nullableStringField(value, 'reportId'),
    reportSentToAccountingAt: nullableStringField(value, 'reportSentToAccountingAt'),
    paidAt: nullableStringField(value, 'paidAt'),
    paidByFamilyMemberId: nullableStringField(value, 'paidByFamilyMemberId'),
    participants: arrayField(value, 'participants').map(assertPerson),
    helpers: arrayField(value, 'helpers').map(assertPerson),
    rewards: arrayField(value, 'rewards').map(assertReward),
    report: value.report === null ? null : assertReport(value.report),
    payouts: arrayField(value, 'payouts').map(assertPayout),
    auditTrail: arrayField(value, 'auditTrail').map(assertAudit),
    createdAt: stringField(value, 'createdAt'),
    updatedAt: stringField(value, 'updatedAt'),
  };
}

function assertPerson(value: unknown): BackendFamilyQuestPersonDto {
  if (!isRecord(value)) throw malformed();
  return {
    id: stringField(value, 'id'),
    familyMemberId: nullableStringField(value, 'familyMemberId'),
    displayName: stringField(value, 'displayName'),
    role: stringField(value, 'role'),
    joinedAt: stringField(value, 'joinedAt'),
    leftAt: nullableStringField(value, 'leftAt'),
    joinedLate: booleanField(value, 'joinedLate'),
    participationNote: nullableStringField(value, 'participationNote'),
    addedManually: booleanField(value, 'addedManually'),
    addedByFamilyMemberId: nullableStringField(value, 'addedByFamilyMemberId'),
    rewardPercent: nullableNumberField(value, 'rewardPercent'),
    rewardAmount: numberField(value, 'rewardAmount'),
    bonusAmount: numberField(value, 'bonusAmount'),
    bonusPercent: numberField(value, 'bonusPercent'),
    isBestParticipant: booleanField(value, 'isBestParticipant'),
    bestParticipantReason: nullableStringField(value, 'bestParticipantReason'),
    payoutStatus: stringField(value, 'payoutStatus'),
    paidAt: nullableStringField(value, 'paidAt'),
    paidByFamilyMemberId: nullableStringField(value, 'paidByFamilyMemberId'),
  };
}

function assertReward(value: unknown): BackendFamilyQuestRewardDto {
  if (!isRecord(value)) throw malformed();
  return {
    id: stringField(value, 'id'),
    questPersonId: nullableStringField(value, 'questPersonId'),
    rewardType: stringField(value, 'rewardType'),
    title: stringField(value, 'title'),
    amount: nullableNumberField(value, 'amount'),
    currency: nullableStringField(value, 'currency'),
    quantity: nullableNumberField(value, 'quantity'),
    status: stringField(value, 'status'),
    issuedAt: nullableStringField(value, 'issuedAt'),
    issuedByFamilyMemberId: nullableStringField(value, 'issuedByFamilyMemberId'),
  };
}

function assertReport(value: unknown): BackendFamilyQuestReportDto {
  if (!isRecord(value)) throw malformed();
  return {
    id: stringField(value, 'id'),
    title: stringField(value, 'title'),
    comment: nullableStringField(value, 'comment'),
    confirmedByFamilyMemberId: nullableStringField(value, 'confirmedByFamilyMemberId'),
    totalReward: numberField(value, 'totalReward'),
    memberRewardPool: numberField(value, 'memberRewardPool'),
    familyReward: numberField(value, 'familyReward'),
    transferredToAccountingAt: nullableStringField(value, 'transferredToAccountingAt'),
    createdAt: stringField(value, 'createdAt'),
    updatedAt: stringField(value, 'updatedAt'),
  };
}

function assertPayout(value: unknown): BackendFamilyQuestPayoutDto {
  if (!isRecord(value)) throw malformed();
  return {
    id: stringField(value, 'id'),
    reportId: nullableStringField(value, 'reportId'),
    questPersonId: nullableStringField(value, 'questPersonId'),
    familyMemberId: nullableStringField(value, 'familyMemberId'),
    displayName: stringField(value, 'displayName'),
    amount: numberField(value, 'amount'),
    rewardPercent: nullableNumberField(value, 'rewardPercent'),
    rewardItems: arrayField(value, 'rewardItems').filter(isRecord),
    bonusAmount: numberField(value, 'bonusAmount'),
    bonusPercent: numberField(value, 'bonusPercent'),
    status: stringField(value, 'status'),
    paidAt: nullableStringField(value, 'paidAt'),
    paidByFamilyMemberId: nullableStringField(value, 'paidByFamilyMemberId'),
    idempotencyKey: nullableStringField(value, 'idempotencyKey'),
    accrualId: nullableStringField(value, 'accrualId'),
    accountingTransactionId: nullableStringField(value, 'accountingTransactionId'),
    issuedAt: nullableStringField(value, 'issuedAt'),
    issuedByFamilyMemberId: nullableStringField(value, 'issuedByFamilyMemberId'),
    payoutEventKey: nullableStringField(value, 'payoutEventKey'),
  };
}

function assertAudit(value: unknown): BackendFamilyQuestAuditDto {
  if (!isRecord(value)) throw malformed();
  return {
    id: stringField(value, 'id'),
    actorFamilyMemberId: nullableStringField(value, 'actorFamilyMemberId'),
    action: stringField(value, 'action'),
    comment: nullableStringField(value, 'comment'),
    previousStatus: nullableStringField(value, 'previousStatus'),
    newStatus: nullableStringField(value, 'newStatus'),
    relatedFamilyMemberId: nullableStringField(value, 'relatedFamilyMemberId'),
    createdAt: stringField(value, 'createdAt'),
  };
}

function malformed() {
  return new FamilyQuestPayoutApiError('MALFORMED_RESPONSE', 'Quest backend response was malformed', 0);
}

function stringField(record: Record<string, unknown>, key: string) {
  if (typeof record[key] !== 'string') throw malformed();
  return record[key];
}

function nullableStringField(record: Record<string, unknown>, key: string) {
  if (record[key] === null) return null;
  return stringField(record, key);
}

function numberField(record: Record<string, unknown>, key: string) {
  if (typeof record[key] !== 'number' || !Number.isFinite(record[key])) throw malformed();
  return record[key];
}

function nullableNumberField(record: Record<string, unknown>, key: string) {
  if (record[key] === null) return null;
  return numberField(record, key);
}

function booleanField(record: Record<string, unknown>, key: string) {
  if (typeof record[key] !== 'boolean') throw malformed();
  return record[key];
}

function arrayField(record: Record<string, unknown>, key: string): unknown[] {
  if (!Array.isArray(record[key])) throw malformed();
  return record[key];
}

function stringArrayField(record: Record<string, unknown>, key: string): string[] {
  const items = arrayField(record, key);
  if (!items.every((item) => typeof item === 'string')) throw malformed();
  return items;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
