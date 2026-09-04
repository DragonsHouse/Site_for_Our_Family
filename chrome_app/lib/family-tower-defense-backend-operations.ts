import type {
  DragonDefenseAttendanceStatus,
  DragonDefenseResult,
  DragonGuardResponseStatus,
  DragonTowerDefense,
  DragonTowerDefenseCreateInput
} from '../entrypoints/dashboard/family/tower-defense-models.ts';
import {
  cancelBackendTowerDefense,
  completeBackendTowerDefense,
  confirmBackendTowerDefenseAttendance,
  createBackendTowerDefense,
  getBackendTowerDefense,
  respondBackendTowerDefense,
  startBackendTowerDefense,
  updateBackendTowerDefense,
  withdrawBackendTowerDefenseResponse,
  type CreateBackendTowerDefensePayload,
  type UpdateBackendTowerDefensePayload
} from './family-tower-defense-backend-client.ts';
import { mapBackendTowerDefense } from './family-tower-defense-backend-mapper.ts';

export type DragonTowerDefenseBackendOperations = {
  createDefense(input: DragonTowerDefenseCreateInput): Promise<DragonTowerDefense>;
  updateDefense(defense: DragonTowerDefense, updates: Partial<DragonTowerDefenseCreateInput>): Promise<DragonTowerDefense>;
  respond(defense: DragonTowerDefense, memberId: string, response: DragonGuardResponseStatus, note?: string): Promise<DragonTowerDefense>;
  withdrawResponse(defense: DragonTowerDefense): Promise<DragonTowerDefense>;
  confirmAttendance(defense: DragonTowerDefense, memberId: string, status: DragonDefenseAttendanceStatus, note?: string): Promise<DragonTowerDefense>;
  startDefense(defense: DragonTowerDefense): Promise<DragonTowerDefense>;
  completeDefense(defense: DragonTowerDefense, result: Exclude<DragonDefenseResult, 'pending' | 'cancelled'>, notes?: string, failureReason?: string): Promise<DragonTowerDefense>;
  cancelDefense(defense: DragonTowerDefense, reason?: string): Promise<DragonTowerDefense>;
};

export const dragonTowerDefenseBackendOperations: DragonTowerDefenseBackendOperations = {
  async createDefense(input) {
    return mapBackendTowerDefense(await createBackendTowerDefense(toCreatePayload(input)));
  },
  async updateDefense(defense, updates) {
    return mapBackendTowerDefense(await updateBackendTowerDefense(defense.backendDefenseId, toUpdatePayload(updates)));
  },
  async respond(defense, memberId, response, note) {
    await respondBackendTowerDefense(defense.backendDefenseId, { familyMemberId: memberId, response, note: note ?? null, source: 'manual' });
    return mapBackendTowerDefense(await getBackendTowerDefense(defense.backendDefenseId));
  },
  async withdrawResponse(defense) {
    await withdrawBackendTowerDefenseResponse(defense.backendDefenseId);
    return mapBackendTowerDefense(await getBackendTowerDefense(defense.backendDefenseId));
  },
  async confirmAttendance(defense, memberId, status, note) {
    await confirmBackendTowerDefenseAttendance(defense.backendDefenseId, { familyMemberId: memberId, status, note: note ?? null, source: 'manual' });
    return mapBackendTowerDefense(await getBackendTowerDefense(defense.backendDefenseId));
  },
  async startDefense(defense) {
    return mapBackendTowerDefense(await startBackendTowerDefense(defense.backendDefenseId));
  },
  async completeDefense(defense, result, notes, failureReason) {
    const completed = await completeBackendTowerDefense(defense.backendDefenseId, {
      result,
      notes: notes ?? null,
      failureReason: failureReason ?? null
    });
    return mapBackendTowerDefense(completed.defense);
  },
  async cancelDefense(defense, reason) {
    return mapBackendTowerDefense(await cancelBackendTowerDefense(defense.backendDefenseId, { reason: reason ?? null }));
  }
};

function toCreatePayload(input: DragonTowerDefenseCreateInput): CreateBackendTowerDefensePayload {
  return {
    towerId: input.towerId,
    title: input.title,
    description: input.description,
    status: input.status,
    priority: input.priority,
    scheduledAt: input.scheduledAt ?? input.startsAt,
    startsAt: input.startsAt,
    endedAt: input.endedAt,
    timezone: input.timezone,
    phase: input.phase,
    wave: input.wave,
    commanderFamilyMemberId: input.commanderMemberId,
    minimumGuardCount: input.minimumGuardCount,
    recommendedGuardCount: input.recommendedGuardCount,
    maximumGuardCount: input.maximumGuardCount,
    xp: input.xp,
    leaderboardEligible: input.leaderboardEligible,
    statisticsEligible: input.statisticsEligible,
    notes: input.notes,
    metadata: {
      frontendSource: 'dragon-tower-defense',
      frontendEventId: input.eventId ?? null
    }
  };
}

function toUpdatePayload(input: Partial<DragonTowerDefenseCreateInput>): UpdateBackendTowerDefensePayload {
  const payload: UpdateBackendTowerDefensePayload = {};
  if (input.towerId) payload.towerId = input.towerId;
  if (input.title !== undefined) payload.title = input.title;
  if (input.description !== undefined) payload.description = input.description;
  if (input.status !== undefined) payload.status = input.status;
  if (input.priority !== undefined) payload.priority = input.priority;
  if (input.scheduledAt !== undefined) payload.scheduledAt = input.scheduledAt;
  if (input.startsAt !== undefined) payload.startsAt = input.startsAt;
  if (input.endedAt !== undefined) payload.endedAt = input.endedAt;
  if (input.timezone !== undefined) payload.timezone = input.timezone;
  if (input.phase !== undefined) payload.phase = input.phase;
  if (input.wave !== undefined) payload.wave = input.wave;
  if (input.commanderMemberId !== undefined) payload.commanderFamilyMemberId = input.commanderMemberId;
  if (input.minimumGuardCount !== undefined) payload.minimumGuardCount = input.minimumGuardCount;
  if (input.recommendedGuardCount !== undefined) payload.recommendedGuardCount = input.recommendedGuardCount;
  if (input.maximumGuardCount !== undefined) payload.maximumGuardCount = input.maximumGuardCount;
  if (input.xp !== undefined) payload.xp = input.xp;
  if (input.leaderboardEligible !== undefined) payload.leaderboardEligible = input.leaderboardEligible;
  if (input.statisticsEligible !== undefined) payload.statisticsEligible = input.statisticsEligible;
  if (input.notes !== undefined) payload.notes = input.notes;
  if (input.failureReason !== undefined) payload.failureReason = input.failureReason;
  return payload;
}
