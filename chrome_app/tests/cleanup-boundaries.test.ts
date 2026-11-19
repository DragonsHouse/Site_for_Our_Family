import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { FamilyQuestPayoutApiError } from '../lib/family-quest-payout-response.ts';
import { assertBackendQuestMutationSucceeded } from '../lib/family-quest-backend-response.ts';
import { resolveFamilyQuestWriteTarget, shouldReplaceFamilyQuestData } from '../lib/family-quest-write-policy.ts';
import { catmullRomPath, getPolygonBoundsCenter, pointInPolygon } from '../lib/map-geometry.ts';

const source = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('map geometry preserves empty, concave and scaled path behavior', () => {
  assert.equal(catmullRomPath([], 2), '');
  assert.deepEqual(getPolygonBoundsCenter([]), { x: 0, y: 0 });
  assert.deepEqual(getPolygonBoundsCenter([{ x: -10, y: 2 }, { x: 21, y: 12 }]), { x: 6, y: 7 });
  const polygon = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 10 }, { x: 0, y: 10 }];
  assert.equal(pointInPolygon({ x: 2, y: 8 }, polygon), true);
  assert.equal(pointInPolygon({ x: 8, y: 8 }, polygon), false);
  assert.equal(pointInPolygon({ x: 0, y: 0 }, []), false);
  assert.equal(catmullRomPath([{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 6 }], 2),
    'M 0 0 C 0 -2 10 -2 12 0 C 14 2 14 12 12 12 C 10 12 0 2 0 0 Z');
});

test('Home monthly money is canonical backend data, never legacy local fund', () => {
  const home = source('entrypoints/dashboard/family/family-home.tsx');
  const balance = source('entrypoints/dashboard/family/family-monthly-balance.tsx');
  assert.doesNotMatch(home + balance, /getCurrentAccountingMonth|family-repositories|localStorage/);
  assert.match(home, /canViewAccounting\(currentUser\).*FamilyMonthlyBalance/);
  assert.match(balance, /getBackendMonthlyAccountingSummary/);
  assert.match(balance, /summary\.totals\.net/);
  assert.match(balance, /status: 'error'/);
  assert.match(balance, /Оновити дані/);
});

test('production startup does not seed legacy quests or replay local payout notifications', () => {
  const quests = source('entrypoints/dashboard/family/family-quests.tsx');
  assert.match(quests, /useState<FamilyQuest\[\]>\(\[\]\)/);
  assert.match(quests, /useState<FamilyQuestTemplate\[\]>\(\[\]\)/);
  assert.match(quests, /useState<FamilyQuestReport\[\]>\(\[\]\)/);
  const notifications = source('lib/family-notifications.ts');
  const replay = notifications.slice(notifications.indexOf('export async function syncFamilyNotificationsFromLocalState'));
  assert.match(replay, /if \(!isFamilyQuestLocalFallbackAllowed\(\)\) return;/);
  assert.ok(replay.indexOf('isFamilyQuestLocalFallbackAllowed') < replay.indexOf('readFamilyAccountingMonths'));
});

test('quest writes reach browser storage only from the explicit development fallback', () => {
  assert.equal(resolveFamilyQuestWriteTarget('backend'), 'backend');
  assert.equal(resolveFamilyQuestWriteTarget('backend_error', 'backend'), 'backend');
  assert.equal(resolveFamilyQuestWriteTarget('backend_loading', 'backend'), 'backend');
  assert.equal(resolveFamilyQuestWriteTarget('dev_local_fallback'), 'local');
  assert.equal(resolveFamilyQuestWriteTarget('dev_local_fallback', 'local'), 'local');
  for (const source of ['backend_loading', 'backend_error', 'local'] as const) {
    assert.equal(resolveFamilyQuestWriteTarget(source), 'blocked');
    assert.equal(resolveFamilyQuestWriteTarget(source, 'local'), 'blocked');
  }
});

test('a failed quest read keeps the last loaded data', () => {
  assert.equal(shouldReplaceFamilyQuestData('backend_error'), false);
  assert.equal(shouldReplaceFamilyQuestData('backend'), true);
  assert.equal(shouldReplaceFamilyQuestData('dev_local_fallback'), true);
});

test('quest join and withdraw failures are not treated as success', async () => {
  await assert.doesNotReject(assertBackendQuestMutationSucceeded(Response.json({ id: 'person-1' })));
  await assert.rejects(
    assertBackendQuestMutationSucceeded(Response.json({ message: 'Quest is closed' }, { status: 409 })),
    (error) => error instanceof FamilyQuestPayoutApiError && error.status === 409 && error.message === 'Quest is closed'
  );
});

test('backend quest payout updates never read or seed the legacy quest store', () => {
  const quests = source('entrypoints/dashboard/family/family-quests.tsx');
  const issueOne = quests.slice(quests.indexOf('async function issueOne'), quests.indexOf('function issueAll'));
  assert.ok(issueOne.indexOf('issueBackendQuestPayout') < issueOne.indexOf("writeTarget === 'blocked'"));
  assert.doesNotMatch(issueOne, /readFamilyQuests/);
  const persist = quests.slice(quests.indexOf('function persistBackendQuestUpdate'), quests.indexOf('async function changeState'));
  assert.doesNotMatch(persist, /readFamilyQuests|saveFamilyQuests/);
});

test('local asset extraction keeps the existing IDB namespace and remains outside shared asset API', () => {
  const assets = source('lib/family-local-assets.ts');
  assert.match(assets, /dragon_house_family_assets_db/);
  assert.match(assets, /asset_blobs/);
  assert.match(assets, /transaction\.addEventListener\('complete'/);
  assert.doesNotMatch(assets, /authenticatedFetch|uploadSharedPilotAsset/);
});
