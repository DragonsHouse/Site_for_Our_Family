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
  { key: 'all', label: 'All', room: 'Engine' },
  ...Object.entries(DRAGON_ACHIEVEMENT_CATEGORY_LABELS).map(([key, label]) => ({
    key: key as DragonAchievementCategory,
    label,
    room: 'Seal'
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
      .catch((error) => setLeaderboardError(error instanceof Error ? error : new Error('Leaderboard backend request failed.')));
  };

  useEffect(refreshLeaderboard, []);

  return (
    <div className="dh-achievement-engine" data-dragon-achievement-engine="frontend">
      <DragonPanel variant="ceremonial" className="dh-achievement-engine-hero">
        <div>
          <p className="dh-dragon-eyebrow">DRAGON ACHIEVEMENT ENGINE</p>
          <h1>Family accomplishments become power.</h1>
          <p>Reusable frontend achievement architecture for Profile, Tower Defense, Quest Board, Calendar, Members and Notifications.</p>
        </div>
        <DragonAchievementProgressSummary statistics={engine.statistics} />
      </DragonPanel>

      {engine.loading ? <DragonLoader label="Achievement catalog is loading" /> : null}
      {engine.error ? <DragonRetry title="Achievements did not load" description={engine.error.message} onRetry={engine.refresh} /> : null}
      <DragonAchievementFilters filters={engine.filters} onChange={engine.setFilters} />
      <DragonAchievementGallery achievements={engine.visibleAchievements} onSelect={setSelectedAchievement} />

      {currentUser && canManageRewards(currentUser) ? <DragonRewardApprovalQueue /> : null}

      <DragonSection eyebrow="LEADERBOARD" title="Current month ranking">
        {leaderboardError ? <DragonRetry title="Leaderboard did not load" description={leaderboardError.message} onRetry={refreshLeaderboard} /> : null}
        <div className="dh-achievement-recent-grid" data-leaderboard-source="backend">
          {leaderboard?.items.length ? leaderboard.items.slice(0, 5).map((entry) => (
            <DragonCard key={entry.familyMemberId}>
              <span className="dh-dragon-eyebrow">Place {entry.place}</span>
              <strong>{entry.displayName}</strong>
              <p>{entry.score} authoritative activity points</p>
            </DragonCard>
          )) : !leaderboardError ? <DragonEmptyState title="No leaderboard activity" description="No authoritative activity is available for this period." /> : null}
        </div>
      </DragonSection>

      <DragonSection eyebrow="RECENT UNLOCKS" title="Freshly awakened seals">
        <div className="dh-achievement-recent-grid">
          {recentUnlocks.map((achievement) => (
            <DragonAchievementNotification key={achievement.id} achievement={achievement} />
          ))}
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
      .catch((failure) => setError(failure instanceof Error ? failure : new Error('Reward queue backend request failed.')))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, [status]);

  const mutate = (grantId: string, action: 'approve' | 'issue' | 'cancel') => {
    if (mutatingId) return;
    setMutatingId(grantId);
    const request = action === 'approve' ? approveBackendRewardGrant : action === 'issue' ? issueBackendRewardGrant : cancelBackendRewardGrant;
    request(grantId)
      .then(refresh)
      .catch((failure) => setError(failure instanceof Error ? failure : new Error('Reward mutation failed.')))
      .finally(() => setMutatingId(null));
  };

  return (
    <DragonSection eyebrow="REWARDS" title="Pending reward approvals">
      <div className="dh-achievement-filter-row">
        <DragonSelect value={status} onChange={(event) => setStatus(event.target.value as typeof status)} aria-label="Filter reward approval queue">
          <option value="earned">Awaiting approval</option>
          <option value="approved">Approved</option>
          <option value="all">All statuses</option>
        </DragonSelect>
        <DragonButton type="button" variant="secondary" onClick={refresh} disabled={loading}>
          Retry
        </DragonButton>
      </div>
      {loading ? <DragonLoader label="Reward queue is loading" /> : null}
      {error ? <DragonRetry title="Reward queue did not load" description={error.message} onRetry={refresh} /> : null}
      {!loading && !error && !items.length ? <DragonEmptyState title="No pending rewards" description="Backend returned an empty reward queue." /> : null}
      <div className="dh-achievement-recent-grid" data-reward-queue-source="backend">
        {items.map((grant) => (
          <DragonCard key={grant.id}>
            <span className="dh-dragon-eyebrow">{getRewardSourceLabel(grant.sourceModule)}</span>
            <strong>{grant.member?.displayName ?? grant.familyMemberId}</strong>
            <p>{grant.reward.name} · {formatRewardValue(grant)}</p>
            <p>{getRewardStatusLabel(grant)}</p>
            <div className="dh-achievement-filter-row">
              <DragonButton type="button" variant="secondary" disabled={mutatingId === grant.id || grant.status !== 'earned'} onClick={() => mutate(grant.id, 'approve')}>
                Approve
              </DragonButton>
              <DragonButton type="button" variant="primary" disabled={mutatingId === grant.id || grant.status !== 'approved'} onClick={() => mutate(grant.id, 'issue')}>
                Issue
              </DragonButton>
              <DragonButton type="button" variant="ghost" disabled={mutatingId === grant.id || grant.status === 'issued' || grant.status === 'cancelled'} onClick={() => mutate(grant.id, 'cancel')}>
                Cancel
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
    return <DragonEmptyState title="No achievement seals found" description="Adjust filters to reveal more Dragon House accomplishments." />;
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
        aria-label={`Open achievement ${isSecret ? 'Secret Achievement' : achievement.title}`}
      >
        <span className="dh-engine-achievement-icon" aria-hidden="true">
          {isSecret ? '?' : achievement.icon}
        </span>
        <span>
          <strong>{isSecret ? 'Secret Achievement' : achievement.title}</strong>
          <small>{isSecret ? 'Hidden until unlocked' : achievement.description}</small>
        </span>
      </button>
      <div className="dh-engine-achievement-meta">
        <DragonBadge tone={rarityMeta.tone}>{rarityMeta.label}</DragonBadge>
        <DragonBadge tone={achievement.completed ? 'success' : 'muted'}>{achievement.completed ? 'Unlocked' : 'Locked'}</DragonBadge>
      </div>
      <DragonProgress value={progressPercent} label={`${achievement.title} progress`} />
      <footer>
        <span>{achievement.points} pts</span>
        <span>{achievement.xp} XP</span>
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
          <DragonProgress value={getDragonAchievementProgressPercent(achievement)} label={`${achievement.title} detail progress`} />
        </div>
        <div className="dh-achievement-details-grid">
          {achievement.requirements.map((requirement) => (
            <DragonCard key={requirement.id}>
              <span className="dh-dragon-eyebrow">{requirement.backendField}</span>
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
          aria-label="Search achievements"
          placeholder="Search seals"
        />
        <DragonSelect
          value={filters.rarity}
          onChange={(event) => onChange({ ...filters, rarity: event.target.value as DragonAchievementFilters['rarity'] })}
          aria-label="Filter achievements by rarity"
        >
          {RARITIES.map((rarity) => (
            <option key={rarity} value={rarity}>
              {rarity === 'all' ? 'All rarities' : DRAGON_ACHIEVEMENT_RARITY_META[rarity].label}
            </option>
          ))}
        </DragonSelect>
        <DragonButton
          type="button"
          variant="secondary"
          aria-pressed={filters.completion === 'unlocked'}
          onClick={() => onChange({ ...filters, completion: filters.completion === 'unlocked' ? 'all' : 'unlocked' })}
        >
          Unlocked
        </DragonButton>
        <DragonButton
          type="button"
          variant="ghost"
          aria-pressed={filters.completion === 'locked'}
          onClick={() => onChange({ ...filters, completion: filters.completion === 'locked' ? 'all' : 'locked' })}
        >
          Locked
        </DragonButton>
      </div>
    </DragonPanel>
  );
}

export function DragonAchievementProgressSummary({ statistics }: { statistics: DragonAchievementStatistics }) {
  return (
    <div className="dh-achievement-summary" aria-label="Dragon Achievement Progress Summary">
      <div>
        <span className="dh-dragon-eyebrow">Unlocked</span>
        <strong>{statistics.unlocked}</strong>
      </div>
      <div>
        <span className="dh-dragon-eyebrow">Completion</span>
        <strong>{statistics.completionPercent}%</strong>
      </div>
      <DragonProgress value={statistics.completionPercent} label="Achievement completion" />
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
