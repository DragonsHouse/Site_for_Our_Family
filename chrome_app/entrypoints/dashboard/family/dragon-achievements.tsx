import { useEffect, useMemo, useState } from 'react';
import {
  DragonBadge,
  DragonButton,
  DragonCard,
  DragonDialog,
  DragonEmptyState,
  DragonInput,
  DragonLoader,
  DragonPanel,
  DragonProgress,
  DragonRetry,
  DragonSection,
  DragonSelect,
  DragonTabs
} from '../dragon-ui/dragon-ui';
import {
  DRAGON_ACHIEVEMENT_CATEGORY_LABELS,
  DRAGON_ACHIEVEMENT_RARITY_META,
  type DragonAchievement,
  type DragonAchievementCategory,
  type DragonAchievementFilters,
  type DragonAchievementRarity,
  type DragonAchievementStatistics
} from './achievement-models';
import {
  getDragonAchievementProgressPercent,
  getDragonAchievementVisibilityLabel,
  getRecentDragonAchievementUnlocks
} from './achievement-service';
import { useDragonAchievementState } from './achievement-state';
import type { DragonAchievementRepository } from './achievement-repository';
import type { FamilyUser } from '../../../lib/family-types';
import type { BackendRewardQueueItemDto } from '../../../lib/family-achievements-backend-response';
import {
  approveBackendRewardGrant,
  cancelBackendRewardGrant,
  getBackendLeaderboard,
  issueBackendRewardGrant,
  listBackendPendingRewards
} from '../../../lib/family-achievements-backend-client';
import { formatRewardValue, getRewardSourceLabel, getRewardStatusLabel } from '../../../lib/family-rewards-display';

const CATEGORY_TABS: Array<{ key: DragonAchievementCategory | 'all'; label: string; room?: string }> = [
  { key: 'all', label: 'Усі', room: 'Відзнаки' },
  ...Object.entries(DRAGON_ACHIEVEMENT_CATEGORY_LABELS).map(([key, label]) => ({
    key: key as DragonAchievementCategory,
    label,
    room: 'Відзнака'
  }))
];

const RARITIES: Array<DragonAchievementRarity | 'all'> = ['all', 'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

export function DragonAchievementEngineScreen({ repository, currentUser }: { repository?: DragonAchievementRepository; currentUser?: FamilyUser }) {
  const engine = useDragonAchievementState(repository);
  const [selectedAchievement, setSelectedAchievement] = useState<DragonAchievement | null>(null);
  const [leaderboard, setLeaderboard] = useState<Awaited<ReturnType<typeof getBackendLeaderboard>> | null>(null);
  const [leaderboardError, setLeaderboardError] = useState<Error | null>(null);
  const recentUnlocks = useMemo(() => getRecentDragonAchievementUnlocks(engine.achievements, 4), [engine.achievements]);

  const refreshLeaderboard = () => {
    setLeaderboardError(null);
    getBackendLeaderboard({ period: 'current_month', category: 'overall' })
      .then(setLeaderboard)
      .catch((error) => setLeaderboardError(error instanceof Error ? error : new Error('Не вдалося завантажити рейтинг.')));
  };

  useEffect(refreshLeaderboard, []);

  return (
    <div className="dh-achievement-engine" data-dragon-achievement-engine="frontend">
      <DragonPanel variant="ceremonial" className="dh-achievement-engine-hero">
        <div>
          <p className="dh-dragon-eyebrow">Відзнаки</p>
          <h1>Нагороди Dragon House</h1>
          <p>Досягнення, нагороди, рейтинг і підтвердження виданих відзнак.</p>
        </div>
        <DragonAchievementProgressSummary statistics={engine.statistics} />
      </DragonPanel>

      {engine.loading ? <DragonLoader label="Завантажуємо каталог відзнак..." /> : null}
      {engine.error ? <DragonRetry title="Не вдалося завантажити відзнаки" description={engine.error.message} onRetry={engine.refresh} /> : null}
      <DragonAchievementFilters filters={engine.filters} onChange={engine.setFilters} />
      <DragonAchievementGallery achievements={engine.visibleAchievements} onSelect={setSelectedAchievement} />

      {currentUser && canManageRewards(currentUser) ? <DragonRewardApprovalQueue /> : null}

      <DragonSection eyebrow="Рейтинг" title="Рейтинг цього місяця">
        {leaderboardError ? <DragonRetry title="Не вдалося завантажити рейтинг" description={leaderboardError.message} onRetry={refreshLeaderboard} /> : null}
        <div className="dh-achievement-recent-grid" data-leaderboard-source="backend">
          {leaderboard?.items.length ? leaderboard.items.slice(0, 5).map((entry) => (
            <DragonCard key={entry.familyMemberId}>
              <span className="dh-dragon-eyebrow">{entry.place} місце</span>
              <strong>{entry.displayName}</strong>
              <p>Балів активності: {entry.score}</p>
            </DragonCard>
          )) : !leaderboardError ? <DragonEmptyState title="Рейтинг поки порожній" description="За цей період ще немає підтвердженої активності." /> : null}
        </div>
      </DragonSection>

      <DragonSection eyebrow="Останні відзнаки" title="Нещодавно відкриті відзнаки">
        <div className="dh-achievement-recent-grid">
          {recentUnlocks.length ? recentUnlocks.map((achievement) => (
            <DragonAchievementNotification key={achievement.id} achievement={achievement} />
          )) : <DragonEmptyState title="Нещодавно відкритих відзнак поки немає" />}
        </div>
      </DragonSection>

      {selectedAchievement ? <DragonAchievementDetails achievement={selectedAchievement} onClose={() => setSelectedAchievement(null)} /> : null}
    </div>
  );
}

function DragonRewardApprovalQueue() {
  const [items, setItems] = useState<BackendRewardQueueItemDto[]>([]);
  const [status, setStatus] = useState<'earned' | 'approved' | 'all'>('earned');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    setError(null);
    listBackendPendingRewards({ status, limit: 50 })
      .then((response) => setItems(response.items))
      .catch((failure) => setError(failure instanceof Error ? failure : new Error('Не вдалося завантажити чергу нагород.')))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, [status]);

  const mutate = (grantId: string, action: 'approve' | 'issue' | 'cancel') => {
    if (mutatingId) return;
    setMutatingId(grantId);
    const request = action === 'approve' ? approveBackendRewardGrant : action === 'issue' ? issueBackendRewardGrant : cancelBackendRewardGrant;
    request(grantId)
      .then(refresh)
      .catch((failure) => setError(failure instanceof Error ? failure : new Error('Не вдалося оновити нагороду.')))
      .finally(() => setMutatingId(null));
  };

  return (
    <DragonSection eyebrow="Нагороди" title="Очікують підтвердження">
      <div className="dh-achievement-filter-row">
        <DragonSelect value={status} onChange={(event) => setStatus(event.target.value as typeof status)} aria-label="Фільтр черги нагород">
          <option value="earned">Очікують підтвердження</option>
          <option value="approved">Підтверджені</option>
          <option value="all">Усі статуси</option>
        </DragonSelect>
        <DragonButton type="button" variant="secondary" onClick={refresh} disabled={loading}>
          Спробувати ще раз
        </DragonButton>
      </div>
      {loading ? <DragonLoader label="Завантажуємо чергу нагород..." /> : null}
      {error ? <DragonRetry title="Не вдалося завантажити нагороди" description={error.message} onRetry={refresh} /> : null}
      {!loading && !error && !items.length ? <DragonEmptyState title="Немає нагород, що очікують підтвердження." /> : null}
      <div className="dh-achievement-recent-grid" data-reward-queue-source="backend">
        {items.map((grant) => (
          <DragonCard key={grant.id}>
            <span className="dh-dragon-eyebrow">{getRewardSourceLabel(grant.sourceModule)}</span>
            <strong>{grant.member?.displayName ?? grant.familyMemberId}</strong>
            <p>{grant.reward.name} · {formatRewardValue(grant)}</p>
            <p>{getRewardStatusLabel(grant)}</p>
            <div className="dh-achievement-filter-row">
              <DragonButton type="button" variant="secondary" disabled={mutatingId === grant.id || grant.status !== 'earned'} onClick={() => mutate(grant.id, 'approve')}>
                Підтвердити
              </DragonButton>
              <DragonButton type="button" variant="primary" disabled={mutatingId === grant.id || grant.status !== 'approved'} onClick={() => mutate(grant.id, 'issue')}>
                Видати
              </DragonButton>
              <DragonButton type="button" variant="ghost" disabled={mutatingId === grant.id || grant.status === 'issued' || grant.status === 'cancelled'} onClick={() => mutate(grant.id, 'cancel')}>
                Скасувати
              </DragonButton>
            </div>
          </DragonCard>
        ))}
      </div>
    </DragonSection>
  );
}

export function DragonAchievementGallery({
  achievements,
  onSelect
}: {
  achievements: DragonAchievement[];
  onSelect?: (achievement: DragonAchievement) => void;
}) {
  if (!achievements.length) {
    return <DragonEmptyState title="Відзнак не знайдено" description="Зміни фільтри, щоб побачити інші відзнаки Dragon House." />;
  }

  return (
    <section className="dh-achievement-gallery" aria-label="Dragon Achievement Gallery">
      {achievements.map((achievement) => (
        <DragonAchievementCard key={achievement.id} achievement={achievement} onSelect={onSelect} />
      ))}
    </section>
  );
}

export function DragonAchievementCard({
  achievement,
  onSelect
}: {
  achievement: DragonAchievement;
  onSelect?: (achievement: DragonAchievement) => void;
}) {
  const rarityMeta = DRAGON_ACHIEVEMENT_RARITY_META[achievement.rarity];
  const progressPercent = getDragonAchievementProgressPercent(achievement);
  const isSecret = achievement.visibility === 'secret' && !achievement.completed;

  return (
    <DragonCard interactive className={`dh-engine-achievement-card ${rarityMeta.className} ${achievement.completed ? 'is-unlocked' : 'is-locked'}`}>
      <button
        type="button"
        className="dh-engine-achievement-open"
        onClick={() => onSelect?.(achievement)}
        aria-label={`Відкрити відзнаку ${isSecret ? 'Таємна відзнака' : achievement.title}`}
      >
        <span className="dh-engine-achievement-icon" aria-hidden="true">
          {isSecret ? '?' : achievement.icon}
        </span>
        <span>
          <strong>{isSecret ? 'Таємна відзнака' : achievement.title}</strong>
          <small>{isSecret ? 'Прихована до відкриття' : achievement.description}</small>
        </span>
      </button>
      <div className="dh-engine-achievement-meta">
        <DragonBadge tone={rarityMeta.tone}>{rarityMeta.label}</DragonBadge>
        <DragonBadge tone={achievement.completed ? 'success' : 'muted'}>{achievement.completed ? 'Відкрита' : 'Не відкрито'}</DragonBadge>
      </div>
      <DragonProgress value={progressPercent} label={`Прогрес відзнаки ${achievement.title}`} />
      <footer>
        <span>{achievement.points} балів</span>
        {achievement.xp > 0 ? <span>{achievement.xp} XP</span> : null}
      </footer>
    </DragonCard>
  );
}

export function DragonAchievementDetails({ achievement, onClose }: { achievement: DragonAchievement; onClose: () => void }) {
  const rarityMeta = DRAGON_ACHIEVEMENT_RARITY_META[achievement.rarity];

  return (
    <DragonDialog title={achievement.title} onClose={onClose}>
      <div className={`dh-achievement-details ${rarityMeta.className}`}>
        <div className="dh-achievement-details-seal" aria-hidden="true">
          {achievement.icon}
        </div>
        <div>
          <DragonBadge tone={rarityMeta.tone}>{rarityMeta.label}</DragonBadge>
          <DragonBadge tone="muted">{getDragonAchievementVisibilityLabel(achievement.visibility)}</DragonBadge>
          <p>{achievement.description}</p>
          <DragonProgress value={getDragonAchievementProgressPercent(achievement)} label={`Прогрес відзнаки ${achievement.title}`} />
        </div>
        <div className="dh-achievement-details-grid">
          {achievement.requirements.map((requirement) => (
            <DragonCard key={requirement.id}>
              <span className="dh-dragon-eyebrow">Умова</span>
              <strong>{requirement.label}</strong>
              <p>
                {requirement.current} / {requirement.target}
              </p>
            </DragonCard>
          ))}
          {achievement.rewards.map((reward) => (
            <DragonCard key={reward.id}>
              <span className="dh-dragon-eyebrow">{reward.type}</span>
              <strong>{reward.label}</strong>
              <p>{reward.value}</p>
            </DragonCard>
          ))}
        </div>
      </div>
    </DragonDialog>
  );
}

export function DragonAchievementFilters({
  filters,
  onChange
}: {
  filters: DragonAchievementFilters;
  onChange: (filters: DragonAchievementFilters) => void;
}) {
  return (
    <DragonPanel className="dh-achievement-filters">
      <DragonTabs
        tabs={CATEGORY_TABS}
        activeTab={filters.category}
        onChange={(category) => onChange({ ...filters, category })}
        className="dh-achievement-category-tabs"
      />
      <div className="dh-achievement-filter-row">
        <DragonInput
          type="search"
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          aria-label="Пошук відзнак"
          placeholder="Пошук відзнак"
        />
        <DragonSelect
          value={filters.rarity}
          onChange={(event) => onChange({ ...filters, rarity: event.target.value as DragonAchievementFilters['rarity'] })}
          aria-label="Фільтр відзнак за рідкістю"
        >
          {RARITIES.map((rarity) => (
            <option key={rarity} value={rarity}>
              {rarity === 'all' ? 'Усі рідкості' : DRAGON_ACHIEVEMENT_RARITY_META[rarity].label}
            </option>
          ))}
        </DragonSelect>
        <DragonButton
          type="button"
          variant="secondary"
          aria-pressed={filters.completion === 'unlocked'}
          onClick={() => onChange({ ...filters, completion: filters.completion === 'unlocked' ? 'all' : 'unlocked' })}
        >
          Відкриті
        </DragonButton>
        <DragonButton
          type="button"
          variant="ghost"
          aria-pressed={filters.completion === 'locked'}
          onClick={() => onChange({ ...filters, completion: filters.completion === 'locked' ? 'all' : 'locked' })}
        >
          Не відкриті
        </DragonButton>
      </div>
    </DragonPanel>
  );
}

export function DragonAchievementProgressSummary({ statistics }: { statistics: DragonAchievementStatistics }) {
  return (
    <div className="dh-achievement-summary" aria-label="Dragon Achievement Progress Summary">
      <div>
        <span className="dh-dragon-eyebrow">Відкриті</span>
        <strong>{statistics.unlocked}</strong>
      </div>
      <div>
        <span className="dh-dragon-eyebrow">Прогрес</span>
        <strong>{statistics.completionPercent}%</strong>
      </div>
      <DragonProgress value={statistics.completionPercent} label="Прогрес відзнак" />
      <p>
        {statistics.currentXp} / {statistics.totalXp} XP
      </p>
    </div>
  );
}

function canManageRewards(user: FamilyUser): boolean {
  return user.role === 'owner' || user.rankLevel >= 8 || user.permissions.includes('manage_rewards') || user.permissions.includes('manage_accounting') || user.permissions.includes('manage_family_economy');
}

export function DragonAchievementNotification({ achievement }: { achievement: DragonAchievement }) {
  const rarityMeta = DRAGON_ACHIEVEMENT_RARITY_META[achievement.rarity];

  return (
    <DragonCard className={`dh-achievement-notification ${rarityMeta.className}`}>
      <span aria-hidden="true">{achievement.icon}</span>
      <div>
        <DragonBadge tone={rarityMeta.tone}>{rarityMeta.label}</DragonBadge>
        <strong>{achievement.title}</strong>
        <p>{achievement.completedAt ?? achievement.backendAchievementId}</p>
      </div>
    </DragonCard>
  );
}
