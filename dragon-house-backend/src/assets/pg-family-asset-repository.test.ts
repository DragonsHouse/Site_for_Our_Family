import { describe, expect, it, vi } from 'vitest';
import type pg from 'pg';
import { PgFamilyAssetRepository } from './pg-family-asset-repository.js';

describe('asset slot transaction preconditions', () => {
  it.each(['replace', 'reset'] as const)('rolls back stale %s without reference changes or success audit', async (operation) => {
    const query = vi.fn(async (sql: string) => ({ rows: sql.startsWith('select asset_id') ? [{ asset_id: 'old-image', version: 5 }] : [] }));
    const release = vi.fn();
    const repository = new PgFamilyAssetRepository({ connect: async () => ({ query, release }) } as unknown as pg.Pool);
    const action = operation === 'reset'
      ? repository.reset('quest_cleanup', 'owner', 4)
      : repository.assign({ id: 'new-image', kind: 'family_hub_image', status: 'active', storageProvider: 'filesystem', storageKey: 'opaque', originalFilename: 'image.png', contentType: 'image/png', sizeBytes: 1, checksumSha256: '0'.repeat(64), width: 1, height: 1, createdBy: 'owner' }, 'quest_cleanup', 4);
    await expect(action).rejects.toMatchObject({ httpStatus: 409, code: 'ASSET_VERSION_CONFLICT' });
    const statements = query.mock.calls.map(([sql]) => sql);
    expect(statements[0]).toBe('begin');
    expect(statements[1]).toContain('pg_advisory_xact_lock');
    expect(statements[2]).toContain('for update');
    expect(statements.at(-1)).toBe('rollback');
    expect(statements.some(sql => /insert|update family|delete|commit/i.test(sql))).toBe(false);
    expect(statements.some(sql => sql.includes('family_audit_log'))).toBe(false);
    expect(release).toHaveBeenCalledOnce();
  });
});
