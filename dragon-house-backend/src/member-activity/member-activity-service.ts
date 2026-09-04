import type { FamilyAuthContext, FamilyPermission } from '../types.js';
import type { FamilyMemberRepository } from '../members/member-repository.js';
import type { FamilyQuestRepository } from '../quests/quest-repository.js';
import type { FamilyQuestRecord } from '../quests/quest-models.js';
import type { TowerDefenseRepository } from '../tower-defense/tower-defense-repository.js';
import type { TowerDefenseRecord } from '../tower-defense/tower-defense-models.js';
import type { FamilyEventRepository } from '../family-events/family-event-repository.js';
import type { FamilyEventRecord } from '../family-events/family-event-models.js';
import type { AchievementRepository } from '../achievements/achievement-repository.js';
import type { MemberAchievementRecord, MemberRewardGrantRecord } from '../achievements/achievement-models.js';
import type { AchievementService } from '../achievements/achievement-service.js';
import { MemberActivityError } from './member-activity-errors.js';
import type {
  MemberActivityItem,
  MemberActivityQuery,
  MemberActivityResponse,
  MemberActivitySourceModule,
  MemberActivityType,
  MemberProfileReport,
} from './member-activity-models.js';

export type MemberFinanceSummary = {
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

export type MemberFinanceSummaryReader = {
  getMemberFinanceSummary(memberId: string): Promise<MemberFinanceSummary>;
  listMemberAccountingActivity?(memberId: string): Promise<MemberActivityItem[]>;
};

export class MemberActivityService {
  constructor(
    private readonly members: FamilyMemberRepository,
    private readonly quests: FamilyQuestRepository,
    private readonly towerDefenses: TowerDefenseRepository,
    private readonly financeReader: MemberFinanceSummaryReader | null = null,
    private readonly familyEvents: FamilyEventRepository | null = null,
    private readonly achievements: AchievementRepository | null = null,
    private readonly achievementService: AchievementService | null = null,
  ) {}

  async listActivity(memberId: string, query: MemberActivityQuery, auth: FamilyAuthContext): Promise<MemberActivityResponse> {
    await this.assertCanViewMember(memberId, auth);
    const allItems = await this.projectActivity(memberId);
    const filtered = allItems
      .filter((item) => !query.sourceModule || item.sourceModule === query.sourceModule)
      .filter((item) => !query.type || item.type === query.type)
      .filter((item) => !query.from || item.occurredAt >= query.from)
      .filter((item) => !query.to || item.occurredAt <= query.to)
      .filter((item) => !query.cursor || compareCursor(item, query.cursor) < 0)
      .sort(compareActivityNewestFirst);
    const page = filtered.slice(0, query.limit + 1);
    const items = page.slice(0, query.limit);
    const last = items.at(-1);
    return {
      items,
      pagination: {
        limit: query.limit,
        nextCursor: page.length > query.limit && last ? encodeCursor(last) : null,
        hasMore: page.length > query.limit,
      },
    };
  }

  async getReport(memberId: string, auth: FamilyAuthContext): Promise<MemberProfileReport> {
    await this.assertCanViewMember(memberId, auth);
    const [quests, defenses, events] = await Promise.all([
      this.quests.listQuests({ status: 'all' }),
      this.towerDefenses.listDefenses({ status: 'all', result: 'all' }),
      this.familyEvents ? this.familyEvents.listEvents({ status: 'all' }) : Promise.resolve([]),
    ]);
    const memberQuests = quests.filter((quest) => quest.people.some((person) => person.familyMemberId === memberId && !person.leftAt));
    const questPersonRows = memberQuests.flatMap((quest) => quest.people.filter((person) => person.familyMemberId === memberId && !person.leftAt));
    const attendedDefenses = defenses.filter((defense) => defense.attendance.some((attendance) => attendance.familyMemberId === memberId && ['present', 'late'].includes(attendance.status)));
    const canViewFinance = canViewFinanceFor(auth);
    const finance = canViewFinance && this.financeReader ? await this.financeReader.getMemberFinanceSummary(memberId) : null;
    const [memberAchievements, memberRewards, leaderboard] = await Promise.all([
      this.achievements ? this.achievements.listMemberAchievements(memberId) : Promise.resolve([]),
      this.achievements ? this.achievements.listMemberRewardGrants(memberId) : Promise.resolve([]),
      this.achievementService ? this.achievementService.getLeaderboard('current_month', 'overall', auth).catch(() => null) : Promise.resolve(null),
    ]);
    const leaderboardEntry = leaderboard?.items.find((item) => item.familyMemberId === memberId) ?? null;
    const earnedTowerXp = attendedDefenses
      .filter((defense) => defense.status === 'completed' && defense.statisticsEligible && ['defended', 'lost'].includes(defense.result))
      .reduce((total, defense) => total + defense.xp, 0);

    return {
      memberId,
      quests: {
        questsParticipated: questPersonRows.filter((person) => person.role === 'participant').length,
        questsHelped: questPersonRows.filter((person) => person.role === 'helper').length,
        questsCompleted: memberQuests.filter((quest) => ['completed', 'reported', 'sent_to_accounting', 'paid'].includes(quest.status)).length,
        bestParticipantCount: questPersonRows.filter((person) => person.isBestParticipant).length,
      },
      towerDefense: {
        defensesResponded: defenses.filter((defense) => defense.responses.some((response) => response.familyMemberId === memberId && response.response !== 'no-response')).length,
        defensesAttended: attendedDefenses.length,
        defensesCommanded: defenses.filter((defense) => defense.commanderFamilyMemberId === memberId).length,
        towersDefended: attendedDefenses.filter((defense) => defense.status === 'completed' && defense.result === 'defended').length,
        towersLost: attendedDefenses.filter((defense) => defense.status === 'completed' && defense.result === 'lost').length,
        attendancePresent: defenses.reduce((total, defense) => total + defense.attendance.filter((attendance) => attendance.familyMemberId === memberId && attendance.status === 'present').length, 0),
        attendanceLate: defenses.reduce((total, defense) => total + defense.attendance.filter((attendance) => attendance.familyMemberId === memberId && attendance.status === 'late').length, 0),
        attendanceAbsent: defenses.reduce((total, defense) => total + defense.attendance.filter((attendance) => attendance.familyMemberId === memberId && attendance.status === 'absent').length, 0),
        attendanceExcused: defenses.reduce((total, defense) => total + defense.attendance.filter((attendance) => attendance.familyMemberId === memberId && attendance.status === 'excused').length, 0),
      },
      events: {
        eventsJoined: events.reduce((total, event) => total + event.responses.filter((response) => response.familyMemberId === memberId && ['joining', 'confirmed'].includes(response.response)).length, 0),
        eventsAttended: events.reduce((total, event) => total + event.attendance.filter((attendance) => attendance.familyMemberId === memberId && ['present', 'late'].includes(attendance.status)).length, 0),
        eventsOrganized: events.filter((event) => event.organizerFamilyMemberId === memberId).length,
        eventAttendancePresent: events.reduce((total, event) => total + event.attendance.filter((attendance) => attendance.familyMemberId === memberId && attendance.status === 'present').length, 0),
        eventAttendanceLate: events.reduce((total, event) => total + event.attendance.filter((attendance) => attendance.familyMemberId === memberId && attendance.status === 'late').length, 0),
        eventAttendanceAbsent: events.reduce((total, event) => total + event.attendance.filter((attendance) => attendance.familyMemberId === memberId && attendance.status === 'absent').length, 0),
        eventAttendanceExcused: events.reduce((total, event) => total + event.attendance.filter((attendance) => attendance.familyMemberId === memberId && attendance.status === 'excused').length, 0),
      },
      xp: {
        available: earnedTowerXp > 0,
        totalEarned: earnedTowerXp > 0 ? earnedTowerXp : null,
      },
      finance,
      achievements: {
        achievementsTotal: memberAchievements.length,
      },
      rewards: {
        rewardsEarned: memberRewards.filter((grant) => grant.status !== 'cancelled').length,
        rewardsApproved: memberRewards.filter((grant) => grant.status === 'approved' || grant.status === 'issued').length,
        rewardsIssued: memberRewards.filter((grant) => grant.status === 'issued').length,
        rewardMoneyEarned: memberRewards
          .filter((grant) => grant.status !== 'cancelled' && grant.reward.rewardType === 'money')
          .reduce((total, grant) => total + (grant.reward.amount ?? 0), 0),
      },
      leaderboard: leaderboardEntry ? {
        rank: leaderboardEntry.rank,
        place: leaderboardEntry.place,
        score: leaderboardEntry.score,
        period: 'current_month',
        category: 'overall',
      } : null,
      permissions: {
        canViewFinance,
      },
    };
  }

  private async assertCanViewMember(memberId: string, auth: FamilyAuthContext): Promise<void> {
    if (auth.status !== 'active') throw new MemberActivityError('MEMBER_ACTIVITY_PERMISSION_DENIED', 'Inactive member.', 403);
    const member = await this.members.findById(memberId);
    if (!member || member.deletedAt) throw new MemberActivityError('MEMBER_ACTIVITY_MEMBER_NOT_FOUND', 'Member not found.', 404);
    if (member.status === 'inactive' && !canViewOtherMember(auth)) {
      throw new MemberActivityError('MEMBER_ACTIVITY_PERMISSION_DENIED', 'Permission denied.', 403);
    }
    if (auth.familyMemberId !== memberId && !canViewOtherMember(auth)) {
      throw new MemberActivityError('MEMBER_ACTIVITY_PERMISSION_DENIED', 'Permission denied.', 403);
    }
  }

  private async projectActivity(memberId: string): Promise<MemberActivityItem[]> {
    const [quests, defenses, events, achievements, rewards, accounting] = await Promise.all([
      this.quests.listQuests({ status: 'all' }),
      this.towerDefenses.listDefenses({ status: 'all', result: 'all' }),
      this.familyEvents ? this.familyEvents.listEvents({ status: 'all' }) : Promise.resolve([]),
      this.achievements ? this.achievements.listMemberAchievements(memberId) : Promise.resolve([]),
      this.achievements ? this.achievements.listMemberRewardGrants(memberId) : Promise.resolve([]),
      this.financeReader?.listMemberAccountingActivity ? this.financeReader.listMemberAccountingActivity(memberId) : Promise.resolve([]),
    ]);
    return [
      ...defenses.flatMap((defense) => projectTowerDefenseActivity(defense, memberId)),
      ...quests.flatMap((quest) => projectQuestActivity(quest, memberId)),
      ...events.flatMap((event) => projectFamilyEventActivity(event, memberId)),
      ...achievements.map(projectAchievementActivity),
      ...rewards.flatMap(projectRewardActivity),
      ...accounting,
    ].sort(compareActivityNewestFirst);
  }
}

function projectAchievementActivity(award: MemberAchievementRecord): MemberActivityItem {
  return activity({
    id: `achievements:award:${award.id}`,
    type: 'achievement_earned',
    sourceModule: 'achievements',
    sourceId: award.achievementId,
    sourceSubId: award.id,
    occurredAt: award.awardedAt,
    title: 'Achievement earned',
    description: `${award.achievement.name} was earned.`,
    metadata: {
      achievementKey: award.achievement.achievementKey,
      category: award.achievement.category,
      rarity: award.achievement.rarity,
      sourceKey: award.sourceKey,
    },
  });
}

function projectRewardActivity(grant: MemberRewardGrantRecord): MemberActivityItem[] {
  const items: MemberActivityItem[] = [activity({
    id: `rewards:grant:${grant.id}:earned`,
    type: 'reward_earned',
    sourceModule: 'rewards',
    sourceId: grant.rewardId,
    sourceSubId: grant.id,
    occurredAt: grant.grantedAt,
    title: 'Reward earned',
    description: `${grant.reward.name} was earned.`,
    metadata: rewardMetadata(grant),
  })];
  if (grant.approvedAt) {
    items.push(activity({
      id: `rewards:grant:${grant.id}:approved`,
      type: 'reward_approved',
      sourceModule: 'rewards',
      sourceId: grant.rewardId,
      sourceSubId: grant.id,
      occurredAt: grant.approvedAt,
      title: 'Reward approved',
      description: `${grant.reward.name} was approved.`,
      metadata: rewardMetadata(grant),
    }));
  }
  if (grant.status === 'issued') {
    items.push(activity({
    id: `rewards:grant:${grant.id}:issued`,
    type: 'reward_received',
    sourceModule: 'rewards',
    sourceId: grant.rewardId,
    sourceSubId: grant.id,
    occurredAt: grant.issuedAt ?? grant.grantedAt,
    title: 'Reward received',
    description: `${grant.reward.name} was issued.`,
    metadata: rewardMetadata(grant),
    xpDelta: grant.reward.rewardType === 'xp' && grant.reward.amount ? grant.reward.amount : undefined,
    }));
  }
  return items;
}

function rewardMetadata(grant: MemberRewardGrantRecord): Record<string, unknown> {
  return {
    rewardKey: grant.reward.rewardKey,
    rewardType: grant.reward.rewardType,
    sourceKey: grant.sourceKey,
    rewardStatus: grant.status,
    financeAccrualId: grant.financeAccrualId,
    financeTransferredAt: grant.financeTransferredAt,
  };
}

function projectTowerDefenseActivity(defense: TowerDefenseRecord, memberId: string): MemberActivityItem[] {
  const items: MemberActivityItem[] = [];
  const response = defense.responses.find((item) => item.familyMemberId === memberId);
  if (response && response.response !== 'no-response') {
    items.push(activity({
      id: `tower_defense:response:${response.id}:responded`,
      type: 'tower_defense_responded',
      sourceModule: 'tower_defense',
      sourceId: defense.id,
      sourceSubId: response.id,
      occurredAt: response.respondedAt,
      title: 'Tower defense response recorded',
      description: `${response.displayName} responded to ${defense.title}.`,
      metadata: towerMetadata(defense, { response: response.response }),
    }));
    if (response.response === 'confirmed') {
      items.push(activity({
        id: `tower_defense:response:${response.id}:confirmed`,
        type: 'tower_defense_confirmed',
        sourceModule: 'tower_defense',
        sourceId: defense.id,
        sourceSubId: response.id,
        occurredAt: response.respondedAt,
        title: 'Tower defense confirmed',
        description: `${response.displayName} confirmed participation in ${defense.title}.`,
        metadata: towerMetadata(defense),
      }));
    }
  }

  const attendance = defense.attendance.find((item) => item.familyMemberId === memberId);
  if (attendance) {
    if (attendance.status === 'present' || attendance.status === 'late') {
      items.push(activity({
        id: `tower_defense:attendance:${attendance.id}:${attendance.status === 'late' ? 'late' : 'attended'}`,
        type: attendance.status === 'late' ? 'tower_defense_late' : 'tower_defense_attended',
        sourceModule: 'tower_defense',
        sourceId: defense.id,
        sourceSubId: attendance.id,
        occurredAt: attendance.confirmedAt ?? attendance.updatedAt,
        title: attendance.status === 'late' ? 'Arrived late for tower defense' : 'Attended tower defense',
        description: `${attendance.displayName} was marked ${attendance.status} for ${defense.title}.`,
        metadata: towerMetadata(defense, { attendanceStatus: attendance.status }),
      }));
    }
  }

  if (defense.commanderFamilyMemberId === memberId) {
    items.push(activity({
      id: `tower_defense:defense:${defense.id}:commanded`,
      type: 'tower_defense_commanded',
      sourceModule: 'tower_defense',
      sourceId: defense.id,
      sourceSubId: null,
      occurredAt: defense.startsAt,
      title: 'Commanded tower defense',
      description: `${defense.commanderDisplayName ?? 'Commander'} led ${defense.title}.`,
      metadata: towerMetadata(defense),
    }));
  }

  if (attendance && ['present', 'late'].includes(attendance.status) && defense.status === 'completed' && (defense.result === 'defended' || defense.result === 'lost')) {
    items.push(activity({
      id: `tower_defense:defense:${defense.id}:result:${memberId}`,
      type: defense.result === 'defended' ? 'tower_defense_defended' : 'tower_defense_lost',
      sourceModule: 'tower_defense',
      sourceId: defense.id,
      sourceSubId: memberId,
      occurredAt: defense.completedAt ?? defense.endedAt ?? defense.updatedAt,
      title: defense.result === 'defended' ? 'Tower defended' : 'Tower lost',
      description: `${defense.title} ended as ${defense.result}.`,
      metadata: towerMetadata(defense, { result: defense.result }),
      xpDelta: defense.statisticsEligible && defense.xp > 0 ? defense.xp : undefined,
    }));
  }

  return items;
}

function projectQuestActivity(quest: FamilyQuestRecord, memberId: string): MemberActivityItem[] {
  const items: MemberActivityItem[] = [];
  const people = quest.people.filter((person) => person.familyMemberId === memberId && !person.leftAt);
  for (const person of people) {
    items.push(activity({
      id: `family_quests:person:${person.id}:${person.role}`,
      type: person.role === 'helper' ? 'quest_helped' : 'quest_joined',
      sourceModule: 'family_quests',
      sourceId: quest.id,
      sourceSubId: person.id,
      occurredAt: person.joinedAt,
      title: person.role === 'helper' ? 'Helped with quest' : 'Joined quest',
      description: `${person.displayName} ${person.role === 'helper' ? 'helped with' : 'joined'} ${quest.title}.`,
      metadata: questMetadata(quest, { role: person.role }),
    }));
    if (person.isBestParticipant) {
      items.push(activity({
        id: `family_quests:person:${person.id}:best_participant`,
        type: 'quest_best_participant',
        sourceModule: 'family_quests',
        sourceId: quest.id,
        sourceSubId: person.id,
        occurredAt: quest.report?.createdAt ?? quest.updatedAt,
        title: 'Best quest participant',
        description: person.bestParticipantReason ?? quest.bestParticipantReason ?? `${person.displayName} was marked as best participant.`,
        metadata: questMetadata(quest),
      }));
    }
    if (person.rewardAmount > 0 || person.bonusAmount > 0) {
      items.push(activity({
        id: `family_quests:person:${person.id}:reward`,
        type: 'quest_reward_earned',
        sourceModule: 'family_quests',
        sourceId: quest.id,
        sourceSubId: person.id,
        occurredAt: quest.report?.createdAt ?? person.updatedAt,
        title: 'Quest reward earned',
        description: `${person.displayName} earned a quest reward for ${quest.title}.`,
        metadata: questMetadata(quest, { amount: person.rewardAmount + person.bonusAmount, payoutStatus: person.payoutStatus }),
      }));
    }
  }

  if (people.length && ['completed', 'reported', 'sent_to_accounting', 'paid'].includes(quest.status)) {
    items.push(activity({
      id: `family_quests:quest:${quest.id}:completed:${memberId}`,
      type: 'quest_completed',
      sourceModule: 'family_quests',
      sourceId: quest.id,
      sourceSubId: memberId,
      occurredAt: quest.endsAt ?? quest.report?.createdAt ?? quest.updatedAt,
      title: 'Quest completed',
      description: `${quest.title} was completed.`,
      metadata: questMetadata(quest),
    }));
  }

  for (const payout of quest.payouts.filter((item) => item.familyMemberId === memberId && item.status === 'paid' && item.paidAt)) {
    items.push(activity({
      id: `family_quests:payout:${payout.id}:paid`,
      type: 'quest_paid',
      sourceModule: 'family_quests',
      sourceId: quest.id,
      sourceSubId: payout.id,
      occurredAt: payout.paidAt!,
      title: 'Quest payout paid',
      description: `${payout.displayName} received quest payout for ${quest.title}.`,
      metadata: questMetadata(quest, { amount: payout.amount, payoutEventKey: payout.payoutEventKey }),
    }));
  }

  return items;
}

function projectFamilyEventActivity(event: FamilyEventRecord, memberId: string): MemberActivityItem[] {
  const items: MemberActivityItem[] = [];
  const response = event.responses.find((item) => item.familyMemberId === memberId);
  if (response && response.response !== 'declined') {
    if (response.response === 'joining' || response.response === 'confirmed') {
      items.push(activity({
        id: `family_events:response:${response.id}:joined`,
        type: 'event_joined',
        sourceModule: 'family_events',
        sourceId: event.id,
        sourceSubId: response.id,
        occurredAt: response.respondedAt,
        title: 'Joined family event',
        description: `${response.displayName} joined ${event.title}.`,
        metadata: eventMetadata(event, { response: response.response }),
      }));
    }
    if (response.response === 'confirmed') {
      items.push(activity({
        id: `family_events:response:${response.id}:confirmed`,
        type: 'event_confirmed',
        sourceModule: 'family_events',
        sourceId: event.id,
        sourceSubId: response.id,
        occurredAt: response.respondedAt,
        title: 'Confirmed family event',
        description: `${response.displayName} confirmed participation in ${event.title}.`,
        metadata: eventMetadata(event),
      }));
    }
  }

  const attendance = event.attendance.find((item) => item.familyMemberId === memberId);
  if (attendance && (attendance.status === 'present' || attendance.status === 'late')) {
    items.push(activity({
      id: `family_events:attendance:${attendance.id}:${attendance.status === 'late' ? 'late' : 'attended'}`,
      type: attendance.status === 'late' ? 'event_late' : 'event_attended',
      sourceModule: 'family_events',
      sourceId: event.id,
      sourceSubId: attendance.id,
      occurredAt: attendance.confirmedAt,
      title: attendance.status === 'late' ? 'Arrived late for family event' : 'Attended family event',
      description: `${attendance.displayName} was marked ${attendance.status} for ${event.title}.`,
      metadata: eventMetadata(event, { attendanceStatus: attendance.status }),
    }));
  }

  if (event.organizerFamilyMemberId === memberId) {
    items.push(activity({
      id: `family_events:event:${event.id}:organized`,
      type: 'event_organized',
      sourceModule: 'family_events',
      sourceId: event.id,
      sourceSubId: null,
      occurredAt: event.startsAt,
      title: 'Organized family event',
      description: `${event.organizerDisplayName ?? 'Organizer'} organized ${event.title}.`,
      metadata: eventMetadata(event),
    }));
  }

  if ((response && response.response !== 'declined') || attendance || event.organizerFamilyMemberId === memberId) {
    if (event.status === 'completed') {
      items.push(activity({
        id: `family_events:event:${event.id}:completed:${memberId}`,
        type: 'event_completed',
        sourceModule: 'family_events',
        sourceId: event.id,
        sourceSubId: memberId,
        occurredAt: event.completedAt ?? event.endsAt ?? event.updatedAt,
        title: 'Family event completed',
        description: `${event.title} was completed.`,
        metadata: eventMetadata(event),
      }));
    }
  }

  return items;
}

function activity(input: MemberActivityItem): MemberActivityItem {
  return input;
}

function towerMetadata(defense: TowerDefenseRecord, extra: Record<string, unknown> = {}) {
  return {
    towerId: defense.tower.id,
    towerCode: defense.tower.towerCode,
    towerName: defense.tower.name,
    defenseTitle: defense.title,
    eventProjectionKey: defense.eventProjectionKey,
    ...extra,
  };
}

function questMetadata(quest: FamilyQuestRecord, extra: Record<string, unknown> = {}) {
  return {
    questTitle: quest.title,
    category: quest.category,
    reportId: quest.reportId,
    ...extra,
  };
}

function eventMetadata(event: FamilyEventRecord, extra: Record<string, unknown> = {}) {
  return {
    eventTitle: event.title,
    eventType: event.eventType,
    category: event.category,
    organizerFamilyMemberId: event.organizerFamilyMemberId,
    locationLabel: event.locationLabel,
    ...extra,
  };
}

function canViewOtherMember(auth: FamilyAuthContext): boolean {
  return auth.role === 'owner' || auth.permissions.includes('view_members');
}

export function canViewFinanceFor(auth: FamilyAuthContext): boolean {
  return auth.role === 'owner' || auth.rank >= 8 || hasPermission(auth, 'manage_accounting');
}

function hasPermission(auth: FamilyAuthContext, permission: FamilyPermission): boolean {
  return auth.permissions.includes(permission);
}

function compareActivityNewestFirst(left: MemberActivityItem, right: MemberActivityItem): number {
  return right.occurredAt.localeCompare(left.occurredAt) || right.id.localeCompare(left.id);
}

function encodeCursor(item: MemberActivityItem): string {
  return Buffer.from(JSON.stringify({ occurredAt: item.occurredAt, id: item.id }), 'utf8').toString('base64url');
}

function compareCursor(item: MemberActivityItem, cursor: string): number {
  const decoded = decodeCursor(cursor);
  if (!decoded) return -1;
  const byDate = item.occurredAt.localeCompare(decoded.occurredAt);
  return byDate || item.id.localeCompare(decoded.id);
}

function decodeCursor(cursor: string): { occurredAt: string; id: string } | null {
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    return typeof record.occurredAt === 'string' && typeof record.id === 'string'
      ? { occurredAt: record.occurredAt, id: record.id }
      : null;
  } catch {
    return null;
  }
}

export const MEMBER_ACTIVITY_SOURCE_MODULES = ['tower_defense', 'family_quests', 'family_events', 'achievements', 'rewards', 'accounting'] as const satisfies readonly MemberActivitySourceModule[];
export const MEMBER_ACTIVITY_TYPES = [
  'tower_defense_responded',
  'tower_defense_confirmed',
  'tower_defense_attended',
  'tower_defense_late',
  'tower_defense_commanded',
  'tower_defense_defended',
  'tower_defense_lost',
  'quest_joined',
  'quest_helped',
  'quest_completed',
  'quest_best_participant',
  'quest_reward_earned',
  'quest_paid',
  'event_joined',
  'event_confirmed',
  'event_attended',
  'event_late',
  'event_organized',
  'event_completed',
  'achievement_earned',
  'reward_earned',
  'reward_approved',
  'reward_received',
  'accounting_accrual',
  'accounting_payout',
] as const satisfies readonly MemberActivityType[];
