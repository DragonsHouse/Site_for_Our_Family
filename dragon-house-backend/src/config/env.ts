import 'dotenv/config';
import { z } from 'zod';

const EnvBoolean = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  if (['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase())) return true;
  if (['false', '0', 'no', 'off', ''].includes(value.trim().toLowerCase())) return false;
  return value;
}, z.boolean());

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8787),
  DATABASE_URL: z.string().trim().optional().default(''),
  AUTH_SESSION_TTL_HOURS: z.coerce.number().int().positive().default(10),
  AUTH_REMEMBER_ME_TTL_DAYS: z.coerce.number().int().positive().default(30),
  BCRYPT_COST: z.coerce.number().int().min(10).max(14).default(12),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).optional(),
  TRUST_PROXY: EnvBoolean.default(false),
  FRONTEND_EXTENSION_ID: z.string().trim().optional().default(''),
  FRONTEND_ALLOWED_ORIGINS: z.string().trim().optional().default(''),
  DISCORD_CLIENT_ID: z.string().trim().optional().default(''),
  DISCORD_CLIENT_SECRET: z.string().trim().optional().default(''),
  DISCORD_BOT_TOKEN: z.string().trim().optional().default(''),
  DISCORD_REDIRECT_URI: z.string().trim().optional().default(''),
  DISCORD_OAUTH_REDIRECT_URI: z.string().trim().optional().default(''),
  DISCORD_OAUTH_SCOPES: z.string().trim().optional().default('identify'),
  DISCORD_OAUTH_SUCCESS_REDIRECT_URI: z.string().trim().optional().default(''),
  DISCORD_OAUTH_ERROR_REDIRECT_URI: z.string().trim().optional().default(''),
  DISCORD_LOGIN_SUCCESS_REDIRECT_URI: z.string().trim().optional().default(''),
  DISCORD_LOGIN_ERROR_REDIRECT_URI: z.string().trim().optional().default(''),
  DISCORD_LOGIN_ALLOWED_REDIRECT_URIS: z.string().trim().optional().default(''),
  DISCORD_OAUTH_STATE_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(600),
  DISCORD_LOGIN_COMPLETION_TTL_SECONDS: z.coerce.number().int().min(30).max(300).default(120),
  DISCORD_OAUTH_START_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(12),
  DISCORD_OAUTH_COMPLETE_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(20),
  DISCORD_GUILD_ID: z.string().trim().optional().default(''),
  DISCORD_WELCOME_CHANNEL_ID: z.string().trim().optional().default(''),
  DISCORD_NICKNAME_CHANGE_CHANNEL_ID: z.string().trim().optional().default(''),
  DISCORD_FAMILY_HISTORY_CHANNEL_ID: z.string().trim().optional().default(''),
  DISCORD_FAMILY_CHAT_CHANNEL_ID: z.string().trim().optional().default(''),
  DISCORD_QUANT_NEWS_CHANNEL_ID: z.string().trim().optional().default(''),
  DISCORD_QUEST_INFO_CHANNEL_ID: z.string().trim().optional().default(''),
  DISCORD_QUEST_ANNOUNCEMENTS_CHANNEL_ID: z.string().trim().optional().default(''),
  DISCORD_QUEST_PAYMENTS_CHANNEL_ID: z.string().trim().optional().default(''),
  DISCORD_ACCOUNTING_CHANNEL_ID: z.string().trim().optional().default(''),
  DISCORD_FAMILY_PHOTOS_CHANNEL_ID: z.string().trim().optional().default(''),
  DISCORD_SYNC_PROTECTED_OWNER_MEMBER_ID: z.string().trim().optional().default(''),
  DISCORD_SYNC_PROTECTED_OWNER_USER_ID: z.string().trim().optional().default(''),
  DISCORD_SYNC_REPORT_DIR: z.string().trim().optional().default(''),
  DISCORD_SYNC_MIN_HUMAN_MEMBERS: z.coerce.number().int().nonnegative().default(1),
  DISCORD_SYNC_PLAN_TTL_SECONDS: z.coerce.number().int().min(30).max(900).default(300),
  DISCORD_SYNC_DRY_RUN_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(6),
  DISCORD_SYNC_APPLY_RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(2),
  DISCORD_SYNC_REPORT_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(30),
});

export type AppEnv = z.infer<typeof EnvSchema>;

export type DiscordChannelConfig = {
  welcome: string | null;
  nicknameChange: string | null;
  familyHistory: string | null;
  familyChat: string | null;
  quantNews: string | null;
  questInfo: string | null;
  questAnnouncements: string | null;
  questPayments: string | null;
  accounting: string | null;
  familyPhotos: string | null;
};

export type AppConfig = {
  nodeEnv: AppEnv['NODE_ENV'];
  port: number;
  databaseUrl: string | null;
  authSessionTtlHours: number;
  authRememberMeTtlDays: number;
  bcryptCost: number;
  logLevel: AppEnv['LOG_LEVEL'];
  logFormat: 'json' | 'pretty';
  trustProxy: boolean;
  frontendExtensionId: string | null;
  frontendAllowedOrigins: string[];
  discord: {
    clientId: string | null;
    clientSecret: string | null;
    botToken: string | null;
    redirectUri: string | null;
    oauthRedirectUri: string | null;
    oauthSuccessRedirectUri: string | null;
    oauthErrorRedirectUri: string | null;
    oauth: {
      scopes: string[];
      stateTtlSeconds: number;
      completionTtlSeconds: number;
      loginSuccessRedirectUri: string | null;
      loginErrorRedirectUri: string | null;
      loginRedirectUris: string[];
      startRateLimitPerMinute: number;
      completeRateLimitPerMinute: number;
    };
    guildId: string | null;
    sync: {
      protectedOwnerMemberId: string | null;
      protectedOwnerDiscordUserId: string | null;
      reportDir: string | null;
      minHumanMembers: number;
      planTtlSeconds: number;
      dryRunRateLimitPerMinute: number;
      applyRateLimitPerHour: number;
      reportRateLimitPerMinute: number;
    };
    channels: DiscordChannelConfig;
  };
};

const secretKeys = ['DISCORD_CLIENT_SECRET', 'DISCORD_BOT_TOKEN'] as const;

function nullable(value: string): string | null {
  return value.length > 0 ? value : null;
}

export function maskSensitiveValue(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 6) return '***';
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

export function maskConfigForDiagnostics(env: AppEnv): Record<string, string | number | null> {
  return {
    NODE_ENV: env.NODE_ENV,
    PORT: env.PORT,
    DATABASE_URL: maskSensitiveValue(env.DATABASE_URL),
    AUTH_SESSION_TTL_HOURS: env.AUTH_SESSION_TTL_HOURS,
    AUTH_REMEMBER_ME_TTL_DAYS: env.AUTH_REMEMBER_ME_TTL_DAYS,
    BCRYPT_COST: env.BCRYPT_COST,
    LOG_LEVEL: env.LOG_LEVEL,
    LOG_FORMAT: env.LOG_FORMAT ?? null,
    TRUST_PROXY: String(env.TRUST_PROXY),
    FRONTEND_EXTENSION_ID: nullable(env.FRONTEND_EXTENSION_ID),
    FRONTEND_ALLOWED_ORIGINS: nullable(env.FRONTEND_ALLOWED_ORIGINS),
    DISCORD_CLIENT_ID: nullable(env.DISCORD_CLIENT_ID),
    DISCORD_CLIENT_SECRET: maskSensitiveValue(env.DISCORD_CLIENT_SECRET),
    DISCORD_BOT_TOKEN: maskSensitiveValue(env.DISCORD_BOT_TOKEN),
    DISCORD_REDIRECT_URI: nullable(env.DISCORD_REDIRECT_URI),
    DISCORD_OAUTH_REDIRECT_URI: nullable(env.DISCORD_OAUTH_REDIRECT_URI),
    DISCORD_OAUTH_SCOPES: nullable(env.DISCORD_OAUTH_SCOPES),
    DISCORD_OAUTH_SUCCESS_REDIRECT_URI: nullable(env.DISCORD_OAUTH_SUCCESS_REDIRECT_URI),
    DISCORD_OAUTH_ERROR_REDIRECT_URI: nullable(env.DISCORD_OAUTH_ERROR_REDIRECT_URI),
    DISCORD_LOGIN_SUCCESS_REDIRECT_URI: nullable(env.DISCORD_LOGIN_SUCCESS_REDIRECT_URI),
    DISCORD_LOGIN_ERROR_REDIRECT_URI: nullable(env.DISCORD_LOGIN_ERROR_REDIRECT_URI),
    DISCORD_LOGIN_ALLOWED_REDIRECT_URIS: nullable(env.DISCORD_LOGIN_ALLOWED_REDIRECT_URIS),
    DISCORD_OAUTH_STATE_TTL_SECONDS: env.DISCORD_OAUTH_STATE_TTL_SECONDS,
    DISCORD_LOGIN_COMPLETION_TTL_SECONDS: env.DISCORD_LOGIN_COMPLETION_TTL_SECONDS,
    DISCORD_OAUTH_START_RATE_LIMIT_PER_MINUTE: env.DISCORD_OAUTH_START_RATE_LIMIT_PER_MINUTE,
    DISCORD_OAUTH_COMPLETE_RATE_LIMIT_PER_MINUTE: env.DISCORD_OAUTH_COMPLETE_RATE_LIMIT_PER_MINUTE,
    DISCORD_GUILD_ID: nullable(env.DISCORD_GUILD_ID),
    DISCORD_WELCOME_CHANNEL_ID: nullable(env.DISCORD_WELCOME_CHANNEL_ID),
    DISCORD_NICKNAME_CHANGE_CHANNEL_ID: nullable(env.DISCORD_NICKNAME_CHANGE_CHANNEL_ID),
    DISCORD_FAMILY_HISTORY_CHANNEL_ID: nullable(env.DISCORD_FAMILY_HISTORY_CHANNEL_ID),
    DISCORD_FAMILY_CHAT_CHANNEL_ID: nullable(env.DISCORD_FAMILY_CHAT_CHANNEL_ID),
    DISCORD_QUANT_NEWS_CHANNEL_ID: nullable(env.DISCORD_QUANT_NEWS_CHANNEL_ID),
    DISCORD_QUEST_INFO_CHANNEL_ID: nullable(env.DISCORD_QUEST_INFO_CHANNEL_ID),
    DISCORD_QUEST_ANNOUNCEMENTS_CHANNEL_ID: nullable(env.DISCORD_QUEST_ANNOUNCEMENTS_CHANNEL_ID),
    DISCORD_QUEST_PAYMENTS_CHANNEL_ID: nullable(env.DISCORD_QUEST_PAYMENTS_CHANNEL_ID),
    DISCORD_ACCOUNTING_CHANNEL_ID: nullable(env.DISCORD_ACCOUNTING_CHANNEL_ID),
    DISCORD_FAMILY_PHOTOS_CHANNEL_ID: nullable(env.DISCORD_FAMILY_PHOTOS_CHANNEL_ID),
    DISCORD_SYNC_PROTECTED_OWNER_MEMBER_ID: nullable(env.DISCORD_SYNC_PROTECTED_OWNER_MEMBER_ID),
    DISCORD_SYNC_PROTECTED_OWNER_USER_ID: nullable(env.DISCORD_SYNC_PROTECTED_OWNER_USER_ID),
    DISCORD_SYNC_REPORT_DIR: nullable(env.DISCORD_SYNC_REPORT_DIR),
    DISCORD_SYNC_MIN_HUMAN_MEMBERS: env.DISCORD_SYNC_MIN_HUMAN_MEMBERS,
    DISCORD_SYNC_PLAN_TTL_SECONDS: env.DISCORD_SYNC_PLAN_TTL_SECONDS,
    DISCORD_SYNC_DRY_RUN_RATE_LIMIT_PER_MINUTE: env.DISCORD_SYNC_DRY_RUN_RATE_LIMIT_PER_MINUTE,
    DISCORD_SYNC_APPLY_RATE_LIMIT_PER_HOUR: env.DISCORD_SYNC_APPLY_RATE_LIMIT_PER_HOUR,
    DISCORD_SYNC_REPORT_RATE_LIMIT_PER_MINUTE: env.DISCORD_SYNC_REPORT_RATE_LIMIT_PER_MINUTE,
  };
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')}`);
  }

  const env = parsed.data;
  for (const key of secretKeys) {
    const rawValue = env[key];
    if (rawValue && rawValue.includes('\n')) {
      throw new Error(`Invalid secret format for ${key}: ${maskSensitiveValue(rawValue)}`);
    }
  }

  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    databaseUrl: nullable(env.DATABASE_URL),
    authSessionTtlHours: env.AUTH_SESSION_TTL_HOURS,
    authRememberMeTtlDays: env.AUTH_REMEMBER_ME_TTL_DAYS,
    bcryptCost: env.BCRYPT_COST,
    logLevel: env.LOG_LEVEL,
    logFormat: env.LOG_FORMAT ?? (env.NODE_ENV === 'production' ? 'json' : 'pretty'),
    trustProxy: env.TRUST_PROXY,
    frontendExtensionId: nullable(env.FRONTEND_EXTENSION_ID),
    frontendAllowedOrigins: csvList(env.FRONTEND_ALLOWED_ORIGINS),
    discord: {
      clientId: nullable(env.DISCORD_CLIENT_ID),
      clientSecret: nullable(env.DISCORD_CLIENT_SECRET),
      botToken: nullable(env.DISCORD_BOT_TOKEN),
      redirectUri: nullable(env.DISCORD_REDIRECT_URI),
      oauthRedirectUri: nullable(env.DISCORD_OAUTH_REDIRECT_URI) ?? nullable(env.DISCORD_REDIRECT_URI),
      oauthSuccessRedirectUri: nullable(env.DISCORD_OAUTH_SUCCESS_REDIRECT_URI),
      oauthErrorRedirectUri: nullable(env.DISCORD_OAUTH_ERROR_REDIRECT_URI),
      oauth: {
        scopes: csvList(env.DISCORD_OAUTH_SCOPES.replace(/\s+/gu, ',')),
        stateTtlSeconds: env.DISCORD_OAUTH_STATE_TTL_SECONDS,
        completionTtlSeconds: env.DISCORD_LOGIN_COMPLETION_TTL_SECONDS,
        loginSuccessRedirectUri: nullable(env.DISCORD_LOGIN_SUCCESS_REDIRECT_URI) ?? nullable(env.DISCORD_OAUTH_SUCCESS_REDIRECT_URI),
        loginErrorRedirectUri: nullable(env.DISCORD_LOGIN_ERROR_REDIRECT_URI) ?? nullable(env.DISCORD_OAUTH_ERROR_REDIRECT_URI),
        loginRedirectUris: loginRedirectUris(env),
        startRateLimitPerMinute: env.DISCORD_OAUTH_START_RATE_LIMIT_PER_MINUTE,
        completeRateLimitPerMinute: env.DISCORD_OAUTH_COMPLETE_RATE_LIMIT_PER_MINUTE,
      },
      guildId: nullable(env.DISCORD_GUILD_ID),
      sync: {
        protectedOwnerMemberId: nullable(env.DISCORD_SYNC_PROTECTED_OWNER_MEMBER_ID),
        protectedOwnerDiscordUserId: nullable(env.DISCORD_SYNC_PROTECTED_OWNER_USER_ID),
        reportDir: nullable(env.DISCORD_SYNC_REPORT_DIR),
        minHumanMembers: env.DISCORD_SYNC_MIN_HUMAN_MEMBERS,
        planTtlSeconds: env.DISCORD_SYNC_PLAN_TTL_SECONDS,
        dryRunRateLimitPerMinute: env.DISCORD_SYNC_DRY_RUN_RATE_LIMIT_PER_MINUTE,
        applyRateLimitPerHour: env.DISCORD_SYNC_APPLY_RATE_LIMIT_PER_HOUR,
        reportRateLimitPerMinute: env.DISCORD_SYNC_REPORT_RATE_LIMIT_PER_MINUTE,
      },
      channels: {
        welcome: nullable(env.DISCORD_WELCOME_CHANNEL_ID),
        nicknameChange: nullable(env.DISCORD_NICKNAME_CHANGE_CHANNEL_ID),
        familyHistory: nullable(env.DISCORD_FAMILY_HISTORY_CHANNEL_ID),
        familyChat: nullable(env.DISCORD_FAMILY_CHAT_CHANNEL_ID),
        quantNews: nullable(env.DISCORD_QUANT_NEWS_CHANNEL_ID),
        questInfo: nullable(env.DISCORD_QUEST_INFO_CHANNEL_ID),
        questAnnouncements: nullable(env.DISCORD_QUEST_ANNOUNCEMENTS_CHANNEL_ID),
        questPayments: nullable(env.DISCORD_QUEST_PAYMENTS_CHANNEL_ID),
        accounting: nullable(env.DISCORD_ACCOUNTING_CHANNEL_ID),
        familyPhotos: nullable(env.DISCORD_FAMILY_PHOTOS_CHANNEL_ID),
      },
    },
  };
}

export function requireDatabaseUrl(config: AppConfig): string {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  return config.databaseUrl;
}

function csvList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function validateProductionConfig(config: AppConfig): string[] {
  if (config.nodeEnv !== 'production') return [];
  const missing: string[] = [];
  if (!config.databaseUrl) missing.push('DATABASE_URL');
  if (!config.frontendExtensionId && config.frontendAllowedOrigins.length === 0) missing.push('FRONTEND_EXTENSION_ID or FRONTEND_ALLOWED_ORIGINS');
  if (!config.discord.sync.protectedOwnerMemberId) missing.push('DISCORD_SYNC_PROTECTED_OWNER_MEMBER_ID');
  if (!config.discord.sync.protectedOwnerDiscordUserId) missing.push('DISCORD_SYNC_PROTECTED_OWNER_USER_ID');
  missing.push(...getMissingDiscordConfig(config));
  missing.push(...getMissingDiscordOAuthLoginConfig(config));
  return [...new Set(missing)];
}

export function getMissingDiscordConfig(config: AppConfig): string[] {
  const missing: string[] = [];
  if (!config.discord.clientId) missing.push('DISCORD_CLIENT_ID');
  if (!config.discord.clientSecret) missing.push('DISCORD_CLIENT_SECRET');
  if (!config.discord.botToken) missing.push('DISCORD_BOT_TOKEN');
  if (!config.discord.redirectUri) missing.push('DISCORD_REDIRECT_URI');
  if (!config.discord.guildId) missing.push('DISCORD_GUILD_ID');
  return missing;
}

export function isDiscordConfigComplete(config: AppConfig): boolean {
  return getMissingDiscordConfig(config).length === 0;
}

export function getMissingDiscordOAuthConfig(config: AppConfig): string[] {
  const missing: string[] = [];
  if (!config.discord.clientId) missing.push('DISCORD_CLIENT_ID');
  if (!config.discord.clientSecret) missing.push('DISCORD_CLIENT_SECRET');
  if (!config.discord.oauthRedirectUri) missing.push('DISCORD_OAUTH_REDIRECT_URI');
  if (!config.discord.guildId) missing.push('DISCORD_GUILD_ID');
  return missing;
}

export function isDiscordOAuthConfigComplete(config: AppConfig): boolean {
  return getMissingDiscordOAuthConfig(config).length === 0;
}

export function getMissingDiscordOAuthLoginConfig(config: AppConfig): string[] {
  const missing = getMissingDiscordOAuthConfig(config);
  if (config.discord.oauth.scopes.length === 0) missing.push('DISCORD_OAUTH_SCOPES');
  if (config.discord.oauth.loginRedirectUris.length === 0) missing.push('DISCORD_LOGIN_ALLOWED_REDIRECT_URIS or DISCORD_LOGIN_SUCCESS_REDIRECT_URI');
  return missing;
}

export function configuredChannelNames(config: AppConfig): string[] {
  return Object.entries(config.discord.channels)
    .filter(([, channelId]) => Boolean(channelId))
    .map(([name]) => name);
}

export const configuredChannelPurposes = configuredChannelNames;

function loginRedirectUris(env: AppEnv): string[] {
  return [
    ...csvList(env.DISCORD_LOGIN_ALLOWED_REDIRECT_URIS),
    nullable(env.DISCORD_LOGIN_SUCCESS_REDIRECT_URI),
    nullable(env.DISCORD_OAUTH_SUCCESS_REDIRECT_URI),
  ].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);
}
