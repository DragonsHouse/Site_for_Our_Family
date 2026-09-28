import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const accountingUiSource = readFileSync(new URL('../entrypoints/dashboard/family/family-accounting.tsx', import.meta.url), 'utf8');
const accountingClientSource = readFileSync(new URL('../lib/family-accounting-backend-client.ts', import.meta.url), 'utf8');
const personalAccountingPanelSource = readFileSync(new URL('../entrypoints/dashboard/family/family-personal-accounting-panel.tsx', import.meta.url), 'utf8');
const profileSource = readFileSync(new URL('../entrypoints/dashboard/family/dragon-profile.tsx', import.meta.url), 'utf8');

describe('family accounting backend integration', () => {
  it('uses backend accounting routes for production dashboard and member report', () => {
    assert.ok(accountingClientSource.includes('/api/family/accounting/dashboard'));
    assert.ok(accountingClientSource.includes('/api/family/accounting/discord-feed'));
    assert.ok(accountingClientSource.includes('/api/family/accounting/payroll-periods'));
    assert.ok(accountingClientSource.includes('/api/family/accounting/salary-rules'));
    assert.ok(accountingClientSource.includes('/api/family/accounting/payroll-periods/${encodeURIComponent(periodId)}/preview'));
    assert.ok(accountingClientSource.includes('/api/family/accounting/payroll-periods/${encodeURIComponent(periodId)}/validate'));
    assert.ok(accountingClientSource.includes('/api/family/accounting/payout-batches'));
    assert.ok(accountingClientSource.includes('/api/family/accounting/payable-summary'));
    assert.ok(accountingClientSource.includes('/api/family/accounting/payment-proofs/${encodeURIComponent(proofId)}'));
    assert.ok(accountingClientSource.includes('/api/family/members/${encodeURIComponent(memberId)}/accounting-report'));
  });

  it('loads Discord accounting feed on the same refresh loop as backend accounting', () => {
    assert.match(accountingUiSource, /ACCOUNTING_REFRESH_INTERVAL_MS = 30_000/u);
    assert.match(accountingUiSource, /getBackendDiscordAccountingFeed/u);
    assert.match(accountingUiSource, /DiscordAccountingFeedPanel/u);
    assert.match(accountingUiSource, /discordFeed/u);
    assert.match(accountingUiSource, /messages \/ \{imageCount\} photos/u);
  });

  it('does not import local accounting repositories or notification payout fallback', () => {
    assert.doesNotMatch(accountingUiSource, /readFamilyAccountingMonths|updateFamilyBonus|addManualLedgerExpense|notifyBonusPaid/u);
    assert.match(accountingUiSource, /data-accounting-source="backend"/u);
  });

  it('keeps loading, empty, error and retry states explicit', () => {
    assert.match(accountingUiSource, /status: 'loading'/u);
    assert.match(accountingUiSource, /status: 'error'/u);
    assert.match(accountingUiSource, /\u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u0438/u);
    assert.match(accountingUiSource, /\u0414\u0430\u043d\u0438\u0445 \u043f\u043e\u043a\u0438 \u043d\u0435\u043c\u0430\u0454/u);
    assert.match(accountingUiSource, /\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0437\u0430\u0432\u0430\u043d\u0442\u0430\u0436\u0438\u0442\u0438 \u0434\u0430\u043d\u0456/u);
  });

  it('renders payable and paid as finance states without fake payout automation', () => {
    assert.match(accountingUiSource, /\u0414\u043e \u0432\u0438\u043f\u043b\u0430\u0442\u0438/u);
    assert.match(accountingUiSource, /\u0412\u0438\u043f\u043b\u0430\u0447\u0435\u043d\u043e/u);
    assert.match(accountingClientSource, /confirm-paid/u);
    assert.doesNotMatch(accountingUiSource, /automatic payout|auto payout|salary formula/u);
  });

  it('renders salary rule management, validation warnings and payroll preview without zero-rule fallback', () => {
    assert.match(accountingUiSource, /\u041f\u0435\u0440\u0456\u043e\u0434\u0438 \u0437\u0430\u0440\u043f\u043b\u0430\u0442\u0438/u);
    assert.match(accountingUiSource, /\u041f\u043e\u043f\u0435\u0440\u0435\u0434\u043d\u0456\u0439 \u0440\u043e\u0437\u0440\u0430\u0445\u0443\u043d\u043e\u043a \u0437\u0430\u0440\u043f\u043b\u0430\u0442\u0438/u);
    assert.match(accountingUiSource, /\u0404 \u043f\u043e\u043f\u0435\u0440\u0435\u0434\u0436\u0435\u043d\u043d\u044f/u);
    assert.match(accountingUiSource, /\u043d\u0435 \u0432\u0456\u0434\u043f\u043e\u0432\u0456\u0434\u0430\u0454 \u0443\u043c\u043e\u0432\u0430\u043c/u);
    assert.doesNotMatch(accountingUiSource, /Create zero rule|Manual zero rule/u);
    assert.match(accountingClientSource, /listBackendSalaryRules/u);
    assert.match(accountingClientSource, /previewBackendPayrollPeriod/u);
    assert.match(accountingClientSource, /setBackendSalaryRuleActive/u);
  });

  it('loads backend weekly activity status and renders the personal activity card without mock fallback', () => {
    assert.match(accountingClientSource, /weekly-activity/u);
    assert.match(accountingClientSource, /getBackendWeeklyActivityStatus/u);
    assert.match(accountingUiSource, /Тижнева активність/u);
    assert.match(accountingUiSource, /Квести цього тижня/u);
    assert.match(accountingUiSource, /Вишки \/ стаки/u);
    assert.match(accountingUiSource, /Тижнева активність виконана/u);
    assert.match(accountingUiSource, /Для отримання базової зарплати потрібно виконати хоча б 1 сімейний квест або взяти участь хоча б в 1 вишці\/стаку протягом тижня/u);
  });

  it('renders the expanded weekly earnings breakdown and premium preview categories', () => {
    assert.match(accountingClientSource, /questPremium/u);
    assert.match(accountingClientSource, /leadershipPremium/u);
    assert.match(accountingClientSource, /specialPremium/u);
    assert.match(accountingUiSource, /Квестова премія/u);
    assert.match(accountingUiSource, /\u041f\u0440\u0435\u043c\u0456\u044f \u0437\u0430 \u043b\u0456\u0434\u0435\u0440\u0441\u0442\u0432\u043e/u);
    assert.match(accountingUiSource, /Рекрутери \/ HR/u);
    assert.match(accountingUiSource, /premiumPreview/u);
  });

  it('enforces manual premium range in the production UI and keeps proof-required payout confirmation', () => {
    assert.match(accountingUiSource, /\u0420\u0443\u0447\u043d\u0430 \u043e\u0441\u043e\u0431\u0438\u0441\u0442\u0430 \u043f\u0440\u0435\u043c\u0456\u044f \u043c\u0430\u0454 \u0431\u0443\u0442\u0438 50 000 - 500 000/u);
    assert.match(accountingUiSource, /manualPremiumAmountValid/u);
    assert.match(accountingUiSource, /premiumAmountValid/u);
    assert.match(accountingClientSource, /confirm-paid/u);
    assert.match(accountingClientSource, /paymentProofId/u);
    assert.match(accountingClientSource, /payerNicknameSnapshot/u);
    assert.match(accountingClientSource, /payerRoleSnapshot/u);
  });

  it('mounts a backend-backed personal cabinet accounting panel before activity timeline', () => {
    assert.match(profileSource, /FamilyPersonalAccountingPanel/u);
    assert.match(personalAccountingPanelSource, /getBackendWeeklyActivityStatus/u);
    assert.match(personalAccountingPanelSource, /getBackendMemberAccountingReport/u);
    assert.match(personalAccountingPanelSource, /Особистий кабінет/u);
    assert.match(personalAccountingPanelSource, /Тижнева активність/u);
    assert.match(personalAccountingPanelSource, /Заробіток за тиждень/u);
    assert.match(personalAccountingPanelSource, /Очікує виплати/u);
    assert.match(personalAccountingPanelSource, /Історія виплат/u);
    assert.doesNotMatch(personalAccountingPanelSource, /mock/i);
  });

  it('renders OR weekly activity progress with friendly inactive guidance', () => {
    assert.match(personalAccountingPanelSource, /1\+ \/ 1/u);
    assert.match(personalAccountingPanelSource, /сімейний квест/u);
    assert.match(personalAccountingPanelSource, /участь у вишках \/ стаках/u);
    assert.match(personalAccountingPanelSource, /квест і вишки \/ стаки/u);
    assert.match(personalAccountingPanelSource, /Для базової зарплати потрібен хоча б 1 сімейний квест або участь хоча б в 1 вишці\/стаку протягом тижня/u);
  });

  it('renders manager grouped payable flow and safe proof viewer without exposing storage paths', () => {
    assert.match(accountingUiSource, /Потрібно виплатити/u);
    assert.match(accountingUiSource, /PayableMemberCard/u);
    assert.match(accountingUiSource, /Виплатити/u);
    assert.match(accountingUiSource, /Прикріпіть скріншот виплати/u);
    assert.match(accountingUiSource, /PNG, JPG\/JPEG, WEBP до 5 MB/u);
    assert.match(accountingUiSource, /Переглянути підтвердження/u);
    assert.match(accountingUiSource, /fetchBackendPaymentProofDataUrl/u);
    assert.doesNotMatch(accountingUiSource, /storage_key|storageKey|localStorage/u);
  });

  it('renders payment history category tabs and friendly filters for manager and member views', () => {
    assert.match(accountingUiSource, /managerHistoryTabs/u);
    assert.match(accountingUiSource, /PaymentHistoryManager/u);
    assert.match(accountingUiSource, /role="tablist"/u);
    assert.match(accountingUiSource, /Фільтр історії виплат за учасником/u);
    assert.match(accountingUiSource, /Фільтр історії виплат за виплатником/u);
    assert.match(accountingUiSource, /paymentCategoryForItem/u);
    assert.match(personalAccountingPanelSource, /personalPaymentTabs/u);
    assert.match(personalAccountingPanelSource, /filterPersonalPaymentHistory/u);
    assert.match(personalAccountingPanelSource, /personalPaymentTabs/u);
    assert.doesNotMatch(personalAccountingPanelSource, /mock/i);
  });

  it('renders paid and outstanding labels without relying only on color', () => {
    assert.match(accountingUiSource, /Виплачено|Р’РёРїР»Р°С‡РµРЅРѕ/u);
    assert.match(accountingUiSource, /Очікує виплати|РћС‡С–РєСѓС” РІРёРїР»Р°С‚Рё/u);
    assert.match(accountingUiSource, /paymentCategoryLabel/u);
    assert.doesNotMatch(accountingUiSource, /manage_treasury.*Виплатив/u);
  });

  it('uses a responsive payout batch card summary instead of table-only layout', () => {
    assert.match(accountingUiSource, /data-responsive-payout-batch="stacked-card"/u);
    assert.match(accountingUiSource, /MiniMetric/u);
    assert.match(accountingUiSource, /paidCount/u);
    assert.match(accountingUiSource, /outstandingCount/u);
  });

  it('renders proof lightbox loading, error, retry and close states', () => {
    assert.match(accountingUiSource, /ProofViewerState/u);
    assert.match(accountingUiSource, /status: 'loading'/u);
    assert.match(accountingUiSource, /status: 'error'/u);
    assert.match(accountingUiSource, /retryProofViewer/u);
    assert.match(accountingUiSource, /\u0417\u0430\u043a\u0440\u0438\u0442\u0438 \u043f\u0435\u0440\u0435\u0433\u043b\u044f\u0434 \u043f\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043d\u043d\u044f/u);
    assert.match(accountingUiSource, /onClick=\{\(\) => setProofViewer\(null\)\}/u);
    assert.match(accountingUiSource, /object-contain/u);
  });

  it('keeps payer snapshots visible in payment rows and proof details', () => {
    assert.match(accountingUiSource, /payerNicknameSnapshot/u);
    assert.match(accountingUiSource, /payerRoleSnapshot/u);
    assert.match(accountingUiSource, /paymentProofDetails/u);
    assert.match(personalAccountingPanelSource, /payerNicknameSnapshot/u);
    assert.match(personalAccountingPanelSource, /payerRoleSnapshot/u);
  });
});
