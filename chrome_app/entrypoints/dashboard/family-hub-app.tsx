import { useEffect, useMemo, useRef, useState } from 'react';
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
  StaticIdValidationError,
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
import { DragonLoadingScreen } from './loading/DragonLoadingScreen';
import { useFamilyAssetUrl } from './family/use-family-asset-url';

const FAMILY_TABS: FamilyTab[] = ['cabinet', 'profile', 'members', 'family', 'buyers', 'events', 'map', 'resources'];
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const authCheckStartedRef = useRef(false);
  const discordLoginInFlightRef = useRef(false);

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
