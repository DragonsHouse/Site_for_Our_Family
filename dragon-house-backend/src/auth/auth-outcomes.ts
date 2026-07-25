import type { Response } from 'express';
import type { DiscordOAuthLoginErrorCode } from './discord-oauth-login-service.js';
import type { FamilyAuthErrorCode } from '../types.js';

export type AuthOnboardingState =
  | 'unauthenticated'
  | 'session_invalid'
  | 'session_expired'
  | 'account_deactivated'
  | 'discord_link_required'
  | 'member_access_denied'
  | 'password_change_required';

export type AuthOutcomeCode =
  /** No bearer token or authenticated Family Hub session was provided. */
  | 'authentication_required'
  /** Login/static ID and password did not authenticate. Does not reveal which field was wrong. */
  | 'invalid_credentials'
  /** Bearer token is unknown, revoked, malformed, or no longer attached to a valid session. */
  | 'session_invalid'
  /** Bearer token matched a session whose expiry has passed. */
  | 'session_expired'
  /** The resolved Family Hub account/member is inactive, deleted, or disabled. */
  | 'account_deactivated'
  /** Discord identity is valid, but no usable Family Hub Discord link exists. */
  | 'discord_link_required'
  /** Linked Discord/member exists, but policy blocks access. */
  | 'member_access_denied'
  /** Authentication succeeded, but the member must change a temporary password before protected actions. */
  | 'password_change_required'
  /** Backend auth storage or OAuth provider is unavailable/configuration-blocked. */
  | 'auth_unavailable'
  /** Request is temporarily rate limited. */
  | 'rate_limited'
  /** Password change payload failed public validation. */
  | 'password_too_weak'
  /** OAuth attempt is invalid, expired, denied, replayed, or must be restarted. */
  | 'oauth_retry_required';

export type AuthOutcome = {
  code: AuthOutcomeCode;
  message: string;
  onboardingState?: AuthOnboardingState;
};

export type AuthOutcomeResponseBody = {
  error: string;
  message: string;
  outcome: AuthOutcome;
};

const OUTCOME_MESSAGES: Record<AuthOutcomeCode, string> = {
  authentication_required: 'Authentication required.',
  invalid_credentials: 'Invalid login/static ID or password.',
  session_invalid: 'Session is invalid.',
  session_expired: 'Session expired.',
  account_deactivated: 'Account is deactivated.',
  discord_link_required: 'Discord account must be linked before Family Hub login.',
  member_access_denied: 'Member access is denied.',
  password_change_required: 'Password change is required.',
  auth_unavailable: 'Authentication is unavailable.',
  rate_limited: 'Too many attempts. Try again later.',
  password_too_weak: 'Password is too weak.',
  oauth_retry_required: 'OAuth login must be restarted.',
};

const ONBOARDING_STATES: Partial<Record<AuthOutcomeCode, AuthOnboardingState>> = {
  authentication_required: 'unauthenticated',
  session_invalid: 'session_invalid',
  session_expired: 'session_expired',
  account_deactivated: 'account_deactivated',
  discord_link_required: 'discord_link_required',
  member_access_denied: 'member_access_denied',
  password_change_required: 'password_change_required',
};

const FAMILY_AUTH_OUTCOMES: Record<FamilyAuthErrorCode, AuthOutcomeCode> = {
  invalid_credentials: 'invalid_credentials',
  account_disabled: 'account_deactivated',
  session_required: 'authentication_required',
  session_invalid: 'session_invalid',
  session_expired: 'session_expired',
  password_change_required: 'password_change_required',
  current_password_invalid: 'invalid_credentials',
  password_too_weak: 'password_too_weak',
  login_rate_limited: 'rate_limited',
  database_unavailable: 'auth_unavailable',
};

const DISCORD_LOGIN_OUTCOMES: Record<DiscordOAuthLoginErrorCode, AuthOutcomeCode> = {
  OAUTH_DISABLED: 'auth_unavailable',
  OAUTH_STATE_INVALID: 'oauth_retry_required',
  OAUTH_STATE_EXPIRED: 'oauth_retry_required',
  OAUTH_STATE_ALREADY_USED: 'oauth_retry_required',
  OAUTH_CODE_EXCHANGE_FAILED: 'oauth_retry_required',
  DISCORD_IDENTITY_FAILED: 'oauth_retry_required',
  DISCORD_ACCOUNT_NOT_LINKED: 'discord_link_required',
  MEMBER_NOT_FOUND: 'discord_link_required',
  MEMBER_INACTIVE: 'account_deactivated',
  MEMBER_ACCESS_DENIED: 'member_access_denied',
  LOGIN_COMPLETION_EXPIRED: 'oauth_retry_required',
  LOGIN_COMPLETION_ALREADY_USED: 'oauth_retry_required',
  SESSION_CREATION_FAILED: 'auth_unavailable',
  OAUTH_DENIED: 'oauth_retry_required',
};

export function createAuthOutcome(code: AuthOutcomeCode, message = OUTCOME_MESSAGES[code]): AuthOutcome {
  return {
    code,
    message,
    ...(ONBOARDING_STATES[code] ? { onboardingState: ONBOARDING_STATES[code] } : {}),
  };
}

export function familyAuthOutcomeCode(code: FamilyAuthErrorCode): AuthOutcomeCode {
  return FAMILY_AUTH_OUTCOMES[code];
}

export function discordLoginOutcomeCode(code: DiscordOAuthLoginErrorCode): AuthOutcomeCode {
  return DISCORD_LOGIN_OUTCOMES[code];
}

export function authOutcomeBody(error: string, message: string, outcomeCode: AuthOutcomeCode): AuthOutcomeResponseBody {
  return {
    error,
    message,
    outcome: createAuthOutcome(outcomeCode),
  };
}

export function sendAuthOutcome(
  response: Response,
  status: number,
  error: string,
  message: string,
  outcomeCode: AuthOutcomeCode,
): void {
  response.status(status).json(authOutcomeBody(error, message, outcomeCode));
}
