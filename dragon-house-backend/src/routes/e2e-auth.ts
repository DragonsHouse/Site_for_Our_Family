import { Router } from 'express';
import { z } from 'zod';
import type { FamilyAuthService } from '../auth/auth-service.js';
import type { AppConfig } from '../config/env.js';

const actorIds = {
  owner: 'e2e-owner',
  deputy: 'e2e-deputy',
  member: 'e2e-member',
} as const;

const loginSchema = z.object({
  actor: z.enum(['owner', 'deputy', 'member']),
  rememberMe: z.boolean().optional().default(true),
}).strict();

export function createE2eAuthRouter(config: AppConfig, authService: FamilyAuthService | null): Router {
  const router = Router();

  router.post('/e2e/auth/login', async (request, response) => {
    if (!isE2eAuthEnabled(config) || !authService) {
      response.status(404).json({ error: 'not_found' });
      return;
    }
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'validation_error' });
      return;
    }
    response.json(await authService.createSessionForFamilyMember(actorIds[parsed.data.actor], {
      loginProvider: 'nickname',
      rememberMe: parsed.data.rememberMe,
    }));
  });

  return router;
}

function isE2eAuthEnabled(config: AppConfig): boolean {
  if (config.nodeEnv !== 'test' || !config.e2eTestMode) return false;
  if (!config.databaseUrl) return false;
  try {
    const databaseName = new URL(config.databaseUrl).pathname.replace(/^\/+/u, '');
    return databaseName === config.e2eDatabaseName && databaseName.includes('e2e');
  } catch {
    return false;
  }
}
