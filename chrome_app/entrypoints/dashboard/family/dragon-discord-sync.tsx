import { useState } from 'react';
import { canManageDiscordIntegration } from '../../../lib/family-permissions';
import type { FamilyUser } from '../../../lib/family-types';
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
  'ignored-bot'
];

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
        title="Discord Synchronization Chamber is sealed"
        description="Only Dragon House leadership can review account links, role mappings and synchronization diagnostics."
      />
    );
  }

  return (
    <div className="dh-discord-sync" data-discord-sync-engine="frontend">
      <DragonPanel variant="ceremonial" className="dh-discord-sync-hero">
        <div>
          <p className="dh-dragon-eyebrow">DISCORD SYNCHRONIZATION CHAMBER</p>
          <h1>Синхронізація Discord</h1>
          <p>
            Controlled dry-run, conflict review and explicit apply flow between the Discord guild and Dragon House member records.
          </p>
        </div>
        <div className="dh-discord-sync-portal" aria-label="Live Discord integration status">
          <DragonBadge tone={sync.status?.liveData ? 'success' : 'muted'}>
            {sync.status?.liveData ? 'Live guild data' : 'Backend status'}
          </DragonBadge>
          <strong>{sync.status?.guildId ?? 'Guild not configured'}</strong>
          <span>{sync.status?.roleMappingCount ?? 0} role mappings</span>
        </div>
      </DragonPanel>

      {sync.loading ? <DragonDiscordSyncLoadingState /> : null}
      {sync.error ? <DragonDiscordSyncErrorState message={sync.error.message} onRetry={sync.refresh} /> : null}

      <DragonDiscordIntegrationStatus status={sync.status} roleMappingCount={sync.roleMappings.length} />

      <DragonPanel className="dh-discord-sync-controls">
        <div>
          <p className="dh-dragon-eyebrow">DRY RUN</p>
          <h2>Створити перевірку</h2>
          <p>Dry-run fetches the current guild state, builds a server-side plan, and applies nothing.</p>
        </div>
        <div className="dh-discord-sync-actions">
          <DragonButton type="button" onClick={() => void sync.generateDryRun()} disabled={sync.runningDryRun}>
            {sync.runningDryRun ? 'Перевіряємо...' : 'Створити перевірку'}
          </DragonButton>
          <DragonButton type="button" variant="secondary" onClick={() => setConfirmApplyOpen(true)} disabled={!sync.canApply || sync.applying}>
            {sync.applying ? 'Застосовуємо...' : 'Застосувати план'}
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
          title="No synchronization plan yet"
          description="Generate a dry run to see creates, updates, deactivations, unchanged members, ignored bots and conflicts."
          action={
            <DragonButton type="button" variant="secondary" onClick={() => void sync.generateDryRun()}>
              Створити перевірку
            </DragonButton>
          }
        />
      )}

      <DragonDiscordAuditHistory history={sync.history} onSelect={sync.setSelectedAudit} />

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
    <section className="dh-discord-sync-status" aria-label="Discord integration status">
      {[
        ['Guild', status?.guildConfigured ? status.guildId ?? 'Configured' : 'Not connected'],
        ['Bot access', status?.botAccessStatus ?? 'unknown'],
        ['Last sync', status?.lastSuccessfulSynchronizationAt ?? 'Never'],
        ['Linked members', status?.linkedMemberCount ?? 'Pending'],
        ['Role mappings', roleMappingCount],
        ['Plan TTL', `${status?.planTtlSeconds ?? 0}s`]
      ].map(([label, value]) => (
        <DragonCard key={label} className="dh-discord-sync-status-card">
          <span className="dh-dragon-eyebrow">{label}</span>
          <strong>{value}</strong>
        </DragonCard>
      ))}
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
    <section className="dh-discord-sync-summary" aria-label="Discord synchronization summary">
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
        placeholder="Search Discord or Dragon member"
        aria-label="Search Discord synchronization plan"
      />
      <DragonSelect value={filter} onChange={(event) => onFilterChange(event.currentTarget.value as DiscordSyncPlanFilter)} aria-label="Filter synchronization plan">
        {PLAN_FILTERS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </DragonSelect>
    </DragonPanel>
  );
}

export function DragonDiscordPlanList({ items, onSelect }: { items: DiscordSyncPlanItem[]; onSelect: (item: DiscordSyncPlanItem) => void }) {
  if (!items.length) {
    return <DragonEmptyState title="No plan items match" description="Change the filters or generate a fresh dry run." />;
  }
  return (
    <section className="dh-discord-sync-plan" aria-label="Discord synchronization plan items">
      {items.map((item) => (
        <DragonDiscordPlanItemCard key={item.id} item={item} onSelect={onSelect} />
      ))}
    </section>
  );
}

export function DragonDiscordPlanItemCard({ item, onSelect }: { item: DiscordSyncPlanItem; onSelect: (item: DiscordSyncPlanItem) => void }) {
  const identity = item.discordIdentity.serverNickname ?? item.discordIdentity.globalName ?? item.discordIdentity.username ?? item.discordUserId ?? 'Unknown';
  return (
    <DragonCard interactive className={`dh-discord-sync-item is-${item.action}`}>
      <button type="button" onClick={() => onSelect(item)} aria-label={`Open Discord sync item ${identity}`}>
        <div>
          <DragonBadge tone={item.blocking ? 'danger' : item.safeToApply ? 'success' : 'muted'}>{discordSyncActionLabel(item.action)}</DragonBadge>
          <strong>{identity}</strong>
          <span>{item.matchedFamilyMember?.nickname ?? 'No Dragon House match'}</span>
        </div>
        <dl>
          <div>
            <dt>Match</dt>
            <dd>{discordSyncMethodLabel(item.match.method)}</dd>
          </div>
          <div>
            <dt>Changes</dt>
            <dd>{item.proposedFieldChanges.length}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{item.mappedRoles.primary?.discordRoleName ?? 'none'}</dd>
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
          <p>{item.discordUserId}</p>
        </DragonCard>
        <DragonCard>
          <span className="dh-dragon-eyebrow">Dragon House</span>
          <strong>{item.matchedFamilyMember?.nickname ?? 'Manual review required'}</strong>
          <p>{item.matchedFamilyMemberId ?? 'No safe automatic match'}</p>
        </DragonCard>
      </div>
      <div className="dh-discord-sync-diff">
        {item.proposedFieldChanges.map((change) => (
          <div key={change.field}>
            <strong>{change.field}</strong>
            <span>{String(change.current ?? 'empty')}</span>
            <span>{String(change.proposed ?? 'empty')}</span>
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
      title="Застосувати план Discord"
      onClose={onClose}
      closeOnBackdrop={false}
      actions={
        <>
          <DragonButton type="button" variant="ghost" onClick={onClose}>
            Cancel
          </DragonButton>
          <DragonButton type="button" variant="danger" onClick={onApply} disabled={!canApply || applying}>
            {applying ? 'Applying...' : 'Apply reviewed plan'}
          </DragonButton>
        </>
      }
    >
      <p>
        This applies the server-generated plan only. Blocking conflicts, stale plans and already-applied plans are rejected by the backend.
      </p>
      <div className="dh-discord-sync-confirm-grid">
        <DragonBadge tone="gold">Create {planSummary?.create ?? 0}</DragonBadge>
        <DragonBadge tone="ember">Update {planSummary?.update ?? 0}</DragonBadge>
        <DragonBadge tone="danger">Deactivate {planSummary?.deactivate ?? 0}</DragonBadge>
        <DragonBadge tone={planSummary?.blocked ? 'danger' : 'success'}>Blocked {planSummary?.blocked ?? 0}</DragonBadge>
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
        <p className="dh-dragon-eyebrow">AUDIT HISTORY</p>
        <h2>Історія синхронізацій</h2>
      </div>
      {history.length ? (
        <div className="dh-discord-sync-history-list">
          {history.map((audit) => (
            <button key={audit.auditId} type="button" onClick={() => onSelect(audit)}>
              <DragonBadge tone={audit.status === 'succeeded' ? 'success' : 'danger'}>{audit.mode}</DragonBadge>
              <strong>{audit.startedAt}</strong>
              <span>{audit.planId ?? audit.auditId}</span>
            </button>
          ))}
        </div>
      ) : (
        <DragonEmptyState title="No synchronization history" description="Dry runs and apply results will appear here after they are generated." />
      )}
    </DragonPanel>
  );
}

export function DragonDiscordAuditDialog({ audit, onClose }: { audit: DiscordSyncAuditRecord; onClose: () => void }) {
  return (
    <DragonDialog title="Audit details" onClose={onClose}>
      <dl className="dh-discord-sync-audit-details">
        <div>
          <dt>Audit ID</dt>
          <dd>{audit.auditId}</dd>
        </div>
        <div>
          <dt>Plan ID</dt>
          <dd>{audit.planId ?? 'none'}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{audit.applicationStatus}</dd>
        </div>
        <div>
          <dt>Conflicts</dt>
          <dd>{audit.conflicts.length}</dd>
        </div>
      </dl>
    </DragonDialog>
  );
}

export function DragonDiscordSyncLoadingState() {
  return (
    <DragonPanel className="dh-discord-sync-loading">
      <DragonLoader label="Discord Synchronization Chamber is opening" />
      <DragonSkeleton />
      <DragonSkeleton />
    </DragonPanel>
  );
}

export function DragonDiscordSyncErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <DragonRetry title="Discord synchronization is unavailable" description={message} onRetry={onRetry} />;
}
