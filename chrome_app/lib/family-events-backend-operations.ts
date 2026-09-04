import type { DragonEvent } from '../entrypoints/dashboard/family/dragon-event-models.ts';
import {
  cancelBackendFamilyEvent,
  completeBackendFamilyEvent,
  confirmBackendFamilyEventAttendance,
  createBackendFamilyEvent,
  respondBackendFamilyEvent,
  startBackendFamilyEvent,
  updateBackendFamilyEvent,
  withdrawBackendFamilyEventResponse,
  type CreateBackendFamilyEventPayload,
  type UpdateBackendFamilyEventPayload
} from './family-events-backend-client.ts';
import { mapBackendFamilyEvent } from './family-events-backend-mapper.ts';

export type FamilyEventResponseChoice = 'interested' | 'joining' | 'confirmed' | 'declined';
export type FamilyEventAttendanceChoice = 'present' | 'late' | 'absent' | 'excused';

export function requireBackendFamilyEventId(event: DragonEvent): string {
  if (event.source.sourceModule !== 'events') {
    throw new Error('Only standalone Family Events can be changed from the Events module.');
  }
  return event.backendEventId;
}

export async function createFamilyEventFromBackend(payload: CreateBackendFamilyEventPayload): Promise<DragonEvent> {
  return mapBackendFamilyEvent(await createBackendFamilyEvent(payload));
}

export async function updateFamilyEventFromBackend(event: DragonEvent, payload: UpdateBackendFamilyEventPayload): Promise<DragonEvent> {
  return mapBackendFamilyEvent(await updateBackendFamilyEvent(requireBackendFamilyEventId(event), payload));
}

export async function respondFamilyEventFromBackend(event: DragonEvent, familyMemberId: string, response: FamilyEventResponseChoice): Promise<void> {
  await respondBackendFamilyEvent(requireBackendFamilyEventId(event), { familyMemberId, response });
}

export async function withdrawFamilyEventResponseFromBackend(event: DragonEvent): Promise<void> {
  await withdrawBackendFamilyEventResponse(requireBackendFamilyEventId(event));
}

export async function confirmFamilyEventAttendanceFromBackend(event: DragonEvent, familyMemberId: string, status: FamilyEventAttendanceChoice): Promise<void> {
  await confirmBackendFamilyEventAttendance(requireBackendFamilyEventId(event), { familyMemberId, status });
}

export async function startFamilyEventFromBackend(event: DragonEvent): Promise<DragonEvent> {
  return mapBackendFamilyEvent(await startBackendFamilyEvent(requireBackendFamilyEventId(event)));
}

export async function completeFamilyEventFromBackend(event: DragonEvent): Promise<DragonEvent> {
  return mapBackendFamilyEvent((await completeBackendFamilyEvent(requireBackendFamilyEventId(event))).event);
}

export async function cancelFamilyEventFromBackend(event: DragonEvent, reason?: string | null): Promise<DragonEvent> {
  return mapBackendFamilyEvent(await cancelBackendFamilyEvent(requireBackendFamilyEventId(event), { reason }));
}
