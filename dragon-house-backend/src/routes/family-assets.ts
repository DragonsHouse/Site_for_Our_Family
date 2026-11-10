import express, { Router, type Response } from 'express';
import type { FamilyAuthService } from '../auth/auth-service.js';
import type { AppConfig } from '../config/env.js';
import { FamilyAssetError, FamilyAssetService } from '../assets/family-asset-service.js';
import { requireFamilyAuthContext } from '../middleware/family-auth-context.js';

export function createFamilyAssetsRouter(
  config: AppConfig,
  authService: FamilyAuthService | null,
  service: FamilyAssetService | null,
): Router {
  const router = Router();
  router.use('/family/assets', requireFamilyAuthContext(config, authService));
  router.get('/family/assets/slots/:slot', async (req, res) => {
    if (!service) return unavailable(res);
    try {
      res.json(await service.state(req.params.slot));
    } catch (e) {
      respond(res, e);
    }
  });
  router.put(
    '/family/assets/slots/:slot',
    express.raw({
      type: ['image/png', 'image/jpeg', 'image/webp', 'application/octet-stream'],
      limit: config.familyAssets.maxBytes,
    }),
    async (req, res) => {
      if (!service || !req.familyAuth) return unavailable(res);
      if (!Buffer.isBuffer(req.body))
        return res.status(400).json({ code: 'ASSET_BODY_INVALID', message: 'Очікується binary image body.' });
      try {
        res
          .status(201)
          .json(
            await service.upload(
              req.params.slot,
              decodeURIComponent(req.header('x-file-name') ?? 'upload'),
              req.header('content-type'),
              req.body,
              req.familyAuth,
              Number(req.header('x-expected-version')),
            ),
          );
      } catch (e) {
        respond(res, e);
      }
    },
  );
  router.delete('/family/assets/slots/:slot', async (req, res) => {
    if (!service || !req.familyAuth) return unavailable(res);
    try {
      await service.reset(req.params.slot, req.familyAuth, Number(req.header('x-expected-version')));
      res.status(204).end();
    } catch (e) {
      respond(res, e);
    }
  });
  router.get('/family/assets/:assetId/content', async (req, res) => {
    if (!service) return unavailable(res);
    try {
      const { asset, bytes } = await service.content(req.params.assetId);
      res
        .set({
          'X-Content-Type-Options': 'nosniff',
          'Content-Type': asset.contentType,
          'Content-Length': String(bytes.length),
          ETag: `"sha256-${asset.checksumSha256}"`,
          'Cache-Control': 'private, max-age=300',
        })
        .send(bytes);
    } catch (e) {
      respond(res, e);
    }
  });
  return router;
}
function unavailable(res: Response) {
  return res
    .status(503)
    .json({ code: 'FAMILY_ASSET_SERVICE_UNAVAILABLE', message: 'Сервіс спільних зображень недоступний.' });
}
function respond(res: Response, error: unknown) {
  if (error instanceof FamilyAssetError) {
    res.status(error.httpStatus).json({ code: error.code, message: error.message });
    return;
  }
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Не вдалося виконати дію зі спільним зображенням.' });
}
