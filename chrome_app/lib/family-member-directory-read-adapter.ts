import type { DragonListQuery, DragonListResult } from '../entrypoints/dashboard/data/types/pagination.ts';
import type { DragonMember, DragonMembersFilters } from '../entrypoints/dashboard/family/members-models.ts';
import type { DragonMemberCreateInput, DragonMembersRepository, DragonMemberUpdateInput } from '../entrypoints/dashboard/family/members-service.ts';
import { FamilyMemberDirectoryClient } from './family-member-directory-client.ts';
import { mapDirectoryMember } from './family-member-directory-mapper.ts';

export function createBackendDragonMembersRepository(client = new FamilyMemberDirectoryClient()): DragonMembersRepository {
  return {
    async list(query?: DragonListQuery<DragonMembersFilters>): Promise<DragonListResult<DragonMember>> {
      const filters = query?.filters;
      const response = await client.listMembers({
        page: query?.pagination?.page ?? 1,
        pageSize: query?.pagination?.pageSize ?? 50,
        search: filters?.search || undefined,
        status: filters?.status === 'all' ? 'active' : undefined,
        sort: filters?.sort === 'nickname' ? 'displayName' : filters?.sort === 'status' ? 'displayName' : filters?.sort,
        order: filters?.direction,
      });
      return {
        items: response.items.map(mapDirectoryMember),
        total: response.pagination.totalItems,
        page: response.pagination.page,
        pageSize: response.pagination.pageSize,
      };
    },
    async getById(id: string): Promise<DragonMember | null> {
      try {
        return mapDirectoryMember(await client.getMember(id));
      } catch {
        return null;
      }
    },
    async create(_input: DragonMemberCreateInput): Promise<DragonMember> {
      throw new Error('Member directory is read-only in module selectors.');
    },
    async update(_id: string, _input: DragonMemberUpdateInput): Promise<DragonMember> {
      throw new Error('Member directory is read-only in module selectors.');
    },
    async delete(): Promise<void> {
      throw new Error('Member directory is read-only in module selectors.');
    },
  };
}
