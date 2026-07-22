import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8787),
  DATABASE_URL: z.string().trim().optional().default(''),
  AUTH_SESSION_TTL_HOURS: z.coerce.number().int().positive().default(10),
  AUTH_REMEMBER_ME_TTL_DAYS: z.coerce.number().int().positive().default(30),
  BCRYPT_COST: z.coerce.number().int().min(10).max(14).default(12),
  FRONTEND_EXTENSION_ID: z.string().trim().optional().default(''),
  DISCORD_CLIENT_ID: z.string().trim().optional().default(''),
  DISCORD_CLIENT_SECRET: z.string().trim().optional().default(''),
  DISCORD_BOT_TOKEN: z.string().trim().optional().default(''),
  DISCORD_REDIRECT_URI: z.string().trim().optional().default(''),
  DISCORD_OAUTH_REDIRECT_URI: z.string().trim().optional().default(''),
  DISCORD_OAUTH_SUCCESS_REDIRECT_URI: z.string().trim().optional().default(''),
  DISCORD_OAUTH_ERROR_REDIRECT_URI: z.string().trim().optional().default(''),
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
  frontendExtensionId: string | null;
  discord: {
    clientId: string | null;
    clientSecret: string | null;
    botToken: string | null;
    redirectUri: string | null;
    oauthRedirectUri: string | null;
    oauthSuccessRedirectUri: string | null;
    oauthErrorRedirectUri: string | null;
    guildId: string | null;
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
    FRONTEND_EXTENSION_ID: nullable(env.FRONTEND_EXTENSION_ID),
    DISCORD_CLIENT_ID: nullable(env.DISCORD_CLIENT_ID),
    DISCORD_CLIENT_SECRET: maskSensitiveValue(env.DISCORD_CLIENT_SECRET),
    DISCORD_BOT_TOKEN: maskSensitiveValue(env.DISCORD_BOT_TOKEN),
    DISCORD_REDIRECT_URI: nullable(env.DISCORD_REDIRECT_URI),
    DISCORD_OAUTH_REDIRECT_URI: nullable(env.DISCORD_OAUTH_REDIRECT_URI),
    DISCORD_OAUTH_SUCCESS_REDIRECT_URI: nullable(env.DISCORD_OAUTH_SUCCESS_REDIRECT_URI),
    DISCORD_OAUTH_ERROR_REDIRECT_URI: nullable(env.DISCORD_OAUTH_ERROR_REDIRECT_URI),
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
    frontendExtensionId: nullable(env.FRONTEND_EXTENSION_ID),
    discord: {
      clientId: nullable(env.DISCORD_CLIENT_ID),
      clientSecret: nullable(env.DISCORD_CLIENT_SECRET),
      botToken: nullable(env.DISCORD_BOT_TOKEN),
      redirectUri: nullable(env.DISCORD_REDIRECT_URI),
      oauthRedirectUri: nullable(env.DISCORD_OAUTH_REDIRECT_URI) ?? nullable(env.DISCORD_REDIRECT_URI),
      oauthSuccessRedirectUri: nullable(env.DISCORD_OAUTH_SUCCESS_REDIRECT_URI),
      oauthErrorRedirectUri: nullable(env.DISCORD_OAUTH_ERROR_REDIRECT_URI),
      guildId: nullable(env.DISCORD_GUILD_ID),
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

export function configuredChannelNames(config: AppConfig): string[] {
  return Object.entries(config.discord.channels)
    .filter(([, channelId]) => Boolean(channelId))
    .map(([name]) => name);
}

export const configuredChannelPurposes = configuredChannelNames;
