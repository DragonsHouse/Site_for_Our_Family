import { authenticatedFetch } from './family-backend-auth-client';
import type { FamilyPermission, FamilyRole } from './family-types';

export type FamilyMemberApiStatus = 'active' | 'inactive';

export type FamilyMemberDto = {
  id: string;
  nickname: string;
  staticId: string;
  role: FamilyRole;
  rank: number;
  status: FamilyMemberApiStatus;
  avatarAssetId: string | null;
  notes: string | null;
  joinedAt: string | null;
  permissions: FamilyPermission[];
  permissionsOverride: FamilyPermission[];
  onboardingMetadata: Record<string, unknown>;
  profileMetadata: Record<string, unknown>;
  deletedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  discord?: {
    linked: boolean;
    discordUserId?: string;
    discordUsername?: string;
    linkedAt?: string;
  };
};

export type FamilyMemberListResponse = {
  items: FamilyMemberDto[];
  page: number;
  pageSize: number;
  total: number;
};

export type FamilyMemberApiErrorCode =
  | 'MEMBER_NOT_FOUND'
  | 'MEMBER_ALREADY_EXISTS'
  | 'MEMBER_STATIC_ID_CONFLICT'
  | 'MEMBER_NICKNAME_CONFLICT'
  | 'MEMBER_VERSION_CONFLICT'
  | 'MEMBER_LAST_OWNER'
  | 'MEMBER_CANNOT_EDIT_FIELD'
  | 'MEMBER_PERMISSION_DENIED'
  | 'MEMBER_INACTIVE'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR';

export class FamilyMemberApiError extends Error {
  constructor(
    readonly code: FamilyMemberApiErrorCode,
    message: string,
    readonly status: number,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'FamilyMemberApiError';
  }
}

export type CreateFamilyMemberDto = {
  nickname: string;
  staticId: string;
  role: FamilyRole;
  rank: number;
  status?: FamilyMemberApiStatus;
  avatarAssetId?: string | null;
  notes?: string | null;
  joinedAt?: string | null;
  permissions?: FamilyPermission[];
  onboardingMetadata?: Record<string, unknown>;
  profileMetadata?: Record<string, unknown>;
};

export type UpdateFamilyMemberDto = Partial<CreateFamilyMemberDto> & {
  version: number;
};

export class FamilyMemberApiClient {
  async listMembers(query: Record<string, string | number | boolean | null | undefined> = {}, signal?: AbortSignal) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined) params.set(key, String(value));
    }
    return parseResponse<FamilyMemberListResponse>(
      await this.getWithRetry(`/api/family/members${params.size ? `?${params.toString()}` : ''}`, signal),
    );
  }

  async getMember(id: string, signal?: AbortSignal) {
    return parseResponse<FamilyMemberDto>(await this.getWithRetry(`/api/family/members/${encodeURIComponent(id)}`, signal));
  }

  async createMember(input: CreateFamilyMemberDto, signal?: AbortSignal) {
    return parseResponse<FamilyMemberDto>(
      await authenticatedFetch('/api/family/members', { method: 'POST', body: JSON.stringify(input), signal }),
    );
  }

  async updateMember(id: string, input: UpdateFamilyMemberDto, signal?: AbortSignal) {
    return parseResponse<FamilyMemberDto>(
      await authenticatedFetch(`/api/family/members/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
        signal,
      }),
    );
  }

  async deleteMember(id: string, version: number, signal?: AbortSignal) {
    return parseResponse<FamilyMemberDto>(
      await authenticatedFetch(`/api/family/members/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        body: JSON.stringify({ version }),
        signal,
      }),
    );
  }

  async restoreMember(id: string, version: number, signal?: AbortSignal) {
    return parseResponse<FamilyMemberDto>(
      await authenticatedFetch(`/api/family/members/${encodeURIComponent(id)}/restore`, {
        method: 'POST',
        body: JSON.stringify({ version }),
        signal,
      }),
    );
  }

  private async getWithRetry(path: string, signal?: AbortSignal) {
    try {
      return await authenticatedFetch(path, { method: 'GET', signal });
    } catch {
      return authenticatedFetch(path, { method: 'GET', signal });
    }
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 401) {
      throw new FamilyMemberApiError('MEMBER_PERMISSION_DENIED', 'Session expired', response.status);
    }
    try {
      const body = (await response.json()) as { code?: FamilyMemberApiErrorCode; message?: string; details?: Record<string, unknown> };
      throw new FamilyMemberApiError(body.code ?? 'NETWORK_ERROR', body.message ?? `Member API failed: ${response.status}`, response.status, body.details ?? {});
    } catch (error) {
      if (error instanceof FamilyMemberApiError) throw error;
      throw new FamilyMemberApiError('NETWORK_ERROR', `Member API failed: ${response.status}`, response.status);
    }
  }
  return (await response.json()) as T;
}
