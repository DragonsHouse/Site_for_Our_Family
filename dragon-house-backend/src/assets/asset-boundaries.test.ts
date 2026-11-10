import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertE2eDatabaseConfig } from '../e2e/e2e-db-guard.js';
import { createCorsOptions } from '../http/cors.js';
import { createTestConfig } from '../test/test-config.js';
import { FilesystemAssetStorageProvider } from './filesystem-asset-storage-provider.js';

describe('asset storage boundaries', () => {
  it('round trips opaque keys without overwriting existing bytes or allowing traversal', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'dragon-house-asset-test-'));
    const storage = new FilesystemAssetStorageProvider(root);
    const key = 'ab/abcdef01-2345-4678-9abc-def012345678.png';
    try {
      await storage.put(key, Buffer.from('fixture'));
      expect(await storage.get(key)).toEqual(Buffer.from('fixture'));
      await expect(storage.put(key, Buffer.from('replacement'))).rejects.toThrow();
      await expect(storage.put('../outside.png', Buffer.from('invalid'))).rejects.toThrow('Invalid asset storage key');
      await storage.delete(key);
      expect(await storage.exists(key)).toBe(false);
      await storage.delete(key);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('allows the filename header needed by authenticated browser uploads', () => {
    expect(createCorsOptions(createTestConfig()).allowedHeaders).toContain('X-File-Name');
  });

  it('rejects a development database even when E2E mode is enabled', () => {
    expect(() =>
      assertE2eDatabaseConfig(
        createTestConfig({
          e2eTestMode: true,
          databaseUrl: 'postgresql://localhost/dragon_house',
          e2eDatabaseName: 'dragon_house',
        }),
      ),
    ).toThrow('Refusing to use non-E2E database');
  });
});
