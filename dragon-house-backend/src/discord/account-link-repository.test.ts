import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DuplicateDiscordAccountLinkError,
  InMemoryDiscordAccountLinkRepository,
  PgDiscordAccountLinkRepository,
} from './account-link-repository.js';
import { applyPendingMigrations } from '../db/migrations.js';
import type { DiscordAccountLink } from '../types.js';

function createLink(familyMemberId: string, discordUserId: string): DiscordAccountLink {
  const now = new Date('2026-07-17T00:00:00.000Z').toISOString();
  return {
    familyMemberId,
    discordUserId,
    discordUsername: `discord-${discordUserId}`,
    discordGlobalName: null,
    discordServerNickname: null,
    discordAvatar: null,
    discordAvatarUrl: null,
    guildId: null,
    joinedAt: null,
    leftAt: null,
    lastSyncedAt: null,
    verified: true,
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

const testDatabaseUrl = process.env.DRAGON_HOUSE_TEST_DATABASE_URL;
const describePg = testDatabaseUrl ? describe : describe.skip;

describePg('PgDiscordAccountLinkRepository', () => {
  let pool: pg.Pool;
  const runId = `discord-link-${randomUUID()}`;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: testDatabaseUrl });
    await applyPendingMigrations(pool);
  });

  afterAll(async () => {
    await pool.query('delete from discord_account_links where family_member_id like $1', [`${runId}-%`]);
    await pool.query('delete from family_members where id like $1', [`${runId}-%`]);
    await pool.end();
  });

  async function createMember(suffix: string) {
    await pool.query(
      `insert into family_members (id, nickname, static_id, role, rank, permissions)
       values ($1, $2, $3, 'member', 1, '[]'::jsonb)`,
      [`${runId}-${suffix}`, `${runId}-${suffix}`, `${runId}-static-${suffix}`],
    );
    return `${runId}-${suffix}`;
  }

  it('persists links across repository instances and supports updates', async () => {
    const familyMemberId = await createMember('persistent');
    const firstRepository = new PgDiscordAccountLinkRepository(pool);
    const secondRepository = new PgDiscordAccountLinkRepository(pool);

    await firstRepository.save(createLink(familyMemberId, `${runId}-discord-persistent`));
    const updatedLink = await secondRepository.save({
      ...createLink(familyMemberId, `${runId}-discord-persistent`),
      discordUsername: 'updated-username',
      discordGlobalName: 'Updated Global Name',
      discordServerNickname: 'Server Nickname',
      discordAvatar: 'avatar-hash',
      discordAvatarUrl: 'https://cdn.discordapp.com/avatar.png',
      guildId: `${runId}-guild`,
      joinedAt: '2026-07-01T00:00:00.000Z',
      leftAt: null,
      lastSyncedAt: '2026-07-17T00:06:00.000Z',
      verified: true,
      guildMemberVerified: false,
      updatedAt: new Date('2026-07-17T00:05:00.000Z').toISOString(),
    });

    expect(updatedLink).toMatchObject({
      familyMemberId,
      discordUserId: `${runId}-discord-persistent`,
      discordUsername: 'updated-username',
      discordGlobalName: 'Updated Global Name',
      discordServerNickname: 'Server Nickname',
      discordAvatar: 'avatar-hash',
      discordAvatarUrl: 'https://cdn.discordapp.com/avatar.png',
      guildId: `${runId}-guild`,
      joinedAt: '2026-07-01T00:00:00.000Z',
      leftAt: null,
      lastSyncedAt: '2026-07-17T00:06:00.000Z',
      verified: true,
      guildMemberVerified: false,
    });
    expect(await secondRepository.getByFamilyMemberId(familyMemberId)).toMatchObject(updatedLink);
    expect(await secondRepository.getByDiscordUserId(`${runId}-discord-persistent`)).toMatchObject(updatedLink);
  });

  it('rejects duplicate family and Discord user links', async () => {
    const firstFamilyMemberId = await createMember('duplicate-one');
    const secondFamilyMemberId = await createMember('duplicate-two');
    const repository = new PgDiscordAccountLinkRepository(pool);
    await repository.save(createLink(firstFamilyMemberId, `${runId}-discord-duplicate`));

    await expect(repository.save(createLink(firstFamilyMemberId, `${runId}-discord-other`))).rejects.toBeInstanceOf(
      DuplicateDiscordAccountLinkError,
    );
    await expect(repository.save(createLink(secondFamilyMemberId, `${runId}-discord-duplicate`))).rejects.toBeInstanceOf(
      DuplicateDiscordAccountLinkError,
    );
  });

  it('deletes only the requested family member link', async () => {
    const firstFamilyMemberId = await createMember('delete-one');
    const secondFamilyMemberId = await createMember('delete-two');
    const repository = new PgDiscordAccountLinkRepository(pool);
    await repository.save(createLink(firstFamilyMemberId, `${runId}-discord-delete-one`));
    await repository.save(createLink(secondFamilyMemberId, `${runId}-discord-delete-two`));

    expect(await repository.deleteByFamilyMemberId(firstFamilyMemberId)).toBe(true);
    expect(await repository.deleteByFamilyMemberId(firstFamilyMemberId)).toBe(false);
    expect(await repository.getByFamilyMemberId(firstFamilyMemberId)).toBeNull();
    expect(await repository.getByFamilyMemberId(secondFamilyMemberId)).not.toBeNull();
  });

  it('propagates database errors after rolling back failed writes', async () => {
    const repository = new PgDiscordAccountLinkRepository({
      connect: async () => ({
        query: async (sql: string) => {
          if (sql === 'begin' || sql === 'rollback') return { rows: [], rowCount: 0 };
          throw new Error('database unavailable');
        },
        release: () => undefined,
      }),
    } as unknown as pg.Pool);

    await expect(repository.save(createLink('family-error', 'discord-error'))).rejects.toThrow('database unavailable');
  });
});
