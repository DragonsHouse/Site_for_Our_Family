export type FamilyQuestStatus =
  | 'recruiting'
  | 'scheduled'
  | 'active'
  | 'paused'
  | 'stopped'
  | 'completed'
  | 'reported'
  | 'sent_to_accounting'
  | 'paid'
  | 'cooldown';

export type FamilyQuestRewardMode = 'equal' | 'percentage' | 'fixed' | 'mixed' | 'manual';
export type FamilyQuestPersonRole = 'participant' | 'helper';
export type FamilyQuestPayoutStatus = 'pending' | 'paid' | 'unpaid';
export type FamilyQuestRewardType = 'money' | 'item' | 'custom';
export type FamilyQuestRewardStatus = 'planned' | 'prepared' | 'issued' | 'cancelled';

export type FamilyQuestTemplateRecord = {
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
  rewardMode: FamilyQuestRewardMode;
  requiredItems: string | null;
  imageAssetId: string | null;
  isActive: boolean;
  cooldownHours: number;
  cooldownUntil: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type FamilyQuestPersonRecord = {
  id: string;
  questId: string;
  familyMemberId: string | null;
  displayName: string;
  role: FamilyQuestPersonRole;
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
  payoutStatus: FamilyQuestPayoutStatus;
  paidAt: string | null;
  paidByFamilyMemberId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type FamilyQuestRewardRecord = {
  id: string;
  questId: string;
  templateId: string | null;
  questPersonId: string | null;
  rewardType: FamilyQuestRewardType;
  title: string;
  amount: number | null;
  currency: string | null;
  quantity: number | null;
  status: FamilyQuestRewardStatus;
  issuedAt: string | null;
  issuedByFamilyMemberId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type FamilyQuestPayoutRecord = {
  id: string;
  questId: string;
  reportId: string | null;
  questPersonId: string | null;
  familyMemberId: string | null;
  displayName: string;
  amount: number;
  rewardPercent: number | null;
  rewardItems: Array<Record<string, unknown>>;
  bonusAmount: number;
  bonusPercent: number;
  status: FamilyQuestPayoutStatus;
  paidAt: string | null;
  paidByFamilyMemberId: string | null;
  idempotencyKey: string | null;
  accrualId: string | null;
  accountingTransactionId: string | null;
  issuedAt: string | null;
  issuedByFamilyMemberId: string | null;
  payoutEventKey: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type FamilyQuestReportRecord = {
  id: string;
  questId: string;
  title: string;
  comment: string | null;
  confirmedByFamilyMemberId: string | null;
  totalReward: number;
  memberRewardPool: number;
  familyReward: number;
  transferredToAccountingAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type FamilyQuestAuditRecord = {
  id: string;
  questId: string;
  actorFamilyMemberId: string | null;
  action: string;
  comment: string | null;
  previousStatus: FamilyQuestStatus | null;
  newStatus: FamilyQuestStatus | null;
  relatedFamilyMemberId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type FamilyQuestRecord = {
  id: string;
  templateId: string | null;
  title: string;
  description: string;
  category: string;
  status: FamilyQuestStatus;
  startsAt: string | null;
  endsAt: string | null;
  scheduledAt: string | null;
  organizerFamilyMemberId: string | null;
  totalReward: number;
  memberRewardPool: number;
  familyReward: number;
  rewardMode: FamilyQuestRewardMode;
  requiredItems: string | null;
  bestParticipantFamilyMemberId: string | null;
  bestParticipantReason: string | null;
  reportId: string | null;
  reportSentToAccountingAt: string | null;
  paidAt: string | null;
  paidByFamilyMemberId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  people: FamilyQuestPersonRecord[];
  rewards: FamilyQuestRewardRecord[];
  report: FamilyQuestReportRecord | null;
  payouts: FamilyQuestPayoutRecord[];
  auditTrail: FamilyQuestAuditRecord[];
};

export type FamilyQuestListQuery = {
  status?: FamilyQuestStatus | 'all' | null;
  activeOnly?: boolean;
};
