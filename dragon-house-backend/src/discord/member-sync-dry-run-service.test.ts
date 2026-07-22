import { describe, expect, it } from 'vitest';
import { MemoryFamilyMemberRepository } from '../members/member-repository.js';
import type { FamilyMember, NormalizedDiscordGuildMember } from '../types.js';
import { InMemoryDiscordRoleMappingRepository } from './role-mapping-repository.js';
import { DiscordMemberSyncDryRunService } from './member-sync-dry-run-service.js';

const now = '2026-07-20T10:00:00.000Z';

function discordMember(input: Partial<NormalizedDiscordGuildMember> = {}): NormalizedDiscordGuildMember {
  return {
    discordUserId: input.discordUserId ?? 'discord-1',
    username: input.username ?? 'dragon_user',
    globalName: input.globalName ?? 'Dragon User',
    serverNickname: input.serverNickname ?? 'Dragon Nick',
    avatarUrl: input.avatarUrl ?? 'https://cdn.discordapp.com/avatar.png',
    guildId: input.guildId ?? 'guild-1',
    roleIds: input.roleIds ?? ['role-member'],
    joinedAt: input.joinedAt ?? now,
    bot: input.bot ?? false,
  };
}

function familyMember(input: Partial<FamilyMember> = {}): FamilyMember {
  const id = input.id ?? 'family-1';
  return {
    id,
    nickname: input.nickname ?? 'Dragon Nick',
    staticId: input.staticId ?? id,
    role: input.role ?? 'member',
    rank: input.rank ?? 1,
    status: input.status ?? 'active',
    avatarAssetId: input.avatarAssetId ?? null,
    notes: input.notes ?? null,
    joinedAt: input.joinedAt ?? null,
    permissions: input.permissions ?? ['view_members'],
    permissionsOverride: input.permissionsOverride ?? [],
    onboardingMetadata: input.onboardingMetadata ?? {},
    profileMetadata: input.profileMetadata ?? {},
    deletedAt: input.deletedAt ?? null,
    version: input.version ?? 1,
    createdByFamilyMemberId: input.createdByFamilyMemberId ?? null,
    updatedByFamilyMemberId: input.updatedByFamilyMemberId ?? null,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    discord: input.discord ?? {
      linked: true,
      discordUserId: 'discord-1',
      discordUsername: 'dragon_user',
      discordGlobalName: 'Dragon User',
      discordServerNickname: 'Dragon Nick',
      discordAvatar: 'https://cdn.discordapp.com/avatar.png',
      guildId: 'guild-1',
      joinedAt: now,
      verified: true,
      linkedAt: now,
    },
  };
}

async function createService(discordMembers: NormalizedDiscordGuildMember[], familyMembers: FamilyMember[] = []) {
  const members = new MemoryFamilyMemberRepository(familyMembers);
  const mappings = new InMemoryDiscordRoleMappingRepository();
  await mappings.save({
    discordRoleId: 'role-member',
    discordRoleName: 'Family Member',
    familyRole: 'member',
    rank: 1,
    permissions: ['view_members'],
    priority: 10,
    enabled: true,
  });
  await mappings.save({
    discordRoleId: 'role-deputy',
    discordRoleName: 'Deputy',
    familyRole: 'deputy',
    rank: 8,
    permissions: ['view_members', 'manage_members'],
    priority: 20,
    enabled: true,
  });
  return {
    service: new DiscordMemberSyncDryRunService(
      { fetchGuildMembers: async () => discordMembers },
      members,
      mappings,
    ),
    mappings,
  };
}

describe('DiscordMemberSyncDryRunService', () => {
  it('classifies bot accounts as ignored', async () => {
    const { service } = await createService([discordMember({ bot: true })]);

    const result = await service.run(new Date(now));

    expect(result.summary.ignored_bot).toBe(1);
    expect(result.actions[0]?.action).toBe('ignored_bot');
  });

  it('matches only by discord_user_id and reports possible manual links', async () => {
    const local = familyMember({ discord: { linked: false }, nickname: 'Dragon Nick' });
    const { service } = await createService([discordMember()], [local]);

    const result = await service.run(new Date(now));

    expect(result.actions[0]).toMatchObject({
      action: 'create',
      matchedBy: 'none',
      possibleManualLinkFamilyMemberIds: ['family-1'],
    });
  });

  it('classifies unchanged exact Discord links', async () => {
    const { service } = await createService([discordMember()], [familyMember()]);

    const result = await service.run(new Date(now));

    expect(result.summary.unchanged).toBe(1);
    expect(result.actions[0]?.changes).toEqual([]);
  });

  it('classifies updates and uses highest-priority role mapping', async () => {
    const { service } = await createService(
      [discordMember({ username: 'new_name', roleIds: ['role-member', 'role-deputy'] })],
      [familyMember()],
    );

    const result = await service.run(new Date(now));

    expect(result.summary.update).toBe(1);
    expect(result.actions[0]?.proposedRole).toMatchObject({ familyRole: 'deputy', rank: 8 });
    expect(result.actions[0]?.changes.map((change) => change.field)).toContain('discord_username');
    expect(result.actions[0]?.changes.map((change) => change.field)).toContain('role');
  });

  it('classifies new Discord members as create', async () => {
    const { service } = await createService([discordMember()]);

    const result = await service.run(new Date(now));

    expect(result.summary.create).toBe(1);
    expect(result.actions[0]?.changes.map((change) => change.field)).toContain('discord_user_id');
  });

  it('classifies linked active Family Hub members absent from Discord as deactivate candidates', async () => {
    const { service } = await createService([], [familyMember()]);

    const result = await service.run(new Date(now));

    expect(result.summary.deactivate_candidate).toBe(1);
    expect(result.actions[0]?.warnings).toContain('Member is active in Family Hub but absent from the Discord guild.');
  });

  it('reports unknown and missing role mappings as conflicts', async () => {
    const { service } = await createService([discordMember({ roleIds: ['unknown-role'] })]);

    const result = await service.run(new Date(now));

    expect(result.summary.conflict).toBe(1);
    expect(result.missingRoleMappings).toEqual(['unknown-role']);
  });

  it('detects duplicate Discord user IDs in the guild payload', async () => {
    const { service } = await createService([
      discordMember({ discordUserId: 'duplicate-id' }),
      discordMember({ discordUserId: 'duplicate-id', username: 'duplicate_two' }),
    ]);

    const result = await service.run(new Date(now));

    expect(result.summary.conflict).toBe(1);
    expect(result.conflicts[0]).toContain('Duplicate Discord user ID');
  });

  it('detects duplicate Family Hub Discord links', async () => {
    const first = familyMember({ id: 'family-1', discord: { ...familyMember().discord, linked: true, discordUserId: 'discord-1' } });
    const second = familyMember({ id: 'family-2', discord: { ...familyMember().discord, linked: true, discordUserId: 'discord-1' } });
    const { service } = await createService([discordMember()], [first, second]);

    const result = await service.run(new Date(now));

    expect(result.conflicts[0]).toContain('Duplicate Family Hub Discord link');
  });
});
