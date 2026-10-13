export const FAMILY_MAP_STATE_ID = 'dragon-house-shared-map';

export type FamilyMapPointRecord = {
  id?: number;
  x: number;
  y: number;
  title: string;
  icon: string;
  iconUrl: string | null;
  customIconDataUrl: string | null;
  detailImageDataUrl: string | null;
  zoneId: string | null;
  filterLabel: string | null;
  color: string;
  note: string | null;
  sourceMarkerId: string | null;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FamilyMapZonePoint = {
  x: number;
  y: number;
};

export type FamilyMapZoneRecord = {
  id: string;
  name: string;
  color: string;
  opacity: number | null;
  points: FamilyMapZonePoint[];
  imageDataUrl: string | null;
  imageX: number | null;
  imageY: number | null;
  imageWidth: number | null;
  imageHeight: number | null;
  imageRotation: number | null;
  imageOpacity: number | null;
  cropTop: number | null;
  cropRight: number | null;
  cropBottom: number | null;
  cropLeft: number | null;
  createdAt: string;
  updatedAt: string;
};

export type FamilyMapStateRecord = {
  id: string;
  points: FamilyMapPointRecord[];
  zones: FamilyMapZoneRecord[];
  version: number;
  updatedByFamilyMemberId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FamilyMapPointInput = Omit<FamilyMapPointRecord, 'customIconDataUrl' | 'detailImageDataUrl' | 'zoneId' | 'sourceMarkerId' | 'hidden' | 'createdAt' | 'updatedAt'> & {
  customIconDataUrl?: string | null;
  detailImageDataUrl?: string | null;
  zoneId?: string | null;
  sourceMarkerId?: string | null;
  hidden?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type FamilyMapZoneInput = Omit<FamilyMapZoneRecord, 'opacity' | 'imageDataUrl' | 'imageX' | 'imageY' | 'imageWidth' | 'imageHeight' | 'imageRotation' | 'imageOpacity' | 'cropTop' | 'cropRight' | 'cropBottom' | 'cropLeft' | 'createdAt' | 'updatedAt'> & {
  opacity?: number | null;
  imageDataUrl?: string | null;
  imageX?: number | null;
  imageY?: number | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  imageRotation?: number | null;
  imageOpacity?: number | null;
  cropTop?: number | null;
  cropRight?: number | null;
  cropBottom?: number | null;
  cropLeft?: number | null;
  createdAt?: string;
  updatedAt?: string;
};

export type FamilyMapStateInput = {
  points: FamilyMapPointInput[];
  zones: FamilyMapZoneInput[];
  expectedVersion?: number;
};
