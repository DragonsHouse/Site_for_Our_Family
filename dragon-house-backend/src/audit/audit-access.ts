import type { FamilyAuthContext, FamilyPermission } from '../types.js';

/**
 * Domain-scoped access to family_audit_log. Owners see every domain; everyone else sees only
 * domains they manage. Unknown or new entity types stay owner-only until a domain is added here.
 */
type AuditDomain = {
  id: string;
  entityTypes: string[];
  canView: (auth: FamilyAuthContext) => boolean;
};

const has = (auth: FamilyAuthContext, ...permissions: FamilyPermission[]) => permissions.some((permission) => auth.permissions.includes(permission));

export const AUDIT_DOMAINS: AuditDomain[] = [
  { id: 'members', entityTypes: ['family_member'], canView: (auth) => has(auth, 'manage_members', 'manage_member_roles') },
  { id: 'content', entityTypes: ['family_content_block', 'family_news_post'], canView: (auth) => has(auth, 'manage_news', 'manage_family_news', 'manage_family_posts') },
  { id: 'recruitment', entityTypes: ['family_recruitment_settings'], canView: (auth) => has(auth, 'manage_recruitment') },
  { id: 'map', entityTypes: ['family_map_state'], canView: (auth) => has(auth, 'manage_family_map') },
  { id: 'towers', entityTypes: ['family_tower'], canView: (auth) => auth.rank >= 8 || has(auth, 'manage_events', 'manage_family_quests') },
  { id: 'treasury', entityTypes: ['family_treasury_entry'], canView: (auth) => has(auth, 'manage_treasury', 'manage_family_economy') },
  { id: 'assets', entityTypes: ['family_asset'], canView: (auth) => has(auth, 'manage_family_assets') },
];

/** Discord integration managers may follow member-sync history, but no other member changes. */
export const DISCORD_SYNC_ACTION_PREFIX = 'discord_sync_';

export type AuditScope =
  | { kind: 'all' }
  | { kind: 'scoped'; entityTypes: string[]; discordSyncMemberActions: boolean }
  | { kind: 'none' };

export function resolveAuditScope(auth: FamilyAuthContext): AuditScope {
  if (auth.role === 'owner') return { kind: 'all' };
  const entityTypes = AUDIT_DOMAINS.filter((domain) => domain.canView(auth)).flatMap((domain) => domain.entityTypes);
  const discordSyncMemberActions = has(auth, 'manage_discord_integration') && !entityTypes.includes('family_member');
  if (!entityTypes.length && !discordSyncMemberActions) return { kind: 'none' };
  return { kind: 'scoped', entityTypes, discordSyncMemberActions };
}

/** Appends a parameterised SQL predicate for the scope. Returns null for unrestricted access. */
export function auditScopePredicate(scope: AuditScope, values: unknown[]): string | null {
  if (scope.kind === 'all') return null;
  if (scope.kind === 'none') return 'false';
  const parts: string[] = [];
  if (scope.entityTypes.length) {
    values.push(scope.entityTypes);
    parts.push(`a.entity_type = any($${values.length}::text[])`);
  }
  if (scope.discordSyncMemberActions) {
    values.push(`${DISCORD_SYNC_ACTION_PREFIX}%`);
    parts.push(`(a.entity_type = 'family_member' and a.action like $${values.length})`);
  }
  return parts.length ? `(${parts.join(' or ')})` : 'false';
}

/** Secrets are never returned, whoever asks. */
const SECRET_KEY = /password|hash|token|secret|authorization|cookie|code_?verifier|api_?key/iu;

/** Private member details, returned only to owners and holders of view_member_private_fields. */
const PRIVATE_MEMBER_KEYS = new Set([
  'dateofbirth',
  'date_of_birth',
  'birthday',
  'notes',
  'privatenotes',
  'private_notes',
  'profilemetadata',
  'profile_metadata',
  'onboardingmetadata',
  'onboarding_metadata',
  'discord',
  'discorduserid',
  'discord_user_id',
  'discordusername',
  'discord_username',
  'discordglobalname',
  'discord_global_name',
  'discordservernickname',
  'discord_server_nickname',
  'discordavatar',
  'discord_avatar',
]);

const MAX_DEPTH = 12;

export function canViewPrivateMemberAuditFields(auth: FamilyAuthContext): boolean {
  return auth.role === 'owner' || auth.permissions.includes('view_member_private_fields');
}

/** Read-time redaction, so rows written before this policy are protected too. */
export function redactAuditPayload(value: unknown, options: { includePrivateMemberFields: boolean }, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[redacted]';
  if (Array.isArray(value)) return value.map((item) => redactAuditPayload(item, options, depth + 1));
  if (!value || typeof value !== 'object') return value;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY.test(key)) continue;
    if (!options.includePrivateMemberFields && PRIVATE_MEMBER_KEYS.has(key.toLowerCase())) continue;
    result[key] = redactAuditPayload(item, options, depth + 1);
  }
  return result;
}
