import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const modelsSource = readFileSync(new URL('../entrypoints/dashboard/family/achievement-models.ts', import.meta.url), 'utf8');
const repositorySource = readFileSync(new URL('../entrypoints/dashboard/family/achievement-repository.ts', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../entrypoints/dashboard/family/achievement-service.ts', import.meta.url), 'utf8');
const stateSource = readFileSync(new URL('../entrypoints/dashboard/family/achievement-state.ts', import.meta.url), 'utf8');
const mockSource = readFileSync(new URL('../entrypoints/dashboard/family/achievement-mock-data.ts', import.meta.url), 'utf8');
const screenSource = readFileSync(new URL('../entrypoints/dashboard/family/dragon-achievements.tsx', import.meta.url), 'utf8');
const styleSource = readFileSync(new URL('../entrypoints/dashboard/style.css', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

describe('Dragon Achievement Engine source contract', () => {
  it('defines the backend-independent achievement model and repository boundary', () => {
    assert.match(modelsSource, /export type DragonAchievement = DragonEntity/);
    assert.match(repositorySource, /Repository</);
    assert.match(repositorySource, /mockDragonAchievementRepository/);
    assert.match(repositorySource, /createMockRepository/);
    assert.match(stateSource, /useDragonCollection/);
    assert.match(stateSource, /useDragonAchievementState/);
    assert.doesNotMatch(screenSource, /DRAGON_ACHIEVEMENT_MOCK_DATA/);
    assert.doesNotMatch(screenSource, /mockDragonAchievementRepository/);
    assert.doesNotMatch(screenSource, /fetch\(/);
  });

  it('covers required fields, rarities, visibility states and categories', () => {
    [
      'backendAchievementId',
      'title',
      'description',
      'category',
      'rarity',
      'visibility',
      'icon',
      'points',
      'xp',
      'progress',
      'progressMax',
      'completed',
      'completedAt',
      'requirements',
      'rewards',
      'seasonal',
      'hiddenUntilUnlocked',
      'repeatable',
      'futureMetadata'
    ].forEach((field) => assert.match(modelsSource, new RegExp(field)));

    ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'visible', 'hidden', 'secret'].forEach((value) => {
      assert.match(modelsSource, new RegExp(value));
      assert.match(mockSource, new RegExp(value));
    });

    [
      'tower_defense',
      'quest',
      'meeting',
      'attendance',
      'activity',
      'community',
      'leadership',
      'discord',
      'events',
      'seasonal',
      'founder',
      'special'
    ].forEach((category) => assert.match(modelsSource, new RegExp(category)));
  });

  it('models future rewards and backend integration metadata', () => {
    ['xp', 'role_unlock', 'badge', 'decoration', 'artifact', 'inventory_item', 'profile_frame', 'title'].forEach((reward) => {
      assert.match(modelsSource, new RegExp(reward));
      assert.match(mockSource, new RegExp(reward));
    });

    ['sourceModule', 'backendSeasonId', 'startsAt', 'endsAt', 'backendFields', 'backendField', 'backendRewardId'].forEach((field) => {
      assert.match(modelsSource + mockSource, new RegExp(field));
    });
  });

  it('implements reusable engine logic outside React components', () => {
    [
      'unlockDragonAchievement',
      'updateDragonAchievementProgress',
      'groupDragonAchievementsByCategory',
      'sortDragonAchievements',
      'filterDragonAchievements',
      'getDragonAchievementStatistics',
      'getRecentDragonAchievementUnlocks',
      'compareDragonAchievementRarity'
    ].forEach((name) => assert.match(serviceSource, new RegExp(`export function ${name}`)));

    ['completed', 'progressMax', 'completionPercent', 'legendaryCount', 'currentXp', 'totalXp', 'recentUnlocks'].forEach((value) => {
      assert.match(serviceSource, new RegExp(value));
    });
    assert.doesNotMatch(screenSource, /reduce<Record/);
  });

  it('exports reusable Dragon Achievement UI screens built on Dragon UI', () => {
    [
      'DragonAchievementEngineScreen',
      'DragonAchievementGallery',
      'DragonAchievementCard',
      'DragonAchievementDetails',
      'DragonAchievementFilters',
      'DragonAchievementProgressSummary',
      'DragonAchievementNotification'
    ].forEach((name) => assert.match(screenSource, new RegExp(`export function ${name}`)));

    ['DragonPanel', 'DragonCard', 'DragonDialog', 'DragonBadge', 'DragonProgress', 'DragonTabs', 'DragonButton'].forEach((primitive) => {
      assert.match(screenSource, new RegExp(primitive));
    });
  });

  it('includes cinematic achievement engine styling hooks and runs in tests', () => {
    [
      'dh-achievement-engine',
      'dh-achievement-gallery',
      'dh-achievement-details',
      'dh-achievement-filters',
      'dh-achievement-summary',
      'dh-achievement-notification',
      'dh-legendary-unlock-glow',
      'dh-epic-ember'
    ].forEach((className) => assert.match(styleSource, new RegExp(className)));

    assert.match(packageJson.scripts['test:auth-source'], /tests\/dragon-achievement-engine\.test\.ts/);
  });
});
