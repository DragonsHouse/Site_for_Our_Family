import { useState } from 'react';
import { canManageFamilyContent, canManageFamilyNews, canViewAccounting } from '../../../lib/family-permissions';
import {
  getCurrentAccountingMonth,
  readFamilyContentBlocks,
  saveFamilyContentBlock
} from '../../../lib/family-repositories';
import type { FamilyEditableContentBlock, FamilyPost, FamilySection, FamilyUser } from '../../../lib/family-types';
import { FamilyContentEditor } from './family-content-editor';
import { CreateFamilyPost } from './create-family-post';
import { DragonHouseCrest } from './dragon-house-crest';
import { FamilyPostCard } from './family-post-card';

function findBlock(blocks: FamilyEditableContentBlock[], id: string) {
  const block = blocks.find((item) => item.id === id);
  if (!block) throw new Error(`Missing family content block: ${id}`);
  return block;
}

export function FamilyHome({
  currentUser,
  users,
  posts,
  onCreatePost,
  onOpenSection
}: {
  currentUser: FamilyUser;
  users: FamilyUser[];
  posts: FamilyPost[];
  onCreatePost: (post: FamilyPost) => void;
  onOpenSection: (section: FamilySection) => void;
}) {
  const urgentPosts = posts.filter((post) => post.type === 'urgent');
  const pinnedPosts = posts.filter((post) => post.isPinned);
  const latestNews = posts
    .filter((post) => post.type === 'family_news' || post.type === 'family' || post.type === 'announcement')
    .slice(0, 3);
  const onlineUsers = users.filter((user) => user.isOnline || user.status === 'online');
  const accountingMonth = canViewAccounting(currentUser) ? getCurrentAccountingMonth() : null;
  const canEditContent = canManageFamilyContent(currentUser);
  const [contentBlocks, setContentBlocks] = useState<FamilyEditableContentBlock[]>(() => readFamilyContentBlocks());
  const [editingBlock, setEditingBlock] = useState<FamilyEditableContentBlock | null>(null);
  const introBlock = findBlock(contentBlocks, 'home-intro');
  const alertBlock = findBlock(contentBlocks, 'home-alert');

  function saveContentBlock(block: FamilyEditableContentBlock) {
    setContentBlocks(saveFamilyContentBlock(block, currentUser.nickname));
    setEditingBlock(null);
  }

  return (
    <div className="space-y-4">
      {canManageFamilyNews(currentUser) ? (
        <CreateFamilyPost currentUser={currentUser} onCreate={onCreatePost} />
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <article className="dh-panel relative overflow-hidden rounded-3xl p-5">
            <div className="pointer-events-none absolute right-4 top-4 h-32 w-32 rounded-full bg-orange-500/10 blur-3xl" />
            <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <DragonHouseCrest />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
                    Dragon House
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-white">Внутрішній штаб сім’ї</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Лігво, новини, квести, скарбниця і доступи.
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                Важливе: сімейні квести тепер мають набір, учасників і звіти для бухгалтерії.
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[introBlock, alertBlock].map((block) => (
                <div key={block.id} className="rounded-xl border border-slate-800 bg-black/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{block.title}</div>
                      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-300">{block.body}</p>
                    </div>
                    {canEditContent ? (
                      <button
                        type="button"
                        onClick={() => setEditingBlock(block)}
                        className="shrink-0 rounded-lg border border-amber-500/50 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-500/10"
                      >
                        Редагувати
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                    {block.contact ? <span>Контакт / автор: {block.contact}</span> : null}
                    <span>Оновлено: {new Date(block.updatedAt).toLocaleString('uk-UA')}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-slate-800 bg-black/30 p-3">
                <div className="text-sm text-slate-500">Учасників</div>
                <div className="mt-1 text-2xl font-semibold text-white">{users.length}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-black/30 p-3">
                <div className="text-sm text-slate-500">У мережі</div>
                <div className="mt-1 text-2xl font-semibold text-emerald-100">{onlineUsers.length}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-black/30 p-3">
                <div className="text-sm text-slate-500">Статус сімʼї</div>
                <div className="mt-1 font-semibold text-amber-100">Внутрішній Hub</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-black/30 p-3">
                <div className="text-sm text-slate-500">Осередок</div>
                <div className="mt-1 font-semibold text-amber-100">922 будинок</div>
              </div>
            </div>

            {accountingMonth ? (
              <div className="mt-4 rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-50">
                Фонд поточного місяця:{' '}
                <span className="font-semibold text-amber-100">
                  {accountingMonth.totalFund.toLocaleString('uk-UA')} $
                </span>
              </div>
            ) : null}
          </article>

          <div className="grid gap-4 lg:grid-cols-2">
            {urgentPosts.slice(0, 2).map((post) => (
              <FamilyPostCard key={post.id} post={post} />
            ))}
            {pinnedPosts
              .filter((post) => post.type !== 'urgent')
              .slice(0, 2)
              .map((post) => (
                <FamilyPostCard key={post.id} post={post} />
              ))}
          </div>
        </div>

        <aside className="space-y-4">
          <section className="dh-card rounded-2xl p-4">
            <h3 className="font-semibold text-white">Швидкі дії</h3>
            <div className="mt-3 grid gap-2">
              <button type="button" onClick={() => onOpenSection('feed')} className="dh-tab rounded-xl px-3 py-2 text-left text-sm">
                Відкрити новини
              </button>
              <button type="button" onClick={() => onOpenSection('economy')} className="dh-tab rounded-xl px-3 py-2 text-left text-sm">
                Перейти до Скарбниці
              </button>
              <button type="button" onClick={() => onOpenSection('quests')} className="dh-tab rounded-xl px-3 py-2 text-left text-sm">
                Сімейні квести
              </button>
              <button type="button" onClick={() => onOpenSection('members')} className="dh-tab rounded-xl px-3 py-2 text-left text-sm">
                Учасники
              </button>
              <button type="button" onClick={() => onOpenSection('recruitment')} className="dh-tab rounded-xl px-3 py-2 text-left text-sm">
                Набір
              </button>
            </div>
          </section>
          <section className="dh-card rounded-2xl p-4">
            <h3 className="font-semibold text-white">Остання новина</h3>
            <div className="mt-3 space-y-3">
              {latestNews.map((post) => (
                <div key={post.id} className="rounded-xl border border-slate-800 bg-black/30 p-3">
                  <div className="font-medium text-slate-100">{post.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{new Date(post.createdAt).toLocaleString('uk-UA')}</div>
                </div>
              ))}
              {!latestNews.length ? (
                <div className="rounded-xl border border-slate-800 bg-black/30 p-3 text-sm text-slate-400">
                  Новин поки немає.
                </div>
              ) : null}
            </div>
          </section>
        </aside>
      </section>

      {editingBlock ? (
        <FamilyContentEditor
          block={editingBlock}
          onClose={() => setEditingBlock(null)}
          onSave={saveContentBlock}
        />
      ) : null}
    </div>
  );
}
