import type { AuthOutcomeCode, AuthOutcomeFailure } from './family-outcome.ts';
import { authOutcomeErrorFromUnknown } from './family-outcome.ts';
import type { FamilyUser } from './family-types.ts';

export type AuthUnavailableRetryTarget = 'restore' | 'login' | 'discord';

export type FamilyHubAuthState =
  | { status: 'checking' }
  | { status: 'unauthenticated'; message?: string | null }
  | { status: 'authenticating' }
  | { status: 'oauth_loading' }
  | { status: 'oauth_success'; user: FamilyUser }
  | { status: 'authenticated'; user: FamilyUser }
  | { status: 'change_password_required'; user: FamilyUser | null; message?: string }
  | { status: 'loading'; user: FamilyUser }
  | { status: 'session_expired'; message: string }
  | { status: 'discord_link_required'; message: string }
  | { status: 'account_deactivated'; message: string }
  | { status: 'member_access_denied'; message: string }
  | { status: 'auth_unavailable'; message: string; retryTarget: AuthUnavailableRetryTarget };

export type LoginFailureRoute =
  | { kind: 'inline_error'; message: string }
  | { kind: 'screen'; state: FamilyHubAuthState };

export type RestoreFailureRoute = {
  state: FamilyHubAuthState;
  clearAuthSession: boolean;
};

export function userFromAuthState(state: FamilyHubAuthState): FamilyUser | null {
  return 'user' in state ? state.user : null;
}

export function stateForAuthenticatedUser(user: FamilyUser, entry: 'restore' | 'login' | 'discord' | 'password-change'): FamilyHubAuthState {
  if (user.mustChangePassword) return { status: 'change_password_required', user };
  if (entry === 'login' || entry === 'password-change') return { status: 'loading', user };
  if (entry === 'discord') return { status: 'oauth_success', user };
  return { status: 'authenticated', user };
}

export function routeRestoreFailure(error: unknown): RestoreFailureRoute {
  const failure = authOutcomeErrorFromUnknown(error).failure;
  const state = stateForFailure(failure, { fallback: 'auth_unavailable', retryTarget: 'restore' });
  return {
    state,
    clearAuthSession: ['authentication_required', 'session_invalid', 'session_expired', 'account_deactivated', 'member_access_denied'].includes(
      failure.outcome.code,
    ),
  };
}

export function routePasswordLoginFailure(error: unknown): LoginFailureRoute {
  const failure = authOutcomeErrorFromUnknown(error).failure;
  if (isInlineLoginOutcome(failure.outcome.code)) return { kind: 'inline_error', message: failure.displayMessage };
  return { kind: 'screen', state: stateForFailure(failure, { fallback: 'auth_unavailable', retryTarget: 'login' }) };
}

export function routeDiscordLoginFailure(error: unknown): LoginFailureRoute {
  const failure = authOutcomeErrorFromUnknown(error).failure;
  if (failure.outcome.code === 'oauth_retry_required') return { kind: 'inline_error', message: failure.displayMessage };
  return { kind: 'screen', state: stateForFailure(failure, { fallback: 'auth_unavailable', retryTarget: 'discord' }) };
}

function stateForFailure(
  failure: AuthOutcomeFailure,
  options: { fallback: 'unauthenticated' | 'auth_unavailable'; retryTarget: AuthUnavailableRetryTarget },
): FamilyHubAuthState {
  switch (failure.outcome.code) {
    case 'authentication_required':
    case 'session_invalid':
      return { status: 'unauthenticated', message: null };
    case 'session_expired':
      return { status: 'session_expired', message: failure.displayMessage };
    case 'discord_link_required':
      return { status: 'discord_link_required', message: failure.displayMessage };
    case 'account_deactivated':
      return { status: 'account_deactivated', message: failure.displayMessage };
    case 'member_access_denied':
      return { status: 'member_access_denied', message: failure.displayMessage };
    case 'password_change_required':
      return { status: 'change_password_required', user: null, message: failure.displayMessage };
    case 'auth_unavailable':
      return { status: 'auth_unavailable', message: failure.displayMessage, retryTarget: options.retryTarget };
    default:
      return options.fallback === 'unauthenticated'
        ? { status: 'unauthenticated', message: failure.displayMessage }
        : { status: 'auth_unavailable', message: failure.displayMessage, retryTarget: options.retryTarget };
  }
}

function isInlineLoginOutcome(code: AuthOutcomeCode): boolean {
  return code === 'invalid_credentials' || code === 'rate_limited' || code === 'password_too_weak' || code === 'oauth_retry_required';
}
