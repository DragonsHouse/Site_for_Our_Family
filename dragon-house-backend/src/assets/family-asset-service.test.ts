import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import type { FamilyAuthContext } from '../types.js';
import type { AssetStorageProvider } from './asset-storage-provider.js';
import type { FamilyAssetRepository } from './family-asset-repository.js';
import type { FamilyAssetRecord, FamilyAssetSlot } from './family-asset-models.js';
import { FamilyAssetError, FamilyAssetService } from './family-asset-service.js';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAE0lEQVQImWP4z8DwnwGM/zMwAAAf7gP9qS/A4gAAAABJRU5ErkJggg==',
  'base64',
);
const owner: FamilyAuthContext = {
  familyMemberId: 'owner',
  role: 'owner',
  rank: 10,
  status: 'active',
  permissions: [],
};
const member: FamilyAuthContext = {
  familyMemberId: 'member',
  role: 'member',
  rank: 1,
  status: 'active',
  permissions: [],
};
class Storage implements AssetStorageProvider {
  name = 'filesystem';
  files = new Map<string, Buffer>();
  async put(k: string, b: Buffer) {
    this.files.set(k, b);
  }
  async get(k: string) {
    return this.files.get(k)!;
  }
  async exists(k: string) {
    return this.files.has(k);
  }
  async delete(k: string) {
    this.files.delete(k);
  }
}
class Repo implements FamilyAssetRepository {
  current: FamilyAssetRecord | null = null;
  version = 1;
  async findState() { return { version: this.version, asset: this.current }; }
  async findCurrent() {
    return this.current;
  }
  async findById(id: string) {
    return this.current?.id === id ? this.current : null;
  }
  async assign(i: Omit<FamilyAssetRecord, 'createdAt' | 'updatedAt' | 'version' | 'slot'>, slot: FamilyAssetSlot, expectedVersion: number) {
    if (expectedVersion !== this.version) throw new FamilyAssetError('ASSET_VERSION_CONFLICT', 409, 'Conflict');
    this.version++;
    return (this.current = {
      ...i,
      slot,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    });
  }
  async reset(_slot: FamilyAssetSlot, _actor: string, expectedVersion: number) {
    if (expectedVersion !== this.version) throw new FamilyAssetError('ASSET_VERSION_CONFLICT', 409, 'Conflict');
    this.version++;
    this.current = null;
  }
}
describe('FamilyAssetService', () => {
  it.each(['jpeg', 'webp'] as const)('decodes and stores valid %s images', async (format) => {
    const bytes = await sharp(png).toFormat(format).toBuffer();
    const service = new FamilyAssetService(new Repo(), new Storage(), 4096);
    const dto = await service.upload('quest_cleanup', `sample.${format}`, `image/${format}`, bytes, owner, 1);
    expect(dto).toMatchObject({ contentType: `image/${format}`, width: 2, height: 2 });
  });
  it('rejects truncated images and oversized uploads before storing bytes', async () => {
    const storage = new Storage();
    const service = new FamilyAssetService(new Repo(), storage, 1024);
    await expect(
      service.upload('quest_cleanup', 'a.png', 'image/png', png.subarray(0, 24), owner, 1),
    ).rejects.toMatchObject({ code: 'ASSET_IMAGE_INVALID' });
    await expect(
      service.upload('quest_cleanup', 'a.png', 'image/png', Buffer.alloc(1025), owner, 1),
    ).rejects.toMatchObject({ code: 'ASSET_SIZE_INVALID' });
    expect(storage.files.size).toBe(0);
  });
  it('allows explicit asset managers and resets to the default reference', async () => {
    const repo = new Repo();
    const service = new FamilyAssetService(repo, new Storage(), 1024);
    await service.upload('quest_cleanup', 'a.png', 'image/png', png, {
      ...member,
      permissions: ['manage_family_assets'],
    }, 1);
    expect(await service.current('quest_cleanup')).not.toBeNull();
    await expect(service.reset('quest_cleanup', member, 1)).rejects.toMatchObject({ httpStatus: 403 });
    await service.reset('quest_cleanup', owner, 2);
    expect(await service.current('quest_cleanup')).toBeNull();
  });
  it('stores a validated image and hides storage internals from DTO', async () => {
    const storage = new Storage(),
      repo = new Repo(),
      service = new FamilyAssetService(repo, storage, 1024);
    const dto = await service.upload('quest_cleanup', 'safe.png', 'image/png', png, owner, 1);
    expect(dto.contentType).toBe('image/png');
    expect(dto).not.toHaveProperty('storageKey');
    expect(dto).not.toHaveProperty('checksumSha256');
    expect(storage.files.size).toBe(1);
  });
  it('rejects members, MIME spoofing, SVG and unsafe filenames', async () => {
    const service = new FamilyAssetService(new Repo(), new Storage(), 1024);
    await expect(service.upload('quest_cleanup', 'a.png', 'image/png', png, member, 1)).rejects.toMatchObject({
      httpStatus: 403,
    });
    await expect(service.upload('quest_cleanup', 'a.jpg', 'image/jpeg', png, owner, 1)).rejects.toMatchObject({
      code: 'ASSET_MIME_MISMATCH',
    });
    await expect(
      service.upload('quest_cleanup', 'a.svg', 'image/svg+xml', Buffer.from('<svg/>'), owner, 1),
    ).rejects.toBeInstanceOf(FamilyAssetError);
    await expect(service.upload('quest_cleanup', '../a.png', 'image/png', png, owner, 1)).rejects.toMatchObject({
      code: 'ASSET_FILENAME_INVALID',
    });
  });
  it('keeps the current slot unchanged and removes bytes when metadata transaction fails', async () => {
    const storage = new Storage();
    const repo = new Repo();
    const service = new FamilyAssetService(repo, storage, 1024);
    const original = await service.upload('quest_cleanup', 'original.png', 'image/png', png, owner, 1);
    repo.assign = async () => {
      throw new Error('db failed');
    };
    await expect(service.upload('quest_cleanup', 'a.png', 'image/png', png, owner, 2)).rejects.toThrow('db failed');
    expect((await service.state('quest_cleanup')).asset?.id).toBe(original.id);
    expect((await service.state('quest_cleanup')).version).toBe(2);
    expect((await service.content(original.id)).bytes).toEqual(png);
    expect(storage.files.size).toBe(1);
  });
});

it('preserves slot version across reset and compensates stale and concurrent uploads', async () => {
  const repo = new Repo(), storage = new Storage();
  const service = new FamilyAssetService(repo, storage, 1024);
  expect((await service.state('quest_cleanup')).version).toBe(1);
  await service.upload('quest_cleanup', 'first.png', 'image/png', png, owner, 1);
  const first = repo.current;
  await expect(service.upload('quest_cleanup', 'stale.png', 'image/png', png, owner, 1)).rejects.toMatchObject({ httpStatus: 409 });
  expect(repo.current).toEqual(first);
  expect(storage.files.size).toBe(1);
  await expect(service.reset('quest_cleanup', owner, 1)).rejects.toMatchObject({ httpStatus: 409 });
  await service.reset('quest_cleanup', owner, 2);
  expect(await service.state('quest_cleanup')).toMatchObject({ version: 3, asset: null });
  await expect(service.upload('quest_cleanup', 'aba.png', 'image/png', png, owner, 2)).rejects.toMatchObject({ httpStatus: 409 });
  const results = await Promise.allSettled([
    service.upload('quest_cleanup', 'a.png', 'image/png', png, owner, 3),
    service.upload('quest_cleanup', 'b.png', 'image/png', png, owner, 3),
  ]);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
  expect((await service.state('quest_cleanup')).version).toBe(4);
  expect(storage.files.size).toBe(2);
});

it('replaces at the current slot version and retains the previous binary', async () => {
  const repo = new Repo(), storage = new Storage();
  const service = new FamilyAssetService(repo, storage, 1024);
  const original = await service.upload('quest_cleanup', 'first.png', 'image/png', png, owner, 1);
  const replacement = await service.upload('quest_cleanup', 'second.png', 'image/png', png, owner, 2);
  expect(replacement.id).not.toBe(original.id);
  expect(await service.state('quest_cleanup')).toMatchObject({ version: 3, asset: { id: replacement.id } });
  expect(storage.files.size).toBe(2);
  await expect(service.reset('quest_cleanup', owner, 2)).rejects.toMatchObject({ httpStatus: 409 });
  expect((await service.state('quest_cleanup')).asset?.id).toBe(replacement.id);
});
