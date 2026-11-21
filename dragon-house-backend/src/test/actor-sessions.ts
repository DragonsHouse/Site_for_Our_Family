import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Router } from 'express';
import { InMemoryFamilyAuthRepository } from '../auth/auth-repository.js';
import { FamilyAuthService } from '../auth/auth-service.js';
import { MemoryFamilyMemberRepository } from '../members/member-repository.js';
import type { AppConfig } from '../config/env.js';
import type { FamilyMember, FamilyPermission, FamilyRole } from '../types.js';
import { createTestConfig, type TestConfigOverrides } from './test-config.js';

export type TestActor = { id: string; role: FamilyRole; rank: number; permissions: FamilyPermission[] };

/** Named actors used by the authorization matrix tests. */
export const TEST_ACTORS = {
  owner: { id: 'actor-owner', role: 'owner', rank: 10, permissions: [] },
  deputy: { id: 'actor-deputy', role: 'deputy', rank: 8, permissions: ['view_members', 'manage_family_quests', 'manage_events', 'manage_treasury', 'manage_family_economy'] },
  mapManager: { id: 'actor-map-manager', role: 'moderator', rank: 5, permissions: ['manage_family_map'] },
  memberManager: { id: 'actor-member-manager', role: 'moderator', rank: 5, permissions: ['manage_members'] },
  privateViewer: { id: 'actor-private-viewer', role: 'moderator', rank: 5, permissions: ['manage_members', 'view_member_private_fields'] },
  discordManager: { id: 'actor-discord-manager', role: 'moderator', rank: 5, permissions: ['manage_discord_integration'] },
  accountingManager: { id: 'actor-accounting-manager', role: 'moderator', rank: 5, permissions: ['manage_accounting'] },
  questManager: { id: 'actor-quest-manager', role: 'moderator', rank: 5, permissions: ['manage_family_quests'] },
  member: { id: 'actor-member', role: 'member', rank: 2, permissions: ['view_members'] },
} satisfies Record<string, TestActor>;

export type TestActorName = keyof typeof TEST_ACTORS;

export function buildTestMember(actor: TestActor): FamilyMember {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    id: actor.id,
    nickname: actor.id,
    staticId: `${actor.id}-static`,
    role: actor.role,
    rank: actor.rank,
    status: 'active',
    dateOfBirth: null,
    avatarAssetId: null,
    notes: null,
    joinedAt: now,
    permissions: actor.permissions,
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

/** Mounts one router behind real bearer-session authentication and returns a token per actor. */
export async function startRouterWithActors(
  makeRouter: (config: AppConfig, authService: FamilyAuthService) => Router,
  overrides: TestConfigOverrides = {},
): Promise<{ baseUrl: string; tokens: Record<TestActorName, string>; close: () => Promise<void> }> {
  const config = createTestConfig({ bcryptCost: 10, ...overrides });
  const repository = new InMemoryFamilyAuthRepository();
  const actors = Object.values(TEST_ACTORS) as TestActor[];
  const members = new MemoryFamilyMemberRepository(actors.map(buildTestMember));
  for (const actor of actors) {
    await repository.createUser({
      familyMemberId: actor.id,
      login: actor.id,
      staticId: `${actor.id}-static`,
      passwordHash: 'unused-in-these-tests',
      isActive: true,
      mustChangePassword: false,
      role: actor.role,
      rank: actor.rank,
      permissions: actor.permissions,
    });
  }
  const authService = new FamilyAuthService(config, repository, members);
  const tokens = {} as Record<TestActorName, string>;
  for (const name of Object.keys(TEST_ACTORS) as TestActorName[]) {
    tokens[name] = (await authService.createSessionForFamilyMember(TEST_ACTORS[name].id, { loginProvider: 'password' })).token;
  }
  const app = express();
  app.use(express.json());
  app.use('/api', makeRouter(config, authService));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    tokens,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

export async function getJson(url: string, token: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}
