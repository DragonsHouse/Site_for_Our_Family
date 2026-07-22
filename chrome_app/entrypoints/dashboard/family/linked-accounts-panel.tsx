import { useEffect, useMemo, useState } from 'react';
import { createAuthenticatedDiscordBackendClient } from '../../../lib/family-backend-auth-client';
import { readDiscordFamilySettings } from '../../../lib/family-discord-integration';
import type { DiscordAccountLink } from '../../../lib/family-types';

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

export function LinkedAccountsPanel() {
  const [discordLink, setDiscordLink] = useState<DiscordAccountLink | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const settings = useMemo(() => readDiscordFamilySettings(), []);
  const apiBaseUrl = settings.backend.apiBaseUrl;
  const oauthConfigured = Boolean(apiBaseUrl && settings.backend.discordClientId && settings.backend.oauthRedirectUrl);
  const client = useMemo(() => (apiBaseUrl ? createAuthenticatedDiscordBackendClient() : null), [apiBaseUrl]);

  async function refreshDiscordLink(showSuccessMessage = false) {
    if (!client) {
      setMessage('Discord backend URL ще не налаштовано.');
      return;
    }

    setIsBusy(true);
    try {
      const nextLink = await client.getDiscordAccountLink();
      setDiscordLink(nextLink);
      setHasChecked(true);
      if (showSuccessMessage) {
        setMessage(nextLink ? 'Статус Discord оновлено.' : 'Discord поки не прив’язано.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не вдалося перевірити Discord status.');
      setHasChecked(true);
    } finally {
      setIsBusy(false);
    }
  }

  async function startDiscordLink() {
    if (!client || !oauthConfigured) {
      setMessage('Discord OAuth ще не налаштовано у Family Hub.');
      return;
    }

    setIsBusy(true);
    try {
      const result = await client.startDiscordAccountLink();
      openAuthorizationUrl(result.authorizationUrl);
      setMessage('Відкрила Discord authorization у новій вкладці. Після завершення натисни “Перевірити статус”.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не вдалося почати Discord OAuth.');
    } finally {
      setIsBusy(false);
    }
  }

  async function unlinkDiscord() {
    if (!client) {
      setMessage('Discord backend URL ще не налаштовано.');
      return;
    }
    if (!window.confirm('Відв’язати Discord від цього Family Hub профілю?')) return;

    setIsBusy(true);
    try {
      await client.unlinkDiscordAccount();
      setDiscordLink(null);
      setMessage('Discord відв’язано від Family Hub профілю.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не вдалося відв’язати Discord.');
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    if (!client) return;

    const handleFocus = () => {
      if (!hasChecked) return;
      void refreshDiscordLink(false);
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [client, hasChecked]);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">
            Профіль → Прив’язані акаунти
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">Discord</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Основний вхід у Family Hub лишається через nickname/static ID та пароль. Discord є тільки
            додатковою прив’язкою після входу.
          </p>
        </div>
        <span
          className={
            discordLink
              ? 'w-fit rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-100'
              : 'w-fit rounded-full border border-slate-700 bg-black/30 px-3 py-1 text-sm text-slate-300'
          }
        >
          {discordLink ? 'Прив’язано' : 'Не прив’язано'}
        </span>
      </div>

      {!oauthConfigured ? (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
          Discord OAuth ще не налаштовано повністю. Потрібні backend URL, public client ID та redirect URL у
          “Сім’я → Керування → Discord-сервер”.
        </div>
      ) : null}

      {discordLink ? (
        <div className="mt-4 grid gap-4 md:grid-cols-[64px_minmax(0,1fr)_auto] md:items-center">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-amber-500/30 bg-black/30 text-lg font-semibold text-amber-100">
            {discordLink.discordAvatarUrl ? (
              <img
                src={discordLink.discordAvatarUrl}
                alt={discordLink.discordUsername}
                className="h-full w-full object-cover"
              />
            ) : (
              discordLink.discordUsername.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="min-w-0 text-sm">
            <div className="font-semibold text-white">{discordLink.discordUsername}</div>
            {discordLink.discordGlobalName ? (
              <div className="mt-1 text-slate-300">{discordLink.discordGlobalName}</div>
            ) : null}
            <div className="mt-1 break-all text-slate-500">Discord user ID: {discordLink.discordUserId}</div>
            <div className="mt-1 text-slate-500">Прив’язано: {formatDate(discordLink.linkedAt)}</div>
            <div className="mt-1 text-slate-500">
              Guild member verification: {discordLink.guildMemberVerified ? 'verified' : 'not verified'}
            </div>
          </div>
          <button
            type="button"
            onClick={unlinkDiscord}
            disabled={isBusy}
            className="rounded-xl border border-red-500/40 bg-red-950/30 px-3 py-2 text-sm font-semibold text-red-100 hover:border-red-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Відв’язати Discord
          </button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-300">
            Discord не прив’язано. Стан “Прив’язано” з’явиться тільки після відповіді backend.
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startDiscordLink}
              disabled={isBusy || !oauthConfigured}
              className="w-fit rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-100 hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Прив’язати Discord
            </button>
            <button
              type="button"
              onClick={() => void refreshDiscordLink(true)}
              disabled={isBusy || !client}
              className="w-fit rounded-xl border border-slate-700 bg-black/25 px-3 py-2 text-sm font-semibold text-slate-100 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Перевірити статус
            </button>
          </div>
        </div>
      )}

      {discordLink ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => void refreshDiscordLink(true)}
            disabled={isBusy || !client}
            className="rounded-xl border border-slate-700 bg-black/25 px-3 py-2 text-sm font-semibold text-slate-100 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Перевірити статус
          </button>
        </div>
      ) : null}

      {message ? (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
          {message}
        </div>
      ) : null}
    </section>
  );
}
