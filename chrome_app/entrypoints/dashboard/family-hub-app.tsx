import { useEffect, useMemo, useRef, useState } from 'react';
import {
  migrateDragonHouseAsyncData,
  migrateDragonHouseLocalData
} from '../../lib/family-data-migration';
import { createBackendCurrentFamilyUser, createLoggedOutFamilyHubAuthState } from '../../lib/family-backend-current-user';
import {
  changePassword as changeBackendPassword,
  clearAuthSession,
  completeDiscordLogin,
  createAuthUser,
  getCurrentUser as getBackendCurrentUser,
  loginWithDiscord,
  login as loginBackend,
  logout as logoutBackend,
  type BackendAuthUser
} from '../../lib/family-backend-auth-client';
import {
  createFamilyMemberDataSource,
  type FamilyMemberCreateInput,
  type FamilyMemberUpdateInput
} from '../../lib/family-member-data-source';
import { resolveBackendFamilyUser } from '../../lib/family-backend-user-session';
import { translateDiscordLoginError } from '../../lib/family-discord-login-errors';
import { readFamilyPosts } from '../../lib/family-data';
import type { FamilyPermission, FamilyPost, FamilyRole, FamilySection, FamilyTab, FamilyUser } from '../../lib/family-types';
import { AuthStartupGate } from './auth/AuthStartupGate';
import { LoginForm } from './auth/LoginForm';
import { DragonHouseCrest } from './family/dragon-house-crest';
import { FamilyShell } from './family/family-shell';
import { DragonLoadingScreen } from './loading/DragonLoadingScreen';
import { useFamilyAssetUrl } from './family/use-family-asset-url';

type AuthStep = 'checking' | 'login' | 'oauth-loading' | 'oauth-success' | 'change-password' | 'loading' | 'hub';

const FAMILY_TABS: FamilyTab[] = ['cabinet', 'family', 'buyers', 'events', 'map', 'resources'];
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

function translateAuthError(message: string) {
  if (message === 'Wrong password or static ID') return 'Невірний пароль або static ID';
  if (message === 'User not found') return 'Користувача не знайдено';
  if (message === 'User is inactive') return 'Користувач деактивований';
  if (message === 'New password must contain at least 6 characters') {
    return 'Новий пароль має містити щонайменше 6 символів';
  }
  return message;
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

export function FamilyHubApp() {
  migrateDragonHouseLocalData();

  const [currentUser, setCurrentUser] = useState<FamilyUser | null>(null);
  const memberDataSource = useMemo(() => createFamilyMemberDataSource(), []);
  const [familyUsers, setFamilyUsers] = useState<FamilyUser[]>([]);
  const [posts, setPosts] = useState<FamilyPost[]>(() => readFamilyPosts());
  const [step, setStep] = useState<AuthStep>('checking');
  const [activeTab, setActiveTab] = useState<FamilyTab>(() => getInitialFamilyTab());
  const [initialSection] = useState<FamilySection>(() => getInitialFamilySection());
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const authCheckStartedRef = useRef(false);
  const discordLoginInFlightRef = useRef(false);

  async function refreshFamilyUsers() {
    const users = await memberDataSource.listMembers();
    setFamilyUsers(users);
    return users;
  }

  async function resolveCurrentUser(backendUser: BackendAuthUser) {
    return resolveBackendFamilyUser(backendUser);
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
      setStep('oauth-loading');
      void completeDiscordLogin(completionCode)
        .then(async (result) => {
          window.history.replaceState(null, document.title, window.location.pathname);
          const user = await resolveCurrentUser(result.user);
          setCurrentUser(user);
          void refreshFamilyUsers().catch(() => setFamilyUsers([user]));
          setStep('oauth-success');
        })
        .catch((err) => {
          window.history.replaceState(null, document.title, window.location.pathname);
          void clearAuthSession().catch(() => undefined);
          setCurrentUser(null);
          setError(err instanceof Error ? translateDiscordLoginError(err.message) : 'Discord login failed');
          setStep('login');
        });
      return;
    }

    if (loginStatus === 'error') {
      window.history.replaceState(null, document.title, window.location.pathname);
      setError(loginError ?? 'Discord login failed');
      setStep('login');
      return;
    }

    void getBackendCurrentUser()
      .then(async (backendUser) => {
        const user = await resolveCurrentUser(backendUser);
        setCurrentUser(user);
        void refreshFamilyUsers().catch(() => setFamilyUsers([user]));
        setStep(user.mustChangePassword ? 'change-password' : 'hub');
      })
      .catch(() => {
        void clearAuthSession().catch(() => undefined);
        setCurrentUser(null);
        setStep('login');
      });
  }, []);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    try {
      const result = await loginBackend(nickname, password, rememberMe);
      const user = await resolveCurrentUser(result.user);
      setCurrentUser(user);
      await refreshFamilyUsers().catch(() => setFamilyUsers([user]));
      setPosts(readFamilyPosts());
      setCurrentPassword(user.mustChangePassword ? password : '');
      setPassword('');
      setStep(user.mustChangePassword ? 'change-password' : 'loading');
    } catch (err) {
      setError(err instanceof Error ? translateAuthError(err.message) : 'Не вдалося увійти');
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
      const backendUser = await changeBackendPassword(currentPassword, newPassword);
      const user = await resolveCurrentUser(backendUser);
      setCurrentUser(user);
      await refreshFamilyUsers().catch(() => setFamilyUsers([user]));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setStep('loading');
    } catch (err) {
      setError(err instanceof Error ? translateAuthError(err.message) : 'Не вдалося змінити пароль');
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
    setError(null);
    setActiveTab('cabinet');
    setStep('login');
  }

  function backendUserFromCurrentUser(user: FamilyUser): BackendAuthUser {
    return {
      familyMemberId: user.id,
      login: user.nickname,
      staticId: user.staticId,
      role: user.role,
      rank: user.rankLevel,
      permissions: user.permissions,
      mustChangePassword: user.mustChangePassword
    };
  }

  async function handleDiscordLogin() {
    if (discordLoginInFlightRef.current) return;
    discordLoginInFlightRef.current = true;
    setLoading(true);
    setError(null);
    try {
      setStep('oauth-loading');
      const result = await loginWithDiscord();
      const user = await resolveCurrentUser(result.user);
      setCurrentUser(user);
      await refreshFamilyUsers().catch(() => setFamilyUsers([user]));
      setPosts(readFamilyPosts());
      setStep('oauth-success');
    } catch (err) {
      setError(err instanceof Error ? translateDiscordLoginError(err.message) : 'Discord login failed');
      setStep('login');
    } finally {
      discordLoginInFlightRef.current = false;
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
      .then((member) => {
        setCurrentUser(createBackendCurrentFamilyUser(backendUserFromCurrentUser(currentUser), member));
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
      .then((member) => {
        if (currentUser?.nickname === nickname) {
          setCurrentUser(createBackendCurrentFamilyUser(backendUserFromCurrentUser(currentUser), member));
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
    const user = await memberDataSource.updateMember(originalNickname, updates);
    if (currentUser?.nickname === originalNickname) {
      setCurrentUser(createBackendCurrentFamilyUser(backendUserFromCurrentUser(currentUser), user));
    }
    await refreshFamilyUsers();
  }

  async function handleUserDeactivate(nickname: string) {
    const user = await memberDataSource.deleteMember(nickname);
    if (currentUser?.nickname === nickname) {
      setCurrentUser(user);
    }
    await refreshFamilyUsers();
  }

  if (step === 'login') {
    return (
      <LoginScreen
        error={error}
        loading={loading}
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

  if (step === 'checking') {
    return (
      <AuthShell>
        <AuthStartupGate />
      </AuthShell>
    );
  }

  if (step === 'change-password' && currentUser) {
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

  if (step === 'oauth-loading') {
    return <OAuthLoadingScreen />;
  }

  if (step === 'oauth-success' && currentUser) {
    return <OAuthSuccessScreen user={currentUser} onEnter={() => setStep('hub')} />;
  }

  if (step === 'loading' && currentUser) {
    return <DragonLoadingScreen active={true} onComplete={() => setStep('hub')} />;
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
    />
  ) : null;
}
