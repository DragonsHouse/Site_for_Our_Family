import { Router } from 'express';
import { z } from 'zod';
import type { FamilyAuthService } from '../auth/auth-service.js';
import type { AppConfig } from '../config/env.js';
import { requireFamilyAuthContext } from '../middleware/family-auth-context.js';
import { ACHIEVEMENT_ERROR_MESSAGES, AchievementError } from '../achievements/achievement-errors.js';
import type { AchievementService } from '../achievements/achievement-service.js';
import type { LeaderboardCategory, LeaderboardPeriod, RewardGrantStatus, RewardSourceModule, RewardType } from '../achievements/achievement-models.js';

const sourceModuleSchema = z.enum(['quests', 'tower_defense', 'events', 'activity', 'leadership', 'streak', 'special', 'manual']);
const rewardSourceModuleSchema = z.enum(['quests', 'tower_defense', 'events', 'achievements', 'activity', 'manual']);
const rewardStatusSchema = z.enum(['earned', 'approved', 'issued', 'cancelled']);
const rewardTypeSchema = z.enum(['money', 'xp', 'item', 'badge', 'custom']);
const leaderboardPeriodSchema = z.enum(['current_month', 'previous_month', 'all_time']);
const leaderboardCategorySchema = z.enum(['overall', 'tower_defense', 'quests', 'events']);

const awardAchievementSchema = z.object({
  familyMemberId: z.string().trim().min(1).max(160),
  achievementKey: z.string().trim().min(1).max(160),
  sourceModule: sourceModuleSchema,
  sourceId: z.string().trim().min(1).max(240),
  sourceKey: z.string().trim().min(1).max(500),
  awardedAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
}).strict();

const grantRewardSchema = z.object({
  familyMemberId: z.string().trim().min(1).max(160),
  rewardKey: z.string().trim().min(1).max(160),
  sourceModule: rewardSourceModuleSchema,
  sourceId: z.string().trim().min(1).max(240),
  sourceKey: z.string().trim().min(1).max(500),
  status: rewardStatusSchema.optional(),
  grantedAt: z.string().datetime().optional(),
  issuedAt: z.string().datetime().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
}).strict();

export function createFamilyAchievementsRouter(
  config: AppConfig,
  authService: FamilyAuthService | null,
  achievementService: AchievementService | null,
): Router {
  const router = Router();
  const requireAuth = requireFamilyAuthContext(config, authService);
  router.use('/family/achievements', requireAuth);
  router.use('/family/rewards', requireAuth);
  router.use('/family/leaderboard', requireAuth);
  router.use('/family/members/:memberId/achievements', requireAuth);
  router.use('/family/members/:memberId/rewards', requireAuth);

  router.get('/family/achievements', async (request, response) => {
    if (!achievementService || !request.familyAuth) return respondServiceUnavailable(response);
    try {
      response.json(await achievementService.listAchievementDefinitions(request.familyAuth));
    } catch (error) {
      respondAchievementError(response, error);
    }
  });

  router.post('/family/achievements/award', async (request, response) => {
    if (!achievementService || !request.familyAuth) return respondServiceUnavailable(response);
    const parsed = awardAchievementSchema.safeParse(request.body);
    if (!parsed.success) return respondValidation(response, parsed.error.message);
    try {
      response.status(201).json(await achievementService.awardAchievement(parsed.data, request.familyAuth));
    } catch (error) {
      respondAchievementError(response, error);
    }
  });

  router.post('/family/members/:memberId/achievements/evaluate', async (request, response) => {
    if (!achievementService || !request.familyAuth) return respondServiceUnavailable(response);
    try {
      response.json(await achievementService.evaluateMemberAchievements(String(request.params.memberId), request.familyAuth));
    } catch (error) {
      respondAchievementError(response, error);
    }
  });

  router.get('/family/rewards', async (request, response) => {
    if (!achievementService || !request.familyAuth) return respondServiceUnavailable(response);
    try {
      response.json(await achievementService.listRewardDefinitions(request.familyAuth));
    } catch (error) {
      respondAchievementError(response, error);
    }
  });

  router.get('/family/rewards/pending', async (request, response) => {
    if (!achievementService || !request.familyAuth) return respondServiceUnavailable(response);
    const status = rewardStatusSchema.or(z.literal('all')).safeParse(request.query.status);
    const rewardType = rewardTypeSchema.or(z.literal('all')).safeParse(request.query.rewardType);
    const sourceModule = rewardSourceModuleSchema.or(z.literal('all')).safeParse(request.query.sourceModule);
    try {
      response.json(await achievementService.listPendingRewards({
        status: status.success ? status.data as RewardGrantStatus | 'all' : 'earned',
        rewardType: rewardType.success ? rewardType.data as RewardType | 'all' : 'all',
        sourceModule: sourceModule.success ? sourceModule.data as RewardSourceModule | 'all' : 'all',
        memberId: typeof request.query.memberId === 'string' && request.query.memberId.trim() ? request.query.memberId.trim() : null,
        from: typeof request.query.from === 'string' ? request.query.from : null,
        to: typeof request.query.to === 'string' ? request.query.to : null,
        limit: positiveInt(request.query.limit, 50, 1, 100),
      }, request.familyAuth));
    } catch (error) {
      respondAchievementError(response, error);
    }
  });

  router.post('/family/rewards/grant', async (request, response) => {
    if (!achievementService || !request.familyAuth) return respondServiceUnavailable(response);
    const parsed = grantRewardSchema.safeParse(request.body);
    if (!parsed.success) return respondValidation(response, parsed.error.message);
    try {
      response.status(201).json(await achievementService.grantReward(parsed.data, request.familyAuth));
    } catch (error) {
      respondAchievementError(response, error);
    }
  });

  router.patch('/family/rewards/grants/:grantId/status', async (request, response) => {
    if (!achievementService || !request.familyAuth) return respondServiceUnavailable(response);
    const parsed = z.object({ status: rewardStatusSchema }).strict().safeParse(request.body);
    if (!parsed.success) return respondValidation(response, parsed.error.message);
    try {
      response.json(await achievementService.updateRewardStatus(String(request.params.grantId), parsed.data.status as RewardGrantStatus, request.familyAuth));
    } catch (error) {
      respondAchievementError(response, error);
    }
  });

  router.post('/family/rewards/grants/:grantId/approve', async (request, response) => {
    if (!achievementService || !request.familyAuth) return respondServiceUnavailable(response);
    try {
      response.json(await achievementService.approveRewardGrant(String(request.params.grantId), request.familyAuth));
    } catch (error) {
      respondAchievementError(response, error);
    }
  });

  router.post('/family/rewards/grants/:grantId/issue', async (request, response) => {
    if (!achievementService || !request.familyAuth) return respondServiceUnavailable(response);
    try {
      response.json(await achievementService.issueRewardGrant(String(request.params.grantId), request.familyAuth));
    } catch (error) {
      respondAchievementError(response, error);
    }
  });

  router.post('/family/rewards/grants/:grantId/cancel', async (request, response) => {
    if (!achievementService || !request.familyAuth) return respondServiceUnavailable(response);
    try {
      response.json(await achievementService.cancelRewardGrant(String(request.params.grantId), request.familyAuth));
    } catch (error) {
      respondAchievementError(response, error);
    }
  });

  router.post('/family/rewards/reconcile/quests/:questId', async (request, response) => {
    if (!achievementService || !request.familyAuth) return respondServiceUnavailable(response);
    try {
      response.json(await achievementService.reconcileQuestRewards(String(request.params.questId), request.familyAuth));
    } catch (error) {
      respondAchievementError(response, error);
    }
  });

  router.post('/family/rewards/reconcile/tower-defenses/:defenseId', async (request, response) => {
    if (!achievementService || !request.familyAuth) return respondServiceUnavailable(response);
    try {
      response.json(await achievementService.reconcileTowerDefenseRewards(String(request.params.defenseId), request.familyAuth));
    } catch (error) {
      respondAchievementError(response, error);
    }
  });

  router.post('/family/rewards/reconcile/events/:eventId', async (request, response) => {
    if (!achievementService || !request.familyAuth) return respondServiceUnavailable(response);
    try {
      response.json(await achievementService.reconcileFamilyEventRewards(String(request.params.eventId), request.familyAuth));
    } catch (error) {
      respondAchievementError(response, error);
    }
  });

  router.get('/family/members/:memberId/achievements', async (request, response) => {
    if (!achievementService || !request.familyAuth) return respondServiceUnavailable(response);
    try {
      response.json(await achievementService.listMemberAchievements(String(request.params.memberId), request.familyAuth));
    } catch (error) {
      respondAchievementError(response, error);
    }
  });

  router.get('/family/members/:memberId/rewards', async (request, response) => {
    if (!achievementService || !request.familyAuth) return respondServiceUnavailable(response);
    try {
      response.json(await achievementService.listMemberRewards(String(request.params.memberId), request.familyAuth));
    } catch (error) {
      respondAchievementError(response, error);
    }
  });

  router.get('/family/leaderboard', async (request, response) => {
    if (!achievementService || !request.familyAuth) return respondServiceUnavailable(response);
    const period = leaderboardPeriodSchema.safeParse(request.query.period).success ? request.query.period as LeaderboardPeriod : 'current_month';
    const category = leaderboardCategorySchema.safeParse(request.query.category).success ? request.query.category as LeaderboardCategory : 'overall';
    try {
      response.json(await achievementService.getLeaderboard(period, category, request.familyAuth));
    } catch (error) {
      respondAchievementError(response, error);
    }
  });

  return router;
}

function respondServiceUnavailable(response: import('express').Response) {
  response.status(503).json({
    code: 'ACHIEVEMENT_SERVICE_UNAVAILABLE',
    message: ACHIEVEMENT_ERROR_MESSAGES.ACHIEVEMENT_SERVICE_UNAVAILABLE,
    details: {},
  });
}

function respondValidation(response: import('express').Response, summary: string) {
  response.status(400).json({
    code: 'VALIDATION_ERROR',
    message: ACHIEVEMENT_ERROR_MESSAGES.VALIDATION_ERROR,
    details: { summary },
  });
}

function respondAchievementError(response: import('express').Response, error: unknown) {
  if (error instanceof AchievementError) {
    response.status(error.httpStatus).json({
      code: error.code,
      message: ACHIEVEMENT_ERROR_MESSAGES[error.code],
      details: error.details,
    });
    return;
  }
  response.status(500).json({
    code: 'VALIDATION_ERROR',
    message: ACHIEVEMENT_ERROR_MESSAGES.VALIDATION_ERROR,
    details: {},
  });
}

function positiveInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}
