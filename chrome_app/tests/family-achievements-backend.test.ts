import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { assertAchievementListResponse, assertLeaderboardResponse, assertMemberAchievementListResponse, assertMemberRewardListResponse, assertRewardPendingResponse, assertRewardListResponse } from '../lib/family-achievements-backend-response.ts';
import { mapBackendAchievement } from '../lib/family-achievements-backend-mapper.ts';
import { mapDirectoryMember } from '../lib/family-member-directory-mapper.ts';
import { getRewardSourceLabel, getRewardStatusLabel } from '../lib/family-rewards-display.ts';

describe('family achievements backend integration', () => {
  it('maps backend achievements and rewards into the existing achievement cards', () => {
    const catalog = assertAchievementListResponse({ items: [achievement()] });
    const awards = assertMemberAchievementListResponse({ items: [memberAchievement()] });
    const rewards = assertMemberRewardListResponse({ items: [memberReward()], permissions: { canViewSensitiveRewards: true } });
    const mapped = mapBackendAchievement(catalog.items[0]!, awards.items, rewards.items);
    assert.equal(mapped.backendAchievementId, 'achievement-id');
    assert.equal(mapped.completed, true);
    assert.equal(mapped.completedAt, '2026-08-13T10:00:00.000Z');
    assert.equal(mapped.category, 'tower_defense');
    assert.equal(mapped.rewards[0]!.type, 'xp');
    assert.equal(mapped.rewards[0]!.value, '100');
  });

  it('parses backend [] as empty success and rejects malformed responses', () => {
    assert.deepEqual(assertAchievementListResponse({ items: [] }).items, []);
    assert.deepEqual(assertRewardListResponse({ items: [] }).items, []);
    assert.deepEqual(assertMemberAchievementListResponse({ items: [] }).items, []);
    assert.deepEqual(assertRewardPendingResponse({ items: [] }).items, []);
    assert.throws(() => assertAchievementListResponse({ items: [{ id: 'broken' }] }), /malformed/i);
  });

  it('maps pending reward queue, status labels, and source labels without fake paid state', () => {
    const pending = assertRewardPendingResponse({
      items: [{
        ...memberReward({
          status: 'issued',
          rewardType: 'money',
          amount: 500,
          currency: 'USD',
          financeAccrualId: 'accrual-id',
          financeTransferredAt: '2026-08-13T10:02:00.000Z',
        }),
        member: { id: 'member-id', displayName: 'Member' },
        finance: { accrualId: 'accrual-id', transferredAt: '2026-08-13T10:02:00.000Z', status: 'accrued' },
      }],
    });
    assert.equal(pending.items[0]!.member?.displayName, 'Member');
    assert.equal(getRewardStatusLabel(pending.items[0]!), 'Transferred to accounting');
    assert.doesNotMatch(getRewardStatusLabel(pending.items[0]!), /paid/i);
    assert.equal(getRewardStatusLabel(memberReward({ status: 'earned' })), 'Awaiting approval');
    assert.equal(getRewardStatusLabel(memberReward({ status: 'approved', rewardType: 'money' })), 'Approved, awaiting accounting');
    assert.equal(getRewardSourceLabel('tower_defense'), 'Вишки');
    assert.equal(getRewardSourceLabel('quests'), 'Квести');
    assert.equal(getRewardSourceLabel('events'), 'Події');
    assert.equal(getRewardSourceLabel('achievements'), 'Досягнення');
  });

  it('maps leaderboard rank/place without inventing a hidden score formula', () => {
    const leaderboard = assertLeaderboardResponse({
      period: 'current_month',
      category: 'overall',
      scoring: { towerDefenseAttended: 1, questsCompleted: 1 },
      items: [{ familyMemberId: 'member-id', displayName: 'Member', rank: 1, place: 1, score: 2, metrics: { towerDefenseAttended: 1, questsCompleted: 1 } }],
    });
    assert.equal(leaderboard.items[0]!.place, 1);
    assert.equal(leaderboard.scoring.towerDefenseAttended, 1);
  });

  it('maps canonical member directory items for production selectors', () => {
    const member = mapDirectoryMember({
      memberId: 'member-id',
      displayName: 'Member',
      role: 'member',
      rank: { level: 4, title: 'Senior Dragon' },
      status: 'active',
      avatarUrl: null,
      discord: { linked: true, displayName: 'Discord Member', serverNickname: 'Server Member', avatarUrl: 'https://cdn.example/member.png' },
      joinedAt: '2026-01-01T00:00:00.000Z',
    });
    assert.equal(member.id, 'member-id');
    assert.equal(member.discordNickname, 'Server Member');
    assert.equal(member.role, 'senior_dragon');
  });

  it('wires production shell to backend achievements and member directory without mock member repository', () => {
    const shell = readFileSync(new URL('../entrypoints/dashboard/family/family-shell.tsx', import.meta.url), 'utf8');
    const achievementAdapter = readFileSync(new URL('../lib/family-achievements-read-adapter.ts', import.meta.url), 'utf8');
    const memberAdapter = readFileSync(new URL('../lib/family-member-directory-read-adapter.ts', import.meta.url), 'utf8');
    const memberClient = readFileSync(new URL('../lib/family-member-directory-client.ts', import.meta.url), 'utf8');
    const achievementUi = readFileSync(new URL('../entrypoints/dashboard/family/dragon-achievements.tsx', import.meta.url), 'utf8');

    assert.match(shell, /createBackendDragonAchievementRepository\(currentUser\.id\)/u);
    assert.match(shell, /createBackendDragonMembersRepository/u);
    assert.doesNotMatch(shell, /mockDragonMembersRepository/u);
    assert.match(achievementAdapter, /listBackendAchievements/u);
    assert.match(achievementAdapter, /listBackendMemberAchievements\(memberId\)/u);
    assert.match(achievementAdapter, /listBackendMemberRewards\(memberId\)/u);
    assert.match(memberAdapter, /FamilyMemberDirectoryClient/u);
    assert.match(memberClient, /\/api\/family\/directory/u);
    assert.match(achievementUi, /getBackendLeaderboard/u);
    assert.match(achievementUi, /listBackendPendingRewards/u);
    assert.match(achievementUi, /approveBackendRewardGrant/u);
    assert.match(achievementUi, /issueBackendRewardGrant/u);
    assert.match(achievementUi, /cancelBackendRewardGrant/u);
    assert.match(achievementUi, /data-reward-queue-source="backend"/u);
    assert.match(achievementUi, /mutatingId/u);
    assert.doesNotMatch(achievementUi, /mockDragonAchievementRepository/u);
    assert.match(achievementUi, /DragonRetry/u);
    assert.match(achievementUi, /No leaderboard activity/u);
  });

  it('keeps reward reconciliation as backend operations without a local mutation fallback', () => {
    const client = readFileSync(new URL('../lib/family-achievements-backend-client.ts', import.meta.url), 'utf8');

    assert.match(client, /reconcileBackendQuestRewards/u);
    assert.match(client, /\/api\/family\/rewards\/reconcile\/quests/u);
    assert.match(client, /reconcileBackendTowerDefenseRewards/u);
    assert.match(client, /\/api\/family\/rewards\/reconcile\/tower-defenses/u);
    assert.match(client, /reconcileBackendFamilyEventRewards/u);
    assert.match(client, /\/api\/family\/rewards\/reconcile\/events/u);
    assert.doesNotMatch(client, /local.*reconcile/i);
  });
});

function achievement() {
  return {
    id: 'achievement-id',
    achievementKey: 'tower_first_attended',
    name: 'Watchtower Initiate',
    description: 'Attend a completed Tower Defense operation.',
    category: 'tower_defense',
    icon: 'Tower',
    imageMetadata: {},
    rarity: 'common',
    active: true,
    repeatable: false,
    hidden: false,
    ruleMetadata: { rule: 'tower_attended_count', threshold: 1 },
    createdAt: '2026-08-13T09:00:00.000Z',
    updatedAt: '2026-08-13T09:00:00.000Z',
  };
}

function memberAchievement() {
  return {
    id: 'award-id',
    familyMemberId: 'member-id',
    achievementId: 'achievement-id',
    sourceModule: 'tower_defense',
    sourceId: 'defense-id',
    sourceKey: 'achievement:tower_first_attended:member-id:defense-id',
    awardedAt: '2026-08-13T10:00:00.000Z',
    awardedByFamilyMemberId: null,
    metadata: {},
    achievement: achievement(),
    createdAt: '2026-08-13T10:00:00.000Z',
  };
}

function memberReward(overrides: {
  status?: 'earned' | 'approved' | 'issued' | 'cancelled';
  rewardType?: 'money' | 'xp' | 'item' | 'badge' | 'custom';
  amount?: number | null;
  currency?: string | null;
  financeAccrualId?: string | null;
  financeTransferredAt?: string | null;
} = {}) {
  const rewardType = overrides.rewardType ?? 'xp';
  const status = overrides.status ?? 'issued';
  return {
    id: 'grant-id',
    familyMemberId: 'member-id',
    rewardId: 'reward-id',
    sourceModule: 'tower_defense',
    sourceId: 'defense-id',
    sourceKey: 'reward:tower_xp:member-id:defense-id',
    status,
    grantedAt: '2026-08-13T10:00:00.000Z',
    approvedAt: status === 'approved' || status === 'issued' ? '2026-08-13T10:00:30.000Z' : null,
    approvedByFamilyMemberId: status === 'approved' || status === 'issued' ? 'owner-id' : null,
    issuedAt: status === 'issued' ? '2026-08-13T10:01:00.000Z' : null,
    issuedByFamilyMemberId: status === 'issued' ? 'owner-id' : null,
    financeAccrualId: overrides.financeAccrualId ?? null,
    financeTransferredAt: overrides.financeTransferredAt ?? null,
    metadata: {},
    reward: {
      id: 'reward-id',
      rewardKey: 'tower_defense_xp_small',
      name: rewardType === 'money' ? 'Family Bonus' : 'Tower Defense XP',
      description: rewardType === 'money' ? 'Money bonus' : 'XP',
      rewardType,
      amount: overrides.amount ?? (rewardType === 'money' ? 500 : 100),
      value: '100',
      currency: overrides.currency ?? (rewardType === 'money' ? 'USD' : null),
      metadata: {},
      active: true,
      createdAt: '2026-08-13T09:00:00.000Z',
      updatedAt: '2026-08-13T09:00:00.000Z',
    },
    createdAt: '2026-08-13T10:00:00.000Z',
    updatedAt: '2026-08-13T10:01:00.000Z',
    version: 1,
  };
}
