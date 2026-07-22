import type { AppConfig } from '../config/env.js';

type TestConfigOverrides = Partial<Omit<AppConfig, 'discord'>> & {
  discord?: Partial<Omit<AppConfig['discord'], 'channels' | 'sync'>> & {
    channels?: Partial<AppConfig['discord']['channels']>;
    sync?: Partial<AppConfig['discord']['sync']>;
  };
};

export function createTestConfig(overrides: TestConfigOverrides = {}): AppConfig {
  return {
    nodeEnv: overrides.nodeEnv ?? 'test',
    port: overrides.port ?? 8787,
    databaseUrl: overrides.databaseUrl ?? null,
    authSessionTtlHours: overrides.authSessionTtlHours ?? 10,
    authRememberMeTtlDays: overrides.authRememberMeTtlDays ?? 30,
    bcryptCost: overrides.bcryptCost ?? 10,
    logLevel: overrides.logLevel ?? 'silent',
    logFormat: overrides.logFormat ?? 'pretty',
    trustProxy: overrides.trustProxy ?? false,
    frontendExtensionId: overrides.frontendExtensionId ?? null,
    frontendAllowedOrigins: overrides.frontendAllowedOrigins ?? [],
    discord: {
      clientId: overrides.discord?.clientId ?? null,
      clientSecret: overrides.discord?.clientSecret ?? null,
      botToken: overrides.discord?.botToken ?? null,
      redirectUri: overrides.discord?.redirectUri ?? null,
      oauthRedirectUri: overrides.discord?.oauthRedirectUri ?? overrides.discord?.redirectUri ?? null,
      oauthSuccessRedirectUri: overrides.discord?.oauthSuccessRedirectUri ?? null,
      oauthErrorRedirectUri: overrides.discord?.oauthErrorRedirectUri ?? null,
      guildId: overrides.discord?.guildId ?? null,
      sync: {
        protectedOwnerMemberId: overrides.discord?.sync?.protectedOwnerMemberId ?? null,
        protectedOwnerDiscordUserId: overrides.discord?.sync?.protectedOwnerDiscordUserId ?? null,
        reportDir: overrides.discord?.sync?.reportDir ?? null,
        minHumanMembers: overrides.discord?.sync?.minHumanMembers ?? 1,
        planTtlSeconds: overrides.discord?.sync?.planTtlSeconds ?? 300,
        dryRunRateLimitPerMinute: overrides.discord?.sync?.dryRunRateLimitPerMinute ?? 1000,
        applyRateLimitPerHour: overrides.discord?.sync?.applyRateLimitPerHour ?? 1000,
        reportRateLimitPerMinute: overrides.discord?.sync?.reportRateLimitPerMinute ?? 1000,
      },
      channels: {
        welcome: overrides.discord?.channels?.welcome ?? null,
        nicknameChange: overrides.discord?.channels?.nicknameChange ?? null,
        familyHistory: overrides.discord?.channels?.familyHistory ?? null,
        familyChat: overrides.discord?.channels?.familyChat ?? null,
        quantNews: overrides.discord?.channels?.quantNews ?? null,
        questInfo: overrides.discord?.channels?.questInfo ?? null,
        questAnnouncements: overrides.discord?.channels?.questAnnouncements ?? null,
        questPayments: overrides.discord?.channels?.questPayments ?? null,
        accounting: overrides.discord?.channels?.accounting ?? null,
        familyPhotos: overrides.discord?.channels?.familyPhotos ?? null,
      },
    },
  };
}
