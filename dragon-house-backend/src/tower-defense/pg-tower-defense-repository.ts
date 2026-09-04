import type pg from 'pg';
import type {
  CreateTowerDefenseInput,
  FireGuardRosterRecord,
  TowerDefenseAttendanceRecord,
  TowerDefenseListQuery,
  TowerDefenseRecord,
  TowerDefenseResponseRecord,
  TowerRecord,
  UpdateTowerDefenseInput,
} from './tower-defense-models.js';
import type { TowerDefenseRepository, UpsertDefenseAttendanceInput, UpsertDefenseResponseInput } from './tower-defense-repository.js';

type TowerRow = {
  id: string;
  tower_code: string;
  name: string;
  location_label: string;
  map_metadata: Record<string, unknown>;
  image_asset_id: string | null;
  icon_asset_id: string | null;
  is_active: boolean;
  external_source: string | null;
  external_id: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

type DefenseRow = {
  id: string;
  tower_id: string;
  title: string;
  description: string;
  status: TowerDefenseRecord['status'];
  priority: TowerDefenseRecord['priority'];
  scheduled_at: Date | null;
  starts_at: Date;
  ended_at: Date | null;
  timezone: string;
  phase: string;
  wave: number;
  commander_family_member_id: string;
  commander_display_name: string | null;
  created_by_family_member_id: string;
  minimum_guard_count: number;
  recommended_guard_count: number;
  maximum_guard_count: number;
  result: TowerDefenseRecord['result'];
  score: number | null;
  notes: string | null;
  failure_reason: string | null;
  completed_by_family_member_id: string | null;
  completed_at: Date | null;
  xp: number;
  leaderboard_eligible: boolean;
  statistics_eligible: boolean;
  guild_id: string | null;
  channel_id: string | null;
  message_id: string | null;
  voice_channel_id: string | null;
  synced_at: Date | null;
  external_source: string | null;
  external_id: string | null;
  sync_idempotency_key: string | null;
  event_projection_key: string;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  tower_code: string;
  tower_name: string;
  location_label: string;
  map_metadata: Record<string, unknown>;
  image_asset_id: string | null;
  icon_asset_id: string | null;
  tower_is_active: boolean;
  tower_external_source: string | null;
  tower_external_id: string | null;
  tower_metadata: Record<string, unknown>;
  tower_created_at: Date;
  tower_updated_at: Date;
};

type ResponseRow = {
  id: string;
  defense_id: string;
  family_member_id: string;
  display_name: string | null;
  response: TowerDefenseResponseRecord['response'];
  responded_at: Date;
  note: string | null;
  source: TowerDefenseResponseRecord['source'];
  external_source: string | null;
  external_id: string | null;
  idempotency_key: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

type AttendanceRow = {
  id: string;
  defense_id: string;
  family_member_id: string;
  display_name: string | null;
  status: TowerDefenseAttendanceRecord['status'];
  confirmed_by_family_member_id: string | null;
  confirmed_at: Date | null;
  note: string | null;
  score: number | null;
  damage_blocked: number | null;
  supplies_used: number | null;
  contribution_notes: string | null;
  source: TowerDefenseAttendanceRecord['source'];
  external_source: string | null;
  external_id: string | null;
  idempotency_key: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

type RosterRow = {
  id: string;
  family_member_id: string;
  display_name: string;
  role: FireGuardRosterRecord['role'];
  status: FireGuardRosterRecord['status'];
  note: string | null;
  assigned_by_family_member_id: string | null;
  discord_user_id: string | null;
  discord_username: string | null;
  guild_id: string | null;
  external_source: string | null;
  external_id: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

export class PgTowerDefenseRepository implements TowerDefenseRepository {
  constructor(private readonly pool: pg.Pool) {}

  async listTowers(): Promise<TowerRecord[]> {
    const result = await this.pool.query<TowerRow>('select * from family_towers order by is_active desc, name asc, id asc');
    return result.rows.map(mapTower);
  }

  async findTowerById(id: string): Promise<TowerRecord | null> {
    const result = await this.pool.query<TowerRow>('select * from family_towers where id = $1 limit 1', [id]);
    return result.rows[0] ? mapTower(result.rows[0]) : null;
  }

  async familyMemberExists(id: string): Promise<boolean> {
    const result = await this.pool.query<{ exists: boolean }>(
      "select exists(select 1 from family_members where id = $1 and status = 'active' and deleted_at is null) as exists",
      [id],
    );
    return result.rows[0]?.exists ?? false;
  }

  async listDefenses(query: TowerDefenseListQuery = {}): Promise<TowerDefenseRecord[]> {
    const rows = await this.queryDefenseRows(query);
    return this.hydrate(rows);
  }

  async findDefenseById(id: string): Promise<TowerDefenseRecord | null> {
    const result = await this.pool.query<DefenseRow>(`${DEFENSE_SELECT} where d.id = $1 limit 1`, [id]);
    const hydrated = await this.hydrate(result.rows);
    return hydrated[0] ?? null;
  }

  async createDefense(input: CreateTowerDefenseInput & { createdByFamilyMemberId: string; eventProjectionKey: string; now: string }): Promise<TowerDefenseRecord> {
    const result = await this.pool.query<{ id: string }>(
      `insert into family_tower_defenses
        (tower_id, title, description, status, priority, scheduled_at, starts_at, ended_at, timezone, phase, wave,
         commander_family_member_id, created_by_family_member_id, minimum_guard_count, recommended_guard_count,
         maximum_guard_count, notes, xp, leaderboard_eligible, statistics_eligible, guild_id, channel_id,
         message_id, voice_channel_id, synced_at, external_source, external_id, sync_idempotency_key,
         event_projection_key, metadata, created_at, updated_at)
       values
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$31)
       returning id`,
      [
        input.towerId,
        input.title,
        input.description ?? '',
        input.status ?? 'draft',
        input.priority ?? 'normal',
        input.scheduledAt ?? null,
        input.startsAt,
        input.endedAt ?? null,
        input.timezone ?? 'Europe/Kiev',
        input.phase ?? 'planning',
        input.wave ?? 1,
        input.commanderFamilyMemberId,
        input.createdByFamilyMemberId,
        input.minimumGuardCount,
        input.recommendedGuardCount,
        input.maximumGuardCount,
        input.notes ?? null,
        input.xp ?? 0,
        input.leaderboardEligible ?? true,
        input.statisticsEligible ?? true,
        input.discord?.guildId ?? null,
        input.discord?.channelId ?? null,
        input.discord?.messageId ?? null,
        input.discord?.voiceChannelId ?? null,
        input.discord?.syncedAt ?? null,
        input.externalSource ?? null,
        input.externalId ?? null,
        input.syncIdempotencyKey ?? null,
        input.eventProjectionKey,
        JSON.stringify(input.metadata ?? {}),
        input.now,
      ],
    );
    const created = await this.findDefenseById(result.rows[0]!.id);
    if (!created) throw new Error('created defense was not found');
    return created;
  }

  async updateDefense(id: string, input: UpdateTowerDefenseInput & { now: string }): Promise<TowerDefenseRecord | null> {
    const updates: string[] = [];
    const values: unknown[] = [];
    const add = (column: string, value: unknown) => {
      values.push(value);
      updates.push(`${column} = $${values.length}`);
    };
    if (input.towerId !== undefined) add('tower_id', input.towerId);
    if (input.title !== undefined) add('title', input.title);
    if (input.description !== undefined) add('description', input.description);
    if (input.status !== undefined) add('status', input.status);
    if (input.priority !== undefined) add('priority', input.priority);
    if (input.scheduledAt !== undefined) add('scheduled_at', input.scheduledAt);
    if (input.startsAt !== undefined) add('starts_at', input.startsAt);
    if (input.endedAt !== undefined) add('ended_at', input.endedAt);
    if (input.timezone !== undefined) add('timezone', input.timezone);
    if (input.phase !== undefined) add('phase', input.phase);
    if (input.wave !== undefined) add('wave', input.wave);
    if (input.commanderFamilyMemberId !== undefined) add('commander_family_member_id', input.commanderFamilyMemberId);
    if (input.minimumGuardCount !== undefined) add('minimum_guard_count', input.minimumGuardCount);
    if (input.recommendedGuardCount !== undefined) add('recommended_guard_count', input.recommendedGuardCount);
    if (input.maximumGuardCount !== undefined) add('maximum_guard_count', input.maximumGuardCount);
    if (input.result !== undefined) add('result', input.result);
    if (input.score !== undefined) add('score', input.score);
    if (input.notes !== undefined) add('notes', input.notes);
    if (input.failureReason !== undefined) add('failure_reason', input.failureReason);
    if (input.completedByFamilyMemberId !== undefined) add('completed_by_family_member_id', input.completedByFamilyMemberId);
    if (input.completedAt !== undefined) add('completed_at', input.completedAt);
    if (input.xp !== undefined) add('xp', input.xp);
    if (input.leaderboardEligible !== undefined) add('leaderboard_eligible', input.leaderboardEligible);
    if (input.statisticsEligible !== undefined) add('statistics_eligible', input.statisticsEligible);
    if (input.discord?.guildId !== undefined) add('guild_id', input.discord.guildId);
    if (input.discord?.channelId !== undefined) add('channel_id', input.discord.channelId);
    if (input.discord?.messageId !== undefined) add('message_id', input.discord.messageId);
    if (input.discord?.voiceChannelId !== undefined) add('voice_channel_id', input.discord.voiceChannelId);
    if (input.discord?.syncedAt !== undefined) add('synced_at', input.discord.syncedAt);
    if (input.externalSource !== undefined) add('external_source', input.externalSource);
    if (input.externalId !== undefined) add('external_id', input.externalId);
    if (input.metadata !== undefined) add('metadata', JSON.stringify(input.metadata));
    add('updated_at', input.now);
    values.push(id);
    const result = await this.pool.query<{ id: string }>(
      `update family_tower_defenses set ${updates.join(', ')} where id = $${values.length} returning id`,
      values,
    );
    return result.rows[0] ? this.findDefenseById(result.rows[0].id) : null;
  }

  async upsertResponse(input: UpsertDefenseResponseInput): Promise<TowerDefenseResponseRecord> {
    const result = await this.pool.query<ResponseRow>(
      `insert into family_tower_defense_responses
        (defense_id, family_member_id, response, responded_at, note, source, external_source, external_id, idempotency_key, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$4)
       on conflict (defense_id, family_member_id)
       do update set response = excluded.response, responded_at = excluded.responded_at, note = excluded.note,
         source = excluded.source, external_source = excluded.external_source, external_id = excluded.external_id,
         idempotency_key = excluded.idempotency_key, updated_at = excluded.updated_at
       returning *, null::text as display_name`,
      [
        input.defenseId,
        input.familyMemberId,
        input.response,
        input.now,
        input.note ?? null,
        input.source ?? 'api',
        input.externalSource ?? null,
        input.externalId ?? null,
        input.idempotencyKey ?? null,
      ],
    );
    return mapResponse(result.rows[0]!);
  }

  async removeResponse(defenseId: string, familyMemberId: string, now: string): Promise<TowerDefenseResponseRecord> {
    return this.upsertResponse({ defenseId, familyMemberId, response: 'no-response', source: 'api', now });
  }

  async upsertAttendance(input: UpsertDefenseAttendanceInput): Promise<TowerDefenseAttendanceRecord> {
    const result = await this.pool.query<AttendanceRow>(
      `insert into family_tower_defense_attendance
        (defense_id, family_member_id, status, confirmed_by_family_member_id, confirmed_at, note, score,
         damage_blocked, supplies_used, contribution_notes, source, external_source, external_id, idempotency_key, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$5)
       on conflict (defense_id, family_member_id)
       do update set status = excluded.status, confirmed_by_family_member_id = excluded.confirmed_by_family_member_id,
         confirmed_at = excluded.confirmed_at, note = excluded.note, score = excluded.score,
         damage_blocked = excluded.damage_blocked, supplies_used = excluded.supplies_used,
         contribution_notes = excluded.contribution_notes, source = excluded.source,
         external_source = excluded.external_source, external_id = excluded.external_id,
         idempotency_key = excluded.idempotency_key, updated_at = excluded.updated_at
       returning *, null::text as display_name`,
      [
        input.defenseId,
        input.familyMemberId,
        input.status,
        input.confirmedByFamilyMemberId,
        input.now,
        input.note ?? null,
        input.score ?? null,
        input.damageBlocked ?? null,
        input.suppliesUsed ?? null,
        input.contributionNotes ?? null,
        input.source ?? 'api',
        input.externalSource ?? null,
        input.externalId ?? null,
        input.idempotencyKey ?? null,
      ],
    );
    return mapAttendance(result.rows[0]!);
  }

  async listFireGuardRoster(): Promise<FireGuardRosterRecord[]> {
    const result = await this.pool.query<RosterRow>(
      `select r.*, m.nickname as display_name, d.discord_user_id, d.discord_username, d.guild_id
       from family_fire_guard_roster r
       join family_members m on m.id = r.family_member_id
       left join discord_account_links d on d.family_member_id = r.family_member_id
       where m.status = 'active' and m.deleted_at is null
       order by r.status asc, r.role asc, m.nickname asc`,
    );
    return result.rows.map(mapRoster);
  }

  private async queryDefenseRows(query: TowerDefenseListQuery): Promise<DefenseRow[]> {
    const values: unknown[] = [];
    const where: string[] = [];
    if (query.status && query.status !== 'all') {
      values.push(query.status);
      where.push(`d.status = $${values.length}`);
    }
    if (query.result && query.result !== 'all') {
      values.push(query.result);
      where.push(`d.result = $${values.length}`);
    }
    if (query.priority && query.priority !== 'all') {
      values.push(query.priority);
      where.push(`d.priority = $${values.length}`);
    }
    if (query.tower) {
      values.push(query.tower);
      where.push(`(d.tower_id::text = $${values.length} or t.tower_code = $${values.length})`);
    }
    if (query.commander) {
      values.push(query.commander);
      where.push(`d.commander_family_member_id = $${values.length}`);
    }
    if (query.participant) {
      values.push(query.participant);
      where.push(`exists(select 1 from family_tower_defense_responses r where r.defense_id = d.id and r.family_member_id = $${values.length})`);
    }
    if (query.search?.trim()) {
      values.push(`%${query.search.trim()}%`);
      where.push(`(d.title ilike $${values.length} or d.description ilike $${values.length} or t.name ilike $${values.length} or t.tower_code ilike $${values.length})`);
    }
    const whereSql = where.length ? `where ${where.join(' and ')}` : '';
    const result = await this.pool.query<DefenseRow>(
      `${DEFENSE_SELECT} ${whereSql} order by d.starts_at desc, d.id asc`,
      values,
    );
    return result.rows;
  }

  private async hydrate(rows: DefenseRow[]): Promise<TowerDefenseRecord[]> {
    if (!rows.length) return [];
    const ids = rows.map((row) => row.id);
    const [responses, attendance] = await Promise.all([
      this.pool.query<ResponseRow>(
        `select r.*, m.nickname as display_name
         from family_tower_defense_responses r
         join family_members m on m.id = r.family_member_id
         where r.defense_id = any($1)
         order by r.responded_at asc, r.id asc`,
        [ids],
      ),
      this.pool.query<AttendanceRow>(
        `select a.*, m.nickname as display_name
         from family_tower_defense_attendance a
         join family_members m on m.id = a.family_member_id
         where a.defense_id = any($1)
         order by a.confirmed_at asc nulls last, a.id asc`,
        [ids],
      ),
    ]);
    const responsesByDefense = groupBy(responses.rows.map(mapResponse), (item) => item.defenseId);
    const attendanceByDefense = groupBy(attendance.rows.map(mapAttendance), (item) => item.defenseId);
    return rows.map((row) => ({
      ...mapDefense(row),
      responses: responsesByDefense.get(row.id) ?? [],
      attendance: attendanceByDefense.get(row.id) ?? [],
    }));
  }
}

const DEFENSE_SELECT = `
  select d.*, t.tower_code, t.name as tower_name, t.location_label, t.map_metadata, t.image_asset_id,
    t.icon_asset_id, t.is_active as tower_is_active, t.external_source as tower_external_source,
    t.external_id as tower_external_id, t.metadata as tower_metadata, t.created_at as tower_created_at,
    t.updated_at as tower_updated_at, commander.nickname as commander_display_name
  from family_tower_defenses d
  join family_towers t on t.id = d.tower_id
  left join family_members commander on commander.id = d.commander_family_member_id
`;

function mapTower(row: TowerRow): TowerRecord {
  return {
    id: row.id,
    towerCode: row.tower_code,
    name: row.name,
    locationLabel: row.location_label,
    mapMetadata: row.map_metadata ?? {},
    imageAssetId: row.image_asset_id,
    iconAssetId: row.icon_asset_id,
    isActive: row.is_active,
    externalSource: row.external_source,
    externalId: row.external_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapDefense(row: DefenseRow): Omit<TowerDefenseRecord, 'responses' | 'attendance'> {
  return {
    id: row.id,
    tower: {
      id: row.tower_id,
      towerCode: row.tower_code,
      name: row.tower_name,
      locationLabel: row.location_label,
      mapMetadata: row.map_metadata ?? {},
      imageAssetId: row.image_asset_id,
      iconAssetId: row.icon_asset_id,
      isActive: row.tower_is_active,
      externalSource: row.tower_external_source,
      externalId: row.tower_external_id,
      metadata: row.tower_metadata ?? {},
      createdAt: row.tower_created_at.toISOString(),
      updatedAt: row.tower_updated_at.toISOString(),
    },
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    scheduledAt: iso(row.scheduled_at),
    startsAt: row.starts_at.toISOString(),
    endedAt: iso(row.ended_at),
    timezone: row.timezone,
    phase: row.phase,
    wave: row.wave,
    commanderFamilyMemberId: row.commander_family_member_id,
    commanderDisplayName: row.commander_display_name,
    createdByFamilyMemberId: row.created_by_family_member_id,
    minimumGuardCount: row.minimum_guard_count,
    recommendedGuardCount: row.recommended_guard_count,
    maximumGuardCount: row.maximum_guard_count,
    result: row.result,
    score: row.score,
    notes: row.notes,
    failureReason: row.failure_reason,
    completedByFamilyMemberId: row.completed_by_family_member_id,
    completedAt: iso(row.completed_at),
    xp: row.xp,
    leaderboardEligible: row.leaderboard_eligible,
    statisticsEligible: row.statistics_eligible,
    discord: {
      guildId: row.guild_id,
      channelId: row.channel_id,
      messageId: row.message_id,
      voiceChannelId: row.voice_channel_id,
      syncedAt: iso(row.synced_at),
    },
    externalSource: row.external_source,
    externalId: row.external_id,
    syncIdempotencyKey: row.sync_idempotency_key,
    eventProjectionKey: row.event_projection_key,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapResponse(row: ResponseRow): TowerDefenseResponseRecord {
  return {
    id: row.id,
    defenseId: row.defense_id,
    familyMemberId: row.family_member_id,
    displayName: row.display_name ?? row.family_member_id,
    response: row.response,
    respondedAt: row.responded_at.toISOString(),
    note: row.note,
    source: row.source,
    externalSource: row.external_source,
    externalId: row.external_id,
    idempotencyKey: row.idempotency_key,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapAttendance(row: AttendanceRow): TowerDefenseAttendanceRecord {
  return {
    id: row.id,
    defenseId: row.defense_id,
    familyMemberId: row.family_member_id,
    displayName: row.display_name ?? row.family_member_id,
    status: row.status,
    confirmedByFamilyMemberId: row.confirmed_by_family_member_id,
    confirmedAt: iso(row.confirmed_at),
    note: row.note,
    score: row.score,
    damageBlocked: row.damage_blocked,
    suppliesUsed: row.supplies_used,
    contributionNotes: row.contribution_notes,
    source: row.source,
    externalSource: row.external_source,
    externalId: row.external_id,
    idempotencyKey: row.idempotency_key,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapRoster(row: RosterRow): FireGuardRosterRecord {
  return {
    id: row.id,
    familyMemberId: row.family_member_id,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    note: row.note,
    assignedByFamilyMemberId: row.assigned_by_family_member_id,
    discordUserId: row.discord_user_id,
    discordUsername: row.discord_username,
    guildId: row.guild_id,
    externalSource: row.external_source,
    externalId: row.external_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const result = new Map<string, T[]>();
  for (const item of items) result.set(key(item), [...(result.get(key(item)) ?? []), item]);
  return result;
}

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}
