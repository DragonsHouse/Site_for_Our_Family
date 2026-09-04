import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { InMemoryFamilyAuthRepository } from '../auth/auth-repository.js';
import { hashPassword } from '../auth/password.js';
import { MemoryFamilyEventRepository } from '../family-events/family-event-repository.js';
import { MemoryFamilyMemberRepository } from '../members/member-repository.js';
import { createTestConfig } from '../test/test-config.js';
import type { FamilyMember } from '../types.js';

const servers: Array<{ close: (callback?: (error?: Error) => void) => void }> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))));
});

describe('family event routes', { timeout: 20_000 }, () => {
  it('requires authentication and returns empty backend data without mock fallback', async () => {
    const { baseUrl } = await createHarness();
    expect(await fetch(`${baseUrl}/api/family/events`).then((response) => response.status)).toBe(401);
    const headers = await authHeaders(baseUrl, 'Member_Dragons', '101');
    const events = await fetch(`${baseUrl}/api/family/events`, { headers });
    expect(events.status).toBe(200);
    expect(await events.json()).toEqual({ items: [] });
  });

  it('supports create, respond, attendance, start, complete and calendar projection', async () => {
    const { baseUrl } = await createHarness();
    const ownerHeaders = await authHeaders(baseUrl, 'Owner_Dragons', '100');
    const memberHeaders = await authHeaders(baseUrl, 'Member_Dragons', '101');

    const created = await fetch(`${baseUrl}/api/family/events`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        title: 'Family Meeting',
        eventType: 'family_meeting',
        category: 'meeting',
        status: 'scheduled',
        startsAt: '2026-08-20T18:00:00.000Z',
      }),
    });
    expect(created.status).toBe(201);
    const event = await created.json() as { id: string };

    const blockedPatch = await fetch(`${baseUrl}/api/family/events/${event.id}`, {
      method: 'PATCH',
      headers: memberHeaders,
      body: JSON.stringify({ title: 'Nope' }),
    });
    expect(blockedPatch.status).toBe(403);

    const responseOne = await fetch(`${baseUrl}/api/family/events/${event.id}/respond`, {
      method: 'POST',
      headers: memberHeaders,
      body: JSON.stringify({ response: 'joining' }),
    });
    const responseTwo = await fetch(`${baseUrl}/api/family/events/${event.id}/respond`, {
      method: 'POST',
      headers: memberHeaders,
      body: JSON.stringify({ response: 'confirmed' }),
    });
    expect(responseOne.status).toBe(200);
    expect(responseTwo.status).toBe(200);
    expect(await responseTwo.json()).toMatchObject({ familyMemberId: 'member-id', response: 'confirmed' });

    const attendance = await fetch(`${baseUrl}/api/family/events/${event.id}/attendance`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({ familyMemberId: 'member-id', status: 'present' }),
    });
    expect(attendance.status).toBe(200);

    expect(await fetch(`${baseUrl}/api/family/events/${event.id}/start`, { method: 'POST', headers: ownerHeaders }).then((response) => response.status)).toBe(200);
    const completed = await fetch(`${baseUrl}/api/family/events/${event.id}/complete`, { method: 'POST', headers: ownerHeaders });
    expect(completed.status).toBe(200);
    expect(await completed.json()).toMatchObject({ completion: { participantIds: ['member-id'] } });

    const calendar = await fetch(`${baseUrl}/api/family/calendar?sourceModule=family_events`, { headers: memberHeaders });
    expect(calendar.status).toBe(200);
    expect(await calendar.json()).toMatchObject({ items: [expect.objectContaining({ sourceModule: 'family_events', sourceId: event.id })] });
  });
});

async function createHarness() {
  const config = createTestConfig({ bcryptCost: 10 });
  const authRepository = new InMemoryFamilyAuthRepository();
  const members = [
    member({ id: 'owner-id', nickname: 'Owner_Dragons', staticId: '100', role: 'owner', rank: 10, permissions: ['manage_events'] }),
    member({ id: 'member-id', nickname: 'Member_Dragons', staticId: '101', role: 'member', rank: 2 }),
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
  const familyEventRepository = new MemoryFamilyEventRepository([], members.map((item) => item.id));
  const { app } = createApp(config, { authRepository, memberRepository, familyEventRepository, questRepository: null as never, towerDefenseRepository: null as never });
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

function member(overrides: Partial<FamilyMember>): FamilyMember {
  return {
    id: overrides.id ?? 'member-id',
    nickname: overrides.nickname ?? 'Member_Dragons',
    staticId: overrides.staticId ?? null,
    role: overrides.role ?? 'member',
    rank: overrides.rank ?? 1,
    status: 'active',
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
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}
