import type { DragonCalendarEvent } from './calendar-models';

export const DRAGON_CALENDAR_MOCK_EVENTS: DragonCalendarEvent[] = [
  {
    id: 'war-council-july',
    title: 'War Council',
    description: 'Council meeting for activity, roles and next week priorities.',
    date: '2026-07-30',
    startTime: '20:30',
    endTime: '21:30',
    category: 'dragon_meeting',
    priority: 'critical',
    participants: [
      { id: 'anastasia', name: 'Anastasia_Dragons', role: 'Owner' },
      { id: 'guardians', name: 'Hall Guardians', role: 'Council' }
    ],
    createdBy: 'Anastasia_Dragons',
    hall: 'War Council',
    attachments: [{ id: 'agenda', title: 'Agenda placeholder', kind: 'document' }],
    activity: 'Agenda updated'
  },
  {
    id: 'weekly-quests',
    title: 'Weekly Family Quests',
    description: 'Prepare tasks, reports and rewards for Dragon House members.',
    date: '2026-08-01',
    startTime: '19:00',
    category: 'quest',
    priority: 'normal',
    participants: [{ id: 'quest-team', name: 'Quest Team' }],
    createdBy: 'Quest Forge',
    hall: 'Quest Forge',
    attachments: [],
    activity: 'Quest list drafted'
  },
  {
    id: 'ritual-flame',
    title: 'Flame Ritual',
    description: 'Ceremonial slot for an important family announcement.',
    date: '2026-07-27',
    startTime: '21:00',
    category: 'ritual',
    priority: 'high',
    participants: [{ id: 'family', name: 'Dragon House Family' }],
    createdBy: 'Dragon House',
    hall: 'Hall of Flame',
    attachments: [],
    activity: 'Ritual seal ignited'
  },
  {
    id: 'resource-audit',
    title: 'Resource Audit',
    description: 'Review materials, notes and the future Treasury structure.',
    date: '2026-07-27',
    startTime: '18:00',
    category: 'resource',
    priority: 'normal',
    participants: [{ id: 'treasury', name: 'Treasury Keepers' }],
    createdBy: 'Treasury',
    hall: 'Treasury',
    attachments: [{ id: 'inventory', title: 'Inventory placeholder', kind: 'document' }],
    activity: 'Resource audit created'
  },
  {
    id: 'personal-focus',
    title: 'Personal Focus',
    description: 'Private slot for personal Dragon House tasks.',
    date: '2026-07-28',
    startTime: '16:00',
    category: 'personal',
    priority: 'low',
    participants: [{ id: 'anastasia', name: 'Anastasia_Dragons' }],
    createdBy: 'Anastasia_Dragons',
    hall: 'Dragon Chamber',
    attachments: [],
    activity: 'Personal seal added'
  },
  {
    id: 'celebration-hall',
    title: 'Family Celebration',
    description: 'Light family event for victories and new members.',
    date: '2026-08-03',
    startTime: '20:00',
    category: 'celebration',
    priority: 'normal',
    participants: [{ id: 'family', name: 'Dragon House Family' }],
    createdBy: 'Hall of Flame',
    hall: 'Hall of Flame',
    attachments: [],
    activity: 'Celebration planned'
  },
  {
    id: 'war-event-training',
    title: 'Defense Training',
    description: 'Preparation for combat activity and role assignment.',
    date: '2026-08-06',
    startTime: '22:00',
    category: 'war_event',
    priority: 'critical',
    participants: [
      { id: 'guardians', name: 'Hall Guardians' },
      { id: 'war-team', name: 'War Team' }
    ],
    createdBy: 'War Council',
    hall: 'War Council',
    attachments: [],
    activity: 'Priority raised'
  }
];
