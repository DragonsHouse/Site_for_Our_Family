import type { FamilyQuestReadSource } from './family-quest-read-adapter.ts';

export type FamilyQuestWriteTarget = 'backend' | 'local' | 'blocked';

/**
 * Backend data always writes to the backend. Browser storage is reachable only
 * from the explicit development fallback, so loading and failed reads cannot
 * turn a user action into a local-only quest that looks saved.
 */
export function resolveFamilyQuestWriteTarget(
  readSource: FamilyQuestReadSource,
  entitySource?: 'backend' | 'local' | null
): FamilyQuestWriteTarget {
  if (entitySource === 'backend' || readSource === 'backend') return 'backend';
  if (readSource === 'dev_local_fallback') return 'local';
  return 'blocked';
}

/** A failed read reports an error but must not erase the last loaded data. */
export function shouldReplaceFamilyQuestData(readSource: FamilyQuestReadSource): boolean {
  return readSource !== 'backend_error';
}
