import type pg from 'pg';
import { randomUUID } from 'node:crypto';
import type { FamilyTreasuryAuditEntry, FamilyTreasuryRepository } from './treasury-repository.js';
import type { FamilyTreasuryEntryInput, FamilyTreasuryEntryRecord, FamilyTreasuryListQuery } from './treasury-models.js';

type TreasuryRow = {
  id: string;
  category: FamilyTreasuryEntryRecord['category'];
  title: string;
  location_number: string | null;
  location_reference: string | null;
  description: string;
  price: string | null;
  price_amount: string | null;
  price_note: string | null;
  note: string | null;
  is_active: boolean;
  version: number;
  created_by_family_member_id: string | null;
  updated_by_family_member_id: string | null;
  created_at: Date;
  updated_at: Date;
};

export class PgFamilyTreasuryRepository implements FamilyTreasuryRepository {
  constructor(private readonly pool: pg.Pool) {}

  async listEntries(query: FamilyTreasuryListQuery): Promise<FamilyTreasuryEntryRecord[]> {
    const result = await this.pool.query<TreasuryRow>(
      `
        select *
        from family_treasury_entries
        where ($1::boolean = true or is_active = true)
        order by updated_at desc, title asc
      `,
      [query.includeInactive === true],
    );
    return result.rows.map(mapEntry);
  }

  async findEntryById(id: string): Promise<FamilyTreasuryEntryRecord | null> {
    const result = await this.pool.query<TreasuryRow>('select * from family_treasury_entries where id = $1', [id]);
    return result.rows[0] ? mapEntry(result.rows[0]) : null;
  }

  async createEntry(input: FamilyTreasuryEntryInput, actorFamilyMemberId: string, now: string): Promise<FamilyTreasuryEntryRecord> {
    const result = await this.pool.query<TreasuryRow>(
      `
        insert into family_treasury_entries (
          category, title, location_number, location_reference, description, price, price_amount, price_note, note,
          created_by_family_member_id, updated_by_family_member_id, created_at, updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $11, $11)
        returning *
      `,
      [
        input.category,
        input.title,
        input.locationNumber ?? null,
        input.locationReference ?? null,
        input.description ?? '',
        input.price ?? legacyPrice(input.priceAmount ?? null, input.priceNote ?? null),
        input.priceAmount ?? null,
        input.priceNote ?? input.price ?? null,
        input.note ?? null,
        actorFamilyMemberId,
        now,
      ],
    );
    return mapEntry(result.rows[0]!);
  }

  async updateEntry(id: string, input: Partial<FamilyTreasuryEntryInput>, actorFamilyMemberId: string, now: string): Promise<FamilyTreasuryEntryRecord | null> {
    const current = await this.findEntryById(id);
    if (!current) return null;
    const result = await this.pool.query<TreasuryRow>(
      `
        update family_treasury_entries
        set category = $2,
            title = $3,
            location_number = $4,
            location_reference = $5,
            description = $6,
            price = $7,
            price_amount = $8,
            price_note = $9,
            note = $10,
            updated_by_family_member_id = $11,
            updated_at = $12,
            version = version + 1
        where id = $1
          and ($13::integer is null or version = $13)
        returning *
      `,
      [
        id,
        input.category ?? current.category,
        input.title ?? current.title,
        input.locationNumber === undefined ? current.locationNumber : input.locationNumber,
        input.locationReference === undefined ? current.locationReference : input.locationReference,
        input.description ?? current.description,
        input.price === undefined ? current.price : input.price,
        input.priceAmount === undefined ? current.priceAmount : input.priceAmount,
        input.priceNote === undefined ? current.priceNote : input.priceNote,
        input.note === undefined ? current.note : input.note,
        actorFamilyMemberId,
        now,
        input.expectedVersion ?? null,
      ],
    );
    return result.rows[0] ? mapEntry(result.rows[0]) : null;
  }

  async archiveEntry(id: string, expectedVersion: number, actorFamilyMemberId: string, now: string): Promise<FamilyTreasuryEntryRecord | null> {
    const result = await this.pool.query<TreasuryRow>(
      `
        update family_treasury_entries
        set is_active = false,
            updated_by_family_member_id = $2,
            updated_at = $3,
            version = version + 1
        where id = $1 and version = $4
        returning *
      `,
      [id, actorFamilyMemberId, now, expectedVersion],
    );
    return result.rows[0] ? mapEntry(result.rows[0]) : null;
  }

  async recordAudit(entry: FamilyTreasuryAuditEntry): Promise<void> {
    await this.pool.query(
      `insert into family_audit_log
        (id, actor_family_member_id, actor_type, action, entity_type, entity_id, before_data, after_data, metadata)
       values ($1, $2, 'user', $3, 'family_treasury_entry', $4, $5, $6, $7)`,
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

function mapEntry(row: TreasuryRow): FamilyTreasuryEntryRecord {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    locationNumber: row.location_number,
    locationReference: row.location_reference,
    description: row.description,
    price: row.price,
    priceAmount: row.price_amount == null ? null : Number(row.price_amount),
    priceNote: row.price_note,
    note: row.note,
    isActive: row.is_active,
    version: row.version,
    createdByFamilyMemberId: row.created_by_family_member_id,
    updatedByFamilyMemberId: row.updated_by_family_member_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function legacyPrice(priceAmount: number | null, priceNote: string | null): string | null {
  if (priceNote) return priceNote;
  return priceAmount == null ? null : String(priceAmount);
}
