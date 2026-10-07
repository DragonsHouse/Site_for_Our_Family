import { expect, test } from '@playwright/test';

const dashboardUrl = process.env.PLAYWRIGHT_DASHBOARD_URL ?? 'http://127.0.0.1:4175/dashboard.html';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const storage = new Map<string, unknown>();
    const api = {
      runtime: { id: 'playwright-extension', getURL: (value: string) => value },
      storage: {
        local: {
          get: async (key?: string | string[]) => {
            if (!key) return Object.fromEntries(storage);
            if (Array.isArray(key)) return Object.fromEntries(key.map((item) => [item, storage.get(item)]));
            return { [key]: storage.get(key) };
          },
          set: async (value: Record<string, unknown>) => {
            for (const [key, item] of Object.entries(value)) storage.set(key, item);
          },
          remove: async (key: string | string[]) => {
            for (const item of Array.isArray(key) ? key : [key]) storage.delete(item);
          },
        },
        sync: {
          get: async () => ({}),
          set: async () => undefined,
        },
      },
      tabs: { create: async () => undefined },
      notifications: { create: async () => undefined },
    };
    Object.defineProperty(window, 'chrome', { value: api, configurable: true });
  });
});

test('app opens and auth surface is interactive', async ({ page }) => {
  await page.goto(dashboardUrl);
  await expect(page.locator('#root')).not.toHaveText('');
  await expect(page.locator('input').first()).toBeVisible();

  const inputs = page.locator('input');
  if ((await inputs.count()) >= 2) {
    await inputs.nth(0).fill('manual-qa');
    await inputs.nth(1).fill('wrong-password');
  }
  const button = page.locator('button').first();
  await expect(button).toBeVisible();
  await button.click();
});

for (const route of ['profile', 'members', 'quests', 'economy', 'calendar', 'events', 'tower-defense', 'discord-sync']) {
  test(`deep link does not render a blank ${route} page`, async ({ page }) => {
    await page.goto(`${dashboardUrl}#${route}`);
    await expect(page.locator('#root')).not.toHaveText('');
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    expect(horizontalOverflow).toBe(false);
  });
}

test('modal-like controls can be opened and dismissed when present', async ({ page }) => {
  await page.goto(dashboardUrl);
  const buttons = page.locator('button');
  const count = Math.min(await buttons.count(), 6);
  for (let index = 0; index < count; index += 1) {
    const candidate = buttons.nth(index);
    if (!(await candidate.isVisible()) || !(await candidate.isEnabled())) continue;
    const label = await candidate.textContent();
    if (/discord|увійти|login|oauth/iu.test(label ?? '')) continue;
    await candidate.click().catch(() => undefined);
    await page.keyboard.press('Escape').catch(() => undefined);
  }
  await expect(page.locator('#root')).not.toHaveText('');
});
