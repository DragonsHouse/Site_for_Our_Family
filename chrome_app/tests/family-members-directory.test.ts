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
    assert.match(client, /\/api\/family\/directory\/\$\{encodeURIComponent\(memberId\)\}/u);
    assert.doesNotMatch(client, /\/api\/family\/members/u);
    assert.match(client, /FamilyMemberDirectoryItem/u);
    assert.match(client, /FamilyMemberPublicDetails/u);
    assert.match(client, /rank:\s*\{\s*level: number;\s*title: string \| null;/u);
    assert.match(page, /new FamilyMemberDirectoryClient\(\)/u);
    assert.doesNotMatch(page, /FamilyMemberApiClient/u);
  });

  it('renders only public member card fields without technical or private identifiers', async () => {
    const card = await readSource('entrypoints/dashboard/family/family-member-card.tsx');
    const details = await readSource('entrypoints/dashboard/family/family-member-details.tsx');

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
    assert.match(details, /profile\.summary/u);
    assert.match(details, /No public summary yet\./u);
    assert.doesNotMatch(card, /Static ID/u);
    assert.doesNotMatch(details, /Static ID/u);
    assert.doesNotMatch(card, /member\.permissions|permissionsOverride|permissionsDenied/u);
    assert.doesNotMatch(details, /member\.permissions|permissionsOverride|permissionsDenied/u);
    assert.doesNotMatch(card, /metadata/iu);
    assert.doesNotMatch(details, /metadata/iu);
    assert.doesNotMatch(card, /deletedAt/u);
    assert.doesNotMatch(details, /deletedAt/u);
    assert.doesNotMatch(card, /discordUserId/u);
    assert.doesNotMatch(details, /discordUserId/u);
    assert.doesNotMatch(card, /auth/iu);
    assert.doesNotMatch(details, /Developer/u);
  });

  it('supports loading, empty, error, forbidden and details states', async () => {
    const page = await readSource('entrypoints/dashboard/family/family-members-directory.tsx');
    const card = await readSource('entrypoints/dashboard/family/family-member-card.tsx');
    const details = await readSource('entrypoints/dashboard/family/family-member-details.tsx');

    assert.match(page, /SkeletonCards/u);
    assert.match(page, /min-h-\[252px\]/u);
    assert.match(card, /min-h-\[252px\]/u);
    assert.match(page, /No dragons found\./u);
    assert.match(page, /Unable to load members/u);
    assert.match(page, /Additional permissions required/u);
    assert.match(page, /Retry/u);
    assert.match(page, /aria-live="polite"/u);
    assert.match(card, /role="button"/u);
    assert.match(card, /tabIndex=\{0\}/u);
    assert.match(card, /Open public profile/u);
    assert.match(card, /View profile/u);
    assert.match(card, /event\.key !== 'Enter' && event\.key !== ' '/u);
    assert.doesNotMatch(card, /Coming soon/u);
    assert.doesNotMatch(card, /disabled/u);
    assert.match(details, /Member not found/u);
    assert.match(details, /Unable to load member/u);
    assert.match(details, /Open my full profile/u);
    assert.match(details, /Achievements/u);
    assert.match(details, /Statistics/u);
    assert.match(details, /Recent Activity/u);
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
    assert.match(page, /params\.get\('member'\)\?\.trim\(\) \|\| null/u);
    assert.match(page, /url\.searchParams\.set\('member', state\.memberId\)/u);
    assert.match(page, /setSelectedMemberId\(member\.memberId\)/u);
    assert.match(page, /setSelectedMemberId\(null\)/u);
    assert.match(page, /search: params\.get\('search'\)\?\.trim\(\) \?\? ''/u);
    assert.match(page, /parsePositivePage/u);
    assert.match(page, /parseOption/u);
  });

  it('routes the directory and public details through the Hub Members tab', async () => {
    const tabs = await readSource('entrypoints/dashboard/family/family-tabs.tsx');
    const app = await readSource('entrypoints/dashboard/family-hub-app.tsx');
    const shell = await readSource('entrypoints/dashboard/family/family-shell.tsx');
    const page = await readSource('entrypoints/dashboard/family/family-members-directory.tsx');

    assert.match(tabs, /key: 'members'/u);
    assert.match(tabs, /label: 'Members'/u);
    assert.match(tabs, /key: 'events', label: 'Календар'/u);
    assert.doesNotMatch(tabs, /Birthdays/u);
    assert.match(app, /'members'/u);
    assert.match(shell, /activeTab === 'members'/u);
    assert.match(shell, /<DragonMembers currentUser=\{currentUser\} \/>/u);
    assert.match(shell, /Future Calendar includes family events, meetings, quests\/deadlines, tournaments, celebrations, Dragon House anniversaries and member birthdays\./u);
    assert.match(page, /<FamilyMemberDetails/u);
    assert.doesNotMatch(page, /\/api\/family\/members\/\$\{/u);
    assert.doesNotMatch(page, /useParams/u);
  });
});
