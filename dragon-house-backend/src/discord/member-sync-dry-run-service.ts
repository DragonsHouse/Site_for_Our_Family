import { createHash } from 'node:crypto';
import type { DiscordGuildMemberReader } from './guild-member-reader.js';
import type { DiscordRoleMappingRepository } from './role-mapping-repository.js';
import type { FamilyMemberRepository } from '../members/member-repository.js';
import type { AppConfig } from '../config/env.js';
import { createLogger, type AppLogger } from '../logging/logger.js';
import type {
  DiscordMemberSyncChange,
  DiscordMemberSyncAdditionalRole,
  DiscordMemberSyncDryRunItem,
  DiscordMemberSyncPermissionSources,
  DiscordMemberSyncDryRunResult,
  DiscordMemberSyncDryRunSummary,
  DiscordMemberSyncIgnoredRole,
  DiscordMemberSyncProposedRole,
  DiscordRoleMapping,
  FamilyMember,
  FamilyPermission,
  FamilyRole,
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

const OWNER_PROTECTED_PERMISSIONS: FamilyPermission[] = [
  'manage_users',
  'view_members',
  'manage_members',
  'manage_member_roles',
  'manage_member_auth',
  'delete_members',
  'restore_members',
  'view_member_private_fields',
  'manage_tasks',
  'manage_ranks',
  'view_private_notes',
  'manage_family_map',
  'manage_events',
  'manage_buyers',
  'manage_family_posts',
  'manage_family_news',
  'manage_news',
  'view_family_history',
  'manage_family_economy',
  'manage_family_quests',
  'manage_family_assets',
  'manage_discord_integration',
  'manage_accounting',
  'manage_treasury',
  'manage_recruitment',
  'manage_resources',
  'manage_roles',
];

const SYSTEM_ROLE_PERMISSIONS: Record<FamilyRole, FamilyPermission[]> = {
  owner: OWNER_PROTECTED_PERMISSIONS,
  deputy: [],
  moderator: [],
  member: [],
};

type ProtectedOwnerConfig = {
  familyMemberId: string;
  discordUserId: string;
} | null;

export class DiscordMemberSyncDryRunService {
  private readonly logger: AppLogger | null;

  constructor(
    private readonly reader: DiscordGuildMemberReader,
    private readonly memberRepository: FamilyMemberRepository,
    private readonly roleMappings: DiscordRoleMappingRepository,
    private readonly config: Pick<AppConfig, 'discord' | 'nodeEnv' | 'logLevel' | 'logFormat'> | null = null,
    logger: AppLogger | null = null,
  ) {
    this.logger = logger ?? (config ? createLogger(config) : null);
  }

  async run(generatedAt = new Date()): Promise<DiscordMemberSyncDryRunResult> {
    const [discordMembers, familyMembers, mappings] = await Promise.all([
      this.reader.fetchGuildMembers(),
      listAllFamilyMembers(this.memberRepository),
      this.roleMappings.list(false),
    ]);
    this.logger?.info('discord_sync_snapshot_completed', {
      guildId: discordMembers[0]?.guildId ?? this.config?.discord.guildId ?? null,
      discordMemberCount: discordMembers.length,
      familyMemberCount: familyMembers.length,
      roleMappingCount: mappings.length,
    });
    const activeMappingsByRoleId = new Map(mappings.map((mapping) => [mapping.discordRoleId, mapping]));
    const result: DiscordMemberSyncDryRunResult = {
      planId: '',
      generatedAt: generatedAt.toISOString(),
      planExpiresAt: new Date(generatedAt.getTime() + (this.config?.discord.sync.planTtlSeconds ?? 300) * 1000).toISOString(),
      planHash: '',
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
    const protectedOwner = this.protectedOwnerConfig();
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

      const familyMember = linkedMembersByDiscordId.get(discordMember.discordUserId) ?? null;
      const resolutionWithPrimary = protectOwnerResolution(familyMember, discordMember, protectedOwner, {
        ...resolution,
        primaryRank: resolution.primaryRank,
      });
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
      const warnings = [
        ...identityWarnings,
        ...protectedOwnerWarnings(familyMember, discordMember, protectedOwner, resolution.primaryRank),
        ...accessWarnings(familyMember, resolutionWithPrimary),
      ];
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
        permissionSources: emptyPermissionSources(),
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
    const planIdentity = hashDryRunPlan(result, mappings, this.config, false);
    result.planId = planIdentity.slice(0, 32);
    result.planHash = hashDryRunPlan(result, mappings, this.config, true);
    return result;
  }

  private protectedOwnerConfig(): ProtectedOwnerConfig {
    const familyMemberId = this.config?.discord.sync.protectedOwnerMemberId;
    const discordUserId = this.config?.discord.sync.protectedOwnerDiscordUserId;
    return familyMemberId && discordUserId ? { familyMemberId, discordUserId } : null;
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
  discordMappedPermissions: FamilyPermission[];
  effectivePermissions: FamilyPermission[];
  matchedIgnoredRoles: DiscordMemberSyncIgnoredRole[];
  permissionSources: DiscordMemberSyncPermissionSources;
};

function resolveDiscordRoles(
  discordMember: NormalizedDiscordGuildMember,
  mappings: DiscordRoleMapping[],
): DiscordRoleResolution {
  const roleIds = new Set(discordMember.roleIds);
  const matched = mappings.filter((candidate) => candidate.enabled && roleIds.has(candidate.discordRoleId));
  const primaryRank = selectPrimaryRank(roleIds, mappings);
  const additionalRoles = collectAdditionalRoles(matched);
  const discordMappedPermissions = calculateDiscordMappedPermissions(primaryRank, additionalRoles);
  const permissionSources = permissionSourcesFor(primaryRank, discordMappedPermissions);
  const effectivePermissions = calculateEffectivePermissions(permissionSources);
  const matchedIgnoredRoles = matched
    .filter((mapping) => mapping.mappingType === 'ignored')
    .map((mapping) => ({ discordRoleId: mapping.discordRoleId, discordRoleName: mapping.discordRoleName }));
  return { primaryRank, additionalRoles, discordMappedPermissions, effectivePermissions, matchedIgnoredRoles, permissionSources };
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

function calculateDiscordMappedPermissions(
  primaryRank: DiscordMemberSyncProposedRole | undefined,
  additionalRoles: DiscordMemberSyncAdditionalRole[],
): FamilyPermission[] {
  return uniquePermissions([
    ...(primaryRank?.permissions ?? []),
    ...additionalRoles.flatMap((role) => role.permissions),
  ]).sort();
}

function calculateEffectivePermissions(sources: DiscordMemberSyncPermissionSources): FamilyPermission[] {
  const denied = new Set(sources.manualDeniedPermissions);
  const base = uniquePermissions([
    ...sources.systemRolePermissions,
    ...sources.discordMappedPermissions,
    ...sources.manualGrantedPermissions,
  ]).filter((permission) => !denied.has(permission));
  return uniquePermissions([...base, ...sources.protectedPermissions]).sort();
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
    permissionSources: resolution.permissionSources,
  };
}

function emptyRoleResolution(): DiscordRoleResolution {
  return {
    additionalRoles: [],
    discordMappedPermissions: [],
    effectivePermissions: [],
    matchedIgnoredRoles: [],
    permissionSources: emptyPermissionSources(),
  };
}

function emptyPermissionSources(): DiscordMemberSyncPermissionSources {
  return {
    systemRolePermissions: [],
    discordMappedPermissions: [],
    manualGrantedPermissions: [],
    manualDeniedPermissions: [],
    protectedPermissions: [],
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
    { field: 'nickname', current: null, proposed: displayName(discordMember) },
    { field: 'role', current: null, proposed: resolution.primaryRank.familyRole },
    { field: 'rank', current: null, proposed: resolution.primaryRank.rank },
    { field: 'permissions_discord', current: [], proposed: resolution.discordMappedPermissions },
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
    compare('discord_avatar', familyMember.discord?.discordAvatar ?? null, parseDiscordAvatarHash(discordMember.avatarUrl)),
    compare('guild_id', familyMember.discord?.guildId ?? null, discordMember.guildId),
    compare('discord_joined_at', familyMember.discord?.joinedAt ?? null, discordMember.joinedAt),
    compare('nickname', familyMember.nickname, displayName(discordMember)),
    compare('role', familyMember.role, resolution.primaryRank.familyRole),
    compare('rank', familyMember.rank, resolution.primaryRank.rank),
    comparePermissions('permissions_discord', familyMember.permissionsDiscord, resolution.discordMappedPermissions),
    comparePermissions('permissions', familyMember.permissions, resolution.effectivePermissions),
    compare('status', familyMember.status, 'active'),
  ].filter((change): change is DiscordMemberSyncChange => Boolean(change));
}

function displayName(member: NormalizedDiscordGuildMember): string {
  return (member.serverNickname ?? member.globalName ?? member.username).trim();
}

function parseDiscordAvatarHash(avatarUrl: string | null): string | null {
  return avatarUrl?.match(/\/avatars\/[^/]+\/([^/.?]+)/u)?.[1] ?? null;
}

function compare(field: string, current: unknown, proposed: unknown): DiscordMemberSyncChange | null {
  return current === proposed ? null : { field, current, proposed };
}

function comparePermissions(field: string, current: FamilyPermission[], proposed: FamilyPermission[]): DiscordMemberSyncChange | null {
  const left = [...current].sort();
  const right = [...proposed].sort();
  return JSON.stringify(left) === JSON.stringify(right) ? null : { field, current, proposed };
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

function protectOwnerResolution(
  familyMember: FamilyMember | null,
  discordMember: NormalizedDiscordGuildMember,
  protectedOwner: ProtectedOwnerConfig,
  resolution: DiscordRoleResolution & { primaryRank: DiscordMemberSyncProposedRole },
): DiscordRoleResolution & { primaryRank: DiscordMemberSyncProposedRole } {
  const ownerProtected = isProtectedOwner(familyMember, discordMember, protectedOwner);
  const primaryRank = ownerProtected && (resolution.primaryRank.familyRole !== 'owner' || resolution.primaryRank.rank !== 10)
    ? {
        ...resolution.primaryRank,
        familyRole: 'owner' as const,
        rank: 10,
        permissions: uniquePermissions([...resolution.primaryRank.permissions, ...OWNER_PROTECTED_PERMISSIONS]).sort(),
      }
    : resolution.primaryRank;
  const discordMappedPermissions = calculateDiscordMappedPermissions(primaryRank, resolution.additionalRoles);
  const permissionSources = permissionSourcesFor(primaryRank, discordMappedPermissions, familyMember, ownerProtected);
  return {
    ...resolution,
    primaryRank,
    discordMappedPermissions,
    permissionSources,
    effectivePermissions: calculateEffectivePermissions(permissionSources),
  };
}

function permissionSourcesFor(
  primaryRank: DiscordMemberSyncProposedRole | undefined,
  discordMappedPermissions: FamilyPermission[],
  familyMember: FamilyMember | null = null,
  ownerProtected = false,
): DiscordMemberSyncPermissionSources {
  return {
    systemRolePermissions: primaryRank ? [...SYSTEM_ROLE_PERMISSIONS[primaryRank.familyRole]].sort() : [],
    discordMappedPermissions: [...discordMappedPermissions].sort(),
    manualGrantedPermissions: [...(familyMember?.permissionsOverride ?? [])].sort(),
    manualDeniedPermissions: [...(familyMember?.permissionsDenied ?? [])].sort(),
    protectedPermissions: ownerProtected ? [...OWNER_PROTECTED_PERMISSIONS].sort() : [],
  };
}

function isProtectedOwner(
  familyMember: FamilyMember | null,
  discordMember: NormalizedDiscordGuildMember,
  protectedOwner: ProtectedOwnerConfig,
): boolean {
  return Boolean(
    protectedOwner &&
      familyMember?.id === protectedOwner.familyMemberId &&
      discordMember.discordUserId === protectedOwner.discordUserId,
  );
}

function protectedOwnerWarnings(
  familyMember: FamilyMember,
  discordMember: NormalizedDiscordGuildMember,
  protectedOwner: ProtectedOwnerConfig,
  mappedPrimaryRank: DiscordMemberSyncProposedRole,
): string[] {
  if (!isProtectedOwner(familyMember, discordMember, protectedOwner)) return [];
  const warnings = ['Protected owner identity matched by stable Family Hub member ID and Discord user ID.'];
  if (mappedPrimaryRank.familyRole !== 'owner' || mappedPrimaryRank.rank !== 10) {
    warnings.push('Discord mapping conflicts with protected owner identity; dry-run preserves owner role and rank.');
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

function hashDryRunPlan(
  result: DiscordMemberSyncDryRunResult,
  mappings: DiscordRoleMapping[],
  config: Pick<AppConfig, 'discord' | 'nodeEnv' | 'logLevel' | 'logFormat'> | null,
  includePlanId: boolean,
): string {
  const stablePlan = {
    planSchemaVersion: 2,
    planId: includePlanId ? result.planId : null,
    generatedAt: result.generatedAt,
    planExpiresAt: result.planExpiresAt,
    environment: config?.nodeEnv ?? 'unknown',
    guildId: result.guildId,
    configuredGuildId: config?.discord.guildId ?? null,
    protectedOwner: {
      familyMemberId: config?.discord.sync.protectedOwnerMemberId ?? null,
      discordUserId: config?.discord.sync.protectedOwnerDiscordUserId ?? null,
    },
    roleMappings: mappings
      .map((mapping) => ({
        discordRoleId: mapping.discordRoleId,
        mappingType: mapping.mappingType,
        familyRole: mapping.familyRole,
        rank: mapping.rank,
        priority: mapping.priority,
        permissions: [...mapping.permissions].sort(),
        grantsPermissions: mapping.grantsPermissions,
        enabled: mapping.enabled,
      }))
      .sort((left, right) => left.discordRoleId.localeCompare(right.discordRoleId)),
    discordMemberCount: result.discordMemberCount,
    familyMemberCount: result.familyMemberCount,
    summary: result.summary,
    missingRoleMappings: result.missingRoleMappings,
    actions: result.actions.map((action) => ({
      action: action.action,
      reason: action.reason,
      discordUserId: action.discordMember?.discordUserId ?? null,
      familyMemberId: action.familyMember?.id ?? null,
      primaryDiscordRoleId: action.primaryDiscordRoleId ?? null,
      familyRole: action.primaryRank?.familyRole ?? null,
      promotionRank: action.promotionRank ?? null,
      additionalRoleIds: action.additionalRoles.map((role) => role.discordRoleId),
      effectivePermissions: action.effectivePermissions,
      changes: action.changes,
      manualLinkCandidates: action.possibleManualLinkFamilyMemberIds,
    })),
  };
  return createHash('sha256').update(JSON.stringify(stablePlan)).digest('hex');
}
