import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const clientSource = readFileSync(new URL('../lib/family-discord-orchestration-client.ts', import.meta.url), 'utf8');
const panelSource = readFileSync(new URL('../entrypoints/dashboard/family/discord-publish-panel.tsx', import.meta.url), 'utf8');
const questSource = readFileSync(new URL('../entrypoints/dashboard/family/family-quests.tsx', import.meta.url), 'utf8');
const towerSource = readFileSync(new URL('../entrypoints/dashboard/family/dragon-tower-defense.tsx', import.meta.url), 'utf8');
const eventsSource = readFileSync(new URL('../entrypoints/dashboard/family/dragon-events.tsx', import.meta.url), 'utf8');
const permissionsSource = readFileSync(new URL('../lib/family-permissions.ts', import.meta.url), 'utf8');

describe('family Discord orchestration frontend', () => {
  it('uses canonical backend publish/sync routes for Quest, Tower and Event announcements', () => {
    assert.match(clientSource, /\/api\/family\/quests\/\$\{encodeURIComponent\(questId\)\}\/discord/u);
    assert.match(clientSource, /\/api\/family\/quests\/\$\{encodeURIComponent\(questId\)\}\/discord\/publish/u);
    assert.match(clientSource, /\/api\/family\/quests\/\$\{encodeURIComponent\(questId\)\}\/discord\/sync/u);
    assert.match(clientSource, /\/api\/family\/tower-defenses\/\$\{encodeURIComponent\(defenseId\)\}\/discord/u);
    assert.match(clientSource, /\/api\/family\/events\/\$\{encodeURIComponent\(eventId\)\}\/discord/u);
  });

  it('renders friendly Discord state labels and publish/sync actions without technical ids', () => {
    assert.match(panelSource, /Опублікувати в Discord/u);
    assert.match(panelSource, /Оновити в Discord/u);
    assert.match(panelSource, /Не опубліковано/u);
    assert.match(panelSource, /Опубліковано/u);
    assert.match(panelSource, /Синхронізовано/u);
    assert.match(panelSource, /Помилка синхронізації/u);
    assert.doesNotMatch(panelSource, /messageId|channelId|orchestration state/u);
  });

  it('keeps mutation guarded and server-confirmed', () => {
    assert.match(panelSource, /if \(mutating\) return/u);
    assert.match(panelSource, /disabled=\{mutating\}/u);
    assert.match(panelSource, /setState\(next\)/u);
    assert.doesNotMatch(panelSource, /optimistic/i);
    assert.doesNotMatch(panelSource, /mock/i);
  });

  it('mounts Hub publish controls only in manager-capable Quest, Tower and standalone Event surfaces', () => {
    assert.match(questSource, /DiscordPublishPanel target="quest"/u);
    assert.match(questSource, /quest\.backendQuestId/u);
    assert.match(towerSource, /DiscordPublishPanel target="tower"/u);
    assert.match(towerSource, /defense\.backendDefenseId/u);
    assert.match(eventsSource, /DiscordPublishPanel target="event"/u);
    assert.match(eventsSource, /isStandalone/u);
    assert.match(eventsSource, /event\.backendEventId/u);
    assert.match(permissionsSource, /rankLevel >= 8/u);
    assert.match(permissionsSource, /manage_discord_integration/u);
  });

  it('maps backend errors to friendly UI text and keeps production backend-only', () => {
    assert.match(clientSource, /Discord orchestration вимкнена/u);
    assert.match(clientSource, /Discord канал не налаштований/u);
    assert.match(clientSource, /У вас немає прав/u);
    assert.match(clientSource, /authenticatedFetch/u);
    assert.doesNotMatch(clientSource, /localStorage|mockDragon|fakeTransport/u);
  });
});
