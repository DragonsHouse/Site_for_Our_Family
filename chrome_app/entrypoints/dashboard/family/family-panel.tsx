import { useEffect, useState } from 'react';
import { DRAGON_HOUSE_ASSETS } from '../../../lib/family-assets';
import { saveFamilyPosts } from '../../../lib/family-data';
import {
  canManageDiscordIntegration,
  canManageBackups,
  canManageFamilyAssets,
  canViewAccounting
} from '../../../lib/family-permissions';
import {
  readNotifiedFamilyNewsIds,
  saveNotifiedFamilyNewsIds
} from '../../../lib/family-repositories';
import type { FamilyPermission, FamilyPost, FamilyRole, FamilySection, FamilyUser } from '../../../lib/family-types';
import { DiscordIntegrationPanel } from './discord-integration-panel';
import { FamilyAssetManager } from './family-asset-manager';
import { FamilyBackupPanel } from './family-backup-panel';
import { FamilyAccounting } from './family-accounting';
import { FamilyEconomy } from './family-economy';
import { FamilyFeed } from './family-feed';
import { FamilyHome } from './family-home';
import { FamilyMembers } from './family-members';
import { FamilyQuests } from './family-quests';
import { FamilyRanks } from './family-ranks';
import { FamilyRules } from './family-rules';
import { RecruitmentPanel } from './recruitment-panel';

const BASE_SECTIONS: Array<{ key: FamilySection; label: string }> = [
  { key: 'home', label: 'Головна' },
  { key: 'feed', label: 'Новини' },
  { key: 'economy', label: 'Скарбниця' },
  { key: 'members', label: 'Учасники' },
  { key: 'rules', label: "Правила сім’ї" },
  { key: 'ranks', label: 'Ранги' },
  { key: 'recruitment', label: 'Набір' },
  { key: 'quests', label: 'Сімейні квести' }
];

export function FamilyPanel({
  currentUser,
  users,
  posts,
  onPostsChange,
  onUserAccessChange,
  onUserCreate,
  onUserProfileChange,
  onUserDeactivate,
  membersDataSourceMode = 'api',
  initialSection = 'home'
}: {
  currentUser: FamilyUser;
  users: FamilyUser[];
  posts: FamilyPost[];
  onPostsChange: (posts: FamilyPost[]) => void;
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
}) {
  const sections = canViewAccounting(currentUser)
    ? [...BASE_SECTIONS, { key: 'accounting' as const, label: 'Бухгалтерія' }]
    : BASE_SECTIONS;
  const canOpenManagement =
    canManageFamilyAssets(currentUser) || canManageDiscordIntegration(currentUser) || canManageBackups(currentUser);
  const visibleSections = canOpenManagement
    ? [...sections, { key: 'management' as const, label: 'Керування' }]
    : sections;
  const [section, setSection] = useState<FamilySection>(() => initialSection);
  const urgentUnreadCount = posts.filter(
    (post) => post.type === 'urgent' && !post.isReadBy.includes(currentUser.nickname)
  ).length;

  useEffect(() => {
    const urgentPosts = posts.filter(
      (post) => post.type === 'urgent' && post.notificationRequired !== false
    );
    if (!urgentPosts.length || typeof chrome === 'undefined' || !chrome.notifications) return;

    const notifiedIds = readNotifiedFamilyNewsIds();
    const nextIds = new Set(notifiedIds);
    for (const post of urgentPosts) {
      if (nextIds.has(post.id)) continue;
      nextIds.add(post.id);
      void chrome.notifications.create(`dragon-house-news-${post.id}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL(DRAGON_HOUSE_ASSETS.crest.replace(/^\//, '')),
        title: `Dragon House: ${post.title}`,
        message: post.body.slice(0, 180)
      });
    }
    if (nextIds.size !== notifiedIds.length) {
      saveNotifiedFamilyNewsIds([...nextIds]);
    }
  }, [posts]);

  function createPost(post: FamilyPost) {
    const nextPosts = [post, ...posts];
    saveFamilyPosts(nextPosts);
    onPostsChange(nextPosts);
  }

  return (
    <div className="space-y-4">
      <nav className="dh-panel flex flex-wrap gap-2 rounded-2xl p-2">
        {visibleSections.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setSection(item.key)}
            className={
              section === item.key
                ? 'dh-tab-active rounded-xl px-3 py-2 text-sm font-semibold'
                : 'dh-tab rounded-xl px-3 py-2 text-sm font-semibold'
            }
          >
            {item.label}
            {item.key === 'feed' && urgentUnreadCount > 0 ? (
              <span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
                {urgentUnreadCount}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      {section === 'home' ? (
        <FamilyHome
          currentUser={currentUser}
          users={users}
          posts={posts}
          onCreatePost={createPost}
          onOpenSection={setSection}
        />
      ) : null}
      {section === 'feed' ? <FamilyFeed posts={posts} /> : null}
      {section === 'economy' ? <FamilyEconomy currentUser={currentUser} /> : null}
      {section === 'members' ? (
        <FamilyMembers
          currentUser={currentUser}
          users={users}
          onUserAccessChange={onUserAccessChange}
          onUserCreate={onUserCreate}
          onUserProfileChange={onUserProfileChange}
          onUserDeactivate={onUserDeactivate}
          dataSourceMode={membersDataSourceMode}
        />
      ) : null}
      {section === 'rules' ? <FamilyRules currentUser={currentUser} /> : null}
      {section === 'ranks' ? <FamilyRanks /> : null}
      {section === 'recruitment' ? <RecruitmentPanel currentUser={currentUser} /> : null}
      {section === 'quests' ? <FamilyQuests currentUser={currentUser} users={users} /> : null}
      {section === 'accounting' ? <FamilyAccounting currentUser={currentUser} users={users} /> : null}
      {section === 'management' && canOpenManagement ? (
        <div className="space-y-4">
          {canManageFamilyAssets(currentUser) ? <FamilyAssetManager currentUser={currentUser} /> : null}
          {canManageBackups(currentUser) ? <FamilyBackupPanel currentUser={currentUser} /> : null}
          {canManageDiscordIntegration(currentUser) ? (
            <DiscordIntegrationPanel currentUser={currentUser} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
