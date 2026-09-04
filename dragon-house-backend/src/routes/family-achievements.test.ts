import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import type { AchievementService } from '../achievements/achievement-service.js';
import { createApp } from '../app.js';
import { createTestConfig } from '../test/test-config.js';
import type { FamilyAuthContext } from '../types.js';

const servers: Array<{ close: (callback?: (error?: Error) => void) => void }> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))));
});

describe('family achievements routes', { timeout: 20_000 }, () => {
  it('requires authentication and exposes read catalog/member/leaderboard routes', async () => {
    const baseUrl = await withServer(serviceStub());
    expect((await fetch(`${baseUrl}/api/family/achievements`)).status).toBe(401);
    const response = await fetch(`${baseUrl}/api/family/achievements`, { headers: authHeaders() });
    const memberAchievements = await fetch(`${baseUrl}/api/family/members/member-id/achievements`, { headers: authHeaders() });
    const rewards = await fetch(`${baseUrl}/api/family/rewards`, { headers: authHeaders() });
    const pending = await fetch(`${baseUrl}/api/family/rewards/pending`, { headers: authHeaders('owner-id', 'owner') });
    const leaderboard = await fetch(`${baseUrl}/api/family/leaderboard?period=all_time&category=tower_defense`, { headers: authHeaders() });
    await expect(response.json()).resolves.toMatchObject({ items: [{ achievementKey: 'tower_first_attended' }] });
    await expect(memberAchievements.json()).resolves.toMatchObject({ items: [{ sourceKey: 'achievement:key' }] });
    await expect(rewards.json()).resolves.toMatchObject({ items: [{ rewardKey: 'event_attendance_badge' }] });
    await expect(pending.json()).resolves.toMatchObject({ items: [{ sourceKey: 'reward:key', status: 'earned' }] });
    await expect(leaderboard.json()).resolves.toMatchObject({ period: 'all_time', category: 'tower_defense', items: [{ familyMemberId: 'member-id', place: 1 }] });
  });

  it('routes manager write endpoints without creating finance transactions', async () => {
    const calls: string[] = [];
    const baseUrl = await withServer(serviceStub(calls));
    const award = await fetch(`${baseUrl}/api/family/achievements/award`, {
      method: 'POST',
      headers: { ...authHeaders('owner-id', 'owner'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyMemberId: 'member-id', achievementKey: 'tower_first_attended', sourceModule: 'tower_defense', sourceId: 'defense-id', sourceKey: 'achievement:key' }),
    });
    const grant = await fetch(`${baseUrl}/api/family/rewards/grant`, {
      method: 'POST',
      headers: { ...authHeaders('owner-id', 'owner'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyMemberId: 'member-id', rewardKey: 'event_attendance_badge', sourceModule: 'events', sourceId: 'event-id', sourceKey: 'reward:key', status: 'earned' }),
    });
    const status = await fetch(`${baseUrl}/api/family/rewards/grants/grant-id/status`, {
      method: 'PATCH',
      headers: { ...authHeaders('owner-id', 'owner'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    const approve = await fetch(`${baseUrl}/api/family/rewards/grants/grant-id/approve`, { method: 'POST', headers: authHeaders('owner-id', 'owner') });
    const issue = await fetch(`${baseUrl}/api/family/rewards/grants/grant-id/issue`, { method: 'POST', headers: authHeaders('owner-id', 'owner') });
    const cancel = await fetch(`${baseUrl}/api/family/rewards/grants/grant-id/cancel`, { method: 'POST', headers: authHeaders('owner-id', 'owner') });
    const questRewards = await fetch(`${baseUrl}/api/family/rewards/reconcile/quests/quest-id`, { method: 'POST', headers: authHeaders('owner-id', 'owner') });
    const towerRewards = await fetch(`${baseUrl}/api/family/rewards/reconcile/tower-defenses/defense-id`, { method: 'POST', headers: authHeaders('owner-id', 'owner') });
    const eventRewards = await fetch(`${baseUrl}/api/family/rewards/reconcile/events/event-id`, { method: 'POST', headers: authHeaders('owner-id', 'owner') });
    const evaluate = await fetch(`${baseUrl}/api/family/members/member-id/achievements/evaluate`, { method: 'POST', headers: authHeaders('owner-id', 'owner') });
    expect([award.status, grant.status, status.status, approve.status, issue.status, cancel.status, questRewards.status, towerRewards.status, eventRewards.status, evaluate.status]).toEqual([201, 201, 200, 200, 200, 200, 200, 200, 200, 200]);
    expect(calls).toEqual(['award', 'grant', 'status:approved', 'approve', 'issue', 'cancel', 'reconcile:quest', 'reconcile:tower', 'reconcile:event', 'evaluate']);
  });
});

async function withServer(achievementService: AchievementService) {
  const config = createTestConfig();
  const authService = {
    authenticateToken: async (token: string) => {
      if (!token) return null;
      const [familyMemberId, role = 'member'] = token.split(':');
      const context = { familyMemberId, role, rank: role === 'owner' ? 10 : 1, status: 'active', permissions: role === 'owner' ? ['view_members', 'manage_events', 'manage_accounting'] : [] } as FamilyAuthContext;
      return { context, user: null, session: null };
    },
  } as unknown as NonNullable<Parameters<typeof createApp>[1]>['authService'];
  const { app } = createApp(config, {
    authService,
    memberService: null,
    questService: null,
    questPayoutService: null,
    accountingReadService: null,
    towerDefenseService: null,
    familyEventService: null,
    familyCalendarService: null,
    memberActivityService: null,
    achievementService,
    pgPool: null,
  });
  const server = app.listen(0);
  servers.push(server);
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

function serviceStub(calls: string[] = []): AchievementService {
  return {
    listAchievementDefinitions: async () => ({ items: [{ achievementKey: 'tower_first_attended' }] }),
    listMemberAchievements: async () => ({ items: [{ sourceKey: 'achievement:key' }] }),
    listRewardDefinitions: async () => ({ items: [{ rewardKey: 'event_attendance_badge' }] }),
    listMemberRewards: async () => ({ items: [{ sourceKey: 'reward:key' }], permissions: { canViewSensitiveRewards: true } }),
    listPendingRewards: async () => ({ items: [{ sourceKey: 'reward:key', status: 'earned' }] }),
    getLeaderboard: async (period: string, category: string) => ({ period, category, scoring: {}, items: [{ familyMemberId: 'member-id', place: 1, rank: 1, score: 1, metrics: {} }] }),
    awardAchievement: async () => {
      calls.push('award');
      return { id: 'award-id' };
    },
    grantReward: async () => {
      calls.push('grant');
      return { id: 'grant-id' };
    },
    updateRewardStatus: async (_id: string, status: string) => {
      calls.push(`status:${status}`);
      return { id: 'grant-id', status };
    },
    approveRewardGrant: async () => {
      calls.push('approve');
      return { id: 'grant-id', status: 'approved' };
    },
    issueRewardGrant: async () => {
      calls.push('issue');
      return { id: 'grant-id', status: 'issued' };
    },
    cancelRewardGrant: async () => {
      calls.push('cancel');
      return { id: 'grant-id', status: 'cancelled' };
    },
    reconcileQuestRewards: async () => {
      calls.push('reconcile:quest');
      return { created: [], skipped: [] };
    },
    reconcileTowerDefenseRewards: async () => {
      calls.push('reconcile:tower');
      return { created: [], skipped: [] };
    },
    reconcileFamilyEventRewards: async () => {
      calls.push('reconcile:event');
      return { created: [], skipped: [] };
    },
    evaluateMemberAchievements: async () => {
      calls.push('evaluate');
      return { awarded: [] };
    },
  } as unknown as AchievementService;
}

function authHeaders(id = 'member-id', role = 'member') {
  return { Authorization: `Bearer ${id}:${role}` };
}
