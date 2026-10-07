import { describe, expect, it } from 'vitest';
import { MemoryTowerDefenseRepository } from './tower-defense-repository.js';
import { TowerDefenseService } from './tower-defense-service.js';
import type { FireGuardRosterRecord, TowerDefenseRecord, TowerGuardImportSignal, TowerRecord } from './tower-defense-models.js';
import type { FamilyAuthContext } from '../types.js';

const now = '2026-08-12T10:00:00.000Z';
const towerId = '10000000-0000-4000-8000-000000000001';
const defenseId = '20000000-0000-4000-8000-000000000001';
const memberId = 'member-id';
const commanderId = 'commander-id';
const ownerAuth: FamilyAuthContext = { familyMemberId: 'owner-id', role: 'owner', rank: 10, status: 'active', permissions: [] };
const memberAuth: FamilyAuthContext = { familyMemberId: memberId, role: 'member', rank: 2, status: 'active', permissions: [] };
const commanderAuth: FamilyAuthContext = { familyMemberId: commanderId, role: 'member', rank: 4, status: 'active', permissions: [] };

describe('TowerDefenseService', () => {
  it('lists towers and persistent Fire Guard roster for active members', async () => {
    const service = serviceWith();

    await expect(service.listTowers(memberAuth)).resolves.toMatchObject({ items: [expect.objectContaining({ towerCode: 'LS-01' })] });
    await expect(service.listFireGuardRoster(memberAuth)).resolves.toMatchObject({
      items: [expect.objectContaining({ familyMemberId: commanderId, role: 'commander', status: 'active' })],
    });
  });

  it('requires manager permissions to create defenses and validates tower/member/counts', async () => {
    const service = serviceWith();
    const input = createInput();

    await expect(service.createDefense(input, memberAuth, new Date(now))).rejects.toMatchObject({ code: 'TOWER_DEFENSE_PERMISSION_DENIED' });
    await expect(service.createDefense({ ...input, commanderFamilyMemberId: 'missing' }, ownerAuth, new Date(now))).rejects.toMatchObject({ code: 'MEMBER_NOT_FOUND' });
    await expect(service.createDefense({ ...input, minimumGuardCount: 5, recommendedGuardCount: 2 }, ownerAuth, new Date(now))).rejects.toMatchObject({ code: 'INVALID_GUARD_COUNTS' });

    const created = await service.createDefense(input, ownerAuth, new Date(now));
    expect(created).toMatchObject({ title: 'Defense', participantCount: 0, confirmedCount: 0 });
  });

  it('lets a member respond and withdraw only their own response', async () => {
    const service = serviceWith();

    await expect(service.respond(defenseId, { response: 'confirmed' }, memberAuth, new Date(now))).resolves.toMatchObject({
      familyMemberId: memberId,
      response: 'confirmed',
    });
    const defense = await service.getDefense(defenseId, memberAuth);
    expect(defense.confirmedCount).toBe(1);

    await expect(service.respond(defenseId, { familyMemberId: commanderId, response: 'confirmed' }, memberAuth, new Date(now))).rejects.toMatchObject({
      code: 'TOWER_DEFENSE_PERMISSION_DENIED',
    });
    await expect(service.withdrawResponse(defenseId, memberAuth, new Date(now))).resolves.toMatchObject({ response: 'no-response' });
  });

  it('blocks impossible transitions and completes with computed completion output', async () => {
    const service = serviceWith();

    await expect(service.startDefense(defenseId, ownerAuth, new Date(now))).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    await service.updateDefense(defenseId, { status: 'gathering' }, ownerAuth, new Date(now));
    await service.startDefense(defenseId, ownerAuth, new Date(now));
    await service.respond(defenseId, { familyMemberId: memberId, response: 'confirmed' }, ownerAuth, new Date(now));
    await service.confirmAttendance(defenseId, { familyMemberId: memberId, status: 'present', score: 10 }, ownerAuth, new Date(now));

    const completed = await service.completeDefense(defenseId, { result: 'defended', score: 99 }, ownerAuth, new Date(now));

    expect(completed.defense).toMatchObject({ status: 'completed', result: 'defended', presentCount: 1 });
    expect(completed.completion).toMatchObject({
      defenseId,
      participantIds: [memberId],
      rewardSource: { sourceType: 'tower_defense', sourceId: defenseId, sourceKey: `tower-defense:${defenseId}` },
    });
    await expect(service.startDefense(defenseId, ownerAuth, new Date(now))).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('requires an active response before attendance and allows commander management', async () => {
    const service = serviceWith();

    await expect(service.confirmAttendance(defenseId, { familyMemberId: memberId, status: 'present' }, ownerAuth, new Date(now))).rejects.toMatchObject({
      code: 'INVALID_ATTENDANCE_MEMBER',
    });
    await service.respond(defenseId, { familyMemberId: memberId, response: 'joining' }, commanderAuth, new Date(now));
    await expect(service.confirmAttendance(defenseId, { familyMemberId: memberId, status: 'late' }, commanderAuth, new Date(now))).resolves.toMatchObject({
      status: 'late',
    });
  });

  it('cancels open defenses but not closed defenses', async () => {
    const service = serviceWith();

    await expect(service.cancelDefense(defenseId, { reason: 'rain' }, ownerAuth, new Date(now))).resolves.toMatchObject({
      status: 'cancelled',
      result: 'cancelled',
      endedAt: null,
    });
    await expect(service.cancelDefense(defenseId, { reason: 'again' }, ownerAuth, new Date(now))).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('reconciles Discord tower guard signals through the domain service without inventing commander', async () => {
    const service = serviceWith();

    const result = await service.reconcileExternalTowerGuardSignals([towerSignal(50)], {
      systemActorFamilyMemberId: 'owner-id',
      confidence: 'complete',
    }, new Date(now));
    const defenses = await service.listDefenses({ status: 'all' }, ownerAuth);
    const imported = defenses.items.find((item) => item.externalSource === 'discord_tower_guard');

    expect(result).toMatchObject({ state: 'applied', processedCount: 1 });
    expect(imported).toMatchObject({
      title: 'Оборона Вишка №50',
      commanderFamilyMemberId: null,
      createdByFamilyMemberId: 'owner-id',
      externalId: 'tower:50',
    });
  });

  it('does not close stale Discord defenses when reconciliation confidence is degraded', async () => {
    const service = serviceWith();

    await service.reconcileExternalTowerGuardSignals([towerSignal(50)], {
      systemActorFamilyMemberId: 'owner-id',
      confidence: 'complete',
    }, new Date(now));
    const degraded = await service.reconcileExternalTowerGuardSignals([towerSignal(51)], {
      systemActorFamilyMemberId: 'owner-id',
      confidence: 'degraded',
    }, new Date('2026-08-12T10:05:00.000Z'));
    const defenses = await service.listDefenses({ status: 'all' }, ownerAuth);

    expect(degraded).toMatchObject({ state: 'degraded', closedStaleCount: 0 });
    expect(defenses.items.find((item) => item.externalId === 'tower:50')?.status).toBe('active');
  });

  it('closes stale Discord defenses only for a confident complete snapshot', async () => {
    const service = serviceWith();

    await service.reconcileExternalTowerGuardSignals([towerSignal(50), towerSignal(51)], {
      systemActorFamilyMemberId: 'owner-id',
      confidence: 'complete',
    }, new Date(now));
    const complete = await service.reconcileExternalTowerGuardSignals([towerSignal(51)], {
      systemActorFamilyMemberId: 'owner-id',
      confidence: 'complete',
    }, new Date('2026-08-12T10:05:00.000Z'));
    const defenses = await service.listDefenses({ status: 'all' }, ownerAuth);

    expect(complete.closedStaleCount).toBe(1);
    expect(defenses.items.find((item) => item.externalId === 'tower:50')?.status).toBe('cancelled');
    expect(defenses.items.find((item) => item.externalId === 'tower:51')?.status).toBe('active');
  });

  it('creates one KD reminder candidate for missing KD and suppresses duplicate polls', async () => {
    const service = serviceWith();
    const first = await service.reconcileExternalTowerGuardSignals([towerSignal(50)], {
      systemActorFamilyMemberId: 'owner-id',
      confidence: 'complete',
      kdReminderIntervalSeconds: 3600,
    }, new Date(now));
    expect(first.kdReminderCandidates).toHaveLength(1);

    await service.recordTowerKdReminderDelivery({
      towerId: first.kdReminderCandidates[0]!.towerId,
      result: 'sent',
      reason: 'missing_kd',
    }, new Date(now));

    for (let minute = 1; minute <= 10; minute += 1) {
      const next = await service.reconcileExternalTowerGuardSignals([towerSignal(50)], {
        systemActorFamilyMemberId: 'owner-id',
        confidence: 'complete',
        kdReminderIntervalSeconds: 3600,
      }, new Date(`2026-08-12T10:${String(minute).padStart(2, '0')}:00.000Z`));
      expect(next.kdReminderCandidates).toHaveLength(0);
    }
  });

  it('resets KD reminder eligibility after a valid cooldown appears', async () => {
    const service = serviceWith();
    const missing = await service.reconcileExternalTowerGuardSignals([towerSignal(50)], {
      systemActorFamilyMemberId: 'owner-id',
      confidence: 'complete',
      kdReminderIntervalSeconds: 3600,
    }, new Date(now));
    await service.recordTowerKdReminderDelivery({
      towerId: missing.kdReminderCandidates[0]!.towerId,
      result: 'sent',
      reason: 'missing_kd',
    }, new Date(now));

    const valid = await service.reconcileExternalTowerGuardSignals([towerSignal(50, { cooldownNeedsUpdate: false, cooldownAt: '2026-08-12T12:00:00.000Z' })], {
      systemActorFamilyMemberId: 'owner-id',
      confidence: 'complete',
      kdReminderIntervalSeconds: 3600,
    }, new Date('2026-08-12T10:05:00.000Z'));
    expect(valid.kdReminderCandidates).toHaveLength(0);

    const missingAgain = await service.reconcileExternalTowerGuardSignals([towerSignal(50)], {
      systemActorFamilyMemberId: 'owner-id',
      confidence: 'complete',
      kdReminderIntervalSeconds: 3600,
    }, new Date('2026-08-12T10:06:00.000Z'));
    expect(missingAgain.kdReminderCandidates).toHaveLength(1);
  });
});

function serviceWith() {
  return new TowerDefenseService(new MemoryTowerDefenseRepository([tower()], [defense()], [memberId, commanderId, 'owner-id'], [roster()]));
}

function tower(): TowerRecord {
  return {
    id: towerId,
    towerCode: 'LS-01',
    name: 'Los Santos Tower',
    locationLabel: 'North gate',
    mapMetadata: { x: 1, y: 2 },
    imageAssetId: null,
    iconAssetId: null,
    isActive: true,
    externalSource: null,
    externalId: null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };
}

function defense(): TowerDefenseRecord {
  return {
    id: defenseId,
    tower: tower(),
    title: 'Scheduled defense',
    description: 'Hold the tower',
    status: 'scheduled',
    priority: 'high',
    scheduledAt: now,
    startsAt: '2026-08-12T11:00:00.000Z',
    endedAt: null,
    timezone: 'Europe/Kiev',
    phase: 'forming',
    wave: 1,
    commanderFamilyMemberId: commanderId,
    commanderDisplayName: 'Commander',
    createdByFamilyMemberId: 'owner-id',
    minimumGuardCount: 1,
    recommendedGuardCount: 2,
    maximumGuardCount: 5,
    result: 'pending',
    score: null,
    notes: null,
    failureReason: null,
    completedByFamilyMemberId: null,
    completedAt: null,
    xp: 100,
    leaderboardEligible: true,
    statisticsEligible: true,
    discord: { guildId: null, channelId: null, messageId: null, voiceChannelId: null, syncedAt: null },
    externalSource: null,
    externalId: null,
    syncIdempotencyKey: null,
    eventProjectionKey: `tower-defense:${defenseId}`,
    metadata: {},
    createdAt: now,
    updatedAt: now,
    responses: [],
    attendance: [],
  };
}

function roster(): FireGuardRosterRecord {
  return {
    id: 'roster-id',
    familyMemberId: commanderId,
    displayName: 'Commander',
    role: 'commander',
    status: 'active',
    note: null,
    assignedByFamilyMemberId: 'owner-id',
    discordUserId: null,
    discordUsername: null,
    guildId: null,
    externalSource: null,
    externalId: null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };
}

function createInput() {
  return {
    towerId,
    title: 'Defense',
    startsAt: '2026-08-12T12:00:00.000Z',
    commanderFamilyMemberId: commanderId,
    minimumGuardCount: 1,
    recommendedGuardCount: 2,
    maximumGuardCount: 5,
  };
}

function towerSignal(towerNumber: number, overrides: Partial<TowerGuardImportSignal> = {}): TowerGuardImportSignal {
  return { ...towerSignalBase(towerNumber), ...overrides };
}

function towerSignalBase(towerNumber: number) {
  return {
    externalId: `message-${towerNumber}`,
    channelId: 'tower-channel',
    authorId: 'trusted-bot',
    authorName: 'Dragon Bot',
    messageCreatedAt: now,
    messageEditedAt: null,
    towerNumber,
    towerCode: `NO-${towerNumber}`,
    towerName: `Вишка №${towerNumber}`,
    protectionDown: true,
    cooldownNeedsUpdate: true,
    cooldownAt: null,
    statusText: 'Захист впав. Потрібно оновити КД.',
    rawText: `Вишка №${towerNumber}`,
  };
}
