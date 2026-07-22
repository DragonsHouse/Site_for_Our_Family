import { Router } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../config/env.js';
import { requireFamilyAuthContext } from '../middleware/family-auth-context.js';
import type { FamilyAuthService } from '../auth/auth-service.js';
import { FamilyMemberError, MEMBER_ERROR_MESSAGES } from '../members/member-errors.js';
import type { FamilyMemberService } from '../members/member-service.js';
import type { FamilyMemberListQuery, FamilyPermission } from '../types.js';

const roleSchema = z.enum(['owner', 'deputy', 'moderator', 'member']);
const statusSchema = z.enum(['active', 'inactive']);
const sortBySchema = z.enum(['nickname', 'staticId', 'role', 'rank', 'status', 'joinedAt', 'createdAt', 'updatedAt']);
const sortOrderSchema = z.enum(['asc', 'desc']);
const permissionSchema = z.string().min(1).max(80).transform((value) => value as FamilyPermission);

const CreateMemberSchema = z
  .object({
    nickname: z.string().trim().min(1).max(120),
    staticId: z.string().trim().min(1).max(80),
    role: roleSchema.default('member'),
    rank: z.number().int().min(1).max(10).default(1),
    status: statusSchema.default('active'),
    avatarAssetId: z.string().trim().max(160).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    joinedAt: z.string().datetime().nullable().optional(),
    permissions: z.array(permissionSchema).default([]),
    permissionsOverride: z.array(permissionSchema).optional(),
    onboardingMetadata: z.record(z.unknown()).optional(),
    profileMetadata: z.record(z.unknown()).optional(),
  })
  .strict();

const UpdateMemberSchema = CreateMemberSchema.partial()
  .extend({
    version: z.number().int().positive(),
  })
  .strict();

const DeleteMemberSchema = z.object({ version: z.number().int().positive() }).strict();

const forbiddenKeys = /password|passwordHash|token|session|discordAccessToken|discordRefreshToken|createdAt|updatedAt|deletedAt|familyMemberId/iu;

export function createFamilyMembersRouter(
  config: AppConfig,
  authService: FamilyAuthService | null,
  memberService: FamilyMemberService | null,
): Router {
  const router = Router();
  const requireAuth = requireFamilyAuthContext(config, authService);
  router.use('/family/members', requireAuth);

  router.get('/family/members', async (request, response) => {
    if (!memberService || !request.familyAuth) return respondServiceUnavailable(response);
    try {
      const query: FamilyMemberListQuery = {
        page: positiveInt(request.query.page, 1, 1, 100_000),
        pageSize: positiveInt(request.query.pageSize, 25, 1, 100),
        search: stringQuery(request.query.search),
        status: enumQuery(request.query.status, ['active', 'inactive', 'all'] as const),
        role: enumQuery(request.query.role, ['owner', 'deputy', 'moderator', 'member', 'all'] as const),
        rank: optionalInt(request.query.rank, 1, 10),
        sortBy: sortBySchema.safeParse(request.query.sortBy).success ? (request.query.sortBy as FamilyMemberListQuery['sortBy']) : 'nickname',
        sortOrder: sortOrderSchema.safeParse(request.query.sortOrder).success ? (request.query.sortOrder as 'asc' | 'desc') : 'asc',
        includeDeleted: request.query.includeDeleted === 'true',
      };
      response.json(await memberService.list(query, request.familyAuth));
    } catch (error) {
      respondMemberError(response, error);
    }
  });

  router.get('/family/members/:memberId', async (request, response) => {
    if (!memberService || !request.familyAuth) return respondServiceUnavailable(response);
    try {
      response.json(await memberService.get(request.params.memberId, request.familyAuth));
    } catch (error) {
      respondMemberError(response, error);
    }
  });

  router.post('/family/members', async (request, response) => {
    if (!memberService || !request.familyAuth) return respondServiceUnavailable(response);
    const unsafe = findForbiddenKey(request.body);
    if (unsafe) return respondValidation(response, `Forbidden field: ${unsafe}`);
    const parsed = CreateMemberSchema.safeParse(request.body);
    if (!parsed.success) return respondValidation(response, parsed.error.message);
    try {
      response.status(201).json(await memberService.create(parsed.data, request.familyAuth));
    } catch (error) {
      respondMemberError(response, error);
    }
  });

  router.patch('/family/members/:memberId', async (request, response) => {
    if (!memberService || !request.familyAuth) return respondServiceUnavailable(response);
    const unsafe = findForbiddenKey(request.body);
    if (unsafe) return respondValidation(response, `Forbidden field: ${unsafe}`);
    const parsed = UpdateMemberSchema.safeParse(request.body);
    if (!parsed.success) return respondValidation(response, parsed.error.message);
    const { version, ...input } = parsed.data;
    if (Object.keys(input).length === 0) return respondValidation(response, 'Empty PATCH');
    try {
      response.json(await memberService.update(request.params.memberId, input, version, request.familyAuth));
    } catch (error) {
      respondMemberError(response, error);
    }
  });

  router.delete('/family/members/:memberId', async (request, response) => {
    if (!memberService || !request.familyAuth) return respondServiceUnavailable(response);
    const parsed = DeleteMemberSchema.safeParse(request.body);
    if (!parsed.success) return respondValidation(response, parsed.error.message);
    try {
      response.json(await memberService.softDelete(request.params.memberId, parsed.data.version, request.familyAuth));
    } catch (error) {
      respondMemberError(response, error);
    }
  });

  router.post('/family/members/:memberId/restore', async (request, response) => {
    if (!memberService || !request.familyAuth) return respondServiceUnavailable(response);
    const parsed = DeleteMemberSchema.safeParse(request.body);
    if (!parsed.success) return respondValidation(response, parsed.error.message);
    try {
      response.json(await memberService.restore(request.params.memberId, parsed.data.version, request.familyAuth));
    } catch (error) {
      respondMemberError(response, error);
    }
  });

  return router;
}

function positiveInt(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
}

function optionalInt(value: unknown, min: number, max: number) {
  if (value === undefined) return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : null;
}

function stringQuery(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function enumQuery<T extends readonly string[]>(value: unknown, options: T): T[number] | null {
  return typeof value === 'string' && (options as readonly string[]).includes(value) ? (value as T[number]) : null;
}

function findForbiddenKey(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (forbiddenKeys.test(key) || key === '__proto__' || key === 'constructor' || key === 'prototype') return key;
    const nested = findForbiddenKey(item);
    if (nested) return `${key}.${nested}`;
  }
  return null;
}

function respondServiceUnavailable(response: import('express').Response) {
  response.status(503).json({ code: 'MEMBER_PERMISSION_DENIED', message: 'Member API is unavailable.', details: {} });
}

function respondValidation(response: import('express').Response, summary: string) {
  response.status(400).json({ code: 'VALIDATION_ERROR', message: MEMBER_ERROR_MESSAGES.VALIDATION_ERROR, details: { summary } });
}

function respondMemberError(response: import('express').Response, error: unknown) {
  if (error instanceof FamilyMemberError) {
    response.status(error.httpStatus).json({
      code: error.code,
      message: MEMBER_ERROR_MESSAGES[error.code],
      details: error.details,
    });
    return;
  }
  response.status(500).json({ code: 'VALIDATION_ERROR', message: MEMBER_ERROR_MESSAGES.VALIDATION_ERROR, details: {} });
}
