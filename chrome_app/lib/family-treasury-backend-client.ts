import { authenticatedFetch } from './family-backend-auth-client.ts';
import type { FamilyEconomyCategory, FamilyEconomyEntry } from './family-types.ts';

export type TreasuryEntryInput = {
  category: FamilyEconomyCategory;
  title: string;
  locationNumber?: string | null;
  locationReference?: string | null;
  description?: string;
  price?: string | null;
  note?: string | null;
};

export type TreasuryEntryPatch = Partial<TreasuryEntryInput>;

export async function listFamilyTreasuryEntries(signal?: AbortSignal): Promise<{ items: FamilyEconomyEntry[] }> {
  const response = await authenticatedFetch('/api/family/treasury/entries', { method: 'GET', signal });
  return parseListResponse(response);
}

export async function createFamilyTreasuryEntry(input: TreasuryEntryInput): Promise<FamilyEconomyEntry> {
  return parseEntryResponse(await authenticatedFetch('/api/family/treasury/entries', {
    method: 'POST',
    body: JSON.stringify(input),
  }));
}

export async function updateFamilyTreasuryEntry(entryId: string, input: TreasuryEntryPatch): Promise<FamilyEconomyEntry> {
  return parseEntryResponse(await authenticatedFetch(`/api/family/treasury/entries/${encodeURIComponent(entryId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }));
}

export async function archiveFamilyTreasuryEntry(entryId: string): Promise<FamilyEconomyEntry> {
  return parseEntryResponse(await authenticatedFetch(`/api/family/treasury/entries/${encodeURIComponent(entryId)}`, {
    method: 'DELETE',
  }));
}

async function parseListResponse(response: Response): Promise<{ items: FamilyEconomyEntry[] }> {
  const body = await parseJson(response);
  if (!isRecord(body) || !Array.isArray(body.items)) throw new Error('Не вдалося прочитати дані Скарбниці.');
  return { items: body.items.map(parseEntry) };
}

async function parseEntryResponse(response: Response): Promise<FamilyEconomyEntry> {
  return parseEntry(await parseJson(response));
}

async function parseJson(response: Response): Promise<unknown> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const message = isRecord(body) && typeof body.message === 'string' ? body.message : 'Не вдалося зберегти дані.';
    throw new Error(message);
  }
  return body;
}

function parseEntry(value: unknown): FamilyEconomyEntry {
  if (!isRecord(value)) throw new Error('Не вдалося прочитати запис Скарбниці.');
  return {
    id: stringField(value, 'id'),
    category: categoryField(value, 'category'),
    title: stringField(value, 'title'),
    locationNumber: nullableStringField(value, 'locationNumber'),
    locationReference: nullableStringField(value, 'locationReference'),
    description: stringField(value, 'description'),
    price: nullableStringField(value, 'price'),
    note: nullableStringField(value, 'note'),
    createdBy: nullableStringField(value, 'createdByFamilyMemberId') ?? '',
    createdAt: stringField(value, 'createdAt'),
    updatedAt: stringField(value, 'updatedAt'),
    isActive: booleanField(value, 'isActive'),
  };
}

function categoryField(record: Record<string, unknown>, key: string): FamilyEconomyCategory {
  const value = stringField(record, key);
  if (value === 'fuel' || value === 'clothing' || value === 'weapons' || value === 'shops' || value === 'other') return value;
  throw new Error('Не вдалося прочитати категорію Скарбниці.');
}

function stringField(record: Record<string, unknown>, key: string) {
  if (typeof record[key] !== 'string') throw new Error('Не вдалося прочитати дані.');
  return record[key];
}

function nullableStringField(record: Record<string, unknown>, key: string) {
  if (record[key] === null || record[key] === undefined) return null;
  return stringField(record, key);
}

function booleanField(record: Record<string, unknown>, key: string) {
  if (typeof record[key] !== 'boolean') throw new Error('Не вдалося прочитати дані.');
  return record[key];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
