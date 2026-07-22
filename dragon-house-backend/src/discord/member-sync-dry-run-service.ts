import type { DiscordGuildMemberReader } from './guild-member-reader.js';
import type { DiscordRoleMappingRepository } from './role-mapping-repository.js';
import type { FamilyMemberRepository } from '../members/member-repository.js';
import type {
  DiscordMemberSyncChange,
  DiscordMemberSyncDryRunItem,
  DiscordMemberSyncDryRunResult,
  DiscordMemberSyncDryRunSummary,
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
          changes: [],
          warnings: ['Bot accounts are excluded from Family Hub member sync by default.'],
          possibleManualLinkFamilyMemberIds: [],
        });
        continue;
      }

      const identityWarnings = missingIdentityWarnings(discordMember);
      const proposedRole = findProposedRole(discordMember, mappings);
      const unknownRoles = discordMember.roleIds.filter((roleId) => !activeMappingsByRoleId.has(roleId));
      for (const roleId of unknownRoles) missingRoleMappings.add(roleId);

      if (!proposedRole) {
        addAction(result, conflictAction(discordMember, 'missing_active_role_mapping', [
          ...identityWarnings,
          'No active discord_role_mappings entry matched this member roles.',
        ]));
        continue;
      }

      const familyMember = linkedMembersByDiscordId.get(discordMember.discordUserId) ?? null;
      if (!familyMember) {
        const warnings = [...identityWarnings];
        if (unknownRoles.length) warnings.push('Member has Discord roles without active Family Hub mappings.');
        addAction(result, {
          action: identityWarnings.length ? 'conflict' : 'create',
          reason: identityWarnings.length ? 'missing_required_identity_data' : 'no_existing_discord_link',
          discordMember,
          matchedBy: 'none',
          proposedRole,
          changes: createChanges(discordMember, proposedRole),
          warnings,
          possibleManualLinkFamilyMemberIds: possibleManualLinks(discordMember, familyMembers),
        });
        continue;
      }

      matchedFamilyMemberIds.add(familyMember.id);
      const changes = updateChanges(familyMember, discordMember, proposedRole);
      const warnings = [...identityWarnings, ...accessWarnings(familyMember, proposedRole)];
      if (unknownRoles.length) warnings.push('Member has Discord roles without active Family Hub mappings.');
      addAction(result, {
        action: identityWarnings.length ? 'conflict' : changes.length ? 'update' : 'unchanged',
        reason: identityWarnings.length ? 'missing_required_identity_data' : changes.length ? 'matched_member_differs' : 'matched_member_current',
        discordMember,
        familyMember: toFamilyMemberRef(familyMember),
        matchedBy: 'discord_user_id',
        proposedRole,
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
): DiscordMemberSyncDryRunItem {
  return {
    action: 'conflict',
    reason,
    discordMember,
    matchedBy: 'none',
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

function findProposedRole(
  discordMember: NormalizedDiscordGuildMember,
  mappings: DiscordRoleMapping[],
): DiscordMemberSyncProposedRole | undefined {
  const roleIds = new Set(discordMember.roleIds);
  const mapping = mappings.find((candidate) => candidate.enabled && roleIds.has(candidate.discordRoleId));
  return mapping
    ? {
        discordRoleId: mapping.discordRoleId,
        discordRoleName: mapping.discordRoleName,
        familyRole: mapping.familyRole,
        rank: mapping.rank,
        permissions: mapping.permissions,
        priority: mapping.priority,
      }
    : undefined;
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
  proposedRole: DiscordMemberSyncProposedRole,
): DiscordMemberSyncChange[] {
  return [
    { field: 'discord_user_id', current: null, proposed: discordMember.discordUserId },
    { field: 'discord_username', current: null, proposed: discordMember.username },
    { field: 'role', current: null, proposed: proposedRole.familyRole },
    { field: 'rank', current: null, proposed: proposedRole.rank },
    { field: 'permissions', current: [], proposed: proposedRole.permissions },
  ];
}

function updateChanges(
  familyMember: FamilyMember,
  discordMember: NormalizedDiscordGuildMember,
  proposedRole: DiscordMemberSyncProposedRole,
): DiscordMemberSyncChange[] {
  return [
    compare('discord_username', familyMember.discord?.discordUsername ?? null, discordMember.username),
    compare('discord_global_name', familyMember.discord?.discordGlobalName ?? null, discordMember.globalName),
    compare('discord_server_nickname', familyMember.discord?.discordServerNickname ?? null, discordMember.serverNickname),
    compare('discord_avatar', familyMember.discord?.discordAvatar ?? null, discordMember.avatarUrl),
    compare('guild_id', familyMember.discord?.guildId ?? null, discordMember.guildId),
    compare('discord_joined_at', familyMember.discord?.joinedAt ?? null, discordMember.joinedAt),
    compare('role', familyMember.role, proposedRole.familyRole),
    compare('rank', familyMember.rank, proposedRole.rank),
    comparePermissions(familyMember.permissions, proposedRole.permissions),
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

function accessWarnings(familyMember: FamilyMember, proposedRole: DiscordMemberSyncProposedRole): string[] {
  const warnings: string[] = [];
  warnings.push(...ownerDeputyWarnings(familyMember));
  const currentPermissions = new Set(familyMember.permissions);
  const proposedPermissions = new Set(proposedRole.permissions);
  const removedPermissions = [...currentPermissions].filter((permission) => !proposedPermissions.has(permission));
  if (familyMember.role !== proposedRole.familyRole || removedPermissions.length > 0) {
    warnings.push('Dry-run includes a role or permission change that could revoke access.');
  }
  return warnings;
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
