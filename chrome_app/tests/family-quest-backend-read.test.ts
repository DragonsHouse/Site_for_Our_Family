import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  includeBackendQuestViewTemplates,
  mapBackendQuest,
  mapBackendQuestReport,
  mapBackendQuestTemplate
} from '../lib/family-quest-backend-mapper.ts';
import {
  FamilyQuestPayoutApiError,
} from '../lib/family-quest-payout-response.ts';
import {
  parseBackendQuestDetailResponse,
  parseBackendQuestListResponse,
  parseBackendQuestTemplateListResponse
} from '../lib/family-quest-backend-response.ts';
import type { BackendFamilyQuestDto, BackendFamilyQuestTemplateDto } from '../lib/family-quest-backend-response.ts';

const clientSource = readFileSync(new URL('../lib/family-quest-backend-client.ts', import.meta.url), 'utf8');
const adapterSource = readFileSync(new URL('../lib/family-quest-read-adapter.ts', import.meta.url), 'utf8');
const questUiSource = readFileSync(new URL('../entrypoints/dashboard/family/family-quests.tsx', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

function template(overrides: Partial<BackendFamilyQuestTemplateDto> = {}): BackendFamilyQuestTemplateDto {
  return {
    id: 'template-1',
    templateKey: 'template-key',
    title: 'Backend template',
    category: 'Бізнес',
    description: 'Backend description',
    steps: ['one', 'two'],
    recommendedTeamSize: 4,
    totalReward: 1200,
    memberRewardPool: 900,
    familyReward: 300,
    rewardMode: 'manual',
    requiredItems: 'armor',
    imageAssetId: null,
    isActive: true,
    cooldownHours: 24,
    cooldownUntil: null,
    createdAt: '2026-08-10T10:00:00.000Z',
    updatedAt: '2026-08-10T11:00:00.000Z',
    ...overrides,
  };
}

function quest(overrides: Partial<BackendFamilyQuestDto> = {}): BackendFamilyQuestDto {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    templateId: 'template-1',
    title: 'Backend quest',
    description: 'Backend quest description',
    category: 'Бізнес',
    status: 'sent_to_accounting',
    startsAt: '2026-08-10T10:00:00.000Z',
    endsAt: null,
    scheduledAt: '2026-08-10T10:00:00.000Z',
    organizerFamilyMemberId: 'manager-1',
    totalReward: 1200,
    memberRewardPool: 900,
    familyReward: 300,
    rewardMode: 'manual',
    requiredItems: null,
    bestParticipantFamilyMemberId: 'member-1',
    bestParticipantReason: 'Best report',
    reportId: 'report-1',
    reportSentToAccountingAt: '2026-08-10T11:00:00.000Z',
    paidAt: null,
    paidByFamilyMemberId: null,
    participants: [
      {
        id: 'person-1',
        familyMemberId: 'member-1',
        displayName: 'Member One',
        role: 'participant',
        joinedAt: '2026-08-10T10:00:00.000Z',
        leftAt: null,
        joinedLate: false,
        participationNote: null,
        addedManually: false,
        addedByFamilyMemberId: null,
        rewardPercent: 60,
        rewardAmount: 540,
        bonusAmount: 0,
        bonusPercent: 0,
        isBestParticipant: true,
        bestParticipantReason: 'Best report',
        payoutStatus: 'pending',
        paidAt: null,
        paidByFamilyMemberId: null,
      },
    ],
    helpers: [
      {
        id: 'person-2',
        familyMemberId: 'member-2',
        displayName: 'Member Two',
        role: 'helper',
        joinedAt: '2026-08-10T10:05:00.000Z',
        leftAt: null,
        joinedLate: true,
        participationNote: 'helped',
        addedManually: true,
        addedByFamilyMemberId: 'manager-1',
        rewardPercent: 40,
        rewardAmount: 360,
        bonusAmount: 0,
        bonusPercent: 0,
        isBestParticipant: false,
        bestParticipantReason: null,
        payoutStatus: 'paid',
        paidAt: '2026-08-10T12:00:00.000Z',
        paidByFamilyMemberId: 'manager-1',
      },
    ],
    rewards: [
      {
        id: 'reward-money-1',
        questPersonId: 'person-1',
        rewardType: 'money',
        title: 'Money',
        amount: 540,
        currency: 'USD',
        quantity: null,
        status: 'issued',
        issuedAt: '2026-08-10T12:00:00.000Z',
        issuedByFamilyMemberId: 'manager-1',
      },
      {
        id: 'reward-item-1',
        questPersonId: 'person-2',
        rewardType: 'item',
        title: 'Armor',
        amount: null,
        currency: null,
        quantity: 2,
        status: 'issued',
        issuedAt: '2026-08-10T12:00:00.000Z',
        issuedByFamilyMemberId: 'manager-1',
      },
    ],
    report: {
      id: 'report-1',
      title: 'Report',
      comment: null,
      confirmedByFamilyMemberId: 'manager-1',
      totalReward: 1200,
      memberRewardPool: 900,
      familyReward: 300,
      transferredToAccountingAt: '2026-08-10T11:00:00.000Z',
      createdAt: '2026-08-10T10:50:00.000Z',
      updatedAt: '2026-08-10T11:00:00.000Z',
    },
    payouts: [
      {
        id: '22222222-2222-4222-8222-222222222222',
        reportId: 'report-1',
        questPersonId: 'person-1',
        familyMemberId: 'member-1',
        displayName: 'Member One',
        amount: 540,
        rewardPercent: 60,
        rewardItems: [],
        bonusAmount: 0,
        bonusPercent: 0,
        status: 'pending',
        paidAt: null,
        paidByFamilyMemberId: null,
        idempotencyKey: null,
        accrualId: null,
        accountingTransactionId: null,
        issuedAt: null,
        issuedByFamilyMemberId: null,
        payoutEventKey: 'quest-payout-key',
      },
    ],
    auditTrail: [
      {
        id: 'audit-1',
        actorFamilyMemberId: 'manager-1',
        action: 'report_created',
        comment: null,
        previousStatus: 'completed',
        newStatus: 'reported',
        relatedFamilyMemberId: null,
        createdAt: '2026-08-10T10:50:00.000Z',
      },
    ],
    createdAt: '2026-08-10T10:00:00.000Z',
    updatedAt: '2026-08-10T11:00:00.000Z',
    ...overrides,
  };
}

describe('Family Quest backend read adapter', () => {
  it('maps backend quest lists, participants, helpers and reports into Family Hub models', () => {
    const mapped = mapBackendQuest(quest());
    const report = mapBackendQuestReport(mapped);

    assert.equal(mapped.source, 'backend');
    assert.equal(mapped.backendQuestId, '11111111-1111-4111-8111-111111111111');
    assert.equal(mapped.participants[0].backendQuestPersonId, 'person-1');
    assert.equal(mapped.participants[0].backendFamilyMemberId, 'member-1');
    assert.equal(mapped.helpers?.[0].backendQuestPersonId, 'person-2');
    assert.equal(mapped.helpers?.[0].joinedLate, true);
    assert.equal(report?.questId, mapped.id);
    assert.equal(report?.transferredToAccountingAt, '2026-08-10T11:00:00.000Z');
  });

  it('maps backend templates and derives view templates for backend quests without matching templates', () => {
    const mappedTemplate = mapBackendQuestTemplate(template());
    const orphanQuest = mapBackendQuest(quest({ templateId: null, id: 'quest-without-template' }));
    const templates = includeBackendQuestViewTemplates([mappedTemplate], [orphanQuest]);

    assert.equal(mappedTemplate.source, 'backend');
    assert.equal(mappedTemplate.backendTemplateId, 'template-1');
    assert.equal(templates.some((item) => item.backendQuestId === 'quest-without-template'), true);
  });

  it('maps backend payouts so manual issue uses the safe backend payout path', () => {
    const mapped = mapBackendQuest(quest());
    assert.equal(mapped.payouts[0].source, 'backend');
    assert.equal(mapped.payouts[0].backendPayoutId, '22222222-2222-4222-8222-222222222222');
    assert.equal(mapped.payouts[0].backendQuestPersonId, 'person-1');
    assert.equal(mapped.payouts[0].backendFamilyMemberId, 'member-1');
    assert.equal(mapped.payouts[0].payoutEventKey, 'quest-payout-key');
  });

  it('maps reward issued state without marking item rewards as money payouts', () => {
    const mapped = mapBackendQuest(quest());
    assert.equal(mapped.helpers?.[0].rewardItems?.[0].backendRewardId, 'reward-item-1');
    assert.equal(mapped.helpers?.[0].rewardItems?.[0].status, 'issued');
    assert.equal(mapped.participants[0].rewardItems?.length, 0);
  });

  it('parses backend template list, quest list and quest detail responses explicitly', async () => {
    assert.equal((await parseBackendQuestTemplateListResponse(Response.json({ items: [template()] }))).items[0].id, 'template-1');
    assert.equal((await parseBackendQuestListResponse(Response.json({ items: [quest()] }))).items[0].id, quest().id);
    assert.equal((await parseBackendQuestDetailResponse(Response.json(quest()))).id, quest().id);
  });

  it('treats backend [] as a valid backend success, not a local fallback trigger', async () => {
    const parsed = await parseBackendQuestListResponse(Response.json({ items: [] }));
    assert.deepEqual(parsed.items, []);
    assert.match(adapterSource, /source: 'backend'[\s\S]*templates: includeBackendQuestViewTemplates/u);
    assert.equal(adapterSource.includes('if (!questResponse.items.length)'), false);
  });

  it('falls back to local reads only on backend failure and does not blindly merge backend and local data', () => {
    assert.match(adapterSource, /catch \(error\) \{[\s\S]*source: 'local'/u);
    assert.match(adapterSource, /readFamilyQuestTemplates/u);
    assert.match(adapterSource, /readFamilyQuests/u);
    assert.doesNotMatch(adapterSource, /\.\.\.readFamilyQuests\(\).*questResponse|questResponse.*\.\.\.readFamilyQuests\(\)/su);
  });

  it('rejects malformed backend quest responses safely', async () => {
    await assert.rejects(
      parseBackendQuestListResponse(Response.json({ items: [{ id: 'missing-fields' }] })),
      (error) => error instanceof FamilyQuestPayoutApiError && error.code === 'MALFORMED_RESPONSE',
    );
  });

  it('uses authenticated backend read endpoints', () => {
    assert.match(clientSource, /authenticatedFetch\('\/api\/family\/quest-templates'/u);
    assert.match(clientSource, /authenticatedFetch\(`\/api\/family\/quests\$\{query\}`/u);
    assert.match(clientSource, /authenticatedFetch\(`\/api\/family\/quests\/\$\{encodeURIComponent\(questId\)\}`/u);
  });

  it('prevents unsupported backend quest local mutations while keeping local mutation functions present', () => {
    assert.match(questUiSource, /BACKEND_WRITE_PENDING_MESSAGE/u);
    assert.match(questUiSource, /isBackendQuest\(quest\)[\s\S]*preventBackendWrite\(\)/u);
    assert.match(questUiSource, /isBackendTemplate\(template\)[\s\S]*preventBackendWrite\(\)/u);
    assert.match(questUiSource, /issueFamilyQuestPayouts\(\{ questId, actorId: currentUser\.id, userIds: \[userId\] \}\)/u);
  });

  it('loads backend quest state asynchronously without breaking local fallback rendering', () => {
    assert.match(questUiSource, /useEffect\(\(\) => \{/u);
    assert.match(questUiSource, /loadFamilyQuestReadState\(controller\.signal\)/u);
    assert.match(questUiSource, /setQuestReadSource\(state\.source\)/u);
    assert.match(questUiSource, /Backend quests unavailable\. Showing local fallback\./u);
  });

  it('keeps this read adapter test in the frontend suite', () => {
    assert.match(packageJson.scripts['test:auth-source'], /tests\/family-quest-backend-read\.test\.ts/);
  });
});
