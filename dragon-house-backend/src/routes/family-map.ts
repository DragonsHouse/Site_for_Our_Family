import { Router } from 'express';
import { z } from 'zod';
import type { FamilyAuthService } from '../auth/auth-service.js';
import type { AppConfig } from '../config/env.js';
import { FamilyMapError, FAMILY_MAP_ERROR_MESSAGES } from '../family-map/family-map-errors.js';
import type { FamilyMapService } from '../family-map/family-map-service.js';
import { requireFamilyAuthContext } from '../middleware/family-auth-context.js';

const mapPointSchema = z.object({
  id: z.number().int().positive().optional(),
  x: z.number().finite().min(0).max(100000),
  y: z.number().finite().min(0).max(100000),
  title: z.string().trim().min(1).max(180),
  icon: z.string().trim().min(1).max(120),
  iconUrl: z.string().trim().max(1000).nullable(),
  customIconDataUrl: z.string().nullable().optional(),
  detailImageDataUrl: z.string().nullable().optional(),
  zoneId: z.string().trim().max(120).nullable().optional(),
  filterLabel: z.string().trim().max(180).nullable(),
  color: z.string().trim().min(1).max(32),
  note: z.string().trim().max(2000).nullable(),
  sourceMarkerId: z.string().trim().max(240).nullable().optional(),
  hidden: z.boolean().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}).strict();

const zonePointSchema = z.object({
  x: z.number().finite().min(0).max(100000),
  y: z.number().finite().min(0).max(100000),
}).strict();

const mapZoneSchema = z.object({
  id: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(180),
  color: z.string().trim().min(1).max(32),
  opacity: z.number().finite().min(0).max(1).nullable().optional(),
  points: z.array(zonePointSchema).min(4).max(600),
  imageDataUrl: z.string().nullable().optional(),
  imageX: z.number().finite().min(-100000).max(100000).nullable().optional(),
  imageY: z.number().finite().min(-100000).max(100000).nullable().optional(),
  imageWidth: z.number().finite().min(0).max(100000).nullable().optional(),
  imageHeight: z.number().finite().min(0).max(100000).nullable().optional(),
  imageRotation: z.number().finite().min(-360).max(360).nullable().optional(),
  imageOpacity: z.number().finite().min(0).max(1).nullable().optional(),
  cropTop: z.number().finite().min(0).max(100).nullable().optional(),
  cropRight: z.number().finite().min(0).max(100).nullable().optional(),
  cropBottom: z.number().finite().min(0).max(100).nullable().optional(),
  cropLeft: z.number().finite().min(0).max(100).nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}).strict();

const updateMapSchema = z.object({
  expectedVersion: z.number().int().positive(),
  points: z.array(mapPointSchema).max(1000),
  zones: z.array(mapZoneSchema).max(200),
}).strict();

export function createFamilyMapRouter(
  config: AppConfig,
  authService: FamilyAuthService | null,
  mapService: FamilyMapService | null,
): Router {
  const router = Router();
  const requireAuth = requireFamilyAuthContext(config, authService);
  router.use('/family/map', requireAuth);

  router.get('/family/map/state', async (request, response) => {
    if (!mapService || !request.familyAuth) return respondServiceUnavailable(response);
    try {
      response.json(await mapService.getState(request.familyAuth));
    } catch (error) {
      respondMapError(response, error);
    }
  });

  router.put('/family/map/state', async (request, response) => {
    if (!mapService || !request.familyAuth) return respondServiceUnavailable(response);
    const body = updateMapSchema.safeParse(request.body);
    if (!body.success) return respondValidation(response, 'Family map payload is invalid.');
    try {
      response.json(await mapService.updateState(body.data, request.familyAuth));
    } catch (error) {
      respondMapError(response, error);
    }
  });

  return router;
}

function respondServiceUnavailable(response: import('express').Response) {
  response.status(503).json({
    code: 'FAMILY_MAP_SERVICE_UNAVAILABLE',
    message: FAMILY_MAP_ERROR_MESSAGES.FAMILY_MAP_SERVICE_UNAVAILABLE,
    details: {},
  });
}

function respondValidation(response: import('express').Response, summary: string) {
  response.status(400).json({
    code: 'VALIDATION_ERROR',
    message: FAMILY_MAP_ERROR_MESSAGES.VALIDATION_ERROR,
    details: { summary },
  });
}

function respondMapError(response: import('express').Response, error: unknown) {
  if (error instanceof FamilyMapError) {
    response.status(error.httpStatus).json({
      code: error.code,
      message: FAMILY_MAP_ERROR_MESSAGES[error.code],
      details: error.details,
    });
    return;
  }
  response.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'Карта сімʼї тимчасово не може виконати дію.',
    details: {},
  });
}
