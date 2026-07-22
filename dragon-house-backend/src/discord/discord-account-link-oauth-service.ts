import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import {
  getMissingDiscordOAuthConfig,
  isDiscordOAuthConfigComplete,
  type AppConfig,
} from '../config/env.js';
import type { DiscordAccountLinkRepository } from './account-link-repository.js';
import { DuplicateDiscordAccountLinkError } from './account-link-repository.js';
import type { DiscordOAuthStateRepository } from './oauth-state-repository.js';
import type { DiscordAccountLink, DiscordAccountLinkErrorCode } from '../types.js';

const DISCORD_API_BASE_URL = 'https://discord.com/api/v10';
const DISCORD_AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
const OAUTH_SCOPES = ['identify', 'guilds.members.read'] as const;
const STATE_TTL_MS = 10 * 60 * 1000;
const DISCORD_TIMEOUT_MS = 10_000;

const DiscordTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().min(1),
});

const DiscordUserResponseSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  global_name: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
});

export class DiscordAccountLinkOAuthError extends Error {
  constructor(
    readonly code: DiscordAccountLinkErrorCode,
    message: string,
    readonly httpStatus = 400,
  ) {
    super(message);
    this.name = 'DiscordAccountLinkOAuthError';
  }
}

type FetchLike = typeof fetch;

export type StartDiscordAccountLinkResult = {
  authorizationUrl: string;
  expiresAt: string;
};

export type CompleteDiscordAccountLinkResult = {
  link: DiscordAccountLink;
};

export class DiscordAccountLinkOAuthService {
  constructor(
    private readonly config: AppConfig,
    private readonly accountLinks: DiscordAccountLinkRepository,
    private readonly oauthStates: DiscordOAuthStateRepository,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async start(familyMemberId: string, now = new Date()): Promise<StartDiscordAccountLinkResult> {
    this.assertOAuthConfigured();

    const rawState = randomBytes(32).toString('base64url');
    const stateId = hashState(rawState);
    const expiresAt = new Date(now.getTime() + STATE_TTL_MS).toISOString();

    await this.oauthStates.create({
      stateId,
      familyMemberId,
      purpose: 'account_link',
      createdAt: now.toISOString(),
      expiresAt,
      consumedAt: null,
    });

    const authorizationUrl = new URL(DISCORD_AUTHORIZE_URL);
    authorizationUrl.searchParams.set('client_id', this.config.discord.clientId ?? '');
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('redirect_uri', this.accountLinkRedirectUri());
    authorizationUrl.searchParams.set('scope', OAUTH_SCOPES.join(' '));
    authorizationUrl.searchParams.set('state', rawState);
    authorizationUrl.searchParams.set('prompt', 'consent');

    return { authorizationUrl: authorizationUrl.toString(), expiresAt };
  }

  async complete(input: {
    code?: string;
    state?: string;
    error?: string;
    now?: Date;
  }): Promise<CompleteDiscordAccountLinkResult> {
    if (input.error === 'access_denied') {
      throw new DiscordAccountLinkOAuthError('discord_oauth_denied', 'Discord OAuth access was denied');
    }
    if (input.error) {
      throw new DiscordAccountLinkOAuthError('discord_oauth_denied', 'Discord OAuth returned an error');
    }
    if (!input.state) {
      throw new DiscordAccountLinkOAuthError('discord_oauth_state_invalid', 'Missing OAuth state');
    }
    if (!input.code) {
      throw new DiscordAccountLinkOAuthError('discord_token_exchange_failed', 'Missing OAuth code');
    }

    this.assertOAuthConfigured();

    const now = input.now ?? new Date();
    const stateId = hashState(input.state);
    const savedState = await this.oauthStates.getByStateId(stateId);
    if (!savedState) {
      throw new DiscordAccountLinkOAuthError('discord_oauth_state_invalid', 'Unknown OAuth state');
    }
    if (savedState.consumedAt) {
      throw new DiscordAccountLinkOAuthError('discord_oauth_state_consumed', 'OAuth state was already used');
    }
    if (new Date(savedState.expiresAt).getTime() <= now.getTime()) {
      throw new DiscordAccountLinkOAuthError('discord_oauth_state_expired', 'OAuth state expired');
    }

    const consumedState = await this.oauthStates.consume(stateId, now);
    if (!consumedState) {
      throw new DiscordAccountLinkOAuthError('discord_oauth_state_consumed', 'OAuth state could not be consumed');
    }

    if (!consumedState.familyMemberId) {
      throw new DiscordAccountLinkOAuthError('discord_oauth_state_invalid', 'OAuth state is not linked to a Family Hub member');
    }
    const existingFamilyLink = await this.accountLinks.getByFamilyMemberId(consumedState.familyMemberId);
    if (existingFamilyLink) {
      throw new DiscordAccountLinkOAuthError(
        'discord_account_already_linked',
        'Family member already has a linked Discord account',
        409,
      );
    }

    const token = await this.exchangeCodeForAccessToken(input.code);
    const discordUser = await this.fetchCurrentDiscordUser(token.accessToken);
    await this.verifyGuildMembership(token.accessToken);

    const existingDiscordLink = await this.accountLinks.getByDiscordUserId(discordUser.discordUserId);
    if (existingDiscordLink) {
      throw new DiscordAccountLinkOAuthError(
        'discord_account_linked_elsewhere',
        'Discord account is already linked to another family member',
        409,
      );
    }

    const timestamp = now.toISOString();
    const link: DiscordAccountLink = {
      familyMemberId: consumedState.familyMemberId,
      ...discordUser,
      guildMemberVerified: true,
      linkedAt: timestamp,
      updatedAt: timestamp,
    };

    try {
      return { link: await this.accountLinks.save(link) };
    } catch (error) {
      if (error instanceof DuplicateDiscordAccountLinkError) {
        throw new DiscordAccountLinkOAuthError(
          'discord_account_linked_elsewhere',
          'Discord account link uniqueness constraint failed',
          409,
        );
      }
      throw error;
    }
  }

  private assertOAuthConfigured(): void {
    if (!isDiscordOAuthConfigComplete(this.config) || !this.accountLinkRedirectUri()) {
      throw new DiscordAccountLinkOAuthError(
        'discord_oauth_not_configured',
        `Discord OAuth is not configured: ${getMissingDiscordOAuthConfig(this.config).join(', ')}`,
        503,
      );
    }
  }

  private async exchangeCodeForAccessToken(code: string): Promise<{ accessToken: string }> {
    const body = new URLSearchParams({
      client_id: this.config.discord.clientId ?? '',
      client_secret: this.config.discord.clientSecret ?? '',
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.accountLinkRedirectUri(),
    });

    const response = await this.fetchImpl(`${DISCORD_API_BASE_URL}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
      signal: AbortSignal.timeout(DISCORD_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new DiscordAccountLinkOAuthError(
        'discord_token_exchange_failed',
        'Discord token exchange failed',
        502,
      );
    }

    const parsed = DiscordTokenResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new DiscordAccountLinkOAuthError(
        'discord_token_exchange_failed',
        'Discord token response was invalid',
        502,
      );
    }

    return { accessToken: parsed.data.access_token };
  }

  private accountLinkRedirectUri(): string {
    return this.config.discord.redirectUri ?? this.config.discord.oauthRedirectUri ?? '';
  }

  private async fetchCurrentDiscordUser(accessToken: string): Promise<{
    discordUserId: string;
    discordUsername: string;
    discordGlobalName: string | null;
    discordAvatarUrl: string | null;
  }> {
    const response = await this.fetchDiscordJson('/users/@me', accessToken, 'discord_user_fetch_failed');
    const parsed = DiscordUserResponseSchema.safeParse(response);
    if (!parsed.success) {
      throw new DiscordAccountLinkOAuthError(
        'discord_user_fetch_failed',
        'Discord user response was invalid',
        502,
      );
    }

    return {
      discordUserId: parsed.data.id,
      discordUsername: parsed.data.username,
      discordGlobalName: parsed.data.global_name ?? null,
      discordAvatarUrl: buildDiscordAvatarUrl(parsed.data.id, parsed.data.avatar ?? null),
    };
  }

  private async verifyGuildMembership(accessToken: string): Promise<void> {
    const guildId = this.config.discord.guildId;
    const response = await this.fetchImpl(`${DISCORD_API_BASE_URL}/users/@me/guilds/${guildId}/member`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(DISCORD_TIMEOUT_MS),
    });

    if (response.status === 404) {
      throw new DiscordAccountLinkOAuthError(
        'discord_guild_membership_required',
        'Your Discord account is not a member of the Dragon House server',
        403,
      );
    }
    if (response.status === 429 || !response.ok) {
      throw new DiscordAccountLinkOAuthError(
        'discord_guild_membership_required',
        'Discord guild membership could not be verified',
        502,
      );
    }
  }

  private async fetchDiscordJson(
    path: string,
    accessToken: string,
    errorCode: DiscordAccountLinkErrorCode,
  ): Promise<unknown> {
    const response = await this.fetchImpl(`${DISCORD_API_BASE_URL}${path}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(DISCORD_TIMEOUT_MS),
    });

    if (response.status === 429 || !response.ok) {
      throw new DiscordAccountLinkOAuthError(errorCode, 'Discord request failed', 502);
    }

    return response.json();
  }
}

function hashState(rawState: string): string {
  return createHash('sha256').update(rawState).digest('hex');
}

function buildDiscordAvatarUrl(userId: string, avatarHash: string | null): string | null {
  if (!avatarHash) return null;
  const extension = avatarHash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${encodeURIComponent(userId)}/${encodeURIComponent(
    avatarHash,
  )}.${extension}?size=128`;
}
