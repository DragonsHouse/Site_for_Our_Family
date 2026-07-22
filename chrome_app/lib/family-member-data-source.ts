import {
  createFamilyUser,
  deactivateFamilyUser,
  getFamilyUsers,
  updateFamilyUserProfile,
} from './family-auth';
import { FAMILY_ROLE_LABELS, DEFAULT_STATS, ROLE_PERMISSIONS } from './family-data';
import { getFamilyRank } from './family-ranks';
import { FamilyMemberApiClient, type FamilyMemberDto } from './family-member-api-client';
import type { FamilyPermission, FamilyRole, FamilyUser } from './family-types';

export type FamilyMembersDataSourceMode = 'local' | 'api';

export type FamilyMemberCreateInput = Parameters<typeof createFamilyUser>[0];
export type FamilyMemberUpdateInput = Parameters<typeof updateFamilyUserProfile>[1];

export interface FamilyMemberDataSource {
  readonly mode: FamilyMembersDataSourceMode;
  listMembers(signal?: AbortSignal): Promise<FamilyUser[]>;
  createMember(input: FamilyMemberCreateInput, signal?: AbortSignal): Promise<FamilyUser>;
  updateMember(originalNickname: string, input: FamilyMemberUpdateInput, signal?: AbortSignal): Promise<FamilyUser>;
  deleteMember(nickname: string, signal?: AbortSignal): Promise<FamilyUser>;
}

export function getFamilyMembersDataSourceMode(): FamilyMembersDataSourceMode {
  const envMode = typeof import.meta !== 'undefined' ? import.meta.env.FAMILY_MEMBERS_DATA_SOURCE : undefined;
  const localMode =
    typeof window !== 'undefined'
      ? window.localStorage.getItem('dragon_house_family_members_data_source')
      : null;
  return envMode === 'local' || localMode === 'local' ? 'local' : 'api';
}

export function createFamilyMemberDataSource(mode: FamilyMembersDataSourceMode = getFamilyMembersDataSourceMode()): FamilyMemberDataSource {
  return mode === 'api' ? new ApiFamilyMemberDataSource() : new LocalFamilyMemberDataSource();
}

export class LocalFamilyMemberDataSource implements FamilyMemberDataSource {
  readonly mode = 'local' as const;

  async listMembers(): Promise<FamilyUser[]> {
    return getFamilyUsers();
  }

  async createMember(input: FamilyMemberCreateInput): Promise<FamilyUser> {
    return createFamilyUser(input);
  }

  async updateMember(originalNickname: string, input: FamilyMemberUpdateInput): Promise<FamilyUser> {
    return updateFamilyUserProfile(originalNickname, input);
  }

  async deleteMember(nickname: string): Promise<FamilyUser> {
    return deactivateFamilyUser(nickname);
  }
}

export class ApiFamilyMemberDataSource implements FamilyMemberDataSource {
  readonly mode = 'api' as const;

  private readonly client = new FamilyMemberApiClient();

  async listMembers(signal?: AbortSignal): Promise<FamilyUser[]> {
    const response = await this.client.listMembers({ pageSize: 100, includeDeleted: true }, signal);
    return response.items.map(mapDtoToFamilyUser);
  }

  async createMember(input: FamilyMemberCreateInput, signal?: AbortSignal): Promise<FamilyUser> {
    return mapDtoToFamilyUser(
      await this.client.createMember(
        {
          nickname: input.nickname,
          staticId: input.staticId,
          role: input.role,
          rank: input.rankLevel,
          status: input.accountStatus,
          notes: input.notes ?? null,
          joinedAt: input.joinedAt ? new Date(input.joinedAt).toISOString() : null,
          permissions: input.permissions ?? ROLE_PERMISSIONS[input.role],
          profileMetadata: {
            avatarDataUrl: input.avatarDataUrl ?? null,
            discordUserId: input.discordUserId ?? null,
            discordUsername: input.discordUsername ?? null,
          },
        },
        signal,
      ),
    );
  }

  async updateMember(originalNickname: string, input: FamilyMemberUpdateInput, signal?: AbortSignal): Promise<FamilyUser> {
    const existing = (await this.listMembers(signal)).find((member) => member.nickname === originalNickname);
    if (!existing) throw new Error('User not found');
    return mapDtoToFamilyUser(
      await this.client.updateMember(
        existing.id,
        {
          version: Number(existing.externalRevision ?? 1),
          nickname: input.nickname,
          staticId: input.staticId,
          role: input.role,
          rank: input.rankLevel,
          status: input.accountStatus,
          notes: input.notes ?? null,
          joinedAt: input.joinedAt ? new Date(input.joinedAt).toISOString() : null,
          permissions: input.permissions,
          profileMetadata: {
            avatarDataUrl: input.avatarDataUrl ?? null,
            discordUserId: input.discordUserId ?? null,
            discordUsername: input.discordUsername ?? null,
          },
        },
        signal,
      ),
    );
  }

  async deleteMember(nickname: string, signal?: AbortSignal): Promise<FamilyUser> {
    const existing = (await this.listMembers(signal)).find((member) => member.nickname === nickname);
    if (!existing) throw new Error('User not found');
    return mapDtoToFamilyUser(await this.client.deleteMember(existing.id, Number(existing.externalRevision ?? 1), signal));
  }
}

export function mapDtoToFamilyUser(dto: FamilyMemberDto): FamilyUser {
  const rank = getFamilyRank(dto.rank);
  const metadata = dto.profileMetadata as {
    avatarDataUrl?: string | null;
    discordUserId?: string | null;
    discordUsername?: string | null;
  };
  return {
    id: dto.id,
    nickname: dto.nickname,
    staticId: dto.staticId,
    passwordHash: null,
    mustChangePassword: false,
    role: dto.role,
    rank: rank.title,
    rankLevel: rank.level,
    promotionProgress: 0,
    promotionRequirements: { completed: [], remaining: [] },
    lastActive: null,
    isOnline: false,
    displayName: dto.nickname,
    avatarUrl: metadata.avatarDataUrl ?? null,
    avatarDataUrl: metadata.avatarDataUrl ?? null,
    status: 'offline',
    accountStatus: dto.status,
    statusMessage: null,
    nextRank: rank.level < 10 ? getFamilyRank(rank.level + 1).title : null,
    promotionUpdatedAt: dto.updatedAt,
    joinedAt: dto.joinedAt,
    notes: dto.notes,
    permissions: dto.role === 'owner' ? ROLE_PERMISSIONS.owner : dto.permissions,
    stats: { ...DEFAULT_STATS },
    tasks: [],
    deletedAt: dto.deletedAt,
    discordUserId: dto.discord?.discordUserId ?? metadata.discordUserId ?? null,
    discordUsername: dto.discord?.discordUsername ?? metadata.discordUsername ?? null,
    discordDisplayName: null,
    discordAvatarUrl: null,
    discordLinkedAt: dto.discord?.linkedAt ?? null,
    discordSyncedAt: null,
    discordLinkStatus: dto.discord?.linked ? 'linked' : 'not_linked',
    externalSource: 'family_hub',
    externalId: dto.id,
    externalRevision: String(dto.version),
    externalCreatedAt: dto.createdAt,
    externalUpdatedAt: dto.updatedAt,
    lastSyncedAt: null,
    syncStatus: 'local_only',
    syncError: null,
  };
}
