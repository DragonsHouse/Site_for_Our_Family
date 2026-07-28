import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const membersSource = readFileSync(new URL('../entrypoints/dashboard/family/dragon-members.tsx', import.meta.url), 'utf8');
const modelsSource = readFileSync(new URL('../entrypoints/dashboard/family/members-models.ts', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../entrypoints/dashboard/family/members-service.ts', import.meta.url), 'utf8');
const stateSource = readFileSync(new URL('../entrypoints/dashboard/family/members-state.ts', import.meta.url), 'utf8');
const mockSource = readFileSync(new URL('../entrypoints/dashboard/family/members-mock-data.ts', import.meta.url), 'utf8');
const shellSource = readFileSync(new URL('../entrypoints/dashboard/family/family-shell.tsx', import.meta.url), 'utf8');
const styleSource = readFileSync(new URL('../entrypoints/dashboard/style.css', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

describe('Dragon Members production module source contract', () => {
  it('uses the shared Dragon data architecture without direct mock data in React', () => {
    assert.match(modelsSource, /DragonEntity/);
    assert.match(serviceSource, /Repository</);
    assert.match(serviceSource, /createMockRepository/);
    assert.match(serviceSource, /mockDragonMembersRepository/);
    assert.match(stateSource, /useDragonCollection/);
    assert.match(stateSource, /useDragonMembersState/);
    assert.match(mockSource, /DRAGON_MEMBERS_MOCK_DATA/);
    assert.doesNotMatch(membersSource, /DRAGON_MEMBERS_MOCK_DATA/);
    assert.doesNotMatch(membersSource, /fetch\(/);
    assert.doesNotMatch(serviceSource, /fetch\(/);
  });

  it('supports grid, list, search, sorting and required filters', () => {
    assert.match(modelsSource, /export type DragonMembersView = 'grid' \| 'list'/);
    assert.match(modelsSource, /export type DragonMembersSort/);
    ['search', 'role', 'status', 'joinYear', 'birthdayMonth', 'sort', 'direction'].forEach((field) => {
      assert.match(modelsSource, new RegExp(field));
      assert.match(membersSource, new RegExp(`members\\.filters\\.${field}`));
    });
    assert.match(membersSource, /VIEW_TABS/);
    assert.match(membersSource, /dh-members-grid/);
    assert.match(membersSource, /dh-members-list/);
    assert.match(serviceSource, /filterDragonMembers/);
  });

  it('covers Dragon House role hierarchy and Discord-ready statuses', () => {
    [
      'volodarka_predvichnoho_polumia',
      'keeper_of_flame',
      'elder',
      'senior_dragon',
      'dragon',
      'egg',
      'online',
      'offline',
      'away',
      'in_voice',
      'recently_active'
    ].forEach((value) => {
      assert.match(modelsSource, new RegExp(value));
      assert.match(mockSource, new RegExp(value));
    });
  });

  it('renders through Dragon UI primitives and opens DragonDialog details', () => {
    [
      'DragonHero',
      'DragonPanel',
      'DragonSection',
      'DragonTabs',
      'DragonInput',
      'DragonSelect',
      'DragonButton',
      'DragonCard',
      'DragonBadge',
      'DragonAvatar',
      'DragonDialog',
      'DragonEmptyState',
      'DragonLoader',
      'DragonRetry',
      'DragonProgress'
    ].forEach((name) => assert.match(membersSource, new RegExp(name)));

    ['Static ID', 'Biography', 'Statistics', 'Achievements', 'Permissions'].forEach((label) => {
      assert.match(membersSource, new RegExp(label));
    });
    assert.match(membersSource, /members\.setSelectedMember\(member\)/);
    assert.match(membersSource, /members\.setSelectedMember\(null\)/);
  });

  it('routes Hub Members through DragonMembers and includes fortress styling hooks', () => {
    assert.match(shellSource, /import \{ DragonMembers \} from '.\/dragon-members'/);
    assert.match(shellSource, /activeTab === 'members' \? <DragonMembers currentUser=\{currentUser\} \/>/);
    ['dh-members-room', 'dh-members-card', 'dh-members-role-volodarka', 'dh-members-status-voice'].forEach((className) => {
      assert.match(styleSource, new RegExp(className));
    });
  });

  it('runs in the frontend test suite', () => {
    assert.match(packageJson.scripts['test:auth-source'], /tests\/dragon-members-module\.test\.ts/);
  });
});
