import { getFamilyHubUrl, type ExtensionUrlParams } from './extension-urls';

function stripQueryAndHash(url: string) {
  const parsed = new URL(url);
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
}

function isExistingFamilyHubTab(tab: chrome.tabs.Tab, familyHubBaseUrl: string) {
  if (!tab.url) return false;

  try {
    return stripQueryAndHash(tab.url) === familyHubBaseUrl;
  } catch {
    return false;
  }
}

export async function openOrFocusFamilyHubTab(params: ExtensionUrlParams = {}) {
  const targetUrl = getFamilyHubUrl(params);
  const familyHubBaseUrl = stripQueryAndHash(getFamilyHubUrl());
  const tabs = await chrome.tabs.query({});
  const existingTab = tabs.find((tab) => isExistingFamilyHubTab(tab, familyHubBaseUrl));

  if (existingTab?.id != null) {
    await chrome.tabs.update(existingTab.id, { active: true, url: targetUrl });
    if (existingTab.windowId != null) {
      await chrome.windows.update(existingTab.windowId, { focused: true });
    }
    return;
  }

  await chrome.tabs.create({ url: targetUrl });
}
