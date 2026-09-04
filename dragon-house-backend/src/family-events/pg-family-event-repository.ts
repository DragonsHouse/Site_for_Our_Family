import type pg from 'pg';
import type {
  CreateFamilyEventInput,
  FamilyEventAttendanceRecord,
  FamilyEventListQuery,
  FamilyEventRecord,
  FamilyEventResponseRecord,
  UpdateFamilyEventInput,
} from './family-event-models.js';
import type { FamilyEventRepository, UpsertEventAttendanceInput, UpsertEventResponseInput } from './family-event-repository.js';

type EventRow = {
  id: string;
  title: string;
  description: string;
  event_type: FamilyEventRecord['eventType'];
  category: FamilyEventRecord['category'];
  status: FamilyEventRecord['status'];
  priority: FamilyEventRecord['priority'];
  starts_at: Date;
  ends_at: Date | null;
  timezone: string;
  all_day: boolean;
  location_label: string | null;
  created_by_family_member_id: string;
  created_by_display_name: string | null;
  organizer_family_member_id: string;
  organizer_display_name: string | null;
  max_participants: number | null;
  visibility: FamilyEventRecord['visibility'];
  notes: string | null;
  completed_by_family_member_id: string | null;
  completed_at: Date | null;
  cancelled_by_family_member_id: string | null;
  cancelled_at: Date | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

type ResponseRow = {
  id: string;
  event_id: string;
  family_member_id: string;
  display_name: string | null;
  response: FamilyEventResponseRecord['response'];
  responded_at: Date;
  note: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

type AttendanceRow = {
  id: string;
  event_id: string;
  family_member_id: string;
  display_name: string | null;
  status: FamilyEventAttendanceRecord['status'];
  confirmed_by_family_member_id: string;
  confirmed_at: Date;
  note: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

export class PgFamilyEventRepository implements FamilyEventRepository {
  constructor(private readonly pool: pg.Pool) {}

  async familyMemberExists(id: string): Promise<boolean> {
    const result = await this.pool.query<{ exists: boolean }>(
      "select exists(select 1 from family_members where id = $1 and status = 'active' and deleted_at is null) as exists",
      [id],
    );
    return result.rows[0]?.exists ?? false;
  }

  async listEvents(query: FamilyEventListQuery = {}): Promise<FamilyEventRecord[]> {
    const rows = await this.queryEventRows(query);
    return this.hydrate(rows);
  }

  async findEventById(id: string): Promise<FamilyEventRecord | null> {
    const result = await this.pool.query<EventRow>(`${EVENT_SELECT} where e.id = $1 limit 1`, [id]);
    const hydrated = await this.hydrate(result.rows);
    return hydrated[0] ?? null;
  }

  async createEvent(input: CreateFamilyEventInput & { createdByFamilyMemberId: string; organizerFamilyMemberId: string; now: string }): Promise<FamilyEventRecord> {
    const result = await this.pool.query<{ id: string }>(
      `insert into family_events
        (title, description, event_type, category, status, priority, starts_at, ends_at, timezone, all_day,
         location_label, created_by_family_member_id, organizer_family_member_id, max_participants, visibility,
         notes, metadata, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$18)
       returning id`,
      [
        input.title,
        input.description ?? '',
        input.eventType,
        input.category ?? 'custom',
        input.status ?? 'draft',
        input.priority ?? 'normal',
        input.startsAt,
        input.endsAt ?? null,
        input.timezone ?? 'Europe/Kiev',
        input.allDay ?? false,
        input.locationLabel ?? null,
        input.createdByFamilyMemberId,
        input.organizerFamilyMemberId,
        input.maxParticipants ?? null,
        input.visibility ?? 'members',
        input.notes ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.now,
      ],
    );
    const created = await this.findEventById(result.rows[0]!.id);
    if (!created) throw new Error('created family event was not found');
    return created;
  }

  async updateEvent(id: string, input: UpdateFamilyEventInput & {
    status?: FamilyEventRecord['status'];
    completedByFamilyMemberId?: string | null;
    completedAt?: string | null;
    cancelledByFamilyMemberId?: string | null;
    cancelledAt?: string | null;
    now: string;
  }): Promise<FamilyEventRecord | null> {
    const updates: string[] = [];
    const values: unknown[] = [];
    const add = (column: string, value: unknown) => {
      values.push(value);
      updates.push(`${column} = $${values.length}`);
    };
    if (input.title !== undefined) add('title', input.title);
    if (input.description !== undefined) add('description', input.description);
    if (input.eventType !== undefined) add('event_type', input.eventType);
    if (input.category !== undefined) add('category', input.category);
    if (input.status !== undefined) add('status', input.status);
    if (input.priority !== undefined) add('priority', input.priority);
    if (input.startsAt !== undefined) add('starts_at', input.startsAt);
    if (input.endsAt !== undefined) add('ends_at', input.endsAt);
    if (input.timezone !== undefined) add('timezone', input.timezone);
    if (input.allDay !== undefined) add('all_day', input.allDay);
    if (input.locationLabel !== undefined) add('location_label', input.locationLabel);
    if (input.organizerFamilyMemberId !== undefined) add('organizer_family_member_id', input.organizerFamilyMemberId);
    if (input.maxParticipants !== undefined) add('max_participants', input.maxParticipants);
    if (input.visibility !== undefined) add('visibility', input.visibility);
    if (input.notes !== undefined) add('notes', input.notes);
    if (input.completedByFamilyMemberId !== undefined) add('completed_by_family_member_id', input.completedByFamilyMemberId);
    if (input.completedAt !== undefined) add('completed_at', input.completedAt);
    if (input.cancelledByFamilyMemberId !== undefined) add('cancelled_by_family_member_id', input.cancelledByFamilyMemberId);
    if (input.cancelledAt !== undefined) add('cancelled_at', input.cancelledAt);
    if (input.metadata !== undefined) add('metadata', JSON.stringify(input.metadata));
    add('updated_at', input.now);
    values.push(id);
    const result = await this.pool.query<{ id: string }>(
      `update family_events set ${updates.join(', ')} where id = $${values.length} returning id`,
      values,
    );
    if (!result.rows[0]) return null;
    return this.findEventById(id);
  }

  async upsertResponse(input: UpsertEventResponseInput): Promise<FamilyEventResponseRecord> {
    const result = await this.pool.query<ResponseRow>(
      `insert into family_event_responses
        (event_id, family_member_id, response, responded_at, note, metadata, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$4,$4)
       on conflict (event_id, family_member_id) do update set
         response = excluded.response,
         responded_at = excluded.responded_at,
         note = excluded.note,
         metadata = excluded.metadata,
         updated_at = excluded.updated_at
       returning *`,
      [input.eventId, input.familyMemberId, input.response, input.now, input.note ?? null, JSON.stringify(input.metadata ?? {})],
    );
    await this.pool.query('update family_events set updated_at = $2 where id = $1', [input.eventId, input.now]);
    return mapResponse(result.rows[0]!);
  }

  async removeResponse(eventId: string, familyMemberId: string, now: string): Promise<FamilyEventResponseRecord> {
    return this.upsertResponse({ eventId, familyMemberId, response: 'declined', now });
  }

  async upsertAttendance(input: UpsertEventAttendanceInput): Promise<FamilyEventAttendanceRecord> {
    const result = await this.pool.query<AttendanceRow>(
      `insert into family_event_attendance
        (event_id, family_member_id, status, confirmed_by_family_member_id, confirmed_at, note, metadata, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$5,$5)
       on conflict (event_id, family_member_id) do update set
         status = excluded.status,
         confirmed_by_family_member_id = excluded.confirmed_by_family_member_id,
         confirmed_at = excluded.confirmed_at,
         note = excluded.note,
         metadata = excluded.metadata,
         updated_at = excluded.updated_at
       returning *`,
      [input.eventId, input.familyMemberId, input.status, input.confirmedByFamilyMemberId, input.now, input.note ?? null, JSON.stringify(input.metadata ?? {})],
    );
    await this.pool.query('update family_events set updated_at = $2 where id = $1', [input.eventId, input.now]);
    return mapAttendance(result.rows[0]!);
  }

  private async queryEventRows(query: FamilyEventListQuery): Promise<EventRow[]> {
    const where: string[] = [];
    const values: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      values.push(value);
      where.push(sql.replace('?', `$${values.length}`));
    };
    if (query.status && query.status !== 'all') add('e.status = ?', query.status);
    if (query.category && query.category !== 'all') add('e.category = ?', query.category);
    if (query.type && query.type !== 'all') add('e.event_type = ?', query.type);
    if (query.from) add('coalesce(e.ends_at, e.starts_at) >= ?', query.from);
    if (query.to) add('e.starts_at <= ?', query.to);
    if (query.organizer) add('e.organizer_family_member_id = ?', query.organizer);
    if (query.participant) add('exists(select 1 from family_event_responses r where r.event_id = e.id and r.family_member_id = ? and r.response <> \'declined\')', query.participant);
    if (query.search) {
      values.push(`%${query.search.trim().toLowerCase()}%`);
      where.push(`(lower(e.title) like $${values.length} or lower(e.description) like $${values.length} or lower(coalesce(e.location_label, '')) like $${values.length})`);
    }
    const whereSql = where.length ? ` where ${where.join(' and ')}` : '';
    const result = await this.pool.query<EventRow>(`${EVENT_SELECT}${whereSql} order by e.starts_at desc, e.id desc`, values);
    return result.rows;
  }

  private async hydrate(rows: EventRow[]): Promise<FamilyEventRecord[]> {
    if (!rows.length) return [];
    const ids = rows.map((row) => row.id);
    const [responses, attendance] = await Promise.all([
      this.pool.query<ResponseRow>(
        `select r.*, m.nickname as display_name
         from family_event_responses r
         left join family_members m on m.id = r.family_member_id
         where r.event_id = any($1::uuid[])
         order by r.responded_at asc, r.id asc`,
        [ids],
      ),
      this.pool.query<AttendanceRow>(
        `select a.*, m.nickname as display_name
         from family_event_attendance a
         left join family_members m on m.id = a.family_member_id
         where a.event_id = any($1::uuid[])
         order by a.confirmed_at asc, a.id asc`,
        [ids],
      ),
    ]);
    return rows.map((row) => ({
      ...mapEvent(row),
      responses: responses.rows.filter((item) => item.event_id === row.id).map(mapResponse),
      attendance: attendance.rows.filter((item) => item.event_id === row.id).map(mapAttendance),
    }));
  }
}

const EVENT_SELECT = `
  select e.*,
    created_by.nickname as created_by_display_name,
    organizer.nickname as organizer_display_name
  from family_events e
  left join family_members created_by on created_by.id = e.created_by_family_member_id
  left join family_members organizer on organizer.id = e.organizer_family_member_id
`;

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function mapEvent(row: EventRow): FamilyEventRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    eventType: row.event_type,
    category: row.category,
    status: row.status,
    priority: row.priority,
    startsAt: iso(row.starts_at)!,
    endsAt: iso(row.ends_at),
    timezone: row.timezone,
    allDay: row.all_day,
    locationLabel: row.location_label,
    createdByFamilyMemberId: row.created_by_family_member_id,
    createdByDisplayName: row.created_by_display_name,
    organizerFamilyMemberId: row.organizer_family_member_id,
    organizerDisplayName: row.organizer_display_name,
    maxParticipants: row.max_participants,
    visibility: row.visibility,
    notes: row.notes,
    completedByFamilyMemberId: row.completed_by_family_member_id,
    completedAt: iso(row.completed_at),
    cancelledByFamilyMemberId: row.cancelled_by_family_member_id,
    cancelledAt: iso(row.cancelled_at),
    metadata: row.metadata ?? {},
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
    responses: [],
    attendance: [],
  };
}

function mapResponse(row: ResponseRow): FamilyEventResponseRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    familyMemberId: row.family_member_id,
    displayName: row.display_name ?? row.family_member_id,
    response: row.response,
    respondedAt: iso(row.responded_at)!,
    note: row.note,
    metadata: row.metadata ?? {},
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  };
}

function mapAttendance(row: AttendanceRow): FamilyEventAttendanceRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    familyMemberId: row.family_member_id,
    displayName: row.display_name ?? row.family_member_id,
    status: row.status,
    confirmedByFamilyMemberId: row.confirmed_by_family_member_id,
    confirmedAt: iso(row.confirmed_at)!,
    note: row.note,
    metadata: row.metadata ?? {},
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  };
}
