import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function readSource(path: string) {
  return readFile(join(root, path), 'utf8');
}

describe('persistent Family Hub login source contract', () => {
  it('stores remember me tokens in persistent extension storage', async () => {
    const source = await readSource('lib/family-backend-auth-client.ts');

    assert.match(source, /PERSISTENT_SESSION_TOKEN_KEY = 'dragon_house_family_backend_persistent_session_token_v1'/u);
    assert.match(source, /AUTH_SESSION_MODE_KEY = 'dragon_house_family_backend_session_mode_v1'/u);
    assert.match(source, /chrome\.storage\.local\.set\(\{ \[PERSISTENT_SESSION_TOKEN_KEY\]: token \}\)/u);
    assert.match(source, /chrome\.storage\.local\.set\(\{ \[AUTH_SESSION_MODE_KEY\]: mode \}\)/u);
    assert.match(source, /await setSessionToken\(result\.token, rememberMe \? 'persistent' : 'session'\)/u);
  });

  it('keeps remember me disabled as session-only token storage', async () => {
    const source = await readSource('lib/family-backend-auth-client.ts');

    assert.match(source, /if \(mode === 'session'\) await chrome\.storage\.session\.set\(\{ \[SESSION_TOKEN_KEY\]: token \}\)/u);
    assert.match(source, /else if \(!token \|\| mode === 'session'\) \{\s+await chrome\.storage\.local\.remove\(PERSISTENT_SESSION_TOKEN_KEY\);/u);
    assert.match(source, /if \(mode === 'session'\) \{\s+memorySessionToken = token;\s+if \(token\) memoryPersistentSessionToken = null;/u);
  });

  it('restores sessions only by validating the stored token through /api/auth/me', async () => {
    const auth = await readSource('lib/family-backend-auth-client.ts');
    const session = await readSource('lib/family-backend-user-session.ts');

    assert.match(auth, /export async function restoreCurrentAuthSession\(\): Promise<AuthenticatedMember \| null>/u);
    assert.match(auth, /const token = await getSessionToken\(\);\s+if \(!token\) return null;/u);
    assert.match(auth, /return await getCurrentUser\(\);/u);
    assert.match(auth, /authenticatedFetch\('\/api\/auth\/me', \{ method: 'GET' \}\)/u);
    assert.match(session, /restoreCurrentAuthSession/u);
    assert.doesNotMatch(session, /localStorage/u);
  });

  it('clears only authentication data when token validation fails', async () => {
    const source = await readSource('lib/family-backend-auth-client.ts');

    assert.match(source, /catch \(error\) \{\s+await clearAuthSession\(\);\s+throw error;\s+\}/u);
    assert.match(source, /await chrome\.storage\.session\.remove\(SESSION_TOKEN_KEY\)/u);
    assert.match(source, /await chrome\.storage\.local\.remove\(PERSISTENT_SESSION_TOKEN_KEY\)/u);
    assert.match(source, /await chrome\.storage\.local\.remove\(AUTH_SESSION_MODE_KEY\)/u);
    assert.doesNotMatch(source, /chrome\.storage\.local\.clear/u);
    assert.doesNotMatch(source, /chrome\.storage\.sync\.clear/u);
  });

  it('clears expired or unauthorized tokens through the authenticated response path', async () => {
    const source = await readSource('lib/family-backend-auth-client.ts');

    assert.match(source, /if \(response\.status === 401\) await setSessionToken\(null\);/u);
    assert.match(source, /throw new Error\(body\.message \?\? body\.error \?\? `Family auth request failed: \$\{response\.status\}`\)/u);
  });

  it('logout removes auth tokens while preserving UI preferences', async () => {
    const auth = await readSource('lib/family-backend-auth-client.ts');
    const settings = await readSource('lib/storage.ts');

    assert.match(auth, /export async function logout\(\): Promise<void>/u);
    assert.match(auth, /await setSessionToken\(null\);/u);
    assert.doesNotMatch(auth, /SETTINGS_KEY/u);
    assert.doesNotMatch(auth, /quant_rp_helper_settings/u);
    assert.match(settings, /const SETTINGS_KEY = 'quant_rp_helper_settings';/u);
  });

  it('popup startup restores authentication through the backend session loader', async () => {
    const source = await readSource('entrypoints/popup/popup-app.tsx');

    assert.match(source, /loadCurrentBackendFamilyUser/u);
    assert.match(source, /async function loadPopupCurrentUser\(\) \{\s+return loadCurrentBackendFamilyUser\(\)\.catch\(\(\) => null\);/u);
    assert.doesNotMatch(source, /window\.localStorage\.getItem\([^)]*currentUser/u);
    assert.doesNotMatch(source, /JSON\.parse\([^)]*currentUser/u);
  });

  it('dashboard and extension startup use the same backend session validation path', async () => {
    const dashboard = await readSource('entrypoints/dashboard/family-hub-app.tsx');
    const background = await readSource('entrypoints/background.ts');

    assert.match(dashboard, /loadCurrentBackendFamilyUser/u);
    assert.match(background, /restoreCurrentAuthSession/u);
    assert.match(background, /restoreAuthSessionOnExtensionStartup/u);
    assert.match(background, /chrome\.runtime\.onStartup\.addListener/u);
    assert.doesNotMatch(dashboard, /window\.localStorage\.getItem\([^)]*currentUser/u);
  });
});
