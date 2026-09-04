import { Router } from 'express';
import { z } from 'zod';
import type { FamilyAuthService } from '../auth/auth-service.js';
import type { FamilyCalendarService } from '../calendar/family-calendar-service.js';
import type { AppConfig } from '../config/env.js';
import { requireFamilyAuthContext } from '../middleware/family-auth-context.js';

const calendarQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  sourceModule: z.enum(['family_events', 'tower_defense', 'family_quests', 'all']).optional(),
});

export function createFamilyCalendarRouter(
  config: AppConfig,
  authService: FamilyAuthService | null,
  familyCalendarService: FamilyCalendarService | null,
): Router {
  const router = Router();
  const requireAuth = requireFamilyAuthContext(config, authService);
  router.use('/family/calendar', requireAuth);

  router.get('/family/calendar', async (request, response) => {
    if (!familyCalendarService || !request.familyAuth) {
      response.status(503).json({ code: 'FAMILY_CALENDAR_SERVICE_UNAVAILABLE', message: 'Family calendar service is unavailable.', details: {} });
      return;
    }
    const parsed = calendarQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      response.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid request.', details: { summary: parsed.error.message } });
      return;
    }
    response.json(await familyCalendarService.listCalendar({
      from: parsed.data.from ?? null,
      to: parsed.data.to ?? null,
      sourceModule: parsed.data.sourceModule ?? null,
    }, request.familyAuth));
  });

  return router;
}
