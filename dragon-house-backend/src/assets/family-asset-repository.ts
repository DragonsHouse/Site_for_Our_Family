import type { FamilyAssetRecord, FamilyAssetSlot } from './family-asset-models.js';

export interface FamilyAssetRepository {
  findState(slot: FamilyAssetSlot): Promise<{ version: number; asset: FamilyAssetRecord | null }>;
  findCurrent(slot: FamilyAssetSlot): Promise<FamilyAssetRecord | null>;
  findById(id: string): Promise<FamilyAssetRecord | null>;
  assign(
    input: Omit<FamilyAssetRecord, 'createdAt' | 'updatedAt' | 'version' | 'slot'>,
    slot: FamilyAssetSlot,
    expectedVersion: number,
  ): Promise<FamilyAssetRecord>;
  reset(slot: FamilyAssetSlot, actorId: string, expectedVersion: number): Promise<void>;
}
