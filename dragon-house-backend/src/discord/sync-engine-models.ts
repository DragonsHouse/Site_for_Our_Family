import type {
  DiscordMemberSyncAction,
  DiscordMemberSyncChange,
  DiscordMemberSyncDryRunItem,
  DiscordMemberSyncDryRunResult,
  DiscordRoleMapping,
  FamilyPermission,
  FamilyRole,
  NormalizedDiscordGuildMember,
} from '../types.js';
import type { DiscordMemberSyncApplyResult } from './member-sync-apply-service.js';

export type DiscordSyncPlanAction =
  | 'create'
  | 'update'
  | 'unchanged'
  | 'deactivate'
  | 'conflict'
  | 'ignored-bot'
  | 'ignored-unmapped'
  | 'error';

export type DiscordSyncMatchMethod =
  | 'account-link'
  | 'stored-discord-id'
  | 'static-id'
  | 'nickname-suggestion'
  | 'none'
  | 'not-applicable';

export type DiscordSyncConflictType =
  | 'no-safe-member-match'
  | 'multiple-possible-matches'
  | 'discord-account-linked-to-another-member'
  | 'member-linked-to-another-discord-account'
  | 'static-id-mismatch'
  | 'duplicate-static-id'
  | 'invalid-nickname-format'
  | 'role-mapping-ambiguity'
  | 'missing-required-mapping'
  | 'protected-internal-field-mismatch'
  | 'stale-plan'
  | 'discord-snapshot-changed'
  | 'blocking-warning'
  | 'backend-error';

export type DiscordGuildSnapshot = {
  guildId: string;
  memberCount: number;
  humanMemberCount: number;
  botCount: number;
  fingerprint: string;
  capturedAt: string;
};

export type DiscordGuildMemberSnapshot = NormalizedDiscordGuildMember;

export type DiscordRoleSnapshot = {
  discordRoleId: string;
  discordRoleName: string;
  mappedFamilyRole: FamilyRole | null;
  rank: number | null;
  permissions: FamilyPermission[];
  priority: number;
  enabled: boolean;
  mappingType: DiscordRoleMapping['mappingType'];
};

export type DiscordMemberMatch = {
  method: DiscordSyncMatchMethod;
  familyMemberId: string | null;
  confidence: 'exact' | 'suggested' | 'none';
  reason: string;
};

export type DiscordSyncConflict = {
  type: DiscordSyncConflictType;
  message: string;
  blocking: boolean;
};

export type DiscordSyncPlanItem = {
  id: string;
  action: DiscordSyncPlanAction;
  legacyAction: DiscordMemberSyncAction;
  reason: string;
  discordUserId: string | null;
  discordIdentity: {
    username: string | null;
    globalName: string | null;
    serverNickname: string | null;
    avatarUrl: string | null;
    bot: boolean;
  };
  matchedFamilyMemberId: string | null;
  matchedFamilyMember: DiscordMemberSyncDryRunItem['familyMember'] | null;
  match: DiscordMemberMatch;
  currentValues: Record<string, unknown>;
  incomingValues: Record<string, unknown>;
  proposedFieldChanges: DiscordMemberSyncChange[];
  mappedRoles: {
    primary: DiscordRoleSnapshot | null;
    additional: DiscordRoleSnapshot[];
    ignored: Array<Pick<DiscordRoleSnapshot, 'discordRoleId' | 'discordRoleName'>>;
  };
  warnings: string[];
  conflicts: DiscordSyncConflict[];
  blocking: boolean;
  safeToApply: boolean;
  possibleManualLinkFamilyMemberIds: string[];
};

export type DiscordSyncSummary = {
  total: number;
  create: number;
  update: number;
  unchanged: number;
  deactivate: number;
  conflict: number;
  ignoredBot: number;
  ignoredUnmapped: number;
  error: number;
  safeToApply: number;
  blocked: number;
  discordMembers: number;
  humanMembers: number;
  familyMembers: number;
};

export type DiscordSyncPlan = {
  planId: string;
  guildId: string;
  generatedAt: string;
  expiresAt: string;
  snapshotFingerprint: string;
  snapshot: DiscordGuildSnapshot;
  summary: DiscordSyncSummary;
  items: DiscordSyncPlanItem[];
  warnings: string[];
  conflicts: DiscordSyncConflict[];
  missingRoleMappings: string[];
  source: 'live-discord' | 'mock';
  stale: boolean;
  applied: boolean;
  rawDryRun: DiscordMemberSyncDryRunResult;
};

export type DiscordSyncApplyResult = {
  syncRunId: string;
  planId: string;
  guildId: string;
  appliedAt: string;
  status: 'succeeded' | 'failed';
  summary: DiscordMemberSyncApplyResult['summary'];
  created: string[];
  updated: string[];
  deactivated: string[];
  reactivated: string[];
  skipped: string[];
  conflicts: string[];
  warnings: string[];
  errors: string[];
  auditEntries: number;
};

export type DiscordSyncAuditRecord = {
  auditId: string;
  planId: string | null;
  guildId: string | null;
  initiatedByMemberId: string | null;
  startedAt: string;
  completedAt: string | null;
  mode: 'dry-run' | 'apply';
  status: 'succeeded' | 'failed';
  counts: Partial<DiscordSyncSummary> | Record<string, number>;
  conflicts: unknown[];
  appliedCreates: number;
  appliedUpdates: number;
  appliedDeactivations: number;
  skippedItems: number;
  failures: number;
  snapshotMetadata: Record<string, unknown>;
  applicationStatus: string;
  errorSummary: string | null;
};

export type DiscordSyncIntegrationStatus = {
  guildConfigured: boolean;
  guildId: string | null;
  guildName: string | null;
  botConfigured: boolean;
  botAccessStatus: 'not-configured' | 'configured' | 'unavailable';
  liveData: boolean;
  lastSuccessfulSynchronizationAt: string | null;
  linkedMemberCount: number | null;
  roleMappingCount: number;
  planTtlSeconds: number;
};

export type DiscordTowerDefenseRosterMetadata = {
  memberId: string;
  discordLinked: boolean;
  guildMembershipActive: boolean;
  futurePresenceState: 'not-implemented';
  fireGuardRoleMappingIds: string[];
};
