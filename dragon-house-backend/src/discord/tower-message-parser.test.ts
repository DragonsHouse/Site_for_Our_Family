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
      towerName: 'Вишка №50',
      protectionDown: false,
      cooldownNeedsUpdate: false,
      cooldownAt: null,
      statusText: '🛢️ Вишка №50',
    });
  });

  it('uses Ukrainian status copy for protection and cooldown warnings', () => {
    const signal = parseDiscordTowerGuardMessage({
      id: 'message-2',
      channelId: 'tower-guard',
      authorId: 'dragon-bot',
      authorName: 'Dragon',
      createdAt: '2026-08-27T02:13:32.994Z',
      editedAt: null,
      content: 'Вишка №50\nЗахист впав.\nПотрібно оновити КД.',
      embeds: [],
    });

    expect(signal).toMatchObject({
      towerNumber: 50,
      protectionDown: true,
      cooldownNeedsUpdate: true,
      statusText: 'Захист впав. Потрібно оновити КД.',
    });
  });

  it('parses cooldown only from an explicit cooldown label', () => {
    const signal = parseDiscordTowerGuardMessage({
      id: 'message-3',
      channelId: 'tower-guard',
      authorId: 'dragon-bot',
      authorName: 'Dragon',
      createdAt: '2026-08-27T02:13:32.994Z',
      editedAt: null,
      content: 'Вишка №50\nБій: <t:1789277401:f>\nКД: <t:1789281001:f>',
      embeds: [],
    });

    expect(signal?.cooldownAt).toBe(new Date(1789281001 * 1000).toISOString());
  });

  it('does not invent cooldown from unrelated timestamps', () => {
    const signal = parseDiscordTowerGuardMessage({
      id: 'message-4',
      channelId: 'tower-guard',
      authorId: 'dragon-bot',
      authorName: 'Dragon',
      createdAt: '2026-08-27T02:13:32.994Z',
      editedAt: null,
      content: 'Вишка №50\nБій: <t:1789277401:f>\nЗахист впав.',
      embeds: [],
    });

    expect(signal?.cooldownAt).toBeNull();
  });
});
