import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const profileSource = readFileSync(new URL('../entrypoints/dashboard/family/dragon-profile.tsx', import.meta.url), 'utf8');
const wrapperSource = readFileSync(new URL('../entrypoints/dashboard/family/family-profile.tsx', import.meta.url), 'utf8');
const componentsSource = readFileSync(new URL('../entrypoints/dashboard/family/dragon-profile-components.tsx', import.meta.url), 'utf8');
const modelsSource = readFileSync(new URL('../entrypoints/dashboard/family/profile-models.ts', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../entrypoints/dashboard/family/profile-service.ts', import.meta.url), 'utf8');
const stateSource = readFileSync(new URL('../entrypoints/dashboard/family/profile-state.ts', import.meta.url), 'utf8');
const mockSource = readFileSync(new URL('../entrypoints/dashboard/family/profile-mock-data.ts', import.meta.url), 'utf8');
const shellSource = readFileSync(new URL('../entrypoints/dashboard/family/family-shell.tsx', import.meta.url), 'utf8');
const styleSource = readFileSync(new URL('../entrypoints/dashboard/style.css', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

describe('Dragon Profile command chamber source contract', () => {
  it('uses Phase 3.3 data architecture without business logic in React components', () => {
    assert.match(modelsSource, /export type DragonProfile/);
    assert.match(modelsSource, /DragonEntity/);
    assert.match(serviceSource, /Repository</);
    assert.match(serviceSource, /createMockRepository/);
    assert.match(serviceSource, /mockDragonProfileRepository/);
    assert.match(stateSource, /useDragonCollection/);
    assert.match(stateSource, /useDragonProfileState/);
    assert.match(mockSource, /DRAGON_PROFILE_MOCK_DATA/);
    assert.doesNotMatch(profileSource, /DRAGON_PROFILE_MOCK_DATA/);
    assert.doesNotMatch(profileSource, /fetch\(/);
    assert.doesNotMatch(componentsSource, /fetch\(/);
  });

  it('renders the required command chamber sections through Dragon UI primitives', () => {
    [
      'DragonHero',
      'DragonPanel',
      'DragonSection',
      'DragonCard',
      'DragonBadge',
      'DragonProgress',
      'DragonAvatar',
      'DragonLoader',
      'DragonRetry'
    ].forEach((name) => assert.match(profileSource, new RegExp(name)));

    [
      'Особисті дані',
      'Показники профілю',
      'Досягнення',
      'Хроніка профілю',
      'Особистий інвентар',
      'Права та доступи',
      'Карта активності',
      'Прогрес рангу',
      'Discord-профіль'
    ].forEach((label) => assert.match(profileSource, new RegExp(label)));
  });

  it('supports achievements, timeline, statistics and heatmap as reusable components', () => {
    ['DragonStatisticCard', 'DragonAchievementCard', 'DragonTimeline', 'DragonActivityHeatmap'].forEach((name) => {
      assert.match(componentsSource, new RegExp(`export function ${name}`));
      assert.match(profileSource, new RegExp(name));
    });

    ['locked', 'unlocked', 'secret', 'legendary', 'rare', 'common'].forEach((value) => {
      assert.match(modelsSource, new RegExp(value));
      assert.match(mockSource, new RegExp(value));
    });
  });

  it('contains future backend integration points for complex profile systems', () => {
    [
      'backendAchievementId',
      'backendEventId',
      'backendMetricKey',
      'backendItemId',
      'backendPermissionKey',
      'backendActivityId',
      'backendField'
    ].forEach((field) => {
      assert.match(modelsSource, new RegExp(field));
      assert.match(mockSource, new RegExp(field));
    });
    assert.match(serviceSource, /mockDragonProfileRepository/);
    assert.match(stateSource, /profileRepository\?: DragonProfileRepository/);
    assert.match(stateSource, /eventRepository\?: DragonEventRepository/);
    assert.match(stateSource, /timelineRepositoryBoundary: 'Repository<DragonEvent>'/);
    assert.doesNotMatch(profileSource, /mockDragonProfileRepository/);
  });

  it('is cinematic Dragon Profile, not a settings or Discord clone page', () => {
    assert.match(profileSource, /Профіль/u);
    assert.match(profileSource, /Профіль дракона/u);
    assert.match(profileSource, /data-dragon-profile="profile-room"/);
    assert.doesNotMatch(profileSource, /settings/i);
    assert.doesNotMatch(profileSource, /ProfileDto/);
  });

  it('routes through the merged cabinet/profile experience and includes responsive Dragon styling hooks', () => {
    assert.match(wrapperSource, /<DragonProfile user=\{user\} \/>/);
    assert.match(shellSource, /activeTab === 'profile' \? 'cabinet' : activeTab/u);
    assert.match(shellSource, /<PersonalCabinet[\s\S]*onOpenTab=\{onTabChange\}/u);
    [
      'dh-profile-room',
      'dh-profile-hero',
      'dh-profile-banner',
      'dh-achievement-card',
      'dh-profile-timeline',
      'dh-profile-heatmap',
      'dh-profile-rank-progress'
    ].forEach((className) => assert.match(styleSource, new RegExp(className)));
  });

  it('runs in the frontend test suite', () => {
    assert.match(packageJson.scripts['test:auth-source'], /tests\/dragon-profile-module\.test\.ts/);
  });
});
