import { describe, expect, it } from 'vitest';
import { configuredChannelNames, getMissingDiscordConfig, loadConfig, maskSensitiveValue, requireDatabaseUrl } from './env.js';

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
});
