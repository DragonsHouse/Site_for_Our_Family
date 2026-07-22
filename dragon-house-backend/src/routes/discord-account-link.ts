import { Router } from 'express';
import type { AppConfig } from '../config/env.js';
import {
  DiscordAccountLinkOAuthError,
  type DiscordAccountLinkOAuthService,
} from '../discord/discord-account-link-oauth-service.js';
import type { DiscordAccountLinkRepository } from '../discord/account-link-repository.js';
import type { FamilyAuthService } from '../auth/auth-service.js';
import { requireFamilyAuthContext } from '../middleware/family-auth-context.js';
import type { DiscordAccountLinkErrorCode } from '../types.js';

export function createDiscordAccountLinkRouter(
  config: AppConfig,
  accountLinks: DiscordAccountLinkRepository,
  accountLinkOAuthService: DiscordAccountLinkOAuthService,
  authService: FamilyAuthService | null,
): Router {
  const router = Router();
  const requireAuth = requireFamilyAuthContext(config, authService);

  router.get('/discord/account-link', requireAuth, async (request, response) => {
    const familyMemberId = request.familyAuth?.familyMemberId;
    if (!familyMemberId) {
      response.status(401).json({ error: 'unauthorized' });
      return;
    }
    response.json(await accountLinks.getByFamilyMemberId(familyMemberId));
  });

  router.post('/discord/account-link/start', requireAuth, async (request, response) => {
    const familyMemberId = request.familyAuth?.familyMemberId;
    if (!familyMemberId) {
      response.status(401).json({ error: 'family_auth_required' });
      return;
    }

    try {
      response.json(await accountLinkOAuthService.start(familyMemberId));
    } catch (error) {
      respondWithOAuthError(response, error);
    }
  });

  router.get('/discord/account-link/callback', async (request, response) => {
    const code = typeof request.query.code === 'string' ? request.query.code : undefined;
    const state = typeof request.query.state === 'string' ? request.query.state : undefined;
    const error = typeof request.query.error === 'string' ? request.query.error : undefined;

    try {
      await accountLinkOAuthService.complete({ code, state, error });
      sendCallbackResult(response, config.discord.oauthSuccessRedirectUri, {
        title: 'Discord прив’язано',
        message: 'Discord успішно прив’язано. Можете повернутися у Family Hub.',
      });
    } catch (caughtError) {
      const safeError = toSafeOAuthError(caughtError);
      sendCallbackResult(response.status(safeError.httpStatus), config.discord.oauthErrorRedirectUri, {
        title: 'Discord не прив’язано',
        message: userSafeMessage(safeError.code),
        code: safeError.code,
      });
    }
  });

  router.delete('/discord/account-link', requireAuth, async (request, response) => {
    const familyMemberId = request.familyAuth?.familyMemberId;
    if (!familyMemberId) {
      response.status(401).json({ error: 'unauthorized' });
      return;
    }

    await accountLinks.deleteByFamilyMemberId(familyMemberId);
    response.status(204).send();
  });

  return router;
}

function respondWithOAuthError(
  response: import('express').Response,
  error: unknown,
): void {
  const safeError = toSafeOAuthError(error);
  response.status(safeError.httpStatus).json({
    error: safeError.code,
    message: userSafeMessage(safeError.code),
  });
}

function toSafeOAuthError(error: unknown): { code: DiscordAccountLinkErrorCode; httpStatus: number } {
  if (error instanceof DiscordAccountLinkOAuthError) {
    return { code: error.code, httpStatus: error.httpStatus };
  }
  return { code: 'discord_token_exchange_failed', httpStatus: 502 };
}

function userSafeMessage(code: DiscordAccountLinkErrorCode): string {
  const messages: Record<DiscordAccountLinkErrorCode, string> = {
    discord_oauth_not_configured: 'Discord OAuth ще не налаштовано на backend.',
    discord_oauth_state_invalid: 'OAuth state недійсний. Спробуйте почати прив’язку ще раз.',
    discord_oauth_state_expired: 'OAuth state застарів. Спробуйте почати прив’язку ще раз.',
    discord_oauth_state_consumed: 'Цей OAuth state уже використано. Спробуйте почати прив’язку ще раз.',
    discord_oauth_denied: 'Discord OAuth було скасовано або відхилено.',
    discord_token_exchange_failed: 'Не вдалося завершити Discord OAuth.',
    discord_user_fetch_failed: 'Не вдалося отримати Discord profile.',
    discord_guild_membership_required: 'Ваш Discord-акаунт не є учасником сервера Dragon House.',
    discord_account_already_linked: 'Цей Family Hub користувач уже має прив’язаний Discord.',
    discord_account_linked_elsewhere: 'Цей Discord-акаунт уже прив’язаний до іншого користувача Family Hub.',
    family_auth_required: 'Потрібна авторизація Family Hub.',
  };
  return messages[code];
}

function sendCallbackResult(
  response: import('express').Response,
  redirectUri: string | null,
  result: { title: string; message: string; code?: DiscordAccountLinkErrorCode },
): void {
  if (redirectUri) {
    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set('discordLinkStatus', result.code ? 'error' : 'success');
    if (result.code) redirectUrl.searchParams.set('error', result.code);
    response.redirect(302, redirectUrl.toString());
    return;
  }

  response.type('html').send(`<!doctype html>
<html lang="uk">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(result.title)}</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #090909; color: #f8fafc; font-family: system-ui, sans-serif; }
      main { width: min(92vw, 520px); border: 1px solid rgba(245, 158, 11, .32); border-radius: 18px; background: rgba(15, 23, 42, .84); padding: 24px; box-shadow: 0 24px 80px rgba(0, 0, 0, .45); }
      h1 { margin: 0 0 10px; font-size: 24px; }
      p { margin: 0; color: #cbd5e1; line-height: 1.55; }
      code { display: inline-block; margin-top: 14px; color: #fbbf24; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(result.title)}</h1>
      <p>${escapeHtml(result.message)}</p>
      ${result.code ? `<code>${escapeHtml(result.code)}</code>` : ''}
    </main>
  </body>
</html>`);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}
