import { Router } from 'express';
import { z } from 'zod';
import type { FamilyAuthService } from '../auth/auth-service.js';
import type { AppConfig } from '../config/env.js';
import { DiscordOrchestrationError } from '../discord/orchestration-errors.js';
import type { DiscordOrchestrationService } from '../discord/orchestration-service.js';
import { requireFamilyAuthContext } from '../middleware/family-auth-context.js';
import type { FamilyAuthContext } from '../types.js';

const uuidSchema = z.string().uuid();
const publishBodySchema = z.object({}).strict();

type PublishTarget = 'quest' | 'tower' | 'event';

export function createDiscordOrchestrationRouter(
  config: AppConfig,
  authService: FamilyAuthService | null,
  orchestration: DiscordOrchestrationService | null,
): Router {
  const router = Router();
  const requireAuth = requireFamilyAuthContext(config, authService);
  router.use(['/family/quests', '/family/tower-defenses', '/family/events', '/discord/orchestration'], requireAuth);

  router.get('/family/quests/:questId/discord', async (request, response) => {
    if (!orchestration || !request.familyAuth) return respondUnavailable(response);
    if (!canManageDiscordOrchestration(request.familyAuth)) return respondDenied(response);
    const questId = uuidSchema.safeParse(request.params.questId);
    if (!questId.success) return respondValidation(response);
    response.json(await orchestration.getPublishState('family_quests', questId.data, config.discord.channels.questAnnouncements, 'Квести'));
  });

  router.post('/family/quests/:questId/discord/publish', (request, response) => publishQuest(request, response, config, orchestration));
  router.post('/family/quests/:questId/discord/sync', (request, response) => publishQuest(request, response, config, orchestration));
  router.post('/discord/orchestration/quests/:questId/publish', (request, response) => publishQuest(request, response, config, orchestration));

  router.get('/family/tower-defenses/:defenseId/discord', async (request, response) => {
    if (!orchestration || !request.familyAuth) return respondUnavailable(response);
    if (!canManageDiscordOrchestration(request.familyAuth)) return respondDenied(response);
    const defenseId = uuidSchema.safeParse(request.params.defenseId);
    if (!defenseId.success) return respondValidation(response);
    response.json(await orchestration.getPublishState('tower_defense', defenseId.data, config.discord.channels.towerGuard, 'Вишки / стаки'));
  });

  router.post('/family/tower-defenses/:defenseId/discord/publish', (request, response) => publishTower(request, response, config, orchestration));
  router.post('/family/tower-defenses/:defenseId/discord/sync', (request, response) => publishTower(request, response, config, orchestration));
  router.post('/discord/orchestration/tower-defenses/:defenseId/publish', (request, response) => publishTower(request, response, config, orchestration));

  router.get('/family/events/:eventId/discord', async (request, response) => {
    if (!orchestration || !request.familyAuth) return respondUnavailable(response);
    if (!canManageDiscordOrchestration(request.familyAuth)) return respondDenied(response);
    const eventId = uuidSchema.safeParse(request.params.eventId);
    if (!eventId.success) return respondValidation(response);
    response.json(await orchestration.getPublishState('family_events', eventId.data, config.discord.channels.events, 'Події'));
  });

  router.post('/family/events/:eventId/discord/publish', (request, response) => publishEvent(request, response, config, orchestration));
  router.post('/family/events/:eventId/discord/sync', (request, response) => publishEvent(request, response, config, orchestration));
  router.post('/discord/orchestration/events/:eventId/publish', (request, response) => publishEvent(request, response, config, orchestration));

  return router;
}

export function canManageDiscordOrchestration(auth: FamilyAuthContext): boolean {
  return auth.role === 'owner' || auth.rank >= 8 || auth.permissions.includes('manage_discord_integration');
}

async function publishQuest(
  request: import('express').Request,
  response: import('express').Response,
  config: AppConfig,
  orchestration: DiscordOrchestrationService | null,
) {
  return publish(request, response, config, orchestration, 'quest', singleParam(request.params.questId));
}

async function publishTower(
  request: import('express').Request,
  response: import('express').Response,
  config: AppConfig,
  orchestration: DiscordOrchestrationService | null,
) {
  return publish(request, response, config, orchestration, 'tower', singleParam(request.params.defenseId));
}

async function publishEvent(
  request: import('express').Request,
  response: import('express').Response,
  config: AppConfig,
  orchestration: DiscordOrchestrationService | null,
) {
  return publish(request, response, config, orchestration, 'event', singleParam(request.params.eventId));
}

async function publish(
  request: import('express').Request,
  response: import('express').Response,
  config: AppConfig,
  orchestration: DiscordOrchestrationService | null,
  target: PublishTarget,
  id: string | undefined,
) {
  if (!orchestration || !request.familyAuth) return respondUnavailable(response);
  if (!canManageDiscordOrchestration(request.familyAuth)) return respondDenied(response);
  const parsedId = uuidSchema.safeParse(id);
  const body = publishBodySchema.safeParse(request.body);
  if (!parsedId.success || !body.success) return respondValidation(response);
  try {
    if (target === 'quest') {
      response.json(await orchestration.publishQuest(parsedId.data, config.discord.channels.questAnnouncements ?? '', request.familyAuth));
      return;
    }
    if (target === 'tower') {
      response.json(await orchestration.publishTowerDefense(parsedId.data, config.discord.channels.towerGuard ?? '', request.familyAuth));
      return;
    }
    response.json(await orchestration.publishFamilyEvent(parsedId.data, config.discord.channels.events ?? '', request.familyAuth));
  } catch (error) {
    respondDiscordError(response, error);
  }
}

function respondUnavailable(response: import('express').Response) {
  response.status(503).json({ code: 'DISCORD_ORCHESTRATION_UNAVAILABLE', message: 'Discord orchestration is unavailable.' });
}

function respondDenied(response: import('express').Response) {
  response.status(403).json({ code: 'DISCORD_PERMISSION_DENIED', message: 'Permission denied.' });
}

function respondValidation(response: import('express').Response) {
  response.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid Discord orchestration request.' });
}

function respondDiscordError(response: import('express').Response, error: unknown) {
  if (error instanceof DiscordOrchestrationError) {
    response.status(error.status).json({ code: error.code, message: error.message });
    return;
  }
  response.status(409).json({
    code: error instanceof Error ? error.message : 'DISCORD_ORCHESTRATION_ERROR',
    message: 'Discord orchestration action failed.',
  });
}

function singleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
