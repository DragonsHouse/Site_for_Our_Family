import type { FamilyTreasuryEntryInput, FamilyTreasuryEntryRecord, FamilyTreasuryListQuery } from './treasury-models.js';

export interface FamilyTreasuryRepository {
  listEntries(query: FamilyTreasuryListQuery): Promise<FamilyTreasuryEntryRecord[]>;
  findEntryById(id: string): Promise<FamilyTreasuryEntryRecord | null>;
  createEntry(input: FamilyTreasuryEntryInput, actorFamilyMemberId: string, now: string): Promise<FamilyTreasuryEntryRecord>;
  updateEntry(id: string, input: Partial<FamilyTreasuryEntryInput>, actorFamilyMemberId: string, now: string): Promise<FamilyTreasuryEntryRecord | null>;
  archiveEntry(id: string, expectedVersion: number, actorFamilyMemberId: string, now: string): Promise<FamilyTreasuryEntryRecord | null>;
  recordAudit?(entry: FamilyTreasuryAuditEntry): Promise<void>;
}

export type FamilyTreasuryAuditEntry = {
  actorFamilyMemberId: string | null;
  action: 'treasury_entry_created' | 'treasury_entry_updated' | 'treasury_entry_archived';
  entityId: string;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: Record<string, unknown> | null;
};

export class MemoryFamilyTreasuryRepository implements FamilyTreasuryRepository {
  constructor(private entries: FamilyTreasuryEntryRecord[] = []) {}

  async listEntries(query: FamilyTreasuryListQuery): Promise<FamilyTreasuryEntryRecord[]> {
    return this.entries
      .filter((entry) => query.includeInactive || entry.isActive)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async findEntryById(id: string): Promise<FamilyTreasuryEntryRecord | null> {
    return this.entries.find((entry) => entry.id === id) ?? null;
  }

  async createEntry(input: FamilyTreasuryEntryInput, actorFamilyMemberId: string, now: string): Promise<FamilyTreasuryEntryRecord> {
    const entry: FamilyTreasuryEntryRecord = {
      id: `treasury-${this.entries.length + 1}`,
      category: input.category,
      title: input.title,
      locationNumber: input.locationNumber ?? null,
      locationReference: input.locationReference ?? null,
      description: input.description ?? '',
      price: input.price ?? legacyPrice(input.priceAmount ?? null, input.priceNote ?? input.price ?? null),
      priceAmount: input.priceAmount ?? null,
      priceNote: input.priceNote ?? input.price ?? null,
      note: input.note ?? null,
      isActive: true,
      version: 1,
      createdByFamilyMemberId: actorFamilyMemberId,
      updatedByFamilyMemberId: actorFamilyMemberId,
      createdAt: now,
      updatedAt: now,
    };
    this.entries = [entry, ...this.entries];
    return entry;
  }

  async updateEntry(id: string, input: Partial<FamilyTreasuryEntryInput>, actorFamilyMemberId: string, now: string): Promise<FamilyTreasuryEntryRecord | null> {
    const current = await this.findEntryById(id);
    if (!current) return null;
    if (input.expectedVersion !== undefined && current.version !== input.expectedVersion) return null;
    const updated: FamilyTreasuryEntryRecord = {
      ...current,
      ...input,
      locationNumber: input.locationNumber === undefined ? current.locationNumber : input.locationNumber,
      locationReference: input.locationReference === undefined ? current.locationReference : input.locationReference,
      price: input.price === undefined ? current.price : input.price,
      priceAmount: input.priceAmount === undefined ? current.priceAmount : input.priceAmount,
      priceNote: input.priceNote === undefined ? current.priceNote : input.priceNote,
      note: input.note === undefined ? current.note : input.note,
      version: current.version + 1,
      updatedByFamilyMemberId: actorFamilyMemberId,
      updatedAt: now,
    };
    this.entries = this.entries.map((entry) => (entry.id === id ? updated : entry));
    return updated;
  }

  async archiveEntry(id: string, expectedVersion: number, actorFamilyMemberId: string, now: string): Promise<FamilyTreasuryEntryRecord | null> {
    const current = await this.findEntryById(id);
    if (!current || current.version !== expectedVersion) return null;
    const updated = await this.updateEntry(id, { expectedVersion }, actorFamilyMemberId, now);
    if (!updated) return null;
    const archived = { ...updated, isActive: false, updatedAt: now, updatedByFamilyMemberId: actorFamilyMemberId };
    this.entries = this.entries.map((entry) => (entry.id === id ? archived : entry));
    return archived;
  }

  async recordAudit(_entry: FamilyTreasuryAuditEntry): Promise<void> {
    // In-memory repository keeps Treasury tests focused on domain behavior.
  }
}

function legacyPrice(priceAmount: number | null, priceNote: string | null): string | null {
  if (priceNote) return priceNote;
  return priceAmount == null ? null : String(priceAmount);
}
