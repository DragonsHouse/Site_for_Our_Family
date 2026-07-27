import type { DragonCalendarEvent } from './calendar-models';

export const DRAGON_CALENDAR_MOCK_EVENTS: DragonCalendarEvent[] = [
  {
    id: 'birthday-anastasia',
    title: 'День народження Anastasia_Dragons',
    description: 'Сімейне полум’я підсвічує день народження без публікації року.',
    date: '2026-07-29',
    startTime: '00:00',
    category: 'birthday',
    priority: 'high',
    participants: [{ id: 'anastasia', name: 'Anastasia_Dragons', role: 'Dragon House' }],
    createdBy: 'system',
    hall: 'Family Calendar',
    attachments: [],
    activity: 'Birthday seal prepared'
  },
  {
    id: 'war-council-july',
    title: 'War Council',
    description: 'Рада щодо активностей, ролей і пріоритетів наступного тижня.',
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
    title: 'Сімейні квести тижня',
    description: 'Підготовка задач, звітів і нагород для учасників.',
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
    title: 'Ритуал полум’я',
    description: 'Церемоніальний слот для важливого сімейного оголошення.',
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
    title: 'Перевірка ресурсів',
    description: 'Огляд матеріалів, нотаток і майбутньої Treasury-структури.',
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
    title: 'Особистий фокус',
    description: 'Приватний слот для власних задач у Dragon House.',
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
    title: 'Сімейне святкування',
    description: 'Легка подія для відмітки перемог і нових учасників.',
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
    title: 'Тренування оборони',
    description: 'Підготовка до бойової активності та розподіл ролей.',
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
