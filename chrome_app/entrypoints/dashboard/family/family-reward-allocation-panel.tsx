import { useEffect, useMemo, useState } from 'react';
import { DragonButton, DragonCard, DragonEmptyState, DragonInput, DragonLoader, DragonRetry, DragonSelect } from '../dragon-ui/dragon-ui';
import { listBackendRewards } from '../../../lib/family-achievements-backend-client';
import type { BackendRewardDefinitionDto } from '../../../lib/family-achievements-backend-response';
import { FamilyMemberDirectoryClient, type FamilyMemberDirectoryItem } from '../../../lib/family-member-directory-client';
import {
  createBackendFamilyEventRewardAllocation,
  createBackendTowerDefenseRewardAllocation,
  deleteBackendFamilyEventRewardAllocation,
  deleteBackendTowerDefenseRewardAllocation,
  listBackendFamilyEventRewardAllocations,
  listBackendTowerDefenseRewardAllocations,
  updateBackendFamilyEventRewardAllocation,
  updateBackendTowerDefenseRewardAllocation,
  type BackendRewardAllocationDto
} from '../../../lib/family-reward-allocations-backend-client';

export function FamilyRewardAllocationPanel({
  sourceModule,
  sourceId,
  canManage,
  closed,
  summaryOnly = false
}: {
  sourceModule: 'tower_defense' | 'events';
  sourceId: string;
  canManage: boolean;
  closed: boolean;
  summaryOnly?: boolean;
}) {
  const [allocations, setAllocations] = useState<BackendRewardAllocationDto[]>([]);
  const [rewards, setRewards] = useState<BackendRewardDefinitionDto[]>([]);
  const [members, setMembers] = useState<FamilyMemberDirectoryItem[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedRewardId, setSelectedRewardId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutatingKey, setMutatingKey] = useState<string | null>(null);
  const directoryClient = useMemo(() => new FamilyMemberDirectoryClient(), []);

  const load = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const [allocationResponse, rewardResponse, memberResponse] = await Promise.all([
        sourceModule === 'tower_defense'
          ? listBackendTowerDefenseRewardAllocations(sourceId, signal)
          : listBackendFamilyEventRewardAllocations(sourceId, signal),
        listBackendRewards(signal),
        directoryClient.listMembers({ page: 1, pageSize: 200, status: 'active', sort: 'displayName', order: 'asc' }, signal)
      ]);
      setAllocations(allocationResponse.items);
      const activeRewards = rewardResponse.items.filter((reward) => reward.active);
      setRewards(activeRewards);
      setMembers(memberResponse.items);
      setSelectedMemberId((current) => current || memberResponse.items[0]?.memberId || '');
      setSelectedRewardId((current) => current || activeRewards[0]?.id || '');
    } catch (loadError) {
      if (!signal?.aborted) setError(loadError instanceof Error ? loadError.message : 'Reward allocations failed to load.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [sourceModule, sourceId]);

  const runMutation = async (key: string, action: () => Promise<unknown>) => {
    if (mutatingKey) return;
    setMutatingKey(key);
    setError(null);
    try {
      await action();
      await load();
      setReason('');
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Reward allocation request failed.');
    } finally {
      setMutatingKey(null);
    }
  };

  const addAllocation = () => {
    if (!selectedMemberId || !selectedRewardId) return;
    const payload = { familyMemberId: selectedMemberId, rewardDefinitionId: selectedRewardId, reason: reason || null };
    return runMutation('add', () => sourceModule === 'tower_defense'
      ? createBackendTowerDefenseRewardAllocation(sourceId, payload)
      : createBackendFamilyEventRewardAllocation(sourceId, payload));
  };
  const canMutate = canManage && !closed && !summaryOnly;
  const panelTitle = summaryOnly ? 'Planned Rewards Summary' : 'Planned Rewards';

  return (
    <DragonCard data-reward-allocation-source="backend" data-reward-allocation-mode={summaryOnly ? 'summary' : 'manager'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="dh-dragon-eyebrow">{panelTitle}</span>
        {!loading ? <DragonBadge tone={allocations.length ? 'gold' : 'muted'}>{allocations.length} planned</DragonBadge> : null}
      </div>
      {closed ? <p className="text-sm opacity-80">Source is closed. Planned allocations are read-only; earned grants live in reward history.</p> : null}
      {summaryOnly ? <p className="text-sm opacity-80">These rewards will become earned grants only after backend completion/reconciliation succeeds.</p> : null}
      {loading ? <DragonLoader label="Loading reward allocations" /> : null}
      {error ? <DragonRetry description={error} onRetry={() => load()} /> : null}
      {!loading && !allocations.length ? <DragonEmptyState title="No planned rewards" description="Backend returned an empty allocation list." /> : null}
      {allocations.length ? (
        <div className="space-y-2">
          {allocations.map((allocation) => (
            <div key={allocation.id} className="flex flex-wrap items-center gap-2">
              <strong>{allocation.familyMemberDisplayName ?? allocation.familyMemberId}</strong>
              <span>{allocation.reward.name}</span>
              <small>{formatRewardPreview(allocation.reward)}</small>
              {allocation.reason ? <small>{allocation.reason}</small> : null}
              {canMutate ? (
                <>
                  <DragonButton
                    type="button"
                    variant="ghost"
                    disabled={Boolean(mutatingKey)}
                    onClick={() => runMutation(`edit:${allocation.id}`, () => sourceModule === 'tower_defense'
                      ? updateBackendTowerDefenseRewardAllocation(sourceId, allocation.id, { reason: allocation.reason ? null : 'Planned reward' })
                      : updateBackendFamilyEventRewardAllocation(sourceId, allocation.id, { reason: allocation.reason ? null : 'Planned reward' }))}
                  >
                    Edit
                  </DragonButton>
                  <DragonButton
                    type="button"
                    variant="danger"
                    disabled={Boolean(mutatingKey)}
                    onClick={() => runMutation(`delete:${allocation.id}`, () => sourceModule === 'tower_defense'
                      ? deleteBackendTowerDefenseRewardAllocation(sourceId, allocation.id)
                      : deleteBackendFamilyEventRewardAllocation(sourceId, allocation.id))}
                  >
                    Remove
                  </DragonButton>
                </>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {canMutate ? (
        <div className="mt-3 grid gap-2">
          <DragonSelect value={selectedMemberId} onChange={(event) => setSelectedMemberId(event.currentTarget.value)} aria-label="Reward recipient">
            {members.map((member) => <option key={member.memberId} value={member.memberId}>{member.displayName}</option>)}
          </DragonSelect>
          <DragonSelect value={selectedRewardId} onChange={(event) => setSelectedRewardId(event.currentTarget.value)} aria-label="Reward definition">
            {rewards.map((reward) => <option key={reward.id} value={reward.id}>{reward.name} / {formatRewardPreview(reward)}</option>)}
          </DragonSelect>
          <DragonInput value={reason} onChange={(event) => setReason(event.currentTarget.value)} placeholder="Reason" aria-label="Reward allocation reason" />
          <DragonButton type="button" disabled={Boolean(mutatingKey) || !selectedMemberId || !selectedRewardId} onClick={addAllocation}>
            Add planned reward
          </DragonButton>
        </div>
      ) : null}
    </DragonCard>
  );
}

function formatRewardPreview(reward: BackendRewardDefinitionDto): string {
  if (reward.rewardType === 'money') return reward.amount === null ? 'money' : `${reward.amount} ${reward.currency ?? 'USD'}`;
  if (reward.rewardType === 'xp') return `${reward.amount ?? reward.value ?? 0} XP`;
  return reward.value ?? reward.rewardType;
}
