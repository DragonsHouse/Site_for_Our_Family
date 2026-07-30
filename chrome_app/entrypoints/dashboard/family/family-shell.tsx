import { DashboardApp } from '../dashboard-app';
import { FAMILY_MAP_ZONES } from '../../../lib/family-data';
import { canManageFamilyMap } from '../../../lib/family-permissions';
import { FAMILY_MAP_REFERENCES } from '../../../lib/family-repositories';
import type { FamilyPermission, FamilyPost, FamilyRole, FamilySection, FamilyTab, FamilyUser } from '../../../lib/family-types';
import { DragonHouseCrest } from './dragon-house-crest';
import {
  DragonBackground,
  DragonBadge,
  DragonButton,
  DragonHero,
  DragonRoomHeader,
  DragonRoomShell,
  DragonSection
} from '../dragon-ui/dragon-ui';
import { DragonAchievementEngineScreen } from './dragon-achievements';
import { DragonCalendar } from './dragon-calendar';
import { DragonEventEngineScreen } from './dragon-events';
import { DragonDiscordSyncScreen } from './dragon-discord-sync';
import { DragonMembers } from './dragon-members';
import { DragonTowerDefenseScreen } from './dragon-tower-defense';
import { FamilyPanel } from './family-panel';
import { FamilyProfile } from './family-profile';
import { FamilyTabs } from './family-tabs';
import { PersonalCabinet } from './personal-cabinet';
import { ResourcesPanel } from './resources-panel';
import { DRAGON_ROOM_BACKGROUND_VARIANT, getDragonRoomMetadata } from './room-navigation';

function ModuleIntro({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <DragonSection title={title} description={description}>
      {children}
    </DragonSection>
  );
}

export function FamilyShell({
  currentUser,
  familyUsers,
  posts,
  activeTab,
  onTabChange,
  onPostsChange,
  onAvatarChange,
  onUserAccessChange,
  onUserCreate,
  onUserProfileChange,
  onUserDeactivate,
  membersDataSourceMode,
  initialSection,
  onLogout,
  onAuthenticatedUserRefresh
}: {
  currentUser: FamilyUser;
  familyUsers: FamilyUser[];
  posts: FamilyPost[];
  activeTab: FamilyTab;
  onTabChange: (tab: FamilyTab) => void;
  onPostsChange: (posts: FamilyPost[]) => void;
  onAvatarChange: (avatarDataUrl: string | null) => void;
  onUserAccessChange: (
    nickname: string,
    updates: {
      role: FamilyRole;
      rank: string;
      rankLevel: number;
      permissions: FamilyPermission[];
    }
  ) => void;
  onUserCreate: (input: {
    nickname: string;
    staticId: string;
    rankLevel: number;
    role: FamilyRole;
    joinedAt: string | null;
    accountStatus: 'active' | 'inactive';
    avatarDataUrl?: string | null;
    permissions?: FamilyPermission[];
    notes?: string | null;
    discordUserId?: string | null;
    discordUsername?: string | null;
  }) => void;
  onUserProfileChange: (
    originalNickname: string,
    updates: {
      nickname: string;
      staticId: string;
      rankLevel: number;
      role: FamilyRole;
      joinedAt: string | null;
      accountStatus: 'active' | 'inactive';
      avatarDataUrl?: string | null;
      permissions: FamilyPermission[];
      notes?: string | null;
      discordUserId?: string | null;
      discordUsername?: string | null;
    }
  ) => void;
  onUserDeactivate: (nickname: string) => void;
  membersDataSourceMode?: 'local' | 'api';
  initialSection?: FamilySection;
  onLogout: () => void;
  onAuthenticatedUserRefresh: () => Promise<FamilyUser | null>;
}) {
  const activeRoom = getDragonRoomMetadata(activeTab);

  return (
    <main className="dh-shell px-4 py-6">
      <DragonBackground variant={DRAGON_ROOM_BACKGROUND_VARIANT[activeTab]} />

      <div className="relative z-10 mx-auto w-full min-w-0 max-w-7xl space-y-4">
        <DragonHero
          eyebrow="DRAGON HOUSE FORTRESS"
          title="Family Hub"
          description="Внутрішня фортеця сім’ї: зали, хроніки, учасники, ресурси й майбутні модулі Dragon House."
        >
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <div className="flex items-center gap-3">
              <DragonHouseCrest slot="header_logo" />
              <DragonBadge tone="gold">{currentUser.nickname}</DragonBadge>
            </div>
            <DragonButton type="button" variant="danger" onClick={onLogout}>
              Вийти
            </DragonButton>
          </div>
        </DragonHero>

        <FamilyTabs activeTab={activeTab} onChange={onTabChange} currentUser={currentUser} />

        {activeTab === 'cabinet' ? (
          <DragonRoomShell
            className="dh-dragon-room-shell-cabinet"
            labelledBy="dragon-room-cabinet-title"
            header={
              <DragonRoomHeader
                eyebrow={activeRoom.room}
                title={activeRoom.label}
                titleId="dragon-room-cabinet-title"
                description={activeRoom.description}
                metadata={<DragonBadge tone="active">{currentUser.rank}</DragonBadge>}
              />
            }
          >
            <PersonalCabinet
              user={currentUser}
              posts={posts}
              onOpenTab={onTabChange}
              onAvatarChange={onAvatarChange}
              onAuthenticatedUserRefresh={onAuthenticatedUserRefresh}
            />
          </DragonRoomShell>
        ) : null}

        {activeTab === 'profile' ? <FamilyProfile user={currentUser} /> : null}

        {activeTab === 'members' ? <DragonMembers currentUser={currentUser} /> : null}

        {activeTab === 'family' ? (
          <FamilyPanel
            currentUser={currentUser}
            users={familyUsers}
            posts={posts}
            onPostsChange={onPostsChange}
            onUserAccessChange={onUserAccessChange}
            onUserCreate={onUserCreate}
            onUserProfileChange={onUserProfileChange}
            onUserDeactivate={onUserDeactivate}
            membersDataSourceMode={membersDataSourceMode}
            initialSection={initialSection}
          />
        ) : null}

        {activeTab === 'buyers' ? (
          <>
            <ModuleIntro title="Скупники" description="Buyers module у складі Dragon House." />
            <DashboardApp familyTab="buyers" />
          </>
        ) : null}

        {/* Future Calendar includes family events, meetings, quests/deadlines, tournaments, celebrations, Dragon House anniversaries and member birthdays. */}
        {activeTab === 'calendar' ? (
          <DragonCalendar currentUser={currentUser} />
        ) : null}

        {activeTab === 'events' ? <DragonEventEngineScreen /> : null}

        {activeTab === 'tower-defense' ? <DragonTowerDefenseScreen /> : null}

        {activeTab === 'achievements' ? <DragonAchievementEngineScreen /> : null}

        {activeTab === 'discord-sync' ? <DragonDiscordSyncScreen currentUser={currentUser} /> : null}

        {activeTab === 'map' ? (
          <>
            <ModuleIntro title="Мапа" description="Території, зони й карта.">
              <div className="grid gap-3 md:grid-cols-2">
                {FAMILY_MAP_ZONES.map((zone) => (
                  <div key={zone.id} className="dh-card rounded-xl p-3">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: zone.color }} />
                      <span className="font-medium text-white">{zone.name}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">{zone.description}</p>
                    <div className="mt-2 text-xs text-slate-500">
                      {zone.type}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {FAMILY_MAP_REFERENCES.map((reference) => (
                  <div key={reference.id} className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                    <div className="font-medium text-amber-100">{reference.title}</div>
                    <div className="mt-1 text-xs text-slate-300">
                      {reference.version} · {reference.date} · {reference.fileDescription}
                    </div>
                    <p className="mt-2 text-sm text-amber-50">{reference.notes}</p>
                    <a
                      href={reference.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex rounded-lg border border-amber-500/60 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-500/10"
                    >
                      Відкрити reference
                    </a>
                  </div>
                ))}
              </div>

              {canManageFamilyMap(currentUser) ? (
                <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                  Керування зонами буде доступне в наступному оновленні мапи.
                </div>
              ) : null}
            </ModuleIntro>
            <DashboardApp familyTab="map" />
          </>
        ) : null}

        {activeTab === 'resources' ? <ResourcesPanel currentUser={currentUser} /> : null}
      </div>
    </main>
  );
}
