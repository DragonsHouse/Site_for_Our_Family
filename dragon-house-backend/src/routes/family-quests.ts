import { Router } from 'express';
import { z } from 'zod';
import type { FamilyAuthService } from '../auth/auth-service.js';
import type { AppConfig } from '../config/env.js';
import type { DiscordService } from '../discord/discord-service.js';
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
const templateIdSchema = z.string().uuid();
const rewardModeSchema = z.enum(['equal', 'percentage', 'fixed', 'mixed', 'manual']);
const mutableQuestStatusSchema = z.enum([
  'recruiting',
  'scheduled',
  'active',
  'paused',
  'stopped',
  'completed',
  'reported',
  'cooldown',
]);
const QuestTemplateWriteSchema = z
  .object({
    templateKey: z.string().trim().min(1).max(120).optional(),
    title: z.string().trim().min(1).max(160),
    category: z.string().trim().min(1).max(80),
    description: z.string().trim().max(2000).nullable().optional(),
    steps: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
    recommendedTeamSize: z.number().int().min(1).max(100).optional(),
    totalReward: z.number().min(0).max(1_000_000_000).optional(),
    memberRewardPool: z.number().min(0).max(1_000_000_000).optional(),
    familyReward: z.number().min(0).max(1_000_000_000).optional(),
    rewardMode: rewardModeSchema.optional(),
    requiredItems: z.string().trim().max(1000).nullable().optional(),
    imageAssetId: z.string().trim().max(120).nullable().optional(),
    isActive: z.boolean().optional(),
    cooldownHours: z.number().int().min(1).max(24 * 365).optional(),
  })
  .strict();
const QuestTemplatePatchSchema = QuestTemplateWriteSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required.',
});
const QuestWriteSchema = z
  .object({
    templateId: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(2000).nullable().optional(),
    category: z.string().trim().min(1).max(80),
    status: mutableQuestStatusSchema.optional(),
    startsAt: z.string().datetime().nullable().optional(),
    scheduledAt: z.string().datetime().nullable().optional(),
    totalReward: z.number().min(0).max(1_000_000_000).optional(),
    memberRewardPool: z.number().min(0).max(1_000_000_000).optional(),
    familyReward: z.number().min(0).max(1_000_000_000).optional(),
    rewardMode: rewardModeSchema.optional(),
    requiredItems: z.string().trim().max(1000).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
const QuestPatchSchema = QuestWriteSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required.',
});
const JoinQuestSchema = z
  .object({
    role: z.enum(['participant', 'helper']).default('participant'),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .strict();
const CompleteQuestSchema = z
  .object({
    comment: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();
const ReportQuestSchema = z
  .object({
    comment: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();
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
  discordService: DiscordService | null = null,
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

  router.post('/family/quest-templates', async (request, response) => {
    if (!questService || !request.familyAuth) return respondServiceUnavailable(response);
    const body = QuestTemplateWriteSchema.safeParse(request.body);
    if (!body.success) return respondValidation(response, 'Quest template payload is invalid.');
    try {
      response.status(201).json(await questService.createTemplate(body.data, request.familyAuth));
    } catch (error) {
      respondQuestError(response, error);
    }
  });

  router.patch('/family/quest-templates/:templateId', async (request, response) => {
    if (!questService || !request.familyAuth) return respondServiceUnavailable(response);
    const templateId = templateIdSchema.safeParse(request.params.templateId);
    const body = QuestTemplatePatchSchema.safeParse(request.body);
    if (!templateId.success || !body.success) return respondValidation(response, 'Quest template update payload is invalid.');
    try {
      response.json(await questService.updateTemplate(templateId.data, body.data, request.familyAuth));
    } catch (error) {
      respondQuestError(response, error);
    }
  });

  router.delete('/family/quest-templates/:templateId', async (request, response) => {
    if (!questService || !request.familyAuth) return respondServiceUnavailable(response);
    const templateId = templateIdSchema.safeParse(request.params.templateId);
    if (!templateId.success) return respondValidation(response, 'Invalid quest template id');
    try {
      response.json(await questService.updateTemplate(templateId.data, { isActive: false }, request.familyAuth));
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

  router.post('/family/quests', async (request, response) => {
    if (!questService || !request.familyAuth) return respondServiceUnavailable(response);
    const body = QuestWriteSchema.safeParse(request.body);
    if (!body.success) return respondValidation(response, 'Quest payload is invalid.');
    try {
      response.status(201).json(await questService.createQuest(body.data, request.familyAuth));
    } catch (error) {
      respondQuestError(response, error);
    }
  });

  router.get('/family/quests/discord-feed', async (request, response) => {
    if (!request.familyAuth) return respondServiceUnavailable(response);
    if (!discordService) {
      return response.json({
        status: 'unavailable',
        channelId: config.discord.channels.questAnnouncements,
        lastSyncedAt: new Date().toISOString(),
        items: [],
        error: 'Discord service is unavailable',
      });
    }
    if (!config.discord.channels.questAnnouncements) {
      return response.json({
        status: 'not_configured',
        channelId: null,
        lastSyncedAt: new Date().toISOString(),
        items: [],
        error: 'DISCORD_QUEST_ANNOUNCEMENTS_CHANNEL_ID is not configured',
      });
    }
    try {
      const items = await discordService.fetchQuestMessages(positiveInt(request.query.limit, 200, 1, 500));
      response.json({
        status: 'synced',
        channelId: config.discord.channels.questAnnouncements,
        lastSyncedAt: new Date().toISOString(),
        items,
        error: null,
      });
    } catch (error) {
      response.json({
        status: 'error',
        channelId: config.discord.channels.questAnnouncements,
        lastSyncedAt: new Date().toISOString(),
        items: [],
        error: error instanceof Error ? error.message : 'Discord quest feed is unavailable',
      });
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

  router.patch('/family/quests/:questId', async (request, response) => {
    if (!questService || !request.familyAuth) return respondServiceUnavailable(response);
    const questId = questIdSchema.safeParse(request.params.questId);
    const body = QuestPatchSchema.safeParse(request.body);
    if (!questId.success || !body.success) return respondValidation(response, 'Quest update payload is invalid.');
    try {
      response.json(await questService.updateQuest(questId.data, body.data, request.familyAuth));
    } catch (error) {
      respondQuestError(response, error);
    }
  });

  router.post('/family/quests/:questId/join', async (request, response) => {
    if (!questService || !request.familyAuth) return respondServiceUnavailable(response);
    const questId = questIdSchema.safeParse(request.params.questId);
    const body = JoinQuestSchema.safeParse(request.body);
    if (!questId.success || !body.success) return respondValidation(response, 'Quest join payload is invalid.');
    try {
      response.json(await questService.joinQuest(questId.data, body.data, request.familyAuth));
    } catch (error) {
      respondQuestError(response, error);
    }
  });

  router.post('/family/quests/:questId/withdraw', async (request, response) => {
    if (!questService || !request.familyAuth) return respondServiceUnavailable(response);
    const questId = questIdSchema.safeParse(request.params.questId);
    if (!questId.success) return respondValidation(response, 'Invalid quest id');
    try {
      response.json(await questService.withdrawQuest(questId.data, request.familyAuth));
    } catch (error) {
      respondQuestError(response, error);
    }
  });

  router.post('/family/quests/:questId/complete', async (request, response) => {
    if (!questService || !request.familyAuth) return respondServiceUnavailable(response);
    const questId = questIdSchema.safeParse(request.params.questId);
    const body = CompleteQuestSchema.safeParse(request.body);
    if (!questId.success || !body.success) return respondValidation(response, 'Quest completion payload is invalid.');
    try {
      response.json(await questService.completeQuest(questId.data, body.data, request.familyAuth));
    } catch (error) {
      respondQuestError(response, error);
    }
  });

  router.post('/family/quests/:questId/report', async (request, response) => {
    if (!questService || !request.familyAuth) return respondServiceUnavailable(response);
    const questId = questIdSchema.safeParse(request.params.questId);
    const body = ReportQuestSchema.safeParse(request.body);
    if (!questId.success || !body.success) return respondValidation(response, 'Quest report payload is invalid.');
    try {
      response.json(await questService.createQuestReport(questId.data, body.data, request.familyAuth));
    } catch (error) {
      respondQuestError(response, error);
    }
  });

  router.post('/family/quests/:questId/report/transfer-to-accounting', async (request, response) => {
    if (!questService || !request.familyAuth) return respondServiceUnavailable(response);
    const questId = questIdSchema.safeParse(request.params.questId);
    if (!questId.success) return respondValidation(response, 'Invalid quest id');
    try {
      response.json(await questService.transferQuestReportToAccounting(questId.data, request.familyAuth));
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
      throw new FinanceError(
        'ACCOUNTING_PAYMENT_PROOF_REQUIRED',
        'Quest payouts must be paid through an accounting payout batch with screenshot proof.',
        409,
        { questId: questId.data, payoutId: payoutId.data, canonicalFlow: 'accounting_payout_batch' },
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

function positiveInt(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
}
