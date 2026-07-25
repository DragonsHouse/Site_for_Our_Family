import type { DiscordBackendRequestErrorCode } from './family-discord-backend-client.ts';
import { DiscordBackendRequestError } from './family-discord-backend-client.ts';
import type { DiscordAccountLink, FamilyUser } from './family-types.ts';

export type DiscordLinkFlowState =
  | { status: 'unlinked'; message?: string | null }
  | { status: 'starting'; message?: string | null }
  | { status: 'awaiting_oauth'; expiresAt: string; message: string }
  | { status: 'completing'; message: string }
  | { status: 'linked'; link: DiscordAccountLink | null; message?: string | null }
  | { status: 'conflict'; message: string }
  | { status: 'failed'; message: string }
  | { status: 'unavailable'; message: string };

export type DiscordLinkFailure = {
  code: DiscordBackendRequestErrorCode;
  message: string;
  status: number | null;
};

const FALLBACK_MESSAGES: Record<DiscordBackendRequestErrorCode, string> = {
  discord_oauth_not_configured: 'Discord OAuth ще не налаштовано для прив’язки.',
  discord_oauth_state_invalid: 'Запит прив’язки недійсний. Спробуй почати ще раз.',
  discord_oauth_state_expired: 'Запит прив’язки застарів. Спробуй почати ще раз.',
  discord_oauth_state_consumed: 'Цей запит прив’язки вже використано. Спробуй почати ще раз.',
  discord_oauth_denied: 'Discord прив’язку було скасовано.',
  discord_token_exchange_failed: 'Discord тимчасово не завершив прив’язку. Спробуй ще раз.',
  discord_user_fetch_failed: 'Не вдалося отримати Discord профіль. Спробуй ще раз.',
  discord_guild_membership_required: 'Цей Discord акаунт не може бути прив’язаний для Family Hub.',
  discord_account_already_linked: 'Цей Family Hub профіль уже має прив’язаний Discord.',
  discord_account_linked_elsewhere: 'Цей Discord акаунт уже прив’язаний до іншого Family Hub профілю.',
  family_member_inactive: 'Цей Family Hub профіль зараз неактивний.',
  family_auth_required: 'Потрібна активна Family Hub сесія.',
  discord_link_failed: 'Не вдалося завершити Discord прив’язку. Спробуй ще раз.',
};

export function discordLinkStateFromUser(user: FamilyUser): DiscordLinkFlowState {
  return user.discordLinkStatus === 'linked' || Boolean(user.discordUserId)
    ? { status: 'linked', link: null }
    : { status: 'unlinked', message: null };
}

export function normalizeDiscordLinkFailure(error: unknown): DiscordLinkFailure {
  if (error instanceof DiscordBackendRequestError) {
    return {
      code: error.code,
      message: safeMessage(error.code, error.message),
      status: error.status,
    };
  }
  return {
    code: 'discord_link_failed',
    message: FALLBACK_MESSAGES.discord_link_failed,
    status: null,
  };
}

export function discordLinkStateForFailure(error: unknown): DiscordLinkFlowState {
  const failure = normalizeDiscordLinkFailure(error);
  if (failure.code === 'discord_account_already_linked' || failure.code === 'discord_account_linked_elsewhere') {
    return { status: 'conflict', message: failure.message };
  }
  if (
    failure.code === 'discord_oauth_not_configured' ||
    failure.code === 'discord_token_exchange_failed' ||
    failure.code === 'discord_user_fetch_failed' ||
    failure.code === 'discord_link_failed'
  ) {
    return { status: 'unavailable', message: failure.message };
  }
  return { status: 'failed', message: failure.message };
}

export function discordLinkStateForCallback(status: string | null, error: string | null): DiscordLinkFlowState | null {
  if (status === 'success') return { status: 'completing', message: 'Discord прив’язано. Оновлюємо Family Hub профіль.' };
  if (status !== 'error') return null;
  return discordLinkStateForFailure(new DiscordBackendRequestError(400, normalizeCallbackErrorCode(error), FALLBACK_MESSAGES[normalizeCallbackErrorCode(error)]));
}

function normalizeCallbackErrorCode(value: string | null): DiscordBackendRequestErrorCode {
  const knownCodes = Object.keys(FALLBACK_MESSAGES);
  return value && knownCodes.includes(value) ? (value as DiscordBackendRequestErrorCode) : 'discord_link_failed';
}

function safeMessage(code: DiscordBackendRequestErrorCode, message: string): string {
  return message.trim() || FALLBACK_MESSAGES[code];
}
