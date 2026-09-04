import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(join(process.cwd(), 'migrations', '014_tower_defense_foundation.sql'), 'utf8');

describe('tower defense schema migration', () => {
  it('creates normalized towers, defenses, responses, attendance and persistent roster tables', () => {
    for (const table of [
      'family_towers',
      'family_tower_defenses',
      'family_tower_defense_responses',
      'family_tower_defense_attendance',
      'family_fire_guard_roster',
    ]) {
      expect(migration).toContain(`create table if not exists ${table}`);
    }

    expect(migration).toContain('tower_id uuid not null references family_towers(id)');
    expect(migration).toContain('commander_family_member_id text not null references family_members(id)');
    expect(migration).toContain('family_member_id text not null references family_members(id)');
    expect(migration).toContain("check (status in ('draft', 'scheduled', 'gathering', 'active', 'completed', 'cancelled'))");
    expect(migration).toContain('minimum_guard_count <= recommended_guard_count and recommended_guard_count <= maximum_guard_count');
    expect(migration).toContain('idx_family_tower_defense_responses_active_member');
    expect(migration).toContain('idx_family_tower_defense_attendance_member');
    expect(migration).toContain('sync_idempotency_key');
    expect(migration).toContain('guild_id');
    expect(migration).toContain('voice_channel_id');
  });
});
