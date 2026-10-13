import { FAMILY_MAP_STATE_ID, type FamilyMapPointRecord, type FamilyMapStateInput, type FamilyMapStateRecord, type FamilyMapZoneRecord } from './family-map-models.js';

export type PersistedFamilyMapStateInput = FamilyMapStateInput & {
  points: FamilyMapPointRecord[];
  zones: FamilyMapZoneRecord[];
};

export interface FamilyMapRepository {
  getState(now?: string): Promise<FamilyMapStateRecord>;
  updateState(input: PersistedFamilyMapStateInput, actorFamilyMemberId: string, now: string): Promise<FamilyMapStateRecord | null>;
  recordAudit?(entry: FamilyMapAuditEntry): Promise<void>;
}

export type FamilyMapAuditEntry = {
  actorFamilyMemberId: string | null;
  action: 'family_map_updated';
  entityId: string;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: Record<string, unknown> | null;
};

export class MemoryFamilyMapRepository implements FamilyMapRepository {
  private state: FamilyMapStateRecord;

  constructor(initial?: Partial<FamilyMapStateRecord>) {
    const now = new Date(0).toISOString();
    this.state = {
      id: FAMILY_MAP_STATE_ID,
      points: [],
      zones: [],
      version: 1,
      updatedByFamilyMemberId: null,
      createdAt: now,
      updatedAt: now,
      ...initial,
    };
  }

  async getState(): Promise<FamilyMapStateRecord> {
    return cloneState(this.state);
  }

  async updateState(input: PersistedFamilyMapStateInput, actorFamilyMemberId: string, now: string): Promise<FamilyMapStateRecord | null> {
    if (input.expectedVersion !== this.state.version) return null;
    this.state = {
      ...this.state,
      points: structuredClone(input.points),
      zones: structuredClone(input.zones),
      version: this.state.version + 1,
      updatedByFamilyMemberId: actorFamilyMemberId,
      updatedAt: now,
    };
    return cloneState(this.state);
  }

  async recordAudit(_entry: FamilyMapAuditEntry): Promise<void> {
    // In-memory repository keeps map tests focused on domain behavior.
  }
}

function cloneState(state: FamilyMapStateRecord): FamilyMapStateRecord {
  return {
    ...state,
    points: structuredClone(state.points),
    zones: structuredClone(state.zones),
  };
}
