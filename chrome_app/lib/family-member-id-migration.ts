import { createFamilyMemberId } from './family-auth';
import type {
  FamilyAccountingMonth,
  FamilyBonus,
  FamilyNotification,
  FamilyQuest,
  FamilyQuestAuditEntry,
  FamilyQuestParticipant,
  FamilyQuestPayout,
  FamilyQuestReport,
  FamilyUser
} from './family-types';

export type FamilyMemberIdMigrationReport = {
  users: number;
  generatedMemberIds: number;
  questReferences: number;
  accountingReferences: number;
  notificationReferences: number;
  unresolvedReferences: Array<{ area: string; value: string; path: string }>;
  ambiguousReferences: Array<{ nickname: string; memberIds: string[] }>;
  nicknameToFamilyMemberId: Record<string, string>;
  canApply: boolean;
};

export type FamilyMemberIdMigrationInput = {
  users: FamilyUser[];
  quests?: FamilyQuest[];
  questReports?: FamilyQuestReport[];
  accountingMonths?: FamilyAccountingMonth[];
  notifications?: FamilyNotification[];
};

export type FamilyMemberIdMigrationDraft = {
  users: FamilyUser[];
  quests: FamilyQuest[];
  questReports: FamilyQuestReport[];
  accountingMonths: FamilyAccountingMonth[];
  notifications: FamilyNotification[];
  report: FamilyMemberIdMigrationReport;
};

type MigrationCounter = 'questReferences' | 'accountingReferences' | 'notificationReferences';

function normalizeNickname(value: string) {
  return value.trim().toLowerCase();
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function buildUserMapping(users: FamilyUser[]) {
  const nextUsers: FamilyUser[] = [];
  const nicknameToIds = new Map<string, Set<string>>();
  const nicknameToFamilyMemberId: Record<string, string> = {};
  let generatedMemberIds = 0;

  for (const user of users) {
    const id = typeof user.id === 'string' && user.id.trim() ? user.id : createFamilyMemberId();
    if (id !== user.id) generatedMemberIds += 1;
    const nextUser = { ...user, id };
    const normalizedNickname = normalizeNickname(nextUser.nickname);
    const ids = nicknameToIds.get(normalizedNickname) ?? new Set<string>();
    ids.add(id);
    nicknameToIds.set(normalizedNickname, ids);
    nicknameToFamilyMemberId[nextUser.nickname] = id;
    nextUsers.push(nextUser);
  }

  const ambiguousReferences = Array.from(nicknameToIds.entries())
    .filter(([, ids]) => ids.size > 1)
    .map(([nickname, ids]) => ({ nickname, memberIds: Array.from(ids) }));

  return { users: nextUsers, generatedMemberIds, nicknameToIds, nicknameToFamilyMemberId, ambiguousReferences };
}

function resolveReference(
  value: string | null | undefined,
  path: string,
  area: string,
  counter: MigrationCounter,
  context: {
    memberIds: Set<string>;
    nicknameToIds: Map<string, Set<string>>;
    report: FamilyMemberIdMigrationReport;
  }
) {
  if (!value) return value ?? null;
  if (context.memberIds.has(value) || isUuidLike(value)) return value;

  const candidates = context.nicknameToIds.get(normalizeNickname(value));
  context.report[counter] += 1;
  if (!candidates || candidates.size === 0) {
    context.report.unresolvedReferences.push({ area, value, path });
    return value;
  }
  if (candidates.size > 1) {
    context.report.ambiguousReferences.push({ nickname: value, memberIds: Array.from(candidates) });
    return value;
  }
  return Array.from(candidates)[0];
}

function migrateParticipant(
  participant: FamilyQuestParticipant,
  path: string,
  context: Parameters<typeof resolveReference>[4]
): FamilyQuestParticipant {
  return {
    ...participant,
    userId: resolveReference(participant.userId, `${path}.userId`, 'quest', 'questReferences', context) ?? participant.userId,
    addedBy: resolveReference(participant.addedBy, `${path}.addedBy`, 'quest', 'questReferences', context),
    paidBy: resolveReference(participant.paidBy, `${path}.paidBy`, 'quest', 'questReferences', context)
  };
}

function migratePayout(
  payout: FamilyQuestPayout,
  path: string,
  context: Parameters<typeof resolveReference>[4]
): FamilyQuestPayout {
  return {
    ...payout,
    userId: resolveReference(payout.userId, `${path}.userId`, 'quest', 'questReferences', context) ?? payout.userId,
    paidBy: resolveReference(payout.paidBy, `${path}.paidBy`, 'quest', 'questReferences', context)
  };
}

function migrateAudit(
  entry: FamilyQuestAuditEntry,
  path: string,
  context: Parameters<typeof resolveReference>[4]
): FamilyQuestAuditEntry {
  return {
    ...entry,
    actor: resolveReference(entry.actor, `${path}.actor`, 'quest', 'questReferences', context) ?? entry.actor,
    relatedUserId: resolveReference(entry.relatedUserId, `${path}.relatedUserId`, 'quest', 'questReferences', context)
  };
}

function migrateBonus(
  bonus: FamilyBonus,
  path: string,
  context: Parameters<typeof resolveReference>[4]
): FamilyBonus {
  return {
    ...bonus,
    userId: resolveReference(bonus.userId, `${path}.userId`, 'accounting', 'accountingReferences', context) ?? bonus.userId,
    approvedBy: resolveReference(bonus.approvedBy, `${path}.approvedBy`, 'accounting', 'accountingReferences', context),
    paidBy: resolveReference(bonus.paidBy, `${path}.paidBy`, 'accounting', 'accountingReferences', context)
  };
}

export function createFamilyMemberIdMigrationDraft(input: FamilyMemberIdMigrationInput): FamilyMemberIdMigrationDraft {
  const mapping = buildUserMapping(input.users);
  const memberIds = new Set(mapping.users.map((user) => user.id));
  const report: FamilyMemberIdMigrationReport = {
    users: mapping.users.length,
    generatedMemberIds: mapping.generatedMemberIds,
    questReferences: 0,
    accountingReferences: 0,
    notificationReferences: 0,
    unresolvedReferences: [],
    ambiguousReferences: [...mapping.ambiguousReferences],
    nicknameToFamilyMemberId: mapping.nicknameToFamilyMemberId,
    canApply: false
  };
  const context = { memberIds, nicknameToIds: mapping.nicknameToIds, report };

  const quests = (input.quests ?? []).map((quest, questIndex) => ({
    ...quest,
    organizer: resolveReference(quest.organizer, `quests[${questIndex}].organizer`, 'quest', 'questReferences', context) ?? quest.organizer,
    approvedBy: resolveReference(quest.approvedBy, `quests[${questIndex}].approvedBy`, 'quest', 'questReferences', context),
    participants: quest.participants.map((person, index) => migrateParticipant(person, `quests[${questIndex}].participants[${index}]`, context)),
    helpers: (quest.helpers ?? []).map((person, index) => migrateParticipant(person, `quests[${questIndex}].helpers[${index}]`, context)),
    payouts: quest.payouts.map((payout, index) => migratePayout(payout, `quests[${questIndex}].payouts[${index}]`, context)),
    auditTrail: (quest.auditTrail ?? []).map((entry, index) => migrateAudit(entry, `quests[${questIndex}].auditTrail[${index}]`, context))
  }));

  const questReports = (input.questReports ?? []).map((reportItem, reportIndex) => ({
    ...reportItem,
    confirmedBy:
      resolveReference(reportItem.confirmedBy, `questReports[${reportIndex}].confirmedBy`, 'quest', 'questReferences', context) ??
      reportItem.confirmedBy,
    participants: reportItem.participants.map(
      (userId, index) =>
        resolveReference(userId, `questReports[${reportIndex}].participants[${index}]`, 'quest', 'questReferences', context) ?? userId
    ),
    helpers: (reportItem.helpers ?? []).map(
      (userId, index) =>
        resolveReference(userId, `questReports[${reportIndex}].helpers[${index}]`, 'quest', 'questReferences', context) ?? userId
    ),
    payouts: reportItem.payouts.map((payout, index) => migratePayout(payout, `questReports[${reportIndex}].payouts[${index}]`, context))
  }));

  const accountingMonths = (input.accountingMonths ?? []).map((month, monthIndex) => ({
    ...month,
    bonuses: month.bonuses.map((bonus, index) => migrateBonus(bonus, `accountingMonths[${monthIndex}].bonuses[${index}]`, context)),
    auditTrail: (month.auditTrail ?? []).map((entry, index) => ({
      ...entry,
      actorId:
        resolveReference(entry.actorId, `accountingMonths[${monthIndex}].auditTrail[${index}].actorId`, 'accounting', 'accountingReferences', context) ??
        entry.actorId
    })),
    questReports: (month.questReports ?? []).map((reportItem, index) => ({
      ...reportItem,
      participants: reportItem.participants.map(
        (userId, userIndex) =>
          resolveReference(userId, `accountingMonths[${monthIndex}].questReports[${index}].participants[${userIndex}]`, 'accounting', 'accountingReferences', context) ??
          userId
      ),
      helpers: (reportItem.helpers ?? []).map(
        (userId, userIndex) =>
          resolveReference(userId, `accountingMonths[${monthIndex}].questReports[${index}].helpers[${userIndex}]`, 'accounting', 'accountingReferences', context) ??
          userId
      ),
      payouts: reportItem.payouts.map((payout, payoutIndex) =>
        migratePayout(payout, `accountingMonths[${monthIndex}].questReports[${index}].payouts[${payoutIndex}]`, context)
      )
    }))
  }));

  const notifications = (input.notifications ?? []).map((notification, index) => ({
    ...notification,
    userId:
      resolveReference(notification.userId, `notifications[${index}].userId`, 'notification', 'notificationReferences', context) ??
      notification.userId
  }));

  report.canApply = report.unresolvedReferences.length === 0 && report.ambiguousReferences.length === 0;

  return {
    users: mapping.users,
    quests,
    questReports,
    accountingMonths,
    notifications,
    report
  };
}
