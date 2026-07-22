import { describe, expect, it } from 'vitest';
import { MemoryFamilyMemberRepository } from '../members/member-repository.js';
import type { FamilyMember, NormalizedDiscordGuildMember } from '../types.js';
import { createTestConfig } from '../test/test-config.js';
import { InMemoryDiscordRoleMappingRepository } from './role-mapping-repository.js';
import { DiscordMemberSyncDryRunService } from './member-sync-dry-run-service.js';

const now = '2026-07-20T10:00:00.000Z';

function discordMember(input: Partial<NormalizedDiscordGuildMember> = {}): NormalizedDiscordGuildMember {
  return {
    discordUserId: input.discordUserId ?? 'discord-1',
    username: input.username ?? 'dragon_user',
    globalName: input.globalName ?? 'Dragon User',
    serverNickname: input.serverNickname ?? 'Dragon Nick',
    avatarUrl: input.avatarUrl ?? 'https://cdn.discordapp.com/avatars/discord-1/avatar.png?size=128',
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
    permissionsDiscord: input.permissionsDiscord ?? input.permissions ?? ['view_members'],
    permissionsDenied: input.permissionsDenied ?? [],
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
      discordAvatar: 'avatar',
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
    mappingType: 'primary_hierarchy',
    familyRole: 'member',
    rank: 1,
    permissions: ['view_members'],
    priority: 10,
    enabled: true,
  });
  await mappings.save({
    discordRoleId: 'role-deputy',
    discordRoleName: 'Deputy',
    mappingType: 'primary_hierarchy',
    familyRole: 'deputy',
    rank: 8,
    permissions: ['view_members', 'manage_members'],
    priority: 20,
    enabled: true,
  });
  await mappings.save({
    discordRoleId: 'role-egg',
    discordRoleName: 'Яйце дракона',
    mappingType: 'primary_hierarchy',
    familyRole: 'member',
    rank: 1,
    permissions: ['view_members'],
    priority: 100,
    enabled: true,
  });
  await mappings.save({
    discordRoleId: 'role-mini',
    discordRoleName: 'Міні-Спопеляка',
    mappingType: 'primary_hierarchy',
    familyRole: 'member',
    rank: 2,
    permissions: ['view_members'],
    priority: 200,
    enabled: true,
  });
  await mappings.save({
    discordRoleId: 'role-smoketail',
    discordRoleName: 'Димохвіст',
    mappingType: 'primary_hierarchy',
    familyRole: 'member',
    rank: 3,
    permissions: ['view_members'],
    priority: 300,
    enabled: true,
  });
  await mappings.save({
    discordRoleId: 'role-family',
    discordRoleName: '🐲 Член сім’ї',
    mappingType: 'additional_functional',
    familyRole: null,
    rank: null,
    permissions: ['view_members'],
    priority: 10,
    enabled: true,
  });
  await mappings.save({
    discordRoleId: 'role-moder',
    discordRoleName: 'Модер',
    mappingType: 'additional_functional',
    familyRole: null,
    rank: null,
    permissions: ['view_members', 'manage_members'],
    priority: 20,
    enabled: true,
  });
  await mappings.save({
    discordRoleId: 'role-senior',
    discordRoleName: '🐉 Старші дракони',
    mappingType: 'additional_functional',
    familyRole: null,
    rank: null,
    permissions: ['view_members'],
    priority: 15,
    enabled: true,
  });
  await mappings.save({
    discordRoleId: 'role-ignored',
    discordRoleName: 'Друг Сімїї',
    mappingType: 'ignored',
    familyRole: null,
    rank: null,
    permissions: [],
    grantsPermissions: false,
    priority: 0,
    enabled: true,
  });
  return {
    service: new DiscordMemberSyncDryRunService(
      { fetchGuildMembers: async () => discordMembers },
      members,
      mappings,
      createTestConfig({
        discord: {
          sync: {
            protectedOwnerMemberId: '62103018-69e7-4baf-844a-2d8b7f2dfc78',
            protectedOwnerDiscordUserId: '906973126783537242',
          },
        },
      }),
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
    expect(result.actions[0]?.primaryRank).toMatchObject({ familyRole: 'deputy', rank: 8 });
    expect(result.actions[0]?.promotionRank).toBe(8);
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

  it('keeps Яйце дракона as primary rank and merges Член сім’ї plus Модер permissions', async () => {
    const { service } = await createService([
      discordMember({ roleIds: ['role-egg', 'role-family', 'role-moder'] }),
    ]);

    const result = await service.run(new Date(now));

    expect(result.summary.create).toBe(1);
    expect(result.actions[0]).toMatchObject({
      promotionRank: 1,
      primaryDiscordRoleId: 'role-egg',
      primaryDiscordRoleName: 'Яйце дракона',
    });
    expect(result.actions[0]?.additionalRoles.map((role) => role.discordRoleId)).toEqual(['role-moder', 'role-family']);
    expect(result.actions[0]?.effectivePermissions.sort()).toEqual(['manage_members', 'view_members']);
  });

  it('keeps Димохвіст as primary rank with Старші дракони and Член сім’ї as additional roles', async () => {
    const { service } = await createService([
      discordMember({ roleIds: ['role-smoketail', 'role-senior', 'role-family'] }),
    ]);

    const result = await service.run(new Date(now));

    expect(result.actions[0]).toMatchObject({ promotionRank: 3, primaryDiscordRoleId: 'role-smoketail' });
    expect(result.actions[0]?.additionalRoles.map((role) => role.discordRoleId)).toEqual(['role-senior', 'role-family']);
    expect(result.actions[0]?.effectivePermissions).toEqual(['view_members']);
  });

  it('selects Міні-Спопеляка over lower Яйце дракона primary rank', async () => {
    const { service } = await createService([
      discordMember({ roleIds: ['role-mini', 'role-egg', 'role-family'] }),
    ]);

    const result = await service.run(new Date(now));

    expect(result.actions[0]).toMatchObject({ promotionRank: 2, primaryDiscordRoleId: 'role-mini' });
    expect(result.actions[0]?.additionalRoles.map((role) => role.discordRoleId)).toEqual(['role-family']);
  });

  it('reports conflict when only additional roles exist without primary hierarchy rank', async () => {
    const { service } = await createService([
      discordMember({ roleIds: ['role-family', 'role-moder'] }),
    ]);

    const result = await service.run(new Date(now));

    expect(result.summary.conflict).toBe(1);
    expect(result.actions[0]?.reason).toBe('missing_primary_hierarchy_role');
    expect(result.actions[0]?.additionalRoles.map((role) => role.discordRoleId)).toEqual(['role-moder', 'role-family']);
  });

  it('does not create conflicts for ignored roles when a primary role is present', async () => {
    const { service } = await createService([
      discordMember({ roleIds: ['role-egg', 'role-ignored'] }),
    ]);

    const result = await service.run(new Date(now));

    expect(result.summary.create).toBe(1);
    expect(result.summary.conflict).toBe(0);
    expect(result.missingRoleMappings).toEqual([]);
    expect(result.actions[0]?.matchedIgnoredRoles).toEqual([
      { discordRoleId: 'role-ignored', discordRoleName: 'Друг Сімїї' },
    ]);
  });

  it('additional roles never alter promotion rank', async () => {
    const { service } = await createService([
      discordMember({ roleIds: ['role-egg', 'role-moder', 'role-senior'] }),
    ]);

    const result = await service.run(new Date(now));

    expect(result.actions[0]?.promotionRank).toBe(1);
    expect(result.actions[0]?.primaryDiscordRoleId).toBe('role-egg');
    expect(result.actions[0]?.effectivePermissions.sort()).toEqual(['manage_members', 'view_members']);
  });

  it('selects higher primary rank even when lower rank has higher priority', async () => {
    const { service, mappings } = await createService([
      discordMember({ roleIds: ['role-low-priority-rank-2', 'role-high-priority-rank-1'] }),
    ]);
    await mappings.save({
      discordRoleId: 'role-high-priority-rank-1',
      discordRoleName: 'Яйце дракона',
      mappingType: 'primary_hierarchy',
      familyRole: 'member',
      rank: 1,
      permissions: ['view_members'],
      priority: 999,
      enabled: true,
    });
    await mappings.save({
      discordRoleId: 'role-low-priority-rank-2',
      discordRoleName: 'Міні-Спопеляка',
      mappingType: 'primary_hierarchy',
      familyRole: 'member',
      rank: 2,
      permissions: ['view_members'],
      priority: 1,
      enabled: true,
    });

    const result = await service.run(new Date(now));

    expect(result.actions[0]).toMatchObject({
      promotionRank: 2,
      primaryDiscordRoleId: 'role-low-priority-rank-2',
    });
  });

  it('ignores disabled highest-rank primary mapping', async () => {
    const { service, mappings } = await createService([
      discordMember({ roleIds: ['role-disabled-owner', 'role-mini'] }),
    ]);
    await mappings.save({
      discordRoleId: 'role-disabled-owner',
      discordRoleName: 'Disabled Owner',
      mappingType: 'primary_hierarchy',
      familyRole: 'owner',
      rank: 10,
      permissions: ['view_members', 'manage_members'],
      priority: 1000,
      enabled: false,
    });

    const result = await service.run(new Date(now));

    expect(result.actions[0]).toMatchObject({ promotionRank: 2, primaryDiscordRoleId: 'role-mini' });
  });

  it('disabled additional mapping grants no permissions', async () => {
    const { service, mappings } = await createService([
      discordMember({ roleIds: ['role-egg', 'role-disabled-additional'] }),
    ]);
    await mappings.save({
      discordRoleId: 'role-disabled-additional',
      discordRoleName: 'Disabled Additional',
      mappingType: 'additional_functional',
      familyRole: null,
      rank: null,
      permissions: ['manage_members'],
      priority: 100,
      enabled: false,
    });

    const result = await service.run(new Date(now));

    expect(result.actions[0]?.additionalRoles).toEqual([]);
    expect(result.actions[0]?.effectivePermissions).toEqual(['view_members']);
  });

  it('additional role with grantsPermissions false grants no permissions', async () => {
    const { service, mappings } = await createService([
      discordMember({ roleIds: ['role-egg', 'role-label-only'] }),
    ]);
    await mappings.save({
      discordRoleId: 'role-label-only',
      discordRoleName: 'Label Only',
      mappingType: 'additional_functional',
      familyRole: null,
      rank: null,
      permissions: ['manage_members'],
      grantsPermissions: false,
      priority: 100,
      enabled: true,
    });

    const result = await service.run(new Date(now));

    expect(result.actions[0]?.additionalRoles).toEqual([
      { discordRoleId: 'role-label-only', discordRoleName: 'Label Only', permissions: [], priority: 100 },
    ]);
    expect(result.actions[0]?.effectivePermissions).toEqual(['view_members']);
  });

  it('reports unknown role mixed with a valid primary in missingRoleMappings', async () => {
    const { service } = await createService([
      discordMember({ roleIds: ['role-egg', 'unknown-role'] }),
    ]);

    const result = await service.run(new Date(now));

    expect(result.summary.create).toBe(1);
    expect(result.missingRoleMappings).toEqual(['unknown-role']);
    expect(result.actions[0]?.warnings).toContain('Member has Discord roles without active Family Hub mappings.');
  });

  it('keeps existing member unchanged when identical permissions have different ordering', async () => {
    const existing = familyMember({
      permissions: ['view_members', 'manage_members'],
      role: 'member',
      rank: 1,
    });
    const { service } = await createService([
      discordMember({ roleIds: ['role-egg', 'role-moder'] }),
    ], [existing]);

    const result = await service.run(new Date(now));

    expect(result.summary.unchanged).toBe(1);
    expect(result.actions[0]?.changes).toEqual([]);
    expect(result.actions[0]?.effectivePermissions).toEqual(['manage_members', 'view_members']);
  });

  it('orders additional roles deterministically when priorities tie', async () => {
    const { service, mappings } = await createService([
      discordMember({ roleIds: ['role-egg', 'role-extra-b', 'role-extra-a'] }),
    ]);
    for (const discordRoleId of ['role-extra-b', 'role-extra-a']) {
      await mappings.save({
        discordRoleId,
        discordRoleName: discordRoleId,
        mappingType: 'additional_functional',
        familyRole: null,
        rank: null,
        permissions: ['view_members'],
        priority: 50,
        enabled: true,
      });
    }

    const result = await service.run(new Date(now));

    expect(result.actions[0]?.additionalRoles.map((role) => role.discordRoleId)).toEqual([
      'role-extra-a',
      'role-extra-b',
    ]);
  });

  it('ignored role with non-empty permissions still grants nothing', async () => {
    const { service, mappings } = await createService([
      discordMember({ roleIds: ['role-egg', 'role-ignored-dangerous'] }),
    ]);
    await mappings.save({
      discordRoleId: 'role-ignored-dangerous',
      discordRoleName: 'Ignored Dangerous',
      mappingType: 'ignored',
      familyRole: null,
      rank: null,
      permissions: ['manage_members'],
      grantsPermissions: true,
      priority: 1000,
      enabled: true,
    });

    const result = await service.run(new Date(now));

    expect(result.summary.create).toBe(1);
    expect(result.missingRoleMappings).toEqual([]);
    expect(result.actions[0]?.effectivePermissions).toEqual(['view_members']);
    expect(result.actions[0]?.matchedIgnoredRoles).toEqual([
      { discordRoleId: 'role-ignored-dangerous', discordRoleName: 'Ignored Dangerous' },
    ]);
  });

  it('never reduces protected owner permissions from Discord mappings', async () => {
    const ownerPermissions = ['view_members', 'manage_roles', 'manage_family_economy'] as const;
    const owner = familyMember({
      id: '62103018-69e7-4baf-844a-2d8b7f2dfc78',
      role: 'owner',
      rank: 10,
      permissions: [...ownerPermissions],
      permissionsOverride: [...ownerPermissions],
      permissionsDiscord: ['view_members'],
      discord: {
        ...familyMember().discord,
        linked: true,
        discordUserId: '906973126783537242',
      },
    });
    const { service } = await createService([
      discordMember({ discordUserId: '906973126783537242', roleIds: ['role-member'] }),
    ], [owner]);

    const result = await service.run(new Date(now));
    const permissionsChange = result.actions[0]?.changes.find((change) => change.field === 'permissions');

    expect(result.actions[0]).toMatchObject({ primaryRank: { familyRole: 'owner', rank: 10 } });
    expect(permissionsChange?.proposed).toEqual(expect.arrayContaining([...ownerPermissions]));
    expect(result.actions[0]?.warnings).not.toContain('Dry-run includes a role or permission change that could revoke access.');
  });

  it('does not let Discord mappings downgrade the protected owner role', async () => {
    const owner = familyMember({
      id: '62103018-69e7-4baf-844a-2d8b7f2dfc78',
      role: 'owner',
      rank: 10,
      permissions: ['view_members'],
      permissionsOverride: ['view_members'],
      permissionsDiscord: ['view_members'],
      discord: {
        ...familyMember().discord,
        linked: true,
        discordUserId: '906973126783537242',
      },
    });
    const { service } = await createService([
      discordMember({ discordUserId: '906973126783537242', roleIds: ['role-member'] }),
    ], [owner]);

    const result = await service.run(new Date(now));

    expect(result.actions[0]?.changes.map((change) => change.field)).not.toContain('role');
    expect(result.actions[0]?.changes.map((change) => change.field)).not.toContain('rank');
    expect(result.actions[0]?.primaryRank).toMatchObject({ familyRole: 'owner', rank: 10 });
    expect(result.actions[0]?.warnings).toContain('Discord mapping conflicts with protected owner identity; dry-run preserves owner role and rank.');
  });

  it('preserves manual permissions across repeated dry-runs', async () => {
    const linked = familyMember({
      permissions: ['view_members', 'manage_family_map'],
      permissionsOverride: ['manage_family_map'],
      permissionsDiscord: ['view_members'],
    });
    const { service } = await createService([discordMember()], [linked]);

    const first = await service.run(new Date(now));
    const second = await service.run(new Date(now));

    expect(first.summary.unchanged).toBe(1);
    expect(second.summary.unchanged).toBe(1);
    expect(first.actions[0]?.effectivePermissions).toEqual(['manage_family_map', 'view_members']);
    expect(second.actions[0]?.effectivePermissions).toEqual(['manage_family_map', 'view_members']);
  });

  it('adds Discord-derived permissions when a mapped role is gained', async () => {
    const linked = familyMember({
      permissions: ['view_members'],
      permissionsOverride: [],
      permissionsDiscord: ['view_members'],
    });
    const { service } = await createService([
      discordMember({ roleIds: ['role-member', 'role-moder'] }),
    ], [linked]);

    const result = await service.run(new Date(now));

    expect(result.summary.update).toBe(1);
    expect(result.actions[0]?.changes).toEqual(expect.arrayContaining([
      { field: 'permissions_discord', current: ['view_members'], proposed: ['manage_members', 'view_members'] },
      { field: 'permissions', current: ['view_members'], proposed: ['manage_members', 'view_members'] },
    ]));
  });

  it('removes permissions that were granted only by a lost Discord role', async () => {
    const linked = familyMember({
      permissions: ['manage_members', 'view_members'],
      permissionsOverride: [],
      permissionsDiscord: ['manage_members', 'view_members'],
    });
    const { service } = await createService([discordMember({ roleIds: ['role-member'] })], [linked]);

    const result = await service.run(new Date(now));

    expect(result.summary.update).toBe(1);
    expect(result.actions[0]?.changes).toEqual(expect.arrayContaining([
      { field: 'permissions_discord', current: ['manage_members', 'view_members'], proposed: ['view_members'] },
      { field: 'permissions', current: ['manage_members', 'view_members'], proposed: ['view_members'] },
    ]));
  });

  it('does not remove unrelated manual permissions when a Discord role is lost', async () => {
    const linked = familyMember({
      permissions: ['manage_family_map', 'manage_members', 'view_members'],
      permissionsOverride: ['manage_family_map'],
      permissionsDiscord: ['manage_members', 'view_members'],
    });
    const { service } = await createService([discordMember({ roleIds: ['role-member'] })], [linked]);

    const result = await service.run(new Date(now));

    expect(result.summary.update).toBe(1);
    expect(result.actions[0]?.effectivePermissions).toEqual(['manage_family_map', 'view_members']);
    expect(result.actions[0]?.changes).toEqual(expect.arrayContaining([
      {
        field: 'permissions',
        current: ['manage_family_map', 'manage_members', 'view_members'],
        proposed: ['manage_family_map', 'view_members'],
      },
    ]));
  });

  it('keeps manual denials after system, Discord and manual grants while preserving protected owner access', async () => {
    const linked = familyMember({
      permissions: ['view_members'],
      permissionsOverride: ['manage_members'],
      permissionsDenied: ['manage_members'],
      permissionsDiscord: ['view_members'],
    });
    const { service } = await createService([
      discordMember({ roleIds: ['role-member', 'role-moder'] }),
    ], [linked]);

    const result = await service.run(new Date(now));

    expect(result.actions[0]?.effectivePermissions).toEqual(['view_members']);
    expect(result.actions[0]?.permissionSources).toMatchObject({
      discordMappedPermissions: ['manage_members', 'view_members'],
      manualGrantedPermissions: ['manage_members'],
      manualDeniedPermissions: ['manage_members'],
    });
  });

  it('does not mutate existing Discord account links or member records during dry-run', async () => {
    const linked = familyMember();
    const before = JSON.stringify(linked);
    const { service } = await createService([discordMember()], [linked]);

    await service.run(new Date(now));

    expect(JSON.stringify(linked)).toBe(before);
    expect(linked.discord?.discordUserId).toBe('discord-1');
  });
});
