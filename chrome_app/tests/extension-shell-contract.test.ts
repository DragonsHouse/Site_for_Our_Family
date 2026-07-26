import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  DRAGON_HOUSE_HUB_PRODUCT_NAME,
  DRAGON_HOUSE_HUB_SHORT_NAME,
} from '../lib/extension-branding.ts';
import { EXTENSION_ENTRYPOINTS, getFamilyHubUrl, getOptionsUrl } from '../lib/extension-urls.ts';

const ROOT = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(ROOT, '..');

function sourcePath(...parts: string[]) {
  return join(APP_ROOT, ...parts);
}

function readSource(...parts: string[]) {
  return readFileSync(sourcePath(...parts), 'utf8');
}

function outputPath(...parts: string[]) {
  return sourcePath('.output', 'chrome-mv3', ...parts);
}

function readOutputJson<T>(...parts: string[]): T {
  return JSON.parse(readFileSync(outputPath(...parts), 'utf8')) as T;
}

function readPngHeader(filePath: string) {
  const buffer = readFileSync(filePath);
  assert.deepEqual(
    [...buffer.subarray(0, 8)],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    `${filePath} should be a PNG`,
  );
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colorType: buffer[25],
  };
}

function sha256(filePath: string) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

describe('extension shell source contract', () => {
  it('uses Dragon House Hub as the official extension product name', () => {
    const wxtConfig = readSource('wxt.config.ts');
    const popupHtml = readSource('entrypoints', 'popup', 'index.html');
    const dashboardHtml = readSource('entrypoints', 'dashboard', 'index.html');
    const optionsHtml = readSource('entrypoints', 'options', 'index.html');
    const background = readSource('entrypoints', 'background.ts');
    const popup = readSource('entrypoints', 'popup', 'popup-app.tsx');

    assert.equal(DRAGON_HOUSE_HUB_PRODUCT_NAME, 'Dragon House Hub');
    assert.equal(DRAGON_HOUSE_HUB_SHORT_NAME, 'Dragon Hub');
    assert.match(wxtConfig, /DRAGON_HOUSE_HUB_PRODUCT_NAME/u);
    assert.match(wxtConfig, /DRAGON_HOUSE_HUB_SHORT_NAME/u);
    assert.match(popupHtml, /<title>Dragon House Hub<\/title>/u);
    assert.match(dashboardHtml, /<title>Dragon House Hub<\/title>/u);
    assert.match(optionsHtml, /<title>Dragon House Hub Settings<\/title>/u);
    assert.match(background, /Dragon House Hub/u);
    assert.match(popup, /DRAGON_HOUSE_HUB_PRODUCT_NAME/u);
    assert.doesNotMatch(wxtConfig, /Dragon House Family/u);
  });

  it('centralizes valid extension entrypoint paths and encodes query parameters', () => {
    const runtimeUrl = (path: string) => `chrome-extension://dragon-house/${path}`;

    assert.deepEqual(EXTENSION_ENTRYPOINTS, {
      familyHub: 'dashboard.html',
      popup: 'popup.html',
      options: 'options.html'
    });

    const hubUrl = getFamilyHubUrl(
      {
        tab: 'buyers',
        page: 'https://quantfun.com.ua/buyers?page=1',
        empty: '',
        missing: null
      },
      runtimeUrl
    );
    assert.equal(
      hubUrl,
      'chrome-extension://dragon-house/dashboard.html?tab=buyers&page=https%3A%2F%2Fquantfun.com.ua%2Fbuyers%3Fpage%3D1'
    );
    assert.equal(getOptionsUrl({}, runtimeUrl), 'chrome-extension://dragon-house/options.html');
  });

  it('does not keep stale or unsafe internal extension route construction', () => {
    const sourceFiles = [
      'wxt.config.ts',
      'entrypoints/background.ts',
      'entrypoints/popup/popup-app.tsx',
      'lib/extension-urls.ts',
      'lib/extension-tabs.ts'
    ].map((file) => readSource(...file.split('/')));
    const combined = sourceFiles.join('\n');

    assert.doesNotMatch(combined, /chrome\.runtime\.getURL\(['"`]\/dashboard\.html/u);
    assert.doesNotMatch(combined, /file:\/\//u);
    assert.doesNotMatch(combined, /web_accessible_resources/u);
    assert.doesNotMatch(combined, /assets\/dragon-house\/dragon-house-logo\.png['"`],?\s*(?:\n\s*)?(?:32|48|128)?:/u);
    assert.match(combined, /openOrFocusFamilyHubTab/u);
    assert.doesNotMatch(combined, /new URL\(chrome\.runtime\.getURL\(['"`]dashboard\.html/u);
    assert.doesNotMatch(combined, /dashboardUrl\(/u);
    assert.match(combined, /icon\/16\.png/u);
    assert.match(combined, /icon\/32\.png/u);
    assert.match(combined, /icon\/48\.png/u);
    assert.match(combined, /icon\/128\.png/u);
    assert.match(combined, /icon\/256\.png/u);
    assert.match(combined, /icon\/512\.png/u);
  });

  it('declares source entrypoints and branded square icon assets with exact dimensions', () => {
    for (const entrypoint of [
      'entrypoints/dashboard/index.html',
      'entrypoints/popup/index.html',
      'entrypoints/options/index.html',
      'entrypoints/background.ts',
      'entrypoints/content.ts'
    ]) {
      assert.equal(existsSync(sourcePath(...entrypoint.split('/'))), true, `${entrypoint} should exist`);
    }

    const iconHashes = new Set<string>();
    for (const [icon, size] of Object.entries({
      '16.png': 16,
      '32.png': 32,
      '48.png': 48,
      '128.png': 128,
      '256.png': 256,
      '512.png': 512
    })) {
      const iconPath = sourcePath('public', 'icon', icon);
      assert.equal(existsSync(iconPath), true, `${icon} should exist`);
      assert.notEqual(readFileSync(iconPath).includes(Buffer.from('Quant')), true, `${icon} should not be the old placeholder`);
      iconHashes.add(sha256(iconPath));
      const header = readPngHeader(iconPath);
      assert.equal(header.width, size, `${icon} should be ${size}px wide`);
      assert.equal(header.height, size, `${icon} should be ${size}px high`);
      assert.equal(header.colorType, 6, `${icon} should include an alpha channel`);
    }
    assert.equal(iconHashes.size, 6, 'icon sizes should be independently emitted assets');
    assert.equal(existsSync(sourcePath('public', 'icon', 'logo6.png')), false, 'legacy logo6 icon should not be shipped');
  });

  it('keeps popup behavior on shared tab helpers and real-data fallback states', () => {
    const popup = readSource('entrypoints', 'popup', 'popup-app.tsx');

    assert.match(popup, /openOrFocusFamilyHubTab/u);
    assert.match(popup, /Open Family Hub/u);
    assert.match(popup, /Open Family Hub in Dragon House Hub/u);
    assert.match(popup, /Мої повідомлення/u);
    assert.match(popup, /Особисті повідомлення зʼявляться після входу/u);
    assert.match(popup, /Нових персональних повідомлень немає/u);
    assert.match(popup, /Важливих новин поки немає/u);
    assert.match(popup, /Даних скупників ще немає/u);
    assert.match(popup, /currentUser\.displayName \|\| currentUser\.nickname/u);
    assert.match(popup, /Dragon House Hub тимчасово недоступний/u);
    assert.doesNotMatch(popup, /https?:\/\//u);
    assert.doesNotMatch(popup, /placeholder shield|simple shield|fake notification|fake news/u);
  });

  it('uses the official black and ember-red brand palette in extension surfaces', () => {
    const brandedCss = [
      readSource('entrypoints', 'popup', 'style.css'),
      readSource('entrypoints', 'shared', 'design-system.css'),
      readSource('entrypoints', 'dashboard', 'style.css'),
      readSource('entrypoints', 'options', 'style.css')
    ].join('\n');

    assert.match(brandedCss, /#8b0000/u);
    assert.match(brandedCss, /#ff1a00/u);
    assert.match(brandedCss, /#ff5a00/u);
    assert.doesNotMatch(brandedCss, /#f2b84b|#d99a24|#ff6a00|#f04a16/u);
    assert.doesNotMatch(brandedCss, /rgba\(251,\s*191,\s*36|rgba\(245,\s*158,\s*11/u);
  });
});

describe('extension shell production build contract', () => {
  it('emits every manifest page, background worker, and icon referenced by the manifest', () => {
    const manifest = readOutputJson<{
      action?: { default_popup?: string; default_icon?: Record<string, string> };
      background?: { service_worker?: string };
      name?: string;
      short_name?: string;
      icons?: Record<string, string>;
      options_page?: string;
      options_ui?: { page?: string };
      web_accessible_resources?: unknown[];
    }>('manifest.json');

    assert.equal(manifest.name, DRAGON_HOUSE_HUB_PRODUCT_NAME);
    assert.equal(manifest.short_name, DRAGON_HOUSE_HUB_SHORT_NAME);
    assert.equal(manifest.action?.default_popup, EXTENSION_ENTRYPOINTS.popup);
    assert.equal(manifest.options_page, EXTENSION_ENTRYPOINTS.options);
    assert.equal(manifest.options_ui?.page, EXTENSION_ENTRYPOINTS.options);
    assert.equal(manifest.background?.service_worker, 'background.js');
    assert.equal(manifest.web_accessible_resources, undefined);

    for (const page of [EXTENSION_ENTRYPOINTS.familyHub, EXTENSION_ENTRYPOINTS.popup, EXTENSION_ENTRYPOINTS.options]) {
      assert.equal(existsSync(outputPath(page)), true, `${page} should be emitted`);
    }

    for (const iconPath of [
      ...Object.values(manifest.icons ?? {}),
      ...Object.values(manifest.action?.default_icon ?? {})
    ]) {
      assert.match(iconPath, /^icon\/(?:16|32|48|128|256|512)\.png$/u);
      assert.equal(existsSync(outputPath(iconPath)), true, `${iconPath} should be emitted`);
      const expectedSize = Number(iconPath.match(/(\d+)\.png$/u)?.[1]);
      const header = readPngHeader(outputPath(iconPath));
      assert.equal(header.width, expectedSize);
      assert.equal(header.height, expectedSize);
    }

    assert.equal(existsSync(outputPath('icon', 'logo6.png')), false, 'legacy logo6 icon should not be emitted');
    assert.equal(existsSync(outputPath('background.js')), true, 'background.js should be emitted');
  });
});
