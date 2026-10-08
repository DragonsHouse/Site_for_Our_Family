import { expect, test, type Browser, type Page, type Response } from '@playwright/test';

const dashboardUrl = process.env.PLAYWRIGHT_DASHBOARD_URL ?? 'http://127.0.0.1:4176/dashboard.html';
const apiBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? 'http://127.0.0.1:8788';
const tokenKey = 'dragon_house_family_backend_persistent_session_token_v1';
const modeKey = 'dragon_house_family_backend_session_mode_v1';

const seededTemplateId = '10000000-0000-4000-8000-000000000001';
const seededQuestId = '10000000-0000-4000-8000-000000000101';
const seededEventId = '10000000-0000-4000-8000-000000000201';
const seededTreasuryEntryId = 'e2e-treasury-entry';

type Actor = 'owner' | 'deputy' | 'member';

test.describe.configure({ mode: 'serial' });

test('QUEST: visible multi-context stale edit shows conflict and refreshes server version', async ({ browser }) => {
  const { pageA, pageB, close } = await openActorPair(browser);
  try {
    await openQuestCard(pageA, seededQuestId);
    await openQuestCard(pageB, seededQuestId);
    await openQuestEditor(pageA, seededQuestId);
    await openQuestEditor(pageB, seededQuestId);

    const winner = `E2E Quest UI winner ${Date.now()}`;
    const loser = `E2E Quest UI stale ${Date.now()}`;
    await pageA.getByTestId('quest-editor-description').fill(winner);
    await saveAndExpectOk(pageA, 'PATCH', `/api/family/quests/${seededQuestId}`, () => pageA.getByTestId('quest-editor-save').click());
    await openQuestCard(pageA, seededQuestId);
    await expect(pageA.locator(`[data-quest-id="${seededQuestId}"]`)).toContainText(winner);

    await pageB.getByTestId('quest-editor-description').fill(loser);
    await saveAndExpectConflict(pageB, 'PATCH', `/api/family/quests/${seededQuestId}`, () => pageB.getByTestId('quest-editor-save').click());
    await expect(pageB.getByTestId('quest-operation-message')).toContainText(/змінив|оновил|верс/u);
    await expect(pageB.getByTestId('quest-conflict-refresh')).toBeVisible();
    await pageB.getByTestId('quest-conflict-refresh').click();
    await expect(pageB.locator(`[data-quest-id="${seededQuestId}"]`)).toContainText(winner);
    await expect(pageB.locator(`[data-quest-id="${seededQuestId}"]`)).not.toContainText(loser);
    expect((await api(pageB, `/api/family/quests/${seededQuestId}`)).description).toBe(winner);
  } finally {
    await close();
  }
});

test('QUEST TEMPLATE: visible stale edit and stale archive show friendly conflict', async ({ browser }) => {
  const { pageA, pageB, close } = await openActorPair(browser);
  try {
    await openQuestCard(pageA, seededTemplateId);
    await openQuestCard(pageB, seededTemplateId);
    await openTemplateEditor(pageA, seededTemplateId);
    await openTemplateEditor(pageB, seededTemplateId);

    const winner = `E2E Template UI winner ${Date.now()}`;
    const loser = `E2E Template UI stale ${Date.now()}`;
    await pageA.getByTestId('quest-editor-title').fill(winner);
    await saveAndExpectOk(pageA, 'PATCH', `/api/family/quest-templates/${seededTemplateId}`, () => pageA.getByTestId('quest-editor-save').click());
    await expect(pageA.locator(`[data-template-id="${seededTemplateId}"]`)).toContainText(winner);

    await pageB.getByTestId('quest-editor-title').fill(loser);
    await saveAndExpectConflict(pageB, 'PATCH', `/api/family/quest-templates/${seededTemplateId}`, () => pageB.getByTestId('quest-editor-save').click());
    await expect(pageB.getByTestId('quest-operation-message')).toContainText(/змінив|оновил|верс/u);
    await expect(pageB.getByTestId('quest-conflict-refresh')).toBeVisible();
    await pageB.getByTestId('quest-conflict-refresh').click();
    await expect(pageB.locator(`[data-template-id="${seededTemplateId}"]`)).toContainText(winner);
    await expect(pageB.locator(`[data-template-id="${seededTemplateId}"]`)).not.toContainText(loser);

    const { pageA: archiveA, pageB: archiveB, close: closeArchive } = await openActorPair(browser);
    try {
      await openQuestCard(archiveA, seededTemplateId);
      await openQuestCard(archiveB, seededTemplateId);
      await openTemplateEditor(archiveA, seededTemplateId);
      await archiveA.getByTestId('quest-editor-description').fill(`archive winner ${Date.now()}`);
      await saveAndExpectOk(archiveA, 'PATCH', `/api/family/quest-templates/${seededTemplateId}`, () => archiveA.getByTestId('quest-editor-save').click());

      archiveB.once('dialog', (dialog) => dialog.accept());
      await saveAndExpectConflict(archiveB, 'DELETE', `/api/family/quest-templates/${seededTemplateId}`, () =>
        archiveB.locator(`[data-template-id="${seededTemplateId}"]`).getByTestId('quest-template-archive').click(),
      );
      await expect(archiveB.getByTestId('quest-operation-message')).toContainText(/змінив|оновил|верс/u);
    } finally {
      await closeArchive();
    }
  } finally {
    await close();
  }
});

test('EVENT: visible multi-context stale edit shows conflict and reloads server value', async ({ browser }) => {
  const { pageA, pageB, close } = await openActorPair(browser);
  try {
    await openEventEditor(pageA, seededEventId);
    await openEventEditor(pageB, seededEventId);

    const winner = `E2E Event UI winner ${Date.now()}`;
    const loser = `E2E Event UI stale ${Date.now()}`;
    await pageA.getByTestId('event-form-title').fill(winner);
    await saveAndExpectOk(pageA, 'PATCH', `/api/family/events/${seededEventId}`, () => pageA.getByTestId('event-form-save').click());
    await expect(pageA.locator(`[data-event-id="${seededEventId}"]`)).toContainText(winner);

    await pageB.getByTestId('event-form-title').fill(loser);
    await saveAndExpectConflict(pageB, 'PATCH', `/api/family/events/${seededEventId}`, () => pageB.getByTestId('event-form-save').click());
    await expect(pageB.getByTestId('event-conflict-message')).toContainText(/змінив|онов/u);
    await pageB.getByTestId('event-conflict-refresh').click();
    await expect(pageB.locator(`[data-event-id="${seededEventId}"]`)).toContainText(winner);
    await expect(pageB.locator(`[data-event-id="${seededEventId}"]`)).not.toContainText(loser);
    expect((await api(pageB, `/api/family/events/${seededEventId}`)).title).toBe(winner);
  } finally {
    await close();
  }
});

test('TREASURY: visible stale price edit shows conflict, refreshes, and keeps archive version-safe', async ({ browser }) => {
  const { pageA, pageB, close } = await openActorPair(browser);
  try {
    const cardA = await openTreasuryEntry(pageA, seededTreasuryEntryId);
    const cardB = await openTreasuryEntry(pageB, seededTreasuryEntryId);

    const winnerAmount = String(70000 + (Date.now() % 1000));
    const winnerNote = `winner note ${Date.now()}`;
    const loserAmount = String(90000 + (Date.now() % 1000));

    await cardA.getByTestId('treasury-entry-edit').click();
    await cardB.getByTestId('treasury-entry-edit').click();
    await expectNoBackendResponse(pageA, 'PATCH', `/api/family/treasury/entries/${seededTreasuryEntryId}`, async () => {
      await cardA.getByTestId('treasury-entry-price-amount').fill(winnerAmount);
      await cardA.getByTestId('treasury-entry-price-note').fill(winnerNote);
    });
    await saveAndExpectOk(pageA, 'PATCH', `/api/family/treasury/entries/${seededTreasuryEntryId}`, () => cardA.getByTestId('treasury-entry-save').click());

    await expectNoBackendResponse(pageB, 'PATCH', `/api/family/treasury/entries/${seededTreasuryEntryId}`, () => cardB.getByTestId('treasury-entry-price-amount').fill(loserAmount));
    await saveAndExpectConflict(pageB, 'PATCH', `/api/family/treasury/entries/${seededTreasuryEntryId}`, () => cardB.getByTestId('treasury-entry-save').click());
    await expect(pageB.getByTestId('treasury-error')).toContainText(/Скарбниц|Оновити дані/u);
    await pageB.getByTestId('treasury-conflict-refresh').click();
    const refreshedB = pageB.locator(`[data-entry-id="${seededTreasuryEntryId}"]`);
    await expect(refreshedB).toContainText(Number(winnerAmount).toLocaleString('uk-UA'));
    await expect(refreshedB).toContainText(winnerNote);

    const { pageA: archiveA, pageB: archiveB, close: closeArchive } = await openActorPair(browser);
    try {
      const staleArchiveCard = await openTreasuryEntry(archiveB, seededTreasuryEntryId);
      const currentArchiveCard = await openTreasuryEntry(archiveA, seededTreasuryEntryId);
      await currentArchiveCard.getByTestId('treasury-entry-edit').click();
      await staleArchiveCard.getByTestId('treasury-entry-edit').click();
      await currentArchiveCard.getByTestId('treasury-entry-title').fill(`Archive winner ${Date.now()}`);
      await saveAndExpectOk(archiveA, 'PATCH', `/api/family/treasury/entries/${seededTreasuryEntryId}`, () => currentArchiveCard.getByTestId('treasury-entry-save').click());
      await saveAndExpectConflict(archiveB, 'DELETE', `/api/family/treasury/entries/${seededTreasuryEntryId}`, () => staleArchiveCard.getByTestId('treasury-entry-archive').click());
      await expect(archiveB.getByTestId('treasury-error')).toContainText(/Скарбниц|Оновити дані/u);
    } finally {
      await closeArchive();
    }
  } finally {
    await close();
  }
});

test('TOWER KD: visible stale manual update conflicts and member remains read-only', async ({ browser }) => {
  const { pageA, pageB, close } = await openActorPair(browser);
  try {
    const towerId = (await api(pageA, '/api/family/towers')).items[0].id;
    const cardA = await openTowerCooldown(pageA, towerId);
    const cardB = await openTowerCooldown(pageB, towerId);

    await cardA.getByTestId('tower-cooldown-input').fill('2026-03-08T18:00');
    await saveAndExpectOk(pageA, 'PATCH', `/api/family/towers/${towerId}/cooldown`, () => cardA.getByTestId('tower-cooldown-update').click());

    await cardB.getByTestId('tower-cooldown-input').fill('2026-03-09T18:00');
    await saveAndExpectConflict(pageB, 'PATCH', `/api/family/towers/${towerId}/cooldown`, () => cardB.getByTestId('tower-cooldown-update').click());
    await expect(pageB.getByTestId('tower-conflict-message')).toContainText(/КД|Оновити дані/u);
    await pageB.getByTestId('tower-conflict-refresh').click();
    await expect(pageB.locator(`[data-tower-id="${towerId}"]`)).toContainText(/2026|КД/u);

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    try {
      await installChromeShim(memberPage);
      await loginAs(memberPage, 'member');
      const memberCard = await openTowerCooldown(memberPage, towerId);
      await expect(memberCard.getByTestId('tower-cooldown-update')).toHaveCount(0);
      await expect(memberCard).toBeVisible();
    } finally {
      await memberContext.close();
    }
  } finally {
    await close();
  }
});

async function openActorPair(browser: Browser) {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  await installChromeShim(pageA);
  await installChromeShim(pageB);
  await loginAs(pageA, 'owner');
  await loginAs(pageB, 'owner');
  return {
    pageA,
    pageB,
    close: async () => {
      await contextA.close();
      await contextB.close();
    },
  };
}

async function openQuestCard(page: Page, id: string) {
  await page.getByTestId('dragon-room-family').click();
  await page.getByTestId('family-section-quests').click();
  const selector = id === seededQuestId ? `[data-quest-id="${id}"]` : `[data-template-id="${id}"]`;
  const card = page.locator(selector);
  await expect(card).toBeVisible();
  return card;
}

async function openQuestEditor(page: Page, questId: string) {
  const card = await openQuestCard(page, questId);
  await card.getByTestId('quest-edit').click();
  await expect(page.getByTestId('quest-editor')).toBeVisible();
}

async function openTemplateEditor(page: Page, templateId: string) {
  const card = await openQuestCard(page, templateId);
  await card.getByTestId('quest-template-edit').click();
  await expect(page.getByTestId('quest-editor')).toBeVisible();
}

async function openEventEditor(page: Page, eventId: string) {
  await page.getByTestId('dragon-room-events').click();
  const card = page.locator(`[data-event-id="${eventId}"]`);
  await expect(card).toBeVisible();
  await card.getByTestId('event-card-open').click();
  await page.getByTestId('event-edit').click();
  await expect(page.getByTestId('event-form-title')).toBeVisible();
}

async function openTreasuryEntry(page: Page, entryId: string) {
  await page.getByTestId('dragon-room-family').click();
  await page.getByTestId('family-section-economy').click();
  const card = page.locator(`[data-entry-id="${entryId}"]`);
  await expect(card).toBeVisible();
  return card;
}

async function openTowerCooldown(page: Page, towerId: string) {
  await page.getByTestId('dragon-room-tower-defense').click();
  const card = page.locator(`[data-tower-id="${towerId}"]`);
  await expect(card).toBeVisible();
  return card;
}

async function saveAndExpectOk(page: Page, method: string, path: string, action: () => Promise<unknown>) {
  const responsePromise = page.waitForResponse((response) =>
    response.url().includes(path) && response.request().method() === method && response.status() >= 200 && response.status() < 300,
  );
  await action();
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
}

async function saveAndExpectConflict(page: Page, method: string, path: string, action: () => Promise<unknown>) {
  const responsePromise = page.waitForResponse((response) =>
    response.url().includes(path) && response.request().method() === method && response.status() === 409,
  );
  await action();
  const response = await responsePromise;
  expect(response.status()).toBe(409);
}

async function expectNoBackendResponse(page: Page, method: string, path: string, action: () => Promise<unknown>) {
  let matched = false;
  const listener = (response: Response) => {
    if (response.url().includes(path) && response.request().method() === method) matched = true;
  };
  page.on('response', listener);
  try {
    await action();
    await page.waitForTimeout(350);
    expect(matched).toBe(false);
  } finally {
    page.off('response', listener);
  }
}

async function installChromeShim(page: Page) {
  await page.addInitScript(() => {
    const storagePrefix = '__playwright_chrome_storage__';
    const readStorage = (key: string): unknown => {
      const raw = window.localStorage.getItem(`${storagePrefix}${key}`);
      if (raw === null) return undefined;
      try {
        return JSON.parse(raw);
      } catch {
        return undefined;
      }
    };
    const writeStorage = (key: string, item: unknown) => {
      window.localStorage.setItem(`${storagePrefix}${key}`, JSON.stringify(item));
    };
    const removeStorage = (key: string) => {
      window.localStorage.removeItem(`${storagePrefix}${key}`);
    };
    const readAllStorage = () => {
      const entries: [string, unknown][] = [];
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!key?.startsWith(storagePrefix)) continue;
        entries.push([key.slice(storagePrefix.length), readStorage(key.slice(storagePrefix.length))]);
      }
      return Object.fromEntries(entries);
    };
    const area = {
      get: async (key?: string | string[]) => {
        if (!key) return readAllStorage();
        if (Array.isArray(key)) return Object.fromEntries(key.map((item) => [item, readStorage(item)]));
        return { [key]: readStorage(key) };
      },
      set: async (value: Record<string, unknown>) => {
        for (const [key, item] of Object.entries(value)) writeStorage(key, item);
      },
      remove: async (key: string | string[]) => {
        for (const item of Array.isArray(key) ? key : [key]) removeStorage(item);
      },
    };
    Object.defineProperty(window, 'chrome', {
      value: {
        runtime: { id: 'playwright-extension', getURL: (value: string) => value },
        storage: { local: area, session: area, sync: { get: async () => ({}), set: async () => undefined } },
        tabs: { create: async () => undefined },
        notifications: { create: async () => undefined },
      },
      configurable: true,
    });
  });
}

async function loginAs(page: Page, actor: Actor) {
  await page.goto(dashboardUrl);
  const result = await page.request.post(`${apiBaseUrl}/api/e2e/auth/login`, { data: { actor, rememberMe: true } });
  expect(result.ok()).toBe(true);
  const body = await result.json();
  await page.evaluate(
    async ({ token, tokenKeyValue, modeKeyValue }) => {
      await chrome.storage.local.set({ [tokenKeyValue]: token, [modeKeyValue]: 'persistent' });
      window.localStorage.setItem(tokenKeyValue, token);
      window.localStorage.setItem(modeKeyValue, 'persistent');
    },
    { token: body.token, tokenKeyValue: tokenKey, modeKeyValue: modeKey },
  );
  await page.reload();
  await expect(page.locator('#root')).not.toHaveText('');
  await expect(page.getByText(actor === 'owner' ? /E2E_Owner/u : actor === 'deputy' ? /E2E_Deputy/u : /E2E_Member/u).first()).toBeVisible();
}

async function api(page: Page, path: string, init: RequestInit = {}) {
  const response = await rawApi(page, path, init);
  expect(response.status, JSON.stringify(response.body)).toBeGreaterThanOrEqual(200);
  expect(response.status, JSON.stringify(response.body)).toBeLessThan(300);
  return response.body;
}

async function rawApi(page: Page, path: string, init: RequestInit = {}) {
  return page.evaluate(
    async ({ apiBaseUrlValue, pathValue, initValue, tokenKeyValue }) => {
      const token = window.localStorage.getItem(tokenKeyValue);
      const headers = new Headers(initValue.headers);
      headers.set('Accept', 'application/json');
      if (initValue.body) headers.set('Content-Type', 'application/json');
      if (token) headers.set('Authorization', `Bearer ${token}`);
      const response = await fetch(`${apiBaseUrlValue}${pathValue}`, { ...initValue, headers });
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      return { status: response.status, body };
    },
    { apiBaseUrlValue: apiBaseUrl, pathValue: path, initValue: init, tokenKeyValue: tokenKey },
  );
}
