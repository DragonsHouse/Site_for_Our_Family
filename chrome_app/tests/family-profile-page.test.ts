import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function readSource(path: string) {
  return readFile(join(root, path), 'utf8');
}

describe('member profile page route contract', () => {
  it('keeps the existing authenticated profile route while delegating to Dragon Profile', async () => {
    const source = await readSource('entrypoints/dashboard/family/family-profile.tsx');

    assert.match(source, /export function FamilyProfile\(\{ user \}: \{ user: FamilyUser \}\)/u);
    assert.match(source, /<DragonProfile user=\{user\} \/>/u);
    assert.doesNotMatch(source, /General/u);
    assert.doesNotMatch(source, /Developer/u);
    assert.doesNotMatch(source, /settings/iu);
  });

  it('routes profile through Hub navigation without arbitrary member loading', async () => {
    const shell = await readSource('entrypoints/dashboard/family/family-shell.tsx');
    const navigation = await readSource('entrypoints/dashboard/family/room-navigation.ts');
    const app = await readSource('entrypoints/dashboard/family-hub-app.tsx');
    const profile = await readSource('entrypoints/dashboard/family/family-profile.tsx');

    assert.match(navigation, /key: 'profile'/u);
    assert.match(app, /DRAGON_ROOM_TAB_KEYS/u);
    assert.match(shell, /activeTab === 'profile'/u);
    assert.match(shell, /<FamilyProfile user=\{currentUser\}/u);
    assert.doesNotMatch(profile, /URLSearchParams/u);
    assert.doesNotMatch(profile, /useParams/u);
    assert.doesNotMatch(profile, /memberId.*fetch/u);
  });

  it('uses existing authenticated member DTO as the route input', async () => {
    const backendDto = await readSource('../dragon-house-backend/src/auth/authenticated-member-dto.ts');
    const frontendDto = await readSource('lib/family-authenticated-member.ts');
    const profile = await readSource('entrypoints/dashboard/family/family-profile.tsx');

    assert.match(backendDto, /serverNickname: string \| null/u);
    assert.match(frontendDto, /serverNickname: string \| null/u);
    assert.doesNotMatch(profile, /ProfileDto/u);
    assert.doesNotMatch(profile, /fetch\(/u);
  });
});
