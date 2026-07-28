import type { FamilyUser } from '../../../lib/family-types';
import { DragonProfile } from './dragon-profile';

export function FamilyProfile({ user }: { user: FamilyUser }) {
  return <DragonProfile user={user} />;
}
