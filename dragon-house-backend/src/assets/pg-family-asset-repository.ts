import { FamilyAssetError } from './family-asset-service.js';
import type pg from 'pg';
import type { FamilyAssetRepository } from './family-asset-repository.js';
import type { FamilyAssetRecord, FamilyAssetSlot } from './family-asset-models.js';

type Row = {
  id: string;
  slot: string;
  kind: string;
  status: string;
  storage_provider: string;
  storage_key: string;
  original_filename: string;
  content_type: string;
  size_bytes: string;
  checksum_sha256: string;
  width: number | null;
  height: number | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  version: number;
};
const select = `select a.id,coalesce(s.slot,'quest_cleanup') as slot,a.kind,a.status,a.storage_provider,a.storage_key,a.original_filename,a.content_type,a.size_bytes,a.checksum_sha256,a.width,a.height,a.created_by,a.created_at,a.updated_at,a.version from family_assets a left join family_asset_slot_assignments s on s.asset_id=a.id`;

export class PgFamilyAssetRepository implements FamilyAssetRepository {
  constructor(private readonly pool: pg.Pool) {}
  async findState(slot: FamilyAssetSlot) {
    const result = await this.pool.query<{ version: number; asset: Row | null }>(
      `select state.version, (select row_to_json(x) from (${select} where a.id=state.asset_id) x) as asset from family_asset_slot_assignments state where state.slot=$1`, [slot]);
    const state = result.rows[0];
    if (!state) throw new Error('Missing canonical asset slot');
    return { version: state.version, asset: state.asset ? map(state.asset) : null };
  }
  async findCurrent(slot: FamilyAssetSlot) {
    const r = await this.pool.query<Row>(`${select} where s.slot=$1 and a.status='active'`, [slot]);
    return r.rows[0] ? map(r.rows[0]) : null;
  }
  async findById(id: string) {
    const r = await this.pool.query<Row>(`${select} where a.id=$1`, [id]);
    return r.rows[0] ? map(r.rows[0]) : null;
  }
  async assign(input: Omit<FamilyAssetRecord, 'createdAt' | 'updatedAt' | 'version' | 'slot'>, slot: FamilyAssetSlot, expectedVersion: number) {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query('select pg_advisory_xact_lock(hashtext($1))', [slot]);
      const old = await client.query<{ asset_id: string | null; version: number }>(
        'select asset_id, version from family_asset_slot_assignments where slot=$1 for update',
        [slot],
      );
      checkVersion(old.rows[0]?.version, expectedVersion);
      await client.query(
        `insert into family_assets(id,kind,status,storage_provider,storage_key,original_filename,content_type,size_bytes,checksum_sha256,width,height,created_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          input.id,
          input.kind,
          input.status,
          input.storageProvider,
          input.storageKey,
          input.originalFilename,
          input.contentType,
          input.sizeBytes,
          input.checksumSha256,
          input.width,
          input.height,
          input.createdBy,
        ],
      );
      await client.query(
        `insert into family_asset_slot_assignments(slot,asset_id,assigned_by) values($1,$2,$3) on conflict(slot) do update set asset_id=excluded.asset_id,assigned_by=excluded.assigned_by,assigned_at=now(),version=family_asset_slot_assignments.version+1`,
        [slot, input.id, input.createdBy],
      );
      if (old.rows[0]?.asset_id)
        await client.query(
          `update family_assets set status='archived',archived_at=now(),updated_at=now(),version=version+1 where id=$1`,
          [old.rows[0].asset_id],
        );
      await audit(
        client,
        input.createdBy,
        old.rows[0]?.asset_id ? 'shared_asset_slot_replaced' : 'shared_asset_uploaded',
        input.id,
        slot,
      );
      const result = await client.query<Row>(`${select} where a.id=$1`, [input.id]);
      const assigned = map(result.rows[0]!);
      await client.query('commit');
      return assigned;
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally {
      client.release();
    }
  }
  async reset(slot: FamilyAssetSlot, actorId: string, expectedVersion: number) {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query('select pg_advisory_xact_lock(hashtext($1))', [slot]);
      const old = await client.query<{ asset_id: string | null; version: number }>(
        'select asset_id, version from family_asset_slot_assignments where slot=$1 for update',
        [slot],
      );
      checkVersion(old.rows[0]?.version, expectedVersion);
      await client.query('update family_asset_slot_assignments set asset_id=null,assigned_by=$2,assigned_at=now(),version=version+1 where slot=$1', [slot, actorId]);
      if (old.rows[0]?.asset_id) {
        await client.query(
          `update family_assets set status='archived',archived_at=now(),updated_at=now(),version=version+1 where id=$1`,
          [old.rows[0].asset_id],
        );
        await audit(client, actorId, 'shared_asset_slot_reset', old.rows[0].asset_id, slot);
      }
      await client.query('commit');
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally {
      client.release();
    }
  }
}
async function audit(client: pg.PoolClient, actor: string | null, action: string, id: string, slot: string) {
  await client.query(
    `insert into family_audit_log(id,actor_family_member_id,actor_type,action,entity_type,entity_id,before_data,after_data,metadata) values(gen_random_uuid()::text,$1,'user',$2,'family_asset',$3,null,$4,$5)`,
    [
      actor,
      action,
      id,
      JSON.stringify({ slot }),
      JSON.stringify({
        slot,
        label:
          action === 'shared_asset_slot_reset'
            ? 'Спільне зображення повернуто до стандартного'
            : action === 'shared_asset_slot_replaced'
              ? 'Спільне зображення замінено'
              : 'Спільне зображення завантажено',
      }),
    ],
  );
}
function map(r: Row): FamilyAssetRecord {
  return {
    id: r.id,
    slot: r.slot as FamilyAssetSlot,
    kind: r.kind,
    status: r.status,
    storageProvider: r.storage_provider,
    storageKey: r.storage_key,
    originalFilename: r.original_filename,
    contentType: r.content_type,
    sizeBytes: Number(r.size_bytes),
    checksumSha256: r.checksum_sha256,
    width: r.width,
    height: r.height,
    createdBy: r.created_by,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
    version: r.version,
  };
}

function checkVersion(actual: number | undefined, expected: number) {
  if (actual !== expected) throw new FamilyAssetError('ASSET_VERSION_CONFLICT', 409, 'Зображення вже змінено іншим учасником. Оновіть дані перед повторною дією.');
}
