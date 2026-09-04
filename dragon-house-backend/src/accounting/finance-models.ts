export type FamilyMemberAccrualSourceType =
  | 'quest'
  | 'quest_reward'
  | 'quest_best_participant'
  | 'reward'
  | 'salary'
  | 'premium'
  | 'adjustment'
  | 'manual_bonus'
  | 'tower_defense'
  | 'other';

export type FamilyMemberAccrualStatus = 'accrued' | 'approved' | 'paid' | 'cancelled';
export type FamilyAccountingTransactionType = 'income' | 'expense' | 'payout' | 'adjustment';

export type FamilyMemberAccrualRecord = {
  id: string;
  familyMemberId: string;
  sourceType: FamilyMemberAccrualSourceType;
  sourceId: string;
  sourceKey: string;
  amount: number;
  currency: string;
  reason: string;
  status: FamilyMemberAccrualStatus;
  approvedAt: string | null;
  paidAt: string | null;
  reportingPeriodStart: string | null;
  reportingPeriodEnd: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  payrollPeriodId?: string | null;
  payoutBatchItemId?: string | null;
};

export type FamilyAccountingTransactionRecord = {
  id: string;
  transactionType: FamilyAccountingTransactionType;
  amount: number;
  currency: string;
  familyMemberId: string | null;
  questId: string | null;
  accrualId: string | null;
  payoutId: string | null;
  sourceKey: string;
  reason: string;
  createdByFamilyMemberId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  payoutBatchId?: string | null;
  payoutBatchItemId?: string | null;
  paymentProofId?: string | null;
  payerNicknameSnapshot?: string | null;
  payerRoleSnapshot?: string | null;
  recordedAt?: string;
};

export type PayrollPeriodStatus = 'draft' | 'calculated' | 'finalized' | 'closed' | 'cancelled';
export type PayoutBatchStatus = 'draft' | 'finalized' | 'partially_paid' | 'paid' | 'cancelled';
export type PayoutBatchItemStatus = 'pending' | 'paid' | 'cancelled';
export type PremiumCategory = 'manual' | 'activity' | 'quest_activity' | 'combat' | 'top3' | 'leadership' | 'special';

export type PayrollPeriodRecord = {
  id: string;
  periodType: 'weekly' | 'monthly' | 'custom';
  startsAt: string;
  endsAt: string;
  status: PayrollPeriodStatus;
  title: string;
  createdByFamilyMemberId: string;
  finalizedAt: string | null;
  finalizedByFamilyMemberId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type SalaryRuleRecord = {
  id: string;
  ruleKey: string;
  name: string;
  description: string | null;
  ruleType: 'eligibility' | 'base_salary' | 'fixed_activity_bonus' | 'activity_multiplier' | 'attendance_modifier' | 'leadership_modifier' | 'premium_rule';
  basis: 'rank' | 'role' | 'member' | 'manual' | 'activity_metric';
  amount: number;
  currency: string;
  active: boolean;
  version: number;
  priority: number;
  stackingPolicy: 'not_applicable' | 'stack_all' | 'highest_only' | 'capped' | 'category_specific';
  effectiveFrom: string | null;
  effectiveTo: string | null;
  config: Record<string, unknown>;
  createdByFamilyMemberId: string;
  updatedByFamilyMemberId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PayrollMetricSnapshot = {
  questsParticipated: number;
  questsHelped: number;
  questsCompleted: number;
  questBestParticipant: number;
  towerDefenseResponded: number;
  towerDefensePresent: number;
  towerDefenseLate: number;
  towerDefenseAbsent: number;
  towerDefenseExcused: number;
  towerDefenseDefended: number;
  towerDefenseLost: number;
  towerDefenseCommanded: number;
  towerDefenseSuccessfulCommanded: number;
  towerParticipation: number;
  eventsJoined: number;
  eventsAttended: number;
  eventsLate: number;
  eventsAbsent: number;
  eventsExcused: number;
  eventsOrganized: number;
  achievementsEarned: number;
  overallActivityCount: number;
  overallLeaderboardRank: number;
};

export type PayrollPreviewItem = {
  familyMemberId: string;
  displayName: string;
  eligible: boolean;
  status: 'valid' | 'configuration_incomplete' | 'ineligible';
  baseAmount: number;
  modifiersTotal: number;
  premiumPreviewTotal: number;
  finalSalary: number;
  currency: string;
  metrics: PayrollMetricSnapshot;
  eligibility: Record<string, unknown>;
  breakdown: {
    base: Array<Record<string, unknown>>;
    modifiers: Array<Record<string, unknown>>;
    premiums: Array<Record<string, unknown>>;
    warnings: string[];
  };
  warnings: string[];
};

export type PayrollPreviewResult = {
  period: PayrollPeriodRecord;
  configurationComplete: boolean;
  warnings: string[];
  items: PayrollPreviewItem[];
};

export type PremiumEntitlementRecord = {
  id: string;
  payrollPeriodId: string | null;
  familyMemberId: string;
  accrualId: string;
  amount: number;
  currency: string;
  reason: string;
  sourceType: 'manual' | 'rule' | 'leaderboard' | 'achievement' | 'special';
  sourceId: string | null;
  sourceKey: string;
  category: PremiumCategory;
  stackingPolicy: SalaryRuleRecord['stackingPolicy'];
  status: 'approved' | 'cancelled';
  createdByFamilyMemberId: string;
  createdAt: string;
  updatedAt: string;
};

export type PayoutBatchRecord = {
  id: string;
  payrollPeriodId: string | null;
  title: string;
  reference: string | null;
  status: PayoutBatchStatus;
  createdByFamilyMemberId: string;
  finalizedAt: string | null;
  finalizedByFamilyMemberId: string | null;
  paidAt: string | null;
  totalAmount: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

export type PayoutBatchItemRecord = {
  id: string;
  payoutBatchId: string;
  familyMemberId: string;
  totalAmount: number;
  currency: string;
  status: PayoutBatchItemStatus;
  paidByFamilyMemberId: string | null;
  payerNicknameSnapshot?: string | null;
  payerRoleSnapshot?: string | null;
  paymentProofId?: string | null;
  paidAt: string | null;
  accountingTransactionId: string | null;
  accrualIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type PaymentProofInput = {
  originalFilename: string;
  contentType: 'image/png' | 'image/jpeg' | 'image/webp';
  dataBase64: string;
};

export type IssueQuestPayoutInput = {
  questId: string;
  payoutId: string;
  issuedByFamilyMemberId: string;
  idempotencyKey: string;
};

export type IssueQuestPayoutResult = {
  questId: string;
  payoutId: string;
  familyMemberId: string;
  amount: number;
  currency: string;
  payoutStatus: 'paid';
  paidAt: string;
  paidByFamilyMemberId: string;
  idempotencyKey: string | null;
  payoutEventKey: string;
  accrual: FamilyMemberAccrualRecord | null;
  accountingTransaction: FamilyAccountingTransactionRecord | null;
  alreadyIssued: boolean;
};
