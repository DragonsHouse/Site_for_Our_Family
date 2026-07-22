import { QUANTFUN_EVENTS_URL } from './constants';
import type { EventScheduleRecord, EventSlotStatusOnSite, EventTimeSlot } from './types';

function stripTags(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugifyEventName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-zа-яіїєґ0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '');
}

function parseClock(clock: string): number | null {
  const match = clock.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function parseSlotLabel(label: string, siteStatus: EventSlotStatusOnSite): EventTimeSlot | null {
  const clean = label.trim();
  const rangeMatch = clean.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
  if (rangeMatch) {
    const start = parseClock(rangeMatch[1]);
    const end = parseClock(rangeMatch[2]);
    if (start == null || end == null) return null;
    return {
      label: clean,
      startMinutes: start,
      endMinutes: end,
      isRange: true,
      siteStatus
    };
  }

  const single = parseClock(clean);
  if (single == null) return null;
  return {
    label: clean,
    startMinutes: single,
    endMinutes: null,
    isRange: false,
    siteStatus
  };
}

function parseSiteStatusFromClass(buttonClass: string): EventSlotStatusOnSite {
  if (/\bbtn-success\b/i.test(buttonClass)) return 'started';
  if (/\bbtn-primary\b/i.test(buttonClass)) return 'not-started';
  return 'unknown';
}

export function parseQuantEventsPage(html: string, sourceUrl = QUANTFUN_EVENTS_URL): EventScheduleRecord[] {
  const cardRegex =
    /<div class="card mt-2">[\s\S]*?<div class="card-body">([\s\S]*?)<\/div>\s*<\/div>/gi;
  const eventCards: EventScheduleRecord[] = [];
  let cardMatch: RegExpExecArray | null;

  while ((cardMatch = cardRegex.exec(html))) {
    const cardHtml = cardMatch[1];
    const titleMatch = cardHtml.match(/<h5>([\s\S]*?)<\/h5>/i);
    const eventName = stripTags(titleMatch?.[1] ?? '');
    if (!eventName) continue;

    const noteMatch = cardHtml.match(/<div class="mt-2">([\s\S]*?)<\/div>/i);
    const noteCandidate = noteMatch ? stripTags(noteMatch[1]) : '';
    const note = noteCandidate && !/^\d{1,2}:\d{2}/.test(noteCandidate) ? noteCandidate : null;

    const slots: EventTimeSlot[] = [];
    const btnRegex = /<button[^>]*class="([^"]*btn[^"]*)"[^>]*>([\s\S]*?)<\/button>/gi;
    let btnMatch: RegExpExecArray | null;
    while ((btnMatch = btnRegex.exec(cardHtml))) {
      const buttonClass = btnMatch[1];
      const label = stripTags(btnMatch[2]);
      const slot = parseSlotLabel(label, parseSiteStatusFromClass(buttonClass));
      if (slot) slots.push(slot);
    }

    if (!slots.length) continue;

    eventCards.push({
      eventKey: slugifyEventName(eventName),
      eventName,
      note,
      slots,
      sourceUrl,
      fetchedAt: new Date().toISOString()
    });
  }

  return eventCards;
}
