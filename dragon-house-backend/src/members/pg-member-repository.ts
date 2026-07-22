import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import type {
  CreateFamilyMemberInput,
  FamilyMember,
  FamilyMemberListQuery,
  FamilyMemberListResult,
  FamilyMemberStatus,
  FamilyPermission,
  FamilyRole,
  UpdateFamilyMemberInput,
} from '../types.js';
import type { FamilyMemberAuditEntry, FamilyMemberRepository } from './member-repository.js';

type MemberRow = {
  id: string;
  nickname: string;
  static_id: string | null;
  role: FamilyRole;
  rank: number;
  permissions: FamilyPermission[];
  status: FamilyMemberStatus;
  avatar_asset_id: string | null;
  notes: string | null;
  joined_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  version: number;
  created_by_family_member_id: string | null;
  updated_by_family_member_id: string | null;
  permissions_override: FamilyPermission[];
  permissions_discord: FamilyPermission[];
  permissions_denied: FamilyPermission[];
  onboarding_metadata: Record<string, unknown>;
  profile_metadata: Record<string, unknown>;
  discord_user_id?: string | null;
  discord_username?: string | null;
  discord_global_name?: string | null;
  discord_server_nickname?: string | null;
  discord_avatar?: string | null;
  guild_id?: string | null;
  discord_joined_at?: Date | null;
  discord_left_at?: Date | null;
  discord_last_synced_at?: Date | null;
  discord_verified?: boolean | null;
  discord_linked_at?: Date | null;
};

const SORT_COLUMNS: Record<FamilyMemberListQuery['sortBy'], string> = {
  nickname: 'nickname',
  staticId: 'static_id',
  role: 'role',
  rank: 'rank',
  status: 'status',
  joinedAt: 'joined_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

export class PgFamilyMemberRepository implements FamilyMemberRepository {
  constructor(private readonly pool: pg.Pool) {}

  async list(query: FamilyMemberListQuery): Promise<FamilyMemberListResult> {
    const values: unknown[] = [];
    const where: string[] = [];
    if (!query.includeDeleted) where.push('m.deleted_at is null');
    if (query.search?.trim()) {
      values.push(`%${query.search.trim().toLowerCase()}%`);
      where.push(`(lower(m.nickname) like $${values.length} or lower(m.static_id) like $${values.length})`);
    }
    if (query.status && query.status !== 'all') {
      values.push(query.status);
      where.push(`m.status = $${values.length}`);
    }
    if (query.role && query.role !== 'all') {
      values.push(query.role);
      where.push(`m.role = $${values.length}`);
    }
    if (query.rank) {
      values.push(query.rank);
      where.push(`m.rank = $${values.length}`);
    }
    const whereSql = where.length ? `where ${where.join(' and ')}` : '';
    const totalResult = await this.pool.query<{ count: string }>(
      `select count(*)::text as count from family_members m ${whereSql}`,
      values,
    );
    values.push(query.pageSize, (query.page - 1) * query.pageSize);
    const sortColumn = SORT_COLUMNS[query.sortBy];
    const sortOrder = query.sortOrder === 'desc' ? 'desc' : 'asc';
    const result = await this.pool.query<MemberRow>(
      `select m.*, d.discord_user_id, d.discord_username, d.discord_global_name, d.discord_server_nickname,
              d.discord_avatar, d.guild_id, d.joined_at as discord_joined_at, d.left_at as discord_left_at,
              d.last_synced_at as discord_last_synced_at, d.verified as discord_verified,
              d.linked_at as discord_linked_at
       from family_members m
       left join discord_account_links d on d.family_member_id = m.id
       ${whereSql}
       order by m.${sortColumn} ${sortOrder}, m.id asc
       limit $${values.length - 1} offset $${values.length}`,
      values,
    );
    return {
      items: result.rows.map(mapMember),
      page: query.page,
      pageSize: query.pageSize,
      total: Number(totalResult.rows[0]?.count ?? 0),
    };
  }

  async findById(id: string): Promise<FamilyMember | null> {
    const result = await this.pool.query<MemberRow>(
      `select m.*, d.discord_user_id, d.discord_username, d.discord_global_name, d.discord_server_nickname,
              d.discord_avatar, d.guild_id, d.joined_at as discord_joined_at, d.left_at as discord_left_at,
              d.last_synced_at as discord_last_synced_at, d.verified as discord_verified,
              d.linked_at as discord_linked_at
       from family_members m
       left join discord_account_links d on d.family_member_id = m.id
       where m.id = $1`,
      [id],
    );
    return result.rows[0] ? mapMember(result.rows[0]) : null;
  }

  async findByStaticId(staticId: string): Promise<FamilyMember | null> {
    const result = await this.pool.query<MemberRow>('select * from family_members where lower(static_id) = lower($1) limit 1', [
      staticId,
    ]);
    return result.rows[0] ? mapMember(result.rows[0]) : null;
  }

  async create(input: CreateFamilyMemberInput & { id: string }, actorId: string): Promise<FamilyMember> {
    const result = await this.pool.query<MemberRow>(
      `insert into family_members
        (id, nickname, static_id, role, rank, permissions, status, avatar_asset_id, notes, joined_at,
         created_by_family_member_id, updated_by_family_member_id, permissions_override, permissions_discord,
         permissions_denied, onboarding_metadata, profile_metadata)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $12, $13, $14, $15, $16)
       returning *`,
      [
        input.id,
        input.nickname,
        input.staticId ?? null,
        input.role,
        input.rank,
        JSON.stringify(input.permissions ?? []),
        input.status ?? 'active',
        input.avatarAssetId ?? null,
        input.notes ?? null,
        input.joinedAt ?? null,
        actorId,
        JSON.stringify(input.permissionsOverride ?? []),
        JSON.stringify(input.permissionsDiscord ?? []),
        JSON.stringify(input.permissionsDenied ?? []),
        JSON.stringify(input.onboardingMetadata ?? {}),
        JSON.stringify(input.profileMetadata ?? {}),
      ],
    );
    return mapMember(result.rows[0]);
  }

  async update(id: string, input: UpdateFamilyMemberInput, expectedVersion: number, actorId: string): Promise<FamilyMember | null> {
    const values: unknown[] = [id, expectedVersion];
    const set: string[] = [];
    const add = (column: string, value: unknown) => {
      values.push(value);
      set.push(`${column} = $${values.length}`);
    };
    if (input.nickname !== undefined) add('nickname', input.nickname);
    if (input.staticId !== undefined) add('static_id', input.staticId);
    if (input.role !== undefined) add('role', input.role);
    if (input.rank !== undefined) add('rank', input.rank);
    if (input.status !== undefined) add('status', input.status);
    if (input.avatarAssetId !== undefined) add('avatar_asset_id', input.avatarAssetId);
    if (input.notes !== undefined) add('notes', input.notes);
    if (input.joinedAt !== undefined) add('joined_at', input.joinedAt);
    if (input.permissions !== undefined) add('permissions', JSON.stringify(input.permissions));
    if (input.permissionsOverride !== undefined) add('permissions_override', JSON.stringify(input.permissionsOverride));
    if (input.permissionsDiscord !== undefined) add('permissions_discord', JSON.stringify(input.permissionsDiscord));
    if (input.permissionsDenied !== undefined) add('permissions_denied', JSON.stringify(input.permissionsDenied));
    if (input.onboardingMetadata !== undefined) add('onboarding_metadata', JSON.stringify(input.onboardingMetadata));
    if (input.profileMetadata !== undefined) add('profile_metadata', JSON.stringify(input.profileMetadata));
    values.push(actorId);
    set.push(`updated_by_family_member_id = $${values.length}`, 'updated_at = now()', 'version = version + 1');
    const result = await this.pool.query<MemberRow>(
      `update family_members
       set ${set.join(', ')}
       where id = $1 and version = $2
       returning *`,
      values,
    );
    return result.rows[0] ? mapMember(result.rows[0]) : null;
  }

  async softDelete(id: string, expectedVersion: number, actorId: string): Promise<FamilyMember | null> {
    const result = await this.pool.query<MemberRow>(
      `update family_members
       set status = 'inactive',
           deleted_at = coalesce(deleted_at, now()),
           updated_by_family_member_id = $3,
           updated_at = now(),
           version = version + 1
       where id = $1 and version = $2
       returning *`,
      [id, expectedVersion, actorId],
    );
    return result.rows[0] ? mapMember(result.rows[0]) : null;
  }

  async restore(id: string, expectedVersion: number, actorId: string): Promise<FamilyMember | null> {
    const result = await this.pool.query<MemberRow>(
      `update family_members
       set status = 'active',
           deleted_at = null,
           updated_by_family_member_id = $3,
           updated_at = now(),
           version = version + 1
       where id = $1 and version = $2
       returning *`,
      [id, expectedVersion, actorId],
    );
    return result.rows[0] ? mapMember(result.rows[0]) : null;
  }

  async countActiveOwners(): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `select count(*)::text as count from family_members
       where role = 'owner' and status = 'active' and deleted_at is null`,
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async existsByNickname(nickname: string, excludingId?: string): Promise<boolean> {
    const result = await this.pool.query<{ exists: boolean }>(
      `select exists (
        select 1 from family_members where lower(nickname) = lower($1) and ($2::text is null or id <> $2)
      )`,
      [nickname, excludingId ?? null],
    );
    return result.rows[0]?.exists ?? false;
  }

  async existsByStaticId(staticId: string, excludingId?: string): Promise<boolean> {
    const result = await this.pool.query<{ exists: boolean }>(
      `select exists (
        select 1 from family_members where lower(static_id) = lower($1) and ($2::text is null or id <> $2)
      )`,
      [staticId, excludingId ?? null],
    );
    return result.rows[0]?.exists ?? false;
  }

  async recordAudit(entry: FamilyMemberAuditEntry): Promise<void> {
    await this.pool.query(
      `insert into family_audit_log
        (id, actor_family_member_id, action, entity_type, entity_id, before_data, after_data, metadata)
       values ($1, $2, $3, 'family_member', $4, $5, $6, $7)`,
      [
        randomUUID(),
        entry.actorFamilyMemberId,
        entry.action,
        entry.entityId,
        entry.beforeData === undefined ? null : JSON.stringify(sanitizeAuditData(entry.beforeData)),
        entry.afterData === undefined ? null : JSON.stringify(sanitizeAuditData(entry.afterData)),
        entry.metadata ? JSON.stringify(sanitizeAuditData(entry.metadata)) : null,
      ],
    );
  }
}

function mapMember(row: MemberRow): FamilyMember {
  return {
    id: row.id,
    nickname: row.nickname,
    staticId: row.static_id,
    role: row.role,
    rank: row.rank,
    permissions: row.permissions,
    permissionsDiscord: row.permissions_discord,
    permissionsDenied: row.permissions_denied,
    status: row.status,
    avatarAssetId: row.avatar_asset_id,
    notes: row.notes,
    joinedAt: row.joined_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    deletedAt: row.deleted_at?.toISOString() ?? null,
    version: row.version,
    createdByFamilyMemberId: row.created_by_family_member_id,
    updatedByFamilyMemberId: row.updated_by_family_member_id,
    permissionsOverride: row.permissions_override,
    onboardingMetadata: row.onboarding_metadata,
    profileMetadata: row.profile_metadata,
    discord: row.discord_user_id
      ? {
          linked: true,
          discordUserId: row.discord_user_id,
          discordUsername: row.discord_username ?? '',
          discordGlobalName: row.discord_global_name,
          discordServerNickname: row.discord_server_nickname,
          discordAvatar: row.discord_avatar,
          guildId: row.guild_id,
          joinedAt: row.discord_joined_at?.toISOString() ?? null,
          leftAt: row.discord_left_at?.toISOString() ?? null,
          lastSyncedAt: row.discord_last_synced_at?.toISOString() ?? null,
          verified: row.discord_verified ?? false,
          linkedAt: row.discord_linked_at?.toISOString(),
        }
      : { linked: false },
  };
}

function sanitizeAuditData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeAuditData);
  if (!value || typeof value !== 'object') return value;
  const blocked = /password|hash|token|secret|authorization/iu;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !blocked.test(key))
      .map(([key, item]) => [key, sanitizeAuditData(item)]),
  );
}
