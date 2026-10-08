import type { FamilyAuthContext } from '../types.js';
import { FamilyContentError } from './content-errors.js';
import type {
  FamilyContentBlockInput,
  FamilyContentBlockRecord,
  FamilyContentScope,
  FamilyNewsPostInput,
  FamilyRecruitmentSettingsInput,
} from './content-models.js';
import type { FamilyContentRepository } from './content-repository.js';

export class FamilyContentService {
  constructor(private readonly repository: FamilyContentRepository) {}

  async listContentBlocks(scope: FamilyContentScope | undefined, auth: FamilyAuthContext): Promise<{ items: FamilyContentBlockRecord[] }> {
    this.assertActive(auth);
    return { items: await this.repository.listContentBlocks(scope) };
  }

  async updateContentBlock(id: string, input: FamilyContentBlockInput, auth: FamilyAuthContext, now = new Date()) {
    this.assertCanManageContent(auth);
    const current = await this.repository.findContentBlockById(id);
    if (!current) throw new FamilyContentError('CONTENT_NOT_FOUND', 'Content block not found.', 404);
    if (!input.expectedVersion || current.version !== input.expectedVersion) {
      throw new FamilyContentError('CONTENT_VERSION_CONFLICT', 'Content block changed.', 409);
    }
    const normalized = normalizeBlockInput(input);
    const updated = await this.repository.updateContentBlock(id, normalized, auth.familyMemberId, now.toISOString());
    if (!updated) throw new FamilyContentError('CONTENT_VERSION_CONFLICT', 'Content block changed.', 409);
    await this.repository.recordAudit?.({
      actorFamilyMemberId: auth.familyMemberId,
      action: 'content_block_updated',
      entityType: 'family_content_block',
      entityId: id,
      beforeData: auditBlock(current),
      afterData: auditBlock(updated),
      metadata: changedFields(current, updated, ['title', 'body', 'contact']),
    });
    return updated;
  }

  async getRecruitmentSettings(auth: FamilyAuthContext) {
    this.assertActive(auth);
    const settings = await this.repository.getRecruitmentSettings();
    if (!settings) throw new FamilyContentError('CONTENT_NOT_FOUND', 'Recruitment settings not found.', 404);
    return settings;
  }

  async updateRecruitmentSettings(input: FamilyRecruitmentSettingsInput, auth: FamilyAuthContext, now = new Date()) {
    this.assertCanManageRecruitment(auth);
    const current = await this.repository.getRecruitmentSettings();
    if (!current) throw new FamilyContentError('CONTENT_NOT_FOUND', 'Recruitment settings not found.', 404);
    if (!input.expectedVersion || current.version !== input.expectedVersion) {
      throw new FamilyContentError('CONTENT_VERSION_CONFLICT', 'Recruitment settings changed.', 409);
    }
    const normalized = normalizeRecruitmentInput(input);
    const updated = await this.repository.updateRecruitmentSettings(normalized, auth.familyMemberId, now.toISOString());
    if (!updated) throw new FamilyContentError('CONTENT_VERSION_CONFLICT', 'Recruitment settings changed.', 409);
    await this.repository.recordAudit?.({
      actorFamilyMemberId: auth.familyMemberId,
      action: 'recruitment_settings_updated',
      entityType: 'family_recruitment_settings',
      entityId: 'dragon-house',
      beforeData: current,
      afterData: updated,
      metadata: changedFields(current, updated, ['isOpen', 'description', 'requirements', 'contact']),
    });
    return updated;
  }

  async listNewsPosts(query: { includeArchived?: boolean }, auth: FamilyAuthContext) {
    this.assertActive(auth);
    return { items: await this.repository.listNewsPosts({ includeArchived: query.includeArchived === true && this.canManageNews(auth) }) };
  }

  async createNewsPost(input: FamilyNewsPostInput, auth: FamilyAuthContext, now = new Date()) {
    this.assertCanManageNews(auth);
    const normalized = normalizeNewsInput(input);
    const created = await this.repository.createNewsPost(normalized, auth.familyMemberId, 'Dragon House', now.toISOString());
    await this.repository.recordAudit?.({
      actorFamilyMemberId: auth.familyMemberId,
      action: 'family_news_created',
      entityType: 'family_news_post',
      entityId: created.id,
      beforeData: null,
      afterData: auditNews(created),
      metadata: null,
    });
    return created;
  }

  async updateNewsPost(id: string, input: Partial<FamilyNewsPostInput>, auth: FamilyAuthContext, now = new Date()) {
    this.assertCanManageNews(auth);
    const current = (await this.repository.listNewsPosts({ includeArchived: true })).find((post) => post.id === id);
    if (!current) throw new FamilyContentError('CONTENT_NOT_FOUND', 'News post not found.', 404);
    if (!input.expectedVersion || current.version !== input.expectedVersion) {
      throw new FamilyContentError('CONTENT_VERSION_CONFLICT', 'News post changed.', 409);
    }
    const updated = await this.repository.updateNewsPost(id, normalizeNewsPatch(input), auth.familyMemberId, now.toISOString());
    if (!updated) throw new FamilyContentError('CONTENT_VERSION_CONFLICT', 'News post changed.', 409);
    await this.repository.recordAudit?.({
      actorFamilyMemberId: auth.familyMemberId,
      action: 'family_news_updated',
      entityType: 'family_news_post',
      entityId: id,
      beforeData: auditNews(current),
      afterData: auditNews(updated),
      metadata: changedFields(current, updated, ['type', 'title', 'body', 'pinned', 'urgent', 'notificationRequired']),
    });
    return updated;
  }

  async archiveNewsPost(id: string, expectedVersion: number, auth: FamilyAuthContext, now = new Date()) {
    this.assertCanManageNews(auth);
    const current = (await this.repository.listNewsPosts({ includeArchived: true })).find((post) => post.id === id);
    if (!current) throw new FamilyContentError('CONTENT_NOT_FOUND', 'News post not found.', 404);
    if (current.version !== expectedVersion) throw new FamilyContentError('CONTENT_VERSION_CONFLICT', 'News post changed.', 409);
    const archived = await this.repository.archiveNewsPost(id, expectedVersion, auth.familyMemberId, now.toISOString());
    if (!archived) throw new FamilyContentError('CONTENT_VERSION_CONFLICT', 'News post changed.', 409);
    await this.repository.recordAudit?.({
      actorFamilyMemberId: auth.familyMemberId,
      action: 'family_news_archived',
      entityType: 'family_news_post',
      entityId: id,
      beforeData: auditNews(current),
      afterData: auditNews(archived),
      metadata: null,
    });
    return archived;
  }

  private assertActive(auth: FamilyAuthContext): void {
    if (auth.status !== 'active') throw new FamilyContentError('CONTENT_PERMISSION_DENIED', 'Inactive member.', 403);
  }

  private assertCanManageContent(auth: FamilyAuthContext): void {
    if (auth.role === 'owner' || auth.permissions.includes('manage_family_news') || auth.permissions.includes('manage_news')) return;
    throw new FamilyContentError('CONTENT_PERMISSION_DENIED', 'Permission denied.', 403);
  }

  private assertCanManageRecruitment(auth: FamilyAuthContext): void {
    if (auth.role === 'owner' || auth.permissions.includes('manage_recruitment')) return;
    throw new FamilyContentError('CONTENT_PERMISSION_DENIED', 'Permission denied.', 403);
  }

  private assertCanManageNews(auth: FamilyAuthContext): void {
    if (this.canManageNews(auth)) return;
    throw new FamilyContentError('CONTENT_PERMISSION_DENIED', 'Permission denied.', 403);
  }

  private canManageNews(auth: FamilyAuthContext): boolean {
    return auth.role === 'owner' ||
      auth.permissions.includes('manage_news') ||
      auth.permissions.includes('manage_family_news') ||
      auth.permissions.includes('manage_family_posts');
  }
}

function normalizeBlockInput(input: FamilyContentBlockInput): FamilyContentBlockInput {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) throw new FamilyContentError('VALIDATION_ERROR', 'Title and body are required.', 400);
  return { ...input, title, body, contact: cleanNullable(input.contact) };
}

function normalizeRecruitmentInput(input: FamilyRecruitmentSettingsInput): FamilyRecruitmentSettingsInput {
  const description = input.description.trim();
  const contact = input.contact.trim();
  const requirements = input.requirements.map((item) => item.trim()).filter(Boolean);
  if (!description || !contact || !requirements.length) {
    throw new FamilyContentError('VALIDATION_ERROR', 'Recruitment description, contact and requirements are required.', 400);
  }
  return { ...input, description, contact, requirements };
}

function normalizeNewsInput(input: FamilyNewsPostInput): FamilyNewsPostInput {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) throw new FamilyContentError('VALIDATION_ERROR', 'News title and body are required.', 400);
  return {
    ...input,
    title,
    body,
    urgent: input.urgent ?? input.type === 'urgent',
    notificationRequired: input.notificationRequired ?? input.type === 'urgent',
  };
}

function normalizeNewsPatch(input: Partial<FamilyNewsPostInput>): Partial<FamilyNewsPostInput> {
  return {
    ...input,
    title: input.title === undefined ? undefined : input.title.trim(),
    body: input.body === undefined ? undefined : input.body.trim(),
  };
}

function cleanNullable(value: string | null | undefined): string | null {
  const clean = value?.trim();
  return clean || null;
}

function auditBlock(block: FamilyContentBlockRecord) {
  return { id: block.id, scope: block.scope, title: block.title, body: block.body, contact: block.contact, version: block.version };
}

function auditNews(post: { id: string; type: string; title: string; body: string; pinned: boolean; urgent: boolean; notificationRequired: boolean; archivedAt: string | null; version: number }) {
  return {
    id: post.id,
    type: post.type,
    title: post.title,
    body: post.body,
    pinned: post.pinned,
    urgent: post.urgent,
    notificationRequired: post.notificationRequired,
    archivedAt: post.archivedAt,
    version: post.version,
  };
}

function changedFields<T extends Record<string, unknown>>(before: T, after: T, fields: Array<keyof T>) {
  return { changedFields: fields.filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field])) };
}
