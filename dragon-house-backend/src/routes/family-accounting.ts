import { Router } from 'express';
import { z } from 'zod';
import type { FamilyAuthService } from '../auth/auth-service.js';
import type { AppConfig } from '../config/env.js';
import type { FamilyAccountingService } from '../accounting/accounting-service.js';
import type { FamilyAccountingReadService } from '../accounting/accounting-read-service.js';
import { FinanceError, FINANCE_ERROR_MESSAGES } from '../accounting/finance-errors.js';
import { requireFamilyAuthContext } from '../middleware/family-auth-context.js';

export function createFamilyAccountingRouter(
  config: AppConfig,
  authService: FamilyAuthService | null,
  accountingReadService: FamilyAccountingReadService | null,
  accountingService: FamilyAccountingService | null = null,
): Router {
  const router = Router();
  const requireAuth = requireFamilyAuthContext(config, authService);
  router.use('/family/accounting', requireAuth);
  router.use('/family/members/:memberId/accounting-report', requireAuth);
  router.use('/family/members/:memberId/weekly-activity', requireAuth);

  router.get('/family/accounting/transactions', async (request, response) => {
    if (!request.familyAuth || !accountingReadService) return respondServiceUnavailable(response);
    try {
      response.json(await accountingReadService.listTransactions(request.familyAuth, positiveInt(request.query.limit, 50, 1, 100)));
    } catch (error) {
      respondFinanceError(response, error);
    }
  });

  router.get('/family/accounting/dashboard', async (request, response) => {
    if (!request.familyAuth || !accountingService) return respondServiceUnavailable(response);
    try {
      response.json(await accountingService.getDashboard({
        memberId: stringQuery(request.query.memberId),
        sourceType: stringQuery(request.query.sourceType) as never,
        status: stringQuery(request.query.status) as never,
        periodId: stringQuery(request.query.periodId),
        from: stringQuery(request.query.from),
        to: stringQuery(request.query.to),
        limit: positiveInt(request.query.limit, 50, 1, 200),
      }, request.familyAuth));
    } catch (error) {
      respondFinanceError(response, error);
    }
  });

  router.get('/family/accounting/payable-summary', async (request, response) => {
    if (!request.familyAuth || !accountingService) return respondServiceUnavailable(response);
    try {
      response.json(await accountingService.getPayableSummary(request.familyAuth));
    } catch (error) {
      respondFinanceError(response, error);
    }
  });

  router.get('/family/accounting/payment-proofs/:proofId', async (request, response) => {
    if (!request.familyAuth || !accountingService) return respondServiceUnavailable(response);
    try {
      const proof = await accountingService.getPaymentProofContent(String(request.params.proofId), request.familyAuth);
      const filename = proof.originalFilename.replace(/["\r\n]/g, '_');
      response.setHeader('Content-Type', proof.contentType);
      response.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      response.send(proof.data);
    } catch (error) {
      respondFinanceError(response, error);
    }
  });

  router.get('/family/accounting/payroll-periods', async (request, response) => {
    if (!request.familyAuth || !accountingService) return respondServiceUnavailable(response);
    try {
      response.json(await accountingService.listPayrollPeriods(request.familyAuth, positiveInt(request.query.limit, 50, 1, 200)));
    } catch (error) {
      respondFinanceError(response, error);
    }
  });

  router.post('/family/accounting/payroll-periods', async (request, response) => {
    if (!request.familyAuth || !accountingService) return respondServiceUnavailable(response);
    const parsed = payrollPeriodSchema.safeParse(request.body);
    if (!parsed.success) return respondValidation(response, parsed.error.message);
    try {
      response.status(201).json(await accountingService.createPayrollPeriod(parsed.data, request.familyAuth));
    } catch (error) {
      respondFinanceError(response, error);
    }
  });

  router.post('/family/accounting/salary-rules', async (request, response) => {
    if (!request.familyAuth || !accountingService) return respondServiceUnavailable(response);
    const parsed = salaryRuleSchema.safeParse(request.body);
    if (!parsed.success) return respondValidation(response, parsed.error.message);
    try {
      response.status(201).json(await accountingService.createSalaryRule(parsed.data, request.familyAuth));
    } catch (error) {
      respondFinanceError(response, error);
    }
  });

  router.get('/family/accounting/salary-rules', async (request, response) => {
    if (!request.familyAuth || !accountingService) return respondServiceUnavailable(response);
    try {
      response.json(await accountingService.listSalaryRules(request.familyAuth, positiveInt(request.query.limit, 100, 1, 200)));
    } catch (error) {
      respondFinanceError(response, error);
    }
  });

  router.patch('/family/accounting/salary-rules/:ruleId', async (request, response) => {
    if (!request.familyAuth || !accountingService) return respondServiceUnavailable(response);
    const parsed = salaryRuleUpdateSchema.safeParse(request.body);
    if (!parsed.success) return respondValidation(response, parsed.error.message);
    try {
      response.json(await accountingService.updateSalaryRule(String(request.params.ruleId), parsed.data, request.familyAuth));
    } catch (error) {
      respondFinanceError(response, error);
    }
  });

  router.post('/family/accounting/salary-rules/:ruleId/activate', async (request, response) => {
    if (!request.familyAuth || !accountingService) return respondServiceUnavailable(response);
    try {
      response.json(await accountingService.setSalaryRuleActive(String(request.params.ruleId), true, request.familyAuth));
    } catch (error) {
      respondFinanceError(response, error);
    }
  });

  router.post('/family/accounting/salary-rules/:ruleId/deactivate', async (request, response) => {
    if (!request.familyAuth || !accountingService) return respondServiceUnavailable(response);
    try {
      response.json(await accountingService.setSalaryRuleActive(String(request.params.ruleId), false, request.familyAuth));
    } catch (error) {
      respondFinanceError(response, error);
    }
  });

  router.post('/family/accounting/payroll-periods/:periodId/calculate', async (request, response) => {
    if (!request.familyAuth || !accountingService) return respondServiceUnavailable(response);
    try {
      response.json(await accountingService.calculatePayrollPeriod(String(request.params.periodId), request.familyAuth));
    } catch (error) {
      respondFinanceError(response, error);
    }
  });

  router.get('/family/accounting/payroll-periods/:periodId/preview', async (request, response) => {
    if (!request.familyAuth || !accountingService) return respondServiceUnavailable(response);
    try {
      response.json(await accountingService.previewPayrollPeriod(String(request.params.periodId), request.familyAuth));
    } catch (error) {
      respondFinanceError(response, error);
    }
  });

  router.get('/family/accounting/payroll-periods/:periodId/validate', async (request, response) => {
    if (!request.familyAuth || !accountingService) return respondServiceUnavailable(response);
    try {
      response.json(await accountingService.validateSalaryConfiguration(String(request.params.periodId), request.familyAuth));
    } catch (error) {
      respondFinanceError(response, error);
    }
  });

  router.post('/family/accounting/payroll-periods/:periodId/finalize', async (request, response) => {
    if (!request.familyAuth || !accountingService) return respondServiceUnavailable(response);
    try {
      response.json(await accountingService.finalizePayrollPeriod(String(request.params.periodId), request.familyAuth));
    } catch (error) {
      respondFinanceError(response, error);
    }
  });

  router.post('/family/accounting/premiums', async (request, response) => {
    if (!request.familyAuth || !accountingService) return respondServiceUnavailable(response);
    const parsed = premiumSchema.safeParse(request.body);
    if (!parsed.success) return respondValidation(response, parsed.error.message);
    try {
      response.status(201).json(await accountingService.createPremium(parsed.data, request.familyAuth));
    } catch (error) {
      respondFinanceError(response, error);
    }
  });

  router.post('/family/accounting/adjustments', async (request, response) => {
    if (!request.familyAuth || !accountingService) return respondServiceUnavailable(response);
    const parsed = adjustmentSchema.safeParse(request.body);
    if (!parsed.success) return respondValidation(response, parsed.error.message);
    try {
      response.status(201).json(await accountingService.createAdjustment(parsed.data, request.familyAuth));
    } catch (error) {
      respondFinanceError(response, error);
    }
  });

  router.post('/family/accounting/quests/:questId/recalculate-payouts', async (request, response) => {
    if (!request.familyAuth || !accountingService) return respondServiceUnavailable(response);
    const questId = z.string().uuid().safeParse(request.params.questId);
    if (!questId.success) return respondValidation(response, 'Invalid quest id.');
    try {
      response.json(await accountingService.recalculateQuestPayouts(questId.data, request.familyAuth));
    } catch (error) {
      respondFinanceError(response, error);
    }
  });

  router.post('/family/accounting/payout-batches', async (request, response) => {
    if (!request.familyAuth || !accountingService) return respondServiceUnavailable(response);
    const parsed = payoutBatchSchema.safeParse(request.body);
    if (!parsed.success) return respondValidation(response, parsed.error.message);
    try {
      response.status(201).json(await accountingService.createPayoutBatch(parsed.data, request.familyAuth));
    } catch (error) {
      respondFinanceError(response, error);
    }
  });

  router.post('/family/accounting/payout-batches/:batchId/finalize', async (request, response) => {
    if (!request.familyAuth || !accountingService) return respondServiceUnavailable(response);
    try {
      response.json(await accountingService.finalizePayoutBatch(String(request.params.batchId), request.familyAuth));
    } catch (error) {
      respondFinanceError(response, error);
    }
  });

  router.post('/family/accounting/payout-batches/:batchId/items/:itemId/confirm-paid', async (request, response) => {
    if (!request.familyAuth || !accountingService) return respondServiceUnavailable(response);
    const parsed = confirmPaidSchema.safeParse(request.body);
    if (!parsed.success) return respondValidation(response, parsed.error.message);
    try {
      response.json(await accountingService.confirmPayoutItemPaid(String(request.params.batchId), String(request.params.itemId), parsed.data, request.familyAuth));
    } catch (error) {
      respondFinanceError(response, error);
    }
  });

  router.get('/family/members/:memberId/accounting-report', async (request, response) => {
    if (!request.familyAuth || !accountingService) return respondServiceUnavailable(response);
    try {
      response.json(await accountingService.getMemberAccountingReport(String(request.params.memberId), request.familyAuth));
    } catch (error) {
      respondFinanceError(response, error);
    }
  });

  router.get('/family/members/:memberId/weekly-activity', async (request, response) => {
    if (!request.familyAuth || !accountingService) return respondServiceUnavailable(response);
    try {
      response.json(await accountingService.getWeeklyActivityStatus(String(request.params.memberId), request.familyAuth));
    } catch (error) {
      respondFinanceError(response, error);
    }
  });

  return router;
}

const payrollPeriodSchema = z.object({
  periodType: z.enum(['weekly', 'monthly', 'custom']),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  title: z.string().trim().min(1).max(160),
  metadata: z.record(z.unknown()).optional(),
}).strict();

const salaryRuleSchema = z.object({
  ruleKey: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).nullable().optional(),
  ruleType: z.enum(['eligibility', 'base_salary', 'fixed_activity_bonus', 'activity_multiplier', 'attendance_modifier', 'leadership_modifier', 'premium_rule']).optional(),
  basis: z.enum(['rank', 'role', 'member', 'manual', 'activity_metric']),
  amount: z.number().nonnegative(),
  currency: z.string().trim().min(1).max(12).optional(),
  active: z.boolean().optional(),
  priority: z.number().int().optional(),
  stackingPolicy: z.enum(['not_applicable', 'stack_all', 'highest_only', 'capped', 'category_specific']).optional(),
  effectiveFrom: z.string().date().nullable().optional(),
  effectiveTo: z.string().date().nullable().optional(),
  config: z.record(z.unknown()).optional(),
}).strict();

const salaryRuleUpdateSchema = salaryRuleSchema.omit({ ruleKey: true }).partial().strict();

const premiumSchema = z.object({
  familyMemberId: z.string().trim().min(1).max(160),
  payrollPeriodId: z.string().uuid().nullable().optional(),
  amount: z.number().positive(),
  currency: z.string().trim().min(1).max(12).optional(),
  reason: z.string().trim().min(1).max(500),
  sourceType: z.enum(['manual', 'rule', 'leaderboard', 'achievement', 'special']).optional(),
  sourceId: z.string().trim().min(1).max(240).nullable().optional(),
  sourceKey: z.string().trim().min(1).max(500).nullable().optional(),
  category: z.enum(['manual', 'activity', 'quest_activity', 'combat', 'top3', 'leadership', 'special']).optional(),
  stackingPolicy: z.enum(['not_applicable', 'stack_all', 'highest_only', 'capped', 'category_specific']).optional(),
}).strict();

const adjustmentSchema = z.object({
  familyMemberId: z.string().trim().min(1).max(160),
  amount: z.number().refine((value) => value !== 0, 'Amount must not be zero.'),
  currency: z.string().trim().min(1).max(12).optional(),
  reason: z.string().trim().min(1).max(500),
  sourceKey: z.string().trim().min(1).max(500).nullable().optional(),
}).strict();

const payoutBatchSchema = z.object({
  payrollPeriodId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(160),
  reference: z.string().trim().max(160).nullable().optional(),
  accrualIds: z.array(z.string().uuid()).min(1).max(200),
}).strict();

const confirmPaidSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(500).nullable().optional(),
  proof: z.object({
    originalFilename: z.string().trim().min(1).max(240),
    contentType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
    dataBase64: z.string().trim().min(1),
  }).strict(),
}).strict();

function positiveInt(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
}

function stringQuery(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function respondServiceUnavailable(response: import('express').Response) {
  response.status(503).json({
    code: 'FINANCE_SERVICE_UNAVAILABLE',
    message: FINANCE_ERROR_MESSAGES.FINANCE_SERVICE_UNAVAILABLE,
    details: {},
  });
}

function respondValidation(response: import('express').Response, summary: string) {
  response.status(400).json({
    code: 'VALIDATION_ERROR',
    message: FINANCE_ERROR_MESSAGES.VALIDATION_ERROR,
    details: { summary },
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
