import { describe, expect, it } from 'vitest';
import { normalizeDiscordGuildMember } from './guild-member-reader.js';

describe('normalizeDiscordGuildMember', () => {
  it('normalizes Discord guild member data', () => {
    const joinedAt = new Date('2026-07-20T10:00:00.000Z');
    const member = normalizeDiscordGuildMember('guild-1', {
      nickname: 'Dragon Nick',
      joinedAt,
      displayAvatarURL: () => 'https://cdn.discordapp.com/avatar.png',
      user: {
        id: 'discord-1',
        username: 'dragon_user',
        globalName: 'Dragon User',
        bot: false,
      },
      roles: {
        cache: new Map([
          ['guild-1', { id: 'guild-1' }],
          ['role-2', { id: 'role-2' }],
          ['role-1', { id: 'role-1' }],
        ]),
      },
    });

    expect(member).toEqual({
      discordUserId: 'discord-1',
      username: 'dragon_user',
      globalName: 'Dragon User',
      serverNickname: 'Dragon Nick',
      avatarUrl: 'https://cdn.discordapp.com/avatar.png',
      guildId: 'guild-1',
      roleIds: ['role-1', 'role-2'],
      joinedAt: joinedAt.toISOString(),
      bot: false,
    });
  });
});
