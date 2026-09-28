import type pg from 'pg';
import type { FamilyTreasuryEntryInput, FamilyTreasuryEntryRecord, FamilyTreasuryListQuery } from './treasury-models.js';

type TreasuryRow = {
  id: string;
  category: FamilyTreasuryEntryRecord['category'];
  title: string;
  location_number: string | null;
  location_reference: string | null;
  description: string;
  price: string | null;
  note: string | null;
  is_active: boolean;
  created_by_family_member_id: string | null;
  updated_by_family_member_id: string | null;
  created_at: Date;
  updated_at: Date;
};

export class PgFamilyTreasuryRepository {
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
          category, title, location_number, location_reference, description, price, note,
          created_by_family_member_id, updated_by_family_member_id, created_at, updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $9)
        returning *
      `,
      [
        input.category,
        input.title,
        input.locationNumber ?? null,
        input.locationReference ?? null,
        input.description ?? '',
        input.price ?? null,
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
            note = $8,
            updated_by_family_member_id = $9,
            updated_at = $10
        where id = $1
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
        input.note === undefined ? current.note : input.note,
        actorFamilyMemberId,
        now,
      ],
    );
    return result.rows[0] ? mapEntry(result.rows[0]) : null;
  }

  async archiveEntry(id: string, actorFamilyMemberId: string, now: string): Promise<FamilyTreasuryEntryRecord | null> {
    const result = await this.pool.query<TreasuryRow>(
      `
        update family_treasury_entries
        set is_active = false,
            updated_by_family_member_id = $2,
            updated_at = $3
        where id = $1
        returning *
      `,
      [id, actorFamilyMemberId, now],
    );
    return result.rows[0] ? mapEntry(result.rows[0]) : null;
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
    note: row.note,
    isActive: row.is_active,
    createdByFamilyMemberId: row.created_by_family_member_id,
    updatedByFamilyMemberId: row.updated_by_family_member_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
