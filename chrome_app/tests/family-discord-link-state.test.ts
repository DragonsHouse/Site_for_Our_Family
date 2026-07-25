import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { DiscordBackendRequestError } from '../lib/family-discord-backend-client.ts';
import {
  discordLinkStateForCallback,
  discordLinkStateForFailure,
  discordLinkStateFromUser,
} from '../lib/family-discord-link-state.ts';
import type { FamilyUser } from '../lib/family-types.ts';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function readSource(path: string) {
  return readFile(join(root, path), 'utf8');
}

describe('Discord link frontend state router', () => {
  it('derives linked and unlinked states from the canonical FamilyUser', () => {
    assert.equal(discordLinkStateFromUser(familyUser({ discordLinkStatus: 'linked', discordUserId: 'discord-1' })).status, 'linked');
    assert.equal(discordLinkStateFromUser(familyUser({ discordLinkStatus: 'not_linked', discordUserId: null })).status, 'unlinked');
  });

  it('routes callback statuses without localized message parsing', () => {
    assert.equal(discordLinkStateForCallback('success', null)?.status, 'completing');
    const conflict = discordLinkStateForCallback('error', 'discord_account_linked_elsewhere');
    const failed = discordLinkStateForCallback('error', 'discord_oauth_state_expired');

    assert.equal(conflict?.status, 'conflict');
    assert.equal(failed?.status, 'failed');
    assert.notEqual(conflict?.message, 'discord_account_linked_elsewhere');
  });

  it('routes backend conflict, unavailable and failed errors by stable code', () => {
    assert.equal(
      discordLinkStateForFailure(new DiscordBackendRequestError(409, 'discord_account_already_linked', 'Already linked.')).status,
      'conflict',
    );
    assert.equal(
      discordLinkStateForFailure(new DiscordBackendRequestError(502, 'discord_token_exchange_failed', 'Try later.')).status,
      'unavailable',
    );
    assert.equal(
      discordLinkStateForFailure(new DiscordBackendRequestError(400, 'discord_oauth_state_consumed', 'Start again.')).status,
      'failed',
    );
  });
});

describe('LinkedAccountsPanel source contract', () => {
  it('uses typed link states and refreshes canonical auth without raw-code routing', async () => {
    const panel = await readSource('entrypoints/dashboard/family/linked-accounts-panel.tsx');
    const shell = await readSource('entrypoints/dashboard/family/family-shell.tsx');
    const cabinet = await readSource('entrypoints/dashboard/family/personal-cabinet.tsx');
    const app = await readSource('entrypoints/dashboard/family-hub-app.tsx');

    assert.match(panel, /discordLinkStateForCallback/u);
    assert.match(panel, /discordLinkStateForFailure/u);
    assert.match(panel, /normalizeDiscordLinkFailure/u);
    assert.match(panel, /failure\.code === 'discord_account_already_linked'/u);
    assert.match(panel, /refreshedUser\?\.discordLinkStatus === 'linked' \|\| refreshedUser\?\.discordUserId/u);
    assert.match(panel, /onAuthenticatedUserRefresh/u);
    assert.match(panel, /refreshDiscordLink\(\{ showMessage: true, refreshAuthenticatedUser: true \}\)/u);
    assert.match(panel, /disabled=\{isBusy \|\| !oauthConfigured\}/u);
    assert.match(panel, /window\.confirm/u);
    assert.match(panel, /removeDiscordLinkCallbackParams/u);
    assert.doesNotMatch(panel, /message\.includes/u);
    assert.doesNotMatch(panel, /Discord user ID/u);
    assert.doesNotMatch(panel, /Guild member verification/u);
    assert.match(shell, /onAuthenticatedUserRefresh/u);
    assert.match(cabinet, /<LinkedAccountsPanel user=\{user\} onAuthenticatedUserRefresh=\{onAuthenticatedUserRefresh\}/u);
    assert.match(app, /onAuthenticatedUserRefresh=\{reloadAuthenticatedUser\}/u);
  });
});

function familyUser(input: Partial<FamilyUser> = {}): FamilyUser {
  return {
    id: input.id ?? 'member-1',
    nickname: input.nickname ?? 'Backend_Dragon',
    staticId: input.staticId ?? '',
    passwordHash: null,
    mustChangePassword: input.mustChangePassword ?? false,
    role: input.role ?? 'member',
    rank: input.rank ?? 'Rank 4',
    rankLevel: input.rankLevel ?? 4,
    promotionProgress: 0,
    promotionRequirements: { completed: [], remaining: [] },
    lastActive: null,
    isOnline: false,
    displayName: input.displayName ?? 'Backend Display',
    avatarUrl: input.avatarUrl ?? null,
    avatarDataUrl: null,
    status: 'offline',
    accountStatus: input.accountStatus ?? 'active',
    statusMessage: null,
    nextRank: null,
    promotionUpdatedAt: '2026-07-22T00:00:00.000Z',
    joinedAt: null,
    notes: null,
    permissions: input.permissions ?? ['view_members'],
    stats: {
      tasksDone: 0,
      eventsJoined: 0,
      weeklyActivity: 0,
      contributionPoints: 0,
      questsTotal: 0,
      daysInFamily: 0,
      marks: 0,
      captureOrDefenseCount: 0,
      questsOrganized: 0,
      weeklyActivityDays: 0,
      brigadeLeadDays: 0,
      newMembersTrained: 0,
    },
    tasks: [],
    deletedAt: null,
    discordUserId: input.discordUserId ?? null,
    discordUsername: input.discordUsername ?? null,
    discordDisplayName: input.discordDisplayName ?? null,
    discordAvatarUrl: input.discordAvatarUrl ?? null,
    discordLinkedAt: null,
    discordSyncedAt: null,
    discordLinkStatus: input.discordLinkStatus ?? 'not_linked',
  };
}
