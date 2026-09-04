import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { mapBackendMemberActivityItem, mapBackendMemberProfileReport } from '../lib/family-member-activity-backend-mapper.ts';
import { parseBackendMemberActivityResponse, parseBackendMemberProfileReportResponse } from '../lib/family-member-activity-backend-response.ts';

describe('member activity backend integration', () => {
  it('maps backend activity and report responses for profile UI', async () => {
    const activity = await parseBackendMemberActivityResponse(jsonResponse({
      items: [{
        id: 'tower_defense:response:response-id:confirmed',
        type: 'tower_defense_confirmed',
        sourceModule: 'tower_defense',
        sourceId: 'defense-id',
        sourceSubId: 'response-id',
        occurredAt: '2026-08-10T09:00:00.000Z',
        title: 'Tower defense confirmed',
        description: 'Member confirmed participation.',
        metadata: { towerCode: 'LS-01', towerName: 'Legion Square' },
        xpDelta: 25,
      }],
      pagination: { limit: 25, nextCursor: null, hasMore: false },
    }));
    const report = await parseBackendMemberProfileReportResponse(jsonResponse(reportBody()));

    assert.equal(activity.items.length, 1);
    assert.deepEqual(mapBackendMemberActivityItem(activity.items[0]!), {
      id: 'tower_defense:response:response-id:confirmed',
      type: 'tower_defense_confirmed',
      sourceModule: 'tower_defense',
      occurredAt: '2026-08-10T09:00:00.000Z',
      title: 'Tower defense confirmed',
      description: 'Member confirmed participation.',
      relatedLabel: 'LS-01 · Legion Square',
      xpDelta: 25,
    });
    assert.equal(mapBackendMemberProfileReport(report).towerDefense.defensesAttended, 1);
    assert.equal(mapBackendMemberProfileReport(report).events.eventsAttended, 0);
  });

  it('keeps backend [] as an empty timeline and rejects malformed responses', async () => {
    const empty = await parseBackendMemberActivityResponse(jsonResponse({ items: [], pagination: { limit: 25, nextCursor: null, hasMore: false } }));
    assert.deepEqual(empty.items, []);
    await assert.rejects(
      parseBackendMemberActivityResponse(jsonResponse({ items: [{ id: 'broken' }], pagination: { limit: 25, nextCursor: null, hasMore: false } })),
      /malformed/i,
    );
  });

  it('wires profile UI to real familyMemberId and avoids production mock fallback', () => {
    const panel = readFileSync(new URL('../entrypoints/dashboard/family/family-member-activity-panel.tsx', import.meta.url), 'utf8');
    const details = readFileSync(new URL('../entrypoints/dashboard/family/family-member-details.tsx', import.meta.url), 'utf8');
    const profile = readFileSync(new URL('../entrypoints/dashboard/family/dragon-profile.tsx', import.meta.url), 'utf8');

    assert.match(panel, /listBackendMemberActivity\(memberId/u);
    assert.match(panel, /getBackendMemberProfileReport\(memberId/u);
    assert.match(panel, /status: 'loading'/u);
    assert.match(panel, /status: 'error'/u);
    assert.match(panel, /No activity yet/u);
    assert.match(panel, /Retry/u);
    assert.doesNotMatch(panel, /mockDragonProfileRepository/u);
    assert.match(details, /<FamilyMemberActivityPanel memberId=\{member\.memberId\}/u);
    assert.match(profile, /<FamilyMemberActivityPanel memberId=\{user\.id\}/u);
    assert.doesNotMatch(details, /nickname.*activity/iu);
  });
});

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function reportBody() {
  return {
    memberId: 'member-id',
    quests: {
      questsParticipated: 1,
      questsHelped: 0,
      questsCompleted: 1,
      bestParticipantCount: 0,
    },
    towerDefense: {
      defensesResponded: 1,
      defensesAttended: 1,
      defensesCommanded: 0,
      towersDefended: 1,
      towersLost: 0,
      attendancePresent: 1,
      attendanceLate: 0,
      attendanceAbsent: 0,
      attendanceExcused: 0,
    },
    events: {
      eventsJoined: 0,
      eventsAttended: 0,
      eventsOrganized: 0,
      eventAttendancePresent: 0,
      eventAttendanceLate: 0,
      eventAttendanceAbsent: 0,
      eventAttendanceExcused: 0,
    },
    xp: {
      available: true,
      totalEarned: 25,
    },
    finance: null,
    permissions: {
      canViewFinance: false,
    },
  };
}
