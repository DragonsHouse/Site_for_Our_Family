import { randomUUID } from 'node:crypto';
import type {
  CreateTowerDefenseInput,
  FireGuardRosterRecord,
  TowerDefenseAttendanceRecord,
  TowerDefenseListQuery,
  TowerDefenseRecord,
  TowerDefenseResponseRecord,
  TowerRecord,
  UpdateTowerDefenseInput,
} from './tower-defense-models.js';

export type UpsertDefenseResponseInput = {
  defenseId: string;
  familyMemberId: string;
  response: TowerDefenseResponseRecord['response'];
  note?: string | null;
  source?: TowerDefenseResponseRecord['source'];
  externalSource?: string | null;
  externalId?: string | null;
  idempotencyKey?: string | null;
  now: string;
};

export type UpsertDefenseAttendanceInput = {
  defenseId: string;
  familyMemberId: string;
  status: TowerDefenseAttendanceRecord['status'];
  confirmedByFamilyMemberId: string;
  note?: string | null;
  score?: number | null;
  damageBlocked?: number | null;
  suppliesUsed?: number | null;
  contributionNotes?: string | null;
  source?: TowerDefenseAttendanceRecord['source'];
  externalSource?: string | null;
  externalId?: string | null;
  idempotencyKey?: string | null;
  now: string;
};

export interface TowerDefenseRepository {
  listTowers(): Promise<TowerRecord[]>;
  findTowerById(id: string): Promise<TowerRecord | null>;
  familyMemberExists(id: string): Promise<boolean>;
  listDefenses(query?: TowerDefenseListQuery): Promise<TowerDefenseRecord[]>;
  findDefenseById(id: string): Promise<TowerDefenseRecord | null>;
  createDefense(input: CreateTowerDefenseInput & { createdByFamilyMemberId: string; eventProjectionKey: string; now: string }): Promise<TowerDefenseRecord>;
  updateDefense(id: string, input: UpdateTowerDefenseInput & { now: string }): Promise<TowerDefenseRecord | null>;
  upsertResponse(input: UpsertDefenseResponseInput): Promise<TowerDefenseResponseRecord>;
  removeResponse(defenseId: string, familyMemberId: string, now: string): Promise<TowerDefenseResponseRecord>;
  upsertAttendance(input: UpsertDefenseAttendanceInput): Promise<TowerDefenseAttendanceRecord>;
  listFireGuardRoster(): Promise<FireGuardRosterRecord[]>;
}

export class MemoryTowerDefenseRepository implements TowerDefenseRepository {
  constructor(
    private readonly towers: TowerRecord[] = [],
    private readonly defenses: TowerDefenseRecord[] = [],
    private readonly familyMemberIds: string[] = [],
    private readonly roster: FireGuardRosterRecord[] = [],
  ) {}

  async listTowers(): Promise<TowerRecord[]> {
    return [...this.towers].sort((left, right) => Number(right.isActive) - Number(left.isActive) || left.name.localeCompare(right.name));
  }

  async findTowerById(id: string): Promise<TowerRecord | null> {
    return this.towers.find((tower) => tower.id === id) ?? null;
  }

  async familyMemberExists(id: string): Promise<boolean> {
    return this.familyMemberIds.includes(id);
  }

  async listDefenses(query: TowerDefenseListQuery = {}): Promise<TowerDefenseRecord[]> {
    return this.filterDefenses(query).sort((left, right) => right.startsAt.localeCompare(left.startsAt));
  }

  async findDefenseById(id: string): Promise<TowerDefenseRecord | null> {
    return this.defenses.find((defense) => defense.id === id) ?? null;
  }

  async createDefense(input: CreateTowerDefenseInput & { createdByFamilyMemberId: string; eventProjectionKey: string; now: string }): Promise<TowerDefenseRecord> {
    const tower = this.towers.find((item) => item.id === input.towerId);
    if (!tower) throw new Error('tower not found');
    const defense: TowerDefenseRecord = {
      id: randomUUID(),
      tower,
      title: input.title,
      description: input.description ?? '',
      status: input.status ?? 'draft',
      priority: input.priority ?? 'normal',
      scheduledAt: input.scheduledAt ?? null,
      startsAt: input.startsAt,
      endedAt: input.endedAt ?? null,
      timezone: input.timezone ?? 'Europe/Kiev',
      phase: input.phase ?? 'planning',
      wave: input.wave ?? 1,
      commanderFamilyMemberId: input.commanderFamilyMemberId,
      commanderDisplayName: null,
      createdByFamilyMemberId: input.createdByFamilyMemberId,
      minimumGuardCount: input.minimumGuardCount,
      recommendedGuardCount: input.recommendedGuardCount,
      maximumGuardCount: input.maximumGuardCount,
      result: 'pending',
      score: null,
      notes: input.notes ?? null,
      failureReason: null,
      completedByFamilyMemberId: null,
      completedAt: null,
      xp: input.xp ?? 0,
      leaderboardEligible: input.leaderboardEligible ?? true,
      statisticsEligible: input.statisticsEligible ?? true,
      discord: {
        guildId: input.discord?.guildId ?? null,
        channelId: input.discord?.channelId ?? null,
        messageId: input.discord?.messageId ?? null,
        voiceChannelId: input.discord?.voiceChannelId ?? null,
        syncedAt: input.discord?.syncedAt ?? null,
      },
      externalSource: input.externalSource ?? null,
      externalId: input.externalId ?? null,
      syncIdempotencyKey: input.syncIdempotencyKey ?? null,
      eventProjectionKey: input.eventProjectionKey,
      metadata: input.metadata ?? {},
      createdAt: input.now,
      updatedAt: input.now,
      responses: [],
      attendance: [],
    };
    this.defenses.push(defense);
    return defense;
  }

  async updateDefense(id: string, input: UpdateTowerDefenseInput & { now: string }): Promise<TowerDefenseRecord | null> {
    const index = this.defenses.findIndex((defense) => defense.id === id);
    if (index < 0) return null;
    const current = this.defenses[index];
    const tower = input.towerId ? this.towers.find((item) => item.id === input.towerId) ?? current.tower : current.tower;
    const next: TowerDefenseRecord = {
      ...current,
      tower,
      title: input.title ?? current.title,
      description: input.description ?? current.description,
      status: input.status ?? current.status,
      priority: input.priority ?? current.priority,
      scheduledAt: input.scheduledAt !== undefined ? input.scheduledAt : current.scheduledAt,
      startsAt: input.startsAt ?? current.startsAt,
      endedAt: input.endedAt !== undefined ? input.endedAt : current.endedAt,
      timezone: input.timezone ?? current.timezone,
      phase: input.phase ?? current.phase,
      wave: input.wave ?? current.wave,
      commanderFamilyMemberId: input.commanderFamilyMemberId ?? current.commanderFamilyMemberId,
      minimumGuardCount: input.minimumGuardCount ?? current.minimumGuardCount,
      recommendedGuardCount: input.recommendedGuardCount ?? current.recommendedGuardCount,
      maximumGuardCount: input.maximumGuardCount ?? current.maximumGuardCount,
      result: input.result ?? current.result,
      score: input.score !== undefined ? input.score : current.score,
      notes: input.notes !== undefined ? input.notes : current.notes,
      failureReason: input.failureReason !== undefined ? input.failureReason : current.failureReason,
      completedByFamilyMemberId: input.completedByFamilyMemberId !== undefined ? input.completedByFamilyMemberId : current.completedByFamilyMemberId,
      completedAt: input.completedAt !== undefined ? input.completedAt : current.completedAt,
      xp: input.xp ?? current.xp,
      leaderboardEligible: input.leaderboardEligible ?? current.leaderboardEligible,
      statisticsEligible: input.statisticsEligible ?? current.statisticsEligible,
      discord: {
        guildId: input.discord?.guildId ?? current.discord.guildId,
        channelId: input.discord?.channelId ?? current.discord.channelId,
        messageId: input.discord?.messageId ?? current.discord.messageId,
        voiceChannelId: input.discord?.voiceChannelId ?? current.discord.voiceChannelId,
        syncedAt: input.discord?.syncedAt ?? current.discord.syncedAt,
      },
      externalSource: input.externalSource !== undefined ? input.externalSource : current.externalSource,
      externalId: input.externalId !== undefined ? input.externalId : current.externalId,
      metadata: input.metadata ?? current.metadata,
      updatedAt: input.now,
    };
    this.defenses[index] = next;
    return next;
  }

  async upsertResponse(input: UpsertDefenseResponseInput): Promise<TowerDefenseResponseRecord> {
    const defense = this.defenses.find((item) => item.id === input.defenseId);
    if (!defense) throw new Error('defense not found');
    const existing = defense.responses.find((item) => item.familyMemberId === input.familyMemberId);
    const record: TowerDefenseResponseRecord = {
      id: existing?.id ?? randomUUID(),
      defenseId: input.defenseId,
      familyMemberId: input.familyMemberId,
      displayName: input.familyMemberId,
      response: input.response,
      respondedAt: input.now,
      note: input.note ?? null,
      source: input.source ?? 'api',
      externalSource: input.externalSource ?? null,
      externalId: input.externalId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      metadata: existing?.metadata ?? {},
      createdAt: existing?.createdAt ?? input.now,
      updatedAt: input.now,
    };
    defense.responses = [...defense.responses.filter((item) => item.familyMemberId !== input.familyMemberId), record];
    defense.updatedAt = input.now;
    return record;
  }

  async removeResponse(defenseId: string, familyMemberId: string, now: string): Promise<TowerDefenseResponseRecord> {
    return this.upsertResponse({ defenseId, familyMemberId, response: 'no-response', source: 'api', now });
  }

  async upsertAttendance(input: UpsertDefenseAttendanceInput): Promise<TowerDefenseAttendanceRecord> {
    const defense = this.defenses.find((item) => item.id === input.defenseId);
    if (!defense) throw new Error('defense not found');
    const existing = defense.attendance.find((item) => item.familyMemberId === input.familyMemberId);
    const record: TowerDefenseAttendanceRecord = {
      id: existing?.id ?? randomUUID(),
      defenseId: input.defenseId,
      familyMemberId: input.familyMemberId,
      displayName: input.familyMemberId,
      status: input.status,
      confirmedByFamilyMemberId: input.confirmedByFamilyMemberId,
      confirmedAt: input.now,
      note: input.note ?? null,
      score: input.score ?? null,
      damageBlocked: input.damageBlocked ?? null,
      suppliesUsed: input.suppliesUsed ?? null,
      contributionNotes: input.contributionNotes ?? null,
      source: input.source ?? 'api',
      externalSource: input.externalSource ?? null,
      externalId: input.externalId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      metadata: existing?.metadata ?? {},
      createdAt: existing?.createdAt ?? input.now,
      updatedAt: input.now,
    };
    defense.attendance = [...defense.attendance.filter((item) => item.familyMemberId !== input.familyMemberId), record];
    defense.updatedAt = input.now;
    return record;
  }

  async listFireGuardRoster(): Promise<FireGuardRosterRecord[]> {
    return [...this.roster].sort((left, right) => left.role.localeCompare(right.role) || left.displayName.localeCompare(right.displayName));
  }

  private filterDefenses(query: TowerDefenseListQuery) {
    const search = query.search?.trim().toLowerCase();
    return this.defenses.filter((defense) => {
      if (query.status && query.status !== 'all' && defense.status !== query.status) return false;
      if (query.result && query.result !== 'all' && defense.result !== query.result) return false;
      if (query.priority && query.priority !== 'all' && defense.priority !== query.priority) return false;
      if (query.tower && defense.tower.id !== query.tower && defense.tower.towerCode !== query.tower) return false;
      if (query.commander && defense.commanderFamilyMemberId !== query.commander) return false;
      if (query.participant && !defense.responses.some((response) => response.familyMemberId === query.participant)) return false;
      if (!search) return true;
      return [defense.title, defense.description, defense.tower.name, defense.tower.towerCode, defense.tower.locationLabel]
        .some((value) => value.toLowerCase().includes(search));
    });
  }
}
