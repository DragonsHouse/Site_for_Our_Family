import { authenticatedFetch } from './family-backend-auth-client.ts';
import type { MapUserPoint, MapZone } from './types.ts';

export type FamilyMapState = {
  id: string;
  points: MapUserPoint[];
  zones: MapZone[];
  version: number;
  updatedByFamilyMemberId: string | null;
  createdAt: string;
  updatedAt: string;
};

export class FamilyMapApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = 'FamilyMapApiError';
  }
}

export async function getFamilyMapState(signal?: AbortSignal): Promise<FamilyMapState> {
  return parseMapState(await authenticatedFetch('/api/family/map/state', { method: 'GET', signal }));
}

export async function updateFamilyMapState(input: {
  expectedVersion: number;
  points: MapUserPoint[];
  zones: MapZone[];
}): Promise<FamilyMapState> {
  return parseMapState(await authenticatedFetch('/api/family/map/state', {
    method: 'PUT',
    body: JSON.stringify({
      expectedVersion: input.expectedVersion,
      points: input.points.map(stripPointBinaryFields),
      zones: input.zones.map(stripZoneBinaryFields),
    }),
  }));
}

async function parseMapState(response: Response): Promise<FamilyMapState> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const message = isRecord(body) && typeof body.message === 'string' ? body.message : 'Не вдалося оновити спільну карту.';
    const code = isRecord(body) && typeof body.code === 'string' ? body.code : undefined;
    throw new FamilyMapApiError(message, response.status, code);
  }
  if (!isRecord(body) || !Array.isArray(body.points) || !Array.isArray(body.zones) || typeof body.version !== 'number') {
    throw new Error('Не вдалося прочитати стан спільної карти.');
  }
  return {
    id: stringField(body, 'id'),
    points: body.points.map(parsePoint),
    zones: body.zones.map(parseZone),
    version: numberField(body, 'version'),
    updatedByFamilyMemberId: nullableStringField(body, 'updatedByFamilyMemberId'),
    createdAt: stringField(body, 'createdAt'),
    updatedAt: stringField(body, 'updatedAt'),
  };
}

export function stripPointBinaryFields(point: MapUserPoint): MapUserPoint {
  return {
    ...point,
    customIconDataUrl: null,
    detailImageDataUrl: null,
  };
}

export function stripZoneBinaryFields(zone: MapZone): MapZone {
  return {
    ...zone,
    imageDataUrl: null,
  };
}

function parsePoint(value: unknown): MapUserPoint {
  if (!isRecord(value)) throw new Error('Не вдалося прочитати точку карти.');
  return {
    id: optionalNumberField(value, 'id'),
    x: numberField(value, 'x'),
    y: numberField(value, 'y'),
    title: stringField(value, 'title'),
    icon: stringField(value, 'icon'),
    iconUrl: nullableStringField(value, 'iconUrl'),
    customIconDataUrl: nullableStringField(value, 'customIconDataUrl'),
    detailImageDataUrl: nullableStringField(value, 'detailImageDataUrl'),
    zoneId: nullableStringField(value, 'zoneId'),
    filterLabel: nullableStringField(value, 'filterLabel'),
    color: stringField(value, 'color'),
    note: nullableStringField(value, 'note'),
    sourceMarkerId: nullableStringField(value, 'sourceMarkerId'),
    hidden: booleanField(value, 'hidden'),
    createdAt: stringField(value, 'createdAt'),
    updatedAt: stringField(value, 'updatedAt'),
  };
}

function parseZone(value: unknown): MapZone {
  if (!isRecord(value) || !Array.isArray(value.points)) throw new Error('Не вдалося прочитати зону карти.');
  return {
    id: stringField(value, 'id'),
    name: stringField(value, 'name'),
    color: stringField(value, 'color'),
    opacity: nullableNumberField(value, 'opacity'),
    points: value.points.map((point) => {
      if (!isRecord(point)) throw new Error('Не вдалося прочитати геометрію зони.');
      return { x: numberField(point, 'x'), y: numberField(point, 'y') };
    }),
    imageDataUrl: nullableStringField(value, 'imageDataUrl'),
    imageX: nullableNumberField(value, 'imageX'),
    imageY: nullableNumberField(value, 'imageY'),
    imageWidth: nullableNumberField(value, 'imageWidth'),
    imageHeight: nullableNumberField(value, 'imageHeight'),
    imageRotation: nullableNumberField(value, 'imageRotation'),
    imageOpacity: nullableNumberField(value, 'imageOpacity'),
    cropTop: nullableNumberField(value, 'cropTop'),
    cropRight: nullableNumberField(value, 'cropRight'),
    cropBottom: nullableNumberField(value, 'cropBottom'),
    cropLeft: nullableNumberField(value, 'cropLeft'),
    createdAt: stringField(value, 'createdAt'),
    updatedAt: stringField(value, 'updatedAt'),
  };
}

function stringField(record: Record<string, unknown>, key: string): string {
  if (typeof record[key] !== 'string') throw new Error('Не вдалося прочитати дані карти.');
  return record[key];
}

function nullableStringField(record: Record<string, unknown>, key: string): string | null {
  if (record[key] === null || record[key] === undefined) return null;
  return stringField(record, key);
}

function numberField(record: Record<string, unknown>, key: string): number {
  if (typeof record[key] !== 'number' || !Number.isFinite(record[key])) throw new Error('Не вдалося прочитати числові дані карти.');
  return record[key];
}

function optionalNumberField(record: Record<string, unknown>, key: string): number | undefined {
  if (record[key] === null || record[key] === undefined) return undefined;
  return numberField(record, key);
}

function nullableNumberField(record: Record<string, unknown>, key: string): number | null {
  if (record[key] === null || record[key] === undefined) return null;
  return numberField(record, key);
}

function booleanField(record: Record<string, unknown>, key: string): boolean {
  if (typeof record[key] !== 'boolean') throw new Error('Не вдалося прочитати стан карти.');
  return record[key];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
