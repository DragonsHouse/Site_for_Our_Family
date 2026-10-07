import { Router } from 'express';
import { z } from 'zod';
import type { FamilyAuthService } from '../auth/auth-service.js';
import type { AppConfig } from '../config/env.js';
import { requireFamilyAuthContext } from '../middleware/family-auth-context.js';
import { FAMILY_TREASURY_ERROR_MESSAGES, FamilyTreasuryError } from '../treasury/treasury-errors.js';
import type { FamilyTreasuryService } from '../treasury/treasury-service.js';

const categorySchema = z.enum(['fuel', 'clothing', 'weapons', 'shops', 'other']);
const entryIdSchema = z.string().trim().min(1).max(120);
const entryWriteSchema = z.object({
  category: categorySchema,
  title: z.string().trim().min(1).max(180),
  locationNumber: z.string().trim().max(120).nullable().optional(),
  locationReference: z.string().trim().max(240).nullable().optional(),
  description: z.string().trim().max(2000).optional(),
  price: z.string().trim().max(240).nullable().optional(),
  priceAmount: z.number().min(0).max(999_999_999_999).nullable().optional(),
  priceNote: z.string().trim().max(500).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
}).strict();
const entryPatchSchema = entryWriteSchema.partial().extend({
  expectedVersion: z.number().int().positive(),
}).refine((value) => Object.keys(value).length > 1, {
  message: 'At least one field is required.',
});
const archiveSchema = z.object({
  expectedVersion: z.number().int().positive(),
}).strict();

export function createFamilyTreasuryRouter(
  config: AppConfig,
  authService: FamilyAuthService | null,
  treasuryService: FamilyTreasuryService | null,
): Router {
  const router = Router();
  const requireAuth = requireFamilyAuthContext(config, authService);
  router.use('/family/treasury', requireAuth);

  router.get('/family/treasury/entries', async (request, response) => {
    if (!treasuryService || !request.familyAuth) return respondServiceUnavailable(response);
    try {
      response.json(await treasuryService.listEntries({ includeInactive: request.query.includeInactive === 'true' }, request.familyAuth));
    } catch (error) {
      respondTreasuryError(response, error);
    }
  });

  router.post('/family/treasury/entries', async (request, response) => {
    if (!treasuryService || !request.familyAuth) return respondServiceUnavailable(response);
    const body = entryWriteSchema.safeParse(request.body);
    if (!body.success) return respondValidation(response, 'Treasury entry payload is invalid.');
    try {
      response.status(201).json(await treasuryService.createEntry(body.data, request.familyAuth));
    } catch (error) {
      respondTreasuryError(response, error);
    }
  });

  router.patch('/family/treasury/entries/:entryId', async (request, response) => {
    if (!treasuryService || !request.familyAuth) return respondServiceUnavailable(response);
    const entryId = entryIdSchema.safeParse(request.params.entryId);
    const body = entryPatchSchema.safeParse(request.body);
    if (!entryId.success || !body.success) return respondValidation(response, 'Treasury entry update payload is invalid.');
    try {
      response.json(await treasuryService.updateEntry(entryId.data, body.data, request.familyAuth));
    } catch (error) {
      respondTreasuryError(response, error);
    }
  });

  router.delete('/family/treasury/entries/:entryId', async (request, response) => {
    if (!treasuryService || !request.familyAuth) return respondServiceUnavailable(response);
    const entryId = entryIdSchema.safeParse(request.params.entryId);
    const body = archiveSchema.safeParse(request.body);
    if (!entryId.success || !body.success) return respondValidation(response, 'Invalid treasury archive request.');
    try {
      response.json(await treasuryService.archiveEntry(entryId.data, body.data.expectedVersion, request.familyAuth));
    } catch (error) {
      respondTreasuryError(response, error);
    }
  });

  return router;
}

function respondServiceUnavailable(response: import('express').Response) {
  response.status(503).json({
    code: 'TREASURY_SERVICE_UNAVAILABLE',
    message: FAMILY_TREASURY_ERROR_MESSAGES.TREASURY_SERVICE_UNAVAILABLE,
    details: {},
  });
}

function respondValidation(response: import('express').Response, summary: string) {
  response.status(400).json({
    code: 'VALIDATION_ERROR',
    message: FAMILY_TREASURY_ERROR_MESSAGES.VALIDATION_ERROR,
    details: { summary },
  });
}

function respondTreasuryError(response: import('express').Response, error: unknown) {
  if (error instanceof FamilyTreasuryError) {
    response.status(error.httpStatus).json({
      code: error.code,
      message: FAMILY_TREASURY_ERROR_MESSAGES[error.code],
      details: error.details,
    });
    return;
  }
  response.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'Скарбниця тимчасово не може виконати дію.',
    details: {},
  });
}
