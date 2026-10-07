import { describe, expect, it } from 'vitest';
import type { FamilyAuthContext } from '../types.js';
import { MemoryFamilyTreasuryRepository } from './treasury-repository.js';
import { FamilyTreasuryService } from './treasury-service.js';

const activeBase: Pick<FamilyAuthContext, 'familyMemberId' | 'status' | 'permissions'> = {
  familyMemberId: 'member-1',
  status: 'active',
  permissions: [],
};

describe('FamilyTreasuryService authorization', () => {
  it.each([
    ['owner', { ...activeBase, role: 'owner' as const, rank: 10 }],
    ['deputy', { ...activeBase, role: 'deputy' as const, rank: 5 }],
    ['manage_treasury', { ...activeBase, role: 'member' as const, rank: 1, permissions: ['manage_treasury'] }],
    ['manage_family_economy', { ...activeBase, role: 'member' as const, rank: 1, permissions: ['manage_family_economy'] }],
  ])('allows %s to manage treasury entries', async (_label, auth) => {
    const service = new FamilyTreasuryService(new MemoryFamilyTreasuryRepository());

    await expect(service.createEntry(input(), auth as FamilyAuthContext, new Date('2026-09-28T10:00:00.000Z'))).resolves.toMatchObject({
      title: 'Лопатки',
    });
  });

  it.each([
    ['rank 8 without permission', { ...activeBase, role: 'member' as const, rank: 8 }],
    ['normal member', { ...activeBase, role: 'member' as const, rank: 1 }],
  ])('denies %s from treasury management', async (_label, auth) => {
    const service = new FamilyTreasuryService(new MemoryFamilyTreasuryRepository());

    await expect(service.createEntry(input(), auth as FamilyAuthContext, new Date('2026-09-28T10:00:00.000Z'))).rejects.toMatchObject({
      code: 'TREASURY_PERMISSION_DENIED',
    });
  });
});

describe('FamilyTreasuryService price model and concurrency', () => {
  it('creates and updates structured price fields independently from notes', async () => {
    const service = new FamilyTreasuryService(new MemoryFamilyTreasuryRepository());
    const created = await service.createEntry({
      category: 'shops',
      title: 'Лопатки',
      priceAmount: 5300,
      priceNote: 'за одну лопатку',
      note: 'перевірено',
    }, manager(), new Date('2026-09-28T10:00:00.000Z'));

    expect(created).toMatchObject({
      priceAmount: 5300,
      priceNote: 'за одну лопатку',
      note: 'перевірено',
      version: 1,
    });

    const updated = await service.updateEntry(created.id, {
      expectedVersion: created.version,
      priceAmount: null,
      priceNote: 'без націнки',
    }, manager(), new Date('2026-09-28T10:05:00.000Z'));

    expect(updated.priceAmount).toBeNull();
    expect(updated.priceNote).toBe('без націнки');
    expect(updated.version).toBe(2);
  });

  it('rejects stale treasury updates with a 409 conflict', async () => {
    const service = new FamilyTreasuryService(new MemoryFamilyTreasuryRepository());
    const created = await service.createEntry(input(), manager(), new Date('2026-09-28T10:00:00.000Z'));
    const first = await service.updateEntry(created.id, {
      expectedVersion: created.version,
      priceAmount: 5400,
    }, manager(), new Date('2026-09-28T10:01:00.000Z'));

    await expect(service.updateEntry(created.id, {
      expectedVersion: created.version,
      priceAmount: 5500,
    }, manager(), new Date('2026-09-28T10:02:00.000Z'))).rejects.toMatchObject({
      code: 'TREASURY_VERSION_CONFLICT',
      httpStatus: 409,
    });

    expect((await service.listEntries({}, manager())).items[0]).toMatchObject({
      id: created.id,
      priceAmount: first.priceAmount,
      version: first.version,
    });
  });

  it('requires expectedVersion for updates and archive operations', async () => {
    const service = new FamilyTreasuryService(new MemoryFamilyTreasuryRepository());
    const created = await service.createEntry(input(), manager(), new Date('2026-09-28T10:00:00.000Z'));

    await expect(service.updateEntry(created.id, { title: 'Нова ціна' }, manager())).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    await expect(service.archiveEntry(created.id, created.version + 1, manager())).rejects.toMatchObject({
      code: 'TREASURY_VERSION_CONFLICT',
    });
  });
});

function manager(): FamilyAuthContext {
  return { ...activeBase, role: 'owner', rank: 10 };
}

function input() {
  return {
    category: 'shops' as const,
    title: 'Лопатки',
    price: '5300',
  };
}
