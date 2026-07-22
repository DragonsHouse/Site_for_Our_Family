import { useState } from 'react';
import { canManageFamilyNews } from '../../../lib/family-permissions';
import type { FamilyPost, FamilyPostType, FamilyUser } from '../../../lib/family-types';

const POST_TYPES: Array<{ value: FamilyPostType; label: string }> = [
  { value: 'urgent', label: 'Термінове' },
  { value: 'family_news', label: "Новини сім’ї" },
  { value: 'recruitment', label: 'Набір' },
  { value: 'event', label: 'Подія' },
  { value: 'info', label: 'Інформація' },
  { value: 'announcement', label: 'Оголошення' },
  { value: 'poll', label: 'Опитування' }
];

export function CreateFamilyPost({
  currentUser,
  onCreate
}: {
  currentUser: FamilyUser;
  onCreate: (post: FamilyPost) => void;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FamilyPostType>('announcement');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const canManage = canManageFamilyNews(currentUser);

  if (!canManage) return null;

  function submitPost() {
    const now = new Date().toISOString();
    onCreate({
      id: `family-post-${Date.now()}`,
      type,
      title: title.trim(),
      body: body.trim(),
      createdBy: currentUser.nickname,
      createdAt: now,
      updatedAt: now,
      expiresAt: null,
      isPinned: pinned,
      notificationRequired: type === 'urgent',
      target: 'all',
      targetRoles: [],
      targetUserIds: [],
      serverName: 'Quant RP',
      isReadBy: []
    });
    setTitle('');
    setBody('');
    setPinned(false);
    setType('announcement');
    setOpen(false);
  }

  return (
    <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-white">Публікації Dragon House</h3>
          <p className="text-sm text-amber-100">Власниця та довірені модератори можуть створювати новини, термінові повідомлення і набір.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-xl border border-amber-500/60 px-3 py-2 text-sm text-amber-100 hover:bg-amber-500/10"
        >
          {open ? 'Закрити' : 'Створити публікацію'}
        </button>
      </div>

      {open ? (
        <div className="mt-4 grid gap-3">
          <select
            value={type}
            onChange={(event) => setType(event.target.value as FamilyPostType)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            {POST_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            placeholder="Заголовок"
          />
          <textarea
            rows={4}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            placeholder="Текст публікації"
          />
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(event) => setPinned(event.target.checked)}
            />
            Закріпити
          </label>
          <button
            type="button"
            onClick={submitPost}
            disabled={!title.trim() || !body.trim()}
            className="w-fit rounded-xl bg-gradient-to-r from-red-700 to-amber-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Опублікувати
          </button>
        </div>
      ) : null}
    </section>
  );
}
