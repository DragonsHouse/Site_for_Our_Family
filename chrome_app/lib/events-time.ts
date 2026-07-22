import type { EventTimeSlot } from './types';

export type EventOccurrence = {
  slot: EventTimeSlot;
  startAt: Date;
  endAt: Date | null;
};

export function minutesNowLocal(now = new Date()): number {
  return now.getHours() * 60 + now.getMinutes();
}

export function slotContainsNow(slot: EventTimeSlot, now = new Date()): boolean {
  const current = minutesNowLocal(now);
  if (slot.isRange && slot.endMinutes != null) {
    return current >= slot.startMinutes && current <= slot.endMinutes;
  }
  return current === slot.startMinutes;
}

export function nextOccurrenceForSlot(slot: EventTimeSlot, now = new Date()): EventOccurrence {
  const candidate = new Date(now);
  candidate.setSeconds(0, 0);
  candidate.setHours(Math.floor(slot.startMinutes / 60), slot.startMinutes % 60, 0, 0);

  if (candidate.getTime() < now.getTime() && !slotContainsNow(slot, now)) {
    candidate.setDate(candidate.getDate() + 1);
  }

  let endAt: Date | null = null;
  if (slot.isRange && slot.endMinutes != null) {
    endAt = new Date(candidate);
    endAt.setHours(Math.floor(slot.endMinutes / 60), slot.endMinutes % 60, 0, 0);
    if (endAt.getTime() < candidate.getTime()) {
      endAt.setDate(endAt.getDate() + 1);
    }
  }

  return { slot, startAt: candidate, endAt };
}

export function getActiveSlot(slots: EventTimeSlot[], now = new Date()): EventTimeSlot | null {
  return slots.find((slot) => slotContainsNow(slot, now)) ?? null;
}

export function getNextSlotOccurrence(
  slots: EventTimeSlot[],
  now = new Date()
): EventOccurrence | null {
  if (!slots.length) return null;
  const occurrences = slots.map((slot) => nextOccurrenceForSlot(slot, now));
  occurrences.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  return occurrences[0] ?? null;
}

export function minutesUntil(target: Date, now = new Date()): number {
  return Math.floor((target.getTime() - now.getTime()) / 60000);
}
