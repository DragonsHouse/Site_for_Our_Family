import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function readSource(path: string) {
  return readFile(join(root, path), 'utf8');
}

describe('family members directory source contract', () => {
  it('uses a dedicated public directory client and never the admin member-management endpoint', async () => {
    const client = await readSource('lib/family-member-directory-client.ts');
    const page = await readSource('entrypoints/dashboard/family/family-members-directory.tsx');

    assert.match(client, /\/api\/family\/directory/u);
    assert.doesNotMatch(client, /\/api\/family\/members/u);
    assert.match(client, /FamilyMemberDirectoryItem/u);
    assert.match(client, /rank:\s*\{\s*level: number;\s*title: string \| null;/u);
    assert.match(page, /new FamilyMemberDirectoryClient\(\)/u);
    assert.doesNotMatch(page, /FamilyMemberApiClient/u);
  });

  it('renders only public member card fields without technical or private identifiers', async () => {
    const card = await readSource('entrypoints/dashboard/family/family-member-card.tsx');

    assert.match(card, /avatarUrl/u);
    assert.match(card, /displayName/u);
    assert.match(card, /FAMILY_ROLE_LABELS\[member\.role\]/u);
    assert.match(card, /member\.rank\.level/u);
    assert.match(card, /Linked/u);
    assert.match(card, /Not linked/u);
    assert.match(card, /Active/u);
    assert.match(card, /Inactive/u);
    assert.match(card, /formatJoinedDate\(member\.joinedAt\)/u);
    assert.match(card, /DragonHouseCrest/u);
    assert.doesNotMatch(card, /Static ID/u);
    assert.doesNotMatch(card, /permissions/u);
    assert.doesNotMatch(card, /metadata/iu);
    assert.doesNotMatch(card, /deletedAt/u);
    assert.doesNotMatch(card, /discordUserId/u);
    assert.doesNotMatch(card, /auth/iu);
  });

  it('supports loading, empty, error, forbidden and disabled navigation states', async () => {
    const page = await readSource('entrypoints/dashboard/family/family-members-directory.tsx');
    const card = await readSource('entrypoints/dashboard/family/family-member-card.tsx');

    assert.match(page, /SkeletonCards/u);
    assert.match(page, /min-h-\[252px\]/u);
    assert.match(card, /min-h-\[252px\]/u);
    assert.match(page, /No dragons found\./u);
    assert.match(page, /Unable to load members/u);
    assert.match(page, /Additional permissions required/u);
    assert.match(page, /Retry/u);
    assert.match(page, /aria-live="polite"/u);
    assert.match(card, /Coming soon/u);
    assert.match(card, /disabled/u);
    assert.match(card, /aria-label=\{`Member details for/u);
  });

  it('uses debounced backend search and allowlisted filters, sorting and pagination controls', async () => {
    const page = await readSource('entrypoints/dashboard/family/family-members-directory.tsx');
    const client = await readSource('lib/family-member-directory-client.ts');

    assert.match(page, /setTimeout\(\(\) =>/u);
    assert.ok(page.includes('}, 300);'));
    assert.match(page, /searchDraft\.trim\(\)/u);
    assert.match(client, /const search = query\.search\?\.trim\(\);/u);
    assert.match(page, /ROLE_OPTIONS/u);
    assert.match(page, /STATUS_OPTIONS/u);
    assert.match(page, /SORT_OPTIONS/u);
    assert.match(page, /ORDER_OPTIONS/u);
    assert.match(page, /status: 'active'/u);
    assert.match(page, /value: 'inactive'/u);
    assert.match(page, /value: 'all'/u);
    assert.match(page, /value: 'displayName'/u);
    assert.match(page, /value: 'rank'/u);
    assert.match(page, /Previous/u);
    assert.match(page, /Next/u);
    assert.match(page, /Page \{pagination\.page\} of/u);
    assert.match(page, /hasPreviousPage/u);
    assert.match(page, /hasNextPage/u);
  });

  it('cancels stale requests and synchronizes directory state with the URL', async () => {
    const page = await readSource('entrypoints/dashboard/family/family-members-directory.tsx');

    assert.match(page, /requestAbortRef\.current\?\.abort\(\)/u);
    assert.match(page, /new AbortController\(\)/u);
    assert.match(page, /requestSequenceRef/u);
    assert.match(page, /requestId !== requestSequenceRef\.current/u);
    assert.match(page, /controller\.signal\.aborted/u);
    assert.match(page, /readDirectoryUrlState/u);
    assert.match(page, /writeDirectoryUrlState/u);
    assert.match(page, /window\.history\.pushState/u);
    assert.match(page, /window\.history\.replaceState/u);
    assert.match(page, /popstate/u);
    assert.match(page, /search: params\.get\('search'\)\?\.trim\(\) \?\? ''/u);
    assert.match(page, /parsePositivePage/u);
    assert.match(page, /parseOption/u);
  });

  it('routes the directory through the Hub Members tab without member-details routes', async () => {
    const tabs = await readSource('entrypoints/dashboard/family/family-tabs.tsx');
    const app = await readSource('entrypoints/dashboard/family-hub-app.tsx');
    const shell = await readSource('entrypoints/dashboard/family/family-shell.tsx');
    const page = await readSource('entrypoints/dashboard/family/family-members-directory.tsx');

    assert.match(tabs, /key: 'members'/u);
    assert.match(tabs, /label: 'Members'/u);
    assert.match(app, /'members'/u);
    assert.match(shell, /activeTab === 'members'/u);
    assert.match(shell, /<FamilyMembersDirectory \/>/u);
    assert.doesNotMatch(page, /memberId.*URLSearchParams/u);
    assert.doesNotMatch(page, /\/api\/family\/members\/\$\{/u);
    assert.doesNotMatch(page, /useParams/u);
  });
});
