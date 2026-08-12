export type FamilyMemberAccrualSourceType =
  | 'quest_reward'
  | 'quest_best_participant'
  | 'salary'
  | 'premium'
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
