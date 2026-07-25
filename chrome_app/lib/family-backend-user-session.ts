import { createBackendCurrentFamilyUser } from './family-backend-current-user';
import { restoreCurrentAuthSession, type AuthenticatedMember } from './family-backend-auth-client';
import type { FamilyUser } from './family-types';

export function resolveBackendFamilyUser(member: AuthenticatedMember): FamilyUser {
  return createBackendCurrentFamilyUser(member);
}

export async function restoreCurrentBackendFamilyUser(): Promise<FamilyUser | null> {
  const member = await restoreCurrentAuthSession();
  return member ? resolveBackendFamilyUser(member) : null;
}

export async function loadCurrentBackendFamilyUser(): Promise<FamilyUser> {
  const user = await restoreCurrentBackendFamilyUser();
  if (!user) throw new Error('No active Family Hub session');
  return user;
}
