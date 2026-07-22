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

export type FamilyStatus = 'online' | 'offline' | 'away';
export type FamilyAccountStatus = 'active' | 'inactive';

export type RequirementType =
  | 'quests_total'
  | 'days_in_family'
  | 'surname_dragons'
  | 'marks_max'
  | 'capture_or_defense'
  | 'quests_organized'
  | 'recommendation'
  | 'weekly_activity_days'
  | 'brigade_lead_days'
  | 'new_members_trained'
  | 'clean_history'
  | 'manual_owner_decision'
  | 'manual_council_decision';

export type PromotionRequirement = {
  id: string;
  label: string;
  completed: boolean;
  completedAt?: string | null;
  type?: RequirementType;
  currentValue?: number | boolean | string | null;
  requiredValue?: number | boolean | string | null;
};

export type PromotionRequirements = {
  completed: PromotionRequirement[];
  remaining: PromotionRequirement[];
};

export type RankRequirement = {
  id: string;
  type: RequirementType;
  label: string;
  requiredValue?: number | boolean | string;
  verifierRankLevel?: number;
  verifierLabel?: string;
};

export type FamilyRank = {
  level: number;
  title: string;
  subtitle?: string;
  isFounderOnly?: boolean;
  isLeaderRank?: boolean;
  access?: string[];
};

export type RankProgression = {
  fromLevel: number;
  toLevel: number;
  title: string;
  requirements: RankRequirement[];
  notes?: string[];
};

export type MemberRankProgress = {
  currentRank: FamilyRank;
  nextRank: FamilyRank | null;
  progression: RankProgression | null;
  progressPercent: number;
  completedRequirements: PromotionRequirement[];
  remainingRequirements: PromotionRequirement[];
  nextStep: PromotionRequirement | null;
};

export type FamilyUserStats = {
  tasksDone: number;
  eventsJoined: number;
  weeklyActivity: number;
  contributionPoints: number;
  questsTotal: number;
  daysInFamily: number;
  marks: number;
  captureOrDefenseCount: number;
  questsOrganized: number;
  weeklyActivityDays: number;
  brigadeLeadDays: number;
  newMembersTrained: number;
};

export type FamilyTask = {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done' | 'rejected';
  priority: 'low' | 'normal' | 'high';
  assignedBy: string;
  assignedTo: string;
  source: 'manual' | 'buyers' | 'events' | 'map';
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FamilyBonusStatus = 'calculated' | 'pending_payout' | 'paid' | 'not_eligible';

export type FamilyAccountingAuditEntry = {
  id: string;
  actorId: string;
  action:
    | 'bonus_status_changed'
    | 'bonus_amount_changed'
    | 'bonus_comment_changed'
    | 'quest_payout_changed'
    | 'premium_rules_changed'
    | 'ledger_entry_created';
  entityType: 'bonus' | 'quest_payout' | 'premium_rules' | 'ledger_entry';
  entityId: string;
  field: string;
  before: string | number | null;
  after: string | number | null;
  createdAt: string;
};

export type FamilyPremiumRuleTier = {
  id: string;
  minMonthlyEarning: number;
  premiumAmount: number;
  title: string;
};

export type FamilyPremiumRules = {
  id: string;
  tiers: FamilyPremiumRuleTier[];
  updatedBy: string;
  updatedAt: string;
};

export type FamilyEditableContentBlock = {
  id: string;
  title: string;
  body: string;
  contact: string | null;
  updatedBy: string | null;
  updatedAt: string;
};

export type FamilyLedgerEntryType = 'income' | 'expense' | 'payout' | 'adjustment';

export type FamilyLedgerEntry = {
  id: string;
  amount: number;
  type: FamilyLedgerEntryType;
  title: string;
  comment: string | null;
  createdBy: string;
  createdAt: string;
  relatedEntityType: 'quest_report' | 'bonus' | 'manual' | 'accounting_period' | null;
  relatedEntityId: string | null;
};

export type FamilyBonus = {
  id: string;
  userId: string;
  month: number;
  year: number;
  amount: number | null;
  rewardLabel: string | null;
  reason: string;
  status: FamilyBonusStatus;
  approvedBy: string | null;
  paidBy: string | null;
  paidAt: string | null;
  comment: string | null;
  source?: 'manual' | 'quest_report' | 'premium';
  questReportId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FamilyAccountingMonth = {
  id: string;
  month: number;
  year: number;
  totalFund: number;
  bonuses: FamilyBonus[];
  questReports?: FamilyQuestReport[];
  auditTrail?: FamilyAccountingAuditEntry[];
  ledger?: FamilyLedgerEntry[];
  createdAt: string;
  updatedAt: string;
};

export type FamilyQuestCategory = 'Громадський' | 'Бізнес' | 'Бойовий';
export type FamilyQuestStatus =
  | 'draft'
  | 'recruiting'
  | 'scheduled'
  | 'active'
  | 'paused'
  | 'stopped'
  | 'completed'
  | 'reported'
  | 'sent_to_accounting'
  | 'paid'
  | 'cooldown'
  | 'closed'
  | 'in_progress'
  | 'submitted'
  | 'approved'
  | 'rejected';

export type FamilyQuestPayoutStatus = 'pending' | 'paid' | 'unpaid';
export type FamilyQuestRewardMode = 'equal' | 'percentage' | 'fixed' | 'mixed' | 'manual';
export type FamilyQuestParticipationType = 'participant' | 'helper';

export type FamilyQuestRewardItem = {
  id: string;
  title: string;
  quantity: number;
  status?: 'prepared' | 'issued';
  issuedAt?: string | null;
  issuedBy?: string | null;
};

export type FamilyQuestPayout = {
  userId: string;
  amount: number;
  status?: FamilyQuestPayoutStatus;
  paidBy?: string | null;
  paidAt?: string | null;
  rewardPercent?: number | null;
  rewardItems?: FamilyQuestRewardItem[];
  bonusAmount?: number;
  bonusPercent?: number;
  finalAmount?: number;
  payoutEventKey?: string;
};

export type FamilyQuestTemplate = {
  id: string;
  title: string;
  category: FamilyQuestCategory;
  recommendedTeamSize: number;
  rewardAmount: number | null;
  totalReward: number;
  memberRewardPool: number;
  familyBankShare: number;
  familyReward?: number;
  splitMode: FamilyQuestRewardMode;
  rewardMode?: FamilyQuestRewardMode;
  cooldownUntil: string | null;
  cooldownHours: number;
  rewardLabel: string;
  steps: string[];
  hint: string | null;
  route: string | null;
  items: string | null;
  requiredItems: string | null;
  imageUrl: string;
  imageAsset: string;
  imageSlot?: FamilyAssetSlot | null;
  isActive: boolean;
  createdBy: string;
  updatedAt: string;
};

export type FamilyQuestParticipant = {
  userId: string;
  nickname?: string;
  type?: FamilyQuestParticipationType;
  joinedAt: string;
  leftAt?: string | null;
  joinedLate?: boolean;
  participationNote?: string | null;
  addedManually?: boolean;
  addedBy?: string | null;
  rewardPercent?: number | null;
  rewardAmount?: number;
  rewardItems?: FamilyQuestRewardItem[];
  bonusAmount?: number;
  bonusPercent?: number;
  isBestParticipant?: boolean;
  bestParticipantReason?: string | null;
  payoutStatus?: FamilyQuestPayoutStatus;
  paidAt?: string | null;
  paidBy?: string | null;
  payoutEventKey?: string;
};

export type FamilyQuestAuditAction =
  | 'participant_added'
  | 'participant_removed'
  | 'helper_added'
  | 'moved_to_helper'
  | 'moved_to_participant'
  | 'recruiting_opened'
  | 'recruiting_closed'
  | 'scheduled'
  | 'started'
  | 'paused'
  | 'resumed'
  | 'stopped'
  | 'stopped_with_comment'
  | 'completed'
  | 'time_changed'
  | 'quest_edited'
  | 'reward_pool_changed'
  | 'payout_changed'
  | 'item_added'
  | 'best_participant_selected'
  | 'payout_issued'
  | 'issue_all_executed'
  | 'report_created'
  | 'report_sent_to_accounting'
  | 'reminder_sent';

export type FamilyQuestAuditEntry = {
  id: string;
  action: FamilyQuestAuditAction;
  actor: string;
  timestamp: string;
  comment: string | null;
  previousState?: FamilyQuestStatus | null;
  newState?: FamilyQuestStatus | null;
  relatedUserId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

export type FamilyDiscordQuestFields = {
  discordGuildId?: string | null;
  discordChannelId?: string | null;
  discordMessageId?: string | null;
  discordVoiceChannelId?: string | null;
  discordCreatedById?: string | null;
  discordSyncedAt?: string | null;
  syncSource?: 'family_hub' | 'discord' | 'manual';
  externalRevision?: string | null;
};

export type FamilyExternalSource = 'discord' | 'family_hub' | 'manual';
export type FamilySyncStatus = 'local_only' | 'pending' | 'synced' | 'conflict' | 'error';

export type FamilySyncMetadata = {
  externalSource?: FamilyExternalSource;
  externalId?: string | null;
  externalRevision?: string | null;
  externalCreatedAt?: string | null;
  externalUpdatedAt?: string | null;
  lastSyncedAt?: string | null;
  syncStatus?: FamilySyncStatus;
  syncError?: string | null;
};

export type DiscordConnectionStatus =
  | 'not_configured'
  | 'configured'
  | 'connecting'
  | 'connected'
  | 'error';

export type DiscordChannelPurpose =
  | 'welcome'
  | 'nickname_change'
  | 'family_history'
  | 'family_chat'
  | 'quant_news'
  | 'quest_info'
  | 'quest_announcement'
  | 'quest_payment'
  | 'accounting_log'
  | 'family_photos';

export type DiscordChannelPolicy = {
  channelId: string;
  purpose: DiscordChannelPurpose;
  importEnabled: boolean;
  publishEnabled: boolean;
  requiredPermission?: FamilyPermission | null;
  minimumRank?: number | null;
};

export type FamilyChatImportMode = 'disabled' | 'slash_command' | 'prefix' | 'role_mention';

export type DiscordFamilyConfig = {
  guildId: string | null;
  newsChannelId: string | null;
  urgentNewsChannelId: string | null;
  questsChannelId: string | null;
  questReportsChannelId: string | null;
  accountingChannelId: string | null;
  memberLogChannelId: string | null;
  welcomeChannelId: string | null;
  nicknameChangeChannelId: string | null;
  familyHistoryChannelId: string | null;
  familyChatChannelId: string | null;
  quantNewsChannelId: string | null;
  questInfoChannelId: string | null;
  questAnnouncementsChannelId: string | null;
  questPaymentsChannelId: string | null;
  familyPhotosChannelId: string | null;
  allowedChannelIds: string[];
  channelPolicies: DiscordChannelPolicy[];
  familyChatImportMode: FamilyChatImportMode;
  familyChatCommandName: string;
  familyChatPrefix: string;
  familyChatMentionRoleId: string | null;
  syncNews: boolean;
  syncUrgentNews: boolean;
  syncQuests: boolean;
  syncQuestReports: boolean;
  syncMembers: boolean;
  connectionStatus: DiscordConnectionStatus;
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
};

export type DiscordBackendConfig = {
  apiBaseUrl: string | null;
  discordClientId: string | null;
  oauthRedirectUrl: string | null;
};

export type DiscordAccountLink = {
  familyMemberId: string;
  discordUserId: string;
  discordUsername: string;
  discordGlobalName?: string | null;
  discordAvatarUrl?: string | null;
  guildMemberVerified: boolean;
  linkedAt: string;
  updatedAt: string;
};

export type DiscordOAuthState = {
  stateId: string;
  familyMemberId: string;
  createdAt: string;
  expiresAt: string;
  consumedAt?: string | null;
};

export type DiscordFamilySettings = {
  serverInviteUrl: string | null;
  family: DiscordFamilyConfig;
  backend: DiscordBackendConfig;
};

export type FamilyDiscordChannelConfig = {
  guildId: string | null;
  newsChannelId: string | null;
  questsChannelId: string | null;
  reportsChannelId: string | null;
  allowedChannelIds: string[];
  syncNews: boolean;
  syncQuests: boolean;
  syncReports: boolean;
};

export interface FamilyExternalIntegrationAdapter {
  importExternalQuest(): Promise<FamilyQuest | null>;
  syncQuestParticipants(quest: FamilyQuest): Promise<FamilyQuest>;
  syncQuestStatus(quest: FamilyQuest): Promise<FamilyQuest>;
  syncQuestRewards(quest: FamilyQuest): Promise<FamilyQuest>;
  importNewsPosts(): Promise<FamilyPost[]>;
  resolveDiscordUser(discordUserId: string): Promise<FamilyUser | null>;
}

export type DiscordFamilyIntegrationAdapter = FamilyExternalIntegrationAdapter;

export type ExternalFamilyNews = FamilySyncMetadata & {
  title: string;
  body: string;
  authorName: string | null;
  publishedAt: string | null;
  attachments?: string[];
  isImportant?: boolean;
  isUrgent?: boolean;
  isPinned?: boolean;
};

export type ExternalFamilyQuest = FamilyDiscordQuestFields & FamilySyncMetadata & {
  title: string;
  status: FamilyQuestStatus;
  participants: string[];
  helpers?: string[];
  rewardPool?: number | null;
};

export type ExternalQuestReport = FamilyDiscordQuestFields & FamilySyncMetadata & {
  questId: string;
  reportId: string;
  payouts: FamilyQuestPayout[];
  familyReward: number;
};

export type ExternalFamilyMember = FamilySyncMetadata & {
  nickname: string;
  discordUserId?: string | null;
  discordUsername?: string | null;
  role?: FamilyRole;
};

export type ExternalSyncResult = {
  ok: boolean;
  status: FamilySyncStatus | DiscordConnectionStatus;
  externalId?: string | null;
  externalRevision?: string | null;
  error?: string | null;
};

export interface DiscordFamilyIntegrationService {
  getConnectionStatus(): Promise<DiscordConnectionStatus>;
  beginUserLink(): Promise<{ authorizationUrl: string }>;
  unlinkCurrentUser(): Promise<void>;
  fetchNews(since?: string): Promise<ExternalFamilyNews[]>;
  fetchQuests(since?: string): Promise<ExternalFamilyQuest[]>;
  fetchQuestReports(since?: string): Promise<ExternalQuestReport[]>;
  fetchMembers(since?: string): Promise<ExternalFamilyMember[]>;
  publishFamilyNews(postId: string): Promise<ExternalSyncResult>;
  publishQuest(questId: string): Promise<ExternalSyncResult>;
  publishQuestReport(reportId: string): Promise<ExternalSyncResult>;
}

export type FamilyQuest = FamilyDiscordQuestFields & FamilySyncMetadata & {
  id: string;
  templateId: string | null;
  title: string;
  description: string;
  category: FamilyQuestCategory;
  scheduledAt?: string | null;
  recommendedTeamSize: number;
  maxTeamSize?: number;
  rewardAmount: number | null;
  totalReward: number;
  memberRewardPool: number;
  familyBankShare: number;
  familyReward?: number;
  splitMode: FamilyQuestRewardMode;
  rewardMode?: FamilyQuestRewardMode;
  rewardLabel: string;
  steps: string[];
  hint: string | null;
  route: string | null;
  items: string | null;
  requiredItems: string | null;
  imageUrl: string;
  organizer: string;
  participants: FamilyQuestParticipant[];
  helpers?: FamilyQuestParticipant[];
  totalAmount: number;
  payouts: FamilyQuestPayout[];
  status: FamilyQuestStatus;
  approvedBy: string | null;
  reportId?: string | null;
  reportSentToAccountingAt?: string | null;
  paidAt?: string | null;
  paidBy?: string | null;
  cooldownUntil?: string | null;
  cooldownHours?: number;
  auditTrail?: FamilyQuestAuditEntry[];
  createdAt: string;
  updatedAt: string;
};

export type FamilyQuestReport = FamilyDiscordQuestFields & FamilySyncMetadata & {
  id: string;
  questId: string;
  templateId: string | null;
  title: string;
  participants: string[];
  helpers?: string[];
  participation?: FamilyQuestParticipant[];
  totalAmount: number;
  totalReward: number;
  memberRewardPool: number;
  familyBankShare: number;
  familyReward?: number;
  splitMode: FamilyQuestRewardMode;
  rewardMode?: FamilyQuestRewardMode;
  payouts: FamilyQuestPayout[];
  confirmedBy: string;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  transferredToAccountingAt: string | null;
};

export type FamilyUser = FamilySyncMetadata & {
  /**
   * Immutable internal Family Hub member ID. Use this for auth, quests,
   * accounting, notifications and Discord links; nickname is editable.
   */
  id: string;
  nickname: string;
  staticId: string;
  passwordHash: string | null;
  mustChangePassword: boolean;
  role: FamilyRole;
  rank: string;
  rankLevel: number;
  promotionProgress: number;
  promotionRequirements: PromotionRequirements;
  lastActive: string | null;
  isOnline: boolean;
  displayName: string;
  avatarUrl: string | null;
  avatarDataUrl: string | null;
  status: FamilyStatus;
  accountStatus: FamilyAccountStatus;
  statusMessage: string | null;
  nextRank: string | null;
  promotionUpdatedAt: string | null;
  joinedAt: string | null;
  notes: string | null;
  permissions: FamilyPermission[];
  stats: FamilyUserStats;
  tasks: FamilyTask[];
  deletedAt?: string | null;
  discordUserId?: string | null;
  discordUsername?: string | null;
  discordDisplayName?: string | null;
  discordAvatarUrl?: string | null;
  discordLinkedAt?: string | null;
  discordSyncedAt?: string | null;
  discordLinkStatus?: 'not_linked' | 'pending' | 'linked' | 'error';
};

export type FamilyPostType =
  | 'urgent'
  | 'important'
  | 'family_news'
  | 'announcement'
  | 'recruitment'
  | 'poll'
  | 'family'
  | 'event'
  | 'info';

export type FamilyPostTarget = 'all' | 'role' | 'specificUsers';

export type FamilyPost = FamilySyncMetadata & {
  id: string;
  type: FamilyPostType;
  title: string;
  body: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  isPinned: boolean;
  target: FamilyPostTarget;
  targetRoles: FamilyRole[];
  targetUserIds: string[];
  serverName: string | null;
  isReadBy: string[];
  notificationRequired?: boolean;
};

export type FamilyNotificationType =
  | 'bonus_created'
  | 'bonus_paid'
  | 'bonus_status_changed'
  | 'quest_payout_updated'
  | 'quest_joined'
  | 'quest_reminder'
  | 'quest_reward_confirmed'
  | 'quest_report_accepted'
  | 'rank_changed'
  | 'role_changed'
  | 'permission_granted'
  | 'permission_revoked'
  | 'moderator_assigned';

export type FamilyNotificationRelatedEntityType =
  | 'accounting'
  | 'bonus'
  | 'quest'
  | 'quest_report'
  | 'member'
  | 'post';

export type FamilyNotification = {
  id: string;
  eventKey: string;
  userId: string;
  staticId: string;
  type: FamilyNotificationType;
  title: string;
  message: string;
  createdAt: string;
  readAt: string | null;
  relatedEntityType: FamilyNotificationRelatedEntityType | null;
  relatedEntityId: string | null;
};

export type FamilyEconomyCategory = 'fuel' | 'clothing' | 'weapons' | 'shops' | 'other';

export type FamilyEconomyEntry = {
  id: string;
  category: FamilyEconomyCategory;
  title: string;
  locationNumber: string | null;
  locationReference?: string | null;
  description: string;
  price: string | null;
  note: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
};

export type RecruitmentSettings = {
  isOpen: boolean;
  text: string;
  requirements: string[];
  contact: string;
  author: string;
  updatedAt: string;
};

export type FamilyMapZoneType = 'dragon_house' | 'ally' | 'neutral' | 'enemy' | 'server';
export type FamilyMapReferenceType = 'redux_update_rpf' | 'external_layer' | 'manual_notes';

export type FamilyMapZone = {
  id: string;
  name: string;
  owner: string;
  type: FamilyMapZoneType;
  color: string;
  polygon: Array<{ x: number; y: number }> | null;
  description: string;
  source: 'family' | 'server' | 'imported';
  updatedAt: string;
  updatedBy: string;
  isVisible: boolean;
};

export type FamilyMapReference = {
  id: string;
  title: string;
  version: string;
  date: string;
  fileDescription: string;
  url: string;
  type: FamilyMapReferenceType;
  status: 'active' | 'planned' | 'blocked';
  notes: string;
};

export type FamilyResource = {
  id: string;
  title: string;
  date: string;
  fileDescription: string;
  url: string;
  status: string;
  updatedBy?: string | null;
  updatedAt?: string | null;
};

export type FamilyAssetSlot =
  | 'dragon_house_logo'
  | 'header_logo'
  | 'family_hub_background'
  | 'login_background'
  | 'background_dragon'
  | 'quest_help_citizens'
  | 'quest_cleanup'
  | 'quest_hunting'
  | 'quest_forest_trophies'
  | 'quest_lumberjack'
  | 'quest_goods_explosion'
  | 'quest_fishing'
  | 'quest_guardians'
  | 'quest_blood_power'
  | 'quest_fuel_progress'
  | 'quest_mining';

export type FamilyAssetDefinition = {
  slot: FamilyAssetSlot;
  title: string;
  usedIn: string;
  defaultUrl: string;
};

export type FamilyCustomAsset = {
  slot: FamilyAssetSlot;
  blobKey: string;
  title: string;
  fileName: string;
  mimeType: string;
  size: number;
  updatedBy: string;
  updatedAt: string;
  dataUrl?: string;
};

export type ResourceCategory =
  | 'general'
  | 'crime'
  | 'captures_business'
  | 'government'
  | 'codes_laws'
  | 'statutes'
  | 'quant_news';

export type ResourceLink = {
  id: string;
  category: ResourceCategory;
  title: string;
  url: string;
  description: string;
  tags?: string[];
  source: string;
  isPinned: boolean;
  updatedAt: string;
};

export type QuantNewsItem = {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
  sourceUrl: string;
  sourceName: string;
};

export type QuantNewsAdapter = {
  sourceName: string;
  sourceUrl: string;
  status: 'planned' | 'disabled' | 'ready';
  loadLatest: () => Promise<QuantNewsItem[]>;
};

export type FamilyTab = 'cabinet' | 'family' | 'buyers' | 'events' | 'map' | 'resources';

export type FamilySection =
  | 'home'
  | 'feed'
  | 'economy'
  | 'members'
  | 'rules'
  | 'ranks'
  | 'recruitment'
  | 'quests'
  | 'accounting'
  | 'management';
