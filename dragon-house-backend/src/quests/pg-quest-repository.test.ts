import { describe, expect, it } from 'vitest';
import { PgFamilyQuestRepository } from './pg-quest-repository.js';

const now = new Date('2026-08-10T10:00:00.000Z');

class FakePool {
  calls: Array<{ sql: string; params: unknown[] }> = [];

  async query(sql: string, params: unknown[] = []) {
    this.calls.push({ sql, params });
    if (sql.includes('from family_quest_templates')) {
      return {
        rows: [
          {
            id: '00000000-0000-4000-8000-000000000101',
            template_key: 'help-citizens',
            title: 'Допомога громадянам',
            category: 'Громадський',
            description: 'Help people',
            steps: ['Step one'],
            recommended_team_size: 2,
            total_reward: '700000.00',
            member_reward_pool: '600000.00',
            family_reward: '100000.00',
            reward_mode: 'equal',
            required_items: null,
            image_asset_id: 'quest_help_citizens',
            is_active: true,
            cooldown_hours: 24,
            cooldown_until: null,
            metadata: {},
            created_at: now,
            updated_at: now,
          },
        ],
      };
    }
    if (sql.includes('from family_quests')) {
      return {
        rows: [
          {
            id: '10000000-0000-4000-8000-000000000001',
            template_id: '00000000-0000-4000-8000-000000000101',
            title: 'Допомога громадянам',
            description: 'Help people',
            category: 'Громадський',
            status: 'active',
            starts_at: now,
            ends_at: null,
            scheduled_at: now,
            organizer_family_member_id: 'owner-id',
            total_reward: '700000.00',
            member_reward_pool: '600000.00',
            family_reward: '100000.00',
            reward_mode: 'equal',
            required_items: null,
            best_participant_family_member_id: 'member-id',
            best_participant_reason: 'Most helpful',
            report_id: null,
            report_sent_to_accounting_at: null,
            paid_at: null,
            paid_by_family_member_id: null,
            metadata: {},
            created_at: now,
            updated_at: now,
          },
        ],
      };
    }
    if (sql.includes('from family_quest_people')) {
      return {
        rows: [
          {
            id: '20000000-0000-4000-8000-000000000001',
            quest_id: '10000000-0000-4000-8000-000000000001',
            family_member_id: 'member-id',
            display_name: 'Member_Dragons',
            role: 'participant',
            joined_at: now,
            left_at: null,
            joined_late: false,
            participation_note: null,
            added_manually: false,
            added_by_family_member_id: 'owner-id',
            reward_percent: null,
            reward_amount: '600000.00',
            bonus_amount: '0.00',
            bonus_percent: '0.0000',
            is_best_participant: true,
            best_participant_reason: 'Most helpful',
            payout_status: 'pending',
            paid_at: null,
            paid_by_family_member_id: null,
            metadata: {},
            created_at: now,
            updated_at: now,
          },
        ],
      };
    }
    if (sql.includes('from family_quest_rewards')) return { rows: [] };
    if (sql.includes('from family_quest_reports')) return { rows: [] };
    if (sql.includes('from family_quest_payouts')) return { rows: [] };
    if (sql.includes('from family_quest_audit')) return { rows: [] };
    return { rows: [] };
  }
}

describe('PgFamilyQuestRepository', () => {
  it('lists templates and maps numeric/date fields', async () => {
    const repository = new PgFamilyQuestRepository(new FakePool() as never);

    const templates = await repository.listTemplates();

    expect(templates).toEqual([
      expect.objectContaining({
        templateKey: 'help-citizens',
        totalReward: 700000,
        memberRewardPool: 600000,
        familyReward: 100000,
        createdAt: '2026-08-10T10:00:00.000Z',
      }),
    ]);
  });

  it('hydrates quest people when listing quests', async () => {
    const pool = new FakePool();
    const repository = new PgFamilyQuestRepository(pool as never);

    const quests = await repository.listQuests({ status: 'active' });

    expect(quests).toHaveLength(1);
    expect(quests[0]).toMatchObject({
      id: '10000000-0000-4000-8000-000000000001',
      status: 'active',
      people: [
        expect.objectContaining({
          familyMemberId: 'member-id',
          role: 'participant',
          rewardAmount: 600000,
          isBestParticipant: true,
        }),
      ],
    });
    expect(pool.calls.some((call) => call.sql.includes('status = $1'))).toBe(true);
  });
});
