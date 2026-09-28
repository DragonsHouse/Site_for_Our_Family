import type { FamilyTreasuryEntryInput, FamilyTreasuryEntryRecord, FamilyTreasuryListQuery } from './treasury-models.js';

export interface FamilyTreasuryRepository {
  listEntries(query: FamilyTreasuryListQuery): Promise<FamilyTreasuryEntryRecord[]>;
  findEntryById(id: string): Promise<FamilyTreasuryEntryRecord | null>;
  createEntry(input: FamilyTreasuryEntryInput, actorFamilyMemberId: string, now: string): Promise<FamilyTreasuryEntryRecord>;
  updateEntry(id: string, input: Partial<FamilyTreasuryEntryInput>, actorFamilyMemberId: string, now: string): Promise<FamilyTreasuryEntryRecord | null>;
  archiveEntry(id: string, actorFamilyMemberId: string, now: string): Promise<FamilyTreasuryEntryRecord | null>;
}

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
      price: input.price ?? null,
      note: input.note ?? null,
      isActive: true,
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
    const updated: FamilyTreasuryEntryRecord = {
      ...current,
      ...input,
      locationNumber: input.locationNumber === undefined ? current.locationNumber : input.locationNumber,
      locationReference: input.locationReference === undefined ? current.locationReference : input.locationReference,
      price: input.price === undefined ? current.price : input.price,
      note: input.note === undefined ? current.note : input.note,
      updatedByFamilyMemberId: actorFamilyMemberId,
      updatedAt: now,
    };
    this.entries = this.entries.map((entry) => (entry.id === id ? updated : entry));
    return updated;
  }

  async archiveEntry(id: string, actorFamilyMemberId: string, now: string): Promise<FamilyTreasuryEntryRecord | null> {
    const updated = await this.updateEntry(id, {}, actorFamilyMemberId, now);
    if (!updated) return null;
    const archived = { ...updated, isActive: false, updatedAt: now, updatedByFamilyMemberId: actorFamilyMemberId };
    this.entries = this.entries.map((entry) => (entry.id === id ? archived : entry));
    return archived;
  }
}
