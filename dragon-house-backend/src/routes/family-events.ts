import { Router } from 'express';
import { z } from 'zod';
import { ACHIEVEMENT_ERROR_MESSAGES, AchievementError } from '../achievements/achievement-errors.js';
import type { AchievementService } from '../achievements/achievement-service.js';
import type { RewardAllocationService } from '../achievements/reward-allocation-service.js';
import type { FamilyAuthService } from '../auth/auth-service.js';
import type { AppConfig } from '../config/env.js';
import { FamilyEventError, FAMILY_EVENT_ERROR_MESSAGES } from '../family-events/family-event-errors.js';
import type { FamilyEventService } from '../family-events/family-event-service.js';
import { requireFamilyAuthContext } from '../middleware/family-auth-context.js';

const uuidSchema = z.string().uuid();
const typeSchema = z.enum(['family_meeting', 'training', 'rp_event', 'family_activity', 'celebration', 'announcement', 'custom']);
const categorySchema = z.enum(['meeting', 'training', 'rp', 'family', 'celebration', 'announcement', 'custom']);
const statusSchema = z.enum(['draft', 'scheduled', 'active', 'completed', 'cancelled', 'all']);
const prioritySchema = z.enum(['low', 'normal', 'high', 'critical']);
const visibilitySchema = z.enum(['public', 'members', 'leadership', 'private', 'hidden']);
const responseSchema = z.enum(['invited', 'interested', 'joining', 'confirmed', 'declined']);
const attendanceSchema = z.enum(['present', 'late', 'absent', 'excused']);

const createEventSchema = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().max(4000).optional(),
  eventType: typeSchema,
  category: categorySchema.optional(),
  status: statusSchema.exclude(['all', 'completed', 'cancelled']).optional(),
  priority: prioritySchema.optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().nullable().optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  allDay: z.boolean().optional(),
  locationLabel: z.string().max(240).nullable().optional(),
  organizerFamilyMemberId: z.string().trim().min(1).optional(),
  maxParticipants: z.number().int().positive().nullable().optional(),
  visibility: visibilitySchema.optional(),
  notes: z.string().max(4000).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
}).strict();

const updateEventSchema = createEventSchema.partial();

const respondSchema = z.object({
  familyMemberId: z.string().trim().min(1).optional(),
  response: responseSchema,
  note: z.string().max(1000).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
}).strict();

const attendanceBodySchema = z.object({
  familyMemberId: z.string().trim().min(1),
  status: attendanceSchema,
  note: z.string().max(1000).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
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

export function createFamilyEventsRouter(
  config: AppConfig,
  authService: FamilyAuthService | null,
  familyEventService: FamilyEventService | null,
  rewardAllocationService: RewardAllocationService | null = null,
  achievementService: AchievementService | null = null,
): Router {
  const router = Router();
  const requireAuth = requireFamilyAuthContext(config, authService);
  router.use('/family/events', requireAuth);

  router.get('/family/events', async (request, response) => {
    if (!familyEventService || !request.familyAuth) return respondServiceUnavailable(response);
    try {
      response.json(await familyEventService.listEvents({
        status: enumQuery(statusSchema, request.query.status),
        category: enumQuery(categorySchema.or(z.literal('all')), request.query.category),
        type: enumQuery(typeSchema.or(z.literal('all')), request.query.type),
        from: stringQuery(request.query.from),
        to: stringQuery(request.query.to),
        organizer: stringQuery(request.query.organizer),
        participant: stringQuery(request.query.participant),
        search: stringQuery(request.query.search),
      }, request.familyAuth));
    } catch (error) {
      respondFamilyEventError(response, error);
    }
  });

  router.get('/family/events/:eventId', async (request, response) => {
    if (!familyEventService || !request.familyAuth) return respondServiceUnavailable(response);
    const eventId = uuidSchema.safeParse(request.params.eventId);
    if (!eventId.success) return respondValidation(response, 'Invalid event id.');
    try {
      response.json(await familyEventService.getEvent(eventId.data, request.familyAuth));
    } catch (error) {
      respondFamilyEventError(response, error);
    }
  });

  router.get('/family/events/:eventId/reward-allocations', async (request, response) => {
    if (!rewardAllocationService || !request.familyAuth) return respondServiceUnavailable(response);
    const eventId = uuidSchema.safeParse(request.params.eventId);
    if (!eventId.success) return respondValidation(response, 'Invalid event id.');
    try {
      response.json(await rewardAllocationService.listAllocations('events', eventId.data, request.familyAuth));
    } catch (error) {
      respondRewardAllocationError(response, error);
    }
  });

  router.post('/family/events/:eventId/reward-allocations', async (request, response) => {
    if (!rewardAllocationService || !request.familyAuth) return respondServiceUnavailable(response);
    const eventId = uuidSchema.safeParse(request.params.eventId);
    const body = allocationCreateSchema.safeParse(request.body);
    if (!eventId.success || !body.success) return respondValidation(response, 'Invalid reward allocation request.');
    try {
      response.status(201).json(await rewardAllocationService.createAllocation({
        ...body.data,
        sourceModule: 'events',
        sourceId: eventId.data,
      }, request.familyAuth));
    } catch (error) {
      respondRewardAllocationError(response, error);
    }
  });

  router.patch('/family/events/:eventId/reward-allocations/:allocationId', async (request, response) => {
    if (!rewardAllocationService || !request.familyAuth) return respondServiceUnavailable(response);
    const eventId = uuidSchema.safeParse(request.params.eventId);
    const allocationId = uuidSchema.safeParse(request.params.allocationId);
    const body = allocationUpdateSchema.safeParse(request.body);
    if (!eventId.success || !allocationId.success || !body.success) return respondValidation(response, 'Invalid reward allocation update request.');
    try {
      response.json(await rewardAllocationService.updateAllocationForSource('events', eventId.data, allocationId.data, body.data, request.familyAuth));
    } catch (error) {
      respondRewardAllocationError(response, error);
    }
  });

  router.delete('/family/events/:eventId/reward-allocations/:allocationId', async (request, response) => {
    if (!rewardAllocationService || !request.familyAuth) return respondServiceUnavailable(response);
    const eventId = uuidSchema.safeParse(request.params.eventId);
    const allocationId = uuidSchema.safeParse(request.params.allocationId);
    if (!eventId.success || !allocationId.success) return respondValidation(response, 'Invalid reward allocation delete request.');
    try {
      response.json(await rewardAllocationService.deleteAllocationForSource('events', eventId.data, allocationId.data, request.familyAuth));
    } catch (error) {
      respondRewardAllocationError(response, error);
    }
  });

  router.post('/family/events', async (request, response) => {
    if (!familyEventService || !request.familyAuth) return respondServiceUnavailable(response);
    const body = createEventSchema.safeParse(request.body);
    if (!body.success) return respondValidation(response, 'Invalid create event payload.');
    try {
      response.status(201).json(await familyEventService.createEvent(body.data, request.familyAuth));
    } catch (error) {
      respondFamilyEventError(response, error);
    }
  });

  router.patch('/family/events/:eventId', async (request, response) => {
    if (!familyEventService || !request.familyAuth) return respondServiceUnavailable(response);
    const eventId = uuidSchema.safeParse(request.params.eventId);
    const body = updateEventSchema.safeParse(request.body);
    if (!eventId.success || !body.success) return respondValidation(response, 'Invalid update event request.');
    try {
      response.json(await familyEventService.updateEvent(eventId.data, body.data, request.familyAuth));
    } catch (error) {
      respondFamilyEventError(response, error);
    }
  });

  router.post('/family/events/:eventId/respond', async (request, response) => {
    if (!familyEventService || !request.familyAuth) return respondServiceUnavailable(response);
    const eventId = uuidSchema.safeParse(request.params.eventId);
    const body = respondSchema.safeParse(request.body);
    if (!eventId.success || !body.success) return respondValidation(response, 'Invalid response request.');
    try {
      response.json(await familyEventService.respond(eventId.data, body.data, request.familyAuth));
    } catch (error) {
      respondFamilyEventError(response, error);
    }
  });

  router.post('/family/events/:eventId/responses/me/withdraw', async (request, response) => {
    if (!familyEventService || !request.familyAuth) return respondServiceUnavailable(response);
    const eventId = uuidSchema.safeParse(request.params.eventId);
    if (!eventId.success) return respondValidation(response, 'Invalid event id.');
    try {
      response.json(await familyEventService.withdrawResponse(eventId.data, request.familyAuth));
    } catch (error) {
      respondFamilyEventError(response, error);
    }
  });

  router.post('/family/events/:eventId/attendance', async (request, response) => {
    if (!familyEventService || !request.familyAuth) return respondServiceUnavailable(response);
    const eventId = uuidSchema.safeParse(request.params.eventId);
    const body = attendanceBodySchema.safeParse(request.body);
    if (!eventId.success || !body.success) return respondValidation(response, 'Invalid attendance request.');
    try {
      response.json(await familyEventService.confirmAttendance(eventId.data, body.data, request.familyAuth));
    } catch (error) {
      respondFamilyEventError(response, error);
    }
  });

  router.post('/family/events/:eventId/start', async (request, response) => {
    if (!familyEventService || !request.familyAuth) return respondServiceUnavailable(response);
    const eventId = uuidSchema.safeParse(request.params.eventId);
    if (!eventId.success) return respondValidation(response, 'Invalid event id.');
    try {
      response.json(await familyEventService.startEvent(eventId.data, request.familyAuth));
    } catch (error) {
      respondFamilyEventError(response, error);
    }
  });

  router.post('/family/events/:eventId/complete', async (request, response) => {
    if (!familyEventService || !request.familyAuth) return respondServiceUnavailable(response);
    const eventId = uuidSchema.safeParse(request.params.eventId);
    if (!eventId.success) return respondValidation(response, 'Invalid event id.');
    try {
      const completed = await familyEventService.completeEvent(eventId.data, request.familyAuth);
      const rewardReconciliation = achievementService
        ? await achievementService.reconcileFamilyEventRewards(eventId.data, request.familyAuth)
        : null;
      response.json({ ...completed, rewardReconciliation });
    } catch (error) {
      if (error instanceof AchievementError) respondRewardAllocationError(response, error);
      else respondFamilyEventError(response, error);
    }
  });

  router.post('/family/events/:eventId/cancel', async (request, response) => {
    if (!familyEventService || !request.familyAuth) return respondServiceUnavailable(response);
    const eventId = uuidSchema.safeParse(request.params.eventId);
    const body = cancelSchema.safeParse(request.body);
    if (!eventId.success || !body.success) return respondValidation(response, 'Invalid cancel event request.');
    try {
      response.json(await familyEventService.cancelEvent(eventId.data, body.data, request.familyAuth));
    } catch (error) {
      respondFamilyEventError(response, error);
    }
  });

  return router;
}

function stringQuery(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function enumQuery<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> | null {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function respondServiceUnavailable(response: import('express').Response) {
  response.status(503).json({
    code: 'FAMILY_EVENT_SERVICE_UNAVAILABLE',
    message: FAMILY_EVENT_ERROR_MESSAGES.FAMILY_EVENT_SERVICE_UNAVAILABLE,
    details: {},
  });
}

function respondValidation(response: import('express').Response, summary: string) {
  response.status(400).json({
    code: 'VALIDATION_ERROR',
    message: FAMILY_EVENT_ERROR_MESSAGES.VALIDATION_ERROR,
    details: { summary },
  });
}

function respondFamilyEventError(response: import('express').Response, error: unknown) {
  if (error instanceof FamilyEventError) {
    response.status(error.httpStatus).json({
      code: error.code,
      message: FAMILY_EVENT_ERROR_MESSAGES[error.code],
      details: error.details,
    });
    return;
  }
  response.status(500).json({
    code: 'VALIDATION_ERROR',
    message: FAMILY_EVENT_ERROR_MESSAGES.VALIDATION_ERROR,
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
  respondFamilyEventError(response, error);
}
