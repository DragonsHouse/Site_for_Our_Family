import type pg from 'pg';
import type { CreateFamilyAuthUserInput, FamilyAuthRepository } from './auth-repository.js';
import type { FamilyAuthUser, FamilyPermission, FamilyRole, FamilySession } from '../types.js';

type AuthUserRow = {
  family_member_id: string;
  login: string;
  static_id: string;
  password_hash: string;
  is_active: boolean;
  must_change_password: boolean;
  role: FamilyRole;
  rank: number;
  permissions: FamilyPermission[];
  created_at: Date;
  updated_at: Date;
  member_status?: string | null;
  member_deleted_at?: Date | null;
};

type SessionRow = {
  session_id: string;
  family_member_id: string;
  token_hash: string;
  login_provider?: 'password' | 'discord';
  created_at: Date;
  expires_at: Date;
  last_used_at: Date;
  revoked_at: Date | null;
  revoked_reason?: string | null;
};

export class PgFamilyAuthRepository implements FamilyAuthRepository {
  constructor(private readonly pool: pg.Pool) {}

  async findUserByLoginOrStaticId(loginOrStaticId: string): Promise<FamilyAuthUser | null> {
    const key = loginOrStaticId.trim().toLowerCase();
    const result = await this.pool.query<AuthUserRow>(
      `select u.*, m.status as member_status, m.deleted_at as member_deleted_at
       from family_auth_users u
       join family_members m on m.id = u.family_member_id
       where lower(u.login) = $1 or lower(u.static_id) = $1
       limit 1`,
      [key],
    );
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async findUserByFamilyMemberId(familyMemberId: string): Promise<FamilyAuthUser | null> {
    const result = await this.pool.query<AuthUserRow>(
      `select u.*, m.status as member_status, m.deleted_at as member_deleted_at
       from family_auth_users u
       join family_members m on m.id = u.family_member_id
       where u.family_member_id = $1`,
      [familyMemberId],
    );
    if (result.rows[0]) return mapUser(result.rows[0]);

    const memberResult = await this.pool.query<AuthUserRow>(
      `select m.id as family_member_id,
              m.nickname as login,
              coalesce(m.static_id, '') as static_id,
              '' as password_hash,
              (m.status <> 'inactive' and m.deleted_at is null) as is_active,
              false as must_change_password,
              m.role,
              m.rank,
              m.permissions,
              m.created_at,
              m.updated_at,
              m.status as member_status,
              m.deleted_at as member_deleted_at
       from family_members m
       where m.id = $1`,
      [familyMemberId],
    );
    return memberResult.rows[0] ? mapUser(memberResult.rows[0]) : null;
  }

  async createUser(input: CreateFamilyAuthUserInput): Promise<FamilyAuthUser> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query(
        `insert into family_members
          (id, nickname, static_id, role, rank, permissions)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (id) do nothing`,
        [input.familyMemberId, input.login, input.staticId, input.role, input.rank, JSON.stringify(input.permissions)],
      );
      const result = await client.query<AuthUserRow>(
        `insert into family_auth_users
          (family_member_id, login, static_id, password_hash, is_active, must_change_password, role, rank, permissions)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         returning *`,
        [
          input.familyMemberId,
          input.login,
          input.staticId,
          input.passwordHash,
          input.isActive,
          input.mustChangePassword,
          input.role,
          input.rank,
          JSON.stringify(input.permissions),
        ],
      );
      await client.query('commit');
      return mapUser(result.rows[0]);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async updatePassword(familyMemberId: string, passwordHash: string, mustChangePassword: boolean): Promise<FamilyAuthUser> {
    const result = await this.pool.query<AuthUserRow>(
      `update family_auth_users
       set password_hash = $2, must_change_password = $3, updated_at = now()
       where family_member_id = $1
       returning *`,
      [familyMemberId, passwordHash, mustChangePassword],
    );
    if (!result.rows[0]) throw new Error('User not found');
    return mapUser(result.rows[0]);
  }

  async createSession(session: FamilySession): Promise<FamilySession> {
    const result = await this.pool.query<SessionRow>(
      `insert into family_sessions
        (session_id, family_member_id, token_hash, login_provider, created_at, expires_at, last_used_at, revoked_at, revoked_reason)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning *`,
      [
        session.sessionId,
        session.familyMemberId,
        session.tokenHash,
        session.loginProvider,
        session.createdAt,
        session.expiresAt,
        session.lastUsedAt,
        session.revokedAt ?? null,
        session.revokedReason ?? null,
      ],
    );
    return mapSession(result.rows[0]);
  }

  async findSessionByTokenHash(tokenHash: string): Promise<FamilySession | null> {
    const result = await this.pool.query<SessionRow>('select * from family_sessions where token_hash = $1 limit 1', [
      tokenHash,
    ]);
    return result.rows[0] ? mapSession(result.rows[0]) : null;
  }

  async updateSessionLastUsedAt(sessionId: string, lastUsedAt: string): Promise<void> {
    await this.pool.query('update family_sessions set last_used_at = $2 where session_id = $1', [sessionId, lastUsedAt]);
  }

  async revokeSession(sessionId: string, revokedAt: string): Promise<void> {
    await this.pool.query(
      `update family_sessions
       set revoked_at = coalesce(revoked_at, $2),
           revoked_reason = coalesce(revoked_reason, 'logout')
       where session_id = $1`,
      [sessionId, revokedAt],
    );
  }

  async revokeOtherSessions(familyMemberId: string, currentSessionId: string, revokedAt: string): Promise<void> {
    await this.pool.query(
      `update family_sessions
       set revoked_at = $3,
           revoked_reason = coalesce(revoked_reason, 'password_changed')
       where family_member_id = $1 and session_id <> $2 and revoked_at is null`,
      [familyMemberId, currentSessionId, revokedAt],
    );
  }

  async revokeSessionsForFamilyMember(familyMemberId: string, revokedAt: string): Promise<void> {
    await this.pool.query(
      `update family_sessions
       set revoked_at = $2,
           revoked_reason = coalesce(revoked_reason, 'member_deactivated')
       where family_member_id = $1 and revoked_at is null`,
      [familyMemberId, revokedAt],
    );
  }
}

function mapUser(row: AuthUserRow): FamilyAuthUser {
  return {
    familyMemberId: row.family_member_id,
    login: row.login,
    staticId: row.static_id,
    passwordHash: row.password_hash,
    isActive: row.is_active && row.member_status !== 'inactive' && !row.member_deleted_at,
    mustChangePassword: row.must_change_password,
    role: row.role,
    rank: row.rank,
    permissions: row.permissions,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapSession(row: SessionRow): FamilySession {
  return {
    sessionId: row.session_id,
    familyMemberId: row.family_member_id,
    tokenHash: row.token_hash,
    loginProvider: row.login_provider ?? 'password',
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    lastUsedAt: row.last_used_at.toISOString(),
    revokedAt: row.revoked_at?.toISOString() ?? null,
    revokedReason: row.revoked_reason ?? null,
  };
}
