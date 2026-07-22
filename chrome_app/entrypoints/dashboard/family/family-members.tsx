import { useMemo, useState } from 'react';
import { FAMILY_ROLE_LABELS, ROLE_PERMISSIONS } from '../../../lib/family-data';
import { ALL_FAMILY_PERMISSIONS, hasFamilyPermission } from '../../../lib/family-permissions';
import { FAMILY_RANKS } from '../../../lib/family-ranks';
import type { FamilyPermission, FamilyRole, FamilyUser } from '../../../lib/family-types';

const PERMISSION_LABELS: Partial<Record<FamilyPermission, string>> = {
  manage_users: 'Керування учасниками',
  manage_tasks: 'Керування задачами',
  manage_ranks: 'Керування рангами',
  view_private_notes: 'Приватні нотатки',
  manage_family_map: 'Керування мапою',
  manage_events: 'Керування івентами',
  manage_buyers: 'Керування скупниками',
  manage_family_posts: 'Публікації сім’ї legacy',
  manage_family_news: 'Новини сім’ї legacy',
  manage_news: 'Новини',
  view_family_history: 'Перегляд історії сім’ї',
  manage_family_economy: 'Скарбниця',
  manage_family_quests: 'Сімейні квести',
  manage_family_assets: 'Картинки Hub',
  manage_discord_integration: 'Discord-інтеграція',
  manage_backups: 'Резервні копії',
  manage_accounting: 'Бухгалтерія',
  manage_treasury: 'Скарбниця/казна',
  manage_recruitment: 'Набір',
  manage_resources: 'Ресурси',
  manage_roles: 'Ролі та доступи'
};

const ROLE_OPTIONS = Object.keys(FAMILY_ROLE_LABELS) as FamilyRole[];

type MemberDraft = {
  nickname: string;
  staticId: string;
  rankLevel: number;
  role: FamilyRole;
  joinedAt: string;
  accountStatus: 'active' | 'inactive';
  avatarDataUrl: string;
  permissions: FamilyPermission[];
  notes: string;
  discordUserId: string;
  discordUsername: string;
};

function avatarSrc(user: FamilyUser) {
  return user.avatarDataUrl || user.avatarUrl;
}

function MemberAvatar({ user }: { user: FamilyUser }) {
  const src = avatarSrc(user);
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-br from-red-950 to-slate-950 text-xs font-bold text-amber-100">
      {src ? <img src={src} alt={user.displayName} className="h-full w-full object-cover" /> : user.nickname.slice(0, 2).toUpperCase()}
    </div>
  );
}

function getEffectivePermissions(user: Pick<FamilyUser, 'role' | 'permissions'>) {
  if (user.role === 'owner') return ROLE_PERMISSIONS.owner;
  return ALL_FAMILY_PERMISSIONS.filter((permission) => user.permissions.includes(permission));
}

function draftFromUser(user: FamilyUser | null): MemberDraft {
  return {
    nickname: user?.nickname ?? '',
    staticId: user?.staticId ?? '',
    rankLevel: user?.rankLevel ?? 1,
    role: user?.role ?? 'member',
    joinedAt: user?.joinedAt ?? new Date().toISOString().slice(0, 10),
    accountStatus: user?.accountStatus ?? 'active',
    avatarDataUrl: user?.avatarDataUrl ?? user?.avatarUrl ?? '',
    permissions: user?.permissions ?? ROLE_PERMISSIONS.member,
    notes: user?.notes ?? '',
    discordUserId: user?.discordUserId ?? '',
    discordUsername: user?.discordUsername ?? ''
  };
}

function validateDraft(draft: MemberDraft, users: FamilyUser[], originalNickname: string | null) {
  const nickname = draft.nickname.trim();
  const staticId = draft.staticId.trim();
  if (!nickname) return 'Nickname обов’язковий';
  if (!staticId) return 'Static ID обов’язковий';
  if (
    users.some(
      (user) => user.nickname !== originalNickname && user.nickname.toLowerCase() === nickname.toLowerCase()
    )
  ) {
    return 'Nickname має бути унікальним';
  }
  if (users.some((user) => user.nickname !== originalNickname && user.staticId === staticId)) {
    return 'Static ID має бути унікальним';
  }
  return null;
}

function MemberEditorModal({
  mode,
  user,
  users,
  currentUser,
  onClose,
  onCreate,
  onUpdate,
  onDeactivate
}: {
  mode: 'create' | 'edit';
  user: FamilyUser | null;
  users: FamilyUser[];
  currentUser: FamilyUser;
  onClose: () => void;
  onCreate: (input: {
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
  onUpdate: (
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
  onDeactivate: (nickname: string) => void;
}) {
  const isProtectedOwner = user?.nickname === 'Anastasia_Dragons';
  const [draft, setDraft] = useState<MemberDraft>(() => draftFromUser(user));
  const [error, setError] = useState<string | null>(null);
  const effectiveRole = isProtectedOwner ? 'owner' : draft.role;
  const effectivePermissions =
    effectiveRole === 'owner' ? ROLE_PERMISSIONS.owner : draft.permissions;

  function togglePermission(permission: FamilyPermission) {
    setDraft((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission]
    }));
  }

  function save() {
    const validation = validateDraft(draft, users, user?.nickname ?? null);
    if (validation) {
      setError(validation);
      return;
    }
    const payload = {
      nickname: draft.nickname.trim(),
      staticId: draft.staticId.trim(),
      rankLevel: draft.rankLevel,
      role: effectiveRole,
      joinedAt: draft.joinedAt || null,
      accountStatus: isProtectedOwner ? ('active' as const) : draft.accountStatus,
      avatarDataUrl: draft.avatarDataUrl.trim() || null,
      permissions: effectivePermissions,
      notes: draft.notes.trim() || null,
      discordUserId: draft.discordUserId.trim() || null,
      discordUsername: draft.discordUsername.trim() || null
    };
    if (mode === 'create') {
      onCreate(payload);
    } else if (user) {
      onUpdate(user.nickname, payload);
    }
    onClose();
  }

  function deactivate() {
    if (!user || isProtectedOwner) return;
    if (!window.confirm(`Деактивувати ${user.nickname}? Історія квестів і бухгалтерії залишиться.`)) return;
    onDeactivate(user.nickname);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <section className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-red-950/80 bg-[#111111] p-5 shadow-2xl shadow-red-950/40">
        <div className="flex flex-col gap-3 border-b border-slate-800 pb-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">Member management</p>
            <h3 className="mt-1 text-xl font-semibold text-white">
              {mode === 'create' ? 'Додати учасника' : `Редагувати: ${user?.nickname}`}
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              Family rank і Hub role зберігаються окремо. Для нового учасника перший пароль дорівнює static ID.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
          >
            Закрити
          </button>
        </div>

        {isProtectedOwner ? (
          <div className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
            Anastasia_Dragons захищена від випадкового видалення або деактивації.
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-500/40 bg-rose-950/40 p-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm text-slate-300">
                Nickname
                <input
                  value={isProtectedOwner ? 'Anastasia_Dragons' : draft.nickname}
                  onChange={(event) => setDraft({ ...draft, nickname: event.target.value })}
                  disabled={isProtectedOwner}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 disabled:opacity-60"
                />
              </label>
              <label className="block text-sm text-slate-300">
                Static ID
                <input
                  value={draft.staticId}
                  onChange={(event) => setDraft({ ...draft, staticId: event.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm text-slate-300">
                Family rank
                <select
                  value={draft.rankLevel}
                  onChange={(event) => setDraft({ ...draft, rankLevel: Number(event.target.value) })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                >
                  {FAMILY_RANKS.map((rank) => (
                    <option key={rank.level} value={rank.level}>
                      {rank.level} - {rank.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm text-slate-300">
                Hub role
                <select
                  value={effectiveRole}
                  onChange={(event) => {
                    const role = event.target.value as FamilyRole;
                    setDraft({
                      ...draft,
                      role,
                      permissions: role === 'owner' ? ROLE_PERMISSIONS.owner : draft.permissions
                    });
                  }}
                  disabled={isProtectedOwner}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 disabled:opacity-60"
                >
                  {ROLE_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {FAMILY_ROLE_LABELS[item]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm text-slate-300">
                Дата вступу
                <input
                  type="date"
                  value={draft.joinedAt}
                  onChange={(event) => setDraft({ ...draft, joinedAt: event.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                />
              </label>
              <label className="block text-sm text-slate-300">
                Статус
                <select
                  value={isProtectedOwner ? 'active' : draft.accountStatus}
                  onChange={(event) =>
                    setDraft({ ...draft, accountStatus: event.target.value as 'active' | 'inactive' })
                  }
                  disabled={isProtectedOwner}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 disabled:opacity-60"
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </label>
            </div>

            <label className="block text-sm text-slate-300">
              Avatar URL/Data URL
              <input
                value={draft.avatarDataUrl}
                onChange={(event) => setDraft({ ...draft, avatarDataUrl: event.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              />
            </label>

            <label className="block text-sm text-slate-300">
              Notes
              <textarea
                value={draft.notes}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                rows={4}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm text-slate-300">
                Discord user ID
                <input
                  value={draft.discordUserId}
                  onChange={(event) => setDraft({ ...draft, discordUserId: event.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                />
              </label>
              <label className="block text-sm text-slate-300">
                Discord username
                <input
                  value={draft.discordUsername}
                  onChange={(event) => setDraft({ ...draft, discordUsername: event.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                />
              </label>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-black/30 p-3">
              <div className="text-sm font-semibold text-white">Поточні доступи</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {effectivePermissions.map((permission) => (
                  <span
                    key={permission}
                    className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-100"
                  >
                    {permission}
                  </span>
                ))}
                {!effectivePermissions.length ? (
                  <span className="text-sm text-slate-500">Немає виданих доступів</span>
                ) : null}
              </div>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-white">Permissions optional</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {ALL_FAMILY_PERMISSIONS.map((permission) => (
                <label
                  key={permission}
                  className="flex items-start gap-2 rounded-xl border border-slate-800 bg-black/25 p-3 text-sm text-slate-200"
                >
                  <input
                    type="checkbox"
                    checked={effectiveRole === 'owner' || draft.permissions.includes(permission)}
                    onChange={() => togglePermission(permission)}
                    disabled={effectiveRole === 'owner'}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-slate-100">{PERMISSION_LABELS[permission] ?? permission}</span>
                    <span className="block text-xs text-slate-500">{permission}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-800 pt-4">
          {mode === 'edit' && user && !isProtectedOwner ? (
            <button
              type="button"
              onClick={deactivate}
              className="rounded-xl border border-red-500/50 px-4 py-2 text-sm text-red-100 hover:bg-red-500/10"
            >
              Видалити / inactive
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-900"
          >
            Скасувати
          </button>
          <button
            type="button"
            onClick={save}
            className="dh-fire-button rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
          >
            Зберегти
          </button>
        </div>
      </section>
    </div>
  );
}

export function FamilyMembers({
  currentUser,
  users,
  onUserCreate,
  onUserProfileChange,
  onUserDeactivate,
  dataSourceMode = 'local'
}: {
  currentUser: FamilyUser;
  users: FamilyUser[];
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
  dataSourceMode?: 'local' | 'api';
}) {
  const [query, setQuery] = useState('');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [role, setRole] = useState<FamilyRole | 'all'>('all');
  const [rank, setRank] = useState('all');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('active');
  const [managedUser, setManagedUser] = useState<FamilyUser | null>(null);
  const [creating, setCreating] = useState(false);
  const canManage = hasFamilyPermission(currentUser, 'manage_users') || hasFamilyPermission(currentUser, 'manage_members');
  const canViewStatic = canManage;
  const canViewAvatars = currentUser.role === 'owner' || currentUser.role === 'deputy';
  const ranks = Array.from(new Set(users.map((user) => user.rank)));

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return users.filter((user) => {
      if (onlineOnly && !user.isOnline) return false;
      if (role !== 'all' && user.role !== role) return false;
      if (rank !== 'all' && user.rank !== rank) return false;
      if (status !== 'all' && (user.accountStatus ?? 'active') !== status) return false;
      return normalizedQuery ? user.nickname.toLowerCase().includes(normalizedQuery) : true;
    });
  }, [onlineOnly, query, rank, role, status, users]);

  return (
    <section className="rounded-2xl border border-red-950/70 bg-slate-950/75 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Учасники</h2>
          <p className="mt-1 text-sm text-slate-400">
            Список сім’ї з пошуком, ролями, сімейними рангами, статусом і доступами.
          </p>
        </div>
        <div className="inline-flex rounded-full border border-slate-700 bg-black/30 px-2.5 py-1 text-xs text-slate-300 lg:ml-auto">
          {dataSourceMode === 'api' ? 'Учасники: PostgreSQL API' : 'Учасники: локальне сховище'}
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="dh-fire-button rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
          >
            Додати учасника
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_180px_220px_150px_auto]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          placeholder="Пошук nickname"
        />
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as FamilyRole | 'all')}
          className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        >
          <option value="all">Усі ролі</option>
          {ROLE_OPTIONS.map((item) => (
            <option key={item} value={item}>
              {FAMILY_ROLE_LABELS[item]}
            </option>
          ))}
        </select>
        <select
          value={rank}
          onChange={(event) => setRank(event.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        >
          <option value="all">Усі ранги</option>
          {ranks.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as 'all' | 'active' | 'inactive')}
          className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        >
          <option value="active">active</option>
          <option value="inactive">inactive</option>
          <option value="all">усі</option>
        </select>
        <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={onlineOnly}
            onChange={(event) => setOnlineOnly(event.target.checked)}
          />
          online
        </label>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800">
        <div className="grid grid-cols-[1.4fr_0.8fr_1.2fr_0.7fr_0.8fr_0.8fr] bg-slate-900 px-3 py-2 text-xs uppercase tracking-wide text-slate-400">
          <div>Nickname</div>
          <div>Static ID</div>
          <div>Роль / ранг</div>
          <div>Status</div>
          <div>Progress</div>
          <div>Дії</div>
        </div>
        {filteredUsers.map((user) => (
          <div
            key={user.nickname}
            className="grid grid-cols-[1.4fr_0.8fr_1.2fr_0.7fr_0.8fr_0.8fr] border-t border-slate-800 px-3 py-3 text-sm"
          >
            <div className="flex items-center gap-3 font-medium text-white">
              {canViewAvatars ? <MemberAvatar user={user} /> : null}
              <span>{user.nickname}</span>
            </div>
            <div className="text-slate-300">{canViewStatic ? `#${user.staticId}` : 'приховано'}</div>
            <div>
              <div className="text-amber-100">{FAMILY_ROLE_LABELS[user.role]}</div>
              <div className="text-xs text-slate-500">{user.rank}</div>
            </div>
            <div className={(user.accountStatus ?? 'active') === 'inactive' ? 'text-rose-300' : user.isOnline ? 'text-emerald-300' : 'text-slate-500'}>
              {(user.accountStatus ?? 'active') === 'inactive' ? 'inactive' : user.isOnline ? 'online' : 'offline'}
            </div>
            <div className="text-amber-100">{user.promotionProgress}%</div>
            <div>
              {canManage ? (
                <button
                  type="button"
                  onClick={() => setManagedUser(user)}
                  className="rounded-lg border border-amber-500/50 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-500/10"
                >
                  Керувати
                </button>
              ) : (
                <span className="text-xs text-slate-600">-</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {creating ? (
        <MemberEditorModal
          mode="create"
          user={null}
          users={users}
          currentUser={currentUser}
          onClose={() => setCreating(false)}
          onCreate={onUserCreate}
          onUpdate={onUserProfileChange}
          onDeactivate={onUserDeactivate}
        />
      ) : null}

      {managedUser ? (
        <MemberEditorModal
          mode="edit"
          user={managedUser}
          users={users}
          currentUser={currentUser}
          onClose={() => setManagedUser(null)}
          onCreate={onUserCreate}
          onUpdate={onUserProfileChange}
          onDeactivate={onUserDeactivate}
        />
      ) : null}
    </section>
  );
}
