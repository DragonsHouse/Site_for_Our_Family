import type { NextFunction, Request, Response } from 'express';
import type { AppConfig } from '../config/env.js';
import { FamilyAuthError, authErrorMessage } from '../auth/auth-errors.js';
import type { FamilyAuthService } from '../auth/auth-service.js';
import type { FamilyPermission, FamilyRole } from '../types.js';

export type FamilyAuthContext = {
  familyMemberId: string;
  role: FamilyRole;
  rank: number;
  permissions: FamilyPermission[];
};

declare module 'express-serve-static-core' {
  interface Request {
    familyAuth?: FamilyAuthContext;
  }
}

export function requireFamilyAuthContext(config: AppConfig, authService: FamilyAuthService | null) {
  return async (request: Request, response: Response, next: NextFunction) => {
    if (!authService) {
      if (config.nodeEnv === 'test') {
        const familyMemberId = request.header('x-family-member-id')?.trim();
        if (!familyMemberId) {
          response.status(401).json({ error: 'missing_test_family_member' });
          return;
        }
        request.familyAuth = { familyMemberId, role: 'member', rank: 1, permissions: [] };
        next();
        return;
      }

      response.status(503).json({
        error: 'database_unavailable',
        message: authErrorMessage('database_unavailable'),
      });
      return;
    }

    const token = readBearerToken(request);
    if (!token) {
      response.status(401).json({ error: 'session_required', message: authErrorMessage('session_required') });
      return;
    }

    try {
      const { context } = await authService.authenticateToken(token);
      request.familyAuth = context;
      next();
    } catch (error) {
      respondWithAuthError(response, error);
    }
  };
}

export function readBearerToken(request: Request): string | null {
  const authorization = request.header('authorization');
  if (!authorization) return null;
  const match = /^Bearer\s+(.+)$/iu.exec(authorization);
  return match?.[1]?.trim() || null;
}

export function respondWithAuthError(response: Response, error: unknown): void {
  if (error instanceof FamilyAuthError) {
    response.status(error.httpStatus).json({ error: error.code, message: authErrorMessage(error.code) });
    return;
  }
  response.status(500).json({ error: 'session_invalid', message: authErrorMessage('session_invalid') });
}
