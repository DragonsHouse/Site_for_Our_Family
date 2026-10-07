import type pg from 'pg';
import type {
  FamilyQuestAuditRecord,
  FamilyQuestListQuery,
  FamilyQuestPayoutRecord,
  FamilyQuestPersonRecord,
  FamilyQuestRecord,
  FamilyQuestReportRecord,
  FamilyQuestRewardMode,
  FamilyQuestRewardRecord,
  FamilyQuestStatus,
  FamilyQuestTemplateWriteInput,
  FamilyQuestTemplateRecord,
  FamilyQuestWriteInput,
} from './quest-models.js';
import type { FamilyQuestRepository } from './quest-repository.js';
import type { UpsertQuestPersonInput } from './quest-repository.js';

type QuestTemplateRow = {
  id: string;
  template_key: string;
  title: string;
  category: string;
  description: string | null;
  steps: unknown;
  recommended_team_size: number;
  total_reward: string;
  member_reward_pool: string;
  family_reward: string;
  reward_mode: FamilyQuestRewardMode;
  required_items: string | null;
  image_asset_id: string | null;
  is_active: boolean;
  cooldown_hours: number;
  cooldown_until: Date | null;
  metadata: Record<string, unknown>;
  version: number;
  created_at: Date;
  updated_at: Date;
};

type QuestRow = {
  id: string;
  template_id: string | null;
  title: string;
  description: string;
  category: string;
  status: FamilyQuestStatus;
  starts_at: Date | null;
  ends_at: Date | null;
  scheduled_at: Date | null;
  organizer_family_member_id: string | null;
  total_reward: string;
  member_reward_pool: string;
  family_reward: string;
  reward_mode: FamilyQuestRewardMode;
  required_items: string | null;
  best_participant_family_member_id: string | null;
  best_participant_reason: string | null;
  report_id: string | null;
  report_sent_to_accounting_at: Date | null;
  paid_at: Date | null;
  paid_by_family_member_id: string | null;
  metadata: Record<string, unknown>;
  version: number;
  created_at: Date;
  updated_at: Date;
};

type QuestPersonRow = {
  id: string;
  quest_id: string;
  family_member_id: string | null;
  display_name: string;
  role: FamilyQuestPersonRecord['role'];
  joined_at: Date;
  left_at: Date | null;
  joined_late: boolean;
  participation_note: string | null;
  added_manually: boolean;
  added_by_family_member_id: string | null;
  reward_percent: string | null;
  reward_amount: string;
  bonus_amount: string;
  bonus_percent: string;
  is_best_participant: boolean;
  best_participant_reason: string | null;
  payout_status: FamilyQuestPersonRecord['payoutStatus'];
  paid_at: Date | null;
  paid_by_family_member_id: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

type QuestRewardRow = {
  id: string;
  quest_id: string;
  template_id: string | null;
  quest_person_id: string | null;
  reward_type: FamilyQuestRewardRecord['rewardType'];
  title: string;
  amount: string | null;
  currency: string | null;
  quantity: number | null;
  status: FamilyQuestRewardRecord['status'];
  issued_at: Date | null;
  issued_by_family_member_id: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

type QuestReportRow = {
  id: string;
  quest_id: string;
  title: string;
  comment: string | null;
  confirmed_by_family_member_id: string | null;
  total_reward: string;
  member_reward_pool: string;
  family_reward: string;
  transferred_to_accounting_at: Date | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

type QuestPayoutRow = {
  id: string;
  quest_id: string;
  report_id: string | null;
  quest_person_id: string | null;
  family_member_id: string | null;
  display_name: string;
  amount: string;
  reward_percent: string | null;
  reward_items: unknown;
  bonus_amount: string;
  bonus_percent: string;
  status: FamilyQuestPayoutRecord['status'];
  paid_at: Date | null;
  paid_by_family_member_id: string | null;
  idempotency_key: string | null;
  accrual_id: string | null;
  accounting_transaction_id: string | null;
  issued_at: Date | null;
  issued_by_family_member_id: string | null;
  payout_event_key: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

type QuestAuditRow = {
  id: string;
  quest_id: string;
  actor_family_member_id: string | null;
  action: string;
  comment: string | null;
  previous_status: FamilyQuestStatus | null;
  new_status: FamilyQuestStatus | null;
  related_family_member_id: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
};

export class PgFamilyQuestRepository implements FamilyQuestRepository {
  constructor(private readonly pool: pg.Pool) {}

  async listTemplates(): Promise<FamilyQuestTemplateRecord[]> {
    const result = await this.pool.query<QuestTemplateRow>(
      `select *
       from family_quest_templates
       order by is_active desc, title asc, id asc`,
    );
    return result.rows.map(mapTemplate);
  }

  async createTemplate(input: FamilyQuestTemplateWriteInput, actorFamilyMemberId: string, now: string): Promise<FamilyQuestTemplateRecord> {
    const result = await this.pool.query<QuestTemplateRow>(
      `insert into family_quest_templates
        (template_key, title, category, description, steps, recommended_team_size,
         total_reward, member_reward_pool, family_reward, reward_mode, required_items,
         image_asset_id, is_active, cooldown_hours, created_by_family_member_id,
         updated_by_family_member_id, created_at, updated_at)
       values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15, $16, $16)
       returning *`,
      [
        input.templateKey ?? slug(input.title),
        input.title,
        input.category,
        input.description ?? null,
        JSON.stringify(input.steps ?? []),
        input.recommendedTeamSize ?? 1,
        input.totalReward ?? 0,
        input.memberRewardPool ?? 0,
        input.familyReward ?? 0,
        input.rewardMode ?? 'equal',
        input.requiredItems ?? null,
        input.imageAssetId ?? null,
        input.isActive ?? true,
        input.cooldownHours ?? 24,
        actorFamilyMemberId,
        now,
      ],
    );
    return mapTemplate(result.rows[0]);
  }

  async updateTemplate(id: string, input: Partial<FamilyQuestTemplateWriteInput>, actorFamilyMemberId: string, now: string): Promise<FamilyQuestTemplateRecord | null> {
    const current = await this.pool.query<QuestTemplateRow>('select * from family_quest_templates where id = $1 limit 1', [id]);
    if (!current.rows[0]) return null;
    const row = current.rows[0];
    const result = await this.pool.query<QuestTemplateRow>(
      `update family_quest_templates
       set title = $2,
           category = $3,
           description = $4,
           steps = $5::jsonb,
           recommended_team_size = $6,
           total_reward = $7,
           member_reward_pool = $8,
           family_reward = $9,
           reward_mode = $10,
           required_items = $11,
           image_asset_id = $12,
           is_active = $13,
           cooldown_hours = $14,
           updated_by_family_member_id = $15,
           updated_at = $16,
           version = version + 1
       where id = $1 and version = $17
       returning *`,
      [
        id,
        input.title ?? row.title,
        input.category ?? row.category,
        input.description !== undefined ? input.description : row.description,
        JSON.stringify(input.steps ?? stringArray(row.steps)),
        input.recommendedTeamSize ?? row.recommended_team_size,
        input.totalReward ?? Number(row.total_reward),
        input.memberRewardPool ?? Number(row.member_reward_pool),
        input.familyReward ?? Number(row.family_reward),
        input.rewardMode ?? row.reward_mode,
        input.requiredItems !== undefined ? input.requiredItems : row.required_items,
        input.imageAssetId !== undefined ? input.imageAssetId : row.image_asset_id,
        input.isActive ?? row.is_active,
        input.cooldownHours ?? row.cooldown_hours,
        actorFamilyMemberId,
        now,
        input.expectedVersion ?? row.version,
      ],
    );
    return result.rows[0] ? mapTemplate(result.rows[0]) : null;
  }

  async listQuests(query: FamilyQuestListQuery = {}): Promise<FamilyQuestRecord[]> {
    const values: unknown[] = [];
    const where: string[] = [];
    if (query.status && query.status !== 'all') {
      values.push(query.status);
      where.push(`status = $${values.length}`);
    }
    if (query.activeOnly) {
      where.push(`status not in ('paid', 'stopped')`);
    }
    const whereSql = where.length ? `where ${where.join(' and ')}` : '';
    const result = await this.pool.query<QuestRow>(
      `select *
       from family_quests
       ${whereSql}
       order by coalesce(starts_at, scheduled_at, created_at) desc, id asc`,
      values,
    );
    return this.hydrateQuests(result.rows);
  }

  async findQuestById(id: string): Promise<FamilyQuestRecord | null> {
    const result = await this.pool.query<QuestRow>('select * from family_quests where id = $1 limit 1', [id]);
    const quests = await this.hydrateQuests(result.rows);
    return quests[0] ?? null;
  }

  async createQuest(input: FamilyQuestWriteInput, actorFamilyMemberId: string, now: string): Promise<FamilyQuestRecord> {
    const result = await this.pool.query<QuestRow>(
      `insert into family_quests
        (template_id, title, description, category, status, starts_at, scheduled_at,
         organizer_family_member_id, total_reward, member_reward_pool, family_reward,
         reward_mode, required_items, metadata, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $15)
       returning *`,
      [
        input.templateId ?? null,
        input.title,
        input.description ?? '',
        input.category,
        input.status ?? 'recruiting',
        input.startsAt ?? null,
        input.scheduledAt ?? input.startsAt ?? null,
        actorFamilyMemberId,
        input.totalReward ?? 0,
        input.memberRewardPool ?? 0,
        input.familyReward ?? 0,
        input.rewardMode ?? 'equal',
        input.requiredItems ?? null,
        JSON.stringify(input.metadata ?? {}),
        now,
      ],
    );
    const id = result.rows[0].id;
    await this.pool.query(
      `insert into family_quest_audit
        (quest_id, actor_family_member_id, action, previous_status, new_status, metadata, created_at)
       values ($1, $2, 'quest_created', null, $3, '{}'::jsonb, $4)`,
      [id, actorFamilyMemberId, input.status ?? 'recruiting', now],
    );
    const quests = await this.hydrateQuests(result.rows);
    return quests[0];
  }

  async updateQuest(id: string, input: Partial<FamilyQuestWriteInput>, actorFamilyMemberId: string, now: string): Promise<FamilyQuestRecord | null> {
    const current = await this.findQuestById(id);
    if (!current) return null;
    const result = await this.pool.query<QuestRow>(
      `update family_quests
       set template_id = $2,
           title = $3,
           description = $4,
           category = $5,
           status = $6,
           starts_at = $7,
           scheduled_at = $8,
           total_reward = $9,
           member_reward_pool = $10,
           family_reward = $11,
           reward_mode = $12,
           required_items = $13,
           metadata = metadata || $14::jsonb,
           updated_at = $15,
           version = version + 1
       where id = $1 and version = $16
       returning *`,
      [
        id,
        input.templateId !== undefined ? input.templateId : current.templateId,
        input.title ?? current.title,
        input.description !== undefined ? input.description ?? '' : current.description,
        input.category ?? current.category,
        input.status ?? current.status,
        input.startsAt !== undefined ? input.startsAt : current.startsAt,
        input.scheduledAt !== undefined ? input.scheduledAt : current.scheduledAt,
        input.totalReward ?? current.totalReward,
        input.memberRewardPool ?? current.memberRewardPool,
        input.familyReward ?? current.familyReward,
        input.rewardMode ?? current.rewardMode,
        input.requiredItems !== undefined ? input.requiredItems : current.requiredItems,
        JSON.stringify(input.metadata ?? {}),
        now,
        input.expectedVersion ?? current.version,
      ],
    );
    if (!result.rows[0]) return null;
    await this.pool.query(
      `insert into family_quest_audit
        (quest_id, actor_family_member_id, action, previous_status, new_status, metadata, created_at)
       values ($1, $2, 'quest_updated', $3, $4, '{}'::jsonb, $5)`,
      [id, actorFamilyMemberId, current.status, input.status ?? current.status, now],
    );
    const quests = await this.hydrateQuests(result.rows);
    return quests[0] ?? null;
  }

  async familyMemberExists(id: string): Promise<boolean> {
    const result = await this.pool.query<{ exists: boolean }>('select exists(select 1 from family_members where id = $1) as exists', [id]);
    return result.rows[0]?.exists ?? false;
  }

  async upsertQuestPerson(input: UpsertQuestPersonInput): Promise<FamilyQuestPersonRecord> {
    const result = await this.pool.query<QuestPersonRow>(
      `insert into family_quest_people
        (quest_id, family_member_id, display_name, role, joined_at, added_manually, added_by_family_member_id, metadata, created_at, updated_at)
       values ($1, $2, $3, $4, $5, false, $6, $7::jsonb, $5, $5)
       on conflict (quest_id, family_member_id) where family_member_id is not null and left_at is null
       do update set
         role = excluded.role,
         display_name = excluded.display_name,
         added_by_family_member_id = excluded.added_by_family_member_id,
         metadata = family_quest_people.metadata || excluded.metadata,
         updated_at = excluded.updated_at
       returning *`,
      [
        input.questId,
        input.familyMemberId,
        input.displayName,
        input.role,
        input.joinedAt,
        input.addedByFamilyMemberId,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return mapPerson(result.rows[0]);
  }

  async removeQuestPerson(questId: string, familyMemberId: string, leftAt: string): Promise<FamilyQuestPersonRecord> {
    const result = await this.pool.query<QuestPersonRow>(
      `update family_quest_people
       set left_at = $3, updated_at = $3
       where quest_id = $1 and family_member_id = $2 and left_at is null
       returning *`,
      [questId, familyMemberId, leftAt],
    );
    if (!result.rows[0]) {
      const existing = await this.pool.query<QuestPersonRow>(
        `select * from family_quest_people
         where quest_id = $1 and family_member_id = $2
         order by updated_at desc
         limit 1`,
        [questId, familyMemberId],
      );
      if (existing.rows[0]) return mapPerson(existing.rows[0]);
      throw new Error('Quest person not found');
    }
    return mapPerson(result.rows[0]);
  }

  async updateQuestStatus(
    id: string,
    input: { status: FamilyQuestStatus; actorFamilyMemberId: string; now: string; comment?: string | null },
  ): Promise<FamilyQuestRecord | null> {
    const current = await this.findQuestById(id);
    if (!current) return null;
    const result = await this.pool.query<QuestRow>(
      `update family_quests
       set status = $2,
           ends_at = coalesce(ends_at, $3),
           updated_at = $3
       where id = $1
       returning *`,
      [id, input.status, input.now],
    );
    await this.pool.query(
      `insert into family_quest_audit
        (quest_id, actor_family_member_id, action, comment, previous_status, new_status, metadata, created_at)
       values ($1, $2, $3, $4, $5, $6, '{}'::jsonb, $7)`,
      [id, input.actorFamilyMemberId, `quest_${input.status}`, input.comment ?? null, current.status, input.status, input.now],
    );
    const quests = await this.hydrateQuests(result.rows);
    return quests[0] ?? null;
  }

  async createQuestReport(
    id: string,
    input: { actorFamilyMemberId: string; title: string; comment?: string | null; now: string },
  ): Promise<FamilyQuestRecord | null> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const current = await client.query<QuestRow>('select * from family_quests where id = $1 for update', [id]);
      const quest = current.rows[0];
      if (!quest) {
        await client.query('rollback');
        return null;
      }
      const report = await client.query<{ id: string }>(
        `insert into family_quest_reports
          (quest_id, title, comment, confirmed_by_family_member_id, total_reward, member_reward_pool, family_reward, metadata, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, '{}'::jsonb, $8, $8)
         on conflict (quest_id)
         do update set
           title = excluded.title,
           comment = excluded.comment,
           confirmed_by_family_member_id = excluded.confirmed_by_family_member_id,
           total_reward = excluded.total_reward,
           member_reward_pool = excluded.member_reward_pool,
           family_reward = excluded.family_reward,
           updated_at = excluded.updated_at
         returning id`,
        [
          id,
          input.title,
          input.comment ?? null,
          input.actorFamilyMemberId,
          quest.total_reward,
          quest.member_reward_pool,
          quest.family_reward,
          input.now,
        ],
      );
      const updated = await client.query<QuestRow>(
        `update family_quests
         set status = 'reported',
             report_id = $2,
             updated_at = $3
         where id = $1
         returning *`,
        [id, report.rows[0].id, input.now],
      );
      await client.query(
        `insert into family_quest_audit
          (quest_id, actor_family_member_id, action, comment, previous_status, new_status, metadata, created_at)
         values ($1, $2, 'quest_reported', $3, $4, 'reported', '{}'::jsonb, $5)`,
        [id, input.actorFamilyMemberId, input.comment ?? null, quest.status, input.now],
      );
      await client.query('commit');
      const quests = await this.hydrateQuests(updated.rows);
      return quests[0] ?? null;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async transferQuestReportToAccounting(
    id: string,
    input: { actorFamilyMemberId: string; now: string },
  ): Promise<FamilyQuestRecord | null> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const current = await client.query<QuestRow>('select * from family_quests where id = $1 for update', [id]);
      const quest = current.rows[0];
      if (!quest) {
        await client.query('rollback');
        return null;
      }
      const report = await client.query<{ id: string }>(
        `update family_quest_reports
         set transferred_to_accounting_at = coalesce(transferred_to_accounting_at, $2),
             updated_at = $2
         where quest_id = $1
         returning id`,
        [id, input.now],
      );
      const reportId = report.rows[0]?.id;
      if (!reportId) {
        await client.query('rollback');
        return await this.findQuestById(id);
      }
      await client.query(
        `with payable_people as (
           select *,
             count(*) over () as payable_count
           from family_quest_people
           where quest_id = $1
             and role = 'participant'
             and left_at is null
             and family_member_id is not null
         )
         insert into family_quest_payouts
           (quest_id, report_id, quest_person_id, family_member_id, display_name, amount,
            reward_percent, reward_items, bonus_amount, bonus_percent, status, metadata, created_at, updated_at)
         select
           $1,
           $2,
           person.id,
           person.family_member_id,
           person.display_name,
           case
             when person.reward_amount > 0 then person.reward_amount
             when person.payable_count > 0 then round(($3::numeric / person.payable_count)::numeric, 2)
             else 0
           end,
           person.reward_percent,
           '[]'::jsonb,
           person.bonus_amount,
           person.bonus_percent,
           'pending',
           jsonb_build_object('source', 'quest_report_handoff'),
           $4,
           $4
         from payable_people person
         where not exists (
           select 1 from family_quest_payouts payout
           where payout.report_id = $2
             and payout.quest_person_id = person.id
         )`,
        [id, reportId, quest.member_reward_pool, input.now],
      );
      const updated = await client.query<QuestRow>(
        `update family_quests
         set status = 'sent_to_accounting',
             report_id = coalesce(report_id, $2),
             report_sent_to_accounting_at = coalesce(report_sent_to_accounting_at, $3),
             updated_at = $3
         where id = $1
         returning *`,
        [id, reportId, input.now],
      );
      await client.query(
        `insert into family_quest_audit
          (quest_id, actor_family_member_id, action, previous_status, new_status, metadata, created_at)
         values ($1, $2, 'quest_sent_to_accounting', $3, 'sent_to_accounting', '{}'::jsonb, $4)`,
        [id, input.actorFamilyMemberId, quest.status, input.now],
      );
      await client.query('commit');
      const quests = await this.hydrateQuests(updated.rows);
      return quests[0] ?? null;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  private async hydrateQuests(rows: QuestRow[]): Promise<FamilyQuestRecord[]> {
    if (!rows.length) return [];
    const questIds = rows.map((row) => row.id);
    const [people, rewards, reports, payouts, audit] = await Promise.all([
      this.pool.query<QuestPersonRow>(
        `select * from family_quest_people where quest_id = any($1) order by created_at asc, id asc`,
        [questIds],
      ),
      this.pool.query<QuestRewardRow>(
        `select * from family_quest_rewards where quest_id = any($1) order by created_at asc, id asc`,
        [questIds],
      ),
      this.pool.query<QuestReportRow>(
        `select * from family_quest_reports where quest_id = any($1) order by created_at desc, id asc`,
        [questIds],
      ),
      this.pool.query<QuestPayoutRow>(
        `select * from family_quest_payouts where quest_id = any($1) order by created_at asc, id asc`,
        [questIds],
      ),
      this.pool.query<QuestAuditRow>(
        `select * from family_quest_audit where quest_id = any($1) order by created_at desc, id asc`,
        [questIds],
      ),
    ]);
    const peopleByQuest = groupBy(people.rows.map(mapPerson), (item) => item.questId);
    const rewardsByQuest = groupBy(rewards.rows.map(mapReward), (item) => item.questId);
    const reportsByQuest = groupBy(reports.rows.map(mapReport), (item) => item.questId);
    const payoutsByQuest = groupBy(payouts.rows.map(mapPayout), (item) => item.questId);
    const auditByQuest = groupBy(audit.rows.map(mapAudit), (item) => item.questId);
    return rows.map((row) => ({
      ...mapQuestBase(row),
      people: peopleByQuest.get(row.id) ?? [],
      rewards: rewardsByQuest.get(row.id) ?? [],
      report: reportsByQuest.get(row.id)?.[0] ?? null,
      payouts: payoutsByQuest.get(row.id) ?? [],
      auditTrail: auditByQuest.get(row.id) ?? [],
    }));
  }
}

function mapTemplate(row: QuestTemplateRow): FamilyQuestTemplateRecord {
  return {
    id: row.id,
    templateKey: row.template_key,
    title: row.title,
    category: row.category,
    description: row.description,
    steps: stringArray(row.steps),
    recommendedTeamSize: row.recommended_team_size,
    totalReward: money(row.total_reward),
    memberRewardPool: money(row.member_reward_pool),
    familyReward: money(row.family_reward),
    rewardMode: row.reward_mode,
    requiredItems: row.required_items,
    imageAssetId: row.image_asset_id,
    isActive: row.is_active,
    cooldownHours: row.cooldown_hours,
    cooldownUntil: iso(row.cooldown_until),
    metadata: row.metadata ?? {},
    version: row.version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapQuestBase(row: QuestRow): Omit<FamilyQuestRecord, 'people' | 'rewards' | 'report' | 'payouts' | 'auditTrail'> {
  return {
    id: row.id,
    templateId: row.template_id,
    title: row.title,
    description: row.description,
    category: row.category,
    status: row.status,
    startsAt: iso(row.starts_at),
    endsAt: iso(row.ends_at),
    scheduledAt: iso(row.scheduled_at),
    organizerFamilyMemberId: row.organizer_family_member_id,
    totalReward: money(row.total_reward),
    memberRewardPool: money(row.member_reward_pool),
    familyReward: money(row.family_reward),
    rewardMode: row.reward_mode,
    requiredItems: row.required_items,
    bestParticipantFamilyMemberId: row.best_participant_family_member_id,
    bestParticipantReason: row.best_participant_reason,
    reportId: row.report_id,
    reportSentToAccountingAt: iso(row.report_sent_to_accounting_at),
    paidAt: iso(row.paid_at),
    paidByFamilyMemberId: row.paid_by_family_member_id,
    metadata: row.metadata ?? {},
    version: row.version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapPerson(row: QuestPersonRow): FamilyQuestPersonRecord {
  return {
    id: row.id,
    questId: row.quest_id,
    familyMemberId: row.family_member_id,
    displayName: row.display_name,
    role: row.role,
    joinedAt: row.joined_at.toISOString(),
    leftAt: iso(row.left_at),
    joinedLate: row.joined_late,
    participationNote: row.participation_note,
    addedManually: row.added_manually,
    addedByFamilyMemberId: row.added_by_family_member_id,
    rewardPercent: row.reward_percent == null ? null : Number(row.reward_percent),
    rewardAmount: money(row.reward_amount),
    bonusAmount: money(row.bonus_amount),
    bonusPercent: Number(row.bonus_percent),
    isBestParticipant: row.is_best_participant,
    bestParticipantReason: row.best_participant_reason,
    payoutStatus: row.payout_status,
    paidAt: iso(row.paid_at),
    paidByFamilyMemberId: row.paid_by_family_member_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapReward(row: QuestRewardRow): FamilyQuestRewardRecord {
  return {
    id: row.id,
    questId: row.quest_id,
    templateId: row.template_id,
    questPersonId: row.quest_person_id,
    rewardType: row.reward_type,
    title: row.title,
    amount: row.amount == null ? null : Number(row.amount),
    currency: row.currency,
    quantity: row.quantity,
    status: row.status,
    issuedAt: iso(row.issued_at),
    issuedByFamilyMemberId: row.issued_by_family_member_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapReport(row: QuestReportRow): FamilyQuestReportRecord {
  return {
    id: row.id,
    questId: row.quest_id,
    title: row.title,
    comment: row.comment,
    confirmedByFamilyMemberId: row.confirmed_by_family_member_id,
    totalReward: money(row.total_reward),
    memberRewardPool: money(row.member_reward_pool),
    familyReward: money(row.family_reward),
    transferredToAccountingAt: iso(row.transferred_to_accounting_at),
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapPayout(row: QuestPayoutRow): FamilyQuestPayoutRecord {
  return {
    id: row.id,
    questId: row.quest_id,
    reportId: row.report_id,
    questPersonId: row.quest_person_id,
    familyMemberId: row.family_member_id,
    displayName: row.display_name,
    amount: money(row.amount),
    rewardPercent: row.reward_percent == null ? null : Number(row.reward_percent),
    rewardItems: recordArray(row.reward_items),
    bonusAmount: money(row.bonus_amount),
    bonusPercent: Number(row.bonus_percent),
    status: row.status,
    paidAt: iso(row.paid_at),
    paidByFamilyMemberId: row.paid_by_family_member_id,
    idempotencyKey: row.idempotency_key,
    accrualId: row.accrual_id,
    accountingTransactionId: row.accounting_transaction_id,
    issuedAt: iso(row.issued_at),
    issuedByFamilyMemberId: row.issued_by_family_member_id,
    payoutEventKey: row.payout_event_key,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapAudit(row: QuestAuditRow): FamilyQuestAuditRecord {
  return {
    id: row.id,
    questId: row.quest_id,
    actorFamilyMemberId: row.actor_family_member_id,
    action: row.action,
    comment: row.comment,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    relatedFamilyMemberId: row.related_family_member_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString(),
  };
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const result = new Map<string, T[]>();
  for (const item of items) {
    const groupKey = key(item);
    result.set(groupKey, [...(result.get(groupKey) ?? []), item]);
  }
  return result;
}

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function money(value: string | number): number {
  return Number(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function recordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : [];
}

function slug(value: string): string {
  const slugged = value.trim().toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '');
  return slugged || `template-${Date.now()}`;
}
