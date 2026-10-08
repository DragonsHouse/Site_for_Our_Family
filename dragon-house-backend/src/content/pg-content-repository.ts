import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import type { FamilyContentAuditEntry, FamilyContentRepository } from './content-repository.js';
import type {
  FamilyContentBlockInput,
  FamilyContentBlockRecord,
  FamilyContentScope,
  FamilyNewsPostInput,
  FamilyNewsPostRecord,
  FamilyRecruitmentSettingsInput,
  FamilyRecruitmentSettingsRecord,
} from './content-models.js';

type ContentBlockRow = {
  id: string;
  scope: FamilyContentScope;
  title: string;
  body: string;
  contact: string | null;
  sort_order: number;
  version: number;
  updated_by_family_member_id: string | null;
  created_at: Date;
  updated_at: Date;
};

type RecruitmentRow = {
  id: 'dragon-house';
  is_open: boolean;
  description: string;
  requirements: unknown;
  contact: string;
  version: number;
  updated_by_family_member_id: string | null;
  created_at: Date;
  updated_at: Date;
};

type NewsPostRow = {
  id: string;
  type: FamilyNewsPostRecord['type'];
  title: string;
  body: string;
  author_family_member_id: string | null;
  author_name: string;
  pinned: boolean;
  urgent: boolean;
  notification_required: boolean;
  archived_at: Date | null;
  version: number;
  created_at: Date;
  updated_at: Date;
};

export class PgFamilyContentRepository implements FamilyContentRepository {
  constructor(private readonly pool: pg.Pool) {}

  async listContentBlocks(scope?: FamilyContentScope): Promise<FamilyContentBlockRecord[]> {
    const result = await this.pool.query<ContentBlockRow>(
      `select *
         from family_content_blocks
        where ($1::text is null or scope = $1)
        order by sort_order asc, id asc`,
      [scope ?? null],
    );
    return result.rows.map(mapContentBlock);
  }

  async findContentBlockById(id: string): Promise<FamilyContentBlockRecord | null> {
    const result = await this.pool.query<ContentBlockRow>('select * from family_content_blocks where id = $1', [id]);
    return result.rows[0] ? mapContentBlock(result.rows[0]) : null;
  }

  async updateContentBlock(id: string, input: FamilyContentBlockInput, actorFamilyMemberId: string, now: string): Promise<FamilyContentBlockRecord | null> {
    const result = await this.pool.query<ContentBlockRow>(
      `update family_content_blocks
          set title = $2,
              body = $3,
              contact = $4,
              updated_by_family_member_id = $5,
              updated_at = $6,
              version = version + 1
        where id = $1 and version = $7
        returning *`,
      [id, input.title, input.body, input.contact ?? null, actorFamilyMemberId, now, input.expectedVersion],
    );
    return result.rows[0] ? mapContentBlock(result.rows[0]) : null;
  }

  async getRecruitmentSettings(): Promise<FamilyRecruitmentSettingsRecord | null> {
    const result = await this.pool.query<RecruitmentRow>('select * from family_recruitment_settings where id = $1', ['dragon-house']);
    return result.rows[0] ? mapRecruitment(result.rows[0]) : null;
  }

  async updateRecruitmentSettings(input: FamilyRecruitmentSettingsInput, actorFamilyMemberId: string, now: string): Promise<FamilyRecruitmentSettingsRecord | null> {
    const result = await this.pool.query<RecruitmentRow>(
      `update family_recruitment_settings
          set is_open = $2,
              description = $3,
              requirements = $4::jsonb,
              contact = $5,
              updated_by_family_member_id = $6,
              updated_at = $7,
              version = version + 1
        where id = $1 and version = $8
        returning *`,
      ['dragon-house', input.isOpen, input.description, JSON.stringify(input.requirements), input.contact, actorFamilyMemberId, now, input.expectedVersion],
    );
    return result.rows[0] ? mapRecruitment(result.rows[0]) : null;
  }

  async listNewsPosts(query: { includeArchived?: boolean }): Promise<FamilyNewsPostRecord[]> {
    const result = await this.pool.query<NewsPostRow>(
      `select *
         from family_news_posts
        where ($1::boolean = true or archived_at is null)
        order by pinned desc, created_at desc, id desc`,
      [query.includeArchived === true],
    );
    return result.rows.map(mapNewsPost);
  }

  async createNewsPost(input: FamilyNewsPostInput, actorFamilyMemberId: string, authorName: string, now: string): Promise<FamilyNewsPostRecord> {
    const result = await this.pool.query<NewsPostRow>(
      `insert into family_news_posts (
         type, title, body, author_family_member_id, author_name, pinned, urgent, notification_required, created_at, updated_at
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       returning *`,
      [
        input.type,
        input.title,
        input.body,
        actorFamilyMemberId,
        authorName,
        input.pinned ?? false,
        input.urgent ?? input.type === 'urgent',
        input.notificationRequired ?? input.type === 'urgent',
        now,
      ],
    );
    return mapNewsPost(result.rows[0]!);
  }

  async updateNewsPost(id: string, input: Partial<FamilyNewsPostInput>, _actorFamilyMemberId: string, now: string): Promise<FamilyNewsPostRecord | null> {
    const current = (await this.pool.query<NewsPostRow>('select * from family_news_posts where id = $1', [id])).rows[0];
    if (!current) return null;
    const result = await this.pool.query<NewsPostRow>(
      `update family_news_posts
          set type = $2,
              title = $3,
              body = $4,
              pinned = $5,
              urgent = $6,
              notification_required = $7,
              updated_at = $8,
              version = version + 1
        where id = $1 and version = $9
        returning *`,
      [
        id,
        input.type ?? current.type,
        input.title ?? current.title,
        input.body ?? current.body,
        input.pinned ?? current.pinned,
        input.urgent ?? current.urgent,
        input.notificationRequired ?? current.notification_required,
        now,
        input.expectedVersion,
      ],
    );
    return result.rows[0] ? mapNewsPost(result.rows[0]) : null;
  }

  async archiveNewsPost(id: string, expectedVersion: number, _actorFamilyMemberId: string, now: string): Promise<FamilyNewsPostRecord | null> {
    const result = await this.pool.query<NewsPostRow>(
      `update family_news_posts
          set archived_at = $2,
              updated_at = $2,
              version = version + 1
        where id = $1 and version = $3
        returning *`,
      [id, now, expectedVersion],
    );
    return result.rows[0] ? mapNewsPost(result.rows[0]) : null;
  }

  async recordAudit(entry: FamilyContentAuditEntry): Promise<void> {
    await this.pool.query(
      `insert into family_audit_log
        (id, actor_family_member_id, actor_type, action, entity_type, entity_id, before_data, after_data, metadata)
       values ($1, $2, 'user', $3, $4, $5, $6, $7, $8)`,
      [
        randomUUID(),
        entry.actorFamilyMemberId,
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.beforeData === undefined ? null : JSON.stringify(entry.beforeData),
        entry.afterData === undefined ? null : JSON.stringify(entry.afterData),
        entry.metadata ? JSON.stringify(entry.metadata) : null,
      ],
    );
  }
}

function mapContentBlock(row: ContentBlockRow): FamilyContentBlockRecord {
  return {
    id: row.id,
    scope: row.scope,
    title: row.title,
    body: row.body,
    contact: row.contact,
    sortOrder: row.sort_order,
    version: row.version,
    updatedByFamilyMemberId: row.updated_by_family_member_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapRecruitment(row: RecruitmentRow): FamilyRecruitmentSettingsRecord {
  const requirements = Array.isArray(row.requirements) ? row.requirements.filter((item): item is string => typeof item === 'string') : [];
  return {
    id: row.id,
    isOpen: row.is_open,
    description: row.description,
    requirements,
    contact: row.contact,
    version: row.version,
    updatedByFamilyMemberId: row.updated_by_family_member_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapNewsPost(row: NewsPostRow): FamilyNewsPostRecord {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    authorFamilyMemberId: row.author_family_member_id,
    authorName: row.author_name,
    pinned: row.pinned,
    urgent: row.urgent,
    notificationRequired: row.notification_required,
    archivedAt: row.archived_at?.toISOString() ?? null,
    version: row.version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
