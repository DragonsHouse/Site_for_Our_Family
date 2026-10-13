import { describe, expect, it } from 'vitest';
import type { FamilyAuthContext } from '../types.js';
import { FamilyMapError } from './family-map-errors.js';
import { FamilyMapService } from './family-map-service.js';
import { MemoryFamilyMapRepository } from './family-map-repository.js';

const managerAuth: FamilyAuthContext = {
  familyMemberId: 'manager-id',
  role: 'member',
  rank: 8,
  status: 'active',
  permissions: ['manage_family_map'],
};

const memberAuth: FamilyAuthContext = {
  familyMemberId: 'member-id',
  role: 'member',
  rank: 1,
  status: 'active',
  permissions: [],
};

const deputyWithoutMapPermissionAuth: FamilyAuthContext = {
  familyMemberId: 'deputy-id',
  role: 'deputy',
  rank: 8,
  status: 'active',
  permissions: [],
};

const deputyWithMapPermissionAuth: FamilyAuthContext = {
  ...deputyWithoutMapPermissionAuth,
  permissions: ['manage_family_map'],
};

describe('FamilyMapService', () => {
  it('allows active members to read shared map state', async () => {
    const service = new FamilyMapService(new MemoryFamilyMapRepository());

    const state = await service.getState(memberAuth);

    expect(state.points).toEqual([]);
    expect(state.zones).toEqual([]);
    expect(state.version).toBe(1);
  });

  it('allows authorized managers to update map state with version concurrency', async () => {
    const service = new FamilyMapService(new MemoryFamilyMapRepository());
    const initial = await service.getState(memberAuth);

    const updated = await service.updateState({
      expectedVersion: initial.version,
      points: [{
        id: 1,
        x: 100,
        y: 200,
        title: 'Shared point',
        icon: 'pin',
        iconUrl: null,
        customIconDataUrl: 'data:image/png;base64,local-only',
        detailImageDataUrl: 'data:image/png;base64,local-only',
        zoneId: null,
        filterLabel: 'Family',
        color: '#f59e0b',
        note: 'Saved through backend',
        sourceMarkerId: null,
        hidden: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }],
      zones: [],
    }, managerAuth, new Date('2026-01-02T00:00:00.000Z'));

    expect(updated.version).toBe(2);
    expect(updated.updatedByFamilyMemberId).toBe('manager-id');
    expect(updated.points[0]).toMatchObject({
      title: 'Shared point',
      customIconDataUrl: null,
      detailImageDataUrl: null,
    });
  });

  it('rejects stale updates', async () => {
    const service = new FamilyMapService(new MemoryFamilyMapRepository());
    await service.updateState({ expectedVersion: 1, points: [], zones: [] }, managerAuth);

    await expect(service.updateState({ expectedVersion: 1, points: [], zones: [] }, managerAuth)).rejects.toMatchObject({
      code: 'FAMILY_MAP_VERSION_CONFLICT',
      httpStatus: 409,
    });
  });

  it('rejects unauthorized updates', async () => {
    const service = new FamilyMapService(new MemoryFamilyMapRepository());

    await expect(service.updateState({ expectedVersion: 1, points: [], zones: [] }, memberAuth)).rejects.toBeInstanceOf(FamilyMapError);
  });

  it('uses actual manage_family_map permission for deputy writes', async () => {
    const service = new FamilyMapService(new MemoryFamilyMapRepository());

    await expect(service.updateState({ expectedVersion: 1, points: [], zones: [] }, deputyWithoutMapPermissionAuth)).rejects.toMatchObject({
      code: 'FAMILY_MAP_PERMISSION_DENIED',
      httpStatus: 403,
    });

    const updated = await service.updateState({ expectedVersion: 1, points: [], zones: [] }, deputyWithMapPermissionAuth);

    expect(updated.version).toBe(2);
    expect(updated.updatedByFamilyMemberId).toBe('deputy-id');
  });
});
