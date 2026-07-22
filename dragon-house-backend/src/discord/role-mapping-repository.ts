import type pg from 'pg';
import type { DiscordRoleMapping, DiscordRoleMappingType, FamilyPermission, FamilyRole } from '../types.js';

export type SaveDiscordRoleMappingInput = {
  discordRoleId: string;
  discordRoleName: string;
  mappingType?: DiscordRoleMappingType;
  familyRole?: FamilyRole | null;
  rank?: number | null;
  permissions: FamilyPermission[];
  priority: number;
  grantsPermissions?: boolean;
  metadata?: Record<string, unknown>;
  enabled: boolean;
};

export interface DiscordRoleMappingRepository {
  list(includeDisabled?: boolean): Promise<DiscordRoleMapping[]>;
  getByDiscordRoleId(discordRoleId: string): Promise<DiscordRoleMapping | null>;
  save(input: SaveDiscordRoleMappingInput): Promise<DiscordRoleMapping>;
  deleteByDiscordRoleId(discordRoleId: string): Promise<boolean>;
  clear(): Promise<void>;
}

export class InMemoryDiscordRoleMappingRepository implements DiscordRoleMappingRepository {
  private readonly mappings = new Map<string, DiscordRoleMapping>();

  async list(includeDisabled = false): Promise<DiscordRoleMapping[]> {
    return Array.from(this.mappings.values())
      .filter((mapping) => includeDisabled || mapping.enabled)
      .sort((left, right) => right.priority - left.priority || left.discordRoleId.localeCompare(right.discordRoleId));
  }

  async getByDiscordRoleId(discordRoleId: string): Promise<DiscordRoleMapping | null> {
    return this.mappings.get(discordRoleId) ?? null;
  }

  async save(input: SaveDiscordRoleMappingInput): Promise<DiscordRoleMapping> {
    const now = new Date().toISOString();
    const existing = this.mappings.get(input.discordRoleId);
    const mapping: DiscordRoleMapping = {
      discordRoleId: input.discordRoleId,
      discordRoleName: input.discordRoleName,
      mappingType: input.mappingType ?? 'primary_hierarchy',
      familyRole: input.familyRole ?? null,
      rank: input.rank ?? null,
      permissions: input.permissions,
      priority: input.priority,
      grantsPermissions: input.grantsPermissions ?? true,
      metadata: input.metadata ?? {},
      enabled: input.enabled,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.mappings.set(input.discordRoleId, mapping);
    return mapping;
  }

  async deleteByDiscordRoleId(discordRoleId: string): Promise<boolean> {
    return this.mappings.delete(discordRoleId);
  }

  async clear(): Promise<void> {
    this.mappings.clear();
  }
}

type DiscordRoleMappingRow = {
  discord_role_id: string;
  discord_role_name: string;
  mapping_type: DiscordRoleMappingType;
  family_role: FamilyRole | null;
  rank: number | null;
  permissions: FamilyPermission[];
  priority: number;
  grants_permissions: boolean;
  metadata: Record<string, unknown>;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
};

export class PgDiscordRoleMappingRepository implements DiscordRoleMappingRepository {
  constructor(private readonly pool: pg.Pool) {}

  async list(includeDisabled = false): Promise<DiscordRoleMapping[]> {
    const result = await this.pool.query<DiscordRoleMappingRow>(
      `select * from discord_role_mappings
       where $1::boolean or enabled = true
       order by priority desc, discord_role_id asc`,
      [includeDisabled],
    );
    return result.rows.map(mapDiscordRoleMapping);
  }

  async getByDiscordRoleId(discordRoleId: string): Promise<DiscordRoleMapping | null> {
    const result = await this.pool.query<DiscordRoleMappingRow>(
      'select * from discord_role_mappings where discord_role_id = $1 limit 1',
      [discordRoleId],
    );
    return result.rows[0] ? mapDiscordRoleMapping(result.rows[0]) : null;
  }

  async save(input: SaveDiscordRoleMappingInput): Promise<DiscordRoleMapping> {
    const result = await this.pool.query<DiscordRoleMappingRow>(
      `insert into discord_role_mappings
        (discord_role_id, discord_role_name, mapping_type, family_role, rank, permissions, priority,
         grants_permissions, metadata, enabled)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (discord_role_id) do update
       set discord_role_name = excluded.discord_role_name,
           mapping_type = excluded.mapping_type,
           family_role = excluded.family_role,
           rank = excluded.rank,
           permissions = excluded.permissions,
           priority = excluded.priority,
           grants_permissions = excluded.grants_permissions,
           metadata = excluded.metadata,
           enabled = excluded.enabled,
           updated_at = now()
       returning *`,
      [
        input.discordRoleId,
        input.discordRoleName,
        input.mappingType ?? 'primary_hierarchy',
        input.familyRole ?? null,
        input.rank ?? null,
        JSON.stringify(input.permissions),
        input.priority,
        input.grantsPermissions ?? true,
        JSON.stringify(input.metadata ?? {}),
        input.enabled,
      ],
    );
    return mapDiscordRoleMapping(result.rows[0]);
  }

  async deleteByDiscordRoleId(discordRoleId: string): Promise<boolean> {
    const result = await this.pool.query('delete from discord_role_mappings where discord_role_id = $1', [
      discordRoleId,
    ]);
    return (result.rowCount ?? 0) > 0;
  }

  async clear(): Promise<void> {
    await this.pool.query('delete from discord_role_mappings');
  }
}

function mapDiscordRoleMapping(row: DiscordRoleMappingRow): DiscordRoleMapping {
  return {
    discordRoleId: row.discord_role_id,
    discordRoleName: row.discord_role_name,
    mappingType: row.mapping_type,
    familyRole: row.family_role,
    rank: row.rank,
    permissions: row.permissions,
    priority: row.priority,
    grantsPermissions: row.grants_permissions,
    metadata: row.metadata,
    enabled: row.enabled,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
