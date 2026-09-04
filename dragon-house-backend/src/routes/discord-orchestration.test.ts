import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { InMemoryFamilyAuthRepository } from '../auth/auth-repository.js';
import { hashPassword } from '../auth/password.js';
import { MemoryFamilyMemberRepository } from '../members/member-repository.js';
import { createTestConfig } from '../test/test-config.js';
import type { FamilyMember } from '../types.js';

const servers: Array<{ close: (callback?: (error?: Error) => void) => void }> = [];
const questId = '10000000-0000-4000-8000-000000000001';

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

describe('Discord orchestration routes', () => {
  it('rejects request-provided Discord channel overrides before publish', async () => {
    const publishQuest = vi.fn();
    const { baseUrl } = await createHarness({ publishQuest });
    const token = await login(baseUrl);

    const response = await fetch(`${baseUrl}/api/family/quests/${questId}/discord/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId: 'random-channel' }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(publishQuest).not.toHaveBeenCalled();
  });

  it('uses the configured module channel for publish requests', async () => {
    const publishQuest = vi.fn(async () => ({ published: true }));
    const { baseUrl } = await createHarness({ publishQuest });
    const token = await login(baseUrl);

    const response = await fetch(`${baseUrl}/api/family/quests/${questId}/discord/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(200);
    expect(publishQuest).toHaveBeenCalledWith(questId, 'configured-quest-channel', expect.objectContaining({ familyMemberId: 'owner-id' }));
  });
});

async function createHarness(orchestration: { publishQuest: ReturnType<typeof vi.fn> }) {
  const config = createTestConfig({
    bcryptCost: 10,
    discord: {
      guildId: 'guild-id',
      orchestration: { enabled: true },
      channels: { questAnnouncements: 'configured-quest-channel' },
    },
  });
  const authRepository = new InMemoryFamilyAuthRepository();
  const memberRepository = new MemoryFamilyMemberRepository([owner()]);
  await authRepository.createUser({
    familyMemberId: 'owner-id',
    login: 'Owner_Dragon',
    staticId: '101',
    passwordHash: await hashPassword('101', config.bcryptCost),
    isActive: true,
    mustChangePassword: false,
    role: 'owner',
    rank: 10,
    permissions: ['manage_discord_integration'],
  });
  const { app } = createApp(config, {
    authRepository,
    memberRepository,
    discordOrchestrationService: orchestration as never,
    pgPool: null,
  });
  const server = app.listen(0);
  servers.push(server);
  const address = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${address.port}` };
}

async function login(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginOrStaticId: 'Owner_Dragon', password: '101' }),
  });
  const body = await response.json() as { token: string };
  return body.token;
}

function owner(): FamilyMember {
  return {
    id: 'owner-id',
    nickname: 'Owner_Dragon',
    staticId: '101',
    role: 'owner',
    rank: 10,
    status: 'active',
    avatarAssetId: null,
    notes: null,
    joinedAt: null,
    permissions: ['manage_discord_integration'],
    permissionsOverride: [],
    permissionsDiscord: [],
    permissionsDenied: [],
    onboardingMetadata: {},
    profileMetadata: {},
    deletedAt: null,
    version: 1,
    createdByFamilyMemberId: null,
    updatedByFamilyMemberId: null,
    createdAt: '2026-08-13T10:00:00.000Z',
    updatedAt: '2026-08-13T10:00:00.000Z',
  };
}
