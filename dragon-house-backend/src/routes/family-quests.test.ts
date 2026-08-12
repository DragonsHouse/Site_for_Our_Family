import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { InMemoryFamilyAuthRepository } from '../auth/auth-repository.js';
import { hashPassword } from '../auth/password.js';
import { MemoryFamilyMemberRepository } from '../members/member-repository.js';
import { MemoryFamilyQuestRepository } from '../quests/quest-repository.js';
import { createTestConfig } from '../test/test-config.js';
import type { FamilyMember, FamilyRole } from '../types.js';
import type { FamilyQuestRecord, FamilyQuestTemplateRecord } from '../quests/quest-models.js';

const servers: Array<{ close: (callback?: (error?: Error) => void) => void }> = [];
const now = '2026-08-10T10:00:00.000Z';

async function createHarness() {
  const config = createTestConfig({ bcryptCost: 10 });
  const authRepository = new InMemoryFamilyAuthRepository();
  const memberRepository = new MemoryFamilyMemberRepository([
    member({ id: 'member-id', nickname: 'Member_Dragons', staticId: '101', role: 'member', rank: 3 }),
  ]);
  await authRepository.createUser({
    familyMemberId: 'member-id',
    login: 'Member_Dragons',
    staticId: '101',
    passwordHash: await hashPassword('101', config.bcryptCost),
    isActive: true,
    mustChangePassword: false,
    role: 'member',
    rank: 3,
    permissions: [],
  });
  const questRepository = new MemoryFamilyQuestRepository([template()], [quest()]);
  const { app } = createApp(config, { authRepository, memberRepository, questRepository });
  const server = app.listen(0);
  servers.push(server);
  const address = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${address.port}` };
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
});

describe('family quest routes', { timeout: 20_000 }, () => {
  it('requires authentication for quest endpoints', async () => {
    const { baseUrl } = await createHarness();

    const templates = await fetch(`${baseUrl}/api/family/quest-templates`);
    const quests = await fetch(`${baseUrl}/api/family/quests`);
    const questById = await fetch(`${baseUrl}/api/family/quests/10000000-0000-4000-8000-000000000001`);

    expect(templates.status).toBe(401);
    expect(quests.status).toBe(401);
    expect(questById.status).toBe(401);
  });

  it('returns quest templates for authenticated members', async () => {
    const { baseUrl } = await createHarness();
    const token = await login(baseUrl);

    const response = await fetch(`${baseUrl}/api/family/quest-templates`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json() as { items: Array<Record<string, unknown>> };

    expect(response.status).toBe(200);
    expect(body.items).toEqual([
      expect.objectContaining({
        templateKey: 'help-citizens',
        title: 'Допомога громадянам',
        rewardMode: 'equal',
      }),
    ]);
  });

  it('returns hydrated quests for authenticated members', async () => {
    const { baseUrl } = await createHarness();
    const token = await login(baseUrl);

    const response = await fetch(`${baseUrl}/api/family/quests`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json() as { items: Array<Record<string, unknown>> };

    expect(response.status).toBe(200);
    expect(body.items[0]).toMatchObject({
      id: '10000000-0000-4000-8000-000000000001',
      status: 'active',
      participants: [
        expect.objectContaining({
          familyMemberId: 'member-id',
          displayName: 'Member_Dragons',
          isBestParticipant: true,
        }),
      ],
      helpers: [],
      report: expect.objectContaining({ title: 'Quest report' }),
      payouts: [expect.objectContaining({ amount: 700000, status: 'pending' })],
    });
  });

  it('returns a quest by id and handles invalid or missing ids', async () => {
    const { baseUrl } = await createHarness();
    const token = await login(baseUrl);
    const headers = { Authorization: `Bearer ${token}` };

    const ok = await fetch(`${baseUrl}/api/family/quests/10000000-0000-4000-8000-000000000001`, { headers });
    const invalid = await fetch(`${baseUrl}/api/family/quests/not-a-uuid`, { headers });
    const missing = await fetch(`${baseUrl}/api/family/quests/10000000-0000-4000-8000-000000000099`, { headers });

    expect(ok.status).toBe(200);
    expect((await ok.json()) as Record<string, unknown>).toMatchObject({ title: 'Допомога громадянам' });
    expect(invalid.status).toBe(400);
    expect(missing.status).toBe(404);
  });
});

async function login(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginOrStaticId: 'Member_Dragons', password: '101' }),
  });
  const body = await response.json() as { token: string };
  return body.token;
}

function template(): FamilyQuestTemplateRecord {
  return {
    id: '00000000-0000-4000-8000-000000000101',
    templateKey: 'help-citizens',
    title: 'Допомога громадянам',
    category: 'Громадський',
    description: 'Help people',
    steps: ['Step one'],
    recommendedTeamSize: 2,
    totalReward: 700000,
    memberRewardPool: 700000,
    familyReward: 0,
    rewardMode: 'equal',
    requiredItems: null,
    imageAssetId: 'quest_help_citizens',
    isActive: true,
    cooldownHours: 24,
    cooldownUntil: null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };
}

function quest(): FamilyQuestRecord {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    templateId: '00000000-0000-4000-8000-000000000101',
    title: 'Допомога громадянам',
    description: 'Help people',
    category: 'Громадський',
    status: 'active',
    startsAt: now,
    endsAt: null,
    scheduledAt: now,
    organizerFamilyMemberId: 'member-id',
    totalReward: 700000,
    memberRewardPool: 700000,
    familyReward: 0,
    rewardMode: 'equal',
    requiredItems: null,
    bestParticipantFamilyMemberId: 'member-id',
    bestParticipantReason: 'Most helpful',
    reportId: '30000000-0000-4000-8000-000000000001',
    reportSentToAccountingAt: null,
    paidAt: null,
    paidByFamilyMemberId: null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
    people: [
      {
        id: '20000000-0000-4000-8000-000000000001',
        questId: '10000000-0000-4000-8000-000000000001',
        familyMemberId: 'member-id',
        displayName: 'Member_Dragons',
        role: 'participant',
        joinedAt: now,
        leftAt: null,
        joinedLate: false,
        participationNote: null,
        addedManually: false,
        addedByFamilyMemberId: 'member-id',
        rewardPercent: null,
        rewardAmount: 700000,
        bonusAmount: 0,
        bonusPercent: 0,
        isBestParticipant: true,
        bestParticipantReason: 'Most helpful',
        payoutStatus: 'pending',
        paidAt: null,
        paidByFamilyMemberId: null,
        metadata: {},
        createdAt: now,
        updatedAt: now,
      },
    ],
    rewards: [],
    report: {
      id: '30000000-0000-4000-8000-000000000001',
      questId: '10000000-0000-4000-8000-000000000001',
      title: 'Quest report',
      comment: null,
      confirmedByFamilyMemberId: 'member-id',
      totalReward: 700000,
      memberRewardPool: 700000,
      familyReward: 0,
      transferredToAccountingAt: null,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    },
    payouts: [
      {
        id: '40000000-0000-4000-8000-000000000001',
        questId: '10000000-0000-4000-8000-000000000001',
        reportId: '30000000-0000-4000-8000-000000000001',
        questPersonId: '20000000-0000-4000-8000-000000000001',
        familyMemberId: 'member-id',
        displayName: 'Member_Dragons',
        amount: 700000,
        rewardPercent: null,
        rewardItems: [],
        bonusAmount: 0,
        bonusPercent: 0,
        status: 'pending',
        paidAt: null,
        paidByFamilyMemberId: null,
        payoutEventKey: 'quest-payout:test',
        idempotencyKey: null,
        accrualId: null,
        accountingTransactionId: null,
        issuedAt: null,
        issuedByFamilyMemberId: null,
        metadata: {},
        createdAt: now,
        updatedAt: now,
      },
    ],
    auditTrail: [],
  };
}

function member(overrides: Partial<FamilyMember> & { id: string; nickname: string; staticId: string | null; role?: FamilyRole }): FamilyMember {
  return {
    id: overrides.id,
    nickname: overrides.nickname,
    staticId: overrides.staticId,
    role: overrides.role ?? 'member',
    rank: overrides.rank ?? 1,
    status: overrides.status ?? 'active',
    dateOfBirth: overrides.dateOfBirth,
    avatarAssetId: overrides.avatarAssetId ?? null,
    notes: overrides.notes ?? null,
    joinedAt: overrides.joinedAt ?? null,
    permissions: overrides.permissions ?? [],
    permissionsOverride: overrides.permissionsOverride ?? [],
    permissionsDiscord: overrides.permissionsDiscord ?? [],
    permissionsDenied: overrides.permissionsDenied ?? [],
    onboardingMetadata: overrides.onboardingMetadata ?? {},
    profileMetadata: overrides.profileMetadata ?? {},
    deletedAt: overrides.deletedAt ?? null,
    version: overrides.version ?? 1,
    createdByFamilyMemberId: overrides.createdByFamilyMemberId ?? null,
    updatedByFamilyMemberId: overrides.updatedByFamilyMemberId ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    discord: overrides.discord,
  };
}
