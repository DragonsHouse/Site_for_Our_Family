import type {
  FamilyContentBlockInput,
  FamilyContentBlockRecord,
  FamilyContentScope,
  FamilyNewsPostInput,
  FamilyNewsPostRecord,
  FamilyRecruitmentSettingsInput,
  FamilyRecruitmentSettingsRecord,
} from './content-models.js';

export interface FamilyContentRepository {
  listContentBlocks(scope?: FamilyContentScope): Promise<FamilyContentBlockRecord[]>;
  findContentBlockById(id: string): Promise<FamilyContentBlockRecord | null>;
  updateContentBlock(id: string, input: FamilyContentBlockInput, actorFamilyMemberId: string, now: string): Promise<FamilyContentBlockRecord | null>;
  getRecruitmentSettings(): Promise<FamilyRecruitmentSettingsRecord | null>;
  updateRecruitmentSettings(input: FamilyRecruitmentSettingsInput, actorFamilyMemberId: string, now: string): Promise<FamilyRecruitmentSettingsRecord | null>;
  listNewsPosts(query: { includeArchived?: boolean }): Promise<FamilyNewsPostRecord[]>;
  createNewsPost(input: FamilyNewsPostInput, actorFamilyMemberId: string, authorName: string, now: string): Promise<FamilyNewsPostRecord>;
  updateNewsPost(id: string, input: Partial<FamilyNewsPostInput>, actorFamilyMemberId: string, now: string): Promise<FamilyNewsPostRecord | null>;
  archiveNewsPost(id: string, expectedVersion: number, actorFamilyMemberId: string, now: string): Promise<FamilyNewsPostRecord | null>;
  recordAudit?(entry: FamilyContentAuditEntry): Promise<void>;
}

export type FamilyContentAuditEntry = {
  actorFamilyMemberId: string | null;
  action:
    | 'content_block_updated'
    | 'recruitment_settings_updated'
    | 'family_news_created'
    | 'family_news_updated'
    | 'family_news_archived';
  entityType: 'family_content_block' | 'family_recruitment_settings' | 'family_news_post';
  entityId: string;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: Record<string, unknown> | null;
};

export class MemoryFamilyContentRepository implements FamilyContentRepository {
  constructor(
    private contentBlocks: FamilyContentBlockRecord[] = [],
    private recruitmentSettings: FamilyRecruitmentSettingsRecord | null = null,
    private newsPosts: FamilyNewsPostRecord[] = [],
  ) {}

  async listContentBlocks(scope?: FamilyContentScope): Promise<FamilyContentBlockRecord[]> {
    return this.contentBlocks
      .filter((block) => !scope || block.scope === scope)
      .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
  }

  async findContentBlockById(id: string): Promise<FamilyContentBlockRecord | null> {
    return this.contentBlocks.find((block) => block.id === id) ?? null;
  }

  async updateContentBlock(id: string, input: FamilyContentBlockInput, actorFamilyMemberId: string, now: string): Promise<FamilyContentBlockRecord | null> {
    const current = await this.findContentBlockById(id);
    if (!current || current.version !== input.expectedVersion) return null;
    const updated: FamilyContentBlockRecord = {
      ...current,
      title: input.title,
      body: input.body,
      contact: input.contact ?? null,
      version: current.version + 1,
      updatedByFamilyMemberId: actorFamilyMemberId,
      updatedAt: now,
    };
    this.contentBlocks = this.contentBlocks.map((block) => (block.id === id ? updated : block));
    return updated;
  }

  async getRecruitmentSettings(): Promise<FamilyRecruitmentSettingsRecord | null> {
    return this.recruitmentSettings;
  }

  async updateRecruitmentSettings(input: FamilyRecruitmentSettingsInput, actorFamilyMemberId: string, now: string): Promise<FamilyRecruitmentSettingsRecord | null> {
    if (!this.recruitmentSettings || this.recruitmentSettings.version !== input.expectedVersion) return null;
    this.recruitmentSettings = {
      ...this.recruitmentSettings,
      isOpen: input.isOpen,
      description: input.description,
      requirements: input.requirements,
      contact: input.contact,
      version: this.recruitmentSettings.version + 1,
      updatedByFamilyMemberId: actorFamilyMemberId,
      updatedAt: now,
    };
    return this.recruitmentSettings;
  }

  async listNewsPosts(query: { includeArchived?: boolean }): Promise<FamilyNewsPostRecord[]> {
    return this.newsPosts
      .filter((post) => query.includeArchived || !post.archivedAt)
      .sort((left, right) => Number(right.pinned) - Number(left.pinned) || right.createdAt.localeCompare(left.createdAt));
  }

  async createNewsPost(input: FamilyNewsPostInput, actorFamilyMemberId: string, authorName: string, now: string): Promise<FamilyNewsPostRecord> {
    const created: FamilyNewsPostRecord = {
      id: `post-${this.newsPosts.length + 1}`,
      type: input.type,
      title: input.title,
      body: input.body,
      authorFamilyMemberId: actorFamilyMemberId,
      authorName,
      pinned: input.pinned ?? false,
      urgent: input.urgent ?? input.type === 'urgent',
      notificationRequired: input.notificationRequired ?? input.type === 'urgent',
      archivedAt: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.newsPosts = [created, ...this.newsPosts];
    return created;
  }

  async updateNewsPost(id: string, input: Partial<FamilyNewsPostInput>, _actorFamilyMemberId: string, now: string): Promise<FamilyNewsPostRecord | null> {
    const current = this.newsPosts.find((post) => post.id === id);
    if (!current || current.version !== input.expectedVersion) return null;
    const updated: FamilyNewsPostRecord = {
      ...current,
      type: input.type ?? current.type,
      title: input.title ?? current.title,
      body: input.body ?? current.body,
      pinned: input.pinned ?? current.pinned,
      urgent: input.urgent ?? current.urgent,
      notificationRequired: input.notificationRequired ?? current.notificationRequired,
      version: current.version + 1,
      updatedAt: now,
    };
    this.newsPosts = this.newsPosts.map((post) => (post.id === id ? updated : post));
    return updated;
  }

  async archiveNewsPost(id: string, expectedVersion: number, _actorFamilyMemberId: string, now: string): Promise<FamilyNewsPostRecord | null> {
    const current = this.newsPosts.find((post) => post.id === id);
    if (!current || current.version !== expectedVersion) return null;
    const archived = { ...current, archivedAt: now, version: current.version + 1, updatedAt: now };
    this.newsPosts = this.newsPosts.map((post) => (post.id === id ? archived : post));
    return archived;
  }

  async recordAudit(_entry: FamilyContentAuditEntry): Promise<void> {
    // In-memory repository keeps domain tests focused on behavior.
  }
}
