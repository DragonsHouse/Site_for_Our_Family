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
    const created = await this.repository.createEntry(normalizeInput(input), auth.familyMemberId, now.toISOString());
    await this.repository.recordAudit?.({
      actorFamilyMemberId: auth.familyMemberId,
      action: 'treasury_entry_created',
      entityId: created.id,
      beforeData: null,
      afterData: auditSummary(created),
      metadata: null,
    });
    return created;
  }

  async updateEntry(id: string, input: Partial<FamilyTreasuryEntryInput>, auth: FamilyAuthContext, now = new Date()): Promise<FamilyTreasuryEntryRecord> {
    this.assertCanManage(auth);
    const current = await this.repository.findEntryById(id);
    if (!current) throw new FamilyTreasuryError('TREASURY_ENTRY_NOT_FOUND', 'Treasury entry not found.', 404);
    if (input.expectedVersion === undefined) {
      throw new FamilyTreasuryError('VALIDATION_ERROR', 'expectedVersion is required for Treasury updates.', 400);
    }
    const updated = await this.repository.updateEntry(id, normalizeInput(input, true), auth.familyMemberId, now.toISOString());
    if (!updated) throw new FamilyTreasuryError('TREASURY_VERSION_CONFLICT', 'Treasury entry was changed by another user.', 409);
    await this.repository.recordAudit?.({
      actorFamilyMemberId: auth.familyMemberId,
      action: 'treasury_entry_updated',
      entityId: updated.id,
      beforeData: auditSummary(current),
      afterData: auditSummary(updated),
      metadata: changedFields(current, updated),
    });
    return updated;
  }

  async archiveEntry(id: string, expectedVersion: number, auth: FamilyAuthContext, now = new Date()): Promise<FamilyTreasuryEntryRecord> {
    this.assertCanManage(auth);
    const current = await this.repository.findEntryById(id);
    if (!current) throw new FamilyTreasuryError('TREASURY_ENTRY_NOT_FOUND', 'Treasury entry not found.', 404);
    const archived = await this.repository.archiveEntry(id, expectedVersion, auth.familyMemberId, now.toISOString());
    if (!archived) throw new FamilyTreasuryError('TREASURY_VERSION_CONFLICT', 'Treasury entry was changed by another user.', 409);
    await this.repository.recordAudit?.({
      actorFamilyMemberId: auth.familyMemberId,
      action: 'treasury_entry_archived',
      entityId: archived.id,
      beforeData: auditSummary(current),
      afterData: auditSummary(archived),
      metadata: null,
    });
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
    return auth.role === 'owner' ||
      auth.role === 'deputy' ||
      auth.permissions.includes('manage_family_economy') ||
      auth.permissions.includes('manage_treasury');
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
    priceAmount: normalizePriceAmount(input.priceAmount),
    priceNote: cleanNullable(input.priceNote),
    note: cleanNullable(input.note),
    expectedVersion: input.expectedVersion,
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

function normalizePriceAmount(value: number | null | undefined): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!Number.isFinite(value) || value < 0 || value > 999_999_999_999) {
    throw new FamilyTreasuryError('VALIDATION_ERROR', 'Invalid price amount.', 400);
  }
  return Math.round(value * 100) / 100;
}

function auditSummary(entry: FamilyTreasuryEntryRecord | null): Record<string, unknown> | null {
  if (!entry) return null;
  return {
    id: entry.id,
    category: entry.category,
    title: entry.title,
    locationNumber: entry.locationNumber,
    priceAmount: entry.priceAmount,
    priceNote: entry.priceNote,
    note: entry.note,
    isActive: entry.isActive,
    version: entry.version,
  };
}

function changedFields(before: FamilyTreasuryEntryRecord, after: FamilyTreasuryEntryRecord): Record<string, unknown> {
  const fields: Array<keyof FamilyTreasuryEntryRecord> = [
    'category',
    'title',
    'locationNumber',
    'locationReference',
    'description',
    'priceAmount',
    'priceNote',
    'note',
    'isActive',
  ];
  return {
    changedFields: fields.filter((field) => before[field] !== after[field]),
  };
}
