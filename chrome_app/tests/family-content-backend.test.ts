import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('Family shared content uses backend clients instead of localStorage repositories', () => {
  const app = readFileSync(new URL('../entrypoints/dashboard/family-hub-app.tsx', import.meta.url), 'utf8');
  const home = readFileSync(new URL('../entrypoints/dashboard/family/family-home.tsx', import.meta.url), 'utf8');
  const rules = readFileSync(new URL('../entrypoints/dashboard/family/family-rules.tsx', import.meta.url), 'utf8');
  const recruitment = readFileSync(new URL('../entrypoints/dashboard/family/recruitment-panel.tsx', import.meta.url), 'utf8');
  const panel = readFileSync(new URL('../entrypoints/dashboard/family/family-panel.tsx', import.meta.url), 'utf8');

  assert.match(app, /listBackendFamilyNewsPosts/);
  assert.doesNotMatch(app, /readFamilyPosts|getFamilyPosts|saveFamilyPosts/);

  assert.match(home, /listBackendFamilyContentBlocks\('home'/);
  assert.match(home, /updateBackendFamilyContentBlock/);
  assert.match(rules, /listBackendFamilyContentBlocks\('rules'/);
  assert.match(rules, /updateBackendFamilyContentBlock/);
  assert.match(recruitment, /getBackendRecruitmentSettings/);
  assert.match(recruitment, /updateBackendRecruitmentSettings/);

  for (const source of [home, rules, recruitment, panel]) {
    assert.match(source, /family-content-backend-client/);
    assert.doesNotMatch(source, /readFamilyContentBlocks|saveFamilyContentBlock|RECRUITMENT_SETTINGS/);
  }

  assert.match(panel, /createBackendFamilyNewsPost/);
  assert.doesNotMatch(panel, /saveFamilyPosts/);
});

test('shared News posts are loaded once from backend state and reused across Hub contexts', () => {
  const app = readFileSync(new URL('../entrypoints/dashboard/family-hub-app.tsx', import.meta.url), 'utf8');
  const panel = readFileSync(new URL('../entrypoints/dashboard/family/family-panel.tsx', import.meta.url), 'utf8');

  assert.match(app, /const \[posts, setPosts\] = useState<FamilyPost\[\]>\(\[\]\)/);
  assert.match(app, /const result = await listBackendFamilyNewsPosts\(\)/);
  assert.match(app, /setPosts\(result\.items\)/);
  assert.match(app, /posts=\{posts\}/);
  assert.match(app, /onPostsChange=\{setPosts\}/);
  assert.match(panel, /onPostsChange\(\[created, \.\.\.posts\]\)/);
  assert.doesNotMatch(panel, /window\.localStorage|saveFamilyPosts|readFamilyPosts/);
});

test('Treasury edits are saved from a draft, not patched on each input change', () => {
  const source = readFileSync(new URL('../entrypoints/dashboard/family/family-economy.tsx', import.meta.url), 'utf8');

  assert.match(source, /data-testid="treasury-entry-edit"/);
  assert.match(source, /data-testid="treasury-entry-save"/);
  assert.match(source, /data-testid="treasury-conflict-refresh"/);
  assert.match(source, /patchDraft/);
  assert.match(source, /expectedVersion: currentEntry\.version \?\? 1/);
  assert.match(source, /FamilyTreasuryApiError && saveError\.status === 409/);
  assert.match(source, /Дані Скарбниці вже змінилися в іншому вікні/);
  assert.match(source, /Ціна/);
  assert.match(source, /Примітка до ціни/);
  assert.match(source, /Опис запису/);
  assert.match(source, /Примітка/);
  assert.doesNotMatch(source, /onChange=\{\(event\) => void updateFamilyTreasuryEntry/);
  assert.doesNotMatch(source, /onChange=\{\(event\) => void updateEntry/);
  assert.doesNotMatch(source, />\s*priceAmount\s*</);
  assert.doesNotMatch(source, />\s*priceNote\s*</);
});

test('manage_rewards is exposed in the permission catalog', () => {
  const permissions = readFileSync(new URL('../lib/family-permissions.ts', import.meta.url), 'utf8');

  assert.match(permissions, /'manage_rewards'/);
});
