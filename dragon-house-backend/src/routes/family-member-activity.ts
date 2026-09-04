import { Router } from 'express';
import { z } from 'zod';
import type { FamilyAuthService } from '../auth/auth-service.js';
import type { AppConfig } from '../config/env.js';
import { requireFamilyAuthContext } from '../middleware/family-auth-context.js';
import { MemberActivityError, MEMBER_ACTIVITY_ERROR_MESSAGES } from '../member-activity/member-activity-errors.js';
import {
  MEMBER_ACTIVITY_SOURCE_MODULES,
  MEMBER_ACTIVITY_TYPES,
  type MemberActivityService,
} from '../member-activity/member-activity-service.js';
import type { MemberActivityQuery } from '../member-activity/member-activity-models.js';

const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().trim().min(1).max(500).optional(),
  sourceModule: z.enum(MEMBER_ACTIVITY_SOURCE_MODULES).optional(),
  type: z.enum(MEMBER_ACTIVITY_TYPES).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export function createFamilyMemberActivityRouter(
  config: AppConfig,
  authService: FamilyAuthService | null,
  memberActivityService: MemberActivityService | null,
): Router {
  const router = Router();
  const requireAuth = requireFamilyAuthContext(config, authService);
  router.use('/family/members/:memberId/activity', requireAuth);
  router.use('/family/members/:memberId/report', requireAuth);

  router.get('/family/members/:memberId/activity', async (request, response) => {
    if (!request.familyAuth || !memberActivityService) return respondServiceUnavailable(response);
    const parsed = activityQuerySchema.safeParse(request.query);
    if (!parsed.success) return respondValidation(response, parsed.error.message);
    const query: MemberActivityQuery = {
      limit: parsed.data.limit,
      cursor: parsed.data.cursor ?? null,
      sourceModule: parsed.data.sourceModule ?? null,
      type: parsed.data.type ?? null,
      from: parsed.data.from ?? null,
      to: parsed.data.to ?? null,
    };
    try {
      response.json(await memberActivityService.listActivity(String(request.params.memberId), query, request.familyAuth));
    } catch (error) {
      respondMemberActivityError(response, error);
    }
  });

  router.get('/family/members/:memberId/report', async (request, response) => {
    if (!request.familyAuth || !memberActivityService) return respondServiceUnavailable(response);
    try {
      response.json(await memberActivityService.getReport(String(request.params.memberId), request.familyAuth));
    } catch (error) {
      respondMemberActivityError(response, error);
    }
  });

  return router;
}

function respondServiceUnavailable(response: import('express').Response) {
  response.status(503).json({
    code: 'MEMBER_ACTIVITY_SERVICE_UNAVAILABLE',
    message: MEMBER_ACTIVITY_ERROR_MESSAGES.MEMBER_ACTIVITY_SERVICE_UNAVAILABLE,
    details: {},
  });
}

function respondValidation(response: import('express').Response, summary: string) {
  response.status(400).json({
    code: 'VALIDATION_ERROR',
    message: MEMBER_ACTIVITY_ERROR_MESSAGES.VALIDATION_ERROR,
    details: { summary },
  });
}

function respondMemberActivityError(response: import('express').Response, error: unknown) {
  if (error instanceof MemberActivityError) {
    response.status(error.httpStatus).json({
      code: error.code,
      message: MEMBER_ACTIVITY_ERROR_MESSAGES[error.code],
      details: error.details,
    });
    return;
  }
  response.status(500).json({
    code: 'VALIDATION_ERROR',
    message: MEMBER_ACTIVITY_ERROR_MESSAGES.VALIDATION_ERROR,
    details: {},
  });
}
