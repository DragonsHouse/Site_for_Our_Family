import { FAMILY_ROLE_LABELS } from '../../../lib/family-data';
import type { FamilyUser } from '../../../lib/family-types';
import { DragonHouseCrest } from './dragon-house-crest';

const FUTURE_SECTIONS = ['Achievements', 'Statistics', 'Family History', 'Permissions', 'Recent Activity'];

function valueOrEmpty(value: string | null | undefined, fallback = 'Not available') {
  return value?.trim() || fallback;
}

function statusLabel(user: FamilyUser) {
  return user.accountStatus === 'inactive' || user.deletedAt ? 'Inactive' : 'Active';
}

function ProfileField({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className={`mt-1 break-words text-sm font-medium ${muted ? 'text-slate-500' : 'text-slate-100'}`}>{value}</div>
    </div>
  );
}

function ProfileSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="dh-panel rounded-2xl p-5">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
}

function AvatarBlock({ user }: { user: FamilyUser }) {
  const avatarUrl = user.discordAvatarUrl ?? user.avatarDataUrl ?? user.avatarUrl;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-red-950/70 bg-slate-950/75 p-5 sm:flex-row sm:items-center">
      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-amber-500/30 bg-black/35">
        {avatarUrl ? (
          <img src={avatarUrl} alt={user.displayName || user.nickname} className="h-full w-full object-cover" />
        ) : (
          <DragonHouseCrest slot="dragon_house_logo" size="sm" />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">Member Profile</p>
        <h1 className="mt-2 break-words text-2xl font-semibold text-white">{valueOrEmpty(user.displayName, user.nickname)}</h1>
        <p className="mt-1 text-sm text-slate-400">
          {FAMILY_ROLE_LABELS[user.role]} · {user.rank}
        </p>
      </div>
    </div>
  );
}

export function FamilyProfile({ user }: { user: FamilyUser }) {
  const discordLinked = user.discordLinkStatus === 'linked' || Boolean(user.discordUserId);
  const discordAvatar = user.discordAvatarUrl;
  const staticIdMissing = !user.staticId.trim();

  return (
    <div className="space-y-4" data-profile-member="authenticated">
      <AvatarBlock user={user} />

      <ProfileSection title="General">
        <ProfileField label="Display name" value={valueOrEmpty(user.displayName, user.nickname)} />
        <ProfileField label="Avatar" value={user.avatarUrl || user.avatarDataUrl ? 'Available' : 'Using Dragon House crest'} muted={!user.avatarUrl && !user.avatarDataUrl} />
        <ProfileField label="Member status" value={statusLabel(user)} muted={statusLabel(user) === 'Inactive'} />
        <ProfileField label="Onboarding" value={user.onboarding?.complete ? 'Complete' : 'Incomplete'} muted={!user.onboarding?.complete} />
      </ProfileSection>

      <ProfileSection title="Discord">
        <ProfileField label="Linked status" value={discordLinked ? 'Linked' : 'Not linked'} muted={!discordLinked} />
        <ProfileField label="Discord username" value={valueOrEmpty(user.discordUsername)} muted={!user.discordUsername} />
        <ProfileField label="Discord display name" value={valueOrEmpty(user.discordDisplayName)} muted={!user.discordDisplayName} />
        <ProfileField label="Discord server nickname" value={valueOrEmpty(user.discordServerNickname)} muted={!user.discordServerNickname} />
        <ProfileField label="Discord avatar" value={discordAvatar ? 'Available' : 'Not available'} muted={!discordAvatar} />
      </ProfileSection>

      <ProfileSection title="Family">
        <ProfileField label="Family role" value={FAMILY_ROLE_LABELS[user.role]} />
        <ProfileField label="Rank" value={`${user.rank} (${user.rankLevel})`} />
        <ProfileField label="Static ID" value={staticIdMissing ? 'Missing' : user.staticId} muted={staticIdMissing} />
        <ProfileField label="Account state" value={statusLabel(user)} muted={statusLabel(user) === 'Inactive'} />
      </ProfileSection>

      <details className="dh-panel rounded-2xl p-5">
        <summary className="cursor-pointer text-lg font-semibold text-white">Developer</summary>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <ProfileField label="Member ID" value={user.id} />
          <ProfileField label="Discord user ID" value={valueOrEmpty(user.discordUserId)} muted={!user.discordUserId} />
          <ProfileField label="External source" value={valueOrEmpty(user.externalSource)} />
          <ProfileField label="External ID" value={valueOrEmpty(user.externalId)} />
        </div>
      </details>

      <section className="dh-panel rounded-2xl p-5">
        <h2 className="text-lg font-semibold text-white">Future profile modules</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {FUTURE_SECTIONS.map((section) => (
            <div key={section} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-500" aria-disabled="true">
              {section}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
