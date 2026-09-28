import { useEffect, useRef, useState } from 'react';
import { FAMILY_ROLE_LABELS } from '../../../lib/family-data';
import {
  FamilyMemberDirectoryError,
  type FamilyMemberDirectoryClient,
  type FamilyMemberPublicDetails,
} from '../../../lib/family-member-directory-client';
import type { FamilyUser } from '../../../lib/family-types';
import { DragonHouseCrest } from './dragon-house-crest';
import { FamilyMemberActivityPanel } from './family-member-activity-panel';

type DetailsState =
  | { status: 'loading'; member: FamilyMemberPublicDetails | null }
  | { status: 'ready'; member: FamilyMemberPublicDetails }
  | { status: 'forbidden'; message: string }
  | { status: 'not_found'; message: string }
  | { status: 'error'; message: string };

function valueOrEmpty(value: string | null | undefined, fallback = 'Немає даних') {
  return value?.trim() || fallback;
}

function formatJoinedDate(value: string | null): string {
  if (!value) return 'Дата вступу недоступна';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Дата вступу недоступна';
  return new Intl.DateTimeFormat('uk-UA', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

function PublicProfileField({
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

function PublicProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="dh-panel rounded-2xl p-5">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
}

function DetailsSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="dh-panel rounded-2xl p-5">
        <div className="flex gap-4">
          <div className="h-24 w-24 rounded-2xl bg-white/10" />
          <div className="flex-1 space-y-3">
            <div className="h-5 w-1/2 rounded bg-white/10" />
            <div className="h-4 w-1/3 rounded bg-white/5" />
            <div className="h-4 w-2/3 rounded bg-white/5" />
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="dh-panel rounded-2xl p-5">
            <div className="h-4 w-1/3 rounded bg-white/10" />
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="h-16 rounded-xl bg-white/5" />
              <div className="h-16 rounded-xl bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPanel({
  title,
  message,
  tone,
  onBack,
  onRetry,
}: {
  title: string;
  message: string;
  tone: 'amber' | 'rose';
  onBack: () => void;
  onRetry?: () => void;
}) {
  const toneClass = tone === 'amber' ? 'border-amber-500/30 text-amber-100' : 'border-rose-500/30 text-rose-100';
  return (
    <section className={`dh-panel rounded-2xl border p-5 ${toneClass}`} role="alert">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm">{message}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-slate-500 focus:outline-none focus:ring focus:ring-amber-500/30"
        >
          Назад до учасників
        </button>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-xl border border-rose-400/40 px-4 py-2 text-sm font-semibold text-rose-50 hover:bg-rose-500/10 focus:outline-none focus:ring focus:ring-rose-400/30"
          >
            Спробувати ще раз
          </button>
        ) : null}
      </div>
    </section>
  );
}

function MemberHeader({
  member,
  isOwnProfile,
  onOpenOwnProfile,
}: {
  member: FamilyMemberPublicDetails;
  isOwnProfile: boolean;
  onOpenOwnProfile: () => void;
}) {
  const avatarUrl = member.avatarUrl ?? member.discord.avatarUrl;
  const statusLabel = member.status === 'inactive' ? 'Неактивний' : 'Активний';
  return (
    <section className="dh-panel rounded-2xl p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-amber-500/30 bg-black/35">
            {avatarUrl ? (
              <img src={avatarUrl} alt={`Аватар ${member.displayName}`} className="h-full w-full object-cover" />
            ) : (
              <DragonHouseCrest slot="dragon_house_logo" size="sm" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">Публічний профіль учасника</p>
            <h1 className="mt-2 break-words text-2xl font-semibold text-white">{member.displayName}</h1>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-100">
                {FAMILY_ROLE_LABELS[member.role]}
              </span>
              <span className="rounded-full border border-slate-700 bg-black/25 px-2.5 py-1 text-slate-200">
                Ранг {member.rank.level}
              </span>
              {member.rank.title ? (
                <span className="rounded-full border border-slate-700 bg-black/25 px-2.5 py-1 text-slate-200">{member.rank.title}</span>
              ) : null}
              <span className={member.status === 'active' ? 'rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-200' : 'rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-200'}>
                {statusLabel}
              </span>
              <span className={member.discord.linked ? 'rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-200' : 'rounded-full border border-slate-700 bg-black/25 px-2.5 py-1 text-slate-400'}>
                {member.discord.linked ? 'Discord привʼязано' : 'Discord не привʼязано'}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-400">{formatJoinedDate(member.joinedAt)}</p>
          </div>
        </div>
        {isOwnProfile ? (
          <button
            type="button"
            onClick={onOpenOwnProfile}
            className="rounded-xl border border-amber-500/40 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/10 focus:outline-none focus:ring focus:ring-amber-500/30"
          >
            Відкрити мій повний профіль
          </button>
        ) : null}
      </div>
    </section>
  );
}

function LoadedDetails({
  member,
  currentUser,
  onOpenOwnProfile,
}: {
  member: FamilyMemberPublicDetails;
  currentUser: FamilyUser;
  onOpenOwnProfile: () => void;
}) {
  const isOwnProfile = currentUser.id === member.memberId;
  return (
    <div className="space-y-4" data-public-member-profile="safe">
      <MemberHeader member={member} isOwnProfile={isOwnProfile} onOpenOwnProfile={onOpenOwnProfile} />

      <div className="grid gap-4 lg:grid-cols-2">
        <PublicProfileSection title="Загальне">
          <PublicProfileField label="Імʼя" value={member.displayName} />
          <PublicProfileField label="Статус" value={member.status === 'inactive' ? 'Неактивний' : 'Активний'} muted={member.status === 'inactive'} />
          <PublicProfileField label="У сімʼї з" value={formatJoinedDate(member.joinedAt)} muted={!member.joinedAt} />
        </PublicProfileSection>

        <PublicProfileSection title="Discord">
          <PublicProfileField label="Привʼязка" value={member.discord.linked ? 'Привʼязано' : 'Не привʼязано'} muted={!member.discord.linked} />
          <PublicProfileField label="Імʼя Discord" value={valueOrEmpty(member.discord.displayName)} muted={!member.discord.displayName} />
          <PublicProfileField label="Нік на сервері" value={valueOrEmpty(member.discord.serverNickname)} muted={!member.discord.serverNickname} />
          <PublicProfileField label="Аватар Discord" value={member.discord.avatarUrl ? 'Є' : 'Немає'} muted={!member.discord.avatarUrl} />
        </PublicProfileSection>

        <PublicProfileSection title="Сімʼя">
          <PublicProfileField label="Роль" value={FAMILY_ROLE_LABELS[member.role]} />
          <PublicProfileField label="Рівень рангу" value={member.rank.level} />
          <PublicProfileField label="Назва рангу" value={valueOrEmpty(member.rank.title)} muted={!member.rank.title} />
        </PublicProfileSection>

        <section className="dh-panel rounded-2xl p-5">
          <h2 className="text-lg font-semibold text-white">Про учасника</h2>
          <p className={`mt-4 text-sm leading-6 ${member.profile.summary ? 'text-slate-200' : 'text-slate-500'}`}>
            {member.profile.summary ?? 'Публічного опису поки немає.'}
          </p>
        </section>
      </div>

      <section className="dh-panel rounded-2xl p-5">
        <h2 className="text-lg font-semibold text-white">Дані профілю</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {['Досягнення', 'Статистика', 'Остання активність'].map((section) => (
            <div key={section} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-500" aria-disabled="true">
              {section}
            </div>
          ))}
        </div>
      </section>

      <FamilyMemberActivityPanel memberId={member.memberId} />
    </div>
  );
}

export function FamilyMemberDetails({
  memberId,
  currentUser,
  client,
  onBack,
  onOpenOwnProfile,
}: {
  memberId: string;
  currentUser: FamilyUser;
  client: FamilyMemberDirectoryClient;
  onBack: () => void;
  onOpenOwnProfile: () => void;
}) {
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [state, setState] = useState<DetailsState>({ status: 'loading', member: null });
  const requestAbortRef = useRef<AbortController | null>(null);
  const requestSequenceRef = useRef(0);

  useEffect(() => {
    requestAbortRef.current?.abort();
    const controller = new AbortController();
    requestAbortRef.current = controller;
    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    setState((current) => ({ status: 'loading', member: 'member' in current ? current.member : null }));
    void client
      .getMember(memberId, controller.signal)
      .then((member) => {
        if (controller.signal.aborted || requestId !== requestSequenceRef.current) return;
        setState({ status: 'ready', member });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || requestId !== requestSequenceRef.current) return;
        if (error instanceof FamilyMemberDirectoryError && error.status === 403) {
          setState({ status: 'forbidden', message: 'Потрібні додаткові права, щоб переглядати неактивного учасника.' });
          return;
        }
        if (error instanceof FamilyMemberDirectoryError && error.status === 404) {
          setState({ status: 'not_found', message: 'Публічний профіль цього учасника не знайдено.' });
          return;
        }
        setState({ status: 'error', message: error instanceof Error ? error.message : 'Не вдалося завантажити профіль учасника.' });
      });
    return () => {
      if (requestAbortRef.current === controller) requestAbortRef.current = null;
      controller.abort();
    };
  }, [client, memberId, refreshNonce]);

  return (
    <section className="space-y-4" aria-labelledby="family-member-details-title">
      <div className="dh-panel flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">Dragon House</p>
          <h2 id="family-member-details-title" className="mt-1 text-xl font-semibold text-white">
            Дані учасника
          </h2>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-slate-500 focus:outline-none focus:ring focus:ring-amber-500/30"
        >
          Назад до учасників
        </button>
      </div>

      <div className="sr-only" aria-live="polite">
        {state.status === 'loading' ? 'Завантаження профілю учасника' : 'Профіль учасника завантажено'}
      </div>

      {state.status === 'loading' ? <DetailsSkeleton /> : null}
      {state.status === 'ready' ? (
        <LoadedDetails member={state.member} currentUser={currentUser} onOpenOwnProfile={onOpenOwnProfile} />
      ) : null}
      {state.status === 'forbidden' ? (
        <StatusPanel title="Потрібні додаткові права" message={state.message} tone="amber" onBack={onBack} />
      ) : null}
      {state.status === 'not_found' ? (
        <StatusPanel title="Учасника не знайдено" message={state.message} tone="amber" onBack={onBack} />
      ) : null}
      {state.status === 'error' ? (
        <StatusPanel
          title="Не вдалося завантажити учасника"
          message={state.message}
          tone="rose"
          onBack={onBack}
          onRetry={() => setRefreshNonce((current) => current + 1)}
        />
      ) : null}
    </section>
  );
}
