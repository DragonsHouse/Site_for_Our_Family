import { randomUUID } from 'node:crypto';
import type { FamilyAuthRepository } from '../auth/auth-repository.js';
import type {
  CreateFamilyMemberInput,
  FamilyAuthContext,
  FamilyMember,
  FamilyMemberListQuery,
  FamilyMemberListResult,
  FamilyPermission,
  UpdateFamilyMemberInput,
} from '../types.js';
import { FamilyMemberError } from './member-errors.js';
import type { FamilyMemberAuditAction, FamilyMemberRepository } from './member-repository.js';

const OWNER_PERMISSIONS: FamilyPermission[] = [
  'view_members',
  'manage_members',
  'manage_member_roles',
  'manage_member_auth',
  'delete_members',
  'restore_members',
  'view_member_private_fields',
];

export class FamilyMemberService {
  constructor(
    private readonly repository: FamilyMemberRepository,
    private readonly authRepository: FamilyAuthRepository | null,
  ) {}

  async list(query: FamilyMemberListQuery, auth: FamilyAuthContext): Promise<FamilyMemberListResult> {
    this.requirePermission(auth, 'view_members');
    if (query.includeDeleted && !this.hasPermission(auth, 'restore_members')) {
      throw new FamilyMemberError('MEMBER_PERMISSION_DENIED', 'Missing restore_members', 403);
    }
    return this.repository.list(query);
  }

  async get(id: string, auth: FamilyAuthContext): Promise<FamilyMember> {
    if (auth.familyMemberId !== id) this.requirePermission(auth, 'view_members');
    const member = await this.repository.findById(id);
    if (!member || member.deletedAt) throw new FamilyMemberError('MEMBER_NOT_FOUND', 'Member not found', 404);
    return this.toSafeDto(member, auth);
  }

  async create(input: CreateFamilyMemberInput, auth: FamilyAuthContext): Promise<FamilyMember> {
    this.requirePermission(auth, 'manage_members');
    await this.assertUnique(input.nickname, input.staticId ?? null);
    if (input.role === 'owner' && auth.role !== 'owner') {
      throw new FamilyMemberError('MEMBER_PERMISSION_DENIED', 'Only owner can create owner', 403);
    }
    if (input.role !== 'member' || input.rank !== 1 || input.permissions?.length) {
      this.requirePermission(auth, 'manage_member_roles');
    }
    const member = await this.repository.create(
      {
        ...input,
        id: randomUUID(),
        status: input.status ?? 'active',
        permissions: input.role === 'owner' ? uniquePermissions([...(input.permissions ?? []), ...OWNER_PERMISSIONS]) : input.permissions ?? [],
      },
      auth.familyMemberId,
    );
    await this.audit('member_created', auth.familyMemberId, member.id, null, member);
    return this.toSafeDto(member, auth);
  }

  async update(id: string, input: UpdateFamilyMemberInput, expectedVersion: number, auth: FamilyAuthContext): Promise<FamilyMember> {
    const current = await this.repository.findById(id);
    if (!current) throw new FamilyMemberError('MEMBER_NOT_FOUND', 'Member not found', 404);
    this.assertCanUpdate(auth, current, input);
    if (input.nickname && input.nickname !== current.nickname) {
      if (await this.repository.existsByNickname(input.nickname, id)) {
        throw new FamilyMemberError('MEMBER_NICKNAME_CONFLICT', 'Nickname conflict', 409);
      }
    }
    if (input.staticId !== undefined && input.staticId !== current.staticId) {
      this.requirePermission(auth, 'manage_member_auth');
      if (input.staticId && await this.repository.existsByStaticId(input.staticId, id)) {
        throw new FamilyMemberError('MEMBER_STATIC_ID_CONFLICT', 'Static ID conflict', 409);
      }
    }
    await this.assertOwnerMutationAllowed(current, input);
    const next = await this.repository.update(id, input, expectedVersion, auth.familyMemberId);
    if (!next) throw new FamilyMemberError('MEMBER_VERSION_CONFLICT', 'Version conflict', 409);
    if ((input.status === 'inactive' || input.status === 'active') && input.status !== current.status) {
      await this.audit('member_status_changed', auth.familyMemberId, id, current, next);
      if (input.status === 'inactive') await this.authRepository?.revokeSessionsForFamilyMember(id, new Date().toISOString());
    } else if (input.role && input.role !== current.role) {
      await this.audit('member_role_changed', auth.familyMemberId, id, current, next);
    } else {
      await this.audit('member_updated', auth.familyMemberId, id, current, next);
    }
    return this.toSafeDto(next, auth);
  }

  async softDelete(id: string, expectedVersion: number, auth: FamilyAuthContext): Promise<FamilyMember> {
    this.requirePermission(auth, 'delete_members');
    const current = await this.repository.findById(id);
    if (!current) throw new FamilyMemberError('MEMBER_NOT_FOUND', 'Member not found', 404);
    await this.assertOwnerMutationAllowed(current, { status: 'inactive' });
    const next = await this.repository.softDelete(id, expectedVersion, auth.familyMemberId);
    if (!next) throw new FamilyMemberError('MEMBER_VERSION_CONFLICT', 'Version conflict', 409);
    await this.authRepository?.revokeSessionsForFamilyMember(id, new Date().toISOString());
    await this.audit('member_deleted', auth.familyMemberId, id, current, next);
    return this.toSafeDto(next, auth);
  }

  async restore(id: string, expectedVersion: number, auth: FamilyAuthContext): Promise<FamilyMember> {
    this.requirePermission(auth, 'restore_members');
    const current = await this.repository.findById(id);
    if (!current) throw new FamilyMemberError('MEMBER_NOT_FOUND', 'Member not found', 404);
    const next = await this.repository.restore(id, expectedVersion, auth.familyMemberId);
    if (!next) throw new FamilyMemberError('MEMBER_VERSION_CONFLICT', 'Version conflict', 409);
    await this.audit('member_restored', auth.familyMemberId, id, current, next);
    return this.toSafeDto(next, auth);
  }

  private assertCanUpdate(auth: FamilyAuthContext, member: FamilyMember, input: UpdateFamilyMemberInput): void {
    const isSelf = auth.familyMemberId === member.id;
    if (!isSelf) this.requirePermission(auth, 'manage_members');
    const roleFields: Array<keyof UpdateFamilyMemberInput> = [
      'role',
      'rank',
      'permissions',
      'permissionsOverride',
      'permissionsDiscord',
      'permissionsDenied',
    ];
    if (roleFields.some((field) => input[field] !== undefined)) {
      this.requirePermission(auth, 'manage_member_roles');
      if (input.role === 'owner' && auth.role !== 'owner') {
        throw new FamilyMemberError('MEMBER_PERMISSION_DENIED', 'Only owner can grant owner', 403);
      }
    }
    const authFields: Array<keyof UpdateFamilyMemberInput> = ['staticId'];
    if (authFields.some((field) => input[field] !== undefined)) this.requirePermission(auth, 'manage_member_auth');
    if (isSelf && !this.hasPermission(auth, 'manage_members')) {
      const allowed: Array<keyof UpdateFamilyMemberInput> = ['avatarAssetId', 'notes', 'profileMetadata'];
      const denied = Object.keys(input).filter((key) => !allowed.includes(key as keyof UpdateFamilyMemberInput));
      if (denied.length) {
        throw new FamilyMemberError('MEMBER_CANNOT_EDIT_FIELD', 'Self edit is limited', 403, { fields: denied });
      }
    }
  }

  private async assertOwnerMutationAllowed(current: FamilyMember, input: UpdateFamilyMemberInput): Promise<void> {
    const removesOwnerRole = current.role === 'owner' && input.role !== undefined && input.role !== 'owner';
    const deactivatesOwner = current.role === 'owner' && input.status === 'inactive';
    if ((removesOwnerRole || deactivatesOwner) && (await this.repository.countActiveOwners()) <= 1) {
      throw new FamilyMemberError('MEMBER_LAST_OWNER', 'Last owner protected', 409);
    }
  }

  private async assertUnique(nickname: string, staticId: string | null): Promise<void> {
    if (await this.repository.existsByNickname(nickname)) {
      throw new FamilyMemberError('MEMBER_NICKNAME_CONFLICT', 'Nickname conflict', 409);
    }
    if (staticId && await this.repository.existsByStaticId(staticId)) {
      throw new FamilyMemberError('MEMBER_STATIC_ID_CONFLICT', 'Static ID conflict', 409);
    }
  }

  private hasPermission(auth: FamilyAuthContext, permission: FamilyPermission): boolean {
    return auth.role === 'owner' || auth.permissions.includes(permission);
  }

  private requirePermission(auth: FamilyAuthContext, permission: FamilyPermission): void {
    if (!this.hasPermission(auth, permission)) {
      throw new FamilyMemberError('MEMBER_PERMISSION_DENIED', 'Permission denied', 403, { permission });
    }
  }

  private async audit(
    action: FamilyMemberAuditAction,
    actorId: string,
    entityId: string,
    beforeData: unknown,
    afterData: unknown,
  ): Promise<void> {
    await this.repository.recordAudit({
      actorFamilyMemberId: actorId,
      action,
      entityId,
      beforeData,
      afterData,
      metadata: null,
    });
  }

  private toSafeDto(member: FamilyMember, auth: FamilyAuthContext): FamilyMember {
    if (this.hasPermission(auth, 'view_member_private_fields')) return member;
    return { ...member, notes: auth.familyMemberId === member.id ? member.notes : null };
  }
}

function uniquePermissions(permissions: FamilyPermission[]): FamilyPermission[] {
  return [...new Set(permissions)];
}
