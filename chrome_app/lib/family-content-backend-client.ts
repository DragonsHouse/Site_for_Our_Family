import { authenticatedFetch } from './family-backend-auth-client.ts';
import type { FamilyEditableContentBlock, FamilyPost, FamilyPostType, RecruitmentSettings } from './family-types.ts';

export type FamilyContentScope = 'home' | 'rules' | 'recruitment';

export class FamilyContentApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = 'FamilyContentApiError';
  }
}

export async function listBackendFamilyContentBlocks(scope?: FamilyContentScope, signal?: AbortSignal): Promise<{ items: FamilyEditableContentBlock[] }> {
  const query = scope ? `?scope=${encodeURIComponent(scope)}` : '';
  const response = await authenticatedFetch(`/api/family/content/blocks${query}`, { method: 'GET', signal });
  const body = await parseJson(response);
  if (!isRecord(body) || !Array.isArray(body.items)) throw new Error('Не вдалося прочитати матеріали Dragon House.');
  return { items: body.items.map(parseContentBlock) };
}

export async function updateBackendFamilyContentBlock(block: FamilyEditableContentBlock): Promise<FamilyEditableContentBlock> {
  return parseContentBlock(await parseJson(await authenticatedFetch(`/api/family/content/blocks/${encodeURIComponent(block.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      title: block.title,
      body: block.body,
      contact: block.contact,
      expectedVersion: block.version,
    }),
  })));
}

export async function getBackendRecruitmentSettings(signal?: AbortSignal): Promise<RecruitmentSettings> {
  return parseRecruitment(await parseJson(await authenticatedFetch('/api/family/recruitment/settings', { method: 'GET', signal })));
}

export async function updateBackendRecruitmentSettings(settings: RecruitmentSettings): Promise<RecruitmentSettings> {
  return parseRecruitment(await parseJson(await authenticatedFetch('/api/family/recruitment/settings', {
    method: 'PATCH',
    body: JSON.stringify({
      isOpen: settings.isOpen,
      description: settings.text,
      requirements: settings.requirements,
      contact: settings.contact,
      expectedVersion: settings.version,
    }),
  })));
}

export async function listBackendFamilyNewsPosts(signal?: AbortSignal): Promise<{ items: FamilyPost[] }> {
  const response = await authenticatedFetch('/api/family/news/posts', { method: 'GET', signal });
  const body = await parseJson(response);
  if (!isRecord(body) || !Array.isArray(body.items)) throw new Error('Не вдалося прочитати новини Dragon House.');
  return { items: body.items.map(parseNewsPost) };
}

export async function createBackendFamilyNewsPost(input: {
  type: FamilyPostType;
  title: string;
  body: string;
  pinned?: boolean;
  urgent?: boolean;
  notificationRequired?: boolean;
}): Promise<FamilyPost> {
  return parseNewsPost(await parseJson(await authenticatedFetch('/api/family/news/posts', {
    method: 'POST',
    body: JSON.stringify(input),
  })));
}

async function parseJson(response: Response): Promise<unknown> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const message = isRecord(body) && typeof body.message === 'string' ? body.message : 'Dragon House Hub не зміг зберегти дані.';
    const code = isRecord(body) && typeof body.code === 'string' ? body.code : undefined;
    throw new FamilyContentApiError(message, response.status, code);
  }
  return body;
}

function parseContentBlock(value: unknown): FamilyEditableContentBlock {
  if (!isRecord(value)) throw new Error('Не вдалося прочитати матеріал Dragon House.');
  return {
    id: stringField(value, 'id'),
    scope: scopeField(value, 'scope'),
    title: stringField(value, 'title'),
    body: stringField(value, 'body'),
    contact: nullableStringField(value, 'contact'),
    updatedBy: nullableStringField(value, 'updatedByFamilyMemberId'),
    updatedAt: stringField(value, 'updatedAt'),
    sortOrder: numberField(value, 'sortOrder'),
    version: numberField(value, 'version'),
  };
}

function parseRecruitment(value: unknown): RecruitmentSettings {
  if (!isRecord(value) || !Array.isArray(value.requirements)) throw new Error('Не вдалося прочитати налаштування набору.');
  return {
    isOpen: booleanField(value, 'isOpen'),
    text: stringField(value, 'description'),
    requirements: value.requirements.filter((item): item is string => typeof item === 'string'),
    contact: stringField(value, 'contact'),
    author: nullableStringField(value, 'updatedByFamilyMemberId') ?? 'Dragon House',
    updatedAt: stringField(value, 'updatedAt'),
    version: numberField(value, 'version'),
  };
}

function parseNewsPost(value: unknown): FamilyPost {
  if (!isRecord(value)) throw new Error('Не вдалося прочитати новину Dragon House.');
  const type = postTypeField(value, 'type');
  const urgent = booleanField(value, 'urgent');
  return {
    id: stringField(value, 'id'),
    type,
    title: stringField(value, 'title'),
    body: stringField(value, 'body'),
    createdBy: stringField(value, 'authorName'),
    createdAt: stringField(value, 'createdAt'),
    updatedAt: stringField(value, 'updatedAt'),
    expiresAt: null,
    isPinned: booleanField(value, 'pinned'),
    target: 'all',
    targetRoles: [],
    targetUserIds: [],
    serverName: 'Dragon House Hub',
    isReadBy: [],
    notificationRequired: booleanField(value, 'notificationRequired') || urgent,
    version: numberField(value, 'version'),
    archivedAt: nullableStringField(value, 'archivedAt'),
  };
}

function scopeField(record: Record<string, unknown>, key: string): FamilyContentScope {
  const value = stringField(record, key);
  if (value === 'home' || value === 'rules' || value === 'recruitment') return value;
  throw new Error('Не вдалося прочитати тип матеріалу.');
}

function postTypeField(record: Record<string, unknown>, key: string): FamilyPostType {
  const value = stringField(record, key);
  if (value === 'urgent' || value === 'important' || value === 'family_news' || value === 'announcement' || value === 'recruitment' || value === 'poll' || value === 'family' || value === 'event' || value === 'info') return value;
  return 'info';
}

function stringField(record: Record<string, unknown>, key: string) {
  if (typeof record[key] !== 'string') throw new Error('Не вдалося прочитати дані Dragon House.');
  return record[key];
}

function nullableStringField(record: Record<string, unknown>, key: string) {
  if (record[key] === null || record[key] === undefined) return null;
  return stringField(record, key);
}

function booleanField(record: Record<string, unknown>, key: string) {
  if (typeof record[key] !== 'boolean') throw new Error('Не вдалося прочитати прапорець Dragon House.');
  return record[key];
}

function numberField(record: Record<string, unknown>, key: string) {
  if (typeof record[key] !== 'number' || !Number.isFinite(record[key])) throw new Error('Не вдалося прочитати версію Dragon House.');
  return record[key];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
