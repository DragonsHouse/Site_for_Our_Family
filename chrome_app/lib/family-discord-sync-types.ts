import type { FamilyPermission, FamilyRole } from './family-types';

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

export type DiscordRoleSnapshot = {
  discordRoleId: string;
  discordRoleName: string;
  mappedFamilyRole: FamilyRole | null;
  rank: number | null;
  permissions: FamilyPermission[];
  priority: number;
  enabled: boolean;
  mappingType: 'primary_hierarchy' | 'additional_functional' | 'ignored';
};

export type DiscordSyncConflict = {
  type: string;
  message: string;
  blocking: boolean;
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

export type DiscordSyncPlanItem = {
  id: string;
  action: DiscordSyncPlanAction;
  legacyAction: string;
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
  matchedFamilyMember: {
    id: string;
    nickname: string;
    staticId: string | null;
    role: FamilyRole;
    rank: number;
    status: 'active' | 'inactive';
    discordUserId?: string | null;
  } | null;
  match: {
    method: DiscordSyncMatchMethod;
    familyMemberId: string | null;
    confidence: 'exact' | 'suggested' | 'none';
    reason: string;
  };
  currentValues: Record<string, unknown>;
  incomingValues: Record<string, unknown>;
  proposedFieldChanges: Array<{ field: string; current: unknown; proposed: unknown }>;
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

export type DiscordSyncPlan = {
  planId: string;
  guildId: string;
  generatedAt: string;
  expiresAt: string;
  snapshotFingerprint: string;
  summary: DiscordSyncSummary;
  items: DiscordSyncPlanItem[];
  warnings: string[];
  conflicts: DiscordSyncConflict[];
  missingRoleMappings: string[];
  source: 'live-discord' | 'mock';
  stale: boolean;
  applied: boolean;
};

export type DiscordSyncApplyResult = {
  syncRunId: string;
  planId: string;
  guildId: string;
  appliedAt: string;
  status: 'succeeded' | 'failed';
  summary: Record<string, number>;
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
  counts: Record<string, number>;
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

export type DiscordSyncPlanFilter = DiscordSyncPlanAction | 'all' | 'safe' | 'blocked';

export type DiscordTowerDefenseRosterMetadata = {
  memberId: string;
  discordLinked: boolean;
  guildMembershipActive: boolean;
  futurePresenceState: 'not-implemented';
  fireGuardRoleMappingIds: string[];
};
