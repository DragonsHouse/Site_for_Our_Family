import type { FamilyAuthContext } from '../types.js';
import { FamilyTreasuryError } from './treasury-errors.js';
import type { FamilyTreasuryEntryInput, FamilyTreasuryEntryRecord, FamilyTreasuryListQuery } from './treasury-models.js';
import type { FamilyTreasuryRepository } from './treasury-repository.js';

export class FamilyTreasuryService {
  constructor(private readonly repository: FamilyTreasuryRepository) {}

  async listEntries(query: FamilyTreasuryListQuery, auth: FamilyAuthContext): Promise<{ items: FamilyTreasuryEntryRecord[] }> {
    this.assertCanRead(auth);
    const includeInactive = query.includeInactive === true && this.canManage(auth);
    return { items: await this.repository.listEntries({ includeInactive }) };
  }

  async createEntry(input: FamilyTreasuryEntryInput, auth: FamilyAuthContext, now = new Date()): Promise<FamilyTreasuryEntryRecord> {
    this.assertCanManage(auth);
    return this.repository.createEntry(normalizeInput(input), auth.familyMemberId, now.toISOString());
  }

  async updateEntry(id: string, input: Partial<FamilyTreasuryEntryInput>, auth: FamilyAuthContext, now = new Date()): Promise<FamilyTreasuryEntryRecord> {
    this.assertCanManage(auth);
    const updated = await this.repository.updateEntry(id, normalizeInput(input, true), auth.familyMemberId, now.toISOString());
    if (!updated) throw new FamilyTreasuryError('TREASURY_ENTRY_NOT_FOUND', 'Treasury entry not found.', 404);
    return updated;
  }

  async archiveEntry(id: string, auth: FamilyAuthContext, now = new Date()): Promise<FamilyTreasuryEntryRecord> {
    this.assertCanManage(auth);
    const archived = await this.repository.archiveEntry(id, auth.familyMemberId, now.toISOString());
    if (!archived) throw new FamilyTreasuryError('TREASURY_ENTRY_NOT_FOUND', 'Treasury entry not found.', 404);
    return archived;
  }

  private assertCanRead(auth: FamilyAuthContext): void {
    if (auth.status !== 'active') {
      throw new FamilyTreasuryError('TREASURY_PERMISSION_DENIED', 'Inactive members cannot view treasury entries.', 403);
    }
  }

  private assertCanManage(auth: FamilyAuthContext): void {
    if (this.canManage(auth)) return;
    throw new FamilyTreasuryError('TREASURY_PERMISSION_DENIED', 'Permission denied.', 403);
  }

  private canManage(auth: FamilyAuthContext): boolean {
    return auth.role === 'owner' || auth.rank >= 8 || auth.permissions.includes('manage_family_economy') || auth.permissions.includes('manage_treasury');
  }
}

const categories = new Set(['fuel', 'clothing', 'weapons', 'shops', 'other']);

function normalizeInput<T extends Partial<FamilyTreasuryEntryInput>>(input: T, partial = false): T {
  const title = input.title?.trim();
  if (!partial || input.title !== undefined) assertText(title, 'title');
  if (input.category !== undefined && !categories.has(input.category)) {
    throw new FamilyTreasuryError('VALIDATION_ERROR', 'Invalid treasury category.', 400);
  }
  return {
    ...input,
    title,
    locationNumber: cleanNullable(input.locationNumber),
    locationReference: cleanNullable(input.locationReference),
    description: input.description?.trim() ?? (partial ? undefined : ''),
    price: cleanNullable(input.price),
    note: cleanNullable(input.note),
  };
}

function assertText(value: string | undefined, field: string): void {
  if (!value) throw new FamilyTreasuryError('VALIDATION_ERROR', `${field} is required.`, 400);
}

function cleanNullable(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const next = value?.trim();
  return next || null;
}
