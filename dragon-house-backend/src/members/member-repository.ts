import type {
  CreateFamilyMemberInput,
  FamilyMember,
  FamilyMemberListQuery,
  FamilyMemberListResult,
  UpdateFamilyMemberInput,
} from '../types.js';

export type FamilyMemberAuditAction =
  | 'member_created'
  | 'member_updated'
  | 'member_role_changed'
  | 'member_status_changed'
  | 'member_deleted'
  | 'member_restored'
  | 'discord_sync_permissions_changed';

export type FamilyMemberAuditEntry = {
  actorFamilyMemberId: string | null;
  action: FamilyMemberAuditAction;
  entityId: string;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: Record<string, unknown> | null;
};

export interface FamilyMemberRepository {
  list(query: FamilyMemberListQuery): Promise<FamilyMemberListResult>;
  findById(id: string): Promise<FamilyMember | null>;
  findByStaticId(staticId: string): Promise<FamilyMember | null>;
  create(input: CreateFamilyMemberInput & { id: string }, actorId: string): Promise<FamilyMember>;
  update(id: string, input: UpdateFamilyMemberInput, expectedVersion: number, actorId: string): Promise<FamilyMember | null>;
  softDelete(id: string, expectedVersion: number, actorId: string): Promise<FamilyMember | null>;
  restore(id: string, expectedVersion: number, actorId: string): Promise<FamilyMember | null>;
  countActiveOwners(): Promise<number>;
  existsByNickname(nickname: string, excludingId?: string): Promise<boolean>;
  existsByStaticId(staticId: string, excludingId?: string): Promise<boolean>;
  recordAudit(entry: FamilyMemberAuditEntry): Promise<void>;
}

export class MemoryFamilyMemberRepository implements FamilyMemberRepository {
  private readonly members = new Map<string, FamilyMember>();

  readonly auditEntries: FamilyMemberAuditEntry[] = [];

  constructor(seed: FamilyMember[] = []) {
    for (const member of seed) this.members.set(member.id, member);
  }

  async list(query: FamilyMemberListQuery): Promise<FamilyMemberListResult> {
    const search = query.search?.trim().toLowerCase();
    let items = [...this.members.values()].filter((member) => query.includeDeleted || !member.deletedAt);
    if (search) {
      items = items.filter(
        (member) => member.nickname.toLowerCase().includes(search) || Boolean(member.staticId?.toLowerCase().includes(search)),
      );
    }
    if (query.status && query.status !== 'all') items = items.filter((member) => member.status === query.status);
    if (query.role && query.role !== 'all') items = items.filter((member) => member.role === query.role);
    if (query.rank) items = items.filter((member) => member.rank === query.rank);
    const total = items.length;
    const direction = query.sortOrder === 'asc' ? 1 : -1;
    items.sort((left, right) => String(valueForSort(left, query.sortBy)).localeCompare(String(valueForSort(right, query.sortBy))) * direction);
    const start = (query.page - 1) * query.pageSize;
    return { items: items.slice(start, start + query.pageSize), page: query.page, pageSize: query.pageSize, total };
  }

  async findById(id: string): Promise<FamilyMember | null> {
    return this.members.get(id) ?? null;
  }

  async findByStaticId(staticId: string): Promise<FamilyMember | null> {
    const key = staticId.toLowerCase();
    return [...this.members.values()].find((member) => member.staticId?.toLowerCase() === key) ?? null;
  }

  async create(input: CreateFamilyMemberInput & { id: string }, actorId: string): Promise<FamilyMember> {
    const now = new Date().toISOString();
    const member: FamilyMember = {
      id: input.id,
      nickname: input.nickname,
      staticId: input.staticId ?? null,
      role: input.role,
      rank: input.rank,
      status: input.status ?? 'active',
      avatarAssetId: input.avatarAssetId ?? null,
      notes: input.notes ?? null,
      joinedAt: input.joinedAt ?? null,
      permissions: input.permissions ?? [],
      permissionsOverride: input.permissionsOverride ?? [],
      permissionsDiscord: input.permissionsDiscord ?? [],
      permissionsDenied: input.permissionsDenied ?? [],
      onboardingMetadata: input.onboardingMetadata ?? {},
      profileMetadata: input.profileMetadata ?? {},
      deletedAt: null,
      version: 1,
      createdByFamilyMemberId: actorId,
      updatedByFamilyMemberId: actorId,
      createdAt: now,
      updatedAt: now,
    };
    this.members.set(member.id, member);
    return member;
  }

  async update(id: string, input: UpdateFamilyMemberInput, expectedVersion: number, actorId: string): Promise<FamilyMember | null> {
    const current = this.members.get(id);
    if (!current || current.version !== expectedVersion) return null;
    const next: FamilyMember = {
      ...current,
      ...input,
      avatarAssetId: input.avatarAssetId === undefined ? current.avatarAssetId : input.avatarAssetId,
      notes: input.notes === undefined ? current.notes : input.notes,
      joinedAt: input.joinedAt === undefined ? current.joinedAt : input.joinedAt,
      permissions: input.permissions ?? current.permissions,
      permissionsOverride: input.permissionsOverride ?? current.permissionsOverride,
      permissionsDiscord: input.permissionsDiscord ?? current.permissionsDiscord,
      permissionsDenied: input.permissionsDenied ?? current.permissionsDenied,
      onboardingMetadata: input.onboardingMetadata ?? current.onboardingMetadata,
      profileMetadata: input.profileMetadata ?? current.profileMetadata,
      version: current.version + 1,
      updatedByFamilyMemberId: actorId,
      updatedAt: new Date().toISOString(),
    };
    this.members.set(id, next);
    return next;
  }

  async softDelete(id: string, expectedVersion: number, actorId: string): Promise<FamilyMember | null> {
    const member = await this.update(id, { status: 'inactive' }, expectedVersion, actorId);
    if (!member) return null;
    const deleted = { ...member, deletedAt: member.deletedAt ?? member.updatedAt };
    this.members.set(id, deleted);
    return deleted;
  }

  async restore(id: string, expectedVersion: number, actorId: string): Promise<FamilyMember | null> {
    const member = await this.update(id, { status: 'active' }, expectedVersion, actorId);
    if (!member) return null;
    const restored = { ...member, deletedAt: null };
    this.members.set(id, restored);
    return restored;
  }

  async countActiveOwners(): Promise<number> {
    return [...this.members.values()].filter((member) => member.role === 'owner' && member.status === 'active' && !member.deletedAt).length;
  }

  async existsByNickname(nickname: string, excludingId?: string): Promise<boolean> {
    const key = nickname.toLowerCase();
    return [...this.members.values()].some((member) => member.id !== excludingId && member.nickname.toLowerCase() === key);
  }

  async existsByStaticId(staticId: string, excludingId?: string): Promise<boolean> {
    const key = staticId.toLowerCase();
    return [...this.members.values()].some((member) => member.id !== excludingId && member.staticId?.toLowerCase() === key);
  }

  async recordAudit(entry: FamilyMemberAuditEntry): Promise<void> {
    this.auditEntries.push(entry);
  }
}

function valueForSort(member: FamilyMember, sortBy: FamilyMemberListQuery['sortBy']): string | number | null {
  if (sortBy === 'staticId') return member.staticId;
  if (sortBy === 'joinedAt') return member.joinedAt;
  return member[sortBy];
}
