import { Router } from 'express';
import type { FamilyAuthService } from '../auth/auth-service.js';
import type { AppConfig } from '../config/env.js';
import { FinanceError, FINANCE_ERROR_MESSAGES } from '../accounting/finance-errors.js';
import type { FamilyAccountingReadService } from '../accounting/accounting-read-service.js';
import { requireFamilyAuthContext } from '../middleware/family-auth-context.js';

export function createFamilyAccountingRouter(
  config: AppConfig,
  authService: FamilyAuthService | null,
  accountingReadService: FamilyAccountingReadService | null,
): Router {
  const router = Router();
  const requireAuth = requireFamilyAuthContext(config, authService);
  router.use('/family/accounting', requireAuth);

  router.get('/family/accounting/transactions', async (request, response) => {
    if (!request.familyAuth) return respondServiceUnavailable(response);
    if (!accountingReadService) return respondServiceUnavailable(response);
    try {
      response.json(await accountingReadService.listTransactions(request.familyAuth, positiveInt(request.query.limit, 50, 1, 100)));
    } catch (error) {
      respondFinanceError(response, error);
    }
  });

  return router;
}

function positiveInt(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
}

function respondServiceUnavailable(response: import('express').Response) {
  response.status(503).json({
    code: 'FINANCE_SERVICE_UNAVAILABLE',
    message: FINANCE_ERROR_MESSAGES.FINANCE_SERVICE_UNAVAILABLE,
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
