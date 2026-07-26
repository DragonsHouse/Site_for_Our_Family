import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function readSource(path: string) {
  return readFile(join(root, path), 'utf8');
}

describe('member profile page source contract', () => {
  it('renders the canonical authenticated member profile sections and empty states', async () => {
    const source = await readSource('entrypoints/dashboard/family/family-profile.tsx');

    assert.match(source, /export function FamilyProfile\(\{ user \}: \{ user: FamilyUser \}\)/u);
    assert.match(source, /data-profile-member="authenticated"/u);
    assert.match(source, /General/u);
    assert.match(source, /Discord/u);
    assert.match(source, /Family/u);
    assert.match(source, /Developer/u);
    assert.match(source, /Member ID/u);
    assert.match(source, /Display name/u);
    assert.match(source, /Static ID/u);
    assert.match(source, /Discord server nickname/u);
    assert.match(source, /Not linked/u);
    assert.match(source, /Missing/u);
    assert.match(source, /Using Dragon House crest/u);
    assert.match(source, /Inactive/u);
  });

  it('reserves future profile sections without implementing their behavior', async () => {
    const source = await readSource('entrypoints/dashboard/family/family-profile.tsx');

    assert.match(source, /Achievements/u);
    assert.match(source, /Statistics/u);
    assert.match(source, /Family History/u);
    assert.match(source, /Permissions/u);
    assert.match(source, /Recent Activity/u);
    assert.match(source, /aria-disabled="true"/u);
  });

  it('routes profile through Hub navigation without arbitrary member loading', async () => {
    const shell = await readSource('entrypoints/dashboard/family/family-shell.tsx');
    const tabs = await readSource('entrypoints/dashboard/family/family-tabs.tsx');
    const app = await readSource('entrypoints/dashboard/family-hub-app.tsx');
    const profile = await readSource('entrypoints/dashboard/family/family-profile.tsx');

    assert.match(tabs, /key: 'profile'/u);
    assert.match(app, /'profile'/u);
    assert.match(shell, /activeTab === 'profile'/u);
    assert.match(shell, /<FamilyProfile user=\{currentUser\}/u);
    assert.doesNotMatch(profile, /URLSearchParams/u);
    assert.doesNotMatch(profile, /useParams/u);
    assert.doesNotMatch(profile, /memberId.*fetch/u);
  });

  it('uses existing authenticated member DTO rather than introducing a second profile DTO', async () => {
    const backendDto = await readSource('../dragon-house-backend/src/auth/authenticated-member-dto.ts');
    const frontendDto = await readSource('lib/family-authenticated-member.ts');
    const profile = await readSource('entrypoints/dashboard/family/family-profile.tsx');

    assert.match(backendDto, /serverNickname: string \| null/u);
    assert.match(frontendDto, /serverNickname: string \| null/u);
    assert.doesNotMatch(profile, /ProfileDto/u);
    assert.doesNotMatch(profile, /fetch\(/u);
  });
});
