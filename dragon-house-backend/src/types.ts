export type DiscordConnectionStatus = 'not_configured' | 'configured' | 'connecting' | 'connected' | 'error';

export type FamilyRole = 'owner' | 'deputy' | 'moderator' | 'member';

export type FamilyPermission =
  | 'manage_users'
  | 'view_members'
  | 'manage_members'
  | 'manage_member_roles'
  | 'manage_member_auth'
  | 'delete_members'
  | 'restore_members'
  | 'view_member_private_fields'
  | 'manage_tasks'
  | 'manage_ranks'
  | 'view_private_notes'
  | 'manage_family_map'
  | 'manage_events'
  | 'manage_buyers'
  | 'manage_family_posts'
  | 'manage_family_news'
  | 'manage_news'
  | 'view_family_history'
  | 'manage_family_economy'
  | 'manage_family_quests'
  | 'manage_family_assets'
  | 'manage_discord_integration'
  | 'manage_backups'
  | 'manage_accounting'
  | 'manage_treasury'
  | 'manage_recruitment'
  | 'manage_resources'
  | 'manage_roles';

export type FamilyMember = {
  id: string;
  nickname: string;
  staticId: string | null;
  role: FamilyRole;
  rank: number;
  status: FamilyMemberStatus;
  avatarAssetId: string | null;
  notes: string | null;
  joinedAt: string | null;
  permissions: FamilyPermission[];
  permissionsOverride: FamilyPermission[];
  permissionsDiscord: FamilyPermission[];
  permissionsDenied: FamilyPermission[];
  onboardingMetadata: Record<string, unknown>;
  profileMetadata: Record<string, unknown>;
  deletedAt: string | null;
  version: number;
  createdByFamilyMemberId: string | null;
  updatedByFamilyMemberId: string | null;
  createdAt: string;
  updatedAt: string;
  discord?: {
    linked: boolean;
    discordUserId?: string;
    discordUsername?: string;
    discordGlobalName?: string | null;
    discordServerNickname?: string | null;
    discordAvatar?: string | null;
    guildId?: string | null;
    joinedAt?: string | null;
    leftAt?: string | null;
    lastSyncedAt?: string | null;
    verified?: boolean;
    linkedAt?: string;
  };
};

export type FamilyMemberStatus = 'active' | 'inactive';

export type CreateFamilyMemberInput = {
  nickname: string;
  staticId?: string | null;
  role: FamilyRole;
  rank: number;
  status?: FamilyMemberStatus;
  avatarAssetId?: string | null;
  notes?: string | null;
  joinedAt?: string | null;
  permissions?: FamilyPermission[];
  permissionsOverride?: FamilyPermission[];
  permissionsDiscord?: FamilyPermission[];
  permissionsDenied?: FamilyPermission[];
  onboardingMetadata?: Record<string, unknown>;
  profileMetadata?: Record<string, unknown>;
};

export type UpdateFamilyMemberInput = Partial<CreateFamilyMemberInput>;

export type FamilyMemberListQuery = {
  page: number;
  pageSize: number;
  search?: string | null;
  status?: FamilyMemberStatus | 'all' | null;
  role?: FamilyRole | 'all' | null;
  rank?: number | null;
  sortBy: 'nickname' | 'staticId' | 'role' | 'rank' | 'status' | 'joinedAt' | 'createdAt' | 'updatedAt';
  sortOrder: 'asc' | 'desc';
  includeDeleted: boolean;
};

export type FamilyMemberListResult = {
  items: FamilyMember[];
  page: number;
  pageSize: number;
  total: number;
};

export type FamilyAuthUser = {
  /**
   * Immutable FamilyMember.id. It must never be derived from nickname, login,
   * static ID, Discord user ID, or any editable external identity.
   */
  familyMemberId: string;
  login: string;
  staticId: string;
  passwordHash: string;
  isActive: boolean;
  mustChangePassword: boolean;
  role: FamilyRole;
  rank: number;
  permissions: FamilyPermission[];
  createdAt: string;
  updatedAt: string;
};

export type FamilySession = {
  sessionId: string;
  familyMemberId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string;
  revokedAt?: string | null;
};

export type FamilyAuthContext = {
  familyMemberId: string;
  role: FamilyRole;
  rank: number;
  permissions: FamilyPermission[];
};

export type SanitizedFamilyAuthUser = {
  familyMemberId: string;
  login: string;
  staticId: string;
  role: FamilyRole;
  rank: number;
  permissions: FamilyPermission[];
  mustChangePassword: boolean;
};

export type FamilyAuthErrorCode =
  | 'invalid_credentials'
  | 'account_disabled'
  | 'session_required'
  | 'session_invalid'
  | 'session_expired'
  | 'password_change_required'
  | 'current_password_invalid'
  | 'password_too_weak'
  | 'login_rate_limited'
  | 'database_unavailable';

export type PublicDiscordConfig = {
  clientId: string | null;
  redirectUri: string | null;
  guildConfigured: boolean;
  configuredChannelNames: string[];
  configuredChannelPurposes: string[];
  connectionStatus: DiscordConnectionStatus;
};

export type DiscordStatusResponse = {
  status: DiscordConnectionStatus;
  lastConnectedAt: string | null;
  lastError: string | null;
};

export type HealthResponse = {
  status: 'ok';
  serverTime: string;
  databaseConfigured?: boolean;
  databaseConnected?: boolean;
  discordConfigured: boolean;
  discordConnected: boolean;
  version: string;
};

export type ExternalFamilyNews = {
  externalId: string;
  title: string;
  body: string;
  authorName: string | null;
  publishedAt: string | null;
};

export type ExternalFamilyQuest = {
  externalId: string;
  title: string;
  status: string;
  participants: string[];
  helpers: string[];
};

export type ExternalSyncResult = {
  ok: boolean;
  externalId: string | null;
  error: string | null;
};

export type DiscordAccountLink = {
  familyMemberId: string;
  discordUserId: string;
  discordUsername: string;
  discordGlobalName?: string | null;
  discordServerNickname?: string | null;
  discordAvatar?: string | null;
  discordAvatarUrl?: string | null;
  guildId?: string | null;
  joinedAt?: string | null;
  leftAt?: string | null;
  lastSyncedAt?: string | null;
  verified?: boolean;
  guildMemberVerified: boolean;
  linkedAt: string;
  updatedAt: string;
};

export type DiscordRoleMapping = {
  discordRoleId: string;
  discordRoleName: string;
  mappingType: DiscordRoleMappingType;
  familyRole: FamilyRole | null;
  rank: number | null;
  permissions: FamilyPermission[];
  priority: number;
  grantsPermissions: boolean;
  metadata: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DiscordRoleMappingType = 'primary_hierarchy' | 'additional_functional' | 'ignored';

export type NormalizedDiscordGuildMember = {
  discordUserId: string;
  username: string;
  globalName: string | null;
  serverNickname: string | null;
  avatarUrl: string | null;
  guildId: string;
  roleIds: string[];
  joinedAt: string | null;
  bot: boolean;
};

export type DiscordMemberSyncAction =
  | 'create'
  | 'update'
  | 'unchanged'
  | 'deactivate_candidate'
  | 'conflict'
  | 'ignored_bot';

export type DiscordMemberSyncChange = {
  field: string;
  current: unknown;
  proposed: unknown;
};

export type DiscordMemberSyncProposedRole = {
  discordRoleId: string;
  discordRoleName: string;
  familyRole: FamilyRole;
  rank: number;
  permissions: FamilyPermission[];
  priority: number;
};

export type DiscordMemberSyncAdditionalRole = {
  discordRoleId: string;
  discordRoleName: string;
  permissions: FamilyPermission[];
  priority: number;
};

export type DiscordMemberSyncIgnoredRole = {
  discordRoleId: string;
  discordRoleName: string;
};

export type DiscordMemberSyncDryRunItem = {
  action: DiscordMemberSyncAction;
  reason: string;
  discordMember?: NormalizedDiscordGuildMember;
  familyMember?: Pick<
    FamilyMember,
    'id' | 'nickname' | 'staticId' | 'role' | 'rank' | 'status' | 'permissions' | 'deletedAt'
  > & {
    discordUserId?: string | null;
  };
  matchedBy: 'discord_user_id' | 'none' | 'not_applicable';
  /** @deprecated Use primaryRank. Kept temporarily for existing dry-run consumers. */
  proposedRole?: DiscordMemberSyncProposedRole;
  primaryRank?: DiscordMemberSyncProposedRole;
  promotionRank?: number;
  primaryDiscordRoleId?: string;
  primaryDiscordRoleName?: string;
  additionalRoles: DiscordMemberSyncAdditionalRole[];
  effectivePermissions: FamilyPermission[];
  matchedIgnoredRoles: DiscordMemberSyncIgnoredRole[];
  permissionSources: DiscordMemberSyncPermissionSources;
  changes: DiscordMemberSyncChange[];
  warnings: string[];
  possibleManualLinkFamilyMemberIds: string[];
};

export type DiscordMemberSyncPermissionSources = {
  systemRolePermissions: FamilyPermission[];
  discordMappedPermissions: FamilyPermission[];
  manualGrantedPermissions: FamilyPermission[];
  manualDeniedPermissions: FamilyPermission[];
  protectedPermissions: FamilyPermission[];
};

export type DiscordMemberSyncDryRunSummary = Record<DiscordMemberSyncAction, number>;

export type DiscordMemberSyncDryRunResult = {
  planId: string;
  generatedAt: string;
  planExpiresAt: string;
  planHash: string;
  guildId: string;
  discordMemberCount: number;
  familyMemberCount: number;
  summary: DiscordMemberSyncDryRunSummary;
  actions: DiscordMemberSyncDryRunItem[];
  warnings: string[];
  conflicts: string[];
  missingRoleMappings: string[];
};

export type DiscordOAuthState = {
  stateId: string;
  familyMemberId: string;
  createdAt: string;
  expiresAt: string;
  consumedAt?: string | null;
};

export type DiscordAccountLinkErrorCode =
  | 'discord_oauth_not_configured'
  | 'discord_oauth_state_invalid'
  | 'discord_oauth_state_expired'
  | 'discord_oauth_state_consumed'
  | 'discord_oauth_denied'
  | 'discord_token_exchange_failed'
  | 'discord_user_fetch_failed'
  | 'discord_guild_membership_required'
  | 'discord_account_already_linked'
  | 'discord_account_linked_elsewhere'
  | 'family_auth_required';
