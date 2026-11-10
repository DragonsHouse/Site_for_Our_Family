import { authenticatedFetch } from './family-backend-auth-client';

export const SHARED_ASSET_PILOT_SLOT = 'quest_cleanup' as const;
export const SHARED_ASSET_UPDATED_EVENT = 'dragon-house-shared-asset-updated';
export type SharedAssetDto = {
  id: string;
  slot: string;
  contentType: string;
  sizeBytes: number;
  originalFilename: string;
  contentUrl: string;
  etag: string;
};

export type SharedSlotState = { version: number; asset: SharedAssetDto | null };
export async function getSharedPilotState(): Promise<SharedSlotState> {
  return await json(await authenticatedFetch(`/api/family/assets/slots/${SHARED_ASSET_PILOT_SLOT}`, { method: 'GET' })) as SharedSlotState;
}
export async function getSharedPilotAsset(signal?: AbortSignal): Promise<SharedAssetDto | null> {
  const response = await authenticatedFetch(`/api/family/assets/slots/${SHARED_ASSET_PILOT_SLOT}`, {
    method: 'GET',
    signal,
  });
  const body = (await json(response)) as { asset?: SharedAssetDto | null };
  return body.asset ?? null;
}
export async function getSharedAssetBlob(asset: SharedAssetDto, signal?: AbortSignal) {
  const response = await authenticatedFetch(asset.contentUrl, { method: 'GET', signal });
  if (!response.ok) throw new Error('Не вдалося завантажити спільне зображення.');
  return response.blob();
}
export async function uploadSharedPilotAsset(file: Blob, filename: string, expectedVersion: number) {
  const response = await authenticatedFetch(`/api/family/assets/slots/${SHARED_ASSET_PILOT_SLOT}`, {
    method: 'PUT',
    headers: { 'Content-Type': file.type, 'X-File-Name': encodeURIComponent(filename), 'X-Expected-Version': String(expectedVersion) },
    body: file,
  });
  const result = (await json(response)) as SharedAssetDto;
  window.dispatchEvent(new Event(SHARED_ASSET_UPDATED_EVENT));
  return result;
}
export async function resetSharedPilotAsset(expectedVersion: number) {
  const response = await authenticatedFetch(`/api/family/assets/slots/${SHARED_ASSET_PILOT_SLOT}`, {
    method: 'DELETE',
    headers: { 'X-Expected-Version': String(expectedVersion) },
  });
  if (!response.ok) await json(response);
  window.dispatchEvent(new Event(SHARED_ASSET_UPDATED_EVENT));
}
async function json(response: Response): Promise<unknown> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (response.status === 409) throw new Error('Зображення вже змінено іншим учасником. Натисніть «Оновити дані» перед повторною дією.');
  if (!response.ok)
    throw new Error(
      typeof body === 'object' && body && 'message' in body && typeof body.message === 'string'
        ? body.message
        : 'Дія зі спільним зображенням не виконана.',
    );
  return body;
}
