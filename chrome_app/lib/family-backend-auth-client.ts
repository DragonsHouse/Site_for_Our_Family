import { createDiscordBackendClient } from './family-discord-backend-client';
import { readDiscordFamilySettings } from './family-discord-integration';
import type { FamilyPermission, FamilyRole } from './family-types';

const SESSION_TOKEN_KEY = 'dragon_house_family_backend_session_token_v1';
const PERSISTENT_SESSION_TOKEN_KEY = 'dragon_house_family_backend_persistent_session_token_v1';
const DEFAULT_BACKEND_API_BASE_URL = 'http://localhost:8787';
const DISCORD_LOGIN_REDIRECT_PATH = 'dragon-house-discord-login';
let memorySessionToken: string | null = null;
let memoryPersistentSessionToken: string | null = null;

export type BackendAuthUser = {
  familyMemberId: string;
  login: string;
  staticId: string;
  role: FamilyRole;
  rank: number;
  permissions: FamilyPermission[];
  mustChangePassword: boolean;
  loginProvider?: 'password' | 'discord';
};

export type LoginResponse = {
  token: string;
  expiresAt: string;
  user: BackendAuthUser;
};

export type AuthSessionMode = 'session' | 'persistent';

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
  if (typeof chrome !== 'undefined' && chrome.storage?.session) {
    const result = await chrome.storage.session.get(SESSION_TOKEN_KEY);
    if (typeof result[SESSION_TOKEN_KEY] === 'string') return result[SESSION_TOKEN_KEY];
  }
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const result = await chrome.storage.local.get(PERSISTENT_SESSION_TOKEN_KEY);
    return typeof result[PERSISTENT_SESSION_TOKEN_KEY] === 'string' ? result[PERSISTENT_SESSION_TOKEN_KEY] : null;
  }
  return memorySessionToken ?? memoryPersistentSessionToken;
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
  }
  if (mode === 'session') {
    memorySessionToken = token;
    if (token) memoryPersistentSessionToken = null;
  } else {
    memoryPersistentSessionToken = token;
    if (token) memorySessionToken = null;
  }
  if (!token) {
    memorySessionToken = null;
    memoryPersistentSessionToken = null;
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
    if (response.status === 401) await setSessionToken(null);
    try {
      const body = (await response.json()) as { message?: string; error?: string };
      throw new Error(body.message ?? body.error ?? `Family auth request failed: ${response.status}`);
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error(`Family auth request failed: ${response.status}`);
    }
  }
  return (await response.json()) as T;
}

export async function login(loginOrStaticId: string, password: string, rememberMe = false): Promise<LoginResponse> {
  const response = await fetch(`${getBackendApiBaseUrl().replace(/\/+$/u, '')}/api/auth/login`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ loginOrStaticId, password, rememberMe }),
  });
  const result = await parseJsonResponse<LoginResponse>(response);
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
  const result = await parseJsonResponse<LoginResponse>(
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
    throw new Error('Chrome Identity API is not available');
  }
  const redirectTarget = getDiscordLoginCompletionRedirectUrl();
  if (!redirectTarget) throw new Error('Chrome Identity redirect URL is not available');
  const start = await startDiscordLogin(redirectTarget);
  const finalUrl = await chrome.identity.launchWebAuthFlow({
    url: start.authorizationUrl,
    interactive: true,
  });
  if (!finalUrl) throw new Error('Discord login was cancelled');
  const url = new URL(finalUrl);
  const status = url.searchParams.get('discordLoginStatus');
  const error = url.searchParams.get('error');
  if (status === 'error' || error) throw new Error(error ?? 'Discord login failed');
  const completionCode = url.searchParams.get('completionCode');
  if (!completionCode) throw new Error('Discord login completion code is missing');
  return completeDiscordLogin(completionCode);
}

export async function getCurrentUser(): Promise<BackendAuthUser> {
  return parseJsonResponse<BackendAuthUser>(await authenticatedFetch('/api/auth/me', { method: 'GET' }));
}

export async function logout(): Promise<void> {
  const response = await authenticatedFetch('/api/auth/logout', { method: 'POST' });
  await setSessionToken(null);
  if (!response.ok && response.status !== 401) {
    throw new Error(`Family logout failed: ${response.status}`);
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<BackendAuthUser> {
  return parseJsonResponse<BackendAuthUser>(
    await authenticatedFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  );
}

export async function createAuthUser(input: {
  familyMemberId: string;
  login: string;
  staticId: string;
  role: FamilyRole;
  rank: number;
  permissions: FamilyPermission[];
  isActive: boolean;
}): Promise<BackendAuthUser> {
  return parseJsonResponse<BackendAuthUser>(
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
