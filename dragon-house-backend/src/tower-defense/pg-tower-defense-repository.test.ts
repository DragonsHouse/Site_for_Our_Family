import { describe, expect, it } from 'vitest';
import { PgTowerDefenseRepository } from './pg-tower-defense-repository.js';

class FakePool {
  queries: Array<{ sql: string; params: unknown[] }> = [];

  async query(sql: string, params: unknown[] = []) {
    this.queries.push({ sql, params });
    const normalized = sql.toLowerCase();
    if (normalized.includes('from family_towers')) return { rows: [towerRow()] };
    if (normalized.includes('from family_tower_defenses')) return { rows: [defenseRow()] };
    if (normalized.includes('from family_tower_defense_responses') || normalized.includes('into family_tower_defense_responses')) return { rows: [responseRow()] };
    if (normalized.includes('from family_tower_defense_attendance') || normalized.includes('into family_tower_defense_attendance')) return { rows: [attendanceRow()] };
    if (normalized.includes('from family_fire_guard_roster')) return { rows: [rosterRow()] };
    if (normalized.includes('select exists')) return { rows: [{ exists: true }] };
    return { rows: [] };
  }
}

describe('PgTowerDefenseRepository', () => {
  it('maps towers and hydrated defenses with responses and attendance', async () => {
    const pool = new FakePool();
    const repo = new PgTowerDefenseRepository(pool as never);

    await expect(repo.listTowers()).resolves.toEqual([expect.objectContaining({ towerCode: 'LS-01' })]);
    await expect(repo.listDefenses({ status: 'scheduled', participant: 'member-id', search: 'tower' })).resolves.toEqual([
      expect.objectContaining({
        id: '20000000-0000-4000-8000-000000000001',
        tower: expect.objectContaining({ towerCode: 'LS-01' }),
        responses: [expect.objectContaining({ response: 'confirmed' })],
        attendance: [expect.objectContaining({ status: 'present' })],
      }),
    ]);

    expect(pool.queries.some((query) => query.sql.includes('exists(select 1 from family_tower_defense_responses'))).toBe(true);
  });

  it('uses upsert semantics for responses and attendance', async () => {
    const pool = new FakePool();
    const repo = new PgTowerDefenseRepository(pool as never);

    await repo.upsertResponse({
      defenseId: 'defense-id',
      familyMemberId: 'member-id',
      response: 'joining',
      source: 'api',
      now: '2026-08-12T10:00:00.000Z',
    });
    await repo.upsertAttendance({
      defenseId: 'defense-id',
      familyMemberId: 'member-id',
      status: 'present',
      confirmedByFamilyMemberId: 'owner-id',
      now: '2026-08-12T10:00:00.000Z',
    });

    expect(pool.queries.some((query) => query.sql.toLowerCase().includes('on conflict (defense_id, family_member_id)'))).toBe(true);
  });
});

function towerRow() {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    tower_code: 'LS-01',
    name: 'Los Santos Tower',
    location_label: 'North gate',
    map_metadata: {},
    image_asset_id: null,
    icon_asset_id: null,
    is_active: true,
    external_source: null,
    external_id: null,
    metadata: {},
    created_at: new Date('2026-08-12T10:00:00.000Z'),
    updated_at: new Date('2026-08-12T10:00:00.000Z'),
  };
}

function defenseRow() {
  return {
    id: '20000000-0000-4000-8000-000000000001',
    tower_id: '10000000-0000-4000-8000-000000000001',
    title: 'Defense',
    description: 'Hold',
    status: 'scheduled',
    priority: 'high',
    scheduled_at: new Date('2026-08-12T10:00:00.000Z'),
    starts_at: new Date('2026-08-12T11:00:00.000Z'),
    ended_at: null,
    timezone: 'Europe/Kiev',
    phase: 'forming',
    wave: 1,
    commander_family_member_id: 'commander-id',
    commander_display_name: 'Commander',
    created_by_family_member_id: 'owner-id',
    minimum_guard_count: 1,
    recommended_guard_count: 2,
    maximum_guard_count: 5,
    result: 'pending',
    score: null,
    notes: null,
    failure_reason: null,
    completed_by_family_member_id: null,
    completed_at: null,
    xp: 100,
    leaderboard_eligible: true,
    statistics_eligible: true,
    guild_id: null,
    channel_id: null,
    message_id: null,
    voice_channel_id: null,
    synced_at: null,
    external_source: null,
    external_id: null,
    sync_idempotency_key: null,
    event_projection_key: 'tower-defense:test',
    metadata: {},
    created_at: new Date('2026-08-12T10:00:00.000Z'),
    updated_at: new Date('2026-08-12T10:00:00.000Z'),
    tower_code: 'LS-01',
    tower_name: 'Los Santos Tower',
    location_label: 'North gate',
    map_metadata: {},
    image_asset_id: null,
    icon_asset_id: null,
    tower_is_active: true,
    tower_external_source: null,
    tower_external_id: null,
    tower_metadata: {},
    tower_created_at: new Date('2026-08-12T10:00:00.000Z'),
    tower_updated_at: new Date('2026-08-12T10:00:00.000Z'),
  };
}

function responseRow() {
  return {
    id: 'response-id',
    defense_id: '20000000-0000-4000-8000-000000000001',
    family_member_id: 'member-id',
    display_name: 'Member',
    response: 'confirmed',
    responded_at: new Date('2026-08-12T10:00:00.000Z'),
    note: null,
    source: 'api',
    external_source: null,
    external_id: null,
    idempotency_key: null,
    metadata: {},
    created_at: new Date('2026-08-12T10:00:00.000Z'),
    updated_at: new Date('2026-08-12T10:00:00.000Z'),
  };
}

function attendanceRow() {
  return {
    id: 'attendance-id',
    defense_id: '20000000-0000-4000-8000-000000000001',
    family_member_id: 'member-id',
    display_name: 'Member',
    status: 'present',
    confirmed_by_family_member_id: 'owner-id',
    confirmed_at: new Date('2026-08-12T10:00:00.000Z'),
    note: null,
    score: 10,
    damage_blocked: 20,
    supplies_used: 1,
    contribution_notes: null,
    source: 'api',
    external_source: null,
    external_id: null,
    idempotency_key: null,
    metadata: {},
    created_at: new Date('2026-08-12T10:00:00.000Z'),
    updated_at: new Date('2026-08-12T10:00:00.000Z'),
  };
}

function rosterRow() {
  return {
    id: 'roster-id',
    family_member_id: 'member-id',
    display_name: 'Member',
    role: 'support',
    status: 'active',
    note: null,
    assigned_by_family_member_id: 'owner-id',
    discord_user_id: null,
    discord_username: null,
    guild_id: null,
    external_source: null,
    external_id: null,
    metadata: {},
    created_at: new Date('2026-08-12T10:00:00.000Z'),
    updated_at: new Date('2026-08-12T10:00:00.000Z'),
  };
}
