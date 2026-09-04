import { createHash } from 'node:crypto';
import type { FamilyQuestDto } from '../quests/quest-service.js';
import type { TowerDefenseDto } from '../tower-defense/tower-defense-service.js';
import type { FamilyEventDto } from '../family-events/family-event-service.js';
import type { DiscordMessagePayload } from './orchestration-models.js';

export function renderQuestMessage(quest: FamilyQuestDto): DiscordMessagePayload {
  return {
    content: [
      `🐉 **${quest.title}**`,
      `Status: ${quest.status}`,
      quest.description ? `\n${quest.description}` : '',
      quest.startsAt ? `Час: ${formatDate(quest.startsAt)}` : null,
      `Учасники: ${quest.participants.filter((item) => !item.leftAt).length}`,
      `Помічники: ${quest.helpers.filter((item) => !item.leftAt).length}`,
      quest.memberRewardPool > 0 ? `Фонд людям: ${formatMoney(quest.memberRewardPool)}` : null,
    ].filter(Boolean).join('\n'),
    components: [
      actionRow([
        button(`dh:q:join:${quest.id}`, 'Приєднатися', 'primary'),
        button(`dh:q:help:${quest.id}`, 'Допомагати', 'secondary'),
        button(`dh:q:withdraw:${quest.id}`, 'Вийти', 'secondary'),
        button(`dh:q:details:${quest.id}`, 'Деталі', 'secondary'),
      ]),
    ],
  };
}

export function renderTowerDefenseMessage(defense: TowerDefenseDto): DiscordMessagePayload {
  return {
    content: [
      `🔥 **${defense.title}**`,
      `Вишка: ${defense.tower.name}`,
      `Status: ${defense.status}`,
      `Час: ${formatDate(defense.startsAt)}`,
      `Commander: ${defense.commanderDisplayName ?? 'не вказано'}`,
      `Потрібно людей: ${defense.minimumGuardCount}`,
      `Підтвердили: ${defense.confirmedCount}`,
      `Готовність: ${defense.presentCount}/${defense.minimumGuardCount}`,
    ].join('\n'),
    components: [
      actionRow([
        button(`dh:t:respond:${defense.id}:joining`, 'Йду', 'primary'),
        button(`dh:t:respond:${defense.id}:confirmed`, 'Підтверджую', 'success'),
        button(`dh:t:respond:${defense.id}:unavailable`, 'Не можу', 'danger'),
        button(`dh:t:withdraw:${defense.id}`, 'Відкликати', 'secondary'),
      ]),
    ],
  };
}

export function renderFamilyEventMessage(event: FamilyEventDto): DiscordMessagePayload {
  return {
    content: [
      `📅 **${event.title}**`,
      `Type: ${event.eventType}`,
      `Status: ${event.status}`,
      `Час: ${formatDate(event.startsAt)}`,
      event.locationLabel ? `Локація: ${event.locationLabel}` : null,
      `Організатор: ${event.organizerDisplayName ?? 'не вказано'}`,
      `Учасники: ${event.participantCount}`,
    ].filter(Boolean).join('\n'),
    components: [
      actionRow([
        button(`dh:e:respond:${event.id}:interested`, 'Цікавить', 'secondary'),
        button(`dh:e:respond:${event.id}:joining`, 'Йду', 'primary'),
        button(`dh:e:respond:${event.id}:confirmed`, 'Підтверджую', 'success'),
        button(`dh:e:respond:${event.id}:declined`, 'Не можу', 'danger'),
        button(`dh:e:withdraw:${event.id}`, 'Відкликати', 'secondary'),
      ]),
    ],
  };
}

export function payloadHash(payload: DiscordMessagePayload): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function actionRow(components: Array<Record<string, unknown>>) {
  return { type: 1, components };
}

function button(customId: string, label: string, style: 'primary' | 'secondary' | 'success' | 'danger') {
  const styles = { primary: 1, secondary: 2, success: 3, danger: 4 };
  return { type: 2, custom_id: customId, label, style: styles[style] };
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('uk-UA').format(amount);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('uk-UA', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Kyiv',
  }).format(new Date(value));
}
