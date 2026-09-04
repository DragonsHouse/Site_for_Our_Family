import type { BackendMemberRewardGrantDto } from './family-achievements-backend-response.ts';

export function getRewardStatusLabel(grant: BackendMemberRewardGrantDto): string {
  if (grant.status === 'earned') return 'Awaiting approval';
  if (grant.status === 'approved') return grant.reward.rewardType === 'money' ? 'Approved, awaiting accounting' : 'Approved';
  if (grant.status === 'issued') {
    if (grant.reward.rewardType === 'money') return grant.financeAccrualId ? 'Transferred to accounting' : 'Issued, awaiting accounting';
    return 'Issued';
  }
  return 'Cancelled';
}

export function getRewardSourceLabel(sourceModule: string): string {
  if (sourceModule === 'quests') return 'Квести';
  if (sourceModule === 'tower_defense') return 'Вишки';
  if (sourceModule === 'events') return 'Події';
  if (sourceModule === 'achievements') return 'Досягнення';
  if (sourceModule === 'manual') return 'Manual/Admin';
  return 'Активність';
}

export function formatRewardValue(grant: BackendMemberRewardGrantDto): string {
  if (grant.reward.rewardType === 'money') {
    return grant.reward.amount === null ? 'Money reward' : `${grant.reward.amount} ${grant.reward.currency ?? 'USD'}`;
  }
  if (grant.reward.rewardType === 'xp') return `${grant.reward.amount ?? grant.reward.value ?? 0} XP`;
  return grant.reward.value ?? grant.reward.rewardType;
}
