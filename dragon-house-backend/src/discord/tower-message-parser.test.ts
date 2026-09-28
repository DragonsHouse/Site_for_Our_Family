import { describe, expect, it } from 'vitest';
import { parseDiscordTowerGuardMessage } from './tower-message-parser.js';

describe('parseDiscordTowerGuardMessage', () => {
  it('accepts Dragon tower-only cooldown cards from Discord', () => {
    const signal = parseDiscordTowerGuardMessage({
      id: 'message-1',
      channelId: 'tower-guard',
      authorId: 'dragon-bot',
      authorName: 'Dragon',
      createdAt: '2026-08-27T02:13:32.994Z',
      editedAt: null,
      content: '🛢️ Вишка №50',
      embeds: [],
    });

    expect(signal).toMatchObject({
      externalId: 'message-1',
      towerNumber: 50,
      towerCode: 'NO-50',
      towerName: 'Vishka No50',
      protectionDown: false,
      cooldownNeedsUpdate: false,
      cooldownAt: null,
      statusText: '🛢️ Вишка №50',
    });
  });
});
