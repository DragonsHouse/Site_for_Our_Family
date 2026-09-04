import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { InMemoryFamilyAuthRepository } from '../auth/auth-repository.js';
import { hashPassword } from '../auth/password.js';
import { MemoryFamilyMemberRepository } from '../members/member-repository.js';
import { MemoryTowerDefenseRepository } from '../tower-defense/tower-defense-repository.js';
import { createTestConfig } from '../test/test-config.js';
import type { FamilyMember, FamilyRole } from '../types.js';
import type { FireGuardRosterRecord, TowerDefenseRecord, TowerRecord } from '../tower-defense/tower-defense-models.js';

const servers: Array<{ close: (callback?: (error?: Error) => void) => void }> = [];
const now = '2026-08-12T10:00:00.000Z';
const towerId = '10000000-0000-4000-8000-000000000001';
const defenseId = '20000000-0000-4000-8000-000000000001';

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))));
});

describe('family tower defense routes', { timeout: 20_000 }, () => {
  it('requires authentication for read endpoints', async () => {
    const { baseUrl } = await createHarness();

    await expect(fetch(`${baseUrl}/api/family/towers`).then((r) => r.status)).resolves.toBe(401);
    await expect(fetch(`${baseUrl}/api/family/tower-defenses`).then((r) => r.status)).resolves.toBe(401);
    await expect(fetch(`${baseUrl}/api/family/fire-guard-roster`).then((r) => r.status)).resolves.toBe(401);
  });

  it('returns towers, filtered defenses and roster to authenticated members', async () => {
    const { baseUrl } = await createHarness();
    const headers = await authHeaders(baseUrl, 'Member_Dragons', '101');

    const towers = await fetch(`${baseUrl}/api/family/towers`, { headers });
    const defenses = await fetch(`${baseUrl}/api/family/tower-defenses?status=scheduled&participant=member-id`, { headers });
    const roster = await fetch(`${baseUrl}/api/family/fire-guard-roster`, { headers });

    expect(towers.status).toBe(200);
    expect(await towers.json()).toMatchObject({ items: [expect.objectContaining({ towerCode: 'LS-01' })] });
    expect(defenses.status).toBe(200);
    expect(await defenses.json()).toMatchObject({ items: [expect.objectContaining({ id: defenseId, participantCount: 1 })] });
    expect(roster.status).toBe(200);
    expect(await roster.json()).toMatchObject({ items: [expect.objectContaining({ familyMemberId: 'commander-id' })] });
  });

  it('blocks ordinary members from writes but allows response to self', async () => {
    const { baseUrl } = await createHarness();
    const headers = await authHeaders(baseUrl, 'Member_Dragons', '101');

    const create = await fetch(`${baseUrl}/api/family/tower-defenses`, {
      method: 'POST',
      headers,
      body: JSON.stringify(createBody()),
    });
    const respond = await fetch(`${baseUrl}/api/family/tower-defenses/${defenseId}/responses`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ response: 'confirmed' }),
    });

    expect(create.status).toBe(403);
    expect(respond.status).toBe(200);
    expect(await respond.json()).toMatchObject({ familyMemberId: 'member-id', response: 'confirmed' });
  });

  it('supports create, start, attendance, complete and cancel permission checks', async () => {
    const { baseUrl } = await createHarness();
    const ownerHeaders = await authHeaders(baseUrl, 'Owner_Dragons', '100');

    const created = await fetch(`${baseUrl}/api/family/tower-defenses`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify(createBody()),
    });
    expect(created.status).toBe(201);
    const createdBody = await created.json() as { id: string };

    const patched = await fetch(`${baseUrl}/api/family/tower-defenses/${createdBody.id}`, {
      method: 'PATCH',
      headers: ownerHeaders,
      body: JSON.stringify({ status: 'gathering' }),
    });
    expect(patched.status).toBe(200);

    const started = await fetch(`${baseUrl}/api/family/tower-defenses/${createdBody.id}/start`, { method: 'POST', headers: ownerHeaders });
    expect(started.status).toBe(200);

    await fetch(`${baseUrl}/api/family/tower-defenses/${createdBody.id}/responses`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({ familyMemberId: 'member-id', response: 'confirmed' }),
    });
    const attendance = await fetch(`${baseUrl}/api/family/tower-defenses/${createdBody.id}/attendance`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({ familyMemberId: 'member-id', status: 'present' }),
    });
    expect(attendance.status).toBe(200);

    const complete = await fetch(`${baseUrl}/api/family/tower-defenses/${createdBody.id}/complete`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({ result: 'defended', score: 100 }),
    });
    expect(complete.status).toBe(200);
    expect(await complete.json()).toMatchObject({ completion: { participantIds: ['member-id'] } });

    const cancelClosed = await fetch(`${baseUrl}/api/family/tower-defenses/${createdBody.id}/cancel`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({ reason: 'too late' }),
    });
    expect(cancelClosed.status).toBe(409);
  });
});

async function createHarness() {
  const config = createTestConfig({ bcryptCost: 10 });
  const authRepository = new InMemoryFamilyAuthRepository();
  const members = [
    member({ id: 'owner-id', nickname: 'Owner_Dragons', staticId: '100', role: 'owner', rank: 10 }),
    member({ id: 'member-id', nickname: 'Member_Dragons', staticId: '101', role: 'member', rank: 2 }),
    member({ id: 'commander-id', nickname: 'Commander_Dragons', staticId: '102', role: 'member', rank: 5 }),
  ];
  const memberRepository = new MemoryFamilyMemberRepository(members);
  for (const item of members) {
    await authRepository.createUser({
      familyMemberId: item.id,
      login: item.nickname,
      staticId: item.staticId ?? item.id,
      passwordHash: await hashPassword(item.staticId ?? item.id, config.bcryptCost),
      isActive: true,
      mustChangePassword: false,
      role: item.role,
      rank: item.rank,
      permissions: item.permissions,
    });
  }
  const towerDefenseRepository = new MemoryTowerDefenseRepository([tower()], [defense()], members.map((item) => item.id), [roster()]);
  const { app } = createApp(config, { authRepository, memberRepository, towerDefenseRepository });
  const server = app.listen(0);
  servers.push(server);
  const address = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${address.port}` };
}

async function authHeaders(baseUrl: string, loginOrStaticId: string, password: string) {
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginOrStaticId, password }),
  });
  const body = await login.json() as { token: string };
  return { Authorization: `Bearer ${body.token}`, 'Content-Type': 'application/json' };
}

function createBody() {
  return {
    towerId,
    title: 'Created defense',
    startsAt: '2026-08-12T12:00:00.000Z',
    commanderFamilyMemberId: 'commander-id',
    minimumGuardCount: 1,
    recommendedGuardCount: 2,
    maximumGuardCount: 5,
  };
}

function tower(): TowerRecord {
  return {
    id: towerId,
    towerCode: 'LS-01',
    name: 'Los Santos Tower',
    locationLabel: 'North gate',
    mapMetadata: {},
    imageAssetId: null,
    iconAssetId: null,
    isActive: true,
    externalSource: null,
    externalId: null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };
}

function defense(): TowerDefenseRecord {
  return {
    id: defenseId,
    tower: tower(),
    title: 'Scheduled defense',
    description: 'Hold',
    status: 'scheduled',
    priority: 'high',
    scheduledAt: now,
    startsAt: '2026-08-12T11:00:00.000Z',
    endedAt: null,
    timezone: 'Europe/Kiev',
    phase: 'forming',
    wave: 1,
    commanderFamilyMemberId: 'commander-id',
    commanderDisplayName: 'Commander_Dragons',
    createdByFamilyMemberId: 'owner-id',
    minimumGuardCount: 1,
    recommendedGuardCount: 2,
    maximumGuardCount: 5,
    result: 'pending',
    score: null,
    notes: null,
    failureReason: null,
    completedByFamilyMemberId: null,
    completedAt: null,
    xp: 100,
    leaderboardEligible: true,
    statisticsEligible: true,
    discord: { guildId: null, channelId: null, messageId: null, voiceChannelId: null, syncedAt: null },
    externalSource: null,
    externalId: null,
    syncIdempotencyKey: null,
    eventProjectionKey: `tower-defense:${defenseId}`,
    metadata: {},
    createdAt: now,
    updatedAt: now,
    responses: [{
      id: 'response-id',
      defenseId,
      familyMemberId: 'member-id',
      displayName: 'Member_Dragons',
      response: 'joining',
      respondedAt: now,
      note: null,
      source: 'api',
      externalSource: null,
      externalId: null,
      idempotencyKey: null,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    }],
    attendance: [],
  };
}

function roster(): FireGuardRosterRecord {
  return {
    id: 'roster-id',
    familyMemberId: 'commander-id',
    displayName: 'Commander_Dragons',
    role: 'commander',
    status: 'active',
    note: null,
    assignedByFamilyMemberId: 'owner-id',
    discordUserId: null,
    discordUsername: null,
    guildId: null,
    externalSource: null,
    externalId: null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
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
    dateOfBirth: null,
    avatarAssetId: null,
    notes: null,
    joinedAt: null,
    permissions: overrides.permissions ?? [],
    permissionsOverride: [],
    permissionsDiscord: [],
    permissionsDenied: [],
    onboardingMetadata: {},
    profileMetadata: {},
    deletedAt: null,
    version: 1,
    createdByFamilyMemberId: null,
    updatedByFamilyMemberId: null,
    createdAt: now,
    updatedAt: now,
  };
}
