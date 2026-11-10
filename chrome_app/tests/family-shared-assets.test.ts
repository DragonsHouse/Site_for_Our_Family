import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const client = readFileSync(new URL('../lib/family-shared-assets-backend-client.ts', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../entrypoints/dashboard/family/family-asset-manager.tsx', import.meta.url), 'utf8');
test('shared asset writes require the caller snapshot version, never fetch a newer version to overwrite', () => {
  assert.match(client, /uploadSharedPilotAsset\(file: Blob, filename: string, expectedVersion: number\)/);
  assert.match(client, /resetSharedPilotAsset\(expectedVersion: number\)/);
  assert.equal((client.match(/'X-Expected-Version': String\(expectedVersion\)/g) ?? []).length, 2);
  assert.match(ui, /uploadSharedPilotAsset\(selectedFile, fileName, slotVersion\)/);
  assert.match(ui, /resetSharedPilotAsset\(slotVersion\)/);
  assert.doesNotMatch(ui, /\[definition.slot, status\]/);
});
test('conflicts offer explicit canonical refresh rather than silent retry', () => {
  assert.match(client, /response.status === 409/);
  assert.match(client, /Оновити дані/);
  assert.match(ui, /const state = await getSharedPilotState\(\)/);
  assert.match(ui, /setSlotVersion\(state.version\)/);
  assert.match(ui, /Оновити дані<\/DragonButton>/);
});
