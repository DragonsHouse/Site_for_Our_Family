import { useEffect, useState } from 'react';
import { canManageDiscordIntegration } from '../../../lib/family-permissions';
import type { FamilyUser } from '../../../lib/family-types';
import { listFamilyAuditLog, type FamilyAuditLogFilters, type FamilyAuditLogRecord } from '../../../lib/family-audit-log-client';
import {
  DragonBadge,
  DragonButton,
  DragonCard,
  DragonDialog,
  DragonEmptyState,
  DragonInput,
  DragonLoader,
  DragonPanel,
  DragonRetry,
  DragonSelect,
  DragonSkeleton
} from '../dragon-ui/dragon-ui';
import type { DiscordSyncAuditRecord, DiscordSyncPlanFilter, DiscordSyncPlanItem, DiscordSyncSummary } from './discord-sync-models';
import { discordSyncActionLabel, discordSyncMethodLabel } from './discord-sync-utils';
import { useDragonDiscordSyncState, type DragonDiscordSyncStateDependencies } from './discord-sync-state';

const PLAN_FILTERS: DiscordSyncPlanFilter[] = [
  'all',
  'safe',
  'blocked',
  'create',
  'update',
  'unchanged',
  'deactivate',
  'conflict',
  'error',
  'ignored-bot',
  'ignored-unmapped'
];

const PLAN_FILTER_LABELS: Record<DiscordSyncPlanFilter, string> = {
  all: 'Усі',
  safe: 'Безпечно застосувати',
  blocked: 'Заблоковані',
  create: 'Нові учасники',
  update: 'Оновлення',
  unchanged: 'Без змін',
  deactivate: 'Деактивації',
  conflict: 'Конфлікти',
  error: 'Помилки',
  'ignored-bot': 'Ігноровані боти',
  'ignored-unmapped': 'Без мапінгу ролей'
};

const formatDiscordSyncDateTime = (value?: string | null) => {
  if (!value) return 'Ще не було';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Kyiv'
  }).format(date);
};

const getBotAccessLabel = (status?: string | null) => {
  if (status === 'connected' || status === 'available' || status === 'ok') return 'Підключено';
  if (status === 'missing' || status === 'unavailable') return 'Недоступно';
  if (status === 'error') return 'Помилка';
  return 'Очікує';
};

const getAuditModeLabel = (mode: string) => (mode === 'apply' ? 'Застосовано' : 'Перевірка змін');
const getAuditStatusLabel = (status: string) => (status === 'succeeded' ? 'успішно' : status === 'failed' ? 'помилка' : 'очікує');

export function DragonDiscordSyncScreen({
  currentUser,
  dependencies
}: {
  currentUser: FamilyUser;
  dependencies?: DragonDiscordSyncStateDependencies;
}) {
  const sync = useDragonDiscordSyncState(dependencies);
  const [confirmApplyOpen, setConfirmApplyOpen] = useState(false);
  const canManage = canManageDiscordIntegration(currentUser);

  if (!canManage) {
    return (
      <DragonEmptyState
        title="Синхронізація Discord недоступна"
        description="Перегляд і застосування змін доступні лише керівництву Dragon House."
      />
    );
  }

  return (
    <div className="dh-discord-sync" data-discord-sync-engine="frontend">
      <DragonPanel variant="ceremonial" className="dh-discord-sync-hero">
        <div>
          <p className="dh-dragon-eyebrow">Discord</p>
          <h1>Синхронізація Discord</h1>
          <p>Перевірка зв'язків учасників, ролей і безпечне застосування змін через backend.</p>
        </div>
        <div className="dh-discord-sync-portal" aria-label="Стан підключення Discord">
          <DragonBadge tone={sync.status?.liveData ? 'success' : 'muted'}>
            {sync.status?.liveData ? 'Підключено' : 'Очікує'}
          </DragonBadge>
          <strong>{sync.status?.guildConfigured ? 'Сервер налаштовано' : 'Сервер не налаштовано'}</strong>
          <span>{sync.status?.roleMappingCount ?? 0} синхронізованих ролей</span>
        </div>
      </DragonPanel>

      {sync.loading ? <DragonDiscordSyncLoadingState /> : null}
      {sync.error ? <DragonDiscordSyncErrorState message={sync.error.message} onRetry={sync.refresh} /> : null}

      <DragonDiscordIntegrationStatus status={sync.status} roleMappingCount={sync.roleMappings.length} />

      <DragonPanel className="dh-discord-sync-controls">
        <div>
          <p className="dh-dragon-eyebrow">Керування</p>
          <h2>Перевірити зміни</h2>
          <p>Hub отримає поточний стан Discord, побудує план на backend і нічого не змінить без підтвердження.</p>
        </div>
        <div className="dh-discord-sync-actions">
          <DragonButton type="button" onClick={() => void sync.generateDryRun()} disabled={sync.runningDryRun}>
            {sync.runningDryRun ? 'Перевіряємо...' : 'Перевірити зміни'}
          </DragonButton>
          <DragonButton type="button" variant="secondary" onClick={() => setConfirmApplyOpen(true)} disabled={!sync.canApply || sync.applying}>
            {sync.applying ? 'Застосовуємо...' : 'Застосувати зміни'}
          </DragonButton>
        </div>
      </DragonPanel>

      {sync.plan ? (
        <>
          <DragonDiscordSummaryCards plan={sync.plan} />
          <DragonDiscordPlanFilters filter={sync.filter} search={sync.search} onFilterChange={sync.setFilter} onSearchChange={sync.setSearch} />
          <DragonDiscordPlanList items={sync.visibleItems} onSelect={sync.setSelectedItem} />
        </>
      ) : (
        <DragonEmptyState
          title="Змін для синхронізації немає"
          description="Натисни перевірку, щоб отримати актуальний стан Discord."
          action={
            <DragonButton type="button" variant="secondary" onClick={() => void sync.generateDryRun()}>
              Перевірити зміни
            </DragonButton>
          }
        />
      )}

      <DragonDiscordAuditHistory history={sync.history} onSelect={sync.setSelectedAudit} />
      <FamilyAuditLogPanel />

      {sync.selectedItem ? <DragonDiscordConflictDialog item={sync.selectedItem} onClose={() => sync.setSelectedItem(null)} /> : null}
      {sync.selectedAudit ? <DragonDiscordAuditDialog audit={sync.selectedAudit} onClose={() => sync.setSelectedAudit(null)} /> : null}
      {confirmApplyOpen ? (
        <DragonDiscordApplyDialog
          planSummary={sync.plan?.summary ?? null}
          applying={sync.applying}
          canApply={sync.canApply}
          onClose={() => setConfirmApplyOpen(false)}
          onApply={() => {
            void sync.applyPlan().finally(() => {
              setConfirmApplyOpen(false);
            });
          }}
        />
      ) : null}
    </div>
  );
}

export function DragonDiscordIntegrationStatus({
  status,
  roleMappingCount
}: {
  status: ReturnType<typeof useDragonDiscordSyncState>['status'];
  roleMappingCount: number;
}) {
  return (
    <section className="dh-discord-sync-status" aria-label="Стан синхронізації Discord">
      {[
        ['Статус бота', getBotAccessLabel(status?.botAccessStatus)],
        ['Сервер Discord', status?.guildConfigured ? 'Налаштовано' : 'Не налаштовано'],
        ['Прив’язані учасники', status?.linkedMemberCount ?? 0],
        ['Синхронізовані ролі', roleMappingCount],
        ['Остання синхронізація', formatDiscordSyncDateTime(status?.lastSuccessfulSynchronizationAt)]
      ].map(([label, value]) => (
        <DragonCard key={label} className="dh-discord-sync-status-card">
          <span className="dh-dragon-eyebrow">{label}</span>
          <strong>{value}</strong>
        </DragonCard>
      ))}
      <details className="dh-discord-sync-technical">
        <summary>Технічні деталі</summary>
        <dl>
          <div>
            <dt>ID сервера Discord</dt>
            <dd>{status?.guildId ?? 'немає'}</dd>
          </div>
          <div>
            <dt>Термін дії плану</dt>
            <dd>{status?.planTtlSeconds ?? 0}s</dd>
          </div>
        </dl>
      </details>
    </section>
  );
}

export function DragonDiscordSummaryCards({ plan }: { plan: NonNullable<ReturnType<typeof useDragonDiscordSyncState>['plan']> }) {
  const summary = plan.summary;
  const cards = [
    ['Нові учасники', summary.create, 'gold'],
    ['Оновлення', summary.update, 'ember'],
    ['Без змін', summary.unchanged, 'muted'],
    ['Деактивації', summary.deactivate, 'danger'],
    ['Конфлікти', summary.conflict, 'danger'],
    ['Ігноровані боти', summary.ignoredBot, 'muted']
  ] as const;
  return (
    <section className="dh-discord-sync-summary" aria-label="Підсумок синхронізації Discord">
      {cards.map(([label, value, tone]) => (
        <DragonCard key={label} className="dh-discord-sync-summary-card">
          <DragonBadge tone={tone}>{label}</DragonBadge>
          <strong>{value}</strong>
        </DragonCard>
      ))}
    </section>
  );
}

export function DragonDiscordPlanFilters({
  filter,
  search,
  onFilterChange,
  onSearchChange
}: {
  filter: DiscordSyncPlanFilter;
  search: string;
  onFilterChange: (filter: DiscordSyncPlanFilter) => void;
  onSearchChange: (search: string) => void;
}) {
  return (
    <DragonPanel className="dh-discord-sync-filters">
      <DragonInput
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.currentTarget.value)}
        placeholder="Пошук у Discord або Dragon House"
        aria-label="Пошук у плані синхронізації Discord"
      />
      <DragonSelect value={filter} onChange={(event) => onFilterChange(event.currentTarget.value as DiscordSyncPlanFilter)} aria-label="Фільтр плану синхронізації">
        {PLAN_FILTERS.map((option) => (
          <option key={option} value={option}>
            {PLAN_FILTER_LABELS[option]}
          </option>
        ))}
      </DragonSelect>
    </DragonPanel>
  );
}

export function DragonDiscordPlanList({ items, onSelect }: { items: DiscordSyncPlanItem[]; onSelect: (item: DiscordSyncPlanItem) => void }) {
  if (!items.length) {
    return <DragonEmptyState title="За цими фільтрами змін немає" description="Зміни фільтр або повтори перевірку." />;
  }
  return (
    <section className="dh-discord-sync-plan" aria-label="Пункти плану синхронізації Discord">
      {items.map((item) => (
        <DragonDiscordPlanItemCard key={item.id} item={item} onSelect={onSelect} />
      ))}
    </section>
  );
}

export function DragonDiscordPlanItemCard({ item, onSelect }: { item: DiscordSyncPlanItem; onSelect: (item: DiscordSyncPlanItem) => void }) {
  const identity = item.discordIdentity.serverNickname ?? item.discordIdentity.globalName ?? item.discordIdentity.username ?? item.discordUserId ?? 'Невідомий учасник';
  return (
    <DragonCard interactive className={`dh-discord-sync-item is-${item.action}`}>
      <button type="button" onClick={() => onSelect(item)} aria-label={`Відкрити пункт синхронізації ${identity}`}>
        <div>
          <DragonBadge tone={item.blocking ? 'danger' : item.safeToApply ? 'success' : 'muted'}>{discordSyncActionLabel(item.action)}</DragonBadge>
          <strong>{identity}</strong>
          <span>{item.matchedFamilyMember?.nickname ?? 'Немає безпечного збігу в Dragon House'}</span>
        </div>
        <dl>
          <div>
            <dt>Збіг</dt>
            <dd>{discordSyncMethodLabel(item.match.method)}</dd>
          </div>
          <div>
            <dt>Зміни</dt>
            <dd>{item.proposedFieldChanges.length}</dd>
          </div>
          <div>
            <dt>Роль</dt>
            <dd>{item.mappedRoles.primary?.discordRoleName ?? 'немає'}</dd>
          </div>
        </dl>
      </button>
    </DragonCard>
  );
}

export function DragonDiscordConflictDialog({ item, onClose }: { item: DiscordSyncPlanItem; onClose: () => void }) {
  return (
    <DragonDialog title="Конфлікт синхронізації" onClose={onClose}>
      <div className="dh-discord-sync-dialog-grid">
        <DragonCard>
          <span className="dh-dragon-eyebrow">Discord</span>
          <strong>{item.discordIdentity.serverNickname ?? item.discordIdentity.username ?? item.discordUserId}</strong>
        </DragonCard>
        <DragonCard>
          <span className="dh-dragon-eyebrow">Dragon House</span>
          <strong>{item.matchedFamilyMember?.nickname ?? 'Потрібна ручна перевірка'}</strong>
        </DragonCard>
      </div>
      <div className="dh-discord-sync-diff">
        {item.proposedFieldChanges.map((change) => (
          <div key={change.field}>
            <strong>{friendlyField(change.field)}</strong>
            <span>{String(change.current ?? 'порожньо')}</span>
            <span>{String(change.proposed ?? 'порожньо')}</span>
          </div>
        ))}
      </div>
      {item.conflicts.length ? (
        <ul className="dh-discord-sync-conflicts">
          {item.conflicts.map((conflict) => (
            <li key={`${conflict.type}-${conflict.message}`}>
              <DragonBadge tone={conflict.blocking ? 'danger' : 'ember'}>{conflict.type}</DragonBadge>
              <span>{conflict.message}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <details className="dh-discord-sync-technical">
        <summary>Технічні деталі</summary>
        <dl>
          <div>
            <dt>Discord user ID</dt>
            <dd>{item.discordUserId}</dd>
          </div>
          <div>
            <dt>ID учасника Family Hub</dt>
            <dd>{item.matchedFamilyMemberId ?? 'немає'}</dd>
          </div>
        </dl>
      </details>
    </DragonDialog>
  );
}

export function DragonDiscordApplyDialog({
  planSummary,
  applying,
  canApply,
  onClose,
  onApply
}: {
  planSummary: DiscordSyncSummary | null;
  applying: boolean;
  canApply: boolean;
  onClose: () => void;
  onApply: () => void;
}) {
  return (
    <DragonDialog
      title="Застосувати зміни Discord"
      onClose={onClose}
      closeOnBackdrop={false}
      actions={
        <>
          <DragonButton type="button" variant="ghost" onClick={onClose}>
            Скасувати
          </DragonButton>
          <DragonButton type="button" variant="danger" onClick={onApply} disabled={!canApply || applying}>
            {applying ? 'Застосовуємо...' : 'Застосувати перевірені зміни'}
          </DragonButton>
        </>
      }
    >
      <p>Backend застосує лише перевірений план. Конфлікти або застарілі плани будуть відхилені.</p>
      <div className="dh-discord-sync-confirm-grid">
        <DragonBadge tone="gold">Нові: {planSummary?.create ?? 0}</DragonBadge>
        <DragonBadge tone="ember">Оновлення: {planSummary?.update ?? 0}</DragonBadge>
        <DragonBadge tone="danger">Деактивації: {planSummary?.deactivate ?? 0}</DragonBadge>
        <DragonBadge tone={planSummary?.blocked ? 'danger' : 'success'}>Заблоковано: {planSummary?.blocked ?? 0}</DragonBadge>
      </div>
    </DragonDialog>
  );
}

export function DragonDiscordAuditHistory({
  history,
  onSelect
}: {
  history: DiscordSyncAuditRecord[];
  onSelect: (audit: DiscordSyncAuditRecord) => void;
}) {
  return (
    <DragonPanel className="dh-discord-sync-history">
      <div className="dh-dragon-section-head">
        <p className="dh-dragon-eyebrow">Історія</p>
        <h2>Історія синхронізацій</h2>
      </div>
      {history.length ? (
        <div className="dh-discord-sync-history-list">
          {history.map((audit) => (
            <button key={audit.auditId} type="button" onClick={() => onSelect(audit)}>
              <DragonBadge tone={audit.status === 'succeeded' ? 'success' : 'danger'}>{getAuditModeLabel(audit.mode)}</DragonBadge>
              <strong>{formatDiscordSyncDateTime(audit.startedAt)}</strong>
              <span>{getAuditStatusLabel(audit.status)}</span>
            </button>
          ))}
        </div>
      ) : (
        <DragonEmptyState title="Історії синхронізації поки немає" description="Перевірки й застосування змін з'являться тут після запуску." />
      )}
    </DragonPanel>
  );
}

function FamilyAuditLogPanel() {
  const [filters, setFilters] = useState<FamilyAuditLogFilters>({ limit: 20, offset: 0 });
  const [items, setItems] = useState<FamilyAuditLogRecord[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAudit = async (mode: 'replace' | 'append' = 'replace') => {
    setLoading(true);
    setError(null);
    try {
      const page = await listFamilyAuditLog({ ...filters, offset: mode === 'append' ? nextOffset ?? 0 : 0, limit: filters.limit ?? 20 });
      setItems((current) => mode === 'append' ? [...current, ...page.items] : page.items);
      setNextOffset(page.page.nextOffset);
      setFilters((current) => ({ ...current, offset: mode === 'append' ? page.page.offset : 0 }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не вдалося завантажити історію змін.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAudit('replace');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.entityType, filters.action, filters.actorFamilyMemberId, filters.from, filters.to]);

  const update = (patch: Partial<FamilyAuditLogFilters>) => setFilters((current) => ({ ...current, ...patch, offset: 0 }));

  return (
    <DragonPanel className="dh-discord-sync-history" data-family-audit-log="frontend">
      <div className="dh-dragon-section-head">
        <p className="dh-dragon-eyebrow">Історія</p>
        <h2>Історія змін Hub</h2>
      </div>
      <div className="grid gap-2 md:grid-cols-5">
        <DragonSelect value={filters.entityType ?? ''} onChange={(event) => update({ entityType: event.currentTarget.value || undefined })} aria-label="Фільтр за модулем">
          <option value="">Усі модулі</option>
          <option value="family_treasury_entry">Скарбниця</option>
          <option value="family_member">Учасники</option>
          <option value="family_quest">Квести</option>
          <option value="family_quest_template">Шаблони квестів</option>
          <option value="family_event">Події</option>
          <option value="family_tower">Вишки/KD</option>
          <option value="premium">Премії</option>
          <option value="payout_batch">Виплати</option>
        </DragonSelect>
        <DragonInput value={filters.action ?? ''} onChange={(event) => update({ action: event.currentTarget.value || undefined })} placeholder="Дія" aria-label="Фільтр за дією" />
        <DragonInput value={filters.actorFamilyMemberId ?? ''} onChange={(event) => update({ actorFamilyMemberId: event.currentTarget.value || undefined })} placeholder="Учасник" aria-label="Фільтр за учасником" />
        <DragonInput type="date" value={dateOnly(filters.from)} onChange={(event) => update({ from: event.currentTarget.value ? new Date(`${event.currentTarget.value}T00:00:00.000Z`).toISOString() : undefined })} aria-label="Дата від" />
        <DragonInput type="date" value={dateOnly(filters.to)} onChange={(event) => update({ to: event.currentTarget.value ? new Date(`${event.currentTarget.value}T23:59:59.999Z`).toISOString() : undefined })} aria-label="Дата до" />
      </div>
      {error ? <DragonRetry title="Історію змін не завантажено" description={error} onRetry={() => void loadAudit('replace')} /> : null}
      <div className="dh-discord-sync-history-list mt-4">
        {items.map((item) => (
          <DragonCard key={item.id} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <strong>{friendlyActor(item)}</strong>
                <span className="ml-2">{friendlyAction(item.action)} · {friendlyEntity(item.entityType)}</span>
              </div>
              <span>{formatDiscordSyncDateTime(item.createdAt)}</span>
            </div>
            <p>{auditSummary(item)}</p>
            <details className="dh-discord-sync-technical">
              <summary>Технічні деталі</summary>
              <pre>{JSON.stringify({
                auditId: item.id,
                actorFamilyMemberId: item.actorFamilyMemberId,
                actorType: item.actorType,
                entityId: item.entityId,
                beforeData: item.beforeData,
                afterData: item.afterData,
                metadata: item.metadata
              }, null, 2)}</pre>
            </details>
          </DragonCard>
        ))}
      </div>
      {!items.length && !loading && !error ? (
        <DragonEmptyState title="Історії змін поки немає" description="Коли менеджери або система змінять дані, записи з'являться тут." />
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <DragonButton type="button" variant="secondary" onClick={() => void loadAudit('replace')} disabled={loading}>
          {loading ? 'Завантажуємо...' : 'Оновити'}
        </DragonButton>
        {nextOffset !== null ? (
          <DragonButton type="button" variant="ghost" onClick={() => void loadAudit('append')} disabled={loading}>
            Завантажити ще
          </DragonButton>
        ) : null}
      </div>
    </DragonPanel>
  );
}

function friendlyActor(item: FamilyAuditLogRecord): string {
  if (item.actorName) return item.actorName;
  if (item.actorType === 'discord') return 'Discord';
  if (item.actorType === 'system') return 'Система';
  return 'Невідомий учасник';
}

function friendlyEntity(entityType: string): string {
  const labels: Record<string, string> = {
    family_treasury_entry: 'Скарбниця',
    family_member: 'Учасники',
    family_quest: 'Квести',
    family_quest_template: 'Шаблони квестів',
    family_event: 'Події',
    family_tower: 'Вишки/KD',
    premium: 'Премії',
    payout_batch: 'Виплати',
  };
  return labels[entityType] ?? entityType;
}

function friendlyField(field: string): string {
  const labels: Record<string, string> = {
    title: 'Назва',
    nickname: 'Позивний',
    status: 'Стан',
    rank: 'Ранг',
    role: 'Роль',
    priceAmount: 'Ціна',
    priceNote: 'Примітка до ціни',
    cooldownAt: 'КД діє до',
    permissionsDiscord: 'Права з Discord',
    sent_to_accounting: 'Передано в бухгалтерію'
  };
  return labels[field] ?? 'Невідоме поле';
}

function friendlyAction(action: string): string {
  const labels: Record<string, string> = {
    treasury_entry_created: 'створено запис',
    treasury_entry_updated: 'змінено запис',
    treasury_entry_archived: 'архівовано запис',
    member_restored: 'учасника відновлено',
    member_updated: 'учасника змінено',
    quest_created: 'квест створено',
    quest_updated: 'квест змінено',
    quest_template_created: 'шаблон створено',
    quest_template_updated: 'шаблон змінено',
    quest_completed: 'квест завершено',
    tower_kd_updated: 'КД оновлено',
    tower_kd_reminder_sent: 'нагадування каптьорам надіслано',
    tower_kd_reminder_failed: 'нагадування каптьорам не надіслано',
    premium_created: 'премію створено',
    adjustment_created: 'ручне коригування',
    payout_batch_finalized: 'виплату фіналізовано',
    payment_proof_uploaded: 'доказ оплати додано',
  };
  return labels[action] ?? 'Невідома дія';
}

function auditSummary(item: FamilyAuditLogRecord): string {
  const before = summarizeAuditData(item.beforeData);
  const after = summarizeAuditData(item.afterData);
  if (before && after) return `Було: ${before}. Стало: ${after}.`;
  if (after) return `Нове значення: ${after}.`;
  if (before) return `Попереднє значення: ${before}.`;
  return 'Зміна зафіксована в audit log.';
}

function summarizeAuditData(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const pairs = ['title', 'nickname', 'status', 'rank', 'role', 'priceAmount', 'priceNote', 'cooldownAt']
    .filter((key) => record[key] !== undefined && record[key] !== null)
    .slice(0, 4)
    .map((key) => `${friendlyField(key)}: ${String(record[key])}`);
  return pairs.length ? pairs.join(', ') : null;
}

function dateOnly(value?: string): string {
  return value ? value.slice(0, 10) : '';
}

export function DragonDiscordAuditDialog({ audit, onClose }: { audit: DiscordSyncAuditRecord; onClose: () => void }) {
  return (
    <DragonDialog title="Деталі синхронізації" onClose={onClose}>
      <dl className="dh-discord-sync-audit-details">
        <div>
          <dt>Дія</dt>
          <dd>{getAuditModeLabel(audit.mode)}</dd>
        </div>
        <div>
          <dt>Стан</dt>
          <dd>{getAuditStatusLabel(audit.status)}</dd>
        </div>
        <div>
          <dt>Конфлікти</dt>
          <dd>{audit.conflicts.length}</dd>
        </div>
      </dl>
      <details className="dh-discord-sync-technical">
        <summary>Технічні деталі</summary>
        <dl className="dh-discord-sync-audit-details">
          <div>
            <dt>Audit ID</dt>
            <dd>{audit.auditId}</dd>
          </div>
          <div>
            <dt>Plan ID</dt>
            <dd>{audit.planId ?? 'немає'}</dd>
          </div>
          <div>
            <dt>Статус застосування</dt>
            <dd>{audit.applicationStatus}</dd>
          </div>
        </dl>
      </details>
    </DragonDialog>
  );
}

export function DragonDiscordSyncLoadingState() {
  return (
    <DragonPanel className="dh-discord-sync-loading">
      <DragonLoader label="Завантажуємо стан Discord..." />
      <DragonSkeleton />
      <DragonSkeleton />
    </DragonPanel>
  );
}

export function DragonDiscordSyncErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <DragonRetry title="Не вдалося отримати дані Discord." description={friendlyDiscordSyncErrorMessage(message)} onRetry={onRetry} />;
}

function friendlyDiscordSyncErrorMessage(message: string): string {
  if (/too many requests|rate limit|try again later/i.test(message)) {
    return 'Discord тимчасово обмежив кількість запитів. Зачекай хвилину й натисни “Спробувати ще раз”.';
  }
  if (/network|fetch|failed/i.test(message)) {
    return 'Не вдалося звʼязатися з backend або Discord. Перевір, що сервер запущений, і спробуй ще раз.';
  }
  return message || 'Сталася помилка під час синхронізації Discord.';
}
