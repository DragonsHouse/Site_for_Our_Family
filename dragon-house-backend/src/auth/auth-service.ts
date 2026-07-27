import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../config/env.js';
import type { FamilyMemberRepository } from '../members/member-repository.js';
import { DuplicateFamilyAuthUserError, type FamilyAuthRepository } from './auth-repository.js';
import { FamilyAuthError } from './auth-errors.js';
import { createAuthenticatedMemberDto, type AuthenticatedMemberDto } from './authenticated-member-dto.js';
import { hashPassword, validatePasswordPolicy, verifyPassword } from './password.js';
import { createSessionToken, hashSessionToken } from './tokens.js';
import type {
  FamilyAuthContext,
  FamilyAuthUser,
  FamilyMember,
  FamilyPermission,
  FamilyRole,
  FamilySession,
  SanitizedFamilyAuthUser,
} from '../types.js';

const LAST_USED_UPDATE_INTERVAL_MS = 60_000;
const STATIC_ID_MAX_LENGTH = 80;
const BIRTHDAY_MIN_DATE = '1970-01-01';

type LoginAttempt = {
  count: number;
  resetAt: number;
};

export type StaticIdSelfServiceErrorCode =
  | 'static_id_required'
  | 'static_id_too_long'
  | 'static_id_duplicate'
  | 'static_id_update_conflict';

export class StaticIdSelfServiceError extends Error {
  constructor(
    readonly code: StaticIdSelfServiceErrorCode,
    message: string,
    readonly httpStatus = 400,
  ) {
    super(message);
    this.name = 'StaticIdSelfServiceError';
  }
}

export type BirthdaySelfServiceErrorCode =
  | 'birthday_required'
  | 'birthday_invalid'
  | 'birthday_too_early'
  | 'birthday_future'
  | 'birthday_update_conflict';

export class BirthdaySelfServiceError extends Error {
  constructor(
    readonly code: BirthdaySelfServiceErrorCode,
    message: string,
    readonly httpStatus = 400,
  ) {
    super(message);
    this.name = 'BirthdaySelfServiceError';
  }
}

export class FamilyAuthService {
  private readonly loginAttempts = new Map<string, LoginAttempt>();

  constructor(
    private readonly config: AppConfig,
    private readonly repository: FamilyAuthRepository,
    private readonly members: FamilyMemberRepository,
  ) {}

  async login(loginOrStaticId: string, password: string, options: { rememberMe?: boolean } = {}): Promise<{
    token: string;
    expiresAt: string;
    user: AuthenticatedMemberDto;
  }> {
    const rateKey = loginOrStaticId.trim().toLowerCase() || 'empty';
    this.assertLoginRateLimit(rateKey);

    const user = await this.repository.findUserByLoginOrStaticId(loginOrStaticId);
    if (!user) {
      this.recordFailedLogin(rateKey);
      throw new FamilyAuthError('invalid_credentials', 'Invalid credentials');
    }
    if (!user.isActive) {
      throw new FamilyAuthError('account_disabled', 'Account disabled', 403);
    }
    if (!(await verifyPassword(password, user.passwordHash))) {
      this.recordFailedLogin(rateKey);
      throw new FamilyAuthError('invalid_credentials', 'Invalid credentials');
    }
    const member = await this.loadActiveMember(user.familyMemberId, 'account_disabled');

    this.loginAttempts.delete(rateKey);
    const token = createSessionToken();
    const now = new Date();
    const ttlMs = options.rememberMe
      ? this.config.authRememberMeTtlDays * 24 * 60 * 60 * 1000
      : this.config.authSessionTtlHours * 60 * 60 * 1000;
    const expiresAt = new Date(now.getTime() + ttlMs).toISOString();
    await this.repository.createSession({
      sessionId: randomUUID(),
      familyMemberId: user.familyMemberId,
      tokenHash: hashSessionToken(token),
      createdAt: now.toISOString(),
      expiresAt,
      lastUsedAt: now.toISOString(),
      revokedAt: null,
      revokedReason: null,
      loginProvider: 'password',
    });

    return { token, expiresAt, user: createAuthenticatedMemberDto(member, sessionShell(expiresAt, now, 'password'), user) };
  }

  async authenticateToken(token: string, options: { allowPasswordChangeRequired?: boolean } = {}): Promise<{
    session: FamilySession;
    user: FamilyAuthUser;
    member: FamilyMember;
    context: FamilyAuthContext;
  }> {
    if (!token.trim()) throw new FamilyAuthError('session_required', 'Session required');

    const session = await this.repository.findSessionByTokenHash(hashSessionToken(token));
    if (!session || session.revokedAt) throw new FamilyAuthError('session_invalid', 'Session invalid');

    const now = new Date();
    if (new Date(session.expiresAt).getTime() <= now.getTime()) {
      throw new FamilyAuthError('session_expired', 'Session expired');
    }

    const user = await this.repository.findUserByFamilyMemberId(session.familyMemberId);
    if (!user) throw new FamilyAuthError('session_invalid', 'Session invalid');
    if (!user.isActive) throw new FamilyAuthError('account_disabled', 'Account disabled', 403);
    const member = await this.loadActiveMember(session.familyMemberId, 'account_disabled');
    if (user.mustChangePassword && !options.allowPasswordChangeRequired) {
      throw new FamilyAuthError('password_change_required', 'Password change required', 403);
    }

    if (now.getTime() - new Date(session.lastUsedAt).getTime() > LAST_USED_UPDATE_INTERVAL_MS) {
      await this.repository.updateSessionLastUsedAt(session.sessionId, now.toISOString());
    }

    return {
      session,
      user,
      member,
      context: {
        familyMemberId: member.id,
        role: member.role,
        rank: member.rank,
        status: member.status,
        permissions: member.permissions,
      },
    };
  }

  async me(token: string): Promise<AuthenticatedMemberDto> {
    const { user, session, member } = await this.authenticateToken(token, { allowPasswordChangeRequired: true });
    return createAuthenticatedMemberDto(member, session, user);
  }

  async logout(token: string): Promise<void> {
    const { session } = await this.authenticateToken(token, { allowPasswordChangeRequired: true });
    await this.repository.revokeSession(session.sessionId, new Date().toISOString());
  }

  async createSessionForFamilyMember(
    familyMemberId: string,
    options: { loginProvider: 'discord' | 'password'; rememberMe?: boolean } = { loginProvider: 'password' },
  ): Promise<{ token: string; expiresAt: string; user: AuthenticatedMemberDto }> {
    const user = await this.repository.findUserByFamilyMemberId(familyMemberId);
    if (!user || !user.isActive) throw new FamilyAuthError('account_disabled', 'Account disabled', 403);
    const member = await this.loadActiveMember(familyMemberId, 'account_disabled');

    const token = createSessionToken();
    const now = new Date();
    const ttlMs = options.rememberMe
      ? this.config.authRememberMeTtlDays * 24 * 60 * 60 * 1000
      : this.config.authSessionTtlHours * 60 * 60 * 1000;
    const expiresAt = new Date(now.getTime() + ttlMs).toISOString();
    await this.repository.createSession({
      sessionId: randomUUID(),
      familyMemberId: user.familyMemberId,
      tokenHash: hashSessionToken(token),
      loginProvider: options.loginProvider,
      createdAt: now.toISOString(),
      expiresAt,
      lastUsedAt: now.toISOString(),
      revokedAt: null,
      revokedReason: null,
    });

    return { token, expiresAt, user: createAuthenticatedMemberDto(member, sessionShell(expiresAt, now, options.loginProvider), user) };
  }

  async changePassword(token: string, currentPassword: string, newPassword: string): Promise<AuthenticatedMemberDto> {
    const { session, user, member } = await this.authenticateToken(token, { allowPasswordChangeRequired: true });
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new FamilyAuthError('current_password_invalid', 'Current password is invalid');
    }
    if (!validatePasswordPolicy(newPassword)) {
      throw new FamilyAuthError('password_too_weak', 'Password is too weak', 400);
    }
    const nextUser = await this.repository.updatePassword(
      user.familyMemberId,
      await hashPassword(newPassword, this.config.bcryptCost),
      false,
    );
    await this.repository.revokeOtherSessions(user.familyMemberId, session.sessionId, new Date().toISOString());
    return createAuthenticatedMemberDto(member, session, nextUser);
  }

  async updateCurrentMemberStaticId(token: string, input: string): Promise<AuthenticatedMemberDto> {
    const staticId = normalizeStaticId(input);
    const { session, user, member } = await this.authenticateToken(token);

    if (await this.members.existsByStaticId(staticId, member.id)) {
      throw new StaticIdSelfServiceError('static_id_duplicate', 'Static ID is already in use', 409);
    }
    if (await this.repository.existsByStaticId(staticId, member.id)) {
      throw new StaticIdSelfServiceError('static_id_duplicate', 'Static ID is already in use', 409);
    }

    const { updatedMember, updatedUser } = await this.updateCanonicalStaticId(member, user, staticId);

    return createAuthenticatedMemberDto(updatedMember, session, updatedUser);
  }

  async updateCurrentMemberBirthday(token: string, input: string): Promise<AuthenticatedMemberDto> {
    const dateOfBirth = normalizeDateOfBirth(input);
    const { session, user, member } = await this.authenticateToken(token);
    const updatedMember = await this.members.update(member.id, { dateOfBirth }, member.version, member.id);
    if (!updatedMember) {
      throw new BirthdaySelfServiceError('birthday_update_conflict', 'Birthday update conflict', 409);
    }

    return createAuthenticatedMemberDto(updatedMember, session, user);
  }

  async createAuthUser(
    token: string,
    input: {
      familyMemberId: string;
      login: string;
      staticId: string;
      role: FamilyRole;
      rank: number;
      permissions: FamilyPermission[];
      isActive: boolean;
    },
  ): Promise<SanitizedFamilyAuthUser> {
    const { context: actor } = await this.authenticateToken(token);
    if (actor.role !== 'owner' && !actor.permissions.includes('manage_users')) {
      throw new FamilyAuthError('session_invalid', 'Insufficient permissions', 403);
    }
    const user = await this.repository.createUser({
      familyMemberId: input.familyMemberId,
      login: input.login,
      staticId: input.staticId,
      role: input.role,
      rank: input.rank,
      permissions: input.permissions,
      isActive: input.isActive,
      mustChangePassword: true,
      passwordHash: await hashPassword(input.staticId, this.config.bcryptCost),
    });
    return sanitizeAuthUser(user);
  }

  private assertLoginRateLimit(key: string): void {
    const now = Date.now();
    const attempt = this.loginAttempts.get(key);
    if (!attempt || attempt.resetAt <= now) return;
    if (attempt.count >= 5) throw new FamilyAuthError('login_rate_limited', 'Login rate limited', 429);
  }

  private recordFailedLogin(key: string): void {
    const now = Date.now();
    const current = this.loginAttempts.get(key);
    if (!current || current.resetAt <= now) {
      this.loginAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
      return;
    }
    this.loginAttempts.set(key, { ...current, count: current.count + 1 });
  }

  private async loadActiveMember(familyMemberId: string, errorCode: 'account_disabled' | 'session_invalid'): Promise<FamilyMember> {
    const member = await this.members.findById(familyMemberId);
    if (member && member.status === 'active' && !member.deletedAt) return member;
    if (errorCode === 'account_disabled') throw new FamilyAuthError('account_disabled', 'Account disabled', 403);
    throw new FamilyAuthError('session_invalid', 'Session invalid');
  }

  private async updateCanonicalStaticId(
    member: FamilyMember,
    user: FamilyAuthUser,
    staticId: string,
  ): Promise<{ updatedMember: FamilyMember; updatedUser: FamilyAuthUser }> {
    try {
      if (this.repository.updateMemberAndAuthStaticId) {
        const result = await this.repository.updateMemberAndAuthStaticId(member.id, staticId, member.version);
        if (!result.memberUpdated) {
          throw new StaticIdSelfServiceError('static_id_update_conflict', 'Static ID update conflict', 409);
        }
        const updatedMember = await this.members.findById(member.id);
        if (!updatedMember) {
          throw new StaticIdSelfServiceError('static_id_update_conflict', 'Static ID update conflict', 409);
        }
        return { updatedMember, updatedUser: result.user ?? { ...user, staticId } };
      }

      const updatedMember = await this.members.update(member.id, { staticId }, member.version, member.id);
      if (!updatedMember) {
        throw new StaticIdSelfServiceError('static_id_update_conflict', 'Static ID update conflict', 409);
      }
      const updatedUser = (await this.repository.updateStaticIdForFamilyMember(user.familyMemberId, staticId)) ?? {
        ...user,
        staticId,
      };
      return { updatedMember, updatedUser };
    } catch (error) {
      if (error instanceof StaticIdSelfServiceError) throw error;
      if (error instanceof DuplicateFamilyAuthUserError) {
        throw new StaticIdSelfServiceError('static_id_duplicate', 'Static ID is already in use', 409);
      }
      throw error;
    }
  }
}

function normalizeStaticId(input: string): string {
  const staticId = input.trim();
  if (!staticId) throw new StaticIdSelfServiceError('static_id_required', 'Static ID is required');
  if (staticId.length > STATIC_ID_MAX_LENGTH) {
    throw new StaticIdSelfServiceError('static_id_too_long', 'Static ID is too long');
  }
  return staticId;
}

function normalizeDateOfBirth(input: string): string {
  const dateOfBirth = input.trim();
  if (!dateOfBirth) throw new BirthdaySelfServiceError('birthday_required', 'Date of birth is required');
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(dateOfBirth);
  if (!match) throw new BirthdaySelfServiceError('birthday_invalid', 'Date of birth is invalid');

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    throw new BirthdaySelfServiceError('birthday_invalid', 'Date of birth is invalid');
  }

  const today = new Date().toISOString().slice(0, 10);
  if (dateOfBirth < BIRTHDAY_MIN_DATE) {
    throw new BirthdaySelfServiceError('birthday_too_early', 'Date of birth must be on or after 1970-01-01');
  }
  if (dateOfBirth > today) throw new BirthdaySelfServiceError('birthday_future', 'Date of birth cannot be in the future');
  return dateOfBirth;
}

export function sanitizeAuthUser(user: FamilyAuthUser, loginProvider?: 'password' | 'discord'): SanitizedFamilyAuthUser {
  return {
    familyMemberId: user.familyMemberId,
    login: user.login,
    staticId: user.staticId,
    role: user.role,
    rank: user.rank,
    permissions: user.permissions,
    mustChangePassword: user.mustChangePassword,
    ...(loginProvider ? { loginProvider } : {}),
  };
}

function sessionShell(
  expiresAt: string,
  now: Date,
  loginProvider: FamilySession['loginProvider'] = 'password',
): Pick<FamilySession, 'loginProvider' | 'expiresAt' | 'lastUsedAt'> {
  return { loginProvider, expiresAt, lastUsedAt: now.toISOString() };
}
