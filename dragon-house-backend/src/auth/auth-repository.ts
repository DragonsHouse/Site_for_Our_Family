import type { FamilyAuthUser, FamilyPermission, FamilyRole, FamilySession } from '../types.js';

export type CreateFamilyAuthUserInput = {
  familyMemberId: string;
  login: string;
  staticId: string;
  passwordHash: string;
  isActive: boolean;
  mustChangePassword: boolean;
  role: FamilyRole;
  rank: number;
  permissions: FamilyPermission[];
};

export interface FamilyAuthRepository {
  findUserByLoginOrStaticId(loginOrStaticId: string): Promise<FamilyAuthUser | null>;
  findUserByFamilyMemberId(familyMemberId: string): Promise<FamilyAuthUser | null>;
  createUser(input: CreateFamilyAuthUserInput): Promise<FamilyAuthUser>;
  updatePassword(familyMemberId: string, passwordHash: string, mustChangePassword: boolean): Promise<FamilyAuthUser>;
  createSession(session: FamilySession): Promise<FamilySession>;
  findSessionByTokenHash(tokenHash: string): Promise<FamilySession | null>;
  updateSessionLastUsedAt(sessionId: string, lastUsedAt: string): Promise<void>;
  revokeSession(sessionId: string, revokedAt: string): Promise<void>;
  revokeOtherSessions(familyMemberId: string, currentSessionId: string, revokedAt: string): Promise<void>;
  revokeSessionsForFamilyMember(familyMemberId: string, revokedAt: string): Promise<void>;
}

export class DuplicateFamilyAuthUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateFamilyAuthUserError';
  }
}

export class InMemoryFamilyAuthRepository implements FamilyAuthRepository {
  private readonly users = new Map<string, FamilyAuthUser>();

  private readonly loginIndex = new Map<string, string>();

  private readonly staticIdIndex = new Map<string, string>();

  private readonly sessionsById = new Map<string, FamilySession>();

  private readonly sessionIdByTokenHash = new Map<string, string>();

  async findUserByLoginOrStaticId(loginOrStaticId: string): Promise<FamilyAuthUser | null> {
    const key = loginOrStaticId.trim().toLowerCase();
    const familyMemberId = this.loginIndex.get(key) ?? this.staticIdIndex.get(key);
    return familyMemberId ? this.users.get(familyMemberId) ?? null : null;
  }

  async findUserByFamilyMemberId(familyMemberId: string): Promise<FamilyAuthUser | null> {
    return this.users.get(familyMemberId) ?? null;
  }

  async createUser(input: CreateFamilyAuthUserInput): Promise<FamilyAuthUser> {
    if (this.users.has(input.familyMemberId)) {
      throw new DuplicateFamilyAuthUserError('Family member ID already exists');
    }
    const loginKey = input.login.toLowerCase();
    if (this.loginIndex.has(loginKey)) {
      throw new DuplicateFamilyAuthUserError('Login already exists');
    }
    const staticIdKey = input.staticId.toLowerCase();
    if (this.staticIdIndex.has(staticIdKey)) {
      throw new DuplicateFamilyAuthUserError('Static ID already exists');
    }
    const now = new Date().toISOString();
    const user: FamilyAuthUser = { ...input, createdAt: now, updatedAt: now };
    this.users.set(user.familyMemberId, user);
    this.loginIndex.set(loginKey, user.familyMemberId);
    this.staticIdIndex.set(staticIdKey, user.familyMemberId);
    return user;
  }

  async updatePassword(familyMemberId: string, passwordHash: string, mustChangePassword: boolean): Promise<FamilyAuthUser> {
    const user = this.users.get(familyMemberId);
    if (!user) throw new Error('User not found');
    const nextUser = { ...user, passwordHash, mustChangePassword, updatedAt: new Date().toISOString() };
    this.users.set(familyMemberId, nextUser);
    return nextUser;
  }

  async createSession(session: FamilySession): Promise<FamilySession> {
    this.sessionsById.set(session.sessionId, session);
    this.sessionIdByTokenHash.set(session.tokenHash, session.sessionId);
    return session;
  }

  async findSessionByTokenHash(tokenHash: string): Promise<FamilySession | null> {
    const sessionId = this.sessionIdByTokenHash.get(tokenHash);
    return sessionId ? this.sessionsById.get(sessionId) ?? null : null;
  }

  async updateSessionLastUsedAt(sessionId: string, lastUsedAt: string): Promise<void> {
    const session = this.sessionsById.get(sessionId);
    if (session) this.sessionsById.set(sessionId, { ...session, lastUsedAt });
  }

  async revokeSession(sessionId: string, revokedAt: string): Promise<void> {
    const session = this.sessionsById.get(sessionId);
    if (session) this.sessionsById.set(sessionId, { ...session, revokedAt });
  }

  async revokeOtherSessions(familyMemberId: string, currentSessionId: string, revokedAt: string): Promise<void> {
    for (const session of this.sessionsById.values()) {
      if (session.familyMemberId === familyMemberId && session.sessionId !== currentSessionId && !session.revokedAt) {
        this.sessionsById.set(session.sessionId, { ...session, revokedAt });
      }
    }
  }

  async revokeSessionsForFamilyMember(familyMemberId: string, revokedAt: string): Promise<void> {
    for (const session of this.sessionsById.values()) {
      if (session.familyMemberId === familyMemberId && !session.revokedAt) {
        this.sessionsById.set(session.sessionId, { ...session, revokedAt });
      }
    }
  }
}
