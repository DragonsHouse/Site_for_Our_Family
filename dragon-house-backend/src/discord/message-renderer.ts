import { createHash } from 'node:crypto';
import type { FamilyEventDto } from '../family-events/family-event-service.js';
import type { FamilyQuestDto } from '../quests/quest-service.js';
import type { TowerDefenseDto } from '../tower-defense/tower-defense-service.js';
import type { DiscordMessagePayload } from './orchestration-models.js';

const DISCORD_CONTENT_LIMIT = 2000;
const DISCORD_TRUNCATION_SUFFIX = '\n...';

export function renderQuestMessage(quest: FamilyQuestDto): DiscordMessagePayload {
  return withSafeContent({
    content: [
      `**${quest.title}**`,
      `Статус: ${quest.status}`,
      quest.description ? `\n${quest.description}` : '',
      quest.startsAt ? `Час: ${formatDate(quest.startsAt)}` : null,
      `Учасники: ${quest.participants.filter((item) => !item.leftAt).length}`,
      `Помічники: ${quest.helpers.filter((item) => !item.leftAt).length}`,
      quest.memberRewardPool > 0 ? `Фонд людям: ${formatMoney(quest.memberRewardPool)}` : null,
    ].filter(Boolean).join('\n'),
    components: [
      actionRow([
        button(`dh:q:join:${quest.id}`, 'Приєднатися', 'primary'),
        button(`dh:q:help:${quest.id}`, 'Допомогти', 'secondary'),
        button(`dh:q:withdraw:${quest.id}`, 'Вийти', 'secondary'),
        button(`dh:q:details:${quest.id}`, 'Деталі', 'secondary'),
      ]),
    ],
  });
}

export function renderTowerDefenseMessage(defense: TowerDefenseDto): DiscordMessagePayload {
  const metadata = readMetadata(defense.metadata);
  const customMessage = readString(metadata.announcementMessage);
  const initiator = readString(metadata.initiatorFamilyMemberId) ?? defense.createdByFamilyMemberId;
  return withSafeContent({
    content: [
      customMessage,
      `**${defense.title}**`,
      `Вишка: ${defense.tower.name}`,
      `Статус: ${defense.status}`,
      `Ініціатор: ${initiator}`,
      `Час: ${formatDate(defense.startsAt)}`,
      `Командир: ${defense.commanderDisplayName ?? 'не вказано'}`,
      `Потрібно людей: ${defense.minimumGuardCount}`,
      `Підтвердили: ${defense.confirmedCount}`,
      `Готовність: ${defense.presentCount}/${defense.minimumGuardCount}`,
    ].filter(Boolean).join('\n'),
    components: [
      actionRow([
        button(`dh:t:respond:${defense.id}:joining`, 'Йду', 'primary'),
        button(`dh:t:respond:${defense.id}:confirmed`, 'Підтверджую', 'success'),
        button(`dh:t:respond:${defense.id}:unavailable`, 'Не можу', 'danger'),
        button(`dh:t:withdraw:${defense.id}`, 'Відкликати', 'secondary'),
      ]),
    ],
  });
}

export function renderFamilyEventMessage(event: FamilyEventDto): DiscordMessagePayload {
  return withSafeContent({
    content: [
      `**${event.title}**`,
      `Тип: ${event.eventType}`,
      `Статус: ${event.status}`,
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
  });
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

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function withSafeContent(payload: DiscordMessagePayload): DiscordMessagePayload {
  if (payload.content.length <= DISCORD_CONTENT_LIMIT) return payload;
  return {
    ...payload,
    content: `${payload.content.slice(0, DISCORD_CONTENT_LIMIT - DISCORD_TRUNCATION_SUFFIX.length)}${DISCORD_TRUNCATION_SUFFIX}`,
  };
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
