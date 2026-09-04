import { Router } from 'express';
import { z } from 'zod';
import type { FamilyAuthService } from '../auth/auth-service.js';
import type { AppConfig } from '../config/env.js';
import { requireFamilyAuthContext } from '../middleware/family-auth-context.js';
import { ACHIEVEMENT_ERROR_MESSAGES, AchievementError } from '../achievements/achievement-errors.js';
import type { AchievementService } from '../achievements/achievement-service.js';
import type { RewardAllocationService } from '../achievements/reward-allocation-service.js';
import { TowerDefenseError, TOWER_DEFENSE_ERROR_MESSAGES } from '../tower-defense/tower-defense-errors.js';
import type { TowerDefenseService } from '../tower-defense/tower-defense-service.js';

const uuidSchema = z.string().uuid();
const statusSchema = z.enum(['draft', 'scheduled', 'gathering', 'active', 'completed', 'cancelled', 'all']);
const resultSchema = z.enum(['pending', 'defended', 'lost', 'cancelled', 'all']);
const prioritySchema = z.enum(['low', 'normal', 'high', 'critical', 'all']);
const responseSchema = z.enum(['no-response', 'available', 'joining', 'confirmed', 'unavailable']);
const attendanceSchema = z.enum(['unconfirmed', 'present', 'late', 'absent', 'excused']);

const createDefenseSchema = z.object({
  towerId: uuidSchema,
  title: z.string().trim().min(1).max(180),
  description: z.string().max(4000).optional(),
  status: statusSchema.exclude(['all']).optional(),
  priority: prioritySchema.exclude(['all']).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  startsAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable().optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  phase: z.string().trim().min(1).max(80).optional(),
  wave: z.number().int().positive().optional(),
  commanderFamilyMemberId: z.string().trim().min(1),
  minimumGuardCount: z.number().int().positive(),
  recommendedGuardCount: z.number().int().positive(),
  maximumGuardCount: z.number().int().positive(),
  xp: z.number().int().min(0).optional(),
  leaderboardEligible: z.boolean().optional(),
  statisticsEligible: z.boolean().optional(),
  notes: z.string().max(4000).nullable().optional(),
  discord: z.object({
    guildId: z.string().trim().min(1).nullable().optional(),
    channelId: z.string().trim().min(1).nullable().optional(),
    messageId: z.string().trim().min(1).nullable().optional(),
    voiceChannelId: z.string().trim().min(1).nullable().optional(),
    syncedAt: z.string().datetime().nullable().optional(),
  }).optional(),
  externalSource: z.string().trim().min(1).nullable().optional(),
  externalId: z.string().trim().min(1).nullable().optional(),
  syncIdempotencyKey: z.string().trim().min(12).max(160).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
}).strict();

const updateDefenseSchema = createDefenseSchema.partial().extend({
  result: resultSchema.exclude(['all']).optional(),
  score: z.number().int().min(0).nullable().optional(),
  failureReason: z.string().max(4000).nullable().optional(),
}).strict();

const respondSchema = z.object({
  familyMemberId: z.string().trim().min(1).optional(),
  response: responseSchema,
  note: z.string().max(1000).nullable().optional(),
  source: z.enum(['manual', 'discord', 'api']).optional(),
  externalSource: z.string().trim().min(1).nullable().optional(),
  externalId: z.string().trim().min(1).nullable().optional(),
  idempotencyKey: z.string().trim().min(12).max(160).nullable().optional(),
}).strict();

const attendanceBodySchema = z.object({
  familyMemberId: z.string().trim().min(1),
  status: attendanceSchema,
  note: z.string().max(1000).nullable().optional(),
  score: z.number().int().min(0).nullable().optional(),
  damageBlocked: z.number().int().min(0).nullable().optional(),
  suppliesUsed: z.number().int().min(0).nullable().optional(),
  contributionNotes: z.string().max(1000).nullable().optional(),
  source: z.enum(['manual', 'discord', 'api']).optional(),
  externalSource: z.string().trim().min(1).nullable().optional(),
  externalId: z.string().trim().min(1).nullable().optional(),
  idempotencyKey: z.string().trim().min(12).max(160).nullable().optional(),
}).strict();

const completeSchema = z.object({
  result: z.enum(['defended', 'lost']),
  score: z.number().int().min(0).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  failureReason: z.string().max(4000).nullable().optional(),
}).strict();

const cancelSchema = z.object({
  reason: z.string().max(4000).nullable().optional(),
}).strict();

const allocationCreateSchema = z.object({
  familyMemberId: z.string().trim().min(1).max(160),
  rewardDefinitionId: uuidSchema,
  quantity: z.number().positive().nullable().optional(),
  reason: z.string().trim().max(1000).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
}).strict();

const allocationUpdateSchema = allocationCreateSchema.partial();

export function createFamilyTowerDefenseRouter(
  config: AppConfig,
  authService: FamilyAuthService | null,
  towerDefenseService: TowerDefenseService | null,
  rewardAllocationService: RewardAllocationService | null = null,
  achievementService: AchievementService | null = null,
): Router {
  const router = Router();
  const requireAuth = requireFamilyAuthContext(config, authService);
  router.use(['/family/towers', '/family/tower-defenses', '/family/fire-guard-roster'], requireAuth);

  router.get('/family/towers', async (request, response) => {
    if (!towerDefenseService || !request.familyAuth) return respondServiceUnavailable(response);
    try {
      response.json(await towerDefenseService.listTowers(request.familyAuth));
    } catch (error) {
      respondTowerDefenseError(response, error);
    }
  });

  router.get('/family/tower-defenses', async (request, response) => {
    if (!towerDefenseService || !request.familyAuth) return respondServiceUnavailable(response);
    const status = statusSchema.safeParse(request.query.status);
    const result = resultSchema.safeParse(request.query.result);
    const priority = prioritySchema.safeParse(request.query.priority);
    try {
      response.json(await towerDefenseService.listDefenses({
        status: status.success ? status.data : null,
        result: result.success ? result.data : null,
        priority: priority.success ? priority.data : null,
        tower: stringQuery(request.query.tower),
        commander: stringQuery(request.query.commander),
        participant: stringQuery(request.query.participant),
        search: stringQuery(request.query.search),
      }, request.familyAuth));
    } catch (error) {
      respondTowerDefenseError(response, error);
    }
  });

  router.get('/family/tower-defenses/:defenseId', async (request, response) => {
    if (!towerDefenseService || !request.familyAuth) return respondServiceUnavailable(response);
    const defenseId = uuidSchema.safeParse(request.params.defenseId);
    if (!defenseId.success) return respondValidation(response, 'Invalid defense id.');
    try {
      response.json(await towerDefenseService.getDefense(defenseId.data, request.familyAuth));
    } catch (error) {
      respondTowerDefenseError(response, error);
    }
  });

  router.get('/family/tower-defenses/:defenseId/reward-allocations', async (request, response) => {
    if (!rewardAllocationService || !request.familyAuth) return respondServiceUnavailable(response);
    const defenseId = uuidSchema.safeParse(request.params.defenseId);
    if (!defenseId.success) return respondValidation(response, 'Invalid defense id.');
    try {
      response.json(await rewardAllocationService.listAllocations('tower_defense', defenseId.data, request.familyAuth));
    } catch (error) {
      respondRewardAllocationError(response, error);
    }
  });

  router.post('/family/tower-defenses/:defenseId/reward-allocations', async (request, response) => {
    if (!rewardAllocationService || !request.familyAuth) return respondServiceUnavailable(response);
    const defenseId = uuidSchema.safeParse(request.params.defenseId);
    const body = allocationCreateSchema.safeParse(request.body);
    if (!defenseId.success || !body.success) return respondValidation(response, 'Invalid reward allocation request.');
    try {
      response.status(201).json(await rewardAllocationService.createAllocation({
        ...body.data,
        sourceModule: 'tower_defense',
        sourceId: defenseId.data,
      }, request.familyAuth));
    } catch (error) {
      respondRewardAllocationError(response, error);
    }
  });

  router.patch('/family/tower-defenses/:defenseId/reward-allocations/:allocationId', async (request, response) => {
    if (!rewardAllocationService || !request.familyAuth) return respondServiceUnavailable(response);
    const defenseId = uuidSchema.safeParse(request.params.defenseId);
    const allocationId = uuidSchema.safeParse(request.params.allocationId);
    const body = allocationUpdateSchema.safeParse(request.body);
    if (!defenseId.success || !allocationId.success || !body.success) return respondValidation(response, 'Invalid reward allocation update request.');
    try {
      response.json(await rewardAllocationService.updateAllocationForSource('tower_defense', defenseId.data, allocationId.data, body.data, request.familyAuth));
    } catch (error) {
      respondRewardAllocationError(response, error);
    }
  });

  router.delete('/family/tower-defenses/:defenseId/reward-allocations/:allocationId', async (request, response) => {
    if (!rewardAllocationService || !request.familyAuth) return respondServiceUnavailable(response);
    const defenseId = uuidSchema.safeParse(request.params.defenseId);
    const allocationId = uuidSchema.safeParse(request.params.allocationId);
    if (!defenseId.success || !allocationId.success) return respondValidation(response, 'Invalid reward allocation delete request.');
    try {
      response.json(await rewardAllocationService.deleteAllocationForSource('tower_defense', defenseId.data, allocationId.data, request.familyAuth));
    } catch (error) {
      respondRewardAllocationError(response, error);
    }
  });

  router.get('/family/fire-guard-roster', async (request, response) => {
    if (!towerDefenseService || !request.familyAuth) return respondServiceUnavailable(response);
    try {
      response.json(await towerDefenseService.listFireGuardRoster(request.familyAuth));
    } catch (error) {
      respondTowerDefenseError(response, error);
    }
  });

  router.post('/family/tower-defenses', async (request, response) => {
    if (!towerDefenseService || !request.familyAuth) return respondServiceUnavailable(response);
    const body = createDefenseSchema.safeParse(request.body);
    if (!body.success) return respondValidation(response, 'Invalid create defense payload.');
    try {
      response.status(201).json(await towerDefenseService.createDefense(body.data, request.familyAuth));
    } catch (error) {
      respondTowerDefenseError(response, error);
    }
  });

  router.patch('/family/tower-defenses/:defenseId', async (request, response) => {
    if (!towerDefenseService || !request.familyAuth) return respondServiceUnavailable(response);
    const defenseId = uuidSchema.safeParse(request.params.defenseId);
    const body = updateDefenseSchema.safeParse(request.body);
    if (!defenseId.success || !body.success) return respondValidation(response, 'Invalid update defense request.');
    try {
      response.json(await towerDefenseService.updateDefense(defenseId.data, body.data, request.familyAuth));
    } catch (error) {
      respondTowerDefenseError(response, error);
    }
  });

  router.post('/family/tower-defenses/:defenseId/responses', async (request, response) => {
    if (!towerDefenseService || !request.familyAuth) return respondServiceUnavailable(response);
    const defenseId = uuidSchema.safeParse(request.params.defenseId);
    const body = respondSchema.safeParse(request.body);
    if (!defenseId.success || !body.success) return respondValidation(response, 'Invalid response request.');
    try {
      response.json(await towerDefenseService.respond(defenseId.data, body.data, request.familyAuth));
    } catch (error) {
      respondTowerDefenseError(response, error);
    }
  });

  router.post('/family/tower-defenses/:defenseId/responses/me/withdraw', async (request, response) => {
    if (!towerDefenseService || !request.familyAuth) return respondServiceUnavailable(response);
    const defenseId = uuidSchema.safeParse(request.params.defenseId);
    if (!defenseId.success) return respondValidation(response, 'Invalid defense id.');
    try {
      response.json(await towerDefenseService.withdrawResponse(defenseId.data, request.familyAuth));
    } catch (error) {
      respondTowerDefenseError(response, error);
    }
  });

  router.post('/family/tower-defenses/:defenseId/attendance', async (request, response) => {
    if (!towerDefenseService || !request.familyAuth) return respondServiceUnavailable(response);
    const defenseId = uuidSchema.safeParse(request.params.defenseId);
    const body = attendanceBodySchema.safeParse(request.body);
    if (!defenseId.success || !body.success) return respondValidation(response, 'Invalid attendance request.');
    try {
      response.json(await towerDefenseService.confirmAttendance(defenseId.data, body.data, request.familyAuth));
    } catch (error) {
      respondTowerDefenseError(response, error);
    }
  });

  router.post('/family/tower-defenses/:defenseId/start', async (request, response) => {
    if (!towerDefenseService || !request.familyAuth) return respondServiceUnavailable(response);
    const defenseId = uuidSchema.safeParse(request.params.defenseId);
    if (!defenseId.success) return respondValidation(response, 'Invalid defense id.');
    try {
      response.json(await towerDefenseService.startDefense(defenseId.data, request.familyAuth));
    } catch (error) {
      respondTowerDefenseError(response, error);
    }
  });

  router.post('/family/tower-defenses/:defenseId/complete', async (request, response) => {
    if (!towerDefenseService || !request.familyAuth) return respondServiceUnavailable(response);
    const defenseId = uuidSchema.safeParse(request.params.defenseId);
    const body = completeSchema.safeParse(request.body);
    if (!defenseId.success || !body.success) return respondValidation(response, 'Invalid complete defense request.');
    try {
      const completed = await towerDefenseService.completeDefense(defenseId.data, body.data, request.familyAuth);
      const rewardReconciliation = achievementService
        ? await achievementService.reconcileTowerDefenseRewards(defenseId.data, request.familyAuth)
        : null;
      response.json({ ...completed, rewardReconciliation });
    } catch (error) {
      if (error instanceof AchievementError) respondRewardAllocationError(response, error);
      else respondTowerDefenseError(response, error);
    }
  });

  router.post('/family/tower-defenses/:defenseId/cancel', async (request, response) => {
    if (!towerDefenseService || !request.familyAuth) return respondServiceUnavailable(response);
    const defenseId = uuidSchema.safeParse(request.params.defenseId);
    const body = cancelSchema.safeParse(request.body);
    if (!defenseId.success || !body.success) return respondValidation(response, 'Invalid cancel defense request.');
    try {
      response.json(await towerDefenseService.cancelDefense(defenseId.data, body.data, request.familyAuth));
    } catch (error) {
      respondTowerDefenseError(response, error);
    }
  });

  return router;
}

function stringQuery(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function respondServiceUnavailable(response: import('express').Response) {
  response.status(503).json({
    code: 'TOWER_DEFENSE_SERVICE_UNAVAILABLE',
    message: TOWER_DEFENSE_ERROR_MESSAGES.TOWER_DEFENSE_SERVICE_UNAVAILABLE,
    details: {},
  });
}

function respondValidation(response: import('express').Response, summary: string) {
  response.status(400).json({
    code: 'VALIDATION_ERROR',
    message: TOWER_DEFENSE_ERROR_MESSAGES.VALIDATION_ERROR,
    details: { summary },
  });
}

function respondTowerDefenseError(response: import('express').Response, error: unknown) {
  if (error instanceof TowerDefenseError) {
    response.status(error.httpStatus).json({
      code: error.code,
      message: TOWER_DEFENSE_ERROR_MESSAGES[error.code],
      details: error.details,
    });
    return;
  }
  response.status(500).json({
    code: 'VALIDATION_ERROR',
    message: TOWER_DEFENSE_ERROR_MESSAGES.VALIDATION_ERROR,
    details: {},
  });
}

function respondRewardAllocationError(response: import('express').Response, error: unknown) {
  if (error instanceof AchievementError) {
    response.status(error.httpStatus).json({
      code: error.code,
      message: ACHIEVEMENT_ERROR_MESSAGES[error.code],
      details: error.details,
    });
    return;
  }
  respondTowerDefenseError(response, error);
}
