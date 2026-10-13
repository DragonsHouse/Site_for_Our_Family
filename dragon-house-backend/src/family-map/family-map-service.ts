import type { FamilyAuthContext } from '../types.js';
import { FamilyMapError } from './family-map-errors.js';
import { FAMILY_MAP_STATE_ID, type FamilyMapPointInput, type FamilyMapPointRecord, type FamilyMapStateInput, type FamilyMapStateRecord, type FamilyMapZoneInput, type FamilyMapZonePoint, type FamilyMapZoneRecord } from './family-map-models.js';
import type { FamilyMapRepository } from './family-map-repository.js';

const MAX_POINTS = 1000;
const MAX_ZONES = 200;
const MAX_ZONE_POINTS = 600;
const MAX_COORDINATE = 100000;

export class FamilyMapService {
  constructor(private readonly repository: FamilyMapRepository) {}

  async getState(auth: FamilyAuthContext): Promise<FamilyMapStateRecord> {
    this.assertCanRead(auth);
    return this.repository.getState();
  }

  async updateState(input: FamilyMapStateInput, auth: FamilyAuthContext, now = new Date()): Promise<FamilyMapStateRecord> {
    this.assertCanManage(auth);
    if (input.expectedVersion === undefined) {
      throw new FamilyMapError('VALIDATION_ERROR', 'expectedVersion is required for map updates.', 400);
    }
    const current = await this.repository.getState();
    if (current.version !== input.expectedVersion) {
      throw new FamilyMapError('FAMILY_MAP_VERSION_CONFLICT', 'Family map was changed by another user.', 409);
    }
    const normalized = normalizeStateInput(input, now.toISOString());
    const updated = await this.repository.updateState(normalized, auth.familyMemberId, now.toISOString());
    if (!updated) throw new FamilyMapError('FAMILY_MAP_VERSION_CONFLICT', 'Family map was changed by another user.', 409);
    await this.repository.recordAudit?.({
      actorFamilyMemberId: auth.familyMemberId,
      action: 'family_map_updated',
      entityId: FAMILY_MAP_STATE_ID,
      beforeData: auditSummary(current),
      afterData: auditSummary(updated),
      metadata: {
        points: updated.points.length,
        zones: updated.zones.length,
      },
    });
    return updated;
  }

  private assertCanRead(auth: FamilyAuthContext): void {
    if (auth.status !== 'active') {
      throw new FamilyMapError('FAMILY_MAP_PERMISSION_DENIED', 'Inactive members cannot view family map.', 403);
    }
  }

  private assertCanManage(auth: FamilyAuthContext): void {
    this.assertCanRead(auth);
    if (auth.role === 'owner' || auth.permissions.includes('manage_family_map')) return;
    throw new FamilyMapError('FAMILY_MAP_PERMISSION_DENIED', 'Permission denied.', 403);
  }
}

function normalizeStateInput(input: FamilyMapStateInput, now: string): FamilyMapStateInput & { points: FamilyMapPointRecord[]; zones: FamilyMapZoneRecord[] } {
  if (!Array.isArray(input.points) || input.points.length > MAX_POINTS) {
    throw new FamilyMapError('VALIDATION_ERROR', 'Invalid map points payload.', 400);
  }
  if (!Array.isArray(input.zones) || input.zones.length > MAX_ZONES) {
    throw new FamilyMapError('VALIDATION_ERROR', 'Invalid map zones payload.', 400);
  }
  return {
    expectedVersion: input.expectedVersion,
    points: input.points.map((point, index) => normalizePoint(point, index, now)),
    zones: input.zones.map((zone, index) => normalizeZone(zone, index, now)),
  };
}

function normalizePoint(point: FamilyMapPointInput, index: number, now: string): FamilyMapPointRecord {
  return {
    id: normalizeOptionalId(point.id, index),
    x: normalizeCoordinate(point.x),
    y: normalizeCoordinate(point.y),
    title: requiredText(point.title, 'point title', 180),
    icon: optionalText(point.icon, 120) ?? 'pin',
    iconUrl: optionalText(point.iconUrl, 1000),
    customIconDataUrl: null,
    detailImageDataUrl: null,
    zoneId: optionalText(point.zoneId, 120),
    filterLabel: optionalText(point.filterLabel, 180),
    color: optionalText(point.color, 32) ?? '#f59e0b',
    note: optionalText(point.note, 2000),
    sourceMarkerId: optionalText(point.sourceMarkerId, 240),
    hidden: point.hidden === true,
    createdAt: validDate(point.createdAt) ?? now,
    updatedAt: now,
  };
}

function normalizeZone(zone: FamilyMapZoneInput, index: number, now: string): FamilyMapZoneRecord {
  if (!Array.isArray(zone.points) || zone.points.length < 4 || zone.points.length > MAX_ZONE_POINTS) {
    throw new FamilyMapError('VALIDATION_ERROR', 'Invalid map zone geometry.', 400);
  }
  return {
    id: optionalText(zone.id, 120) ?? `zone-${index + 1}`,
    name: requiredText(zone.name, 'zone name', 180),
    color: optionalText(zone.color, 32) ?? '#22c55e',
    opacity: normalizeOptionalNumber(zone.opacity, 0, 1),
    points: zone.points.map(normalizeZonePoint),
    imageDataUrl: null,
    imageX: normalizeOptionalNumber(zone.imageX, -MAX_COORDINATE, MAX_COORDINATE),
    imageY: normalizeOptionalNumber(zone.imageY, -MAX_COORDINATE, MAX_COORDINATE),
    imageWidth: normalizeOptionalNumber(zone.imageWidth, 0, MAX_COORDINATE),
    imageHeight: normalizeOptionalNumber(zone.imageHeight, 0, MAX_COORDINATE),
    imageRotation: normalizeOptionalNumber(zone.imageRotation, -360, 360),
    imageOpacity: normalizeOptionalNumber(zone.imageOpacity, 0, 1),
    cropTop: normalizeOptionalNumber(zone.cropTop, 0, 100),
    cropRight: normalizeOptionalNumber(zone.cropRight, 0, 100),
    cropBottom: normalizeOptionalNumber(zone.cropBottom, 0, 100),
    cropLeft: normalizeOptionalNumber(zone.cropLeft, 0, 100),
    createdAt: validDate(zone.createdAt) ?? now,
    updatedAt: now,
  };
}

function normalizeZonePoint(point: FamilyMapZonePoint): FamilyMapZonePoint {
  return {
    x: normalizeCoordinate(point.x),
    y: normalizeCoordinate(point.y),
  };
}

function normalizeOptionalId(id: number | undefined, index: number): number {
  if (id === undefined || id === null) return index + 1;
  if (!Number.isInteger(id) || id <= 0 || id > Number.MAX_SAFE_INTEGER) {
    throw new FamilyMapError('VALIDATION_ERROR', 'Invalid map point id.', 400);
  }
  return id;
}

function normalizeCoordinate(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > MAX_COORDINATE) {
    throw new FamilyMapError('VALIDATION_ERROR', 'Invalid map coordinate.', 400);
  }
  return Math.round(value);
}

function normalizeOptionalNumber(value: number | null | undefined, min: number, max: number): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new FamilyMapError('VALIDATION_ERROR', 'Invalid map numeric field.', 400);
  }
  return Math.round(value * 1000) / 1000;
}

function requiredText(value: string, field: string, max: number): string {
  const normalized = optionalText(value, max);
  if (!normalized) throw new FamilyMapError('VALIDATION_ERROR', `${field} is required.`, 400);
  return normalized;
}

function optionalText(value: string | null | undefined, max: number): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  if (normalized.length > max) throw new FamilyMapError('VALIDATION_ERROR', 'Map text field is too long.', 400);
  return normalized;
}

function validDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function auditSummary(state: FamilyMapStateRecord): Record<string, unknown> {
  return {
    id: state.id,
    points: state.points.length,
    zones: state.zones.length,
    version: state.version,
  };
}
