import { DashboardApp } from '../dashboard-app';
import { FAMILY_MAP_ZONES } from '../../../lib/family-data';
import { canManageFamilyMap } from '../../../lib/family-permissions';
import { FAMILY_MAP_REFERENCES } from '../../../lib/family-repositories';
import type { FamilyPermission, FamilyPost, FamilyRole, FamilySection, FamilyTab, FamilyUser } from '../../../lib/family-types';
import { DragonHouseCrest } from './dragon-house-crest';
import { FamilyPanel } from './family-panel';
import { FamilyTabs } from './family-tabs';
import { PersonalCabinet } from './personal-cabinet';
import { ResourcesPanel } from './resources-panel';

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
    <section className="dh-panel rounded-2xl p-5">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
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
  onLogout
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
}) {
  return (
    <main className="dh-shell px-4 py-6">
      <div className="dh-castle-bg" aria-hidden="true" />
      <div className="dh-global-overlay" aria-hidden="true" />
      <div className="dh-dragon-layer" aria-hidden="true" />
      <div className="dh-smoke" aria-hidden="true" />

      <div className="relative z-10 mx-auto w-full min-w-0 max-w-7xl space-y-4">
        <header className="dh-panel relative overflow-hidden rounded-3xl p-5">
          <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <DragonHouseCrest slot="header_logo" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-300">
                  Dragon House
                </p>
                <h1 className="mt-1 text-3xl font-semibold text-white">Family Hub</h1>
              </div>
            </div>

            <div className="flex flex-col items-start gap-2 lg:items-end">
              <div className="rounded-full border border-amber-500/30 bg-black/30 px-3 py-1 text-sm text-amber-100">
                {currentUser.nickname}
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="rounded-lg border border-red-800 px-3 py-2 text-sm text-red-100 hover:bg-red-950/40"
              >
                Вийти
              </button>
            </div>
          </div>
        </header>

        <FamilyTabs activeTab={activeTab} onChange={onTabChange} />

        {activeTab === 'cabinet' ? (
          <PersonalCabinet
            user={currentUser}
            posts={posts}
            onOpenTab={onTabChange}
            onAvatarChange={onAvatarChange}
          />
        ) : null}

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

        {activeTab === 'events' ? (
          <>
            <ModuleIntro title="Івенти" description="Події, таймери й нагадування." />
            <DashboardApp familyTab="events" />
          </>
        ) : null}

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
