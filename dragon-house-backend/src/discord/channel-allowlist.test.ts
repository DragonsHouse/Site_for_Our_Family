import { describe, expect, it } from 'vitest';
import { createTestConfig } from '../test/test-config.js';
import { getAllowedChannelIds, isAllowedChannel } from './channel-allowlist.js';

describe('channel allowlist', () => {
  it('allows only configured Discord channel IDs', () => {
    const config = createTestConfig({
      discord: {
        clientId: null,
        clientSecret: null,
        botToken: null,
        redirectUri: null,
        guildId: null,
        channels: {
          welcome: 'welcome-id',
          nicknameChange: null,
          familyHistory: null,
          familyChat: null,
          quantNews: 'news-id',
          questInfo: null,
          questAnnouncements: 'quests-id',
          questPayments: null,
          accounting: null,
          familyPhotos: null,
        },
      },
    });

    expect([...getAllowedChannelIds(config)]).toEqual(['welcome-id', 'news-id', 'quests-id']);
    expect(isAllowedChannel(config, 'news-id')).toBe(true);
    expect(isAllowedChannel(config, 'random-channel')).toBe(false);
  });
});
