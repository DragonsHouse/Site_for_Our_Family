import { createHash } from 'node:crypto';
import type { FamilyEventDto } from '../family-events/family-event-service.js';
import type { FamilyQuestDto } from '../quests/quest-service.js';
import type { TowerDefenseDto } from '../tower-defense/tower-defense-service.js';
import type { DiscordMessagePayload } from './orchestration-models.js';

const DISCORD_CONTENT_LIMIT = 2000;
const DISCORD_TRUNCATION_SUFFIX = '\n...';

export function renderQuestMessage(quest: FamilyQuestDto): DiscordMessagePayload {
  const activeParticipants = quest.participants.filter((item) => !item.leftAt);
  const activeHelpers = quest.helpers.filter((item) => !item.leftAt);
  const paid = quest.paidAt ? quest.totalReward : quest.payouts.reduce((sum, payout) => sum + (payout.status === 'paid' ? payout.amount : 0), 0);
  const remaining = Math.max(quest.totalReward - paid, 0);
  return withSafeContent({
    content: [
      `**${quest.title}**`,
      `Статус: ${questStatusLabel(quest.status)}`,
      quest.description ? `\n${quest.description}` : '',
      quest.startsAt ? `Час: ${formatDate(quest.startsAt)}` : null,
      `Учасники: ${activeParticipants.length}`,
      activeHelpers.length ? `Помічники: ${activeHelpers.map((item) => item.displayName).join(', ')}` : null,
      quest.totalReward > 0 ? `Загальна нагорода: ${formatMoney(quest.totalReward)}$` : null,
      quest.memberRewardPool > 0 ? `Фонд учасникам: ${formatMoney(quest.memberRewardPool)}$` : null,
      quest.familyReward > 0 ? `У сімейний банк: ${formatMoney(quest.familyReward)}$` : null,
      quest.requiredItems ? `Потрібно: ${quest.requiredItems}` : null,
      quest.totalReward > 0 && (paid > 0 || remaining > 0) ? `Виплачено: ${formatMoney(paid)}$ · Залишилось: ${formatMoney(remaining)}$` : null,
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
  const cooldownAt = readString(metadata.cooldownAt);
  const unavailableCount = defense.responses.filter((response) => response.response === 'unavailable').length;
  const goingCount = defense.responses.filter((response) => response.response === 'joining' || response.response === 'confirmed').length;
  return withSafeContent({
    content: [
      customMessage,
      `**${defense.title}**`,
      `Вишка: ${defense.tower.name}`,
      `Статус: ${towerStatusLabel(defense.status)}`,
      `КД: ${cooldownAt ? formatDate(cooldownAt) : 'немає актуального КД'}`,
      `Початок: ${formatDate(defense.startsAt)}`,
      defense.commanderDisplayName ? `Командир: ${defense.commanderDisplayName}` : null,
      `Мінімум: ${defense.minimumGuardCount}`,
      `Йдуть: ${goingCount}`,
      `Підтвердили: ${defense.confirmedCount}`,
      unavailableCount ? `Не можуть: ${unavailableCount}` : null,
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
      `Тип: ${eventTypeLabel(event.eventType)}`,
      `Статус: ${eventStatusLabel(event.status)}`,
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

function questStatusLabel(status: string): string {
  return {
    draft: 'чернетка',
    scheduled: 'заплановано',
    active: 'активний',
    completed: 'завершено',
    cancelled: 'скасовано',
  }[status] ?? status;
}

function towerStatusLabel(status: string): string {
  return {
    draft: 'чернетка',
    scheduled: 'заплановано',
    gathering: 'збір',
    active: 'активна оборона',
    completed: 'завершено',
    cancelled: 'скасовано',
  }[status] ?? status;
}

function eventStatusLabel(status: string): string {
  return {
    draft: 'чернетка',
    scheduled: 'заплановано',
    active: 'триває',
    completed: 'завершено',
    cancelled: 'скасовано',
  }[status] ?? status;
}

function eventTypeLabel(type: string): string {
  return {
    family_meeting: 'сімейна зустріч',
    training: 'тренування',
    rp_event: 'RP-подія',
    family_activity: 'сімейна активність',
    celebration: 'свято',
    announcement: 'оголошення',
    custom: 'інше',
  }[type] ?? type;
}
