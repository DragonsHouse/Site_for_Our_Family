import type pg from 'pg';
import type { DiscordRoleMapping, FamilyPermission, FamilyRole } from '../types.js';

export type SaveDiscordRoleMappingInput = {
  discordRoleId: string;
  discordRoleName: string;
  familyRole: FamilyRole;
  rank: number;
  permissions: FamilyPermission[];
  priority: number;
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
      ...input,
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
  family_role: FamilyRole;
  rank: number;
  permissions: FamilyPermission[];
  priority: number;
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
        (discord_role_id, discord_role_name, family_role, rank, permissions, priority, enabled)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (discord_role_id) do update
       set discord_role_name = excluded.discord_role_name,
           family_role = excluded.family_role,
           rank = excluded.rank,
           permissions = excluded.permissions,
           priority = excluded.priority,
           enabled = excluded.enabled,
           updated_at = now()
       returning *`,
      [
        input.discordRoleId,
        input.discordRoleName,
        input.familyRole,
        input.rank,
        JSON.stringify(input.permissions),
        input.priority,
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
    familyRole: row.family_role,
    rank: row.rank,
    permissions: row.permissions,
    priority: row.priority,
    enabled: row.enabled,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
