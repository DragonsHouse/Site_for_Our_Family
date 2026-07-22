import { createBackendCurrentFamilyUser } from './family-backend-current-user';
import { getCurrentUser as getBackendCurrentUser, type AuthenticatedMember } from './family-backend-auth-client';
import type { FamilyUser } from './family-types';

export function resolveBackendFamilyUser(member: AuthenticatedMember): FamilyUser {
  return createBackendCurrentFamilyUser(member);
}

export async function loadCurrentBackendFamilyUser(): Promise<FamilyUser> {
  return resolveBackendFamilyUser(await getBackendCurrentUser());
}
