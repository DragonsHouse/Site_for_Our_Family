import { Router } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../config/env.js';
import { DiscordOAuthLoginError, type DiscordOAuthLoginService } from '../auth/discord-oauth-login-service.js';
import { createLogger } from '../logging/logger.js';
import { createAnonymousRateLimit } from '../middleware/rate-limit.js';

const StartSchema = z.object({
  clientType: z.enum(['web', 'chrome_extension']).optional().default('chrome_extension'),
  redirectTarget: z.string().url().optional(),
});

const CompleteSchema = z.object({
  completionCode: z.string().trim().min(24).max(256),
  clientType: z.enum(['web', 'chrome_extension']).optional(),
});

export function createDiscordAuthRouter(config: AppConfig, oauthLoginService: DiscordOAuthLoginService | null): Router {
  const router = Router();
  const logger = createLogger(config);
  const startLimit = createAnonymousRateLimit({
    name: 'discord_oauth_start',
    limit: config.discord.oauth.startRateLimitPerMinute,
    windowMs: 60_000,
    logger,
  });
  const completeLimit = createAnonymousRateLimit({
    name: 'discord_oauth_complete',
    limit: config.discord.oauth.completeRateLimitPerMinute,
    windowMs: 60_000,
    logger,
  });

  router.post('/auth/discord/start', startLimit, async (request, response) => {
    if (!oauthLoginService) return response.status(503).json(safeErrorBody('OAUTH_DISABLED'));
    const parsed = StartSchema.safeParse(request.body ?? {});
    if (!parsed.success) return response.status(400).json(safeErrorBody('OAUTH_STATE_INVALID'));
    try {
      response.json(await oauthLoginService.start(parsed.data));
    } catch (error) {
      respondWithOAuthLoginError(response, error);
    }
  });

  router.get('/auth/discord/callback', startLimit, async (request, response) => {
    if (!oauthLoginService) return sendCompletionPage(response.status(503), null, 'OAUTH_DISABLED');
    const code = typeof request.query.code === 'string' ? request.query.code : undefined;
    const state = typeof request.query.state === 'string' ? request.query.state : undefined;
    const providerError = typeof request.query.error === 'string' ? request.query.error : undefined;
    try {
      logger.info('discord_oauth_callback_received');
      const result = await oauthLoginService.callback({ code, state, error: providerError });
      const redirectUrl = new URL(result.redirectTarget);
      redirectUrl.searchParams.set('discordLoginStatus', 'success');
      redirectUrl.searchParams.set('completionCode', result.completionCode);
      response.redirect(302, redirectUrl.toString());
    } catch (error) {
      const safeError = toSafeOAuthLoginError(error);
      logger.warn('discord_oauth_login_failed', { errorCode: safeError.code, httpStatus: safeError.httpStatus });
      const redirectTarget = config.discord.oauth.loginErrorRedirectUri;
      if (redirectTarget) {
        const redirectUrl = new URL(redirectTarget);
        redirectUrl.searchParams.set('discordLoginStatus', 'error');
        redirectUrl.searchParams.set('error', safeError.code);
        response.redirect(302, redirectUrl.toString());
        return;
      }
      sendCompletionPage(response.status(safeError.httpStatus), null, safeError.code);
    }
  });

  router.post('/auth/discord/complete', completeLimit, async (request, response) => {
    if (!oauthLoginService) return response.status(503).json(safeErrorBody('OAUTH_DISABLED'));
    const parsed = CompleteSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json(safeErrorBody('LOGIN_COMPLETION_EXPIRED'));
    try {
      response.json(await oauthLoginService.complete(parsed.data));
    } catch (error) {
      respondWithOAuthLoginError(response, error);
    }
  });

  return router;
}

function respondWithOAuthLoginError(response: import('express').Response, error: unknown): void {
  const safeError = toSafeOAuthLoginError(error);
  response.status(safeError.httpStatus).json(safeErrorBody(safeError.code));
}

function toSafeOAuthLoginError(error: unknown): { code: DiscordOAuthLoginError['code']; httpStatus: number } {
  if (error instanceof DiscordOAuthLoginError) return { code: error.code, httpStatus: error.httpStatus };
  return { code: 'SESSION_CREATION_FAILED', httpStatus: 500 };
}

function safeErrorBody(code: DiscordOAuthLoginError['code']): { error: string; message: string } {
  return { error: code, message: userSafeMessage(code) };
}

function userSafeMessage(code: DiscordOAuthLoginError['code']): string {
  const messages: Record<DiscordOAuthLoginError['code'], string> = {
    OAUTH_DISABLED: 'Discord login is not configured yet.',
    OAUTH_STATE_INVALID: 'Discord login attempt is invalid. Please try again.',
    OAUTH_STATE_EXPIRED: 'Discord login attempt expired. Please try again.',
    OAUTH_STATE_ALREADY_USED: 'Discord login attempt was already used. Please start again.',
    OAUTH_CODE_EXCHANGE_FAILED: 'Discord login could not be completed.',
    DISCORD_IDENTITY_FAILED: 'Discord profile could not be verified.',
    DISCORD_ACCOUNT_NOT_LINKED: 'Your Discord account is not provisioned in Family Hub yet. Contact administration.',
    MEMBER_NOT_FOUND: 'Family Hub profile was not found. Contact administration.',
    MEMBER_INACTIVE: 'This Family Hub profile is inactive.',
    MEMBER_ACCESS_DENIED: 'This Family Hub profile cannot log in right now.',
    LOGIN_COMPLETION_EXPIRED: 'Discord login completion expired. Please try again.',
    LOGIN_COMPLETION_ALREADY_USED: 'Discord login completion was already used. Please start again.',
    SESSION_CREATION_FAILED: 'Family Hub session could not be created.',
    OAUTH_DENIED: 'Discord login was cancelled or denied.',
  };
  return messages[code];
}

function sendCompletionPage(response: import('express').Response, completionCode: string | null, errorCode?: DiscordOAuthLoginError['code']): void {
  response.type('html').send(`<!doctype html>
<html lang="uk">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Dragon House Discord Login</title></head>
  <body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#090909;color:#f8fafc;font-family:system-ui,sans-serif">
    <main style="max-width:520px;padding:24px;border:1px solid rgba(245,158,11,.35);border-radius:16px;background:#111827">
      <h1 style="margin-top:0">${errorCode ? 'Discord login failed' : 'Discord login ready'}</h1>
      <p>${errorCode ? userSafeMessage(errorCode) : 'Return to Dragon House Family Hub to finish login.'}</p>
      ${completionCode ? '<p>Login completion is ready.</p>' : ''}
    </main>
  </body>
</html>`);
}
