import { Router } from 'express';
import { z } from 'zod';
import type { FamilyAuthService } from '../auth/auth-service.js';
import type { AppConfig } from '../config/env.js';
import { FamilyContentError, FAMILY_CONTENT_ERROR_MESSAGES } from '../content/content-errors.js';
import type { FamilyContentService } from '../content/content-service.js';
import { requireFamilyAuthContext } from '../middleware/family-auth-context.js';

const scopeSchema = z.enum(['home', 'rules', 'recruitment']);
const contentBlockPatchSchema = z.object({
  title: z.string().trim().min(1).max(180),
  body: z.string().trim().min(1).max(5000),
  contact: z.string().trim().max(240).nullable().optional(),
  expectedVersion: z.number().int().positive(),
}).strict();

const recruitmentPatchSchema = z.object({
  isOpen: z.boolean(),
  description: z.string().trim().min(1).max(5000),
  requirements: z.array(z.string().trim().min(1).max(500)).min(1).max(30),
  contact: z.string().trim().min(1).max(240),
  expectedVersion: z.number().int().positive(),
}).strict();

const newsTypeSchema = z.enum(['urgent', 'important', 'family_news', 'announcement', 'recruitment', 'poll', 'family', 'event', 'info']);
const newsWriteSchema = z.object({
  type: newsTypeSchema,
  title: z.string().trim().min(1).max(180),
  body: z.string().trim().min(1).max(5000),
  pinned: z.boolean().optional(),
  urgent: z.boolean().optional(),
  notificationRequired: z.boolean().optional(),
}).strict();
const newsPatchSchema = newsWriteSchema.partial().extend({
  expectedVersion: z.number().int().positive(),
}).refine((value) => Object.keys(value).length > 1, { message: 'At least one field is required.' });
const archiveSchema = z.object({ expectedVersion: z.number().int().positive() }).strict();

export function createFamilyContentRouter(
  config: AppConfig,
  authService: FamilyAuthService | null,
  contentService: FamilyContentService | null,
): Router {
  const router = Router();
  const requireAuth = requireFamilyAuthContext(config, authService);
  router.use(['/family/content', '/family/recruitment', '/family/news'], requireAuth);

  router.get('/family/content/blocks', async (request, response) => {
    if (!contentService || !request.familyAuth) return respondServiceUnavailable(response);
    const scope = scopeSchema.safeParse(request.query.scope);
    try {
      response.json(await contentService.listContentBlocks(scope.success ? scope.data : undefined, request.familyAuth));
    } catch (error) {
      respondContentError(response, error);
    }
  });

  router.patch('/family/content/blocks/:blockId', async (request, response) => {
    if (!contentService || !request.familyAuth) return respondServiceUnavailable(response);
    const body = contentBlockPatchSchema.safeParse(request.body);
    if (!body.success) return respondValidation(response, 'Content block update payload is invalid.');
    try {
      response.json(await contentService.updateContentBlock(request.params.blockId, body.data, request.familyAuth));
    } catch (error) {
      respondContentError(response, error);
    }
  });

  router.get('/family/recruitment/settings', async (request, response) => {
    if (!contentService || !request.familyAuth) return respondServiceUnavailable(response);
    try {
      response.json(await contentService.getRecruitmentSettings(request.familyAuth));
    } catch (error) {
      respondContentError(response, error);
    }
  });

  router.patch('/family/recruitment/settings', async (request, response) => {
    if (!contentService || !request.familyAuth) return respondServiceUnavailable(response);
    const body = recruitmentPatchSchema.safeParse(request.body);
    if (!body.success) return respondValidation(response, 'Recruitment settings payload is invalid.');
    try {
      response.json(await contentService.updateRecruitmentSettings(body.data, request.familyAuth));
    } catch (error) {
      respondContentError(response, error);
    }
  });

  router.get('/family/news/posts', async (request, response) => {
    if (!contentService || !request.familyAuth) return respondServiceUnavailable(response);
    try {
      response.json(await contentService.listNewsPosts({ includeArchived: request.query.includeArchived === 'true' }, request.familyAuth));
    } catch (error) {
      respondContentError(response, error);
    }
  });

  router.post('/family/news/posts', async (request, response) => {
    if (!contentService || !request.familyAuth) return respondServiceUnavailable(response);
    const body = newsWriteSchema.safeParse(request.body);
    if (!body.success) return respondValidation(response, 'News post payload is invalid.');
    try {
      response.status(201).json(await contentService.createNewsPost(body.data, request.familyAuth));
    } catch (error) {
      respondContentError(response, error);
    }
  });

  router.patch('/family/news/posts/:postId', async (request, response) => {
    if (!contentService || !request.familyAuth) return respondServiceUnavailable(response);
    const body = newsPatchSchema.safeParse(request.body);
    if (!body.success) return respondValidation(response, 'News post update payload is invalid.');
    try {
      response.json(await contentService.updateNewsPost(request.params.postId, body.data, request.familyAuth));
    } catch (error) {
      respondContentError(response, error);
    }
  });

  router.delete('/family/news/posts/:postId', async (request, response) => {
    if (!contentService || !request.familyAuth) return respondServiceUnavailable(response);
    const body = archiveSchema.safeParse(request.body);
    if (!body.success) return respondValidation(response, 'News post archive payload is invalid.');
    try {
      response.json(await contentService.archiveNewsPost(request.params.postId, body.data.expectedVersion, request.familyAuth));
    } catch (error) {
      respondContentError(response, error);
    }
  });

  return router;
}

function respondServiceUnavailable(response: import('express').Response) {
  response.status(503).json({
    code: 'CONTENT_SERVICE_UNAVAILABLE',
    message: FAMILY_CONTENT_ERROR_MESSAGES.CONTENT_SERVICE_UNAVAILABLE,
    details: {},
  });
}

function respondValidation(response: import('express').Response, summary: string) {
  response.status(400).json({
    code: 'VALIDATION_ERROR',
    message: FAMILY_CONTENT_ERROR_MESSAGES.VALIDATION_ERROR,
    details: { summary },
  });
}

function respondContentError(response: import('express').Response, error: unknown) {
  if (error instanceof FamilyContentError) {
    response.status(error.httpStatus).json({
      code: error.code,
      message: FAMILY_CONTENT_ERROR_MESSAGES[error.code],
      details: error.details,
    });
    return;
  }
  response.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'Матеріали Dragon House тимчасово не можуть виконати дію.',
    details: {},
  });
}
