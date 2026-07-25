import type { DiscordAccountLink, DiscordConnectionStatus } from './family-types.ts';

export type DiscordBackendHealthResponse = {
  status: 'ok';
  serverTime: string;
  discordConfigured: boolean;
  discordConnected: boolean;
  version: string;
};

export type DiscordBackendPublicConfigResponse = {
  clientId: string | null;
  redirectUri: string | null;
  guildConfigured: boolean;
  configuredChannelNames: string[];
  configuredChannelPurposes: string[];
  connectionStatus: DiscordConnectionStatus;
};

export type DiscordBackendStatusResponse = {
  status: DiscordConnectionStatus;
  lastConnectedAt: string | null;
  lastError: string | null;
};

export type DiscordBackendClient = {
  getHealth(): Promise<DiscordBackendHealthResponse>;
  getPublicConfig(): Promise<DiscordBackendPublicConfigResponse>;
  getStatus(): Promise<DiscordBackendStatusResponse>;
  getDiscordAccountLink(): Promise<DiscordAccountLink | null>;
  startDiscordAccountLink(): Promise<{ authorizationUrl: string; expiresAt: string }>;
  unlinkDiscordAccount(): Promise<void>;
};

export type DiscordBackendRequestErrorCode =
  | 'discord_oauth_not_configured'
  | 'discord_oauth_state_invalid'
  | 'discord_oauth_state_expired'
  | 'discord_oauth_state_consumed'
  | 'discord_oauth_denied'
  | 'discord_token_exchange_failed'
  | 'discord_user_fetch_failed'
  | 'discord_guild_membership_required'
  | 'discord_account_already_linked'
  | 'discord_account_linked_elsewhere'
  | 'family_member_inactive'
  | 'family_auth_required'
  | 'discord_link_failed';

export class DiscordBackendRequestError extends Error {
  readonly name = 'DiscordBackendRequestError';
  readonly status: number;
  readonly code: DiscordBackendRequestErrorCode;

  constructor(status: number, code: DiscordBackendRequestErrorCode, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function joinApiUrl(apiBaseUrl: string, path: string): string {
  return `${apiBaseUrl.replace(/\/+$/u, '')}${path}`;
}

type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;

function createFetcher(apiBaseUrl: string): Fetcher {
  return (path, init) =>
    fetch(joinApiUrl(apiBaseUrl, path), {
      ...init,
      credentials: 'omit',
    });
}

async function getJson<T>(path: string, fetcher: Fetcher): Promise<T> {
  const response = await fetcher(path, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw await createBackendError(response);
  }

  return (await response.json()) as T;
}

async function postJson<T>(path: string, fetcher: Fetcher): Promise<T> {
  const response = await fetcher(path, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw await createBackendError(response);
  }

  return (await response.json()) as T;
}

async function deleteRequest(path: string, fetcher: Fetcher): Promise<void> {
  const response = await fetcher(path, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok && response.status !== 204) {
    throw await createBackendError(response);
  }
}

async function createBackendError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as { error?: string; message?: string; status?: string };
    const code = normalizeDiscordBackendErrorCode(body.error);
    const message = body.message ?? body.error ?? body.status ?? `Discord backend request failed: ${response.status}`;
    return new DiscordBackendRequestError(response.status, code, message);
  } catch {
    return new DiscordBackendRequestError(response.status, 'discord_link_failed', `Discord backend request failed: ${response.status}`);
  }
}

function normalizeDiscordBackendErrorCode(value: unknown): DiscordBackendRequestErrorCode {
  const knownCodes: DiscordBackendRequestErrorCode[] = [
    'discord_oauth_not_configured',
    'discord_oauth_state_invalid',
    'discord_oauth_state_expired',
    'discord_oauth_state_consumed',
    'discord_oauth_denied',
    'discord_token_exchange_failed',
    'discord_user_fetch_failed',
    'discord_guild_membership_required',
    'discord_account_already_linked',
    'discord_account_linked_elsewhere',
    'family_member_inactive',
    'family_auth_required',
    'discord_link_failed',
  ];
  return typeof value === 'string' && knownCodes.includes(value as DiscordBackendRequestErrorCode)
    ? (value as DiscordBackendRequestErrorCode)
    : 'discord_link_failed';
}

export function createDiscordBackendClient(apiBaseUrl: string, fetcher: Fetcher = createFetcher(apiBaseUrl)): DiscordBackendClient {
  return {
    getHealth: () => getJson<DiscordBackendHealthResponse>('/api/health', fetcher),
    getPublicConfig: () =>
      getJson<DiscordBackendPublicConfigResponse>('/api/discord/config/public', fetcher),
    getStatus: () => getJson<DiscordBackendStatusResponse>('/api/discord/status', fetcher),
    getDiscordAccountLink: () =>
      getJson<DiscordAccountLink | null>('/api/discord/account-link', fetcher),
    startDiscordAccountLink: () =>
      postJson<{ authorizationUrl: string; expiresAt: string }>('/api/discord/account-link/start', fetcher),
    unlinkDiscordAccount: () => deleteRequest('/api/discord/account-link', fetcher),
  };
}
