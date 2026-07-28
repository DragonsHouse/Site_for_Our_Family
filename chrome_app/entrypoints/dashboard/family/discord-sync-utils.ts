import type { DiscordSyncPlan, DiscordSyncPlanFilter, DiscordSyncPlanItem } from './discord-sync-models';

export function filterPlanItems(plan: DiscordSyncPlan | null, filter: DiscordSyncPlanFilter, search: string) {
  if (!plan) return [];
  const term = search.trim().toLowerCase();
  return plan.items.filter((item) => {
    const filterMatches =
      filter === 'all' ||
      (filter === 'safe' ? item.safeToApply : filter === 'blocked' ? item.blocking : item.action === filter);
    if (!filterMatches) return false;
    if (!term) return true;
    return [
      item.discordIdentity.username,
      item.discordIdentity.globalName,
      item.discordIdentity.serverNickname,
      item.matchedFamilyMember?.nickname,
      item.discordUserId,
      item.reason
    ]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(term));
  });
}

export function canApplyPlan(plan: DiscordSyncPlan | null) {
  return Boolean(plan && !plan.stale && !plan.applied && plan.summary.blocked === 0 && plan.summary.safeToApply > 0);
}

export function createIdempotencyKey(planId: string) {
  const cryptoApi = typeof crypto !== 'undefined' ? crypto : null;
  const random = cryptoApi?.randomUUID ? cryptoApi.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `discord-sync-${planId}-${random}`.slice(0, 120);
}

export function discordSyncActionLabel(action: DiscordSyncPlanItem['action']) {
  const labels: Record<DiscordSyncPlanItem['action'], string> = {
    create: 'Новий',
    update: 'Оновлення',
    unchanged: 'Без змін',
    deactivate: 'Деактивація',
    conflict: 'Конфлікт',
    'ignored-bot': 'Бот',
    'ignored-unmapped': 'Ігноровано',
    error: 'Помилка'
  };
  return labels[action];
}

export function discordSyncMethodLabel(method: DiscordSyncPlanItem['match']['method']) {
  const labels: Record<DiscordSyncPlanItem['match']['method'], string> = {
    'account-link': 'Account link',
    'stored-discord-id': 'Stored Discord ID',
    'static-id': 'Static ID',
    'nickname-suggestion': 'Manual suggestion',
    none: 'No match',
    'not-applicable': 'Not applicable'
  };
  return labels[method];
}
