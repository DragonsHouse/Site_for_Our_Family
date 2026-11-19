import type { FamilyMemberAccrualRecord, FamilyMemberAccrualSourceType, PaymentProofInput, PremiumEntitlementRecord, SalaryRuleRecord } from './finance-models.js';

export type CreatePayrollPeriodInput = {
  periodType: 'weekly' | 'monthly' | 'custom';
  startsAt: string;
  endsAt: string;
  title: string;
  metadata?: Record<string, unknown>;
};

export type CreateSalaryRuleInput = {
  ruleKey: string;
  name: string;
  description?: string | null;
  ruleType?: SalaryRuleRecord['ruleType'];
  basis: SalaryRuleRecord['basis'];
  amount: number;
  currency?: string;
  active?: boolean;
  priority?: number;
  stackingPolicy?: SalaryRuleRecord['stackingPolicy'];
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  config?: Record<string, unknown>;
};

export type UpdateSalaryRuleInput = Partial<Omit<CreateSalaryRuleInput, 'ruleKey'>> & {
  active?: boolean;
};

export type CreatePremiumInput = {
  familyMemberId: string;
  payrollPeriodId?: string | null;
  amount: number;
  currency?: string;
  reason: string;
  sourceType?: PremiumEntitlementRecord['sourceType'];
  sourceId?: string | null;
  sourceKey?: string | null;
  category?: PremiumEntitlementRecord['category'];
  stackingPolicy?: SalaryRuleRecord['stackingPolicy'];
};

export type CreateAdjustmentInput = {
  familyMemberId: string;
  amount: number;
  currency?: string;
  reason: string;
  sourceKey?: string | null;
};

export type CreatePayoutBatchInput = {
  payrollPeriodId?: string | null;
  title: string;
  reference?: string | null;
  accrualIds: string[];
};

export type AccountingDashboardQuery = {
  memberId?: string | null;
  sourceType?: FamilyMemberAccrualSourceType | 'all' | null;
  status?: FamilyMemberAccrualRecord['status'] | 'all' | null;
  periodId?: string | null;
  from?: string | null;
  to?: string | null;
  limit: number;
};

export type QuestPayoutShare = {
  questId: string;
  questTitle: string;
  payoutPool: number;
  participantCount: number;
  familyRemainder: number;
  totalFamilyIncome: number;
  roundingStrategy: 'largest_remainder_by_quest_person_id';
  shares: Array<{ questPersonId: string; familyMemberId: string; displayName: string; amount: number; accrualId: string; payoutId: string }>;
};

export type WeeklyActivityStatus = {
  periodId: string | null;
  startsAt: string;
  endsAt: string;
  completedQuests: number;
  towerParticipations: number;
  questRequirement: 1;
  towerRequirement: 1;
  eligible: boolean;
  qualifyingReason: 'quest' | 'tower' | 'both' | 'none';
};

export type PayableSummary = {
  items: Array<{
    memberId: string;
    nickname: string;
    staticId: string | null;
    rank: number;
    role: string;
    roleLabel: string;
    totalOutstanding: number;
    currency: string;
    accrualCount: number;
    accrualIds: string[];
    breakdown: Record<string, number>;
    accruals: FamilyMemberAccrualRecord[];
  }>;
};

export type MonthlyAccountingSummary = {
  year: number;
  month: number;
  startsAt: string;
  endsAt: string;
  currency: string;
  totals: {
    income: number;
    expenses: number;
    payouts: number;
    adjustments: number;
    net: number;
    questFamilyIncome: number;
    questMemberRewards: number;
    questTotalRewards: number;
  };
  quests: {
    completedCount: number;
    withDiscordProjectionCount: number;
    items: Array<{
      id: string;
      title: string;
      status: string;
      completedAt: string;
      totalReward: number;
      memberRewardPool: number;
      familyReward: number;
      participantCount: number;
      helperCount: number;
      discordMessageId: string | null;
      discordChannelId: string | null;
      discordSyncedAt: string | null;
    }>;
    topMembers: Array<{
      familyMemberId: string | null;
      displayName: string;
      completedQuests: number;
      earnedAmount: number;
    }>;
  };
  transactions: Array<{
    id: string;
    type: 'income' | 'expense' | 'payout' | 'adjustment';
    amount: number;
    currency: string;
    reason: string;
    createdAt: string;
    memberName: string | null;
    questTitle: string | null;
  }>;
};

export type PaymentProofContent = {
  id: string;
  originalFilename: string;
  contentType: PaymentProofInput['contentType'];
  data: Buffer;
};
