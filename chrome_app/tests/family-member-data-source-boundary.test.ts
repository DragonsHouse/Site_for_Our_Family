import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function readSource(path: string) {
  return readFile(join(root, path), 'utf8');
}

describe('family member data source boundary', () => {
  it('forces API mode in production even when local mode is requested or stored', async () => {
    const source = await readSource('lib/family-member-data-source.ts');

    assert.match(source, /if \(env\.prod \|\| env\.mode === 'production'\) return false;/u);
    assert.match(source, /if \(!isLocalFamilyMemberSourceAllowed\(env\)\) return 'api';/u);
  });

  it('keeps API mode when development local source is not explicitly enabled', async () => {
    const source = await readSource('lib/family-member-data-source.ts');

    assert.match(source, /return env\.dev === true && env\.allowLocal === 'true';/u);
  });

  it('allows local mode only in explicitly enabled development builds', async () => {
    const source = await readSource('lib/family-member-data-source.ts');

    assert.match(source, /requestedMode === 'local' \|\| storedMode === 'local' \? 'local' : 'api'/u);
  });

  it('does not let local member records become authenticated popup or dashboard identity', async () => {
    const popup = await readSource('entrypoints/popup/popup-app.tsx');
    const dashboard = await readSource('entrypoints/dashboard/family-hub-app.tsx');

    assert.match(popup, /loadCurrentBackendFamilyUser/u);
    assert.match(dashboard, /loadCurrentBackendFamilyUser/u);
    assert.doesNotMatch(popup, /createFamilyMemberDataSource/u);
    assert.doesNotMatch(popup, /LocalFamilyMemberDataSource/u);
    assert.doesNotMatch(dashboard, /getFamilyUsers\(\)/u);
  });

  it('marks development local data visibly when it is active', async () => {
    const source = await readSource('entrypoints/dashboard/family/family-members.tsx');

    assert.match(source, /DEVELOPMENT \/ LOCAL DATA/u);
  });
});
