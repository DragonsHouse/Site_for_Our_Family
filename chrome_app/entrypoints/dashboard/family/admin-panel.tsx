import { FAMILY_ROLE_LABELS, type FamilyUser } from '../../../lib/family-auth';

function canManage(user: FamilyUser) {
  return user.role === 'owner' || user.role === 'deputy';
}

export function AdminPanel({ currentUser, users }: { currentUser: FamilyUser; users: FamilyUser[] }) {
  const visibleActions = canManage(currentUser);

  return (
    <article className="rounded-2xl border border-red-950/70 bg-slate-950/80 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Сімʼя Dragon House</h2>
          <p className="mt-1 text-sm text-slate-400">
            Ієрархія, ролі та статуси. Чорний список, каса, склад та історія сімʼї підготовлені як наступні секції.
          </p>
        </div>
        {visibleActions ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Доступні майбутні адмін-дії: учасники, ранги, задачі, ресурси.
          </div>
        ) : null}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
        <div className="grid grid-cols-[1.4fr_1fr_1fr_0.8fr] bg-slate-900 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          <div>Учасник</div>
          <div>Роль</div>
          <div>Ранг</div>
          <div>Статус</div>
        </div>
        {users.map((user) => (
          <div key={user.nickname} className="grid grid-cols-[1.4fr_1fr_1fr_0.8fr] border-t border-slate-800 px-3 py-3 text-sm">
            <div className="font-medium text-slate-100">{user.nickname}</div>
            <div className="text-amber-100">{FAMILY_ROLE_LABELS[user.role]}</div>
            <div className="text-slate-300">{user.rank}</div>
            <div className={user.isOnline ? 'text-emerald-300' : 'text-slate-500'}>
              {user.isOnline ? 'онлайн' : 'офлайн'}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
