import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  applyBackendPayoutResultToQuest,
  backendPayoutIdempotencyKey,
  resolveBackendPayoutTarget
} from '../entrypoints/dashboard/family/family-quest-payout-backend.ts';
import {
  FamilyQuestPayoutApiError,
  parseIssueBackendQuestPayoutResponse
} from '../lib/family-quest-payout-response.ts';
import type { IssueBackendQuestPayoutResult } from '../lib/family-quest-payout-response.ts';
import type { FamilyQuest } from '../lib/family-types.ts';

const questUiSource = readFileSync(new URL('../entrypoints/dashboard/family/family-quests.tsx', import.meta.url), 'utf8');
const clientSource = readFileSync(new URL('../lib/family-quest-backend-client.ts', import.meta.url), 'utf8');

function quest(): FamilyQuest {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    templateId: 'template-1',
    title: 'Backend quest',
    description: 'Quest',
    category: 'Бізнес',
    scheduledAt: '2026-08-10T10:00:00.000Z',
    recommendedTeamSize: 1,
    maxTeamSize: 1,
    rewardAmount: 500,
    totalReward: 500,
    memberRewardPool: 500,
    familyBankShare: 0,
    familyReward: 0,
    splitMode: 'manual',
    rewardMode: 'manual',
    rewardLabel: 'Quest reward',
    steps: [],
    hint: null,
    route: null,
    items: null,
    requiredItems: null,
    imageUrl: '',
    organizer: 'manager-1',
    participants: [
      {
        userId: 'member-1',
        nickname: 'Member',
        type: 'participant',
        joinedAt: '2026-08-10T10:00:00.000Z',
        rewardAmount: 500,
        payoutStatus: 'pending',
      },
    ],
    helpers: [],
    totalAmount: 500,
    payouts: [
      {
        userId: 'member-1',
        amount: 500,
        finalAmount: 500,
        status: 'pending',
        source: 'backend',
        backendPayoutId: '22222222-2222-4222-8222-222222222222',
        backendFamilyMemberId: 'member-1',
      },
    ],
    status: 'sent_to_accounting',
    approvedBy: null,
    reportId: 'report-1',
    reportSentToAccountingAt: null,
    paidAt: null,
    paidBy: null,
    createdAt: '2026-08-10T10:00:00.000Z',
    updatedAt: '2026-08-10T10:00:00.000Z',
  };
}

function issueResult(overrides: Partial<IssueBackendQuestPayoutResult> = {}): IssueBackendQuestPayoutResult {
  return {
    questId: '11111111-1111-4111-8111-111111111111',
    payoutId: '22222222-2222-4222-8222-222222222222',
    familyMemberId: 'member-1',
    amount: 500,
    currency: 'USD',
    payoutStatus: 'paid',
    paidAt: '2026-08-10T11:00:00.000Z',
    paidByFamilyMemberId: 'manager-1',
    idempotencyKey: 'family-hub-quest-payout:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222',
    payoutEventKey: 'quest-payout:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222',
    accrual: { id: '33333333-3333-4333-8333-333333333333' },
    accountingTransaction: { id: '44444444-4444-4444-8444-444444444444' },
    alreadyIssued: false,
    ...overrides,
  };
}

describe('Family Quest backend payout integration', () => {
  it('parses a successful backend payout response and updates quest payout state', async () => {
    const parsed = await parseIssueBackendQuestPayoutResponse(Response.json(issueResult()));
    const updated = applyBackendPayoutResultToQuest(quest(), parsed);

    assert.equal(parsed.payoutStatus, 'paid');
    assert.equal(updated.payouts[0].status, 'paid');
    assert.equal(updated.payouts[0].accrualId, '33333333-3333-4333-8333-333333333333');
    assert.equal(updated.payouts[0].accountingTransactionId, '44444444-4444-4444-8444-444444444444');
    assert.equal(updated.participants[0].payoutStatus, 'paid');
  });

  it('uses the exact backend endpoint and sends the stable idempotency key in the body', () => {
    assert.match(clientSource, /\/api\/family\/quests\/\$\{encodeURIComponent\(input\.questId\)\}\/payouts\/\$\{encodeURIComponent\(input\.payoutId\)\}\/issue/u);
    assert.match(clientSource, /authenticatedFetch\(path/u);
    assert.match(clientSource, /JSON\.stringify\(\{ confirm: true, idempotencyKey: input\.idempotencyKey \}\)/u);
  });

  it('resolves backend payout identity and reuses the same idempotency key for retries', () => {
    const target = resolveBackendPayoutTarget(quest(), quest().payouts[0]);
    assert.equal(target?.payoutId, '22222222-2222-4222-8222-222222222222');
    assert.equal(target?.idempotencyKey, backendPayoutIdempotencyKey(quest().id, quest().payouts[0].backendPayoutId ?? ''));
    assert.equal(target?.idempotencyKey, backendPayoutIdempotencyKey(quest().id, quest().payouts[0].backendPayoutId ?? ''));
  });

  it('does not treat local-only payouts as backend-backed', () => {
    const localQuest = quest();
    const localPayout = { ...localQuest.payouts[0], source: 'local' as const, backendPayoutId: null };
    assert.equal(resolveBackendPayoutTarget(localQuest, localPayout), null);
  });

  it('disables the clicked payout while issuing and guards rapid repeated clicks', () => {
    assert.match(questUiSource, /issuingBackendPayoutsRef/u);
    assert.match(questUiSource, /issuingBackendPayoutsRef\.current\.has\(backendTarget\.payoutKey\)/u);
    assert.match(questUiSource, /disabled=\{isIssuing \|\| payout\?\.status === 'paid'/u);
  });

  it('keeps successful and already-completed same-key backend responses on the success path', () => {
    assert.match(questUiSource, /result\.alreadyIssued \? 'Backend already completed this payout\.'/u);
    assert.equal(applyBackendPayoutResultToQuest(quest(), issueResult({ alreadyIssued: true })).payouts[0].status, 'paid');
  });

  it('does not call legacy local accounting for a backend-backed single payout', () => {
    assert.match(questUiSource, /await issueBackendQuestPayout/u);
    assert.match(questUiSource, /return;\s*\}\s*try\s*\{\s*const result = issueFamilyQuestPayouts/u);
  });

  it('keeps local-only payouts on the old local workflow', () => {
    assert.match(questUiSource, /const result = issueFamilyQuestPayouts\(\{ questId, actorId: currentUser\.id, userIds: \[userId\] \}\)/u);
  });

  it('does not fall back to local payout when backend issuing fails', () => {
    assert.match(questUiSource, /Backend тимчасово недоступний\. Local fallback для backend payout вимкнено\./u);
    assert.match(questUiSource, /catch \(error\) \{[\s\S]*setPayoutFeedback/u);
  });

  it('handles idempotency conflict and unauthorized errors safely', () => {
    assert.match(questUiSource, /QUEST_PAYOUT_IDEMPOTENCY_CONFLICT/u);
    assert.match(questUiSource, /QUEST_PAYOUT_UNAUTHORIZED/u);
  });

  it('rejects malformed backend responses', async () => {
    await assert.rejects(
      parseIssueBackendQuestPayoutResponse(Response.json({ ok: true })),
      (error) => error instanceof FamilyQuestPayoutApiError && error.code === 'MALFORMED_RESPONSE',
    );
  });

  it('maps backend already-paid and forbidden responses to explicit frontend errors', async () => {
    await assert.rejects(
      parseIssueBackendQuestPayoutResponse(Response.json({ code: 'QUEST_PAYOUT_ALREADY_PAID', message: 'Already paid' }, { status: 409 })),
      (error) => error instanceof FamilyQuestPayoutApiError && error.code === 'QUEST_PAYOUT_ALREADY_PAID',
    );
    await assert.rejects(
      parseIssueBackendQuestPayoutResponse(Response.json({ code: 'QUEST_PAYOUT_PERMISSION_DENIED', message: 'Forbidden' }, { status: 403 })),
      (error) => error instanceof FamilyQuestPayoutApiError && error.code === 'QUEST_PAYOUT_UNAUTHORIZED',
    );
  });

  it('blocks issue-all local accounting for backend-backed payouts', () => {
    assert.match(questUiSource, /hasBackendPayouts \|\| !plan\.isComplete/u);
    assert.match(questUiSource, /Backend-backed payouts must be issued one at a time through backend\./u);
  });
});
