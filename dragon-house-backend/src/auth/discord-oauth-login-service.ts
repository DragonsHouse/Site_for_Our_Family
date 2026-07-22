import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AppConfig } from '../config/env.js';
import type { DiscordAccountLinkRepository } from '../discord/account-link-repository.js';
import type { DiscordOAuthStateRepository } from '../discord/oauth-state-repository.js';
import type { AppLogger } from '../logging/logger.js';
import type { FamilyMemberRepository } from '../members/member-repository.js';
import type { SanitizedFamilyAuthUser } from '../types.js';
import type { FamilyAuthService } from './auth-service.js';
import type { DiscordLoginClientType, DiscordLoginCompletionRepository } from './discord-login-completion-repository.js';

const DISCORD_API_BASE_URL = 'https://discord.com/api/v10';
const DISCORD_AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
const DISCORD_TIMEOUT_MS = 10_000;
const DEFAULT_SCOPES = ['identify'] as const;

export type DiscordOAuthLoginErrorCode =
  | 'OAUTH_DISABLED'
  | 'OAUTH_STATE_INVALID'
  | 'OAUTH_STATE_EXPIRED'
  | 'OAUTH_STATE_ALREADY_USED'
  | 'OAUTH_CODE_EXCHANGE_FAILED'
  | 'DISCORD_IDENTITY_FAILED'
  | 'DISCORD_ACCOUNT_NOT_LINKED'
  | 'MEMBER_NOT_FOUND'
  | 'MEMBER_INACTIVE'
  | 'MEMBER_ACCESS_DENIED'
  | 'LOGIN_COMPLETION_EXPIRED'
  | 'LOGIN_COMPLETION_ALREADY_USED'
  | 'SESSION_CREATION_FAILED'
  | 'OAUTH_DENIED';

export class DiscordOAuthLoginError extends Error {
  constructor(
    readonly code: DiscordOAuthLoginErrorCode,
    readonly httpStatus = 400,
  ) {
    super(code);
    this.name = 'DiscordOAuthLoginError';
  }
}

export type DiscordOAuthStartResult = {
  authorizationUrl: string;
  expiresAt: string;
};

export type DiscordOAuthCallbackResult = {
  completionCode: string;
  redirectTarget: string;
  familyMemberId: string;
  discordUserId: string;
};

type DiscordOAuthTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
};

type DiscordIdentityResponse = {
  id?: string;
  username?: string;
  global_name?: string | null;
  avatar?: string | null;
};

export class DiscordOAuthLoginService {
  constructor(
    private readonly config: AppConfig,
    private readonly states: DiscordOAuthStateRepository,
    private readonly completions: DiscordLoginCompletionRepository,
    private readonly accountLinks: DiscordAccountLinkRepository,
    private readonly members: FamilyMemberRepository,
    private readonly authService: FamilyAuthService,
    private readonly logger: AppLogger,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async start(input: { clientType?: DiscordLoginClientType; redirectTarget?: string | null } = {}, now = new Date()): Promise<DiscordOAuthStartResult> {
    this.assertConfigured();
    const clientType = input.clientType ?? 'chrome_extension';
    const redirectTarget = this.resolveRedirectTarget(input.redirectTarget, true);
    const rawState = randomToken(32);
    const codeVerifier = randomToken(64);
    const stateId = hashToken(rawState);
    const expiresAt = new Date(now.getTime() + this.config.discord.oauth.stateTtlSeconds * 1000).toISOString();

    await this.states.create({
      stateId,
      familyMemberId: null,
      purpose: 'login',
      clientType,
      redirectTarget,
      codeVerifier,
      environment: this.config.nodeEnv,
      metadata: { transactionId: randomUUID() },
      createdAt: now.toISOString(),
      expiresAt,
      consumedAt: null,
    });

    const authorizationUrl = new URL(DISCORD_AUTHORIZE_URL);
    authorizationUrl.searchParams.set('client_id', this.config.discord.clientId ?? '');
    authorizationUrl.searchParams.set('redirect_uri', this.config.discord.oauthRedirectUri ?? '');
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('scope', this.config.discord.oauth.scopes.join(' '));
    authorizationUrl.searchParams.set('state', rawState);
    authorizationUrl.searchParams.set('code_challenge', base64Url(createHash('sha256').update(codeVerifier).digest()));
    authorizationUrl.searchParams.set('code_challenge_method', 'S256');

    this.logger.info('discord_oauth_login_started', { clientType, expiresAt });
    return { authorizationUrl: authorizationUrl.toString(), expiresAt };
  }

  async callback(input: { code?: string; state?: string; error?: string }, now = new Date()): Promise<DiscordOAuthCallbackResult> {
    if (input.error) throw new DiscordOAuthLoginError('OAUTH_DENIED', 400);
    if (!input.code || !input.state) throw new DiscordOAuthLoginError('OAUTH_STATE_INVALID', 400);
    this.assertConfigured();

    const stateId = hashToken(input.state);
    const existingState = await this.states.getByStateId(stateId);
    if (!existingState || existingState.purpose !== 'login') throw new DiscordOAuthLoginError('OAUTH_STATE_INVALID', 400);
    if (existingState.environment && existingState.environment !== this.config.nodeEnv) {
      throw new DiscordOAuthLoginError('OAUTH_STATE_INVALID', 400);
    }
    if (existingState.consumedAt) throw new DiscordOAuthLoginError('OAUTH_STATE_ALREADY_USED', 409);
    if (new Date(existingState.expiresAt).getTime() <= now.getTime()) throw new DiscordOAuthLoginError('OAUTH_STATE_EXPIRED', 400);

    const consumedState = await this.states.consume(stateId, now);
    if (!consumedState) throw new DiscordOAuthLoginError('OAUTH_STATE_ALREADY_USED', 409);

    const token = await this.exchangeCode(input.code, consumedState.codeVerifier ?? undefined);
    const identity = await this.fetchIdentity(token.accessToken);
    const link = await this.accountLinks.getByDiscordUserId(identity.discordUserId);
    if (!link) throw new DiscordOAuthLoginError('DISCORD_ACCOUNT_NOT_LINKED', 403);
    if (this.config.discord.guildId && link.guildId && link.guildId !== this.config.discord.guildId) {
      throw new DiscordOAuthLoginError('MEMBER_ACCESS_DENIED', 403);
    }
    if (link.leftAt || !link.verified || !link.guildMemberVerified) {
      throw new DiscordOAuthLoginError('MEMBER_ACCESS_DENIED', 403);
    }

    const member = await this.members.findById(link.familyMemberId);
    if (!member) throw new DiscordOAuthLoginError('MEMBER_NOT_FOUND', 403);
    if (member.status !== 'active' || member.deletedAt) throw new DiscordOAuthLoginError('MEMBER_INACTIVE', 403);

    if (
      this.config.discord.sync.protectedOwnerDiscordUserId &&
      identity.discordUserId === this.config.discord.sync.protectedOwnerDiscordUserId &&
      member.id !== this.config.discord.sync.protectedOwnerMemberId
    ) {
      this.logger.warn('discord_oauth_protected_owner_mismatch', {
        discordUserId: identity.discordUserId,
        resolvedFamilyMemberId: member.id,
      });
      throw new DiscordOAuthLoginError('MEMBER_ACCESS_DENIED', 403);
    }

    const completionCode = randomToken(32);
    const completionExpiresAt = new Date(now.getTime() + this.config.discord.oauth.completionTtlSeconds * 1000).toISOString();
    await this.completions.create({
      codeHash: hashToken(completionCode),
      stateId,
      familyMemberId: member.id,
      clientType: consumedState.clientType ?? 'chrome_extension',
      redirectTarget: consumedState.redirectTarget ?? this.resolveRedirectTarget(null, true),
      environment: this.config.nodeEnv,
      createdAt: now.toISOString(),
      expiresAt: completionExpiresAt,
      consumedAt: null,
    });

    await this.members.recordAudit({
      actorFamilyMemberId: member.id,
      action: 'discord_oauth_login_succeeded',
      entityId: member.id,
      metadata: { provider: 'discord', discordUserId: identity.discordUserId },
    });
    this.logger.info('discord_oauth_member_resolved', { familyMemberId: member.id, discordUserId: identity.discordUserId });
    return { completionCode, redirectTarget: consumedState.redirectTarget ?? this.resolveRedirectTarget(null, true), familyMemberId: member.id, discordUserId: identity.discordUserId };
  }

  async complete(input: { completionCode: string; clientType?: DiscordLoginClientType }, now = new Date()): Promise<{
    token: string;
    expiresAt: string;
    user: SanitizedFamilyAuthUser;
  }> {
    const codeHash = hashToken(input.completionCode);
    const existing = await this.completions.getByCodeHash(codeHash);
    if (!existing) throw new DiscordOAuthLoginError('LOGIN_COMPLETION_EXPIRED', 400);
    if (existing.environment !== this.config.nodeEnv) throw new DiscordOAuthLoginError('LOGIN_COMPLETION_EXPIRED', 400);
    if (input.clientType && existing.clientType !== input.clientType) throw new DiscordOAuthLoginError('LOGIN_COMPLETION_EXPIRED', 400);
    if (existing.consumedAt) throw new DiscordOAuthLoginError('LOGIN_COMPLETION_ALREADY_USED', 409);
    if (new Date(existing.expiresAt).getTime() <= now.getTime()) throw new DiscordOAuthLoginError('LOGIN_COMPLETION_EXPIRED', 400);
    const consumed = await this.completions.consume(codeHash, now);
    if (!consumed) throw new DiscordOAuthLoginError('LOGIN_COMPLETION_ALREADY_USED', 409);

    try {
      const result = await this.authService.createSessionForFamilyMember(consumed.familyMemberId, { loginProvider: 'discord' });
      await this.members.recordAudit({
        actorFamilyMemberId: consumed.familyMemberId,
        action: 'session_created',
        entityId: consumed.familyMemberId,
        metadata: { provider: 'discord', oauthStateId: consumed.stateId },
      });
      this.logger.info('discord_oauth_session_created', { familyMemberId: consumed.familyMemberId });
      return result;
    } catch {
      throw new DiscordOAuthLoginError('SESSION_CREATION_FAILED', 500);
    }
  }

  private assertConfigured(): void {
    if (
      !this.config.discord.clientId ||
      !this.config.discord.clientSecret ||
      !this.config.discord.oauthRedirectUri ||
      !this.config.discord.guildId ||
      this.config.discord.oauth.scopes.length === 0 ||
      this.config.discord.oauth.loginRedirectUris.length === 0
    ) {
      throw new DiscordOAuthLoginError('OAUTH_DISABLED', 503);
    }
  }

  private resolveRedirectTarget(requested: string | null | undefined, allowDefault: boolean): string {
    const allowed = this.config.discord.oauth.loginRedirectUris;
    if (requested && allowed.includes(requested)) return requested;
    if (requested) throw new DiscordOAuthLoginError('OAUTH_STATE_INVALID', 400);
    if (allowDefault && allowed[0]) return allowed[0];
    throw new DiscordOAuthLoginError('OAUTH_DISABLED', 503);
  }

  private async exchangeCode(code: string, codeVerifier?: string): Promise<{ accessToken: string }> {
    const body = new URLSearchParams({
      client_id: this.config.discord.clientId ?? '',
      client_secret: this.config.discord.clientSecret ?? '',
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.discord.oauthRedirectUri ?? '',
    });
    if (codeVerifier) body.set('code_verifier', codeVerifier);
    const response = await this.fetchImpl(`${DISCORD_API_BASE_URL}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
      signal: AbortSignal.timeout(DISCORD_TIMEOUT_MS),
    });
    if (!response.ok) throw new DiscordOAuthLoginError('OAUTH_CODE_EXCHANGE_FAILED', 502);
    const payload = (await response.json()) as DiscordOAuthTokenResponse;
    if (!payload.access_token) throw new DiscordOAuthLoginError('OAUTH_CODE_EXCHANGE_FAILED', 502);
    return { accessToken: payload.access_token };
  }

  private async fetchIdentity(accessToken: string): Promise<{ discordUserId: string; username: string; globalName: string | null; avatar: string | null }> {
    const response = await this.fetchImpl(`${DISCORD_API_BASE_URL}/users/@me`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(DISCORD_TIMEOUT_MS),
    });
    if (!response.ok) throw new DiscordOAuthLoginError('DISCORD_IDENTITY_FAILED', 502);
    const payload = (await response.json()) as DiscordIdentityResponse;
    if (!payload.id || !payload.username) throw new DiscordOAuthLoginError('DISCORD_IDENTITY_FAILED', 502);
    return {
      discordUserId: payload.id,
      username: payload.username,
      globalName: payload.global_name ?? null,
      avatar: payload.avatar ?? null,
    };
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function randomToken(bytes: number): string {
  return base64Url(randomBytes(bytes));
}

function base64Url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/gu, '');
}

export const DEFAULT_DISCORD_LOGIN_SCOPES = DEFAULT_SCOPES;
