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
    assert.ok(accountingClientSource.includes('/api/family/accounting/payroll-periods'));
    assert.ok(accountingClientSource.includes('/api/family/accounting/salary-rules'));
    assert.ok(accountingClientSource.includes('/api/family/accounting/payroll-periods/${encodeURIComponent(periodId)}/preview'));
    assert.ok(accountingClientSource.includes('/api/family/accounting/payroll-periods/${encodeURIComponent(periodId)}/validate'));
    assert.ok(accountingClientSource.includes('/api/family/accounting/payout-batches'));
    assert.ok(accountingClientSource.includes('/api/family/accounting/payable-summary'));
    assert.ok(accountingClientSource.includes('/api/family/accounting/payment-proofs/${encodeURIComponent(proofId)}'));
    assert.ok(accountingClientSource.includes('/api/family/members/${encodeURIComponent(memberId)}/accounting-report'));
  });

  it('does not import local accounting repositories or notification payout fallback', () => {
    assert.doesNotMatch(accountingUiSource, /readFamilyAccountingMonths|updateFamilyBonus|addManualLedgerExpense|notifyBonusPaid/u);
    assert.match(accountingUiSource, /data-accounting-source="backend"/u);
  });

  it('keeps loading, empty, error and retry states explicit', () => {
    assert.match(accountingUiSource, /status: 'loading'/u);
    assert.match(accountingUiSource, /status: 'error'/u);
    assert.match(accountingUiSource, /Retry/u);
    assert.match(accountingUiSource, /No pending accruals/u);
    assert.match(accountingUiSource, /No payout batches/u);
  });

  it('renders payable and paid as finance states without fake payout automation', () => {
    assert.match(accountingUiSource, /Payable/u);
    assert.match(accountingUiSource, /Paid/u);
    assert.match(accountingClientSource, /confirm-paid/u);
    assert.doesNotMatch(accountingUiSource, /automatic payout|auto payout|salary formula/u);
  });

  it('renders salary rule management, validation warnings and payroll preview without zero-rule fallback', () => {
    assert.match(accountingUiSource, /Salary Rules/u);
    assert.match(accountingUiSource, /Payroll Preview/u);
    assert.match(accountingUiSource, /Configuration warnings/u);
    assert.match(accountingUiSource, /Preview is dry-run only/u);
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
    assert.match(accountingUiSource, /Квестова премія/u);
    assert.match(accountingUiSource, /Leadership premium/u);
    assert.match(accountingUiSource, /Premium preview/u);
  });

  it('enforces manual premium range in the production UI and keeps proof-required payout confirmation', () => {
    assert.match(accountingUiSource, /Manual premium range: 50,000 - 500,000/u);
    assert.match(accountingUiSource, /manualPremiumAmountValid/u);
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
    assert.match(personalAccountingPanelSource, /1\+ \/ 1 ✅/u);
    assert.match(personalAccountingPanelSource, /Виконано через сімейний квест/u);
    assert.match(personalAccountingPanelSource, /Виконано через участь у вишках \/ стаках/u);
    assert.match(personalAccountingPanelSource, /Виконано обома способами/u);
    assert.match(personalAccountingPanelSource, /Для отримання базової зарплати потрібно виконати хоча б 1 сімейний квест або взяти участь хоча б в 1 вишці\/стаку протягом тижня/u);
    assert.match(personalAccountingPanelSource, /напишіть Старшим драконам/u);
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
    assert.match(accountingUiSource, /Payment history member filter/u);
    assert.match(accountingUiSource, /Payment history payer filter/u);
    assert.match(accountingUiSource, /paymentCategoryForItem/u);
    assert.match(personalAccountingPanelSource, /personalPaymentTabs/u);
    assert.match(personalAccountingPanelSource, /filterPersonalPaymentHistory/u);
    assert.match(personalAccountingPanelSource, /Personal payment history categories/u);
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
    assert.match(accountingUiSource, /Close proof viewer/u);
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
