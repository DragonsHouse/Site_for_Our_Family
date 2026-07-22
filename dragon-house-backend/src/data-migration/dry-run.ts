import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { loadConfig } from '../config/env.js';
import { createPgPool } from '../db/pool.js';

const BACKUP_FORMAT = 'dragon-house-family-hub-backup';
const SUPPORTED_SCHEMA_VERSION = 1;

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  schemaVersion: z.number().int().positive(),
  exportedAt: z.string(),
  exportedBy: z.object({
    familyMemberId: z.string(),
    nickname: z.string(),
  }),
  data: z.record(z.unknown()),
  indexedDb: z
    .object({
      assets: z.array(z.unknown()).optional(),
      notifications: z.array(z.unknown()).optional(),
    })
    .optional(),
  integrity: z.object({
    algorithm: z.literal('SHA-256'),
    checksum: z.string(),
  }),
});

type Backup = z.infer<typeof backupSchema>;
type Member = { id?: string; nickname?: string; staticId?: string; role?: string; accountStatus?: string; status?: string };
type MemberPlanItem = {
  familyMemberId: string | null;
  nickname: string | null;
  staticId: string | null;
  operation: 'insert' | 'skip' | 'conflict';
  reasons: string[];
};

function parseArgs() {
  const fileIndex = process.argv.indexOf('--file');
  const file = fileIndex >= 0 ? process.argv[fileIndex + 1] : null;
  if (!file) throw new Error('Usage: npm run data:migrate:dry-run -- --file "C:\\path\\backup.json"');
  return { file };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)])
  );
}

function checksumForBackup(backup: Backup) {
  const payload = { ...backup, integrity: undefined };
  delete payload.integrity;
  return createHash('sha256').update(JSON.stringify(canonicalize(payload))).digest('hex');
}

function arrayFromData<T>(backup: Backup, key: string): T[] {
  const value = backup.data[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

function detectDuplicates(values: Array<string | undefined>, label: string) {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) duplicates.push(`${label}:${value}`);
    seen.add(value);
  }
  return duplicates;
}

function collectMemberIds(members: Member[]) {
  return new Set(members.map((member) => member.id).filter((id): id is string => Boolean(id)));
}

function collectReferences(records: unknown[], keys: string[]) {
  const refs: string[] = [];
  const walk = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (keys.includes(key) && typeof item === 'string') refs.push(item);
      walk(item);
    }
  };
  records.forEach(walk);
  return refs;
}

async function existingDbState(memberIds: string[], staticIds: string[], nicknames: string[]) {
  const config = loadConfig();
  const pool = createPgPool(config);
  if (!pool) return { connected: false, existingMembers: 0, existingMemberIds: [], existingStaticIds: [], existingNicknames: [], existingAuthStaticIds: [], conflicts: ['DATABASE_URL is not configured'] };
  try {
    const existingMembers = await pool.query<{ count: string }>('select count(*)::text as count from family_members');
    const conflicts: string[] = [];
    const existingMemberIds: string[] = [];
    const existingStaticIds: string[] = [];
    const existingNicknames: string[] = [];
    const existingAuthStaticIds: string[] = [];
    if (memberIds.length) {
      const result = await pool.query<{ id: string }>('select id from family_members where id = any($1)', [memberIds]);
      existingMemberIds.push(...result.rows.map((row) => row.id));
      conflicts.push(...existingMemberIds.map((id) => `existing_member_id:${id}`));
    }
    if (staticIds.length) {
      const result = await pool.query<{ static_id: string }>('select static_id from family_members where lower(static_id) = any($1)', [
        staticIds.map((item) => item.toLowerCase()),
      ]);
      existingStaticIds.push(...result.rows.map((row) => row.static_id));
      conflicts.push(...existingStaticIds.map((id) => `existing_static_id:${id}`));
      const authResult = await pool.query<{ static_id: string }>('select static_id from family_auth_users where lower(static_id) = any($1)', [
        staticIds.map((item) => item.toLowerCase()),
      ]);
      existingAuthStaticIds.push(...authResult.rows.map((row) => row.static_id));
      conflicts.push(...existingAuthStaticIds.map((id) => `existing_auth_static_id:${id}`));
    }
    if (nicknames.length) {
      const result = await pool.query<{ nickname: string }>('select nickname from family_members where lower(nickname) = any($1)', [
        nicknames.map((item) => item.toLowerCase()),
      ]);
      existingNicknames.push(...result.rows.map((row) => row.nickname));
      conflicts.push(...existingNicknames.map((nickname) => `existing_nickname:${nickname}`));
    }
    return {
      connected: true,
      existingMembers: Number(existingMembers.rows[0]?.count ?? 0),
      existingMemberIds,
      existingStaticIds,
      existingNicknames,
      existingAuthStaticIds,
      conflicts,
    };
  } catch (error) {
    return { connected: false, existingMembers: 0, existingMemberIds: [], existingStaticIds: [], existingNicknames: [], existingAuthStaticIds: [], conflicts: [error instanceof Error ? error.message : 'database_unavailable'] };
  } finally {
    await pool.end();
  }
}

function buildMemberPlan(members: Member[], database: Awaited<ReturnType<typeof existingDbState>>): MemberPlanItem[] {
  const existingIds = new Set(database.existingMemberIds ?? []);
  const existingStaticIds = new Set((database.existingStaticIds ?? []).map((item) => item.toLowerCase()));
  const existingAuthStaticIds = new Set((database.existingAuthStaticIds ?? []).map((item) => item.toLowerCase()));
  const existingNicknames = new Set((database.existingNicknames ?? []).map((item) => item.toLowerCase()));
  return members.map((member) => {
    const reasons: string[] = [];
    if (!member.id) reasons.push('missing_stable_family_member_id');
    if (!member.nickname) reasons.push('missing_nickname');
    if (!member.staticId) reasons.push('missing_static_id');
    if (member.role && !['owner', 'deputy', 'moderator', 'member'].includes(member.role)) reasons.push('invalid_role');
    const status = member.accountStatus ?? member.status;
    if (status && !['active', 'inactive', 'offline', 'online', 'away'].includes(status)) reasons.push('invalid_status');
    if (member.id && existingIds.has(member.id)) reasons.push('existing_member_id');
    if (member.staticId && existingStaticIds.has(member.staticId.toLowerCase())) reasons.push('existing_static_id');
    if (member.staticId && existingAuthStaticIds.has(member.staticId.toLowerCase())) reasons.push('existing_auth_static_id');
    if (member.nickname && existingNicknames.has(member.nickname.toLowerCase())) reasons.push('existing_nickname');
    return {
      familyMemberId: member.id ?? null,
      nickname: member.nickname ?? null,
      staticId: member.staticId ?? null,
      operation: reasons.length ? 'conflict' : 'insert',
      reasons,
    };
  });
}

const { file } = parseArgs();
const raw = await readFile(file, 'utf8');
const backup = backupSchema.parse(JSON.parse(raw) as unknown);
const warnings: string[] = [];
const conflicts: string[] = [];
const unresolvedReferences: string[] = [];

if (backup.schemaVersion > SUPPORTED_SCHEMA_VERSION) conflicts.push('unsupported_future_schema');
if (checksumForBackup(backup) !== backup.integrity.checksum) conflicts.push('checksum_mismatch');

const members = arrayFromData<Member>(backup, 'members');
conflicts.push(...detectDuplicates(members.map((member) => member.id), 'duplicate_member_id'));
conflicts.push(...detectDuplicates(members.map((member) => member.staticId), 'duplicate_static_id'));
conflicts.push(...detectDuplicates(members.map((member) => member.nickname?.toLowerCase()), 'duplicate_login'));

const memberIds = collectMemberIds(members);
const domainRecords = [
  ...arrayFromData<unknown>(backup, 'quests'),
  ...arrayFromData<unknown>(backup, 'accounting'),
  ...arrayFromData<unknown>(backup, 'notifications'),
];
for (const ref of collectReferences(domainRecords, ['userId', 'actorId', 'actor', 'approvedBy', 'paidBy', 'confirmedBy', 'familyMemberId'])) {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ref) && !memberIds.has(ref)) {
    unresolvedReferences.push(ref);
  }
}

const database = await existingDbState(
  members.map((member) => member.id).filter((id): id is string => Boolean(id)),
  members.map((member) => member.staticId).filter((id): id is string => Boolean(id)),
  members.map((member) => member.nickname).filter((id): id is string => Boolean(id)),
);
conflicts.push(...database.conflicts);
const memberPlan = buildMemberPlan(members, database);
for (const item of memberPlan) {
  if (item.operation === 'conflict') conflicts.push(...item.reasons.map((reason) => `member_plan:${item.familyMemberId ?? item.nickname ?? 'unknown'}:${reason}`));
}

const missingSchemas = ['quests', 'accounting ledger', 'notifications', 'assets'];
warnings.push(`Domain schemas not ready for full import: ${missingSchemas.join(', ')}`);

const report = {
  canApply: false,
  backup: {
    schemaVersion: backup.schemaVersion,
    exportedAt: backup.exportedAt,
    exportedBy: backup.exportedBy.familyMemberId,
  },
  database,
  planned: {
    members: members.length,
    authUsers: 0,
    quests: arrayFromData<unknown>(backup, 'quests').length,
    accountingEntries: arrayFromData<unknown>(backup, 'accounting').length,
    notifications: (backup.indexedDb?.notifications ?? arrayFromData<unknown>(backup, 'notifications')).length,
    assets: backup.indexedDb?.assets?.length ?? 0,
  },
  conflicts,
  unresolvedReferences: Array.from(new Set(unresolvedReferences)),
  memberPlan,
  warnings,
};

console.log(JSON.stringify(report, null, 2));
if (conflicts.length || unresolvedReferences.length) process.exitCode = 1;
