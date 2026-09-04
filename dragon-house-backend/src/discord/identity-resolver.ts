import type { DiscordAccountLinkRepository } from './account-link-repository.js';
import type { FamilyMemberRepository } from '../members/member-repository.js';
import type { DiscordResolvedIdentity } from './orchestration-models.js';

export type DiscordIdentityErrorCode =
  | 'DISCORD_ACCOUNT_NOT_LINKED'
  | 'DISCORD_LINKED_MEMBER_NOT_FOUND'
  | 'DISCORD_LINKED_MEMBER_INACTIVE';

export class DiscordIdentityError extends Error {
  constructor(
    readonly code: DiscordIdentityErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export class DiscordIdentityResolver {
  constructor(
    private readonly accountLinks: DiscordAccountLinkRepository,
    private readonly members: FamilyMemberRepository,
  ) {}

  async resolve(discordUserId: string): Promise<DiscordResolvedIdentity> {
    const link = await this.accountLinks.getByDiscordUserId(discordUserId);
    if (!link) {
      throw new DiscordIdentityError('DISCORD_ACCOUNT_NOT_LINKED', 'Discord account is not linked.', { discordUserId });
    }
    const member = await this.members.findById(link.familyMemberId);
    if (!member || member.deletedAt) {
      throw new DiscordIdentityError('DISCORD_LINKED_MEMBER_NOT_FOUND', 'Linked family member was not found.', {
        discordUserId,
        familyMemberId: link.familyMemberId,
      });
    }
    if (member.status !== 'active') {
      throw new DiscordIdentityError('DISCORD_LINKED_MEMBER_INACTIVE', 'Linked family member is inactive.', {
        discordUserId,
        familyMemberId: member.id,
      });
    }
    return {
      discordUserId,
      familyMember: member,
      auth: {
        familyMemberId: member.id,
        role: member.role,
        rank: member.rank,
        status: member.status,
        permissions: member.permissions,
      },
    };
  }
}
