export const PILOT_FAMILY_ASSET_SLOT = 'quest_cleanup' as const;
export type FamilyAssetSlot = typeof PILOT_FAMILY_ASSET_SLOT;

export type FamilyAssetRecord = {
  id: string;
  slot: FamilyAssetSlot;
  kind: string;
  status: string;
  storageProvider: string;
  storageKey: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
  width: number | null;
  height: number | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export function publicAssetDto(asset: FamilyAssetRecord) {
  return {
    id: asset.id,
    slot: asset.slot,
    kind: asset.kind,
    status: asset.status,
    originalFilename: asset.originalFilename,
    contentType: asset.contentType,
    sizeBytes: asset.sizeBytes,
    width: asset.width,
    height: asset.height,
    createdBy: asset.createdBy,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    version: asset.version,
    contentUrl: `/api/family/assets/${asset.id}/content`,
    etag: `"sha256-${asset.checksumSha256}"`,
  };
}
