export type MemberActivityType =
  | 'tower_defense_responded'
  | 'tower_defense_confirmed'
  | 'tower_defense_attended'
  | 'tower_defense_late'
  | 'tower_defense_commanded'
  | 'tower_defense_defended'
  | 'tower_defense_lost'
  | 'quest_joined'
  | 'quest_helped'
  | 'quest_completed'
  | 'quest_best_participant'
  | 'quest_reward_earned'
  | 'quest_paid'
  | 'event_joined'
  | 'event_confirmed'
  | 'event_attended'
  | 'event_late'
  | 'event_organized'
  | 'event_completed'
  | 'achievement_earned'
  | 'reward_earned'
  | 'reward_approved'
  | 'reward_received'
  | 'accounting_accrual'
  | 'accounting_payout';

export type MemberActivitySourceModule = 'tower_defense' | 'family_quests' | 'family_events' | 'achievements' | 'rewards' | 'accounting';

export type MemberActivityItem = {
  id: string;
  type: MemberActivityType;
  sourceModule: MemberActivitySourceModule;
  sourceId: string;
  sourceSubId: string | null;
  occurredAt: string;
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  xpDelta?: number;
};

export type MemberActivityQuery = {
  limit: number;
  cursor?: string | null;
  sourceModule?: MemberActivitySourceModule | null;
  type?: MemberActivityType | null;
  from?: string | null;
  to?: string | null;
};

export type MemberActivityResponse = {
  items: MemberActivityItem[];
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export type MemberProfileReport = {
  memberId: string;
  quests: {
    questsParticipated: number;
    questsHelped: number;
    questsCompleted: number;
    bestParticipantCount: number;
  };
  towerDefense: {
    defensesResponded: number;
    defensesAttended: number;
    defensesCommanded: number;
    towersDefended: number;
    towersLost: number;
    attendancePresent: number;
    attendanceLate: number;
    attendanceAbsent: number;
    attendanceExcused: number;
  };
  events: {
    eventsJoined: number;
    eventsAttended: number;
    eventsOrganized: number;
    eventAttendancePresent: number;
    eventAttendanceLate: number;
    eventAttendanceAbsent: number;
    eventAttendanceExcused: number;
  };
  xp: {
    available: boolean;
    totalEarned: number | null;
  };
  finance: null | {
    accruedTotal: number;
    paidTotal: number;
    unpaidTotal: number;
    currency: string;
    salaryTotal?: number;
    premiumTotal?: number;
    rewardMoneyTotal?: number;
    questMoneyTotal?: number;
    adjustmentTotal?: number;
  };
  achievements: {
    achievementsTotal: number;
  };
  rewards: {
    rewardsEarned: number;
    rewardsApproved: number;
    rewardsIssued: number;
    rewardMoneyEarned: number;
  };
  leaderboard: null | {
    rank: number;
    place: number;
    score: number;
    period: 'current_month' | 'previous_month' | 'all_time';
    category: 'overall' | 'tower_defense' | 'quests' | 'events';
  };
  permissions: {
    canViewFinance: boolean;
  };
};
