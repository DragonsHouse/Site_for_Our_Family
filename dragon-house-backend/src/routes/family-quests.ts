import { Router } from 'express';
import { z } from 'zod';
import type { FamilyAuthService } from '../auth/auth-service.js';
import type { AppConfig } from '../config/env.js';
import { requireFamilyAuthContext } from '../middleware/family-auth-context.js';
import { FinanceError, FINANCE_ERROR_MESSAGES } from '../accounting/finance-errors.js';
import type { FamilyQuestPayoutService } from '../accounting/quest-payout-service.js';
import { FamilyQuestError, QUEST_ERROR_MESSAGES } from '../quests/quest-errors.js';
import type { FamilyQuestService } from '../quests/quest-service.js';

const questStatusSchema = z.enum([
  'recruiting',
  'scheduled',
  'active',
  'paused',
  'stopped',
  'completed',
  'reported',
  'sent_to_accounting',
  'paid',
  'cooldown',
  'all',
]);
const questIdSchema = z.string().uuid();
const IssuePayoutSchema = z
  .object({
    confirm: z.literal(true),
    idempotencyKey: z.string().trim().min(12).max(160),
  })
  .strict();

export function createFamilyQuestsRouter(
  config: AppConfig,
  authService: FamilyAuthService | null,
  questService: FamilyQuestService | null,
  payoutService: FamilyQuestPayoutService | null = null,
): Router {
  const router = Router();
  const requireAuth = requireFamilyAuthContext(config, authService);
  router.use(['/family/quest-templates', '/family/quests'], requireAuth);

  router.get('/family/quest-templates', async (request, response) => {
    if (!questService || !request.familyAuth) return respondServiceUnavailable(response);
    try {
      response.json(await questService.listTemplates(request.familyAuth));
    } catch (error) {
      respondQuestError(response, error);
    }
  });

  router.get('/family/quests', async (request, response) => {
    if (!questService || !request.familyAuth) return respondServiceUnavailable(response);
    const status = questStatusSchema.safeParse(request.query.status);
    try {
      response.json(await questService.listQuests({
        status: status.success ? status.data : null,
        activeOnly: request.query.activeOnly === 'true',
      }, request.familyAuth));
    } catch (error) {
      respondQuestError(response, error);
    }
  });

  router.get('/family/quests/:questId', async (request, response) => {
    if (!questService || !request.familyAuth) return respondServiceUnavailable(response);
    const parsed = questIdSchema.safeParse(request.params.questId);
    if (!parsed.success) return respondValidation(response, 'Invalid quest id');
    try {
      response.json(await questService.getQuest(parsed.data, request.familyAuth));
    } catch (error) {
      respondQuestError(response, error);
    }
  });

  router.post('/family/quests/:questId/payouts/:payoutId/issue', async (request, response) => {
    if (!request.familyAuth) return respondServiceUnavailable(response);
    if (!payoutService) return respondFinanceServiceUnavailable(response);
    const questId = questIdSchema.safeParse(request.params.questId);
    const payoutId = questIdSchema.safeParse(request.params.payoutId);
    const body = IssuePayoutSchema.safeParse(request.body);
    if (!questId.success || !payoutId.success || !body.success) {
      return respondValidation(response, 'Issue payout requires valid questId, payoutId, confirm=true, and idempotencyKey.');
    }
    try {
      response.json(
        await payoutService.issueQuestPayout(
          {
            questId: questId.data,
            payoutId: payoutId.data,
            issuedByFamilyMemberId: request.familyAuth.familyMemberId,
            idempotencyKey: body.data.idempotencyKey,
          },
          request.familyAuth,
        ),
      );
    } catch (error) {
      respondFinanceError(response, error);
    }
  });

  return router;
}

function respondServiceUnavailable(response: import('express').Response) {
  response.status(503).json({
    code: 'QUEST_SERVICE_UNAVAILABLE',
    message: QUEST_ERROR_MESSAGES.QUEST_SERVICE_UNAVAILABLE,
    details: {},
  });
}

function respondValidation(response: import('express').Response, summary: string) {
  response.status(400).json({
    code: 'VALIDATION_ERROR',
    message: QUEST_ERROR_MESSAGES.VALIDATION_ERROR,
    details: { summary },
  });
}

function respondFinanceServiceUnavailable(response: import('express').Response) {
  response.status(503).json({
    code: 'FINANCE_SERVICE_UNAVAILABLE',
    message: FINANCE_ERROR_MESSAGES.FINANCE_SERVICE_UNAVAILABLE,
    details: {},
  });
}

function respondQuestError(response: import('express').Response, error: unknown) {
  if (error instanceof FamilyQuestError) {
    response.status(error.httpStatus).json({
      code: error.code,
      message: QUEST_ERROR_MESSAGES[error.code],
      details: error.details,
    });
    return;
  }
  response.status(500).json({
    code: 'VALIDATION_ERROR',
    message: QUEST_ERROR_MESSAGES.VALIDATION_ERROR,
    details: {},
  });
}

function respondFinanceError(response: import('express').Response, error: unknown) {
  if (error instanceof FinanceError) {
    response.status(error.httpStatus).json({
      code: error.code,
      message: FINANCE_ERROR_MESSAGES[error.code],
      details: error.details,
    });
    return;
  }
  response.status(500).json({
    code: 'VALIDATION_ERROR',
    message: FINANCE_ERROR_MESSAGES.VALIDATION_ERROR,
    details: {},
  });
}
