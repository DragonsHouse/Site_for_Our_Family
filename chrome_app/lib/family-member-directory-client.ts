import { authenticatedFetch } from './family-backend-auth-client';
import type { FamilyRole } from './family-types';

export type FamilyMemberDirectoryStatus = 'active' | 'inactive';
export type FamilyMemberDirectoryStatusFilter = FamilyMemberDirectoryStatus | 'all';
export type FamilyMemberDirectoryRoleFilter = FamilyRole | 'all';
export type FamilyMemberDirectorySort = 'displayName' | 'rank' | 'role' | 'joinedAt';
export type FamilyMemberDirectoryOrder = 'asc' | 'desc';

export type FamilyMemberDirectoryItem = {
  memberId: string;
  displayName: string;
  role: FamilyRole;
  rank: {
    level: number;
    title: string | null;
  };
  status: FamilyMemberDirectoryStatus;
  avatarUrl: string | null;
  discord: {
    linked: boolean;
    displayName: string | null;
    serverNickname: string | null;
    avatarUrl: string | null;
  };
  joinedAt: string | null;
};

export type FamilyMemberDirectoryResponse = {
  items: FamilyMemberDirectoryItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export type FamilyMemberDirectoryQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: FamilyMemberDirectoryRoleFilter;
  status?: FamilyMemberDirectoryStatusFilter;
  sort?: FamilyMemberDirectorySort;
  order?: FamilyMemberDirectoryOrder;
};

export class FamilyMemberDirectoryError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'FamilyMemberDirectoryError';
  }
}

export class FamilyMemberDirectoryClient {
  async listMembers(query: FamilyMemberDirectoryQuery = {}, signal?: AbortSignal): Promise<FamilyMemberDirectoryResponse> {
    const params = toDirectorySearchParams(query);
    const path = `/api/family/directory${params.size ? `?${params.toString()}` : ''}`;
    return parseDirectoryResponse(await authenticatedFetch(path, { method: 'GET', signal }));
  }
}

export function toDirectorySearchParams(query: FamilyMemberDirectoryQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize));
  const search = query.search?.trim();
  if (search) params.set('search', search);
  if (query.role) params.set('role', query.role);
  if (query.status) params.set('status', query.status);
  if (query.sort) params.set('sort', query.sort);
  if (query.order) params.set('order', query.order);
  return params;
}

async function parseDirectoryResponse(response: Response): Promise<FamilyMemberDirectoryResponse> {
  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    const record = isRecord(body) ? body : {};
    throw new FamilyMemberDirectoryError(
      response.status,
      typeof record.code === 'string' ? record.code : 'DIRECTORY_REQUEST_FAILED',
      typeof record.message === 'string' ? record.message : `Directory request failed: ${response.status}`,
    );
  }
  return (await response.json()) as FamilyMemberDirectoryResponse;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
