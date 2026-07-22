import { describe, expect, it } from 'vitest';
import {
  DuplicateDiscordAccountLinkError,
  InMemoryDiscordAccountLinkRepository,
} from './account-link-repository.js';
import type { DiscordAccountLink } from '../types.js';

function createLink(familyMemberId: string, discordUserId: string): DiscordAccountLink {
  const now = new Date('2026-07-17T00:00:00.000Z').toISOString();
  return {
    familyMemberId,
    discordUserId,
    discordUsername: `discord-${discordUserId}`,
    discordGlobalName: null,
    discordAvatarUrl: null,
    guildMemberVerified: true,
    linkedAt: now,
    updatedAt: now,
  };
}

describe('Discord account link repository', () => {
  it('rejects duplicate familyMemberId', async () => {
    const repository = new InMemoryDiscordAccountLinkRepository();
    await repository.save(createLink('family-1', 'discord-1'));

    await expect(repository.save(createLink('family-1', 'discord-2'))).rejects.toBeInstanceOf(
      DuplicateDiscordAccountLinkError,
    );
  });

  it('rejects duplicate discordUserId', async () => {
    const repository = new InMemoryDiscordAccountLinkRepository();
    await repository.save(createLink('family-1', 'discord-1'));

    await expect(repository.save(createLink('family-2', 'discord-1'))).rejects.toBeInstanceOf(
      DuplicateDiscordAccountLinkError,
    );
  });
});
