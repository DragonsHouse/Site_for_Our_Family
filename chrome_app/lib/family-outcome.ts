export type AuthOutcomeCode =
  | 'authentication_required'
  | 'invalid_credentials'
  | 'session_invalid'
  | 'session_expired'
  | 'account_deactivated'
  | 'discord_link_required'
  | 'member_access_denied'
  | 'password_change_required'
  | 'auth_unavailable'
  | 'rate_limited'
  | 'password_too_weak'
  | 'oauth_retry_required';

export type AuthOnboardingState =
  | 'unauthenticated'
  | 'session_invalid'
  | 'session_expired'
  | 'account_deactivated'
  | 'discord_link_required'
  | 'member_access_denied'
  | 'password_change_required';

export type AuthOutcomeFailure = {
  httpStatus: number | null;
  legacyError: string | null;
  displayMessage: string;
  outcome: {
    code: AuthOutcomeCode;
    message: string;
    onboardingState?: AuthOnboardingState;
  };
};

export class AuthOutcomeError extends Error {
  readonly name = 'AuthOutcomeError';
  readonly failure: AuthOutcomeFailure;

  constructor(failure: AuthOutcomeFailure) {
    super(failure.displayMessage);
    this.failure = failure;
  }
}

const SAFE_FALLBACK_MESSAGES: Record<AuthOutcomeCode, string> = {
  authentication_required: 'Потрібно увійти до Family Hub.',
  invalid_credentials: 'Невірний login/static ID або пароль.',
  session_invalid: 'Сесія недійсна. Увійди ще раз.',
  session_expired: 'Сесія завершилась. Увійди ще раз.',
  account_deactivated: 'Доступ до цього профілю вимкнено.',
  discord_link_required: 'Цей Discord акаунт не прив’язаний для входу у Family Hub.',
  member_access_denied: 'Доступ через цей профіль зараз недоступний.',
  password_change_required: 'Потрібно змінити тимчасовий пароль.',
  auth_unavailable: 'Family Hub тимчасово не може перевірити доступ.',
  rate_limited: 'Забагато спроб входу. Спробуй трохи пізніше.',
  password_too_weak: 'Новий пароль занадто слабкий.',
  oauth_retry_required: 'Discord-вхід не вдалося завершити. Спробуй ще раз.',
};

const LEGACY_ERROR_OUTCOMES: Record<string, AuthOutcomeCode> = {
  session_required: 'authentication_required',
  invalid_credentials: 'invalid_credentials',
  session_invalid: 'session_invalid',
  session_expired: 'session_expired',
  account_disabled: 'account_deactivated',
  DISCORD_ACCOUNT_NOT_LINKED: 'discord_link_required',
  MEMBER_NOT_FOUND: 'discord_link_required',
  MEMBER_INACTIVE: 'account_deactivated',
  MEMBER_ACCESS_DENIED: 'member_access_denied',
  password_change_required: 'password_change_required',
  database_unavailable: 'auth_unavailable',
  OAUTH_DISABLED: 'auth_unavailable',
  login_rate_limited: 'rate_limited',
  rate_limited: 'rate_limited',
  password_too_weak: 'password_too_weak',
  OAUTH_STATE_INVALID: 'oauth_retry_required',
  OAUTH_STATE_EXPIRED: 'oauth_retry_required',
  OAUTH_STATE_ALREADY_USED: 'oauth_retry_required',
  OAUTH_CODE_EXCHANGE_FAILED: 'oauth_retry_required',
  DISCORD_IDENTITY_FAILED: 'oauth_retry_required',
  LOGIN_COMPLETION_EXPIRED: 'oauth_retry_required',
  LOGIN_COMPLETION_ALREADY_USED: 'oauth_retry_required',
  OAUTH_DENIED: 'oauth_retry_required',
  SESSION_CREATION_FAILED: 'auth_unavailable',
};

const HTTP_STATUS_OUTCOMES: Record<number, AuthOutcomeCode> = {
  401: 'authentication_required',
  403: 'member_access_denied',
  429: 'rate_limited',
  503: 'auth_unavailable',
};

export function normalizeAuthFailure(httpStatus: number | null, body: unknown): AuthOutcomeFailure {
  const record = isRecord(body) ? body : {};
  const outcomeRecord = isRecord(record.outcome) ? record.outcome : null;
  const outcomeCode = normalizeOutcomeCode(outcomeRecord?.code);
  const onboardingState = normalizeOnboardingState(outcomeRecord?.onboardingState);
  const legacyError = typeof record.error === 'string' ? record.error : null;
  const code =
    outcomeCode ??
    outcomeCodeFromOnboardingState(onboardingState) ??
    (legacyError ? LEGACY_ERROR_OUTCOMES[legacyError] : undefined) ??
    (httpStatus ? HTTP_STATUS_OUTCOMES[httpStatus] : undefined) ??
    'auth_unavailable';
  const displayMessage =
    typeof record.message === 'string' && record.message.trim() ? record.message : SAFE_FALLBACK_MESSAGES[code];
  const contractMessage =
    typeof outcomeRecord?.message === 'string' && outcomeRecord.message.trim()
      ? outcomeRecord.message
      : SAFE_FALLBACK_MESSAGES[code];

  return {
    httpStatus,
    legacyError,
    displayMessage,
    outcome: {
      code,
      message: contractMessage,
      ...(onboardingState ? { onboardingState } : {}),
    },
  };
}

export function normalizeNetworkAuthFailure(): AuthOutcomeFailure {
  return {
    httpStatus: null,
    legacyError: null,
    displayMessage: SAFE_FALLBACK_MESSAGES.auth_unavailable,
    outcome: {
      code: 'auth_unavailable',
      message: SAFE_FALLBACK_MESSAGES.auth_unavailable,
    },
  };
}

export function authOutcomeErrorFromUnknown(error: unknown): AuthOutcomeError {
  return error instanceof AuthOutcomeError ? error : new AuthOutcomeError(normalizeNetworkAuthFailure());
}

export function shouldClearAuthSessionForOutcome(code: AuthOutcomeCode): boolean {
  return ['authentication_required', 'session_invalid', 'session_expired', 'account_deactivated', 'member_access_denied'].includes(code);
}

function outcomeCodeFromOnboardingState(state: AuthOnboardingState | null): AuthOutcomeCode | undefined {
  if (!state) return undefined;
  if (state === 'unauthenticated') return 'authentication_required';
  if (state === 'password_change_required') return 'password_change_required';
  return state;
}

function normalizeOutcomeCode(value: unknown): AuthOutcomeCode | null {
  return typeof value === 'string' && value in SAFE_FALLBACK_MESSAGES ? (value as AuthOutcomeCode) : null;
}

function normalizeOnboardingState(value: unknown): AuthOnboardingState | null {
  const states: AuthOnboardingState[] = [
    'unauthenticated',
    'session_invalid',
    'session_expired',
    'account_deactivated',
    'discord_link_required',
    'member_access_denied',
    'password_change_required',
  ];
  return typeof value === 'string' && states.includes(value as AuthOnboardingState) ? (value as AuthOnboardingState) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
