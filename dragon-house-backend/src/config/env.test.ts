import { describe, expect, it } from 'vitest';
import {
  configuredChannelNames,
  getMissingDiscordConfig,
  loadConfig,
  maskSensitiveValue,
  requireDatabaseUrl,
  validateProductionConfig,
} from './env.js';

describe('env config', () => {
  it('uses disabled Discord mode when secrets are absent', () => {
    const config = loadConfig({ NODE_ENV: 'test', PORT: '8787' });

    expect(config.discord.botToken).toBeNull();
    expect(getMissingDiscordConfig(config)).toContain('DISCORD_BOT_TOKEN');
  });

  it('masks sensitive values', () => {
    expect(maskSensitiveValue('abcdef123456')).toBe('ab***56');
    expect(maskSensitiveValue('tiny')).toBe('***');
  });

  it('returns only configured channel names', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      PORT: '8787',
      DISCORD_QUANT_NEWS_CHANNEL_ID: 'news-id',
      DISCORD_QUEST_ANNOUNCEMENTS_CHANNEL_ID: 'quests-id',
    });

    expect(configuredChannelNames(config)).toEqual(['quantNews', 'questAnnouncements']);
  });

  it('does not accept missing DATABASE_URL in database-required mode', () => {
    const config = loadConfig({ NODE_ENV: 'test', PORT: '8787' });

    expect(() => requireDatabaseUrl(config)).toThrow('DATABASE_URL is required');
  });

  it('parses explicit frontend allowed origins', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      PORT: '8787',
      FRONTEND_ALLOWED_ORIGINS: 'https://family.example, https://admin.example',
    });

    expect(config.frontendAllowedOrigins).toEqual(['https://family.example', 'https://admin.example']);
  });

  it('parses TRUST_PROXY=false as false', () => {
    const config = loadConfig({ NODE_ENV: 'test', PORT: '8787', TRUST_PROXY: 'false' });

    expect(config.trustProxy).toBe(false);
  });

  it('keeps destructive Discord member auto-sync opt-in by default', () => {
    const config = loadConfig({ NODE_ENV: 'test', PORT: '8787' });

    expect(config.discord.sync.autoEnabled).toBe(false);
  });

  it('parses trusted Discord ingestion identities without hardcoding them', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      PORT: '8787',
      DISCORD_TRUSTED_BOT_USER_ID: 'bot-1',
      DISCORD_TRUSTED_APPLICATION_ID: 'app-1',
      DISCORD_TRUSTED_WEBHOOK_ID: 'webhook-1',
    });

    expect(config.discord.trustedBotUserId).toBe('bot-1');
    expect(config.discord.trustedApplicationId).toBe('app-1');
    expect(config.discord.trustedWebhookId).toBe('webhook-1');
  });

  it('fails production validation when sync safety configuration is missing', () => {
    const config = loadConfig({ NODE_ENV: 'production', PORT: '8787' });

    expect(validateProductionConfig(config)).toEqual(expect.arrayContaining([
      'DATABASE_URL',
      'FRONTEND_EXTENSION_ID or FRONTEND_ALLOWED_ORIGINS',
      'DISCORD_SYNC_PROTECTED_OWNER_MEMBER_ID',
      'DISCORD_SYNC_PROTECTED_OWNER_USER_ID',
      'DISCORD_BOT_TOKEN',
    ]));
  });
});
