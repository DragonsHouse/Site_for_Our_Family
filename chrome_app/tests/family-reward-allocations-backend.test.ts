import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { assertRewardListResponse } from '../lib/family-achievements-backend-response.ts';

describe('family reward allocation backend client', () => {
  it('maps reward catalog for allocation selectors without hardcoded rewards', () => {
    const catalog = assertRewardListResponse({
      items: [{
        id: 'reward-id',
        rewardKey: 'tower_defense_xp_small',
        name: 'Tower Defense XP',
        description: 'XP',
        rewardType: 'xp',
        amount: 100,
        value: '100',
        currency: null,
        metadata: {},
        active: true,
        createdAt: '2026-08-13T00:00:00.000Z',
        updatedAt: '2026-08-13T00:00:00.000Z'
      }]
    });
    assert.equal(catalog.items[0]!.id, 'reward-id');
    assert.equal(catalog.items[0]!.active, true);
  });

  it('uses explicit backend allocation routes for Tower Defense and Events', () => {
    const client = readFileSync(new URL('../lib/family-reward-allocations-backend-client.ts', import.meta.url), 'utf8');
    assert.match(client, /\/api\/family\/tower-defenses\/.+\/reward-allocations/u);
    assert.match(client, /\/api\/family\/events\/.+\/reward-allocations/u);
    assert.match(client, /createBackendTowerDefenseRewardAllocation/u);
    assert.match(client, /updateBackendFamilyEventRewardAllocation/u);
    assert.match(client, /deleteBackendTowerDefenseRewardAllocation/u);
    assert.doesNotMatch(client, /rewardGrants|rewardAllocations/u);
  });

  it('keeps production UI on backend allocations, member directory, and active reward definitions', () => {
    const panel = readFileSync(new URL('../entrypoints/dashboard/family/family-reward-allocation-panel.tsx', import.meta.url), 'utf8');
    const towerUi = readFileSync(new URL('../entrypoints/dashboard/family/dragon-tower-defense.tsx', import.meta.url), 'utf8');
    const eventUi = readFileSync(new URL('../entrypoints/dashboard/family/dragon-events.tsx', import.meta.url), 'utf8');
    assert.match(panel, /data-reward-allocation-source="backend"/u);
    assert.match(panel, /data-reward-allocation-mode/u);
    assert.match(panel, /summaryOnly/u);
    assert.match(panel, /allocations\.length\} planned/u);
    assert.match(panel, /FamilyMemberDirectoryClient/u);
    assert.match(panel, /listBackendRewards/u);
    assert.match(panel, /filter\(\(reward\) => reward\.active\)/u);
    assert.match(towerUi, /FamilyRewardAllocationPanel/u);
    assert.match(eventUi, /FamilyRewardAllocationPanel/u);
    assert.doesNotMatch(panel, /mockDragonMembersRepository|local fallback|rewardGrants/iu);
  });

  it('surfaces planned rewards in details, edit, and completion flows without local grant creation', () => {
    const panel = readFileSync(new URL('../entrypoints/dashboard/family/family-reward-allocation-panel.tsx', import.meta.url), 'utf8');
    const towerUi = readFileSync(new URL('../entrypoints/dashboard/family/dragon-tower-defense.tsx', import.meta.url), 'utf8');
    const eventUi = readFileSync(new URL('../entrypoints/dashboard/family/dragon-events.tsx', import.meta.url), 'utf8');
    assert.match(panel, /Source is closed\. Planned allocations are read-only/u);
    assert.match(panel, /canMutate = canManage && !closed && !summaryOnly/u);
    assert.ok(towerUi.includes('DragonDefenseResultDialog defense={defense} currentUser={currentUser}'));
    assert.match(towerUi, /summaryOnly/u);
    assert.match(eventUi, /data-event-completion-reward-summary="backend"/u);
    assert.match(eventUi, /Confirm complete/u);
    assert.doesNotMatch(`${panel}\n${towerUi}\n${eventUi}`, /metadata\.rewardGrants|metadata\.rewardAllocations|paid/iu);
  });
});
