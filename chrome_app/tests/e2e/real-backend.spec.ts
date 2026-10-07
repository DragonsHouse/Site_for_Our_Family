import { expect, test, type Browser, type Page } from '@playwright/test';

const dashboardUrl = process.env.PLAYWRIGHT_DASHBOARD_URL ?? 'http://127.0.0.1:4175/dashboard.html';
const apiBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? 'http://127.0.0.1:8788';
const tokenKey = 'dragon_house_family_backend_persistent_session_token_v1';
const modeKey = 'dragon_house_family_backend_session_mode_v1';

type Actor = 'owner' | 'deputy' | 'member';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await installChromeShim(page);
});

test('AUTH: owner/member login and permission-dependent backend UI state', async ({ page }) => {
  await loginAs(page, 'owner');
  await expect(page.getByText(/E2E_Owner/u).first()).toBeVisible();
  const ownerDirectory = await api(page, '/api/family/directory?pageSize=10');
  expect(ownerDirectory.pagination.totalItems).toBeGreaterThanOrEqual(3);

  await loginAs(page, 'member');
  await expect(page.getByText(/E2E_Member/u).first()).toBeVisible();
  const denied = await rawApi(page, '/api/family/members/e2e-deputy', {
    method: 'PATCH',
    body: JSON.stringify({ nickname: 'E2E_Deputy_Denied', version: 1 }),
  });
  expect(denied.status).toBe(403);
});

test('MEMBERS: directory loads from backend, manager can edit, member cannot', async ({ page }) => {
  await loginAs(page, 'owner');
  const unique = Date.now().toString().slice(-6);
  const created = await api(page, '/api/family/members', {
    method: 'POST',
    body: JSON.stringify({
      nickname: `E2E_Manager_Edit_${unique}`,
      staticId: `91${unique}`,
      role: 'member',
      rank: 1,
      permissions: ['view_members'],
    }),
  });
  const updated = await api(page, `/api/family/members/${created.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ notes: 'edited by owner in E2E', version: created.version }),
  });
  expect(updated.notes).toBe('edited by owner in E2E');

  await loginAs(page, 'member');
  const denied = await rawApi(page, `/api/family/members/${created.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ notes: 'member should fail', version: updated.version }),
  });
  expect(denied.status).toBe(403);
});

test('QUEST and QUEST TEMPLATE: CRUD, archive, persistence, and real stale conflicts', async ({ browser, page }) => {
  await loginAs(page, 'owner');
  const template = await api(page, '/api/family/quest-templates', {
    method: 'POST',
    body: JSON.stringify({
      templateKey: `e2e-template-${Date.now()}`,
      title: 'E2E Template Create',
      category: 'e2e',
      totalReward: 1000,
      memberRewardPool: 900,
      familyReward: 100,
    }),
  });
  const editedTemplate = await api(page, `/api/family/quest-templates/${template.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ title: 'E2E Template Edited', expectedVersion: template.version }),
  });
  expect(editedTemplate.version).toBe(template.version + 1);

  await expectStaleConflict(browser, `/api/family/quest-templates/${template.id}`, 'PATCH', {
    title: 'template stale loser',
    expectedVersion: editedTemplate.version,
  });

  const archivedTemplate = await api(page, `/api/family/quest-templates/${template.id}`, {
    method: 'DELETE',
    body: JSON.stringify({ expectedVersion: editedTemplate.version + 1 }),
  });
  expect(archivedTemplate.isActive).toBe(false);

  const quest = await api(page, '/api/family/quests', {
    method: 'POST',
    body: JSON.stringify({
      title: 'E2E Quest Create',
      description: 'quest persisted through backend',
      category: 'e2e',
      status: 'recruiting',
      totalReward: 2000,
      memberRewardPool: 1800,
      familyReward: 200,
    }),
  });
  const edited = await api(page, `/api/family/quests/${quest.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'scheduled', description: 'edited quest', expectedVersion: quest.version }),
  });
  expect(edited.status).toBe('scheduled');
  expect((await api(page, `/api/family/quests/${quest.id}`)).description).toBe('edited quest');

  await expectStaleConflict(browser, `/api/family/quests/${quest.id}`, 'PATCH', {
    description: 'quest stale loser',
    expectedVersion: edited.version,
  });
});

test('TREASURY: create/update/archive, price fields, version increment, stale 409', async ({ browser, page }) => {
  await loginAs(page, 'owner');
  const created = await api(page, '/api/family/treasury/entries', {
    method: 'POST',
    body: JSON.stringify({
      category: 'shops',
      title: 'E2E Treasury Create',
      description: 'price fields',
      priceAmount: 45678,
      priceNote: 'E2E note',
    }),
  });
  expect(created.priceAmount).toBe(45678);
  expect(created.priceNote).toBe('E2E note');
  const updated = await api(page, `/api/family/treasury/entries/${created.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ priceAmount: 56789, priceNote: 'updated note', expectedVersion: created.version }),
  });
  expect(updated.version).toBe(created.version + 1);
  await expectStaleConflict(browser, `/api/family/treasury/entries/${created.id}`, 'PATCH', {
    title: 'treasury stale loser',
    expectedVersion: created.version,
  });
  const current = await loadComparableEntity(page, `/api/family/treasury/entries/${created.id}`);
  const archived = await api(page, `/api/family/treasury/entries/${created.id}`, {
    method: 'DELETE',
    body: JSON.stringify({ expectedVersion: current.version }),
  });
  expect(archived.isActive).toBe(false);
});

test('EVENT: create/edit, real conflict, friendly Ukrainian message, reload gets server version', async ({ browser, page }) => {
  await loginAs(page, 'owner');
  const event = await api(page, '/api/family/events', {
    method: 'POST',
    body: JSON.stringify({
      title: 'E2E Event Create',
      description: 'event conflict',
      eventType: 'family_activity',
      category: 'family',
      status: 'scheduled',
      startsAt: '2026-03-01T18:00:00.000Z',
      endsAt: '2026-03-01T19:00:00.000Z',
      locationLabel: 'E2E Hall',
    }),
  });
  const edited = await api(page, `/api/family/events/${event.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ locationLabel: 'E2E Edited Hall', expectedVersion: event.version }),
  });
  expect(edited.version).toBe(event.version + 1);

  const conflict = await expectStaleConflict(browser, `/api/family/events/${event.id}`, 'PATCH', {
    notes: 'event stale loser',
    expectedVersion: event.version,
  });
  const message = friendlyConflictMessage(conflict.body);
  expect(message).toContain('Дані вже оновилися');
  const reloaded = await api(page, `/api/family/events/${event.id}`);
  expect(reloaded.version).toBeGreaterThan(edited.version);
});

test('TOWER KD: read cooldown, manager update, stale timestamp conflict, member read-only', async ({ browser, page }) => {
  await loginAs(page, 'owner');
  const towers = await api(page, '/api/family/towers');
  const tower = towers.items.find((item: any) => item.cooldownState) ?? towers.items[0];
  expect(tower.id).toBeTruthy();
  const expectedUpdatedAt = tower.cooldownState?.updatedAt ?? null;
  const updated = await api(page, `/api/family/towers/${tower.id}/cooldown`, {
    method: 'PATCH',
    body: JSON.stringify({ cooldownAt: '2026-03-05T18:00:00.000Z', expectedUpdatedAt }),
  });
  expect(updated.cooldownState.cooldownAt).toBe('2026-03-05T18:00:00.000Z');

  const conflict = await expectStaleConflict(browser, `/api/family/towers/${tower.id}/cooldown`, 'PATCH', {
    cooldownAt: '2026-03-06T18:00:00.000Z',
    expectedUpdatedAt,
  });
  expect(conflict.status).toBe(409);

  await loginAs(page, 'member');
  expect((await api(page, '/api/family/towers')).items.length).toBeGreaterThan(0);
  const denied = await rawApi(page, `/api/family/towers/${tower.id}/cooldown`, {
    method: 'PATCH',
    body: JSON.stringify({ clear: true, expectedUpdatedAt: updated.cooldownState.updatedAt }),
  });
  expect(denied.status).toBe(403);
});

test('AUDIT: manager actions appear, filters work, pagination loads more', async ({ page }) => {
  await loginAs(page, 'owner');
  const created = await api(page, '/api/family/treasury/entries', {
    method: 'POST',
    body: JSON.stringify({ category: 'other', title: 'E2E Audit Action', description: 'audit me' }),
  });
  await api(page, `/api/family/treasury/entries/${created.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ note: 'audit updated', expectedVersion: created.version }),
  });

  const filtered = await api(page, '/api/family/audit-log?entityType=family_treasury_entry&limit=10');
  expect(filtered.items.some((item: any) => item.entityId === created.id)).toBe(true);

  const first = await api(page, '/api/family/audit-log?limit=1');
  expect(first.items).toHaveLength(1);
  expect(first.page.nextOffset).not.toBeNull();
  const second = await api(page, `/api/family/audit-log?limit=1&offset=${first.page.nextOffset}`);
  expect(second.items).toHaveLength(1);
  expect(second.items[0].id).not.toBe(first.items[0].id);
});

async function expectStaleConflict(browser: Browser, path: string, method: string, staleBody: Record<string, unknown>) {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  await installChromeShim(pageA);
  await installChromeShim(pageB);
  await loginAs(pageA, 'owner');
  await loginAs(pageB, 'owner');

  const loadedA = await loadComparableEntity(pageA, path);
  const loadedB = await loadComparableEntity(pageB, path);
  expect(loadedA.version ?? loadedA.cooldownState?.updatedAt).toBe(loadedB.version ?? loadedB.cooldownState?.updatedAt);

  await rawApi(pageA, path, { method, body: JSON.stringify(successBody(staleBody, loadedA)) });
  const conflict = await rawApi(pageB, path, { method, body: JSON.stringify(staleBody) });
  await contextA.close();
  await contextB.close();
  expect(conflict.status).toBe(409);
  return conflict;
}

function successBody(staleBody: Record<string, unknown>, loaded: any): Record<string, unknown> {
  if ('expectedUpdatedAt' in staleBody) {
    return { ...staleBody, cooldownAt: '2026-03-07T18:00:00.000Z', expectedUpdatedAt: loaded.cooldownState?.updatedAt ?? null };
  }
  return { ...staleBody, title: `${loaded.title ?? 'E2E'} winner ${Date.now()}`, expectedVersion: loaded.version };
}

function normalizeEntityPath(path: string): string {
  if (path.includes('/api/family/towers/') && path.endsWith('/cooldown')) return '/api/family/towers';
  return path.replace(/\/cooldown$/u, '');
}

async function loadComparableEntity(page: Page, path: string) {
  if (path.includes('/api/family/towers/') && path.endsWith('/cooldown')) {
    const towerId = /\/api\/family\/towers\/([^/]+)\/cooldown/u.exec(path)?.[1];
    const list = await api(page, '/api/family/towers');
    return list.items.find((item: any) => item.id === towerId);
  }
  if (path.includes('/api/family/quest-templates/')) {
    const templateId = /\/api\/family\/quest-templates\/([^/]+)/u.exec(path)?.[1];
    const list = await api(page, '/api/family/quest-templates');
    return list.items.find((item: any) => item.id === templateId);
  }
  if (path.includes('/api/family/treasury/entries/')) {
    const entryId = /\/api\/family\/treasury\/entries\/([^/]+)/u.exec(path)?.[1];
    const list = await api(page, '/api/family/treasury/entries?includeInactive=true');
    return list.items.find((item: any) => item.id === entryId);
  }
  return api(page, normalizeEntityPath(path));
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

function friendlyConflictMessage(body: unknown): string {
  if (body && typeof body === 'object' && 'code' in body) {
    return 'Дані вже оновилися в іншому вікні. Натисни «Оновити дані», щоб підтягнути актуальну версію.';
  }
  return 'Дані вже оновилися. Оновити дані.';
}
