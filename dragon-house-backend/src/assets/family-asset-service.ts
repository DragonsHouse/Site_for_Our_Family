import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import type { FamilyAuthContext } from '../types.js';
import type { AssetStorageProvider } from './asset-storage-provider.js';
import type { FamilyAssetRepository } from './family-asset-repository.js';
import { PILOT_FAMILY_ASSET_SLOT, publicAssetDto, type FamilyAssetSlot } from './family-asset-models.js';

export class FamilyAssetError extends Error {
  constructor(
    readonly code: string,
    readonly httpStatus: number,
    message: string,
  ) {
    super(message);
  }
}
const allowed = new Map<string, { extension: string; matches: (b: Buffer) => boolean }>([
  [
    'image/png',
    {
      extension: 'png',
      matches: (b) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    },
  ],
  [
    'image/jpeg',
    {
      extension: 'jpg',
      matches: (b) =>
        b.length >= 4 && b[0] === 0xff && b[1] === 0xd8 && b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9,
    },
  ],
  [
    'image/webp',
    {
      extension: 'webp',
      matches: (b) => b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
    },
  ],
]);

export class FamilyAssetService {
  constructor(
    private readonly repository: FamilyAssetRepository,
    private readonly storage: AssetStorageProvider,
    private readonly maxBytes: number,
  ) {}
  private slot(value: string): FamilyAssetSlot {
    if (value !== PILOT_FAMILY_ASSET_SLOT)
      throw new FamilyAssetError('ASSET_SLOT_NOT_SUPPORTED', 404, 'Цей слот ще не підключено до спільного сховища.');
    return value;
  }
  private manage(auth: FamilyAuthContext) {
    if (auth.role !== 'owner' && !auth.permissions.includes('manage_family_assets'))
      throw new FamilyAssetError('PERMISSION_DENIED', 403, 'Недостатньо прав для керування спільними зображеннями.');
  }
  async current(slotValue: string) {
    const asset = await this.repository.findCurrent(this.slot(slotValue));
    return asset ? publicAssetDto(asset) : null;
  }
  async state(slotValue: string) {
    const slot = this.slot(slotValue);
    const state = await this.repository.findState(slot);
    return { slot, version: state.version, asset: state.asset ? publicAssetDto(state.asset) : null };
  }
  async content(id: string) {
    const asset = await this.repository.findById(id);
    if (!asset) throw new FamilyAssetError('ASSET_NOT_FOUND', 404, 'Зображення не знайдено.');
    if (!(await this.storage.exists(asset.storageKey)))
      throw new FamilyAssetError('ASSET_CONTENT_MISSING', 404, 'Файл зображення недоступний.');
    return { asset, bytes: await this.storage.get(asset.storageKey) };
  }
  async upload(
    slotValue: string,
    filename: string | undefined,
    declaredType: string | undefined,
    bytes: Buffer,
    auth: FamilyAuthContext,
    expectedVersion: number,
  ) {
    this.manage(auth);
    validateVersion(expectedVersion);
    const slot = this.slot(slotValue);
    if (!bytes.length || bytes.length > this.maxBytes)
      throw new FamilyAssetError(
        'ASSET_SIZE_INVALID',
        413,
        `Розмір файлу має бути від 1 байта до ${this.maxBytes} байтів.`,
      );
    const safeName = safeFilename(filename);
    const detected = [...allowed.entries()].find(([, v]) => v.matches(bytes));
    if (!detected)
      throw new FamilyAssetError(
        'ASSET_SIGNATURE_INVALID',
        400,
        'Файл не є дозволеним PNG, JPEG або WebP зображенням.',
      );
    const [contentType, format] = detected;
    if (declaredType && declaredType.toLowerCase() !== contentType)
      throw new FamilyAssetError('ASSET_MIME_MISMATCH', 400, 'MIME-тип не відповідає фактичному формату файлу.');
    let width: number;
    let height: number;
    try {
      const image = sharp(bytes, { limitInputPixels: 40_000_000, failOn: 'warning' });
      const metadata = await image.metadata();
      if (!metadata.width || !metadata.height || (metadata.pages ?? 1) !== 1)
        throw new Error('Unsupported image dimensions');
      await image.raw().toBuffer();
      width = metadata.width;
      height = metadata.height;
    } catch {
      throw new FamilyAssetError('ASSET_IMAGE_INVALID', 400, 'Зображення пошкоджене або перевищує допустимі розміри.');
    }
    const id = randomUUID();
    const key = `${id.slice(0, 2)}/${id}.${format.extension}`;
    const checksum = createHash('sha256').update(bytes).digest('hex');
    await this.storage.put(key, bytes);
    try {
      return publicAssetDto(
        await this.repository.assign(
          {
            id,
            kind: 'family_hub_image',
            status: 'active',
            storageProvider: this.storage.name,
            storageKey: key,
            originalFilename: safeName,
            contentType,
            sizeBytes: bytes.length,
            checksumSha256: checksum,
            width,
            height,
            createdBy: auth.familyMemberId,
          },
          slot,
          expectedVersion,
        ),
      );
    } catch (error) {
      await this.storage.delete(key).catch(() => undefined);
      throw error;
    }
  }
  async reset(slotValue: string, auth: FamilyAuthContext, expectedVersion: number) {
    this.manage(auth);
    validateVersion(expectedVersion);
    await this.repository.reset(this.slot(slotValue), auth.familyMemberId, expectedVersion);
  }
}
function safeFilename(value: string | undefined) {
  const name = (value ?? 'upload').normalize('NFC').trim();
  const hasControl = [...name].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
  if (
    !name ||
    name.length > 180 ||
    name !== path.basename(name) ||
    hasControl ||
    name.includes('/') ||
    name.includes(String.fromCharCode(92))
  )
    throw new FamilyAssetError('ASSET_FILENAME_INVALID', 400, 'Некоректне ім’я файлу.');
  return name;
}

function validateVersion(version: number) {
  if (!Number.isSafeInteger(version) || version < 1) throw new FamilyAssetError('ASSET_VERSION_REQUIRED', 400, 'Потрібна актуальна версія слоту.');
}
