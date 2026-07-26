import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { InMemoryFamilyAuthRepository } from '../auth/auth-repository.js';
import { hashPassword } from '../auth/password.js';
import { MemoryFamilyMemberRepository } from '../members/member-repository.js';
import { createTestConfig } from '../test/test-config.js';
import type { FamilyMember, FamilyPermission, FamilyRole } from '../types.js';

const servers: Array<{ close: (callback?: (error?: Error) => void) => void }> = [];

async function createHarness() {
  const config = createTestConfig({ bcryptCost: 10 });
  const authRepository = new InMemoryFamilyAuthRepository();
  const memberRepository = new MemoryFamilyMemberRepository([
    member({
      id: 'owner-id',
      nickname: 'Owner_Dragons',
      staticId: '100',
      role: 'owner',
      rank: 10,
      permissions: ['view_members'],
      joinedAt: '2026-01-01T00:00:00.000Z',
      profileMetadata: { avatarDataUrl: 'data:image/png;base64,owner' },
      discord: {
        linked: true,
        discordUserId: 'discord-owner',
        discordUsername: 'owner_user',
        discordGlobalName: 'Owner Global',
        discordServerNickname: 'Owner Server',
        discordAvatar: 'https://cdn.example.test/owner.png',
      },
    }),
    member({
      id: 'alpha-id',
      nickname: 'Alpha_Dragons',
      staticId: '101',
      role: 'member',
      rank: 2,
      joinedAt: null,
      permissions: ['manage_members'],
      notes: 'private alpha note',
      onboardingMetadata: { private: true },
      profileMetadata: { avatarDataUrl: 'data:image/png;base64,alpha' },
    }),
    member({
      id: 'beta-id',
      nickname: 'Beta_Dragons',
      staticId: '102',
      role: 'moderator',
      rank: 4,
      status: 'inactive',
      joinedAt: '2026-02-01T00:00:00.000Z',
      discord: { linked: false },
    }),
    {
      ...member({
        id: 'deleted-id',
        nickname: 'Deleted_Dragons',
        staticId: '103',
        role: 'member',
        rank: 1,
        status: 'inactive',
      }),
      deletedAt: '2026-03-01T00:00:00.000Z',
    },
  ]);
  const authUsers: Array<{
    id: string;
    login: string;
    staticId: string;
    password: string;
    role: FamilyRole;
    rank: number;
    permissions: FamilyPermission[];
  }> = [
    { id: 'owner-id', login: 'Owner_Dragons', staticId: '100', password: '100', role: 'owner' as const, rank: 10, permissions: ['view_members'] },
    { id: 'alpha-id', login: 'Alpha_Dragons', staticId: '101', password: '101', role: 'member' as const, rank: 2, permissions: [] },
    { id: 'beta-id', login: 'Beta_Dragons', staticId: '102', password: '102', role: 'moderator' as const, rank: 4, permissions: [] },
  ];
  for (const item of authUsers) {
    await authRepository.createUser({
      familyMemberId: item.id,
      login: item.login,
      staticId: item.staticId,
      passwordHash: await hashPassword(item.password, config.bcryptCost),
      isActive: true,
      mustChangePassword: false,
      role: item.role,
      rank: item.rank,
      permissions: item.permissions,
    });
  }
  const { app } = createApp(config, { authRepository, memberRepository });
  const server = app.listen(0);
  servers.push(server);
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return { baseUrl, memberRepository };
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
});

describe('family member directory route', () => {
  it('allows ordinary authenticated members to view the active directory and rejects unauthenticated requests', async () => {
    const { baseUrl } = await createHarness();
    const token = await login(baseUrl, 'Alpha_Dragons', '101');

    const unauthenticated = await fetch(`${baseUrl}/api/family/directory`);
    const authenticated = await fetch(`${baseUrl}/api/family/directory`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const explicitActive = await fetch(`${baseUrl}/api/family/directory?status=active`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(unauthenticated.status).toBe(401);
    expect(authenticated.status).toBe(200);
    expect(explicitActive.status).toBe(200);
  });

  it('returns only the allowlisted safe projection fields', async () => {
    const { baseUrl } = await createHarness();
    const token = await login(baseUrl, 'Owner_Dragons', '100');

    const response = await fetch(`${baseUrl}/api/family/directory?status=all&sort=displayName&order=asc`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json() as { items: Array<Record<string, unknown>> };
    const item = body.items.find((candidate) => candidate.memberId === 'owner-id');

    expect(response.status).toBe(200);
    expect(item).toEqual({
      memberId: 'owner-id',
      displayName: 'Owner Server',
      role: 'owner',
      rank: { level: 10, title: null },
      status: 'active',
      avatarUrl: 'data:image/png;base64,owner',
      discord: {
        linked: true,
        displayName: 'Owner Server',
        serverNickname: 'Owner Server',
        avatarUrl: 'https://cdn.example.test/owner.png',
      },
      joinedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(JSON.stringify(item)).not.toContain('staticId');
    expect(JSON.stringify(item)).not.toContain('discordUserId');
    expect(JSON.stringify(item)).not.toContain('permissions');
    expect(JSON.stringify(item)).not.toContain('notes');
    expect(JSON.stringify(item)).not.toContain('Metadata');
    expect(JSON.stringify(item)).not.toContain('version');
    expect(JSON.stringify(item)).not.toContain('deletedAt');
    expect(JSON.stringify(item)).not.toContain('session');
    expect(JSON.stringify(item)).not.toContain('password');
    expect(JSON.stringify(item)).not.toContain('oauth');
  });

  it('returns null for rank title until a canonical rank-title source exists', async () => {
    const { baseUrl } = await createHarness();
    const token = await login(baseUrl, 'Alpha_Dragons', '101');

    const body = await getDirectory(baseUrl, token, '?status=active');
    const alpha = body.items.find((item) => item.memberId === 'alpha-id');

    expect(alpha?.rank).toEqual({ level: 2, title: null });
  });

  it('requires view_members to request inactive or all directory members', async () => {
    const { baseUrl } = await createHarness();
    const ordinaryToken = await login(baseUrl, 'Alpha_Dragons', '101');
    const privilegedToken = await login(baseUrl, 'Owner_Dragons', '100');

    for (const status of ['inactive', 'all']) {
      const response = await fetch(`${baseUrl}/api/family/directory?status=${status}`, {
        headers: { Authorization: `Bearer ${ordinaryToken}` },
      });
      expect(response.status).toBe(403);
    }

    const inactive = await getDirectory(baseUrl, privilegedToken, '?status=inactive');
    const all = await getDirectory(baseUrl, privilegedToken, '?status=all&pageSize=50');

    expect(inactive.items.map((item) => item.memberId)).toEqual(['beta-id']);
    expect(all.items.map((item) => item.memberId)).not.toContain('deleted-id');
    expect(all.items.map((item) => item.memberId).sort()).toEqual(['alpha-id', 'beta-id', 'owner-id']);
  });

  it('handles linked, unlinked, missing avatar, missing nickname and deleted states safely', async () => {
    const { baseUrl } = await createHarness();
    const token = await login(baseUrl, 'Owner_Dragons', '100');

    const response = await fetch(`${baseUrl}/api/family/directory?status=all&pageSize=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json() as { items: Array<Record<string, unknown>> };
    const beta = body.items.find((item) => item.memberId === 'beta-id') as Record<string, unknown>;

    expect(body.items.map((item) => item.memberId)).not.toContain('deleted-id');
    expect(beta).toMatchObject({
      displayName: 'Beta_Dragons',
      status: 'inactive',
      avatarUrl: null,
      discord: { linked: false, displayName: null, serverNickname: null, avatarUrl: null },
      joinedAt: '2026-02-01T00:00:00.000Z',
    });
  });

  it('supports pagination, search, filters, sorting and normalized invalid query values', async () => {
    const { baseUrl } = await createHarness();
    const token = await login(baseUrl, 'Owner_Dragons', '100');

    const defaults = await getDirectory(baseUrl, token, '');
    expect(defaults.pagination).toMatchObject({ page: 1, pageSize: 24, totalItems: 2, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
    expect(defaults.items.map((item) => item.memberId)).toEqual(['owner-id', 'alpha-id']);

    const page = await getDirectory(baseUrl, token, '?status=all&page=2&pageSize=1&sort=displayName&order=asc');
    expect(page.pagination).toMatchObject({ page: 2, pageSize: 1, totalItems: 3, totalPages: 3, hasNextPage: true, hasPreviousPage: true });

    const clamped = await getDirectory(baseUrl, token, '?status=all&pageSize=999');
    expect(clamped.pagination.pageSize).toBe(24);

    const searched = await getDirectory(baseUrl, token, '?search=%20%20Alpha%20%20');
    expect(searched.items.map((item) => item.memberId)).toEqual(['alpha-id']);

    const whitespaceSearch = await getDirectory(baseUrl, token, '?search=%20%20');
    expect(whitespaceSearch.pagination.totalItems).toBe(2);

    const roleFiltered = await getDirectory(baseUrl, token, '?status=all&role=moderator');
    expect(roleFiltered.items.map((item) => item.memberId)).toEqual(['beta-id']);

    const inactive = await getDirectory(baseUrl, token, '?status=inactive');
    expect(inactive.items.map((item) => item.memberId)).toEqual(['beta-id']);

    for (const sort of ['displayName', 'rank', 'role', 'joinedAt']) {
      const sorted = await getDirectory(baseUrl, token, `?status=all&sort=${sort}&order=asc`);
      expect(sorted.pagination.totalItems).toBe(3);
    }

    const invalid = await getDirectory(baseUrl, token, '?page=-1&pageSize=0&role=bad&status=bad&sort=bad&order=bad');
    expect(invalid.pagination).toMatchObject({ page: 1, pageSize: 24, totalItems: 2 });
    expect(invalid.items.map((item) => item.memberId)).toEqual(['owner-id', 'alpha-id']);
  });

  it('keeps existing management list and legacy alias contracts unchanged', async () => {
    const { baseUrl } = await createHarness();
    const token = await login(baseUrl, 'Owner_Dragons', '100');

    for (const path of ['/api/family/members?pageSize=100&includeDeleted=true', '/api/members?pageSize=100&includeDeleted=true']) {
      const response = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json() as { items: Array<Record<string, unknown>> };

      expect(response.status).toBe(200);
      expect(body.items[0]).toHaveProperty('staticId');
      expect(body.items[0]).toHaveProperty('permissions');
      expect(body.items[0]).toHaveProperty('version');
      expect(body.items[0]).toHaveProperty('deletedAt');
    }
  });
});

async function login(baseUrl: string, loginOrStaticId: string, password: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginOrStaticId, password }),
  });
  const body = await response.json() as { token: string };
  return body.token;
}

async function getDirectory(baseUrl: string, token: string, query: string) {
  const response = await fetch(`${baseUrl}/api/family/directory${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.status).toBe(200);
  return response.json() as Promise<{
    items: Array<{ memberId: string; rank: { level: number; title: string | null } }>;
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  }>;
}

function member(overrides: Partial<FamilyMember> & { id: string; nickname: string; staticId: string | null; role?: FamilyRole }): FamilyMember {
  const now = '2026-07-26T00:00:00.000Z';
  return {
    id: overrides.id,
    nickname: overrides.nickname,
    staticId: overrides.staticId,
    role: overrides.role ?? 'member',
    rank: overrides.rank ?? 1,
    status: overrides.status ?? 'active',
    avatarAssetId: overrides.avatarAssetId ?? null,
    notes: overrides.notes ?? null,
    joinedAt: overrides.joinedAt ?? null,
    permissions: overrides.permissions ?? [],
    permissionsOverride: overrides.permissionsOverride ?? [],
    permissionsDiscord: overrides.permissionsDiscord ?? [],
    permissionsDenied: overrides.permissionsDenied ?? [],
    onboardingMetadata: overrides.onboardingMetadata ?? {},
    profileMetadata: overrides.profileMetadata ?? {},
    deletedAt: overrides.deletedAt ?? null,
    version: overrides.version ?? 1,
    createdByFamilyMemberId: overrides.createdByFamilyMemberId ?? null,
    updatedByFamilyMemberId: overrides.updatedByFamilyMemberId ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    discord: overrides.discord,
  };
}
