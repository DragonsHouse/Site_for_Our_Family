import { describe, expect, it, vi } from 'vitest';
import { InMemoryFamilyAuthRepository } from '../auth/auth-repository.js';
import type { FamilyAuthContext, FamilyMember } from '../types.js';
import { MemoryFamilyMemberRepository } from './member-repository.js';
import { FamilyMemberService } from './member-service.js';

const ownerAuth: FamilyAuthContext = {
  familyMemberId: 'owner-id',
  role: 'owner',
  rank: 10,
  permissions: [],
};

const memberAuth: FamilyAuthContext = {
  familyMemberId: 'member-id',
  role: 'member',
  rank: 1,
  permissions: ['view_members'],
};

function member(input: Partial<FamilyMember> & Pick<FamilyMember, 'id' | 'nickname' | 'staticId'>): FamilyMember {
  const now = '2026-07-17T00:00:00.000Z';
  return {
    id: input.id,
    nickname: input.nickname,
    staticId: input.staticId,
    role: input.role ?? 'member',
    rank: input.rank ?? 1,
    status: input.status ?? 'active',
    avatarAssetId: null,
    notes: null,
    joinedAt: null,
    permissions: input.permissions ?? [],
    permissionsOverride: input.permissionsOverride ?? [],
    permissionsDiscord: input.permissionsDiscord ?? [],
    permissionsDenied: input.permissionsDenied ?? [],
    onboardingMetadata: {},
    profileMetadata: {},
    deletedAt: null,
    version: input.version ?? 1,
    createdByFamilyMemberId: null,
    updatedByFamilyMemberId: null,
    createdAt: now,
    updatedAt: now,
  };
}

describe('FamilyMemberService', () => {
  it('lists members for authenticated viewer', async () => {
    const repository = new MemoryFamilyMemberRepository([member({ id: 'member-id', nickname: 'Member', staticId: '1' })]);
    const service = new FamilyMemberService(repository, null);
    const result = await service.list(
      { page: 1, pageSize: 25, sortBy: 'nickname', sortOrder: 'asc', includeDeleted: false },
      memberAuth,
    );
    expect(result.total).toBe(1);
  });

  it('requires permission to create member', async () => {
    const service = new FamilyMemberService(new MemoryFamilyMemberRepository(), null);
    await expect(
      service.create({ nickname: 'New', staticId: '2', role: 'member', rank: 1 }, memberAuth),
    ).rejects.toMatchObject({ code: 'MEMBER_PERMISSION_DENIED' });
  });

  it('generates immutable ID and preserves it after nickname change', async () => {
    const repository = new MemoryFamilyMemberRepository();
    const service = new FamilyMemberService(repository, null);
    const created = await service.create({ nickname: 'First', staticId: '2', role: 'member', rank: 1 }, ownerAuth);
    const renamed = await service.update(created.id, { nickname: 'Second' }, created.version, ownerAuth);
    expect(renamed.id).toBe(created.id);
    expect(renamed.nickname).toBe('Second');
  });

  it('rejects duplicate static ID', async () => {
    const repository = new MemoryFamilyMemberRepository([member({ id: 'a', nickname: 'A', staticId: '100' })]);
    const service = new FamilyMemberService(repository, null);
    await expect(
      service.create({ nickname: 'B', staticId: '100', role: 'member', rank: 1 }, ownerAuth),
    ).rejects.toMatchObject({ code: 'MEMBER_STATIC_ID_CONFLICT' });
  });

  it('blocks unauthorized role change', async () => {
    const repository = new MemoryFamilyMemberRepository([member({ id: 'member-id', nickname: 'M', staticId: '1' })]);
    const service = new FamilyMemberService(repository, null);
    await expect(service.update('member-id', { role: 'deputy' }, 1, memberAuth)).rejects.toMatchObject({
      code: 'MEMBER_PERMISSION_DENIED',
    });
  });

  it('protects the last active owner', async () => {
    const repository = new MemoryFamilyMemberRepository([
      member({ id: 'owner-id', nickname: 'Owner', staticId: '1', role: 'owner', rank: 10 }),
    ]);
    const service = new FamilyMemberService(repository, null);
    await expect(service.softDelete('owner-id', 1, ownerAuth)).rejects.toMatchObject({ code: 'MEMBER_LAST_OWNER' });
  });

  it('soft deletes and revokes sessions', async () => {
    const repository = new MemoryFamilyMemberRepository([
      member({ id: 'owner-id', nickname: 'Owner', staticId: '1', role: 'owner', rank: 10 }),
      member({ id: 'victim-id', nickname: 'Victim', staticId: '2' }),
    ]);
    const authRepository = new InMemoryFamilyAuthRepository();
    const revoke = vi.spyOn(authRepository, 'revokeSessionsForFamilyMember');
    const service = new FamilyMemberService(repository, authRepository);
    const deleted = await service.softDelete('victim-id', 1, ownerAuth);
    expect(deleted.deletedAt).toBeTruthy();
    expect(revoke).toHaveBeenCalledWith('victim-id', expect.any(String));
  });

  it('restores a soft-deleted member', async () => {
    const repository = new MemoryFamilyMemberRepository([
      member({ id: 'owner-id', nickname: 'Owner', staticId: '1', role: 'owner', rank: 10 }),
      { ...member({ id: 'restored-id', nickname: 'Restored', staticId: '2', status: 'inactive', version: 2 }), deletedAt: '2026-07-17T01:00:00.000Z' },
    ]);
    const service = new FamilyMemberService(repository, null);
    const restored = await service.restore('restored-id', 2, ownerAuth);
    expect(restored.status).toBe('active');
    expect(restored.deletedAt).toBeNull();
  });

  it('returns version conflict on stale update', async () => {
    const repository = new MemoryFamilyMemberRepository([member({ id: 'm', nickname: 'M', staticId: '1', version: 3 })]);
    const service = new FamilyMemberService(repository, null);
    await expect(service.update('m', { notes: 'x' }, 2, ownerAuth)).rejects.toMatchObject({
      code: 'MEMBER_VERSION_CONFLICT',
    });
  });

  it('writes audit log for mutations', async () => {
    const repository = new MemoryFamilyMemberRepository();
    const service = new FamilyMemberService(repository, null);
    await service.create({ nickname: 'Audited', staticId: '9', role: 'member', rank: 1 }, ownerAuth);
    expect(repository.auditEntries[0]?.action).toBe('member_created');
  });

  it('does not expose private notes without permission', async () => {
    const repository = new MemoryFamilyMemberRepository([member({ id: 'other', nickname: 'Other', staticId: '1', notes: 'secret' })]);
    const service = new FamilyMemberService(repository, null);
    const result = await service.get('other', memberAuth);
    expect(result.notes).toBeNull();
  });
});
