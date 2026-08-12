import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('family quest schema migration', () => {
  it('defines the minimum quest domain tables and constraints', async () => {
    const sql = await readFile(join(process.cwd(), 'migrations', '012_family_quests_domain.sql'), 'utf8');

    for (const table of [
      'family_quest_templates',
      'family_quests',
      'family_quest_people',
      'family_quest_rewards',
      'family_quest_reports',
      'family_quest_payouts',
      'family_quest_audit',
    ]) {
      expect(sql).toContain(`create table if not exists ${table}`);
    }

    expect(sql).toContain("check (status in (");
    expect(sql).toContain('idx_family_quest_people_active_unique_member');
    expect(sql).toContain("role text not null check (role in ('participant', 'helper'))");
    expect(sql).toContain("reward_type text not null check (reward_type in ('money', 'item', 'custom'))");
    expect(sql).toContain('on conflict (template_key) do nothing');
  });
});
