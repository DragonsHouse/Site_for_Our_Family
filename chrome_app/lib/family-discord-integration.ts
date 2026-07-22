import type {
  DiscordBackendConfig,
  DiscordChannelPolicy,
  DiscordChannelPurpose,
  DiscordConnectionStatus,
  DiscordFamilyConfig,
  DiscordFamilyIntegrationService,
  DiscordFamilySettings,
  FamilyChatImportMode,
  ExternalFamilyMember,
  ExternalFamilyNews,
  ExternalFamilyQuest,
  ExternalQuestReport,
  ExternalSyncResult
} from './family-types';

const DISCORD_SETTINGS_KEY = 'dragon_house_discord_family_settings_v1';

export type DiscordChannelField =
  | 'welcomeChannelId'
  | 'nicknameChangeChannelId'
  | 'familyHistoryChannelId'
  | 'familyChatChannelId'
  | 'quantNewsChannelId'
  | 'questInfoChannelId'
  | 'questAnnouncementsChannelId'
  | 'questPaymentsChannelId'
  | 'accountingChannelId'
  | 'familyPhotosChannelId';

export type DiscordChannelDefinition = {
  field: DiscordChannelField;
  purpose: DiscordChannelPurpose;
  group: 'Новачки' | 'Сім’я' | 'Новини' | 'Квести' | 'Економіка' | 'Галерея';
  label: string;
  description: string;
  requiredPermission?: DiscordChannelPolicy['requiredPermission'];
  minimumRank?: number | null;
};

export const DISCORD_CHANNEL_DEFINITIONS: DiscordChannelDefinition[] = [
  {
    field: 'welcomeChannelId',
    purpose: 'welcome',
    group: 'Новачки',
    label: 'Welcome',
    description: 'Майбутнє джерело подій вступу нового учасника.'
  },
  {
    field: 'nicknameChangeChannelId',
    purpose: 'nickname_change',
    group: 'Новачки',
    label: 'Зміна ніку',
    description: 'Майбутній журнал або заявки зміни nickname; автоматично nickname не змінюється.'
  },
  {
    field: 'familyHistoryChannelId',
    purpose: 'family_history',
    group: 'Сім’я',
    label: 'Історія сім’ї',
    description: 'Видима тільки owner, rank 8+ або permission view_family_history.',
    requiredPermission: 'view_family_history',
    minimumRank: 8
  },
  {
    field: 'familyChatChannelId',
    purpose: 'family_chat',
    group: 'Сім’я',
    label: 'Сімейний чат',
    description: 'Не переносить весь чат; у майбутньому імпортуються тільки повідомлення за filter rule.'
  },
  {
    field: 'quantNewsChannelId',
    purpose: 'quant_news',
    group: 'Новини',
    label: 'Новини Кванту',
    description: 'Майбутнє джерело external QuantRP news з явною позначкою Discord source.'
  },
  {
    field: 'questInfoChannelId',
    purpose: 'quest_info',
    group: 'Квести',
    label: 'Про квести',
    description: 'Майбутнє джерело довідкових описів квестів, не фінансових даних.'
  },
  {
    field: 'questAnnouncementsChannelId',
    purpose: 'quest_announcement',
    group: 'Квести',
    label: 'Анонси квестів',
    description: 'Майбутнє джерело анонсів і стартів із deduplication через message ID/revision.'
  },
  {
    field: 'questPaymentsChannelId',
    purpose: 'quest_payment',
    group: 'Квести',
    label: 'Оплата за квести',
    description: 'Discord text не змінює payout/family capital без backend validation та permission.'
  },
  {
    field: 'accountingChannelId',
    purpose: 'accounting_log',
    group: 'Економіка',
    label: 'Скарбниця / облік',
    description: 'Майбутній external log; source of truth лишається accounting repository/backend.'
  },
  {
    field: 'familyPhotosChannelId',
    purpose: 'family_photos',
    group: 'Галерея',
    label: 'Фотки сім’ї',
    description: 'Майбутнє джерело gallery attachments; великі зображення не зберігаються в localStorage.'
  }
];

export const DRAGON_HOUSE_DISCORD_CHANNEL_IDS: Record<DiscordChannelField, string> = {
  welcomeChannelId: '1442225758658363514',
  nicknameChangeChannelId: '1474807016357892198',
  familyHistoryChannelId: '1475234913321222338',
  familyChatChannelId: '1518317112962191400',
  quantNewsChannelId: '1326197223557697637',
  questInfoChannelId: '1513241870409531503',
  questAnnouncementsChannelId: '1442215533427687596',
  questPaymentsChannelId: '1506225345685094501',
  accountingChannelId: '1441750778326028342',
  familyPhotosChannelId: '1326196950088810569'
};

export const DRAGON_HOUSE_DISCORD_INVITE_URL = 'https://discord.gg/MQheJPevZ';
export const DRAGON_HOUSE_DISCORD_GUILD_ID = '936687501316354068';

export const DEFAULT_DISCORD_FAMILY_CONFIG: DiscordFamilyConfig = {
  guildId: null,
  newsChannelId: null,
  urgentNewsChannelId: null,
  questsChannelId: null,
  questReportsChannelId: null,
  accountingChannelId: null,
  memberLogChannelId: null,
  welcomeChannelId: null,
  nicknameChangeChannelId: null,
  familyHistoryChannelId: null,
  familyChatChannelId: null,
  quantNewsChannelId: null,
  questInfoChannelId: null,
  questAnnouncementsChannelId: null,
  questPaymentsChannelId: null,
  familyPhotosChannelId: null,
  allowedChannelIds: [],
  channelPolicies: [],
  familyChatImportMode: 'prefix',
  familyChatCommandName: 'hub',
  familyChatPrefix: '#hub',
  familyChatMentionRoleId: null,
  syncNews: false,
  syncUrgentNews: false,
  syncQuests: false,
  syncQuestReports: false,
  syncMembers: false,
  connectionStatus: 'not_configured',
  lastSuccessfulSyncAt: null,
  lastError: null
};

// Frontend-safe only: bot tokens, client secrets, webhook secrets and database passwords
// must live exclusively on a backend service, never in extension storage or frontend code.
export const DEFAULT_DISCORD_BACKEND_CONFIG: DiscordBackendConfig = {
  apiBaseUrl: null,
  discordClientId: null,
  oauthRedirectUrl: null
};

export const DEFAULT_DISCORD_FAMILY_SETTINGS: DiscordFamilySettings = {
  serverInviteUrl: null,
  family: DEFAULT_DISCORD_FAMILY_CONFIG,
  backend: DEFAULT_DISCORD_BACKEND_CONFIG
};

function normalizeNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    .map((item) => item.trim());
}

function normalizeConnectionStatus(value: unknown): DiscordConnectionStatus {
  if (
    value === 'configured' ||
    value === 'connecting' ||
    value === 'connected' ||
    value === 'error'
  ) {
    return value;
  }
  return 'not_configured';
}

function normalizeFamilyChatImportMode(value: unknown): FamilyChatImportMode {
  if (value === 'disabled' || value === 'slash_command' || value === 'prefix' || value === 'role_mention') {
    return value;
  }
  return 'prefix';
}

function createPolicyFromDefinition(
  definition: DiscordChannelDefinition,
  channelId: string | null
): DiscordChannelPolicy | null {
  if (!channelId) return null;
  return {
    channelId,
    purpose: definition.purpose,
    importEnabled: false,
    publishEnabled: false,
    requiredPermission: definition.requiredPermission ?? null,
    minimumRank: definition.minimumRank ?? null
  };
}

function normalizeChannelPolicy(value: unknown): DiscordChannelPolicy | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<DiscordChannelPolicy>;
  const purpose = DISCORD_CHANNEL_DEFINITIONS.find((item) => item.purpose === record.purpose);
  const channelId = normalizeNullableString(record.channelId);
  if (!purpose || !channelId) return null;
  return {
    channelId,
    purpose: purpose.purpose,
    importEnabled: Boolean(record.importEnabled),
    publishEnabled: Boolean(record.publishEnabled),
    requiredPermission: record.requiredPermission ?? purpose.requiredPermission ?? null,
    minimumRank:
      typeof record.minimumRank === 'number' && Number.isFinite(record.minimumRank)
        ? record.minimumRank
        : purpose.minimumRank ?? null
  };
}

export function getDiscordChannelId(
  settings: DiscordFamilySettings,
  field: DiscordChannelField
): string | null {
  return settings.family[field];
}

export function buildDiscordChannelPolicies(family: DiscordFamilyConfig): DiscordChannelPolicy[] {
  return DISCORD_CHANNEL_DEFINITIONS.map((definition) =>
    createPolicyFromDefinition(definition, family[definition.field])
  ).filter((policy): policy is DiscordChannelPolicy => policy !== null);
}

export function getConfiguredDiscordChannelIds(family: DiscordFamilyConfig): string[] {
  return DISCORD_CHANNEL_DEFINITIONS.map((definition) => family[definition.field]).filter(
    (channelId): channelId is string => Boolean(channelId)
  );
}

export function createDragonHouseDiscordPreset(
  current: DiscordFamilySettings = DEFAULT_DISCORD_FAMILY_SETTINGS
): DiscordFamilySettings {
  const nextFamily: DiscordFamilyConfig = {
    ...current.family,
    guildId: DRAGON_HOUSE_DISCORD_GUILD_ID,
    ...DRAGON_HOUSE_DISCORD_CHANNEL_IDS,
    familyChatImportMode: 'prefix',
    familyChatCommandName: 'hub',
    familyChatPrefix: '#hub',
    familyChatMentionRoleId: null,
    syncNews: false,
    syncUrgentNews: false,
    syncQuests: false,
    syncQuestReports: false,
    syncMembers: false,
    connectionStatus: 'not_configured',
    lastSuccessfulSyncAt: null,
    lastError: null
  };
  return normalizeDiscordFamilySettings({
    ...current,
    serverInviteUrl: DRAGON_HOUSE_DISCORD_INVITE_URL,
    family: {
      ...nextFamily,
      allowedChannelIds: getConfiguredDiscordChannelIds(nextFamily),
      channelPolicies: buildDiscordChannelPolicies(nextFamily)
    }
  });
}

export function isDiscordSettingsFormEmpty(settings: DiscordFamilySettings): boolean {
  return (
    !settings.serverInviteUrl &&
    !settings.family.guildId &&
    DISCORD_CHANNEL_DEFINITIONS.every((definition) => !settings.family[definition.field])
  );
}

export function normalizeDiscordFamilySettings(value: unknown): DiscordFamilySettings {
  const record =
    value && typeof value === 'object'
      ? (value as Partial<DiscordFamilySettings>)
      : DEFAULT_DISCORD_FAMILY_SETTINGS;
  const family =
    record.family && typeof record.family === 'object'
      ? (record.family as Partial<DiscordFamilyConfig>)
      : {};
  const backend =
    record.backend && typeof record.backend === 'object'
      ? (record.backend as Partial<DiscordBackendConfig>)
      : {};
  const baseFamily = {
    guildId: normalizeNullableString(family.guildId),
    newsChannelId: normalizeNullableString(family.newsChannelId),
    urgentNewsChannelId: normalizeNullableString(family.urgentNewsChannelId),
    questsChannelId: normalizeNullableString(family.questsChannelId),
    questReportsChannelId: normalizeNullableString(family.questReportsChannelId),
    accountingChannelId: normalizeNullableString(family.accountingChannelId),
    memberLogChannelId: normalizeNullableString(family.memberLogChannelId),
    welcomeChannelId: normalizeNullableString(family.welcomeChannelId),
    nicknameChangeChannelId: normalizeNullableString(family.nicknameChangeChannelId),
    familyHistoryChannelId: normalizeNullableString(family.familyHistoryChannelId),
    familyChatChannelId: normalizeNullableString(family.familyChatChannelId),
    quantNewsChannelId: normalizeNullableString(family.quantNewsChannelId),
    questInfoChannelId: normalizeNullableString(family.questInfoChannelId),
    questAnnouncementsChannelId: normalizeNullableString(family.questAnnouncementsChannelId),
    questPaymentsChannelId: normalizeNullableString(family.questPaymentsChannelId),
    familyPhotosChannelId: normalizeNullableString(family.familyPhotosChannelId),
    allowedChannelIds: normalizeStringList(family.allowedChannelIds),
    channelPolicies: Array.isArray(family.channelPolicies)
      ? family.channelPolicies
          .map((policy) => normalizeChannelPolicy(policy))
          .filter((policy): policy is DiscordChannelPolicy => policy !== null)
      : [],
    familyChatImportMode: normalizeFamilyChatImportMode(family.familyChatImportMode),
    familyChatCommandName: normalizeNullableString(family.familyChatCommandName) ?? 'hub',
    familyChatPrefix: normalizeNullableString(family.familyChatPrefix) ?? '#hub',
    familyChatMentionRoleId: normalizeNullableString(family.familyChatMentionRoleId),
    syncNews: Boolean(family.syncNews),
    syncUrgentNews: Boolean(family.syncUrgentNews),
    syncQuests: Boolean(family.syncQuests),
    syncQuestReports: Boolean(family.syncQuestReports),
    syncMembers: Boolean(family.syncMembers),
    connectionStatus: normalizeConnectionStatus(family.connectionStatus),
    lastSuccessfulSyncAt: normalizeNullableString(family.lastSuccessfulSyncAt),
    lastError: normalizeNullableString(family.lastError)
  } satisfies DiscordFamilyConfig;
  const normalizedFamily: DiscordFamilyConfig = {
    ...baseFamily,
    allowedChannelIds: Array.from(
      new Set([...baseFamily.allowedChannelIds, ...getConfiguredDiscordChannelIds(baseFamily)])
    ),
    channelPolicies: baseFamily.channelPolicies.length
      ? baseFamily.channelPolicies
      : buildDiscordChannelPolicies(baseFamily)
  };

  return {
    serverInviteUrl: normalizeNullableString(record.serverInviteUrl),
    family: normalizedFamily,
    backend: {
      apiBaseUrl: normalizeNullableString(backend.apiBaseUrl),
      discordClientId: normalizeNullableString(backend.discordClientId),
      oauthRedirectUrl: normalizeNullableString(backend.oauthRedirectUrl)
    }
  };
}

export function readDiscordFamilySettings(): DiscordFamilySettings {
  if (typeof window === 'undefined') return DEFAULT_DISCORD_FAMILY_SETTINGS;
  const raw = window.localStorage.getItem(DISCORD_SETTINGS_KEY);
  if (!raw) return DEFAULT_DISCORD_FAMILY_SETTINGS;
  try {
    return normalizeDiscordFamilySettings(JSON.parse(raw) as unknown);
  } catch {
    return DEFAULT_DISCORD_FAMILY_SETTINGS;
  }
}

export function saveDiscordFamilySettings(settings: DiscordFamilySettings): DiscordFamilySettings {
  const normalized = normalizeDiscordFamilySettings(settings);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(DISCORD_SETTINGS_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

export function resetDiscordFamilySettings(): DiscordFamilySettings {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(DISCORD_SETTINGS_KEY);
  }
  return DEFAULT_DISCORD_FAMILY_SETTINGS;
}

export function validateDiscordFamilySettings(settings: DiscordFamilySettings): string[] {
  const missing: string[] = [];
  if (!settings.serverInviteUrl) missing.push('Server invite URL');
  if (!settings.family.guildId) missing.push('Guild ID');
  if (settings.family.syncNews && !settings.family.newsChannelId) missing.push('News channel ID');
  if (settings.family.syncUrgentNews && !settings.family.urgentNewsChannelId) {
    missing.push('Urgent news channel ID');
  }
  if (settings.family.syncQuests && !settings.family.questsChannelId) missing.push('Quests channel ID');
  if (settings.family.syncQuestReports && !settings.family.questReportsChannelId) {
    missing.push('Quest reports channel ID');
  }
  if (settings.family.syncMembers && !settings.family.memberLogChannelId) {
    missing.push('Member log channel ID');
  }
  if (!settings.backend.apiBaseUrl) missing.push('Backend API URL');
  if (!settings.backend.discordClientId) missing.push('Discord application client ID');
  if (!settings.backend.oauthRedirectUrl) missing.push('OAuth redirect URL');
  return missing;
}

export class DisabledDiscordFamilyIntegrationService implements DiscordFamilyIntegrationService {
  async getConnectionStatus(): Promise<DiscordConnectionStatus> {
    return 'not_configured';
  }

  async beginUserLink(): Promise<{ authorizationUrl: string }> {
    throw new Error('Discord integration is not configured');
  }

  async unlinkCurrentUser(): Promise<void> {
    return undefined;
  }

  async fetchNews(_since?: string): Promise<ExternalFamilyNews[]> {
    return [];
  }

  async fetchQuests(_since?: string): Promise<ExternalFamilyQuest[]> {
    return [];
  }

  async fetchQuestReports(_since?: string): Promise<ExternalQuestReport[]> {
    return [];
  }

  async fetchMembers(_since?: string): Promise<ExternalFamilyMember[]> {
    return [];
  }

  async publishFamilyNews(_postId: string): Promise<ExternalSyncResult> {
    return { ok: false, status: 'not_configured', error: 'Discord integration is not configured' };
  }

  async publishQuest(_questId: string): Promise<ExternalSyncResult> {
    return { ok: false, status: 'not_configured', error: 'Discord integration is not configured' };
  }

  async publishQuestReport(_reportId: string): Promise<ExternalSyncResult> {
    return { ok: false, status: 'not_configured', error: 'Discord integration is not configured' };
  }
}

export const disabledDiscordFamilyIntegrationService = new DisabledDiscordFamilyIntegrationService();
