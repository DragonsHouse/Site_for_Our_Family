import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  migrateDragonHouseAsyncData,
  migrateDragonHouseLocalData
} from '../../lib/family-data-migration';
import { createLoggedOutFamilyHubAuthState } from '../../lib/family-backend-current-user';
import {
  changePassword as changeBackendPassword,
  clearAuthSession,
  completeDiscordLogin,
  createAuthUser,
  loginWithDiscord,
  login as loginBackend,
  logout as logoutBackend,
  BirthdayValidationError,
  StaticIdValidationError,
  updateCurrentBirthday,
  updateCurrentStaticId
} from '../../lib/family-backend-auth-client';
import { AuthOutcomeError, normalizeAuthFailure } from '../../lib/family-outcome';
import {
  type FamilyHubAuthState,
  routeDiscordLoginFailure,
  routePasswordLoginFailure,
  routeRestoreFailure,
  stateForAuthenticatedUser,
} from '../../lib/family-onboarding-state';
import {
  createFamilyMemberDataSource,
  type FamilyMemberCreateInput,
  type FamilyMemberUpdateInput
} from '../../lib/family-member-data-source';
import { loadCurrentBackendFamilyUser, resolveBackendFamilyUser } from '../../lib/family-backend-user-session';
import { readFamilyPosts } from '../../lib/family-data';
import type { FamilyPermission, FamilyPost, FamilyRole, FamilySection, FamilyTab, FamilyUser } from '../../lib/family-types';
import { AuthStartupGate } from './auth/AuthStartupGate';
import { LoginForm } from './auth/LoginForm';
import { DragonHouseCrest } from './family/dragon-house-crest';
import { FamilyShell } from './family/family-shell';
import { validateDragonBirthdayValue } from './family/birthday-service';
import { DragonLoadingScreen } from './loading/DragonLoadingScreen';
import { useFamilyAssetUrl } from './family/use-family-asset-url';
import { useOnboardingAudio } from './hooks/use-onboarding-audio';

const FAMILY_TABS: FamilyTab[] = ['cabinet', 'members', 'profile', 'calendar', 'events', 'achievements', 'resources', 'family', 'buyers', 'map'];
const BIRTHDAY_MIN_DATE = '1970-01-01';
const BIRTHDAY_OPENING_SESSION_PREFIX = 'dragon_house_birthday_opening_seen:';
const FAMILY_SECTIONS: FamilySection[] = [
  'home',
  'feed',
  'economy',
  'members',
  'rules',
  'ranks',
  'recruitment',
  'quests',
  'accounting',
  'management'
];

function getInitialFamilyTab(): FamilyTab {
  const tab = new URL(window.location.href).searchParams.get('tab');
  return FAMILY_TABS.includes(tab as FamilyTab) ? (tab as FamilyTab) : 'cabinet';
}

function getInitialFamilySection(): FamilySection {
  const section = new URL(window.location.href).searchParams.get('section');
  return FAMILY_SECTIONS.includes(section as FamilySection) ? (section as FamilySection) : 'home';
}

function inputClassName() {
  return 'w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-slate-100 outline-none ring-orange-500/30 placeholder:text-slate-600 focus:ring';
}

function getTodayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function validateBirthdayInput(value: string) {
  const result = validateDragonBirthdayValue(value, getTodayDateOnly());
  if (result.valid) return null;
  if (result.code === 'required') return 'Вкажи дату народження, щоб завершити посвяту.';
  if (result.code === 'too_early') return 'Вкажи реальну дату народження не раніше 1970 року.';
  if (result.code === 'future') return 'Дата народження не може бути в майбутньому.';
  return 'Перевір дату — такого дня не існує.';
}

function birthdayErrorMessage(error: string | null) {
  if (!error) return null;
  if (/required|empty/u.test(error)) return 'Вкажи дату народження, щоб завершити посвяту.';
  if (/future/u.test(error)) return 'Дата народження не може бути в майбутньому.';
  if (/1970|too_early|early/u.test(error)) return 'Вкажи реальну дату народження не раніше 1970 року.';
  if (/invalid/u.test(error)) return 'Перевір дату — такого дня не існує.';
  return error;
}

function AuthShell({ children }: { children: React.ReactNode }) {
  const loginBackgroundUrl = useFamilyAssetUrl('login_background');

  return (
    <main className="dh-auth-shell">
      <div
        className="dh-auth-bg"
        style={{
          backgroundImage: `url('${loginBackgroundUrl}')`
        }}
        aria-hidden="true"
      />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 py-8">
        {children}
      </div>
    </main>
  );
}

function LoginScreen({
  error,
  loading,
  nickname,
  password,
  rememberMe,
  onNicknameChange,
  onPasswordChange,
  onRememberMeChange,
  onDiscordLogin,
  onSubmit
}: {
  error: string | null;
  loading: boolean;
  nickname: string;
  password: string;
  rememberMe: boolean;
  onNicknameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRememberMeChange: (value: boolean) => void;
  onDiscordLogin: () => void;
  onSubmit: () => void;
}) {
  return (
    <AuthShell>
      <LoginForm
        error={error}
        loading={loading}
        loginValue={nickname}
        password={password}
        rememberMe={rememberMe}
        onLoginChange={onNicknameChange}
        onPasswordChange={onPasswordChange}
        onRememberMeChange={onRememberMeChange}
        onDiscordLogin={onDiscordLogin}
        onSubmit={onSubmit}
      />
    </AuthShell>
  );
}

function ChangePasswordScreen({
  user,
  error,
  loading,
  newPassword,
  confirmPassword,
  currentPassword,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onCurrentPasswordChange,
  onSubmit
}: {
  user: FamilyUser;
  error: string | null;
  loading: boolean;
  newPassword: string;
  confirmPassword: string;
  currentPassword: string;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onCurrentPasswordChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <AuthShell>
      <section className="dh-auth-card w-full max-w-md rounded-3xl p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
          Перший вхід
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Зміна тимчасового пароля</h1>
        <p className="mt-2 text-sm text-slate-400">
          {user.nickname}, static ID прийнято. Створи особистий локальний пароль, щоб продовжити.
        </p>

        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Поточний пароль / static ID</span>
            <input
              className={inputClassName()}
              type="password"
              value={currentPassword}
              onChange={(event) => onCurrentPasswordChange(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Новий пароль</span>
            <input
              className={inputClassName()}
              type="password"
              value={newPassword}
              onChange={(event) => onNewPasswordChange(event.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Повтори пароль</span>
            <input
              className={inputClassName()}
              type="password"
              value={confirmPassword}
              onChange={(event) => onConfirmPasswordChange(event.target.value)}
              autoComplete="new-password"
            />
          </label>

          {error ? (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || !currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()}
            className="w-full rounded-xl bg-gradient-to-r from-red-700 to-amber-500 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Зберігаю...' : 'Зберегти пароль'}
          </button>
        </form>
      </section>
    </AuthShell>
  );
}

function StaticIdOnboardingScreen({
  user,
  value,
  error,
  loading,
  onChange,
  onSubmit,
}: {
  user: FamilyUser;
  value: string;
  error: string | null;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <AuthShell>
      <section className="dh-auth-card w-full max-w-md rounded-3xl p-6">
        <div className="mx-auto flex justify-center">
          <DragonHouseCrest slot="dragon_house_logo" size="lg" />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">DRAGON HOUSE HUB</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Welcome to Dragon House Hub</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {user.displayName}, заверши коротку перевірку профілю, щоб відкрити Hub.
        </p>

        <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm">
          <div className="flex items-center justify-between gap-3 text-slate-200">
            <span>Discord linked</span>
            <span className="font-semibold text-emerald-300">✓</span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-slate-200">
            <span>Static ID missing</span>
            <span className="font-semibold text-rose-300">✕</span>
          </div>
        </div>

        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Static ID</span>
            <input
              className={inputClassName()}
              type="text"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              autoComplete="off"
              maxLength={80}
            />
          </label>

          {error ? (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || !value.trim()}
            className="w-full rounded-xl bg-gradient-to-r from-red-700 to-amber-500 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Static ID'}
          </button>
        </form>
      </section>
    </AuthShell>
  );
}

function BirthdayOnboardingScreen({
  user,
  value,
  error,
  loading,
  legacyAccessAllowed,
  onChange,
  onSubmit,
  onContinue,
}: {
  user: FamilyUser;
  value: string;
  error: string | null;
  loading: boolean;
  legacyAccessAllowed: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onContinue: () => void;
}) {
  const audio = useOnboardingAudio();
  const maxDate = useMemo(getTodayDateOnly, []);
  const inputError = validateBirthdayInput(value);
  const visibleError = birthdayErrorMessage(error) ?? (value ? inputError : 'Вкажи дату народження, щоб завершити посвяту.');
  const canSubmit = !loading && !inputError;
  const openingSessionKey = `${BIRTHDAY_OPENING_SESSION_PREFIX}${user.id}`;
  const [openingActive, setOpeningActive] = useState(() => {
    if (prefersReducedMotion()) return false;
    try {
      return window.sessionStorage.getItem(openingSessionKey) !== 'true';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!openingActive) return undefined;
    const timer = window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(openingSessionKey, 'true');
      } catch {
        // Session storage is optional; the sequence is decorative.
      }
      setOpeningActive(false);
    }, 1900);
    return () => window.clearTimeout(timer);
  }, [openingActive, openingSessionKey]);

  function skipOpening() {
    try {
      window.sessionStorage.setItem(openingSessionKey, 'true');
    } catch {
      // Session storage is optional; the sequence is decorative.
    }
    setOpeningActive(false);
  }

  return (
    <main className="dh-initiation-scene">
      <div className="dh-initiation-fortress" aria-hidden="true" />
      <div className="dh-initiation-dragon" aria-hidden="true">
        <span className="dh-dragon-eye left" />
        <span className="dh-dragon-eye right" />
      </div>
      <div className="dh-initiation-smoke" aria-hidden="true" />
      <div className="dh-initiation-floating-embers" aria-hidden="true" />

      {openingActive ? (
        <section className="dh-opening-ritual" aria-live="polite" aria-label="Початок посвяти Dragon House">
          <div className="dh-opening-crest">
            <DragonHouseCrest slot="dragon_house_logo" size="lg" />
          </div>
          <p>Полум’я впізнало тебе...</p>
          <button type="button" className="dh-opening-skip" onClick={skipOpening}>
            Пропустити
          </button>
        </section>
      ) : null}

      <div className={`dh-initiation-stage ${openingActive ? 'is-opening' : 'is-revealed'}`}>
        <section className="dh-initiation-card" aria-labelledby="birthday-initiation-heading">
          <div className="dh-initiation-embers" aria-hidden="true" />
          <div className="dh-initiation-card-ornament" aria-hidden="true" />
          <div className="dh-initiation-topbar">
            <div className="dh-initiation-title-lockup">
              <div className="dh-initiation-crest">
                <DragonHouseCrest slot="dragon_house_logo" size="lg" />
              </div>
              <div>
                <p className="dh-initiation-eyebrow">ОСТАННІЙ ЕТАП ПОСВЯТИ</p>
                <h1 id="birthday-initiation-heading">Полум’я чекає на останню печать</h1>
              </div>
            </div>
            <button
              type="button"
              className="dh-initiation-sound"
              aria-pressed={audio.enabled && audio.state === 'playing'}
              aria-label={audio.enabled && audio.state === 'playing' ? 'Вимкнути звук посвяти' : 'Увімкнути звук посвяти'}
              onClick={() => {
                if (audio.enabled && audio.state === 'playing') {
                  audio.toggle();
                  return;
                }
                if (!audio.enabled) {
                  audio.enableAndStart();
                  return;
                }
                audio.start();
              }}
            >
              <span aria-hidden="true">{audio.enabled && audio.state === 'playing' ? '♪' : '×'}</span>
              <span className="dh-sound-label">Звук посвяти</span>
              <span>{audio.enabled && audio.state === 'playing' ? 'Вимкнути звук' : 'Увімкнути звук'}</span>
            </button>
          </div>

          <p className="dh-initiation-personal">
            {user.displayName}, вкажи дату народження, щоб твоє ім’я з’явилося у сімейному календарі Dragon House.
          </p>

          <div className="dh-initiation-progress" aria-label="Прогрес посвяти">
            <InitiationStep label="Discord" status="complete" detail="Discord підтверджено" />
            <InitiationStep label="Static ID" status="complete" detail="Static ID прийнято" />
            <InitiationStep label="Дата народження" status={value.trim() ? 'ready' : 'current'} detail="Дата народження — остання печать" />
          </div>

          <form
            className="dh-initiation-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canSubmit) return;
              audio.start();
              onSubmit();
            }}
          >
            <label className="dh-initiation-date" htmlFor="birthday-date-input">
              <span className="dh-date-label">Дата народження</span>
              <span className="dh-date-helper">
                Дата народження потрібна для сімейного календаря. Іншим учасникам буде видно лише день і місяць. Рік народження та вік не публікуються без окремого дозволу.
              </span>
              <span className="dh-date-input-frame">
                <span className="dh-date-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M7.5 3.5v3M16.5 3.5v3M4 9h16M6.5 5.5h11A2.5 2.5 0 0 1 20 8v9.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5V8a2.5 2.5 0 0 1 2.5-2.5Z" />
                    <path d="M8 13h.01M12 13h.01M16 13h.01M8 16.5h.01M12 16.5h.01" />
                  </svg>
                </span>
                <input
                  id="birthday-date-input"
                  type="date"
                  value={value}
                  onChange={(event) => onChange(event.target.value)}
                  autoComplete="bday"
                  min={BIRTHDAY_MIN_DATE}
                  max={maxDate}
                  aria-describedby="birthday-date-help birthday-date-error"
                  aria-invalid={Boolean(visibleError)}
                />
              </span>
            </label>

            <p id="birthday-date-help" className="dh-date-microcopy">
              Формат зберігається як календарна дата без зміщення часового поясу.
            </p>

            <div id="birthday-date-error" className={visibleError ? 'dh-initiation-error' : 'dh-initiation-hint'} aria-live="polite">
              {visibleError ?? 'Дата готова до печаті.'}
            </div>

            <button type="submit" disabled={!canSubmit} className="dh-initiation-primary">
              {loading ? 'Запалюємо печать...' : 'Завершити посвяту'}
            </button>
            {legacyAccessAllowed ? (
              <button type="button" className="dh-initiation-secondary" onClick={onContinue}>
                Увійти до Hub пізніше
              </button>
            ) : null}
          </form>

          <div className="dh-initiation-statusbar" aria-label="Стан посвяти">
            <span>Звук посвяти: {audio.enabled ? 'доступний після взаємодії' : 'вимкнено'}</span>
            <span>Захищене з’єднання</span>
            <span>Dragon House Family</span>
          </div>
        </section>
      </div>
    </main>
  );
}

function InitiationStep({ label, status, detail }: { label: string; status: 'complete' | 'current' | 'ready'; detail: string }) {
  const isComplete = status === 'complete';
  return (
    <div className={`dh-initiation-step ${status}`}>
      <span className="dh-initiation-step-icon" aria-hidden="true">{isComplete ? '✓' : '◆'}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-stone-100">{label}</span>
        <span className="block text-xs uppercase tracking-[0.18em] text-stone-500">
          {status === 'current' ? 'останній крок' : detail}
        </span>
      </span>
    </div>
  );
}

function BirthdaySuccessScreen({ user, onComplete }: { user: FamilyUser; onComplete: () => void }) {
  const audio = useOnboardingAudio();

  useEffect(() => {
    audio.playConfirmation();
    if (prefersReducedMotion()) {
      onComplete();
      return undefined;
    }
    const timer = window.setTimeout(onComplete, 1700);
    return () => window.clearTimeout(timer);
  }, [audio.playConfirmation, onComplete]);

  return (
    <main className="dh-initiation-scene dh-initiation-success-scene">
      <div className="dh-initiation-fortress" aria-hidden="true" />
      <div className="dh-initiation-dragon" aria-hidden="true" />
      <div className="dh-initiation-smoke" aria-hidden="true" />
      <section className="dh-initiation-success" aria-live="polite" aria-labelledby="birthday-success-heading">
        <div className="dh-success-seal">
          <DragonHouseCrest slot="dragon_house_logo" size="lg" />
        </div>
        <p className="dh-initiation-eyebrow">Dragon House Family</p>
        <h1 id="birthday-success-heading">Посвяту завершено</h1>
        <p>{user.displayName}, Dragon House приймає тебе до свого полум’я.</p>
      </section>
    </main>
  );
}
function OAuthLoadingScreen() {
  return (
    <AuthShell>
      <section className="dh-auth-card w-full max-w-md rounded-3xl p-6 text-center">
        <div className="mx-auto flex justify-center">
          <DragonHouseCrest slot="dragon_house_logo" size="lg" />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">Discord Login</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Відкриваємо ворота Dragon House…</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Перевіряємо твій Discord і шукаємо тебе серед наших.
        </p>
      </section>
    </AuthShell>
  );
}

function OAuthSuccessScreen({ user, onEnter }: { user: FamilyUser; onEnter: () => void }) {
  const isElevated = user.role === 'owner' || user.role === 'deputy' || user.role === 'moderator';
  const avatarUrl = user.discordAvatarUrl ?? user.avatarDataUrl ?? user.avatarUrl;

  return (
    <AuthShell>
      <section className="dh-auth-card w-full max-w-md rounded-3xl p-6 text-center">
        <div className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border border-amber-500/35 bg-black/40">
          {avatarUrl ? (
            <img src={avatarUrl} alt={user.nickname} className="h-full w-full object-cover" />
          ) : (
            <DragonHouseCrest slot="dragon_house_logo" size="sm" />
          )}
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">Discord підтверджено</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Вітаємо вдома, {user.nickname}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Твій Discord підтверджено. Доступ до Family Hub відкрито.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
          <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-1 text-amber-100">
            Ранг {user.rankLevel}
          </span>
          <span className="rounded-full border border-slate-600 bg-black/30 px-3 py-1 text-slate-200">{user.rank}</span>
          {isElevated ? (
            <span className="rounded-full border border-emerald-400/35 bg-emerald-500/10 px-3 py-1 text-emerald-100">
              доступ хранителя
            </span>
          ) : null}
        </div>
        <button type="button" className="dh-login-submit mt-6 min-w-44 whitespace-nowrap px-6" onClick={onEnter}>
          Увійти до лігва
        </button>
      </section>
    </AuthShell>
  );
}

function AuthOutcomeScreen({
  title,
  message,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  title: string;
  message: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <AuthShell>
      <section className="dh-auth-card w-full max-w-md rounded-3xl p-6 text-center">
        <div className="mx-auto flex justify-center">
          <DragonHouseCrest slot="dragon_house_logo" size="lg" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-white">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">{message}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button type="button" className="dh-login-submit min-w-40 px-5" onClick={onPrimary}>
            {primaryLabel}
          </button>
          {secondaryLabel && onSecondary ? (
            <button
              type="button"
              className="rounded-xl border border-slate-700 bg-black/25 px-5 py-3 text-sm font-semibold text-slate-100 hover:border-slate-500 focus:outline-none focus:ring focus:ring-amber-500/30"
              onClick={onSecondary}
            >
              {secondaryLabel}
            </button>
          ) : null}
        </div>
      </section>
    </AuthShell>
  );
}

export function FamilyHubApp() {
  migrateDragonHouseLocalData();

  const [currentUser, setCurrentUser] = useState<FamilyUser | null>(null);
  const memberDataSource = useMemo(() => createFamilyMemberDataSource(), []);
  const [familyUsers, setFamilyUsers] = useState<FamilyUser[]>([]);
  const [posts, setPosts] = useState<FamilyPost[]>(() => readFamilyPosts());
  const [authState, setAuthState] = useState<FamilyHubAuthState>({ status: 'checking' });
  const [activeTab, setActiveTab] = useState<FamilyTab>(() => getInitialFamilyTab());
  const [initialSection] = useState<FamilySection>(() => getInitialFamilySection());
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [staticIdDraft, setStaticIdDraft] = useState('');
  const [birthdayDraft, setBirthdayDraft] = useState('');
  const [birthdaySuccessUser, setBirthdaySuccessUser] = useState<FamilyUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const authCheckStartedRef = useRef(false);
  const discordLoginInFlightRef = useRef(false);
  const birthdaySubmitInFlightRef = useRef(false);

  async function refreshFamilyUsers() {
    const users = await memberDataSource.listMembers();
    setFamilyUsers(users);
    return users;
  }

  useEffect(() => {
    void migrateDragonHouseAsyncData().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (authCheckStartedRef.current) return;
    authCheckStartedRef.current = true;

    const completionCode = new URL(window.location.href).searchParams.get('completionCode');
    const loginStatus = new URL(window.location.href).searchParams.get('discordLoginStatus');
    const loginError = new URL(window.location.href).searchParams.get('error');

    if (completionCode) {
      setAuthState({ status: 'oauth_loading' });
      void completeDiscordLogin(completionCode)
        .then(async (result) => {
          window.history.replaceState(null, document.title, window.location.pathname);
          const user = resolveBackendFamilyUser(result.user);
          setCurrentUser(user);
          setStaticIdDraft(user.onboarding?.requirements.staticId.value ?? '');
          void refreshFamilyUsers().catch(() => setFamilyUsers([user]));
          setAuthState(stateForAuthenticatedUser(user, 'discord'));
        })
        .catch((err) => {
          window.history.replaceState(null, document.title, window.location.pathname);
          setCurrentUser(null);
          const route = routeDiscordLoginFailure(err);
          if (route.kind === 'inline_error') {
            setError(route.message);
            setAuthState({ status: 'unauthenticated', message: route.message });
          } else {
            setError(null);
            setAuthState(route.state);
          }
        });
      return;
    }

    if (loginStatus === 'error') {
      window.history.replaceState(null, document.title, window.location.pathname);
      const route = routeDiscordLoginFailure(new AuthOutcomeError(normalizeAuthFailure(null, { error: loginError ?? 'OAUTH_STATE_INVALID' })));
      if (route.kind === 'inline_error') {
        setError(route.message);
        setAuthState({ status: 'unauthenticated', message: route.message });
      } else {
        setError(null);
        setAuthState(route.state);
      }
      return;
    }

    void restoreStoredSession();
  }, []);

  async function restoreStoredSession() {
    setAuthState({ status: 'checking' });
    try {
      const user = await loadCurrentBackendFamilyUser();
      setCurrentUser(user);
      setStaticIdDraft(user.onboarding?.requirements.staticId.value ?? '');
      void refreshFamilyUsers().catch(() => setFamilyUsers([user]));
      setAuthState(stateForAuthenticatedUser(user, 'restore'));
    } catch (err) {
      const route = routeRestoreFailure(err);
      if (route.clearAuthSession) await clearAuthSession().catch(() => undefined);
      setCurrentUser(null);
      setAuthState(route.state);
    }
  }

  async function handleLogin() {
    setLoading(true);
    setError(null);
    setAuthState({ status: 'authenticating' });
    try {
      const result = await loginBackend(nickname, password, rememberMe);
      const user = resolveBackendFamilyUser(result.user);
      setCurrentUser(user);
      await refreshFamilyUsers().catch(() => setFamilyUsers([user]));
      setPosts(readFamilyPosts());
      setCurrentPassword(user.mustChangePassword ? password : '');
      setStaticIdDraft(user.onboarding?.requirements.staticId.value ?? '');
      setPassword('');
      setAuthState(stateForAuthenticatedUser(user, 'login'));
    } catch (err) {
      const route = routePasswordLoginFailure(err);
      if (route.kind === 'inline_error') {
        setError(route.message);
        setAuthState({ status: 'unauthenticated', message: route.message });
      } else {
        setError(null);
        setAuthState(route.state);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePassword() {
    if (!currentUser) return;
    if (newPassword !== confirmPassword) {
      setError('Паролі не збігаються');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const user = resolveBackendFamilyUser(await changeBackendPassword(currentPassword, newPassword));
      setCurrentUser(user);
      await refreshFamilyUsers().catch(() => setFamilyUsers([user]));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setAuthState(stateForAuthenticatedUser(user, 'password-change'));
    } catch (err) {
      const route = routePasswordLoginFailure(err);
      if (route.kind === 'inline_error') {
        setError(route.message);
      } else {
        setError(null);
        setAuthState(route.state);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    void logoutBackend()
      .catch(() => clearAuthSession())
      .catch(() => undefined);
    const loggedOutState = createLoggedOutFamilyHubAuthState();
    setCurrentUser(loggedOutState.currentUser);
    setFamilyUsers(loggedOutState.familyUsers);
    setNickname('');
    setPassword('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setStaticIdDraft('');
    setBirthdayDraft('');
    setError(null);
    setActiveTab('cabinet');
    setAuthState({ status: 'unauthenticated' });
  }

  async function reloadAuthenticatedUser() {
    try {
      const user = await loadCurrentBackendFamilyUser();
      setCurrentUser(user);
      setStaticIdDraft(user.onboarding?.requirements.staticId.value ?? '');
      setAuthState(stateForAuthenticatedUser(user, 'restore'));
      return user;
    } catch (err) {
      const route = routeRestoreFailure(err);
      if (route.clearAuthSession) await clearAuthSession().catch(() => undefined);
      setCurrentUser(null);
      setAuthState(route.state);
      return null;
    }
  }

  async function handleDiscordLogin() {
    if (discordLoginInFlightRef.current) return;
    discordLoginInFlightRef.current = true;
    setLoading(true);
    setError(null);
    try {
      setAuthState({ status: 'oauth_loading' });
      const result = await loginWithDiscord();
      const user = resolveBackendFamilyUser(result.user);
      setCurrentUser(user);
      setStaticIdDraft(user.onboarding?.requirements.staticId.value ?? '');
      await refreshFamilyUsers().catch(() => setFamilyUsers([user]));
      setPosts(readFamilyPosts());
      setAuthState(stateForAuthenticatedUser(user, 'discord'));
    } catch (err) {
      const route = routeDiscordLoginFailure(err);
      if (route.kind === 'inline_error') {
        setError(route.message);
        setAuthState({ status: 'unauthenticated', message: route.message });
      } else {
        setError(null);
        setAuthState(route.state);
      }
    } finally {
      discordLoginInFlightRef.current = false;
      setLoading(false);
    }
  }

  async function handleStaticIdSubmit() {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const user = resolveBackendFamilyUser(await updateCurrentStaticId(staticIdDraft));
      setCurrentUser(user);
      setStaticIdDraft(user.onboarding?.requirements.staticId.value ?? user.staticId);
      await refreshFamilyUsers().catch(() => setFamilyUsers([user]));
      setAuthState(stateForAuthenticatedUser(user, 'restore'));
    } catch (err) {
      if (err instanceof StaticIdValidationError) {
        setError(err.fields.staticId ?? err.message);
        return;
      }
      const route = routeRestoreFailure(err);
      if (route.clearAuthSession) await clearAuthSession().catch(() => undefined);
      setAuthState(route.state);
    } finally {
      setLoading(false);
    }
  }

  async function handleBirthdaySubmit() {
    if (!currentUser) return;
    if (birthdaySubmitInFlightRef.current) return;
    const validationError = validateBirthdayInput(birthdayDraft);
    if (validationError) {
      setError(validationError);
      return;
    }
    birthdaySubmitInFlightRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const user = resolveBackendFamilyUser(await updateCurrentBirthday(birthdayDraft));
      setCurrentUser(user);
      setBirthdayDraft('');
      await refreshFamilyUsers().catch(() => setFamilyUsers([user]));
      if (prefersReducedMotion()) {
        setAuthState(stateForAuthenticatedUser(user, 'restore'));
      } else {
        setBirthdaySuccessUser(user);
      }
    } catch (err) {
      if (err instanceof BirthdayValidationError) {
        setError(err.fields.dateOfBirth ?? err.message);
        return;
      }
      const route = routeRestoreFailure(err);
      if (route.clearAuthSession) await clearAuthSession().catch(() => undefined);
      setAuthState(route.state);
    } finally {
      birthdaySubmitInFlightRef.current = false;
      setLoading(false);
    }
  }

  function handleAvatarChange(avatarDataUrl: string | null) {
    if (!currentUser) return;
    void memberDataSource
      .updateMember(currentUser.nickname, {
        nickname: currentUser.nickname,
        staticId: currentUser.staticId,
        rankLevel: currentUser.rankLevel,
        role: currentUser.role,
        joinedAt: currentUser.joinedAt,
        accountStatus: currentUser.accountStatus,
        avatarDataUrl,
        permissions: currentUser.permissions,
        notes: currentUser.notes
      })
      .then(() => {
        void reloadAuthenticatedUser();
        return refreshFamilyUsers();
      })
      .catch(() => undefined);
  }

  function handleUserAccessChange(
    nickname: string,
    updates: {
      role: FamilyRole;
      rank: string;
      rankLevel: number;
      permissions: FamilyPermission[];
    }
  ) {
    const existing = familyUsers.find((user) => user.nickname === nickname);
    if (!existing) return;
    void memberDataSource
      .updateMember(nickname, {
        nickname: existing.nickname,
        staticId: existing.staticId,
        rankLevel: updates.rankLevel,
        role: updates.role,
        joinedAt: existing.joinedAt,
        accountStatus: existing.accountStatus,
        avatarDataUrl: existing.avatarDataUrl,
        permissions: updates.permissions,
        notes: existing.notes
      })
      .then(() => {
        if (currentUser?.nickname === nickname) {
          void reloadAuthenticatedUser();
        }
        return refreshFamilyUsers();
      })
      .catch(() => undefined);
  }

  async function handleUserCreate(input: FamilyMemberCreateInput) {
    const user = await memberDataSource.createMember(input);
    await createAuthUser({
      familyMemberId: user.id,
      login: user.nickname,
      staticId: user.staticId,
      role: user.role,
      rank: user.rankLevel,
      permissions: user.permissions,
      isActive: user.accountStatus === 'active'
    });
    await refreshFamilyUsers();
  }

  async function handleUserProfileChange(
    originalNickname: string,
    updates: FamilyMemberUpdateInput
  ) {
    await memberDataSource.updateMember(originalNickname, updates);
    if (currentUser?.nickname === originalNickname) {
      await reloadAuthenticatedUser();
    }
    await refreshFamilyUsers();
  }

  async function handleUserDeactivate(nickname: string) {
    await memberDataSource.deleteMember(nickname);
    if (currentUser?.nickname === nickname) {
      await clearAuthSession().catch(() => undefined);
      setCurrentUser(null);
      setAuthState({ status: 'unauthenticated' });
    }
    await refreshFamilyUsers();
  }

  function returnToLogin() {
    setCurrentUser(null);
    setError(null);
    setPassword('');
    setStaticIdDraft('');
    setAuthState({ status: 'unauthenticated' });
  }

  function retryAuthUnavailable() {
    if (authState.status !== 'auth_unavailable') return;
    if (authState.retryTarget === 'restore') {
      void restoreStoredSession();
      return;
    }
    if (authState.retryTarget === 'discord') {
      void handleDiscordLogin();
      return;
    }
    setAuthState({ status: 'unauthenticated' });
  }

  const completeBirthdaySuccess = useCallback(() => {
    if (!birthdaySuccessUser) return;
    setBirthdaySuccessUser(null);
    setAuthState(stateForAuthenticatedUser(birthdaySuccessUser, 'restore'));
  }, [birthdaySuccessUser]);

  if (authState.status === 'unauthenticated' || authState.status === 'authenticating') {
    return (
      <LoginScreen
        error={error}
        loading={loading || authState.status === 'authenticating'}
        nickname={nickname}
        password={password}
        rememberMe={rememberMe}
        onNicknameChange={setNickname}
        onPasswordChange={setPassword}
        onRememberMeChange={setRememberMe}
        onDiscordLogin={() => void handleDiscordLogin()}
        onSubmit={() => void handleLogin()}
      />
    );
  }

  if (authState.status === 'checking') {
    return (
      <AuthShell>
        <AuthStartupGate />
      </AuthShell>
    );
  }

  if (authState.status === 'change_password_required' && currentUser) {
    return (
      <ChangePasswordScreen
        user={currentUser}
        error={error}
        loading={loading}
        newPassword={newPassword}
        confirmPassword={confirmPassword}
        currentPassword={currentPassword}
        onNewPasswordChange={setNewPassword}
        onConfirmPasswordChange={setConfirmPassword}
        onCurrentPasswordChange={setCurrentPassword}
        onSubmit={() => void handleChangePassword()}
      />
    );
  }

  if (authState.status === 'change_password_required') {
    return (
      <AuthOutcomeScreen
        title="Потрібно змінити пароль"
        message={authState.message ?? 'Увійди знову, щоб безпечно змінити тимчасовий пароль.'}
        primaryLabel="Повернутися до входу"
        onPrimary={returnToLogin}
      />
    );
  }

  if (authState.status === 'oauth_loading') {
    return <OAuthLoadingScreen />;
  }

  if (authState.status === 'oauth_success' && currentUser) {
    return <OAuthSuccessScreen user={currentUser} onEnter={() => setAuthState({ status: 'authenticated', user: currentUser })} />;
  }

  if (authState.status === 'loading' && currentUser) {
    return <DragonLoadingScreen active={true} onComplete={() => setAuthState({ status: 'authenticated', user: currentUser })} />;
  }

  if (authState.status === 'session_expired') {
    return (
      <AuthOutcomeScreen
        title="Сесія завершилась"
        message="Твій попередній вхід більше не активний. Увійди знову, щоб повернутися до Family Hub."
        primaryLabel="Увійти знову"
        onPrimary={() => {
          void clearAuthSession().finally(returnToLogin);
        }}
      />
    );
  }

  if (authState.status === 'discord_link_required') {
    return (
      <AuthOutcomeScreen
        title="Discord не прив’язаний для входу"
        message="Цей Discord акаунт не має активної прив’язки для входу у Family Hub. Можеш увійти через Static ID/password або звернутися до адміністратора."
        primaryLabel="Увійти через Static ID"
        onPrimary={returnToLogin}
        secondaryLabel="Спробувати Discord ще раз"
        onSecondary={() => void handleDiscordLogin()}
      />
    );
  }

  if (authState.status === 'static_id_required' && currentUser) {
    return (
      <StaticIdOnboardingScreen
        user={currentUser}
        value={staticIdDraft}
        error={error}
        loading={loading}
        onChange={setStaticIdDraft}
        onSubmit={() => void handleStaticIdSubmit()}
      />
    );
  }

  if (birthdaySuccessUser) {
    return <BirthdaySuccessScreen user={birthdaySuccessUser} onComplete={completeBirthdaySuccess} />;
  }

  if (authState.status === 'birthday_required' && currentUser) {
    return (
      <BirthdayOnboardingScreen
        user={currentUser}
        value={birthdayDraft}
        error={error}
        loading={loading}
        legacyAccessAllowed={authState.legacyAccessAllowed}
        onChange={setBirthdayDraft}
        onSubmit={() => void handleBirthdaySubmit()}
        onContinue={() => setAuthState({ status: 'authenticated', user: currentUser })}
      />
    );
  }

  if (authState.status === 'account_deactivated') {
    return (
      <AuthOutcomeScreen
        title="Доступ вимкнено"
        message="Цей Family Hub профіль зараз неактивний. Звернися до адміністратора, якщо доступ потрібно відновити."
        primaryLabel="Повернутися до входу"
        onPrimary={returnToLogin}
      />
    );
  }

  if (authState.status === 'member_access_denied') {
    return (
      <AuthOutcomeScreen
        title="Доступ недоступний"
        message="Family Hub не може відкрити доступ для цього входу. Звернися до адміністратора або спробуй інший спосіб входу."
        primaryLabel="Повернутися до входу"
        onPrimary={returnToLogin}
      />
    );
  }

  if (authState.status === 'auth_unavailable') {
    return (
      <AuthOutcomeScreen
        title="Family Hub тимчасово недоступний"
        message="Не вдалося перевірити доступ через backend або мережу. Якщо в тебе був збережений вхід, він не очищений автоматично."
        primaryLabel="Спробувати ще раз"
        onPrimary={retryAuthUnavailable}
        secondaryLabel="Повернутися до входу"
        onSecondary={returnToLogin}
      />
    );
  }

  return currentUser ? (
    <FamilyShell
      currentUser={currentUser}
      familyUsers={familyUsers}
      posts={posts}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onPostsChange={setPosts}
      onAvatarChange={handleAvatarChange}
      onUserAccessChange={handleUserAccessChange}
      onUserCreate={(input) => void handleUserCreate(input)}
      onUserProfileChange={(nickname, updates) => void handleUserProfileChange(nickname, updates)}
      onUserDeactivate={(nickname) => void handleUserDeactivate(nickname)}
      membersDataSourceMode={memberDataSource.mode}
      initialSection={initialSection}
      onLogout={handleLogout}
      onAuthenticatedUserRefresh={reloadAuthenticatedUser}
    />
  ) : null;
}
