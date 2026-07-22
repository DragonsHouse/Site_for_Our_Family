import { DEFAULT_SETTINGS, type AppSettings } from './types';

const SETTINGS_KEY = 'quant_rp_helper_settings';

export async function getSettings(): Promise<AppSettings> {
  const data = await chrome.storage.sync.get(SETTINGS_KEY);
  return {
    ...DEFAULT_SETTINGS,
    ...(data[SETTINGS_KEY] ?? {})
  };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await chrome.storage.sync.set({
    [SETTINGS_KEY]: settings
  });
}
