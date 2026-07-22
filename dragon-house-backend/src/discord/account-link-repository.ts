import type pg from 'pg';
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

type DiscordAccountLinkRow = {
  family_member_id: string;
  discord_user_id: string;
  discord_username: string;
  discord_global_name: string | null;
  discord_server_nickname: string | null;
  discord_avatar: string | null;
  discord_avatar_url: string | null;
  guild_id: string | null;
  joined_at: Date | null;
  left_at: Date | null;
  last_synced_at: Date | null;
  verified: boolean;
  guild_member_verified: boolean;
  linked_at: Date;
  updated_at: Date;
};

export class PgDiscordAccountLinkRepository implements DiscordAccountLinkRepository {
  constructor(private readonly pool: pg.Pool) {}

  async getByFamilyMemberId(familyMemberId: string): Promise<DiscordAccountLink | null> {
    const result = await this.pool.query<DiscordAccountLinkRow>(
      'select * from discord_account_links where family_member_id = $1 limit 1',
      [familyMemberId],
    );
    return result.rows[0] ? mapDiscordAccountLink(result.rows[0]) : null;
  }

  async getByDiscordUserId(discordUserId: string): Promise<DiscordAccountLink | null> {
    const result = await this.pool.query<DiscordAccountLinkRow>(
      'select * from discord_account_links where discord_user_id = $1 limit 1',
      [discordUserId],
    );
    return result.rows[0] ? mapDiscordAccountLink(result.rows[0]) : null;
  }

  async save(link: DiscordAccountLink): Promise<DiscordAccountLink> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const existingFamilyLink = await client.query<Pick<DiscordAccountLinkRow, 'discord_user_id'>>(
        'select discord_user_id from discord_account_links where family_member_id = $1 for update',
        [link.familyMemberId],
      );
      if (existingFamilyLink.rows[0] && existingFamilyLink.rows[0].discord_user_id !== link.discordUserId) {
        throw new DuplicateDiscordAccountLinkError('Family member already has a linked Discord account');
      }

      const existingDiscordLink = await client.query<Pick<DiscordAccountLinkRow, 'family_member_id'>>(
        'select family_member_id from discord_account_links where discord_user_id = $1 for update',
        [link.discordUserId],
      );
      if (existingDiscordLink.rows[0] && existingDiscordLink.rows[0].family_member_id !== link.familyMemberId) {
        throw new DuplicateDiscordAccountLinkError('Discord account is already linked to another family member');
      }

      const result = await client.query<DiscordAccountLinkRow>(
        `insert into discord_account_links
          (family_member_id, discord_user_id, discord_username, discord_global_name, discord_server_nickname,
           discord_avatar, discord_avatar_url, guild_id, joined_at, left_at, last_synced_at, verified,
           guild_member_verified, linked_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         on conflict (family_member_id) do update
         set discord_username = excluded.discord_username,
             discord_global_name = excluded.discord_global_name,
             discord_server_nickname = excluded.discord_server_nickname,
             discord_avatar = excluded.discord_avatar,
             discord_avatar_url = excluded.discord_avatar_url,
             guild_id = excluded.guild_id,
             joined_at = excluded.joined_at,
             left_at = excluded.left_at,
             last_synced_at = excluded.last_synced_at,
             verified = excluded.verified,
             guild_member_verified = excluded.guild_member_verified,
             updated_at = excluded.updated_at
         returning *`,
        [
          link.familyMemberId,
          link.discordUserId,
          link.discordUsername,
          link.discordGlobalName ?? null,
          link.discordServerNickname ?? null,
          link.discordAvatar ?? link.discordAvatarUrl ?? null,
          link.discordAvatarUrl ?? null,
          link.guildId ?? null,
          link.joinedAt ?? null,
          link.leftAt ?? null,
          link.lastSyncedAt ?? null,
          link.verified ?? link.guildMemberVerified,
          link.guildMemberVerified,
          link.linkedAt,
          link.updatedAt,
        ],
      );
      await client.query('commit');
      return mapDiscordAccountLink(result.rows[0]);
    } catch (error) {
      await client.query('rollback');
      if (isUniqueViolation(error)) {
        throw new DuplicateDiscordAccountLinkError('Discord account link uniqueness constraint failed');
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteByFamilyMemberId(familyMemberId: string): Promise<boolean> {
    const result = await this.pool.query('delete from discord_account_links where family_member_id = $1', [
      familyMemberId,
    ]);
    return (result.rowCount ?? 0) > 0;
  }

  async clear(): Promise<void> {
    await this.pool.query('delete from discord_account_links');
  }
}

function mapDiscordAccountLink(row: DiscordAccountLinkRow): DiscordAccountLink {
  return {
    familyMemberId: row.family_member_id,
    discordUserId: row.discord_user_id,
    discordUsername: row.discord_username,
    discordGlobalName: row.discord_global_name,
    discordServerNickname: row.discord_server_nickname,
    discordAvatar: row.discord_avatar,
    discordAvatarUrl: row.discord_avatar_url,
    guildId: row.guild_id,
    joinedAt: row.joined_at?.toISOString() ?? null,
    leftAt: row.left_at?.toISOString() ?? null,
    lastSyncedAt: row.last_synced_at?.toISOString() ?? null,
    verified: row.verified,
    guildMemberVerified: row.guild_member_verified,
    linkedAt: row.linked_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '23505');
}
