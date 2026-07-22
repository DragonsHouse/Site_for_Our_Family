import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function readSource(path: string) {
  return readFile(join(root, path), 'utf8');
}

describe('legacy local authentication cleanup', () => {
  it('does not export localStorage-backed authenticated identity helpers', async () => {
    const source = await readSource('lib/family-auth.ts');

    assert.equal(source.includes('SESSION_KEY'), false);
    assert.equal(source.includes('export async function loginFamilyUser'), false);
    assert.equal(source.includes('export async function changeFamilyUserPassword'), false);
    assert.equal(source.includes('export function getCurrentFamilyUser'), false);
    assert.equal(source.includes('export function updateFamilyUserAccess'), false);
    assert.equal(source.includes('export function logoutFamilyUser'), false);
  });

  it('keeps popup and dashboard detached from legacy family-auth identity', async () => {
    const popup = await readSource('entrypoints/popup/popup-app.tsx');
    const dashboard = await readSource('entrypoints/dashboard/family-hub-app.tsx');

    assert.equal(popup.includes("family-auth"), false);
    assert.equal(dashboard.includes("family-auth"), false);
    assert.equal(dashboard.includes('backendUserFromCurrentUser'), false);
  });

  it('preserves local member data source only as an explicit compatibility mode', async () => {
    const source = await readSource('lib/family-member-data-source.ts');

    assert.match(source, /export type FamilyMembersDataSourceMode = 'local' \| 'api';/u);
    assert.match(source, /window\.localStorage\.getItem\('dragon_house_family_members_data_source'\)/u);
    assert.match(source, /mode === 'api' \? new ApiFamilyMemberDataSource\(\) : new LocalFamilyMemberDataSource\(\)/u);
  });
});
