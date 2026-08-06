import { createDiscordBackendClient } from './family-discord-backend-client';
import { readDiscordFamilySettings } from './family-discord-integration';
import type { FamilyPermission, FamilyRole } from './family-types';
import { assertAuthenticatedMember, type AuthenticatedMember } from './family-authenticated-member';
import {
  AuthOutcomeError,
  normalizeAuthFailure,
  shouldClearAuthSessionForOutcome,
} from './family-outcome';

export type { AuthenticatedMember } from './family-authenticated-member';

const SESSION_TOKEN_KEY = 'dragon_house_family_backend_session_token_v1';
const PERSISTENT_SESSION_TOKEN_KEY = 'dragon_house_family_backend_persistent_session_token_v1';
const AUTH_SESSION_MODE_KEY = 'dragon_house_family_backend_session_mode_v1';
const DEFAULT_BACKEND_API_BASE_URL = 'http://localhost:8787';
const DISCORD_LOGIN_REDIRECT_PATH = 'dragon-house-discord-login';
let memorySessionToken: string | null = null;
let memoryPersistentSessionToken: string | null = null;
let memoryAuthSessionMode: AuthSessionMode | null = null;

export type LegacyCreatedAuthUser = {
  familyMemberId: string;
  login: string;
  staticId: string;
  role: FamilyRole;
  rank: number;
  permissions: FamilyPermission[];
  mustChangePassword: boolean;
  loginProvider?: 'password' | 'discord' | 'nickname';
};

export type LoginResponse = {
  token: string;
  expiresAt: string;
  user: AuthenticatedMember;
};

export type AuthSessionMode = 'session' | 'persistent';

export class StaticIdValidationError extends Error {
  constructor(
    message: string,
    readonly fields: { staticId?: string } = {},
  ) {
    super(message);
    this.name = 'StaticIdValidationError';
  }
}

export class BirthdayValidationError extends Error {
  constructor(
    message: string,
    readonly fields: { dateOfBirth?: string } = {},
  ) {
    super(message);
    this.name = 'BirthdayValidationError';
  }
}

export function getBackendApiBaseUrl(): string {
  return readDiscordFamilySettings().backend.apiBaseUrl ?? DEFAULT_BACKEND_API_BASE_URL;
}

export async function getDiscordBackendRuntimeConfig() {
  const apiBaseUrl = getBackendApiBaseUrl();
  const client = createDiscordBackendClient(apiBaseUrl);
  const publicConfig = await client.getPublicConfig();
  return { apiBaseUrl, publicConfig };
}

export async function getSessionToken(): Promise<string | null> {
  const mode = await getAuthSessionMode();
  if (mode === 'persistent') {
    const token = await getPersistentSessionToken();
    if (!token) await clearAuthSession();
    return token;
  }
  if (mode === 'session') {
    const token = await getSessionOnlyToken();
    if (!token) await clearAuthSession();
    return token;
  }

  const sessionToken = await getSessionOnlyToken();
  if (sessionToken) return sessionToken;
  return getPersistentSessionToken();
}

async function getAuthSessionMode(): Promise<AuthSessionMode | null> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const result = await chrome.storage.local.get(AUTH_SESSION_MODE_KEY);
    if (result[AUTH_SESSION_MODE_KEY] === 'session' || result[AUTH_SESSION_MODE_KEY] === 'persistent') {
      return result[AUTH_SESSION_MODE_KEY];
    }
  }
  return memoryAuthSessionMode;
}

async function getSessionOnlyToken(): Promise<string | null> {
  if (typeof chrome !== 'undefined' && chrome.storage?.session) {
    const result = await chrome.storage.session.get(SESSION_TOKEN_KEY);
    if (typeof result[SESSION_TOKEN_KEY] === 'string') return result[SESSION_TOKEN_KEY];
  }
  return memorySessionToken;
}

async function getPersistentSessionToken(): Promise<string | null> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const result = await chrome.storage.local.get(PERSISTENT_SESSION_TOKEN_KEY);
    return typeof result[PERSISTENT_SESSION_TOKEN_KEY] === 'string' ? result[PERSISTENT_SESSION_TOKEN_KEY] : null;
  }
  return memoryPersistentSessionToken;
}

async function setSessionToken(token: string | null, mode: AuthSessionMode = 'session'): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.session) {
    if (token) {
      if (mode === 'session') await chrome.storage.session.set({ [SESSION_TOKEN_KEY]: token });
      else await chrome.storage.session.remove(SESSION_TOKEN_KEY);
    } else {
      await chrome.storage.session.remove(SESSION_TOKEN_KEY);
    }
  }
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    if (token && mode === 'persistent') {
      await chrome.storage.local.set({ [PERSISTENT_SESSION_TOKEN_KEY]: token });
    } else if (!token || mode === 'session') {
      await chrome.storage.local.remove(PERSISTENT_SESSION_TOKEN_KEY);
    }
    if (token) {
      await chrome.storage.local.set({ [AUTH_SESSION_MODE_KEY]: mode });
    } else {
      await chrome.storage.local.remove(AUTH_SESSION_MODE_KEY);
    }
  }
  if (mode === 'session') {
    memorySessionToken = token;
    if (token) memoryPersistentSessionToken = null;
  } else {
    memoryPersistentSessionToken = token;
    if (token) memorySessionToken = null;
  }
  memoryAuthSessionMode = token ? mode : null;
  if (!token) {
    memorySessionToken = null;
    memoryPersistentSessionToken = null;
    memoryAuthSessionMode = null;
  }
}

export async function clearAuthSession(): Promise<void> {
  await setSessionToken(null);
}

export async function authenticatedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getSessionToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(`${getBackendApiBaseUrl().replace(/\/+$/u, '')}${path}`, {
    ...init,
    headers,
    credentials: 'omit',
  });
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    const failure = normalizeAuthFailure(response.status, body);
    if (response.status === 401 && shouldClearAuthSessionForOutcome(failure.outcome.code)) await setSessionToken(null);
    throw new AuthOutcomeError(failure);
  }
  return (await response.json()) as T;
}

async function parseAuthenticatedMemberResponse(response: Response): Promise<AuthenticatedMember> {
  return assertAuthenticatedMember(await parseJsonResponse<unknown>(response));
}

async function parseLoginResponse(response: Response): Promise<LoginResponse> {
  const body = await parseJsonResponse<unknown>(response);
  if (!isRecord(body) || typeof body.token !== 'string' || typeof body.expiresAt !== 'string') {
    throw new Error('Family auth response was malformed');
  }
  return {
    token: body.token,
    expiresAt: body.expiresAt,
    user: assertAuthenticatedMember(body.user),
  };
}

export async function login(loginOrStaticId: string, password: string, rememberMe = false): Promise<LoginResponse> {
  const response = await fetch(`${getBackendApiBaseUrl().replace(/\/+$/u, '')}/api/auth/login`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ loginOrStaticId, password, rememberMe }),
  });
  const result = await parseLoginResponse(response);
  await setSessionToken(result.token, rememberMe ? 'persistent' : 'session');
  return result;
}

export async function loginWithNickname(nickname: string, rememberMe = true): Promise<LoginResponse> {
  const response = await fetch(`${getBackendApiBaseUrl().replace(/\/+$/u, '')}/api/auth/nickname-login`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ nickname, rememberMe }),
  });
  const result = await parseLoginResponse(response);
  await setSessionToken(result.token, rememberMe ? 'persistent' : 'session');
  return result;
}

export function getDiscordLoginCompletionRedirectUrl(): string | null {
  if (typeof chrome !== 'undefined' && chrome.identity?.getRedirectURL) {
    return chrome.identity.getRedirectURL(DISCORD_LOGIN_REDIRECT_PATH);
  }
  return null;
}

export async function startDiscordLogin(redirectTarget: string | null = getDiscordLoginCompletionRedirectUrl()): Promise<{ authorizationUrl: string; expiresAt: string }> {
  return parseJsonResponse<{ authorizationUrl: string; expiresAt: string }>(
    await fetch(`${getBackendApiBaseUrl().replace(/\/+$/u, '')}/api/auth/discord/start`, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ clientType: 'chrome_extension', ...(redirectTarget ? { redirectTarget } : {}) }),
    }),
  );
}

export async function completeDiscordLogin(completionCode: string): Promise<LoginResponse> {
  const result = await parseLoginResponse(
    await fetch(`${getBackendApiBaseUrl().replace(/\/+$/u, '')}/api/auth/discord/complete`, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ completionCode, clientType: 'chrome_extension' }),
    }),
  );
  await setSessionToken(result.token, 'session');
  return result;
}

export async function loginWithDiscord(): Promise<LoginResponse> {
  if (typeof chrome === 'undefined' || !chrome.identity?.launchWebAuthFlow) {
    throw new AuthOutcomeError(normalizeAuthFailure(503, { error: 'OAUTH_DISABLED' }));
  }
  const redirectTarget = getDiscordLoginCompletionRedirectUrl();
  if (!redirectTarget) throw new AuthOutcomeError(normalizeAuthFailure(503, { error: 'OAUTH_DISABLED' }));
  const start = await startDiscordLogin(redirectTarget);
  const finalUrl = await chrome.identity.launchWebAuthFlow({
    url: start.authorizationUrl,
    interactive: true,
  });
  if (!finalUrl) throw new AuthOutcomeError(normalizeAuthFailure(400, { error: 'OAUTH_DENIED' }));
  const url = new URL(finalUrl);
  const status = url.searchParams.get('discordLoginStatus');
  const error = url.searchParams.get('error');
  if (status === 'error' || error) {
    throw new AuthOutcomeError(normalizeAuthFailure(400, { error: error ?? 'OAUTH_STATE_INVALID' }));
  }
  const completionCode = url.searchParams.get('completionCode');
  if (!completionCode) throw new AuthOutcomeError(normalizeAuthFailure(400, { error: 'LOGIN_COMPLETION_EXPIRED' }));
  return completeDiscordLogin(completionCode);
}

export async function getCurrentUser(): Promise<AuthenticatedMember> {
  return parseAuthenticatedMemberResponse(await authenticatedFetch('/api/auth/me', { method: 'GET' }));
}

export async function restoreCurrentAuthSession(): Promise<AuthenticatedMember | null> {
  const token = await getSessionToken();
  if (!token) return null;
  try {
    return await getCurrentUser();
  } catch (error) {
    if (error instanceof AuthOutcomeError && shouldClearAuthSessionForOutcome(error.failure.outcome.code)) {
      await clearAuthSession();
    }
    throw error;
  }
}

export async function logout(): Promise<void> {
  const response = await authenticatedFetch('/api/auth/logout', { method: 'POST' });
  await setSessionToken(null);
  if (!response.ok && response.status !== 401) {
    throw new Error(`Family logout failed: ${response.status}`);
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<AuthenticatedMember> {
  return parseAuthenticatedMemberResponse(
    await authenticatedFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  );
}

export async function updateCurrentStaticId(staticId: string): Promise<AuthenticatedMember> {
  const response = await authenticatedFetch('/api/family/me/static-id', {
    method: 'POST',
    body: JSON.stringify({ staticId }),
  });
  if (response.ok) return assertAuthenticatedMember(await response.json());

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (isRecord(body) && body.error === 'invalid_static_id') {
    const fields = isRecord(body.fields) && typeof body.fields.staticId === 'string' ? { staticId: body.fields.staticId } : {};
    throw new StaticIdValidationError(typeof body.message === 'string' ? body.message : 'Static ID is invalid', fields);
  }

  const failure = normalizeAuthFailure(response.status, body);
  if (response.status === 401 && shouldClearAuthSessionForOutcome(failure.outcome.code)) await clearAuthSession();
  throw new AuthOutcomeError(failure);
}

export async function updateCurrentBirthday(dateOfBirth: string): Promise<AuthenticatedMember> {
  const response = await authenticatedFetch('/api/family/me/birthday', {
    method: 'PATCH',
    body: JSON.stringify({ dateOfBirth }),
  });
  if (response.ok) return assertAuthenticatedMember(await response.json());

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (isRecord(body) && body.error === 'invalid_birthday') {
    const fields = isRecord(body.fields) && typeof body.fields.dateOfBirth === 'string' ? { dateOfBirth: body.fields.dateOfBirth } : {};
    throw new BirthdayValidationError(typeof body.message === 'string' ? body.message : 'Date of birth is invalid', fields);
  }

  const failure = normalizeAuthFailure(response.status, body);
  if (response.status === 401 && shouldClearAuthSessionForOutcome(failure.outcome.code)) await clearAuthSession();
  throw new AuthOutcomeError(failure);
}

export async function createAuthUser(input: {
  familyMemberId: string;
  login: string;
  staticId: string;
  role: FamilyRole;
  rank: number;
  permissions: FamilyPermission[];
  isActive: boolean;
}): Promise<LegacyCreatedAuthUser> {
  return parseJsonResponse<LegacyCreatedAuthUser>(
    await authenticatedFetch('/api/auth/users', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export function createAuthenticatedDiscordBackendClient() {
  const baseClient = createDiscordBackendClient(getBackendApiBaseUrl(), authenticatedFetch);
  return baseClient;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
