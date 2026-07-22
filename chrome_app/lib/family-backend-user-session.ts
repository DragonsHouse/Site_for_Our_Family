import { createBackendCurrentFamilyUser } from './family-backend-current-user';
import { getCurrentUser as getBackendCurrentUser, type BackendAuthUser } from './family-backend-auth-client';
import { FamilyMemberApiClient } from './family-member-api-client';
import { mapDtoToFamilyUser } from './family-member-data-source';
import type { FamilyUser } from './family-types';

const memberApiClient = new FamilyMemberApiClient();

export async function resolveBackendFamilyUser(backendUser: BackendAuthUser): Promise<FamilyUser> {
  const backendMember = await memberApiClient
    .getMember(backendUser.familyMemberId)
    .then(mapDtoToFamilyUser)
    .catch(() => null);
  return createBackendCurrentFamilyUser(backendUser, backendMember);
}

export async function loadCurrentBackendFamilyUser(): Promise<FamilyUser> {
  return resolveBackendFamilyUser(await getBackendCurrentUser());
}
