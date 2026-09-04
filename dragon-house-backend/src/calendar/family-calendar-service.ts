import type { FamilyAuthContext } from '../types.js';
import type { FamilyEventRepository } from '../family-events/family-event-repository.js';
import { canReadEvent } from '../family-events/family-event-service.js';
import type { FamilyQuestRepository } from '../quests/quest-repository.js';
import type { TowerDefenseRepository } from '../tower-defense/tower-defense-repository.js';

export type FamilyCalendarSourceModule = 'family_events' | 'tower_defense' | 'family_quests';

export type FamilyCalendarQuery = {
  from?: string | null;
  to?: string | null;
  sourceModule?: FamilyCalendarSourceModule | 'all' | null;
};

export type FamilyCalendarItem = {
  id: string;
  sourceModule: FamilyCalendarSourceModule;
  sourceId: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  status: string;
  type: string;
  metadata: Record<string, unknown>;
};

export class FamilyCalendarService {
  constructor(
    private readonly events: FamilyEventRepository | null,
    private readonly towerDefenses: TowerDefenseRepository | null,
    private readonly quests: FamilyQuestRepository | null,
  ) {}

  async listCalendar(query: FamilyCalendarQuery, auth: FamilyAuthContext): Promise<{ items: FamilyCalendarItem[] }> {
    if (auth.status !== 'active') return { items: [] };
    const [events, defenses, quests] = await Promise.all([
      this.events && includeSource(query, 'family_events') ? this.events.listEvents({ from: query.from, to: query.to, status: 'all' }) : Promise.resolve([]),
      this.towerDefenses && includeSource(query, 'tower_defense') ? this.towerDefenses.listDefenses({ status: 'all', result: 'all' }) : Promise.resolve([]),
      this.quests && includeSource(query, 'family_quests') ? this.quests.listQuests({ status: 'all' }) : Promise.resolve([]),
    ]);

    return {
      items: [
        ...events.filter((event) => canReadEvent(auth, event)).map((event): FamilyCalendarItem => ({
          id: `family_events:${event.id}`,
          sourceModule: 'family_events',
          sourceId: event.id,
          title: event.title,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          status: event.status,
          type: event.eventType,
          metadata: {
            category: event.category,
            visibility: event.visibility,
            organizerFamilyMemberId: event.organizerFamilyMemberId,
            locationLabel: event.locationLabel,
            allDay: event.allDay,
          },
        })),
        ...defenses.filter((defense) => inRange(defense.startsAt, defense.endedAt, query)).map((defense): FamilyCalendarItem => ({
          id: `tower_defense:${defense.eventProjectionKey}`,
          sourceModule: 'tower_defense',
          sourceId: defense.id,
          title: defense.title,
          startsAt: defense.startsAt,
          endsAt: defense.endedAt,
          status: defense.status,
          type: 'tower_defense',
          metadata: {
            eventProjectionKey: defense.eventProjectionKey,
            result: defense.result,
            towerId: defense.tower.id,
            towerCode: defense.tower.towerCode,
            towerName: defense.tower.name,
            commanderFamilyMemberId: defense.commanderFamilyMemberId,
          },
        })),
        ...quests.filter((quest) => inRange(quest.startsAt ?? quest.scheduledAt ?? quest.createdAt, quest.endsAt, query)).map((quest): FamilyCalendarItem => ({
          id: `family_quests:${quest.id}`,
          sourceModule: 'family_quests',
          sourceId: quest.id,
          title: quest.title,
          startsAt: quest.startsAt ?? quest.scheduledAt ?? quest.createdAt,
          endsAt: quest.endsAt,
          status: quest.status,
          type: 'family_quest',
          metadata: {
            category: quest.category,
            organizerFamilyMemberId: quest.organizerFamilyMemberId,
            reportId: quest.reportId,
          },
        })),
      ].sort((left, right) => left.startsAt.localeCompare(right.startsAt) || left.id.localeCompare(right.id)),
    };
  }
}

function includeSource(query: FamilyCalendarQuery, sourceModule: FamilyCalendarSourceModule): boolean {
  return !query.sourceModule || query.sourceModule === 'all' || query.sourceModule === sourceModule;
}

function inRange(startsAt: string, endsAt: string | null, query: FamilyCalendarQuery): boolean {
  if (query.from && (endsAt ?? startsAt) < query.from) return false;
  if (query.to && startsAt > query.to) return false;
  return true;
}
