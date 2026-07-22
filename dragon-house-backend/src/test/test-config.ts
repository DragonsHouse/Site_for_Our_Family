import type { AppConfig } from '../config/env.js';

type TestConfigOverrides = Partial<Omit<AppConfig, 'discord'>> & {
  discord?: Partial<AppConfig['discord']> & {
    channels?: Partial<AppConfig['discord']['channels']>;
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
    frontendExtensionId: overrides.frontendExtensionId ?? null,
    discord: {
      clientId: overrides.discord?.clientId ?? null,
      clientSecret: overrides.discord?.clientSecret ?? null,
      botToken: overrides.discord?.botToken ?? null,
      redirectUri: overrides.discord?.redirectUri ?? null,
      oauthRedirectUri: overrides.discord?.oauthRedirectUri ?? overrides.discord?.redirectUri ?? null,
      oauthSuccessRedirectUri: overrides.discord?.oauthSuccessRedirectUri ?? null,
      oauthErrorRedirectUri: overrides.discord?.oauthErrorRedirectUri ?? null,
      guildId: overrides.discord?.guildId ?? null,
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
