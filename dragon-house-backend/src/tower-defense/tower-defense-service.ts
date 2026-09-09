import { randomUUID } from 'node:crypto';
import type { FamilyAuthContext } from '../types.js';
import { TowerDefenseError } from './tower-defense-errors.js';
import type {
  CreateTowerDefenseInput,
  FireGuardRosterRecord,
  TowerDefenseAttendanceRecord,
  TowerDefenseCompletionOutput,
  TowerDefenseDerivedCounts,
  TowerDefenseListQuery,
  TowerDefenseRecord,
  TowerDefenseResponseRecord,
  TowerDefenseResult,
  TowerDefenseStatus,
  TowerRecord,
  UpdateTowerDefenseInput,
} from './tower-defense-models.js';
import type { TowerDefenseRepository, UpsertDefenseAttendanceInput, UpsertDefenseResponseInput } from './tower-defense-repository.js';

export type TowerDefenseDto = Omit<TowerDefenseRecord, 'metadata'> & {
  participantCount: number;
  confirmedCount: number;
  presentCount: number;
  metadata: Record<string, unknown>;
};

const TRANSITIONS: Record<TowerDefenseStatus, TowerDefenseStatus[]> = {
  draft: ['scheduled', 'cancelled'],
  scheduled: ['gathering', 'cancelled'],
  gathering: ['active', 'cancelled'],
  active: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export class TowerDefenseService {
  constructor(private readonly repository: TowerDefenseRepository) {}

  async listTowers(auth: FamilyAuthContext): Promise<{ items: TowerRecord[] }> {
    this.assertCanRead(auth);
    return { items: await this.repository.listTowers() };
  }

  async listDefenses(query: TowerDefenseListQuery, auth: FamilyAuthContext): Promise<{ items: TowerDefenseDto[] }> {
    this.assertCanRead(auth);
    return { items: (await this.repository.listDefenses(query)).map(toDto) };
  }

  async getDefense(id: string, auth: FamilyAuthContext): Promise<TowerDefenseDto> {
    this.assertCanRead(auth);
    return toDto(await this.requireDefense(id));
  }

  async listFireGuardRoster(auth: FamilyAuthContext): Promise<{ items: FireGuardRosterRecord[] }> {
    this.assertCanRead(auth);
    return { items: await this.repository.listFireGuardRoster() };
  }

  async createDefense(input: CreateTowerDefenseInput, auth: FamilyAuthContext, now = new Date()): Promise<TowerDefenseDto> {
    this.assertCanManage(auth);
    await this.validateCreateOrUpdate(input);
    const created = await this.repository.createDefense({
      ...input,
      createdByFamilyMemberId: auth.familyMemberId,
      eventProjectionKey: `tower-defense:${randomUUID()}`,
      now: now.toISOString(),
    });
    return toDto(created);
  }

  async updateDefense(id: string, input: UpdateTowerDefenseInput, auth: FamilyAuthContext, now = new Date()): Promise<TowerDefenseDto> {
    const defense = await this.requireDefense(id);
    this.assertCanManageDefense(auth, defense);
    if (!['draft', 'scheduled', 'gathering'].includes(defense.status)) {
      throw new TowerDefenseError('INVALID_TRANSITION', 'Only draft, scheduled or gathering defenses can be edited.', 409, { status: defense.status });
    }
    await this.validateCreateOrUpdate(input, defense);
    const updated = await this.repository.updateDefense(id, { ...input, now: now.toISOString() });
    if (!updated) throw new TowerDefenseError('DEFENSE_NOT_FOUND', 'Defense not found', 404);
    return toDto(updated);
  }

  async respond(
    defenseId: string,
    input: Omit<UpsertDefenseResponseInput, 'defenseId' | 'familyMemberId' | 'now'> & { familyMemberId?: string },
    auth: FamilyAuthContext,
    now = new Date(),
  ): Promise<TowerDefenseResponseRecord> {
    const defense = await this.requireDefense(defenseId);
    const familyMemberId = input.familyMemberId ?? auth.familyMemberId;
    if (familyMemberId !== auth.familyMemberId) this.assertCanManageDefense(auth, defense);
    await this.assertMemberExists(familyMemberId);
    if (['completed', 'cancelled'].includes(defense.status)) {
      throw new TowerDefenseError('INVALID_TRANSITION', 'Cannot respond to a closed defense.', 409, { status: defense.status });
    }
    return this.repository.upsertResponse({ ...input, defenseId, familyMemberId, now: now.toISOString() });
  }

  async withdrawResponse(defenseId: string, auth: FamilyAuthContext, now = new Date()): Promise<TowerDefenseResponseRecord> {
    const defense = await this.requireDefense(defenseId);
    if (['completed', 'cancelled'].includes(defense.status)) {
      throw new TowerDefenseError('INVALID_TRANSITION', 'Cannot withdraw from a closed defense.', 409, { status: defense.status });
    }
    return this.repository.removeResponse(defenseId, auth.familyMemberId, now.toISOString());
  }

  async confirmAttendance(
    defenseId: string,
    input: Omit<UpsertDefenseAttendanceInput, 'defenseId' | 'confirmedByFamilyMemberId' | 'now'>,
    auth: FamilyAuthContext,
    now = new Date(),
  ): Promise<TowerDefenseAttendanceRecord> {
    const defense = await this.requireDefense(defenseId);
    this.assertCanManageDefense(auth, defense);
    await this.assertMemberExists(input.familyMemberId);
    const response = defense.responses.find((item) => item.familyMemberId === input.familyMemberId);
    if (!response || response.response === 'no-response' || response.response === 'unavailable') {
      throw new TowerDefenseError('INVALID_ATTENDANCE_MEMBER', 'Attendance member must have an active defense response.', 409, {
        defenseId,
        familyMemberId: input.familyMemberId,
      });
    }
    return this.repository.upsertAttendance({
      ...input,
      defenseId,
      confirmedByFamilyMemberId: auth.familyMemberId,
      now: now.toISOString(),
    });
  }

  async startDefense(defenseId: string, auth: FamilyAuthContext, now = new Date()): Promise<TowerDefenseDto> {
    const defense = await this.requireDefense(defenseId);
    this.assertCanManageDefense(auth, defense);
    this.assertTransition(defense.status, 'active');
    const updated = await this.repository.updateDefense(defenseId, { status: 'active', phase: 'combat', now: now.toISOString() });
    if (!updated) throw new TowerDefenseError('DEFENSE_NOT_FOUND', 'Defense not found', 404);
    return toDto(updated);
  }

  async completeDefense(
    defenseId: string,
    input: { result: Exclude<TowerDefenseResult, 'pending' | 'cancelled'>; score?: number | null; notes?: string | null; failureReason?: string | null },
    auth: FamilyAuthContext,
    now = new Date(),
  ): Promise<{ defense: TowerDefenseDto; completion: TowerDefenseCompletionOutput }> {
    const defense = await this.requireDefense(defenseId);
    this.assertCanManageDefense(auth, defense);
    if (defense.status !== 'active') {
      throw new TowerDefenseError('INVALID_TRANSITION', 'Only active defenses can be completed.', 409, { status: defense.status });
    }
    const updated = await this.repository.updateDefense(defenseId, {
      status: 'completed',
      result: input.result,
      score: input.score ?? null,
      notes: input.notes ?? defense.notes,
      failureReason: input.result === 'lost' ? input.failureReason ?? null : null,
      endedAt: defense.endedAt ?? now.toISOString(),
      phase: 'closed',
      now: now.toISOString(),
    });
    if (!updated) throw new TowerDefenseError('DEFENSE_NOT_FOUND', 'Defense not found', 404);
    const completed = {
      ...updated,
      completedByFamilyMemberId: auth.familyMemberId,
      completedAt: now.toISOString(),
    };
    const persisted = await this.repository.updateDefense(defenseId, {
      completedByFamilyMemberId: auth.familyMemberId,
      completedAt: now.toISOString(),
      now: now.toISOString(),
    } as UpdateTowerDefenseInput & { now: string }) ?? completed;
    return { defense: toDto(persisted), completion: buildCompletionOutput(persisted) };
  }

  async cancelDefense(defenseId: string, input: { reason?: string | null }, auth: FamilyAuthContext, now = new Date()): Promise<TowerDefenseDto> {
    const defense = await this.requireDefense(defenseId);
    this.assertCanManageDefense(auth, defense);
    if (defense.status === 'completed' || defense.status === 'cancelled') {
      throw new TowerDefenseError('INVALID_TRANSITION', 'Defense is already closed.', 409, { status: defense.status });
    }
    const startsAtTime = new Date(defense.startsAt).getTime();
    const endedAt = Number.isFinite(startsAtTime) && now.getTime() >= startsAtTime
      ? defense.endedAt ?? now.toISOString()
      : defense.endedAt;
    const updated = await this.repository.updateDefense(defenseId, {
      status: 'cancelled',
      result: 'cancelled',
      phase: 'closed',
      endedAt,
      notes: input.reason ?? defense.notes,
      completedByFamilyMemberId: auth.familyMemberId,
      completedAt: now.toISOString(),
      now: now.toISOString(),
    } as UpdateTowerDefenseInput & { now: string });
    if (!updated) throw new TowerDefenseError('DEFENSE_NOT_FOUND', 'Defense not found', 404);
    return toDto(updated);
  }

  private async requireDefense(id: string): Promise<TowerDefenseRecord> {
    const defense = await this.repository.findDefenseById(id);
    if (!defense) throw new TowerDefenseError('DEFENSE_NOT_FOUND', 'Defense not found', 404);
    return defense;
  }

  private async validateCreateOrUpdate(input: Partial<CreateTowerDefenseInput>, current?: TowerDefenseRecord): Promise<void> {
    const towerId = input.towerId ?? current?.tower.id;
    if (towerId) {
      const tower = await this.repository.findTowerById(towerId);
      if (!tower) throw new TowerDefenseError('TOWER_NOT_FOUND', 'Tower not found', 404, { towerId });
      if (!tower.isActive) throw new TowerDefenseError('TOWER_INACTIVE', 'Tower is inactive', 409, { towerId });
    }
    if (input.commanderFamilyMemberId) await this.assertMemberExists(input.commanderFamilyMemberId);
    const min = input.minimumGuardCount ?? current?.minimumGuardCount;
    const recommended = input.recommendedGuardCount ?? current?.recommendedGuardCount;
    const max = input.maximumGuardCount ?? current?.maximumGuardCount;
    if (min != null && recommended != null && max != null && !(min <= recommended && recommended <= max)) {
      throw new TowerDefenseError('INVALID_GUARD_COUNTS', 'Invalid guard counts.', 400, { min, recommended, max });
    }
    const startsAt = input.startsAt ?? current?.startsAt;
    const endedAt = input.endedAt !== undefined ? input.endedAt : current?.endedAt;
    if (startsAt && Number.isNaN(Date.parse(startsAt))) {
      throw new TowerDefenseError('INVALID_TIME_RANGE', 'startsAt must be a valid timestamp.', 400, { startsAt });
    }
    if (startsAt && endedAt && (Number.isNaN(Date.parse(endedAt)) || Date.parse(endedAt) < Date.parse(startsAt))) {
      throw new TowerDefenseError('INVALID_TIME_RANGE', 'endedAt cannot be before startsAt.', 400, { startsAt, endedAt });
    }
  }

  private async assertMemberExists(id: string): Promise<void> {
    if (!(await this.repository.familyMemberExists(id))) {
      throw new TowerDefenseError('MEMBER_NOT_FOUND', 'Family member not found', 404, { familyMemberId: id });
    }
  }

  private assertTransition(from: TowerDefenseStatus, to: TowerDefenseStatus): void {
    if (!TRANSITIONS[from].includes(to)) {
      throw new TowerDefenseError('INVALID_TRANSITION', `Cannot move defense from ${from} to ${to}.`, 409, { from, to });
    }
  }

  private assertCanRead(auth: FamilyAuthContext): void {
    if (auth.status !== 'active') throw new TowerDefenseError('TOWER_DEFENSE_PERMISSION_DENIED', 'Inactive member.', 403);
  }

  private assertCanManage(auth: FamilyAuthContext): void {
    if (canManageTowerDefense(auth)) return;
    throw new TowerDefenseError('TOWER_DEFENSE_PERMISSION_DENIED', 'Permission denied.', 403);
  }

  private assertCanManageDefense(auth: FamilyAuthContext, defense: TowerDefenseRecord): void {
    if (canManageTowerDefense(auth) || defense.commanderFamilyMemberId === auth.familyMemberId) return;
    throw new TowerDefenseError('TOWER_DEFENSE_PERMISSION_DENIED', 'Permission denied.', 403);
  }
}

export function canManageTowerDefense(auth: FamilyAuthContext): boolean {
  return auth.role === 'owner' || auth.rank >= 8 || auth.permissions.includes('manage_events') || auth.permissions.includes('manage_family_quests');
}

export function calculateDerivedCounts(defense: TowerDefenseRecord): TowerDefenseDerivedCounts {
  return {
    participantCount: defense.responses.filter((item) => !['no-response', 'unavailable'].includes(item.response)).length,
    confirmedCount: defense.responses.filter((item) => item.response === 'confirmed').length,
    presentCount: defense.attendance.filter((item) => item.status === 'present' || item.status === 'late').length,
  };
}

export function buildCompletionOutput(defense: TowerDefenseRecord): TowerDefenseCompletionOutput {
  return {
    defenseId: defense.id,
    eventProjectionKey: defense.eventProjectionKey,
    participantIds: defense.attendance.filter((item) => item.status === 'present' || item.status === 'late').map((item) => item.familyMemberId),
    commanderFamilyMemberId: defense.commanderFamilyMemberId,
    attendance: defense.attendance,
    result: defense.result,
    xp: defense.xp,
    leaderboardEligible: defense.leaderboardEligible,
    statisticsEligible: defense.statisticsEligible,
    rewardSource: {
      sourceType: 'tower_defense',
      sourceId: defense.id,
      sourceKey: `tower-defense:${defense.id}`,
    },
  };
}

function toDto(defense: TowerDefenseRecord): TowerDefenseDto {
  return {
    ...defense,
    ...calculateDerivedCounts(defense),
  };
}
