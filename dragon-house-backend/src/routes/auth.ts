import { Router } from 'express';
import { z } from 'zod';
import { FamilyAuthError, authErrorMessage } from '../auth/auth-errors.js';
import type { FamilyAuthService } from '../auth/auth-service.js';
import { readBearerToken, respondWithAuthError } from '../middleware/family-auth-context.js';
import type { FamilyPermission } from '../types.js';

const LoginSchema = z.object({
  loginOrStaticId: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(256),
  rememberMe: z.boolean().optional().default(false),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(1).max(256),
});

const CreateAuthUserSchema = z.object({
  familyMemberId: z.string().trim().min(1).max(120),
  login: z.string().trim().min(1).max(120),
  staticId: z.string().trim().min(1).max(80),
  role: z.enum(['owner', 'deputy', 'moderator', 'member']),
  rank: z.number().int().min(1).max(10),
  permissions: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

export function createAuthRouter(authService: FamilyAuthService | null): Router {
  const router = Router();

  router.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });

  router.post('/auth/login', async (request, response) => {
    if (!authService) {
      response.status(503).json({ error: 'database_unavailable', message: authErrorMessage('database_unavailable') });
      return;
    }
    const parsed = LoginSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_credentials', message: authErrorMessage('invalid_credentials') });
      return;
    }
    try {
      response.json(await authService.login(parsed.data.loginOrStaticId, parsed.data.password, { rememberMe: parsed.data.rememberMe }));
    } catch (error) {
      respondWithAuthError(response, normalizeLoginError(error));
    }
  });

  router.get('/auth/me', async (request, response) => {
    if (!authService) {
      response.status(503).json({ error: 'database_unavailable', message: authErrorMessage('database_unavailable') });
      return;
    }
    const token = readBearerToken(request);
    if (!token) {
      response.status(401).json({ error: 'session_required', message: authErrorMessage('session_required') });
      return;
    }
    try {
      response.json(await authService.me(token));
    } catch (error) {
      respondWithAuthError(response, error);
    }
  });

  router.post('/auth/logout', async (request, response) => {
    if (!authService) {
      response.status(503).json({ error: 'database_unavailable', message: authErrorMessage('database_unavailable') });
      return;
    }
    const token = readBearerToken(request);
    if (!token) {
      response.status(401).json({ error: 'session_required', message: authErrorMessage('session_required') });
      return;
    }
    try {
      await authService.logout(token);
      response.status(204).send();
    } catch (error) {
      respondWithAuthError(response, error);
    }
  });

  router.post('/auth/change-password', async (request, response) => {
    if (!authService) {
      response.status(503).json({ error: 'database_unavailable', message: authErrorMessage('database_unavailable') });
      return;
    }
    const token = readBearerToken(request);
    if (!token) {
      response.status(401).json({ error: 'session_required', message: authErrorMessage('session_required') });
      return;
    }
    const parsed = ChangePasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'password_too_weak', message: authErrorMessage('password_too_weak') });
      return;
    }
    try {
      response.json(await authService.changePassword(token, parsed.data.currentPassword, parsed.data.newPassword));
    } catch (error) {
      respondWithAuthError(response, error);
    }
  });

  router.post('/auth/users', async (request, response) => {
    if (!authService) {
      response.status(503).json({ error: 'database_unavailable', message: authErrorMessage('database_unavailable') });
      return;
    }
    const token = readBearerToken(request);
    if (!token) {
      response.status(401).json({ error: 'session_required', message: authErrorMessage('session_required') });
      return;
    }
    const parsed = CreateAuthUserSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'invalid_credentials', message: 'Invalid auth user payload' });
      return;
    }
    try {
      response.status(201).json(
        await authService.createAuthUser(token, {
          ...parsed.data,
          permissions: parsed.data.permissions as FamilyPermission[],
        }),
      );
    } catch (error) {
      respondWithAuthError(response, error);
    }
  });

  return router;
}

function normalizeLoginError(error: unknown): unknown {
  if (error instanceof FamilyAuthError && error.code === 'current_password_invalid') {
    return new FamilyAuthError('invalid_credentials', 'Invalid credentials');
  }
  return error;
}
