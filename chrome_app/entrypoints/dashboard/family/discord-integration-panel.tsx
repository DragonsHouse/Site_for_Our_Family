import { useMemo, useState } from 'react';
import {
  DISCORD_CHANNEL_DEFINITIONS,
  type DiscordChannelDefinition,
  buildDiscordChannelPolicies,
  createDragonHouseDiscordPreset,
  getConfiguredDiscordChannelIds,
  isDiscordSettingsFormEmpty,
  readDiscordFamilySettings,
  resetDiscordFamilySettings,
  saveDiscordFamilySettings,
  validateDiscordFamilySettings
} from '../../../lib/family-discord-integration';
import type {
  DiscordChannelPolicy,
  DiscordFamilySettings,
  FamilyChatImportMode,
  FamilyUser
} from '../../../lib/family-types';

const TEXT_INPUT_CLASS =
  'mt-1 w-full rounded-xl border border-slate-800 bg-black/35 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500/60';

const CHAT_IMPORT_MODES: Array<{ value: FamilyChatImportMode; label: string }> = [
  { value: 'disabled', label: 'Disabled' },
  { value: 'slash_command', label: 'Slash command' },
  { value: 'prefix', label: 'Prefix' },
  { value: 'role_mention', label: 'Role mention' }
];

const GROUPS: DiscordChannelDefinition['group'][] = [
  'Новачки',
  'Сім’я',
  'Новини',
  'Квести',
  'Економіка',
  'Галерея'
];

function getPolicy(settings: DiscordFamilySettings, definition: DiscordChannelDefinition) {
  return settings.family.channelPolicies.find((policy) => policy.purpose === definition.purpose);
}

function updatePolicy(
  settings: DiscordFamilySettings,
  definition: DiscordChannelDefinition,
  patch: Partial<Pick<DiscordChannelPolicy, 'importEnabled' | 'publishEnabled'>>
): DiscordFamilySettings {
  const channelId = settings.family[definition.field];
  if (!channelId) return settings;
  const policies = settings.family.channelPolicies.filter((policy) => policy.purpose !== definition.purpose);
  const currentPolicy = getPolicy(settings, definition);
  const nextPolicy: DiscordChannelPolicy = {
    channelId,
    purpose: definition.purpose,
    importEnabled: false,
    publishEnabled: false,
    requiredPermission: definition.requiredPermission ?? null,
    minimumRank: definition.minimumRank ?? null,
    ...currentPolicy,
    ...patch
  };
  return {
    ...settings,
    family: {
      ...settings.family,
      channelPolicies: [...policies, nextPolicy]
    }
  };
}

function normalizeBeforeSave(settings: DiscordFamilySettings): DiscordFamilySettings {
  const allowedChannelIds = getConfiguredDiscordChannelIds(settings.family);
  return {
    ...settings,
    family: {
      ...settings.family,
      allowedChannelIds,
      channelPolicies: buildDiscordChannelPolicies(settings.family).map((policy) => {
        const existingPolicy = settings.family.channelPolicies.find((item) => item.purpose === policy.purpose);
        return existingPolicy ? { ...policy, ...existingPolicy, channelId: policy.channelId } : policy;
      }),
      syncNews: false,
      syncUrgentNews: false,
      syncQuests: false,
      syncQuestReports: false,
      syncMembers: false,
      connectionStatus: 'not_configured',
      lastSuccessfulSyncAt: null,
      lastError: null
    }
  };
}

export function DiscordIntegrationPanel({ currentUser }: { currentUser: FamilyUser }) {
  const [settings, setSettings] = useState<DiscordFamilySettings>(() => readDiscordFamilySettings());
  const [message, setMessage] = useState<string | null>(null);
  const normalizedPreview = useMemo(() => normalizeBeforeSave(settings), [settings]);
  const missingFields = useMemo(() => validateDiscordFamilySettings(normalizedPreview), [normalizedPreview]);
  const canBeginConnect = Boolean(
    settings.backend.apiBaseUrl && settings.backend.discordClientId && settings.backend.oauthRedirectUrl
  );

  function updateSettings(nextSettings: DiscordFamilySettings) {
    setSettings(nextSettings);
    setMessage(null);
  }

  function saveConfig() {
    const nextSettings = saveDiscordFamilySettings(normalizeBeforeSave(settings));
    setSettings(nextSettings);
    setMessage('Конфігурацію Discord збережено локально. Sync не запущено, статус лишається not_configured.');
  }

  function validateConfig() {
    const missing = validateDiscordFamilySettings(normalizeBeforeSave(settings));
    setMessage(
      missing.length
        ? `Потрібно заповнити: ${missing.join(', ')}.`
        : 'Заповнення виглядає готовим, але Discord ще не підключений без backend validation.'
    );
  }

  function resetConfig() {
    const nextSettings = resetDiscordFamilySettings();
    setSettings(nextSettings);
    setMessage('Конфігурацію Discord скинуто. Статус: not_configured.');
  }

  function applyDragonHousePreset() {
    if (!isDiscordSettingsFormEmpty(settings)) {
      const shouldOverwrite = window.confirm(
        'У формі вже є Discord-значення. Перезаписати їх конфігурацією Dragon House?'
      );
      if (!shouldOverwrite) return;
    }
    const nextSettings = createDragonHouseDiscordPreset(settings);
    setSettings(nextSettings);
    setMessage('Preset Dragon House заповнив форму. Натисни “Зберегти конфігурацію”, щоб записати зміни.');
  }

  function updateChannel(definition: DiscordChannelDefinition, channelId: string) {
    const nextFamily = {
      ...settings.family,
      [definition.field]: channelId.trim() || null
    };
    updateSettings({
      ...settings,
      family: {
        ...nextFamily,
        allowedChannelIds: getConfiguredDiscordChannelIds(nextFamily),
        channelPolicies: buildDiscordChannelPolicies(nextFamily).map((policy) => {
          const existingPolicy = settings.family.channelPolicies.find((item) => item.purpose === policy.purpose);
          return existingPolicy ? { ...policy, ...existingPolicy, channelId: policy.channelId } : policy;
        })
      }
    });
  }

  return (
    <section className="rounded-2xl border border-red-950/70 bg-slate-950/80 p-5 shadow-xl shadow-black/30">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">
            Discord-сервер
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">Dragon House Hub integration</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Це лише майбутня конфігурація. Family Hub не запускає sync, OAuth або polling, а Discord
            не показується як підключений.
          </p>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-black/30 px-3 py-2 text-sm text-amber-100">
          Status: <span className="font-semibold">{settings.family.connectionStatus}</span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={applyDragonHousePreset}
          className="rounded-xl border border-orange-400/50 bg-orange-500/15 px-4 py-2 text-sm font-semibold text-orange-100 hover:border-orange-300"
        >
          Заповнити конфігурацією Dragon House
        </button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <label className="text-sm text-slate-300">
          Server invite URL
          <input
            className={TEXT_INPUT_CLASS}
            value={settings.serverInviteUrl ?? ''}
            onChange={(event) =>
              updateSettings({ ...settings, serverInviteUrl: event.target.value.trim() || null })
            }
            placeholder="https://discord.gg/..."
          />
        </label>
        <label className="text-sm text-slate-300">
          Guild ID
          <input
            className={TEXT_INPUT_CLASS}
            value={settings.family.guildId ?? ''}
            onChange={(event) =>
              updateSettings({
                ...settings,
                family: { ...settings.family, guildId: event.target.value.trim() || null }
              })
            }
          />
        </label>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-800 bg-black/25 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Family chat filter</h3>
            <p className="mt-1 text-sm text-slate-400">
              У майбутньому backend імпортуватиме тільки повідомлення, що відповідають правилу. @everyone не використовується як основний фільтр.
            </p>
          </div>
          <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">
            Default: #hub
          </span>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-4">
          <label className="text-sm text-slate-300">
            Import mode
            <select
              className={TEXT_INPUT_CLASS}
              value={settings.family.familyChatImportMode}
              onChange={(event) =>
                updateSettings({
                  ...settings,
                  family: {
                    ...settings.family,
                    familyChatImportMode: event.target.value as FamilyChatImportMode
                  }
                })
              }
            >
              {CHAT_IMPORT_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-300">
            Slash command
            <input
              className={TEXT_INPUT_CLASS}
              value={settings.family.familyChatCommandName}
              onChange={(event) =>
                updateSettings({
                  ...settings,
                  family: { ...settings.family, familyChatCommandName: event.target.value.trim() || 'hub' }
                })
              }
            />
          </label>
          <label className="text-sm text-slate-300">
            Prefix
            <input
              className={TEXT_INPUT_CLASS}
              value={settings.family.familyChatPrefix}
              onChange={(event) =>
                updateSettings({
                  ...settings,
                  family: { ...settings.family, familyChatPrefix: event.target.value.trim() || '#hub' }
                })
              }
            />
          </label>
          <label className="text-sm text-slate-300">
            Mention role ID
            <input
              className={TEXT_INPUT_CLASS}
              value={settings.family.familyChatMentionRoleId ?? ''}
              onChange={(event) =>
                updateSettings({
                  ...settings,
                  family: { ...settings.family, familyChatMentionRoleId: event.target.value.trim() || null }
                })
              }
            />
          </label>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {GROUPS.map((group) => (
          <section key={group} className="rounded-2xl border border-slate-800 bg-black/25 p-4">
            <h3 className="text-base font-semibold text-white">{group}</h3>
            <div className="mt-3 grid gap-3">
              {DISCORD_CHANNEL_DEFINITIONS.filter((definition) => definition.group === group).map((definition) => {
                const policy = getPolicy(settings, definition);
                return (
                  <div key={definition.purpose} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_140px] lg:items-start">
                      <label className="text-sm text-slate-300">
                        <span className="font-semibold text-slate-100">{definition.label}</span>
                        <span className="mt-1 block text-xs text-slate-500">{definition.description}</span>
                        <input
                          className={TEXT_INPUT_CLASS}
                          value={settings.family[definition.field] ?? ''}
                          onChange={(event) => updateChannel(definition, event.target.value)}
                          placeholder="Discord channel ID"
                        />
                      </label>
                      <label className="mt-1 flex items-center gap-2 rounded-xl border border-slate-800 bg-black/25 px-3 py-2 text-sm text-slate-300 lg:mt-6">
                        <input
                          type="checkbox"
                          checked={Boolean(policy?.importEnabled)}
                          disabled={!settings.family[definition.field]}
                          onChange={(event) =>
                            updateSettings(updatePolicy(settings, definition, { importEnabled: event.target.checked }))
                          }
                        />
                        Import planned
                      </label>
                      <label className="mt-1 flex items-center gap-2 rounded-xl border border-slate-800 bg-black/25 px-3 py-2 text-sm text-slate-300 lg:mt-6">
                        <input
                          type="checkbox"
                          checked={Boolean(policy?.publishEnabled)}
                          disabled={!settings.family[definition.field]}
                          onChange={(event) =>
                            updateSettings(updatePolicy(settings, definition, { publishEnabled: event.target.checked }))
                          }
                        />
                        Publish planned
                      </label>
                      <div className="mt-1 rounded-xl border border-red-500/30 bg-red-950/20 px-3 py-2 text-sm text-red-100 lg:mt-6">
                        Не підключено
                      </div>
                    </div>
                    {definition.requiredPermission || definition.minimumRank ? (
                      <div className="mt-3 text-xs text-amber-200">
                        Access: owner OR {definition.requiredPermission ?? 'permission'} OR rank &gt;= {definition.minimumRank ?? 1}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <label className="text-sm text-slate-300">
          Backend API URL
          <input
            className={TEXT_INPUT_CLASS}
            value={settings.backend.apiBaseUrl ?? ''}
            onChange={(event) =>
              updateSettings({
                ...settings,
                backend: { ...settings.backend, apiBaseUrl: event.target.value.trim() || null }
              })
            }
          />
        </label>
        <label className="text-sm text-slate-300">
          Discord application client ID
          <input
            className={TEXT_INPUT_CLASS}
            value={settings.backend.discordClientId ?? ''}
            onChange={(event) =>
              updateSettings({
                ...settings,
                backend: { ...settings.backend, discordClientId: event.target.value.trim() || null }
              })
            }
          />
        </label>
        <label className="text-sm text-slate-300">
          OAuth redirect URL
          <input
            className={TEXT_INPUT_CLASS}
            value={settings.backend.oauthRedirectUrl ?? ''}
            onChange={(event) =>
              updateSettings({
                ...settings,
                backend: { ...settings.backend, oauthRedirectUrl: event.target.value.trim() || null }
              })
            }
          />
        </label>
      </div>

      <div className="mt-5 grid gap-3 text-sm text-slate-300 md:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-black/25 p-3">
          <div className="text-slate-500">Last successful sync</div>
          <div className="mt-1 text-slate-100">{settings.family.lastSuccessfulSyncAt ?? 'never'}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-black/25 p-3">
          <div className="text-slate-500">Last error</div>
          <div className="mt-1 text-slate-100">{settings.family.lastError ?? 'none'}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-black/25 p-3">
          <div className="text-slate-500">Missing fields</div>
          <div className="mt-1 text-slate-100">{missingFields.length}</div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={saveConfig} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400">
          Зберегти конфігурацію
        </button>
        <button type="button" onClick={validateConfig} className="rounded-xl border border-amber-500/40 bg-black/25 px-4 py-2 text-sm font-semibold text-amber-100 hover:border-amber-400">
          Перевірити заповнення
        </button>
        <button type="button" onClick={resetConfig} className="rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-2 text-sm font-semibold text-red-100 hover:border-red-400">
          Скинути конфігурацію
        </button>
        <button
          type="button"
          disabled
          title={
            canBeginConnect
              ? 'Backend flow ще не реалізований у Family Hub'
              : 'Потрібні backend URL, public Discord client ID та OAuth redirect URL'
          }
          className="cursor-not-allowed rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm font-semibold text-slate-500"
        >
          Підключити Discord
        </button>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Visible to {currentUser.nickname} через permission manage_discord_integration. No background
        polling, no Discord SDK, no OAuth, no tokens in frontend.
      </p>
      {message ? <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">{message}</div> : null}
    </section>
  );
}
