import type { DragonProfile } from './profile-models';

export const DRAGON_PROFILE_MOCK_DATA: DragonProfile[] = [
  {
    id: 'profile-current-user',
    identity: {
      avatarUrl: null,
      dragonName: 'Anastasia Dragons',
      discordNickname: 'Anastasia_Dragons',
      dragonTitle: 'Volodarka Predvichnoho Polumia',
      currentRank: 'Matriarch',
      rankLevel: 100,
      element: 'Ancient Flame',
      birthday: '1998-07-27',
      joinDate: '2024-01-12',
      currentStatus: 'online',
      staticId: 'DH-001',
      familyBranch: 'Founding Flame',
      bannerTitle: 'Command Chamber of the First Flame'
    },
    statistics: [
      { id: 'meetings', label: 'Meetings attended', value: '42', detail: 'Family councils and chamber calls', trend: '+6 this season', progress: 84, backendMetricKey: 'meetings_attended' },
      { id: 'tower-defense', label: 'Tower Defense', value: '18', detail: 'Fortress defense participations', trend: 'Guardian pace', progress: 72, backendMetricKey: 'tower_defense_participation' },
      { id: 'quests', label: 'Quests completed', value: '67', detail: 'Confirmed Dragon House quests', trend: '+11 month', progress: 89, backendMetricKey: 'quests_completed' },
      { id: 'events', label: 'Events joined', value: '54', detail: 'Calendar events with attendance', trend: 'Elite cadence', progress: 78, backendMetricKey: 'events_joined' },
      { id: 'activity', label: 'Activity score', value: '9,420', detail: 'Future Discord weighted score', trend: 'Placeholder XP', progress: 94, backendMetricKey: 'activity_score' },
      { id: 'attendance', label: 'Attendance %', value: '96%', detail: 'Meetings and required events', trend: 'High reliability', progress: 96, backendMetricKey: 'attendance_percent' },
      { id: 'promotion', label: 'Promotion progress', value: '88%', detail: 'Current rank requirements', trend: '2 seals left', progress: 88, backendMetricKey: 'promotion_progress' },
      { id: 'streak', label: 'Current streak', value: '21', detail: 'Active days in a row', trend: 'Longest: 34', progress: 62, backendMetricKey: 'current_streak' }
    ],
    achievements: [
      { id: 'achievement-first-flight', backendAchievementId: 'first_flight', icon: 'Wing', title: 'First Flight', description: 'Entered Dragon House and completed the first chamber ritual.', state: 'unlocked', rarity: 'common', unlockedAt: '2024-01-12', progress: 100 },
      { id: 'achievement-flame-keeper', backendAchievementId: 'flame_keeper', icon: 'Flame', title: 'Flame Keeper', description: 'Kept the family flame active through meetings and events.', state: 'unlocked', rarity: 'rare', unlockedAt: '2024-04-18', progress: 100 },
      { id: 'achievement-veteran', backendAchievementId: 'dragon_veteran', icon: 'Scale', title: 'Dragon Veteran', description: 'Stayed with Dragon House across multiple seasons.', state: 'unlocked', rarity: 'rare', unlockedAt: '2025-01-12', progress: 100 },
      { id: 'achievement-guardian', backendAchievementId: 'guardian', icon: 'Shield', title: 'Guardian', description: 'Defended the fortress in Tower Defense operations.', state: 'unlocked', rarity: 'common', unlockedAt: '2025-03-03', progress: 100 },
      { id: 'achievement-ancient-one', backendAchievementId: 'ancient_one', icon: 'Obelisk', title: 'Ancient One', description: 'A sealed legacy achievement reserved for deep history.', state: 'locked', rarity: 'legendary', unlockedAt: null, progress: 64 },
      { id: 'achievement-founder', backendAchievementId: 'founder', icon: 'Crown', title: 'Founder', description: 'A founding seal tied to the origin of Dragon House.', state: 'unlocked', rarity: 'legendary', unlockedAt: '2024-01-12', progress: 100 },
      { id: 'achievement-elder', backendAchievementId: 'elder', icon: 'Runes', title: 'Elder', description: 'Earn the trust of the council and unlock the elder seal.', state: 'locked', rarity: 'rare', unlockedAt: null, progress: 78 },
      { id: 'achievement-secret', backendAchievementId: 'secret_discord_ritual', icon: 'Hidden', title: 'Secret Seal', description: 'Hidden until the Discord ritual reveals its purpose.', state: 'secret', rarity: 'legendary', unlockedAt: null, progress: 0 }
    ],
    timeline: [
      { id: 'timeline-joined', backendEventId: 'event_joined_dragon_house', kind: 'joined', occurredAt: '2024-01-12', title: 'Joined Dragon House', description: 'The chamber was opened and the first static seal was assigned.', source: 'system' },
      { id: 'timeline-nickname', backendEventId: 'event_nickname_changed', kind: 'nickname_changed', occurredAt: '2024-02-02', title: 'Nickname changed', description: 'Discord nickname synchronized with the family registry.', source: 'discord' },
      { id: 'timeline-promotion', backendEventId: 'event_promotion_matriarch', kind: 'promotion', occurredAt: '2024-05-20', title: 'Promotion', description: 'Advanced to the Matriarch command rank.', source: 'manual' },
      { id: 'timeline-birthday', backendEventId: 'event_birthday', kind: 'birthday', occurredAt: '2025-07-27', title: 'Birthday', description: 'Birthday flame marked in Dragon Calendar.', source: 'calendar' },
      { id: 'timeline-quest', backendEventId: 'event_quest_completed', kind: 'quest_completed', occurredAt: '2026-02-14', title: 'Quest completed', description: 'Quest report accepted and future rewards prepared.', source: 'quest' },
      { id: 'timeline-defense', backendEventId: 'event_tower_defense', kind: 'tower_defense', occurredAt: '2026-04-03', title: 'Tower Defense', description: 'Guardian participation recorded for fortress defense.', source: 'manual' },
      { id: 'timeline-meeting', backendEventId: 'event_family_meeting', kind: 'family_meeting', occurredAt: '2026-06-18', title: 'Family meeting', description: 'Council attendance confirmed from Dragon Calendar.', source: 'calendar' },
      { id: 'timeline-discord', backendEventId: 'event_discord_sync_reserved', kind: 'discord_sync', occurredAt: '2026-07-28', title: 'Future Discord sync', description: 'Reserved endpoint for live Discord presence and role changes.', source: 'discord' }
    ],
    inventory: [
      { id: 'badges', title: 'Badges', description: 'Visible earned chamber seals.', slots: [{ id: 'badge-founder', label: 'Founder Seal', state: 'earned', backendItemId: 'founder_seal' }, { id: 'badge-empty', label: 'Reserved badge', state: 'reserved' }] },
      { id: 'artifacts', title: 'Artifacts', description: 'Rare items from quests and rituals.', slots: [{ id: 'artifact-empty-1', label: 'Artifact slot', state: 'empty' }, { id: 'artifact-empty-2', label: 'Artifact slot', state: 'empty' }] },
      { id: 'relics', title: 'Relics', description: 'Legendary history objects.', slots: [{ id: 'relic-empty', label: 'Ancient relic', state: 'reserved' }] },
      { id: 'collectibles', title: 'Collectibles', description: 'Seasonal and event collectibles.', slots: [{ id: 'collectible-empty', label: 'Collectible slot', state: 'empty' }] },
      { id: 'season-rewards', title: 'Season rewards', description: 'Future ranked season rewards.', slots: [{ id: 'season-empty', label: 'Season reward', state: 'reserved' }] },
      { id: 'decorations', title: 'Profile decorations', description: 'Banners, frames and chamber effects.', slots: [{ id: 'decoration-empty', label: 'Banner frame', state: 'reserved' }] }
    ],
    permissions: [
      { id: 'manage_members', label: 'Manage Members', description: 'Open member management halls.', granted: true, backendPermissionKey: 'manage_members' },
      { id: 'manage_events', label: 'Manage Calendar', description: 'Control family events and meetings.', granted: true, backendPermissionKey: 'manage_events' },
      { id: 'manage_family_quests', label: 'Manage Quests', description: 'Create and verify Dragon quests.', granted: true, backendPermissionKey: 'manage_family_quests' },
      { id: 'manage_resources', label: 'Manage Resources', description: 'Curate resources and family references.', granted: true, backendPermissionKey: 'manage_resources' },
      { id: 'manage_recruitment', label: 'Invite Members', description: 'Prepare new member invitations.', granted: true, backendPermissionKey: 'manage_recruitment' },
      { id: 'discord_administration', label: 'Discord Administration', description: 'Reserved Discord role administration seal.', granted: false, backendPermissionKey: 'manage_discord_integration' }
    ],
    activity: Array.from({ length: 84 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 4, 6 + index)).toISOString().slice(0, 10),
      value: (index * 7 + (index % 5) * 3) % 10,
      backendActivityId: `activity-${index + 1}`
    })),
    progress: {
      currentRank: 'Matriarch',
      nextRank: 'Ancient Flame',
      progress: 88,
      futureXp: null,
      requirements: [
        { id: 'req-meetings', label: 'Family meetings attended', completed: true, currentValue: '42', requiredValue: '40' },
        { id: 'req-defense', label: 'Tower Defense participation', completed: true, currentValue: '18', requiredValue: '15' },
        { id: 'req-quests', label: 'Dragon quests completed', completed: true, currentValue: '67', requiredValue: '60' },
        { id: 'req-discord', label: 'Future Discord score', completed: false, currentValue: 'Reserved', requiredValue: 'Live sync' },
        { id: 'req-council', label: 'Council confirmation', completed: false, currentValue: 'Pending', requiredValue: 'Manual seal' }
      ]
    },
    discord: [
      { id: 'discord-avatar', label: 'Discord Avatar', value: 'Linked avatar placeholder', state: 'pending', backendField: 'discordAvatarUrl' },
      { id: 'discord-presence', label: 'Presence', value: 'Live presence reserved', state: 'reserved', backendField: 'presence' },
      { id: 'discord-voice', label: 'Voice Channel', value: 'Hall of Flame', state: 'linked', backendField: 'voiceChannel' },
      { id: 'discord-roles', label: 'Roles', value: 'Role sync placeholder', state: 'reserved', backendField: 'roles' },
      { id: 'discord-servers', label: 'Mutual Servers', value: 'Mutual server list reserved', state: 'reserved', backendField: 'mutualServers' },
      { id: 'discord-account', label: 'Linked Account', value: 'Discord account bridge ready', state: 'pending', backendField: 'linkedAccount' }
    ]
  }
];
