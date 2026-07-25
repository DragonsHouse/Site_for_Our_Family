import { useEffect, useMemo, useState } from 'react';
import { createAuthenticatedDiscordBackendClient, getDiscordBackendRuntimeConfig } from '../../../lib/family-backend-auth-client';
import type { DiscordBackendPublicConfigResponse } from '../../../lib/family-discord-backend-client';
import {
  discordLinkStateForCallback,
  discordLinkStateForFailure,
  discordLinkStateFromUser,
  normalizeDiscordLinkFailure,
  type DiscordLinkFlowState,
} from '../../../lib/family-discord-link-state';
import type { DiscordAccountLink, FamilyUser } from '../../../lib/family-types';

function formatDate(value: string) {
  return new Date(value).toLocaleString('uk-UA');
}

function openAuthorizationUrl(authorizationUrl: string) {
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    void chrome.tabs.create({ url: authorizationUrl });
    return;
  }
  window.open(authorizationUrl, '_blank', 'noopener,noreferrer');
}

function removeDiscordLinkCallbackParams() {
  const url = new URL(window.location.href);
  let changed = false;
  for (const key of ['discordLinkStatus', 'error']) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (changed) window.history.replaceState(null, document.title, url.toString());
}

function isBusyState(state: DiscordLinkFlowState) {
  return state.status === 'starting' || state.status === 'awaiting_oauth' || state.status === 'completing';
}

function linkDisplayName(link: DiscordAccountLink | null, user: FamilyUser) {
  return link?.discordGlobalName ?? link?.discordUsername ?? user.discordDisplayName ?? user.discordUsername ?? 'Discord';
}

function linkAvatar(link: DiscordAccountLink | null, user: FamilyUser) {
  return link?.discordAvatarUrl ?? user.discordAvatarUrl ?? null;
}

export function LinkedAccountsPanel({
  user,
  onAuthenticatedUserRefresh,
}: {
  user: FamilyUser;
  onAuthenticatedUserRefresh: () => Promise<FamilyUser | null>;
}) {
  const [linkState, setLinkState] = useState<DiscordLinkFlowState>(() => discordLinkStateFromUser(user));
  const [apiBaseUrl, setApiBaseUrl] = useState<string | null>(null);
  const [publicConfig, setPublicConfig] = useState<DiscordBackendPublicConfigResponse | null>(null);
  const oauthConfigured = Boolean(apiBaseUrl && publicConfig?.clientId && publicConfig.redirectUri);
  const client = useMemo(() => (apiBaseUrl ? createAuthenticatedDiscordBackendClient() : null), [apiBaseUrl]);
  const isBusy = isBusyState(linkState);
  const linkedAccount = linkState.status === 'linked' ? linkState.link : null;
  const appearsLinked = linkState.status === 'linked' || user.discordLinkStatus === 'linked' || Boolean(user.discordUserId);

  async function refreshRuntimeConfig() {
    try {
      const runtime = await getDiscordBackendRuntimeConfig();
      setApiBaseUrl(runtime.apiBaseUrl);
      setPublicConfig(runtime.publicConfig);
      return runtime;
    } catch {
      setApiBaseUrl(null);
      setPublicConfig(null);
      setLinkState({ status: 'unavailable', message: 'Discord backend тимчасово недоступний.' });
      return null;
    }
  }

  async function refreshDiscordLink(options: { showMessage?: boolean; refreshAuthenticatedUser?: boolean } = {}) {
    if (!client) {
      setLinkState({ status: 'unavailable', message: 'Discord backend URL ще не налаштовано.' });
      return null;
    }

    try {
      const nextLink = await client.getDiscordAccountLink();
      if (options.refreshAuthenticatedUser) await onAuthenticatedUserRefresh();
      setLinkState(
        nextLink
          ? {
              status: 'linked',
              link: nextLink,
              message: options.showMessage ? 'Discord прив’язано. Family Hub профіль оновлено.' : null,
            }
          : { status: 'unlinked', message: options.showMessage ? 'Discord не прив’язаний.' : null },
      );
      return nextLink;
    } catch (error) {
      const nextState = discordLinkStateForFailure(error);
      setLinkState(nextState);
      return null;
    }
  }

  async function applyDiscordLinkFailure(error: unknown) {
    const failure = normalizeDiscordLinkFailure(error);
    if (failure.code === 'discord_account_already_linked') {
      const refreshedUser = await onAuthenticatedUserRefresh().catch(() => null);
      if (refreshedUser?.discordLinkStatus === 'linked' || refreshedUser?.discordUserId) {
        const nextLink = client ? await client.getDiscordAccountLink().catch(() => null) : null;
        setLinkState({
          status: 'linked',
          link: nextLink,
          message: 'Discord уже прив’язано до цього Family Hub профілю. Статус оновлено.',
        });
        return;
      }
    }
    setLinkState(discordLinkStateForFailure(error));
  }

  async function startDiscordLink() {
    if (isBusyState(linkState)) return;
    if (!client || !oauthConfigured) {
      setLinkState({ status: 'unavailable', message: 'Discord OAuth ще не налаштовано у Family Hub.' });
      return;
    }

    setLinkState({ status: 'starting', message: 'Готуємо безпечну Discord прив’язку.' });
    try {
      const result = await client.startDiscordAccountLink();
      openAuthorizationUrl(result.authorizationUrl);
      setLinkState({
        status: 'awaiting_oauth',
        expiresAt: result.expiresAt,
        message: 'Discord authorization відкрито у новій вкладці. Після завершення Family Hub оновить статус автоматично.',
      });
    } catch (error) {
      await applyDiscordLinkFailure(error);
    }
  }

  async function unlinkDiscord() {
    if (!client || isBusyState(linkState)) return;
    if (!window.confirm('Відв’язати Discord від цього Family Hub профілю?')) return;

    setLinkState({ status: 'starting', message: 'Відв’язуємо Discord.' });
    try {
      await client.unlinkDiscordAccount();
      await onAuthenticatedUserRefresh();
      setLinkState({ status: 'unlinked', message: 'Discord відв’язано від Family Hub профілю.' });
    } catch (error) {
      await applyDiscordLinkFailure(error);
    }
  }

  useEffect(() => {
    void refreshRuntimeConfig();
  }, []);

  useEffect(() => {
    if (!client) return;

    const callbackState = discordLinkStateForCallback(
      new URL(window.location.href).searchParams.get('discordLinkStatus'),
      new URL(window.location.href).searchParams.get('error'),
    );
    if (callbackState) {
      setLinkState(callbackState);
      removeDiscordLinkCallbackParams();
      if (callbackState.status === 'completing') {
        void refreshDiscordLink({ showMessage: true, refreshAuthenticatedUser: true });
      }
      return;
    }

    void refreshDiscordLink();
  }, [client]);

  useEffect(() => {
    if (!client) return;
    const handleFocus = () => {
      if (linkState.status === 'awaiting_oauth' || linkState.status === 'completing') {
        void refreshDiscordLink({ showMessage: linkState.status === 'awaiting_oauth', refreshAuthenticatedUser: true });
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [client, linkState.status]);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">
            Профіль → Прив’язані акаунти
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">Discord</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Discord-вхід працює тільки для Discord акаунта, прив’язаного до твого поточного Family Hub профілю.
            Прив’язка не створює нового учасника і не змінює ролі чи дозволи.
          </p>
        </div>
        <span
          className={
            appearsLinked
              ? 'w-fit rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-100'
              : 'w-fit rounded-full border border-slate-700 bg-black/30 px-3 py-1 text-sm text-slate-300'
          }
        >
          {appearsLinked ? 'Discord прив’язано' : isBusy ? 'Оновлюємо' : 'Discord не прив’язаний'}
        </span>
      </div>

      {!oauthConfigured ? (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
          Discord-прив’язка ще не налаштована повністю на сервері. Спробуй пізніше або звернися до адміністратора.
        </div>
      ) : null}

      {appearsLinked ? (
        <div className="mt-4 grid gap-4 md:grid-cols-[64px_minmax(0,1fr)_auto] md:items-center">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-amber-500/30 bg-black/30 text-lg font-semibold text-amber-100">
            {linkAvatar(linkedAccount, user) ? (
              <img src={linkAvatar(linkedAccount, user) ?? undefined} alt="" className="h-full w-full object-cover" />
            ) : (
              linkDisplayName(linkedAccount, user).slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="min-w-0 text-sm">
            <div className="font-semibold text-white">{linkDisplayName(linkedAccount, user)}</div>
            <div className="mt-1 text-slate-300">Discord прив’язано до цього Family Hub профілю.</div>
            {linkedAccount?.linkedAt ? (
              <div className="mt-1 text-slate-500">Прив’язано: {formatDate(linkedAccount.linkedAt)}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={unlinkDiscord}
            disabled={isBusy || !client}
            className="rounded-xl border border-red-500/40 bg-red-950/30 px-3 py-2 text-sm font-semibold text-red-100 hover:border-red-400 focus:outline-none focus:ring focus:ring-red-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Відв’язати Discord
          </button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-300">Discord не прив’язаний. Прив’язати можна тільки до поточного Family Hub профілю.</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startDiscordLink}
              disabled={isBusy || !oauthConfigured}
              className="w-fit rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-100 hover:border-amber-400 focus:outline-none focus:ring focus:ring-amber-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {linkState.status === 'starting' ? 'Відкриваємо Discord' : 'Прив’язати Discord'}
            </button>
            <button
              type="button"
              onClick={() => void refreshDiscordLink({ showMessage: true, refreshAuthenticatedUser: true })}
              disabled={isBusy || !client}
              className="w-fit rounded-xl border border-slate-700 bg-black/25 px-3 py-2 text-sm font-semibold text-slate-100 hover:border-slate-500 focus:outline-none focus:ring focus:ring-amber-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Оновити статус
            </button>
          </div>
        </div>
      )}

      {linkState.status === 'conflict' ? (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-100">
          {linkState.message} Якщо це неочікувано, звернися до адміністратора.
        </div>
      ) : null}

      {linkState.status !== 'conflict' &&
      (linkState.status === 'failed' || linkState.status === 'unavailable' || linkState.status === 'awaiting_oauth' || linkState.message) ? (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
          {linkState.message}
        </div>
      ) : null}
    </section>
  );
}
