import type { DragonProfile } from './profile-models';

export const DRAGON_PROFILE_MOCK_DATA: DragonProfile[] = [
  {
    id: 'profile-current-user',
    identity: {
      avatarUrl: null,
      dragonName: 'Anastasia Dragons',
      discordNickname: 'Anastasia_Dragons',
      dragonTitle: 'Володарка Предвічного Полум’я',
      currentRank: 'Володарка',
      rankLevel: 100,
      element: 'Полум’я',
      birthday: '1998-07-27',
      joinDate: '2024-01-12',
      currentStatus: 'online',
      staticId: 'DH-001',
      familyBranch: 'Основна гілка',
      bannerTitle: 'Профіль дракона'
    },
    statistics: [
      { id: 'meetings', label: 'Зустрічі', value: '0', detail: 'Підтверджені зустрічі з backend', trend: 'Даних поки немає', progress: 0, backendMetricKey: 'meetings_attended' },
      { id: 'tower-defense', label: 'Оборона вишок', value: '0', detail: 'Підтверджена участь в обороні', trend: 'Даних поки немає', progress: 0, backendMetricKey: 'tower_defense_participation' },
      { id: 'quests', label: 'Квести виконано', value: '0', detail: 'Підтверджені сімейні квести', trend: 'Даних поки немає', progress: 0, backendMetricKey: 'quests_completed' },
      { id: 'events', label: 'Події', value: '0', detail: 'Події з підтвердженою участю', trend: 'Даних поки немає', progress: 0, backendMetricKey: 'events_joined' },
      { id: 'activity', label: 'Бали активності', value: '0', detail: 'Активність із backend профілю', trend: 'Даних поки немає', progress: 0, backendMetricKey: 'activity_score' },
      { id: 'attendance', label: 'Відвідування', value: '0%', detail: 'Зустрічі та обов’язкові події', trend: 'Даних поки немає', progress: 0, backendMetricKey: 'attendance_percent' },
      { id: 'promotion', label: 'Прогрес рангу', value: '0%', detail: 'Поточні вимоги рангу', trend: 'Даних поки немає', progress: 0, backendMetricKey: 'promotion_progress' },
      { id: 'streak', label: 'Серія активності', value: '0', detail: 'Активні дні поспіль', trend: 'Даних поки немає', progress: 0, backendMetricKey: 'current_streak' }
    ],
    achievements: [
      { id: 'achievement-first-flight', backendAchievementId: 'first_flight', icon: 'Wing', title: 'Перший політ', description: 'Вступ до Dragon House і завершення першого ритуалу.', state: 'unlocked', rarity: 'common', unlockedAt: '2024-01-12', progress: 100 },
      { id: 'achievement-flame-keeper', backendAchievementId: 'flame_keeper', icon: 'Flame', title: 'Хранителька полумʼя', description: 'Підтримка активності сімʼї через зустрічі та події.', state: 'unlocked', rarity: 'rare', unlockedAt: '2024-04-18', progress: 100 },
      { id: 'achievement-veteran', backendAchievementId: 'dragon_veteran', icon: 'Scale', title: 'Ветеран Dragon House', description: 'Участь у житті сімʼї протягом кількох сезонів.', state: 'unlocked', rarity: 'rare', unlockedAt: '2025-01-12', progress: 100 },
      { id: 'achievement-guardian', backendAchievementId: 'guardian', icon: 'Shield', title: 'Захисниця', description: 'Участь в обороні вишок і захисті сімейних позицій.', state: 'unlocked', rarity: 'common', unlockedAt: '2025-03-03', progress: 100 },
      { id: 'achievement-ancient-one', backendAchievementId: 'ancient_one', icon: 'Obelisk', title: 'Давня печатка', description: 'Закрита спадкова відзнака з історії сімʼї.', state: 'locked', rarity: 'legendary', unlockedAt: null, progress: 64 },
      { id: 'achievement-founder', backendAchievementId: 'founder', icon: 'Crown', title: 'Засновниця', description: 'Печатка заснування Dragon House.', state: 'unlocked', rarity: 'legendary', unlockedAt: '2024-01-12', progress: 100 },
      { id: 'achievement-elder', backendAchievementId: 'elder', icon: 'Runes', title: 'Старша', description: 'Довіра ради та відкриття старшої печатки.', state: 'locked', rarity: 'rare', unlockedAt: null, progress: 78 },
      { id: 'achievement-secret', backendAchievementId: 'secret_discord_ritual', icon: 'Hidden', title: 'Таємна печатка', description: 'Прихована відзнака Discord-ритуалу.', state: 'secret', rarity: 'legendary', unlockedAt: null, progress: 0 }
    ],
    timeline: [
      { id: 'timeline-joined', backendEventId: 'event_joined_dragon_house', kind: 'joined', occurredAt: '2024-01-12', title: 'Вступ до Dragon House', description: 'Профіль відкрито, першу статичну печатку призначено.', source: 'system' },
      { id: 'timeline-nickname', backendEventId: 'event_nickname_changed', kind: 'nickname_changed', occurredAt: '2024-02-02', title: 'Зміна нікнейму', description: 'Discord-нік синхронізовано з сімейним реєстром.', source: 'discord' },
      { id: 'timeline-promotion', backendEventId: 'event_promotion_matriarch', kind: 'promotion', occurredAt: '2024-05-20', title: 'Підвищення', description: 'Підвищення до керівного рангу.', source: 'manual' },
      { id: 'timeline-birthday', backendEventId: 'event_birthday', kind: 'birthday', occurredAt: '2025-07-27', title: 'День народження', description: 'День народження позначено в календарі Dragon House.', source: 'calendar' },
      { id: 'timeline-quest', backendEventId: 'event_quest_completed', kind: 'quest_completed', occurredAt: '2026-02-14', title: 'Квест завершено', description: 'Звіт квесту прийнято.', source: 'quest' },
      { id: 'timeline-defense', backendEventId: 'event_tower_defense', kind: 'tower_defense', occurredAt: '2026-04-03', title: 'Оборона вишки', description: 'Участь варти зафіксовано для захисту.', source: 'manual' },
      { id: 'timeline-meeting', backendEventId: 'event_family_meeting', kind: 'family_meeting', occurredAt: '2026-06-18', title: 'Сімейна зустріч', description: 'Відвідування підтверджено через календар.', source: 'calendar' },
      { id: 'timeline-discord', backendEventId: 'event_discord_sync_reserved', kind: 'discord_sync', occurredAt: '2026-07-28', title: 'Синхронізація Discord', description: 'Стан Discord оновлюється після backend синхронізації.', source: 'discord' }
    ],
    inventory: [
      { id: 'badges', title: 'Відзнаки', description: 'Відкриті печатки профілю.', slots: [{ id: 'badge-founder', label: 'Печатка засновника', state: 'earned', backendItemId: 'founder_seal' }, { id: 'badge-empty', label: 'Місце для відзнаки', state: 'reserved' }] },
      { id: 'artifacts', title: 'Артефакти', description: 'Предмети з квестів і подій.', slots: [{ id: 'artifact-empty-1', label: 'Місце для артефакту', state: 'empty' }, { id: 'artifact-empty-2', label: 'Місце для артефакту', state: 'empty' }] },
      { id: 'relics', title: 'Реліквії', description: 'Важливі предмети історії сім’ї.', slots: [{ id: 'relic-empty', label: 'Місце для реліквії', state: 'reserved' }] },
      { id: 'collectibles', title: 'Колекція', description: 'Сезонні й подієві предмети.', slots: [{ id: 'collectible-empty', label: 'Місце для предмета', state: 'empty' }] },
      { id: 'season-rewards', title: 'Сезонні нагороди', description: 'Сезонні нагороди профілю.', slots: [{ id: 'season-empty', label: 'Сезонна нагорода', state: 'reserved' }] },
      { id: 'decorations', title: 'Оформлення профілю', description: 'Банери, рамки й ефекти профілю.', slots: [{ id: 'decoration-empty', label: 'Рамка банера', state: 'reserved' }] }
    ],
    permissions: [
      { id: 'manage_members', label: 'Керування учасниками', description: 'Додавання, редагування та деактивація учасників.', granted: true, backendPermissionKey: 'manage_members' },
      { id: 'manage_events', label: 'Керування подіями', description: 'Створення і ведення сімейних подій.', granted: true, backendPermissionKey: 'manage_events' },
      { id: 'manage_family_quests', label: 'Керування квестами', description: 'Створення та перевірка сімейних квестів.', granted: true, backendPermissionKey: 'manage_family_quests' },
      { id: 'manage_resources', label: 'Керування ресурсами', description: 'Оновлення корисних матеріалів і посилань.', granted: true, backendPermissionKey: 'manage_resources' },
      { id: 'manage_recruitment', label: 'Запрошення учасників', description: 'Підготовка запрошень для нових учасників.', granted: true, backendPermissionKey: 'manage_recruitment' },
      { id: 'discord_administration', label: 'Керування Discord', description: 'Синхронізація ролей і Discord-зв’язків.', granted: false, backendPermissionKey: 'manage_discord_integration' }
    ],
    activity: Array.from({ length: 84 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 4, 6 + index)).toISOString().slice(0, 10),
      value: (index * 7 + (index % 5) * 3) % 10,
      backendActivityId: `activity-${index + 1}`
    })),
    progress: {
      currentRank: 'Володарка',
      nextRank: 'Наступний ранг',
      progress: 88,
      futureXp: null,
      requirements: [
        { id: 'req-meetings', label: 'Сімейні зустрічі', completed: true, currentValue: '42', requiredValue: '40' },
        { id: 'req-defense', label: 'Участь в обороні вишок', completed: true, currentValue: '18', requiredValue: '15' },
        { id: 'req-quests', label: 'Завершені квести', completed: true, currentValue: '67', requiredValue: '60' },
        { id: 'req-discord', label: 'Discord-синхронізація', completed: false, currentValue: 'Очікує', requiredValue: 'Активна роль' },
        { id: 'req-council', label: 'Підтвердження ради', completed: false, currentValue: 'Очікує', requiredValue: 'Ручне рішення' }
      ]
    },
    discord: [
      { id: 'discord-avatar', label: 'Аватар Discord', value: 'Аватар прив’язується через Discord-профіль', state: 'pending', backendField: 'discordAvatarUrl' },
      { id: 'discord-presence', label: 'Присутність', value: 'Статус береться з останньої синхронізації', state: 'reserved', backendField: 'presence' },
      { id: 'discord-voice', label: 'Голосовий канал', value: 'Зала полумʼя', state: 'linked', backendField: 'voiceChannel' },
      { id: 'discord-roles', label: 'Ролі', value: 'Ролі перевіряються Discord-синхронізацією', state: 'reserved', backendField: 'roles' },
      { id: 'discord-servers', label: 'Сервери', value: 'Основний сервер Dragon House', state: 'reserved', backendField: 'mutualServers' },
      { id: 'discord-account', label: 'Прив’язаний акаунт', value: 'Discord-акаунт прив’язаний до Family Hub', state: 'pending', backendField: 'linkedAccount' }
    ]
  }
];
