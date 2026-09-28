import { FAMILY_ROLE_LABELS } from '../../../lib/family-data';
import type { FamilyMemberDirectoryItem } from '../../../lib/family-member-directory-client';
import { DragonHouseCrest } from './dragon-house-crest';

function formatJoinedDate(value: string | null): string {
  if (!value) return 'Дата вступу недоступна';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Дата вступу недоступна';
  return new Intl.DateTimeFormat('uk-UA', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

function avatarLabel(member: FamilyMemberDirectoryItem): string {
  return `Аватар ${member.displayName}`;
}

export function FamilyMemberCard({
  member,
  onOpen,
}: {
  member: FamilyMemberDirectoryItem;
  onOpen: (member: FamilyMemberDirectoryItem) => void;
}) {
  const avatarUrl = member.avatarUrl ?? member.discord.avatarUrl;
  const statusLabel = member.status === 'inactive' ? 'Неактивний' : 'Активний';

  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onOpen(member);
  }

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`Відкрити профіль ${member.displayName}`}
      onClick={() => onOpen(member)}
      onKeyDown={handleKeyDown}
      className="dh-card flex h-full min-h-[252px] cursor-pointer flex-col gap-4 rounded-2xl p-4 outline-none transition hover:border-amber-500/40 focus-visible:ring focus-visible:ring-amber-500/40"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-amber-500/25 bg-black/35">
          {avatarUrl ? (
            <img src={avatarUrl} alt={avatarLabel(member)} className="h-full w-full object-cover" />
          ) : (
            <DragonHouseCrest slot="dragon_house_logo" size="sm" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-base font-semibold text-white">{member.displayName}</h3>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-100">
              {FAMILY_ROLE_LABELS[member.role]}
            </span>
            <span className="rounded-full border border-slate-700 bg-black/25 px-2.5 py-1 text-slate-200">
              Ранг {member.rank.level}
            </span>
          </div>
        </div>
      </div>

      <dl className="grid gap-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">Discord</dt>
          <dd className={member.discord.linked ? 'text-emerald-300' : 'text-slate-500'}>
            {member.discord.linked ? 'Привʼязано' : 'Не привʼязано'}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">Статус</dt>
          <dd className={member.status === 'active' ? 'text-emerald-300' : 'text-amber-300'}>{statusLabel}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">У сімʼї з</dt>
          <dd className="text-right text-slate-300">{formatJoinedDate(member.joinedAt)}</dd>
        </div>
      </dl>

      <div className="mt-auto rounded-xl border border-slate-700 bg-black/20 px-3 py-2 text-center text-sm font-semibold text-slate-200">
        Профіль
      </div>
    </article>
  );
}
