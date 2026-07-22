import type { DiscordAccountLink } from '../types.js';

export interface DiscordAccountLinkRepository {
  getByFamilyMemberId(familyMemberId: string): Promise<DiscordAccountLink | null>;
  getByDiscordUserId(discordUserId: string): Promise<DiscordAccountLink | null>;
  save(link: DiscordAccountLink): Promise<DiscordAccountLink>;
  deleteByFamilyMemberId(familyMemberId: string): Promise<boolean>;
  clear(): Promise<void>;
}

export class DuplicateDiscordAccountLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateDiscordAccountLinkError';
  }
}

export class InMemoryDiscordAccountLinkRepository implements DiscordAccountLinkRepository {
  private readonly linksByFamilyMemberId = new Map<string, DiscordAccountLink>();

  private readonly familyMemberIdByDiscordUserId = new Map<string, string>();

  async getByFamilyMemberId(familyMemberId: string): Promise<DiscordAccountLink | null> {
    return this.linksByFamilyMemberId.get(familyMemberId) ?? null;
  }

  async getByDiscordUserId(discordUserId: string): Promise<DiscordAccountLink | null> {
    const familyMemberId = this.familyMemberIdByDiscordUserId.get(discordUserId);
    if (!familyMemberId) return null;
    return this.linksByFamilyMemberId.get(familyMemberId) ?? null;
  }

  async save(link: DiscordAccountLink): Promise<DiscordAccountLink> {
    const existingFamilyLink = await this.getByFamilyMemberId(link.familyMemberId);
    if (existingFamilyLink && existingFamilyLink.discordUserId !== link.discordUserId) {
      throw new DuplicateDiscordAccountLinkError('Family member already has a linked Discord account');
    }

    const existingDiscordLink = await this.getByDiscordUserId(link.discordUserId);
    if (existingDiscordLink && existingDiscordLink.familyMemberId !== link.familyMemberId) {
      throw new DuplicateDiscordAccountLinkError('Discord account is already linked to another family member');
    }

    this.linksByFamilyMemberId.set(link.familyMemberId, link);
    this.familyMemberIdByDiscordUserId.set(link.discordUserId, link.familyMemberId);
    return link;
  }

  async deleteByFamilyMemberId(familyMemberId: string): Promise<boolean> {
    const existingLink = await this.getByFamilyMemberId(familyMemberId);
    if (!existingLink) return false;
    this.linksByFamilyMemberId.delete(familyMemberId);
    this.familyMemberIdByDiscordUserId.delete(existingLink.discordUserId);
    return true;
  }

  async clear(): Promise<void> {
    this.linksByFamilyMemberId.clear();
    this.familyMemberIdByDiscordUserId.clear();
  }
}
