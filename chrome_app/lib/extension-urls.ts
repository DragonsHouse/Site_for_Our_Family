export const EXTENSION_ENTRYPOINTS = {
  familyHub: 'dashboard.html',
  popup: 'popup.html',
  options: 'options.html'
} as const;

export type ExtensionEntrypoint = (typeof EXTENSION_ENTRYPOINTS)[keyof typeof EXTENSION_ENTRYPOINTS];

export type ExtensionUrlParams = Record<string, string | number | boolean | null | undefined>;

export type ExtensionRuntimeUrlResolver = (path: string) => string;

function defaultRuntimeUrl(path: string) {
  if (typeof chrome === 'undefined' || !chrome.runtime?.getURL) {
    throw new Error('chrome.runtime.getURL is not available');
  }
  return chrome.runtime.getURL(path);
}

export function getExtensionPageUrl(
  entrypoint: ExtensionEntrypoint,
  params: ExtensionUrlParams = {},
  resolveRuntimeUrl: ExtensionRuntimeUrlResolver = defaultRuntimeUrl
) {
  const normalizedEntrypoint = entrypoint.replace(/^\/+/, '');
  const url = new URL(resolveRuntimeUrl(normalizedEntrypoint));

  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') continue;
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

export function getFamilyHubUrl(
  params: ExtensionUrlParams = {},
  resolveRuntimeUrl?: ExtensionRuntimeUrlResolver
) {
  return getExtensionPageUrl(EXTENSION_ENTRYPOINTS.familyHub, params, resolveRuntimeUrl);
}

export function getOptionsUrl(
  params: ExtensionUrlParams = {},
  resolveRuntimeUrl?: ExtensionRuntimeUrlResolver
) {
  return getExtensionPageUrl(EXTENSION_ENTRYPOINTS.options, params, resolveRuntimeUrl);
}
