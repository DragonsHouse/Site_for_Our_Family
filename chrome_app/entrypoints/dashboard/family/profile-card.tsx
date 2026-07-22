import { useRef, useState } from 'react';
import { FAMILY_ROLE_LABELS, type FamilyUser } from '../../../lib/family-auth';

const MAX_AVATAR_SOURCE_SIZE = 4 * 1024 * 1024;
const AVATAR_SIZE = 320;

function formatDateTime(value: string | null) {
  if (!value) return 'ще не було активності';
  return new Date(value).toLocaleString('uk-UA');
}

function statusLabel(user: FamilyUser) {
  if (user.status === 'away') return 'Відійшов';
  return user.isOnline || user.status === 'online' ? 'Онлайн' : 'Офлайн';
}

function avatarSrc(user: FamilyUser) {
  return user.avatarDataUrl || user.avatarUrl;
}

function resizeAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не вдалося прочитати фото.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Не вдалося обробити фото.'));
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = AVATAR_SIZE;
        canvas.height = AVATAR_SIZE;
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Canvas недоступний для обробки фото.'));
          return;
        }

        const side = Math.min(image.width, image.height);
        const sourceX = (image.width - side) / 2;
        const sourceY = (image.height - side) / 2;
        context.drawImage(image, sourceX, sourceY, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function ProfileCard({
  user,
  onAvatarChange
}: {
  user: FamilyUser;
  onAvatarChange?: (avatarDataUrl: string | null) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const currentAvatar = avatarSrc(user);

  function handleAvatarFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAvatarError('Обери файл зображення.');
      return;
    }
    if (file.size > MAX_AVATAR_SOURCE_SIZE) {
      setAvatarError('Фото завелике. Обери файл до 4 МБ.');
      return;
    }

    void resizeAvatar(file)
      .then((dataUrl) => {
        setAvatarError(null);
        onAvatarChange?.(dataUrl);
      })
      .catch((error) => {
        setAvatarError(error instanceof Error ? error.message : 'Не вдалося обробити фото.');
      });
  }

  return (
    <article className="dh-panel relative overflow-hidden rounded-3xl p-5">
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-red-700/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-10 h-20 w-48 rounded-full bg-amber-500/10 blur-2xl" />

      <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-5">
          <div className="flex flex-col items-center gap-2">
            <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-[1.35rem] border border-amber-400/50 bg-gradient-to-br from-red-950 via-black to-slate-950 text-2xl font-bold text-amber-200 shadow-[0_0_42px_rgba(185,28,28,0.28)]">
              <div className="absolute inset-2 rounded-2xl border border-amber-400/15" />
              {currentAvatar ? (
                <img src={currentAvatar} alt={user.displayName} className="relative z-10 h-full w-full object-cover" />
              ) : (
                <span className="relative z-10">{user.nickname.slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            {onAvatarChange ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => handleAvatarFile(event.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="dh-fire-button rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Змінити фото
                </button>
                {currentAvatar ? (
                  <button
                    type="button"
                    onClick={() => onAvatarChange(null)}
                    className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs text-red-100 hover:bg-red-500/10"
                  >
                    Видалити
                  </button>
                ) : null}
              </>
            ) : null}
          </div>

          <div>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">ЛІГВО</p>
              <p className="text-sm font-medium text-amber-100/90">Будинок №922</p>
            </div>
            <h2 className="mt-1 text-3xl font-semibold text-white">{user.displayName}</h2>
            <p className="text-sm text-slate-400">{user.nickname}</p>
            {avatarError ? <p className="mt-2 text-xs text-rose-300">{avatarError}</p> : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-amber-400/50 bg-amber-500/10 px-3 py-1 text-sm text-amber-100">
            {FAMILY_ROLE_LABELS[user.role]}
          </span>
          <span className="rounded-full border border-red-500/50 bg-red-950/50 px-3 py-1 text-sm text-red-100">
            {user.rank}
          </span>
          <span className="rounded-full border border-emerald-400/40 bg-emerald-950/30 px-3 py-1 text-sm text-emerald-100">
            {statusLabel(user)}
          </span>
        </div>
      </div>

      <div className="relative z-10 mt-5 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <div className="dh-card rounded-xl p-3">
          <div className="text-slate-500">Static ID</div>
          <div className="mt-1 font-medium text-slate-100">#{user.staticId}</div>
        </div>
        <div className="dh-card rounded-xl p-3">
          <div className="text-slate-500">Статус</div>
          <div className="mt-1 font-medium text-slate-100">{user.statusMessage ?? statusLabel(user)}</div>
        </div>
        <div className="dh-card rounded-xl p-3">
          <div className="text-slate-500">Остання активність</div>
          <div className="mt-1 font-medium text-slate-100">{formatDateTime(user.lastActive)}</div>
        </div>
        <div className="dh-card rounded-xl p-3">
          <div className="text-slate-500">У сім’ї з</div>
          <div className="mt-1 font-medium text-slate-100">
            {user.joinedAt ? new Date(user.joinedAt).toLocaleDateString('uk-UA') : 'не вказано'}
          </div>
        </div>
      </div>
    </article>
  );
}
