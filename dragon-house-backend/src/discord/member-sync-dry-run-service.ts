import type { DiscordGuildMemberReader } from './guild-member-reader.js';
import type { DiscordRoleMappingRepository } from './role-mapping-repository.js';
import type { FamilyMemberRepository } from '../members/member-repository.js';
import type {
  DiscordMemberSyncChange,
  DiscordMemberSyncAdditionalRole,
  DiscordMemberSyncDryRunItem,
  DiscordMemberSyncDryRunResult,
  DiscordMemberSyncDryRunSummary,
  DiscordMemberSyncIgnoredRole,
  DiscordMemberSyncProposedRole,
  DiscordRoleMapping,
  FamilyMember,
  FamilyPermission,
  NormalizedDiscordGuildMember,
} from '../types.js';

const EMPTY_SUMMARY: DiscordMemberSyncDryRunSummary = {
  create: 0,
  update: 0,
  unchanged: 0,
  deactivate_candidate: 0,
  conflict: 0,
  ignored_bot: 0,
};

export class DiscordMemberSyncDryRunService {
  constructor(
    private readonly reader: DiscordGuildMemberReader,
    private readonly memberRepository: FamilyMemberRepository,
    private readonly roleMappings: DiscordRoleMappingRepository,
  ) {}

  async run(generatedAt = new Date()): Promise<DiscordMemberSyncDryRunResult> {
    const [discordMembers, familyMembers, mappings] = await Promise.all([
      this.reader.fetchGuildMembers(),
      listAllFamilyMembers(this.memberRepository),
      this.roleMappings.list(false),
    ]);
    const activeMappingsByRoleId = new Map(mappings.map((mapping) => [mapping.discordRoleId, mapping]));
    const result: DiscordMemberSyncDryRunResult = {
      generatedAt: generatedAt.toISOString(),
      guildId: discordMembers[0]?.guildId ?? '',
      discordMemberCount: discordMembers.length,
      familyMemberCount: familyMembers.length,
      summary: { ...EMPTY_SUMMARY },
      actions: [],
      warnings: [],
      conflicts: [],
      missingRoleMappings: [],
    };

    const linkedMembersByDiscordId = indexLinkedFamilyMembers(familyMembers, result);
    const seenDiscordIds = new Set<string>();
    const matchedFamilyMemberIds = new Set<string>();
    const missingRoleMappings = new Set<string>();

    for (const discordMember of discordMembers) {
      if (seenDiscordIds.has(discordMember.discordUserId)) {
        addConflict(result, `Duplicate Discord user ID in guild payload: ${discordMember.discordUserId}`);
        addAction(result, conflictAction(discordMember, 'duplicate_discord_user_id'));
        continue;
      }
      seenDiscordIds.add(discordMember.discordUserId);

      if (discordMember.bot) {
        addAction(result, {
          action: 'ignored_bot',
          reason: 'discord_bot_account',
          discordMember,
          matchedBy: 'not_applicable',
          ...resolutionItemFields(emptyRoleResolution()),
          changes: [],
          warnings: ['Bot accounts are excluded from Family Hub member sync by default.'],
          possibleManualLinkFamilyMemberIds: [],
        });
        continue;
      }

      const identityWarnings = missingIdentityWarnings(discordMember);
      const resolution = resolveDiscordRoles(discordMember, mappings);
      const unknownRoles = discordMember.roleIds.filter(
        (roleId) => !activeMappingsByRoleId.has(roleId) && roleId !== discordMember.guildId,
      );
      for (const roleId of unknownRoles) missingRoleMappings.add(roleId);

      if (!resolution.primaryRank) {
        addAction(result, conflictAction(discordMember, 'missing_primary_hierarchy_role', [
          ...identityWarnings,
          'No active primary hierarchy Discord role matched this member.',
        ], resolution));
        continue;
      }
      const resolutionWithPrimary = { ...resolution, primaryRank: resolution.primaryRank };

      const familyMember = linkedMembersByDiscordId.get(discordMember.discordUserId) ?? null;
      if (!familyMember) {
        const warnings = [...identityWarnings];
        if (unknownRoles.length) warnings.push('Member has Discord roles without active Family Hub mappings.');
        addAction(result, {
          action: identityWarnings.length ? 'conflict' : 'create',
          reason: identityWarnings.length ? 'missing_required_identity_data' : 'no_existing_discord_link',
          discordMember,
          matchedBy: 'none',
          ...resolutionItemFields(resolutionWithPrimary),
          changes: createChanges(discordMember, resolutionWithPrimary),
          warnings,
          possibleManualLinkFamilyMemberIds: possibleManualLinks(discordMember, familyMembers),
        });
        continue;
      }

      matchedFamilyMemberIds.add(familyMember.id);
      const changes = updateChanges(familyMember, discordMember, resolutionWithPrimary);
      const warnings = [...identityWarnings, ...accessWarnings(familyMember, resolutionWithPrimary)];
      if (unknownRoles.length) warnings.push('Member has Discord roles without active Family Hub mappings.');
      addAction(result, {
        action: identityWarnings.length ? 'conflict' : changes.length ? 'update' : 'unchanged',
        reason: identityWarnings.length ? 'missing_required_identity_data' : changes.length ? 'matched_member_differs' : 'matched_member_current',
        discordMember,
        familyMember: toFamilyMemberRef(familyMember),
        matchedBy: 'discord_user_id',
        ...resolutionItemFields(resolutionWithPrimary),
        changes,
        warnings,
        possibleManualLinkFamilyMemberIds: [],
      });
    }

    for (const familyMember of familyMembers) {
      const discordUserId = familyMember.discord?.discordUserId;
      if (!discordUserId || matchedFamilyMemberIds.has(familyMember.id) || familyMember.deletedAt || familyMember.status !== 'active') {
        continue;
      }
      addAction(result, {
        action: 'deactivate_candidate',
        reason: 'linked_active_family_member_absent_from_discord',
        familyMember: toFamilyMemberRef(familyMember),
        matchedBy: 'discord_user_id',
        additionalRoles: [],
        effectivePermissions: [],
        matchedIgnoredRoles: [],
        changes: [{ field: 'status', current: familyMember.status, proposed: 'inactive' }],
        warnings: ['Member is active in Family Hub but absent from the Discord guild.', ...ownerDeputyWarnings(familyMember)],
        possibleManualLinkFamilyMemberIds: [],
      });
    }

    for (const familyMember of familyMembers) {
      if (!familyMember.discord?.discordUserId && familyMember.status === 'active' && !familyMember.deletedAt) {
        result.warnings.push(`Active Family Hub member ${familyMember.id} has no Discord link and requires manual review.`);
      }
    }

    result.missingRoleMappings = [...missingRoleMappings].sort();
    return result;
  }
}

function addAction(result: DiscordMemberSyncDryRunResult, item: DiscordMemberSyncDryRunItem): void {
  result.actions.push(item);
  result.summary[item.action] += 1;
  for (const warning of item.warnings) result.warnings.push(warning);
}

function addConflict(result: DiscordMemberSyncDryRunResult, conflict: string): void {
  result.conflicts.push(conflict);
}

function conflictAction(
  discordMember: NormalizedDiscordGuildMember,
  reason: string,
  warnings: string[] = [],
  resolution: DiscordRoleResolution = emptyRoleResolution(),
): DiscordMemberSyncDryRunItem {
  return {
    action: 'conflict',
    reason,
    discordMember,
    matchedBy: 'none',
    ...resolutionItemFields(resolution),
    changes: [],
    warnings,
    possibleManualLinkFamilyMemberIds: [],
  };
}

async function listAllFamilyMembers(repository: FamilyMemberRepository): Promise<FamilyMember[]> {
  const pageSize = 100;
  const items: FamilyMember[] = [];
  for (let page = 1; ; page += 1) {
    const result = await repository.list({
      page,
      pageSize,
      includeDeleted: true,
      sortBy: 'nickname',
      sortOrder: 'asc',
    });
    items.push(...result.items);
    if (items.length >= result.total || result.items.length === 0) return items;
  }
}

function indexLinkedFamilyMembers(
  familyMembers: FamilyMember[],
  result: DiscordMemberSyncDryRunResult,
): Map<string, FamilyMember> {
  const map = new Map<string, FamilyMember>();
  for (const member of familyMembers) {
    const discordUserId = member.discord?.discordUserId;
    if (!discordUserId) continue;
    const existing = map.get(discordUserId);
    if (existing) {
      addConflict(result, `Duplicate Family Hub Discord link ${discordUserId}: ${existing.id}, ${member.id}`);
      continue;
    }
    map.set(discordUserId, member);
  }
  return map;
}

type DiscordRoleResolution = {
  primaryRank?: DiscordMemberSyncProposedRole;
  additionalRoles: DiscordMemberSyncAdditionalRole[];
  effectivePermissions: FamilyPermission[];
  matchedIgnoredRoles: DiscordMemberSyncIgnoredRole[];
};

function resolveDiscordRoles(
  discordMember: NormalizedDiscordGuildMember,
  mappings: DiscordRoleMapping[],
): DiscordRoleResolution {
  const roleIds = new Set(discordMember.roleIds);
  const matched = mappings.filter((candidate) => candidate.enabled && roleIds.has(candidate.discordRoleId));
  const primaryRank = selectPrimaryRank(roleIds, mappings);
  const additionalRoles = collectAdditionalRoles(matched);
  const effectivePermissions = calculateEffectivePermissions(primaryRank, additionalRoles);
  const matchedIgnoredRoles = matched
    .filter((mapping) => mapping.mappingType === 'ignored')
    .map((mapping) => ({ discordRoleId: mapping.discordRoleId, discordRoleName: mapping.discordRoleName }));
  return { primaryRank, additionalRoles, effectivePermissions, matchedIgnoredRoles };
}

function selectPrimaryRank(roleIds: Set<string>, mappings: DiscordRoleMapping[]): DiscordMemberSyncProposedRole | undefined {
  const mapping = mappings
    .filter(
      (candidate) =>
        candidate.enabled &&
        candidate.mappingType === 'primary_hierarchy' &&
        roleIds.has(candidate.discordRoleId) &&
        candidate.familyRole !== null &&
        candidate.rank !== null,
    )
    .sort(
      (left, right) =>
        (right.rank ?? 0) - (left.rank ?? 0) ||
        right.priority - left.priority ||
        left.discordRoleId.localeCompare(right.discordRoleId),
    )[0];
  return mapping ? toProposedRole(mapping) : undefined;
}

function collectAdditionalRoles(mappings: DiscordRoleMapping[]): DiscordMemberSyncAdditionalRole[] {
  return mappings
    .filter((mapping) => mapping.mappingType === 'additional_functional')
    .map((mapping) => ({
      discordRoleId: mapping.discordRoleId,
      discordRoleName: mapping.discordRoleName,
      permissions: mapping.grantsPermissions ? mapping.permissions : [],
      priority: mapping.priority,
    }))
    .sort(
      (left, right) =>
        right.priority - left.priority ||
        left.discordRoleId.localeCompare(right.discordRoleId),
    );
}

function calculateEffectivePermissions(
  primaryRank: DiscordMemberSyncProposedRole | undefined,
  additionalRoles: DiscordMemberSyncAdditionalRole[],
): FamilyPermission[] {
  return uniquePermissions([
    ...(primaryRank?.permissions ?? []),
    ...additionalRoles.flatMap((role) => role.permissions),
  ]).sort();
}

function toProposedRole(mapping: DiscordRoleMapping): DiscordMemberSyncProposedRole {
  if (!mapping.familyRole || mapping.rank === null) throw new Error('Primary hierarchy mapping is incomplete.');
  return {
    discordRoleId: mapping.discordRoleId,
    discordRoleName: mapping.discordRoleName,
    familyRole: mapping.familyRole,
    rank: mapping.rank,
    permissions: mapping.grantsPermissions ? mapping.permissions : [],
    priority: mapping.priority,
  };
}

function resolutionItemFields(resolution: DiscordRoleResolution) {
  return {
    proposedRole: resolution.primaryRank,
    primaryRank: resolution.primaryRank,
    promotionRank: resolution.primaryRank?.rank,
    primaryDiscordRoleId: resolution.primaryRank?.discordRoleId,
    primaryDiscordRoleName: resolution.primaryRank?.discordRoleName,
    additionalRoles: resolution.additionalRoles,
    effectivePermissions: resolution.effectivePermissions,
    matchedIgnoredRoles: resolution.matchedIgnoredRoles,
  };
}

function emptyRoleResolution(): DiscordRoleResolution {
  return {
    additionalRoles: [],
    effectivePermissions: [],
    matchedIgnoredRoles: [],
  };
}

function missingIdentityWarnings(discordMember: NormalizedDiscordGuildMember): string[] {
  const warnings: string[] = [];
  if (!discordMember.discordUserId.trim()) warnings.push('Discord user ID is missing.');
  if (!discordMember.username.trim()) warnings.push('Discord username is missing.');
  return warnings;
}

function possibleManualLinks(discordMember: NormalizedDiscordGuildMember, familyMembers: FamilyMember[]): string[] {
  const candidates = [discordMember.serverNickname, discordMember.globalName, discordMember.username]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim().toLowerCase());
  if (!candidates.length) return [];
  return familyMembers
    .filter((member) => !member.discord?.discordUserId && candidates.includes(member.nickname.toLowerCase()))
    .map((member) => member.id)
    .sort();
}

function createChanges(
  discordMember: NormalizedDiscordGuildMember,
  resolution: DiscordRoleResolution & { primaryRank: DiscordMemberSyncProposedRole },
): DiscordMemberSyncChange[] {
  return [
    { field: 'discord_user_id', current: null, proposed: discordMember.discordUserId },
    { field: 'discord_username', current: null, proposed: discordMember.username },
    { field: 'role', current: null, proposed: resolution.primaryRank.familyRole },
    { field: 'rank', current: null, proposed: resolution.primaryRank.rank },
    { field: 'permissions', current: [], proposed: resolution.effectivePermissions },
  ];
}

function updateChanges(
  familyMember: FamilyMember,
  discordMember: NormalizedDiscordGuildMember,
  resolution: DiscordRoleResolution & { primaryRank: DiscordMemberSyncProposedRole },
): DiscordMemberSyncChange[] {
  return [
    compare('discord_username', familyMember.discord?.discordUsername ?? null, discordMember.username),
    compare('discord_global_name', familyMember.discord?.discordGlobalName ?? null, discordMember.globalName),
    compare('discord_server_nickname', familyMember.discord?.discordServerNickname ?? null, discordMember.serverNickname),
    compare('discord_avatar', familyMember.discord?.discordAvatar ?? null, discordMember.avatarUrl),
    compare('guild_id', familyMember.discord?.guildId ?? null, discordMember.guildId),
    compare('discord_joined_at', familyMember.discord?.joinedAt ?? null, discordMember.joinedAt),
    compare('role', familyMember.role, resolution.primaryRank.familyRole),
    compare('rank', familyMember.rank, resolution.primaryRank.rank),
    comparePermissions(familyMember.permissions, resolution.effectivePermissions),
    compare('status', familyMember.status, 'active'),
  ].filter((change): change is DiscordMemberSyncChange => Boolean(change));
}

function compare(field: string, current: unknown, proposed: unknown): DiscordMemberSyncChange | null {
  return current === proposed ? null : { field, current, proposed };
}

function comparePermissions(current: FamilyPermission[], proposed: FamilyPermission[]): DiscordMemberSyncChange | null {
  const left = [...current].sort();
  const right = [...proposed].sort();
  return JSON.stringify(left) === JSON.stringify(right) ? null : { field: 'permissions', current, proposed };
}

function accessWarnings(
  familyMember: FamilyMember,
  resolution: DiscordRoleResolution & { primaryRank: DiscordMemberSyncProposedRole },
): string[] {
  const warnings: string[] = [];
  warnings.push(...ownerDeputyWarnings(familyMember));
  const currentPermissions = new Set(familyMember.permissions);
  const proposedPermissions = new Set(resolution.effectivePermissions);
  const removedPermissions = [...currentPermissions].filter((permission) => !proposedPermissions.has(permission));
  if (familyMember.role !== resolution.primaryRank.familyRole || removedPermissions.length > 0) {
    warnings.push('Dry-run includes a role or permission change that could revoke access.');
  }
  return warnings;
}

function uniquePermissions(permissions: FamilyPermission[]): FamilyPermission[] {
  return [...new Set(permissions)];
}

function ownerDeputyWarnings(familyMember: FamilyMember): string[] {
  return familyMember.role === 'owner' || familyMember.role === 'deputy'
    ? ['Owner/deputy account requires manual safety review before applying sync changes.']
    : [];
}

function toFamilyMemberRef(familyMember: FamilyMember): DiscordMemberSyncDryRunItem['familyMember'] {
  return {
    id: familyMember.id,
    nickname: familyMember.nickname,
    staticId: familyMember.staticId,
    role: familyMember.role,
    rank: familyMember.rank,
    status: familyMember.status,
    permissions: familyMember.permissions,
    deletedAt: familyMember.deletedAt,
    discordUserId: familyMember.discord?.discordUserId ?? null,
  };
}
