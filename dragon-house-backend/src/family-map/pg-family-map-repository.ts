import type pg from 'pg';
import { randomUUID } from 'node:crypto';
import { FAMILY_MAP_STATE_ID, type FamilyMapPointRecord, type FamilyMapStateRecord, type FamilyMapZoneRecord } from './family-map-models.js';
import type { FamilyMapAuditEntry, FamilyMapRepository, PersistedFamilyMapStateInput } from './family-map-repository.js';

type FamilyMapRow = {
  id: string;
  points: unknown;
  zones: unknown;
  version: number;
  updated_by_family_member_id: string | null;
  created_at: Date;
  updated_at: Date;
};

export class PgFamilyMapRepository implements FamilyMapRepository {
  constructor(private readonly pool: pg.Pool) {}

  async getState(): Promise<FamilyMapStateRecord> {
    const result = await this.pool.query<FamilyMapRow>('select * from family_map_state where id = $1', [FAMILY_MAP_STATE_ID]);
    if (result.rows[0]) return mapState(result.rows[0]);
    const inserted = await this.pool.query<FamilyMapRow>(
      `insert into family_map_state (id, points, zones)
       values ($1, '[]'::jsonb, '[]'::jsonb)
       on conflict (id) do update set id = excluded.id
       returning *`,
      [FAMILY_MAP_STATE_ID],
    );
    return mapState(inserted.rows[0]!);
  }

  async updateState(input: PersistedFamilyMapStateInput, actorFamilyMemberId: string, now: string): Promise<FamilyMapStateRecord | null> {
    const result = await this.pool.query<FamilyMapRow>(
      `update family_map_state
          set points = $2::jsonb,
              zones = $3::jsonb,
              version = version + 1,
              updated_by_family_member_id = $4,
              updated_at = $5
        where id = $1 and version = $6
        returning *`,
      [
        FAMILY_MAP_STATE_ID,
        JSON.stringify(input.points),
        JSON.stringify(input.zones),
        actorFamilyMemberId,
        now,
        input.expectedVersion,
      ],
    );
    return result.rows[0] ? mapState(result.rows[0]) : null;
  }

  async recordAudit(entry: FamilyMapAuditEntry): Promise<void> {
    await this.pool.query(
      `insert into family_audit_log
        (id, actor_family_member_id, actor_type, action, entity_type, entity_id, before_data, after_data, metadata)
       values ($1, $2, 'user', $3, 'family_map_state', $4, $5, $6, $7)`,
      [
        randomUUID(),
        entry.actorFamilyMemberId,
        entry.action,
        entry.entityId,
        entry.beforeData === undefined ? null : JSON.stringify(entry.beforeData),
        entry.afterData === undefined ? null : JSON.stringify(entry.afterData),
        entry.metadata ? JSON.stringify(entry.metadata) : null,
      ],
    );
  }
}

function mapState(row: FamilyMapRow): FamilyMapStateRecord {
  return {
    id: row.id,
    points: Array.isArray(row.points) ? (row.points as FamilyMapPointRecord[]) : [],
    zones: Array.isArray(row.zones) ? (row.zones as FamilyMapZoneRecord[]) : [],
    version: row.version,
    updatedByFamilyMemberId: row.updated_by_family_member_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
