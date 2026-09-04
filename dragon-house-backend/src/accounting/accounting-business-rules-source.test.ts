import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const serviceSource = readFileSync(new URL('./accounting-service.ts', import.meta.url), 'utf8');
const routeSource = readFileSync(new URL('../routes/family-accounting.ts', import.meta.url), 'utf8');
const migrationSource = readFileSync(new URL('../../migrations/021_salary_premium_business_rules.sql', import.meta.url), 'utf8');
const productRulesMigrationSource = readFileSync(new URL('../../migrations/022_salary_premium_product_rules_and_payment_proofs.sql', import.meta.url), 'utf8');
const confirmedRulesMigrationSource = readFileSync(new URL('../../migrations/023_seed_salary_premium_product_rules.sql', import.meta.url), 'utf8');
const correctionMigrationSource = readFileSync(new URL('../../migrations/024_correct_senior_dragons_salary_and_kyiv_week_rules.sql', import.meta.url), 'utf8');

describe('salary and premium business rule foundation', () => {
  it('stores rule versions, stacking policy and calculation snapshots', () => {
    expect(migrationSource).toContain('rule_type');
    expect(migrationSource).toContain('version integer not null default 1');
    expect(migrationSource).toContain('stacking_policy');
    expect(migrationSource).toContain('rule_snapshot');
    expect(migrationSource).toContain('input_snapshot');
    expect(migrationSource).toContain('breakdown');
  });

  it('exposes rule management, validation and dry-run preview routes', () => {
    expect(routeSource).toContain("router.get('/family/accounting/salary-rules'");
    expect(routeSource).toContain("router.patch('/family/accounting/salary-rules/:ruleId'");
    expect(routeSource).toContain("router.post('/family/accounting/salary-rules/:ruleId/activate'");
    expect(routeSource).toContain("router.get('/family/accounting/payroll-periods/:periodId/preview'");
    expect(routeSource).toContain("router.get('/family/accounting/payroll-periods/:periodId/validate'");
  });

  it('keeps preview read-only and blocks incomplete payroll calculation', () => {
    expect(serviceSource).toContain('async previewPayrollPeriod');
    expect(serviceSource).toContain("throw new FinanceError('ACCOUNTING_CONFIGURATION_INCOMPLETE'");
    expect(serviceSource).toContain('missing_base_salary_rule');
    expect(serviceSource).toContain('multiple_base_salary_rules_match_member');
    const previewBody = serviceSource.slice(
      serviceSource.indexOf('async previewPayrollPeriod'),
      serviceSource.indexOf('async calculatePayrollPeriod'),
    );
    expect(previewBody).not.toContain('upsertAccrual');
  });

  it('uses period-scoped authoritative metrics without reward or payout double counting', () => {
    const metricsBody = serviceSource.slice(
      serviceSource.indexOf('async function buildPayrollMetricSnapshots'),
      serviceSource.indexOf('function buildPayrollPreview'),
    );
    expect(metricsBody).toContain('family_quest_people');
    expect(metricsBody).toContain('family_tower_defense_attendance');
    expect(metricsBody).toContain('family_event_attendance');
    expect(metricsBody).toContain('family_member_achievements');
    expect(metricsBody).not.toContain('family_member_reward_grants');
    expect(metricsBody).not.toContain('family_quest_payouts');
  });

  it('implements product rules for weekly payroll, quest payout pools and payment proof', () => {
    expect(productRulesMigrationSource).toContain("period_type in ('weekly', 'monthly', 'custom')");
    expect(productRulesMigrationSource).toContain('family_quest_payout_configs');
    expect(productRulesMigrationSource).toContain('people_payout_pool');
    expect(productRulesMigrationSource).toContain('family_payment_proofs');
    expect(productRulesMigrationSource).toContain('payer_nickname_snapshot');
    expect(productRulesMigrationSource).toContain('payer_role_snapshot');
    expect(serviceSource).toContain('completedQuests >= 1 OR towerDefensePresent + towerDefenseLate >= 1');
    expect(serviceSource).toContain('largest_remainder_by_quest_person_id');
    expect(routeSource).toContain("router.post('/family/accounting/quests/:questId/recalculate-payouts'");
  });

  it('seeds confirmed salary and premium amounts without arbitrary thresholds', () => {
    expect(confirmedRulesMigrationSource).toContain('base_salary_rank_01_egg');
    expect(confirmedRulesMigrationSource).toContain('base_salary_rank_02_mini');
    expect(confirmedRulesMigrationSource).toContain('base_salary_rank_03_smoketail');
    expect(confirmedRulesMigrationSource).toContain('50000');
    expect(confirmedRulesMigrationSource).toContain('75000');
    expect(confirmedRulesMigrationSource).toContain('100000');
    expect(confirmedRulesMigrationSource).toContain('125000');
    expect(confirmedRulesMigrationSource).toContain('150000');
    expect(confirmedRulesMigrationSource).toContain('200000');
    expect(confirmedRulesMigrationSource).toContain('300000');
    expect(confirmedRulesMigrationSource).toContain('premium_activity_3');
    expect(confirmedRulesMigrationSource).toContain('premium_quest_activity_3');
    expect(confirmedRulesMigrationSource).toContain('premium_combat_2');
    expect(confirmedRulesMigrationSource).toContain('premium_leadership_successful_commander');
    expect(confirmedRulesMigrationSource).toContain('premium_top_overall_1');
    expect(confirmedRulesMigrationSource).toContain("'highest_only'");
    expect(correctionMigrationSource).toContain('base_salary_rank_08_senior_dragons');
    expect(correctionMigrationSource).toContain('Старші дракони');
    expect(correctionMigrationSource).toContain('250000');
    expect(correctionMigrationSource).toContain('requiredPermissions');
  });

  it('uses authoritative weekly eligibility, premium stacking and manual premium limits', () => {
    expect(serviceSource).toContain('metrics.questsCompleted >= 1 || towerParticipation >= 1');
    expect(serviceSource).toContain('metrics.towerParticipation = metrics.towerDefensePresent + metrics.towerDefenseLate');
    expect(serviceSource).toContain('selectPremiumRules');
    expect(serviceSource).toContain('input.amount < 50000 || input.amount > 500000');
    expect(routeSource).toContain("router.get('/family/members/:memberId/weekly-activity'");
    expect(serviceSource).toContain('getWeeklyActivityStatus');
    expect(serviceSource).toContain('towerDefenseSuccessfulCommanded');
    expect(serviceSource).toContain('getPayrollWeekBoundary');
    expect(serviceSource).toContain('memberMatchesRuleScope');
  });

  it('exposes UX-safe grouped payable summary and payment proof content without filesystem paths', () => {
    expect(routeSource).toContain("router.get('/family/accounting/payable-summary'");
    expect(routeSource).toContain("router.get('/family/accounting/payment-proofs/:proofId'");
    expect(serviceSource).toContain('async getPayableSummary');
    expect(serviceSource).toContain('async getPaymentProofContent');
    expect(serviceSource).toContain('requireAccountingManager(auth)');
    expect(serviceSource).toContain('payment-proofs/');
    expect(serviceSource).toContain('target.startsWith(root + path.sep)');
    expect(routeSource).not.toContain('storage_key');
    expect(routeSource).not.toContain('storageKey');
  });

  it('groups payable accruals by member with friendly role labels and category breakdown', () => {
    expect(serviceSource).toContain('totalOutstanding');
    expect(serviceSource).toContain('roleLabel');
    expect(serviceSource).toContain('accountingRoleLabel');
    expect(serviceSource).toContain('accrualCategory');
    expect(serviceSource).toContain('baseSalary');
    expect(serviceSource).toContain('combatPremium');
    expect(serviceSource).toContain('personalPremium');
  });
});
