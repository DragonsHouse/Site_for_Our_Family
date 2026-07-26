import { FAMILY_ROLE_LABELS } from '../../../lib/family-data';
import type { FamilyMemberDirectoryItem } from '../../../lib/family-member-directory-client';
import { DragonHouseCrest } from './dragon-house-crest';

function formatJoinedDate(value: string | null): string {
  if (!value) return 'Joined date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Joined date unavailable';
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

function avatarLabel(member: FamilyMemberDirectoryItem): string {
  return `${member.displayName} avatar`;
}

export function FamilyMemberCard({ member }: { member: FamilyMemberDirectoryItem }) {
  const avatarUrl = member.avatarUrl ?? member.discord.avatarUrl;
  const statusLabel = member.status === 'inactive' ? 'Inactive' : 'Active';

  return (
    <article className="dh-card flex h-full min-h-[252px] flex-col gap-4 rounded-2xl p-4">
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
              Rank {member.rank.level}
            </span>
          </div>
        </div>
      </div>

      <dl className="grid gap-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">Discord</dt>
          <dd className={member.discord.linked ? 'text-emerald-300' : 'text-slate-500'}>
            {member.discord.linked ? 'Linked' : 'Not linked'}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">Status</dt>
          <dd className={member.status === 'active' ? 'text-emerald-300' : 'text-amber-300'}>{statusLabel}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">Joined</dt>
          <dd className="text-right text-slate-300">{formatJoinedDate(member.joinedAt)}</dd>
        </div>
      </dl>

      <button
        type="button"
        disabled
        aria-label={`Member details for ${member.displayName} are coming soon`}
        className="mt-auto rounded-xl border border-slate-700 bg-black/20 px-3 py-2 text-sm text-slate-500 disabled:cursor-not-allowed"
      >
        Coming soon
      </button>
    </article>
  );
}
