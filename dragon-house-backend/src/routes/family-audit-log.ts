import { Router } from 'express';
import type pg from 'pg';
import { z } from 'zod';
import type { FamilyAuthService } from '../auth/auth-service.js';
import type { AppConfig } from '../config/env.js';
import { requireFamilyAuthContext } from '../middleware/family-auth-context.js';
import type { FamilyAuthContext } from '../types.js';

const querySchema = z.object({
  entityType: z.string().trim().min(1).max(80).optional(),
  action: z.string().trim().min(1).max(120).optional(),
  actorFamilyMemberId: z.string().trim().min(1).max(120).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(5000).default(0),
}).strict();

type AuditRow = {
  id: string;
  actor_family_member_id: string | null;
  actor_type: 'user' | 'system' | 'discord';
  actor_nickname: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  before_data: unknown;
  after_data: unknown;
  metadata: unknown;
  created_at: Date;
};

export function createFamilyAuditLogRouter(config: AppConfig, authService: FamilyAuthService | null, pool: pg.Pool | null): Router {
  const router = Router();
  const requireAuth = requireFamilyAuthContext(config, authService);
  router.use('/family/audit-log', requireAuth);

  router.get('/family/audit-log', async (request, response) => {
    if (!pool || !request.familyAuth) {
      response.status(503).json({ error: 'service_unavailable', message: 'Audit log is unavailable.' });
      return;
    }
    if (!canViewAudit(request.familyAuth)) {
      response.status(403).json({ error: 'permission_denied', message: 'Недостатньо прав для перегляду історії змін.' });
      return;
    }
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      response.status(400).json({ error: 'validation_error', message: 'Audit filters are invalid.' });
      return;
    }

    const where: string[] = [];
    const values: unknown[] = [];
    if (parsed.data.entityType) {
      values.push(parsed.data.entityType);
      where.push(`a.entity_type = $${values.length}`);
    }
    if (parsed.data.action) {
      values.push(parsed.data.action);
      where.push(`a.action = $${values.length}`);
    }
    if (parsed.data.actorFamilyMemberId) {
      values.push(parsed.data.actorFamilyMemberId);
      where.push(`a.actor_family_member_id = $${values.length}`);
    }
    if (parsed.data.from) {
      values.push(parsed.data.from);
      where.push(`a.created_at >= $${values.length}`);
    }
    if (parsed.data.to) {
      values.push(parsed.data.to);
      where.push(`a.created_at <= $${values.length}`);
    }
    values.push(parsed.data.limit + 1, parsed.data.offset);
    const result = await pool.query<AuditRow>(
      `select a.id, a.actor_family_member_id, a.actor_type, m.nickname as actor_nickname,
              a.action, a.entity_type, a.entity_id, a.before_data, a.after_data, a.metadata, a.created_at
         from family_audit_log a
         left join family_members m on m.id = a.actor_family_member_id
        ${where.length ? `where ${where.join(' and ')}` : ''}
        order by a.created_at desc, a.id desc
        limit $${values.length - 1} offset $${values.length}`,
      values,
    );
    const rows = result.rows.slice(0, parsed.data.limit);
    response.json({
      items: rows.map(mapAuditRow),
      page: {
        limit: parsed.data.limit,
        offset: parsed.data.offset,
        nextOffset: result.rows.length > parsed.data.limit ? parsed.data.offset + parsed.data.limit : null,
      },
    });
  });

  return router;
}

function canViewAudit(auth: FamilyAuthContext): boolean {
  return auth.role === 'owner' ||
    auth.permissions.includes('manage_members') ||
    auth.permissions.includes('manage_member_roles') ||
    auth.permissions.includes('manage_family_quests') ||
    auth.permissions.includes('manage_events') ||
    auth.permissions.includes('manage_treasury') ||
    auth.permissions.includes('manage_family_economy') ||
    auth.permissions.includes('manage_accounting') ||
    auth.permissions.includes('manage_discord_integration');
}

function mapAuditRow(row: AuditRow) {
  return {
    id: row.id,
    actorFamilyMemberId: row.actor_family_member_id,
    actorType: row.actor_type,
    actorName: row.actor_nickname,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    beforeData: row.before_data,
    afterData: row.after_data,
    metadata: row.metadata,
    createdAt: row.created_at.toISOString(),
  };
}
