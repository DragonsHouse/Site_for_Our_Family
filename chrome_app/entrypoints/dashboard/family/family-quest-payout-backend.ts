import type { IssueBackendQuestPayoutResult } from '../../../lib/family-quest-backend-client';
import type { FamilyQuest, FamilyQuestParticipant, FamilyQuestPayout } from '../../../lib/family-types';

export type BackendPayoutTarget = {
  questId: string;
  payoutId: string;
  payoutKey: string;
  idempotencyKey: string;
};

export function resolveBackendPayoutTarget(quest: FamilyQuest, payout: FamilyQuestPayout | undefined): BackendPayoutTarget | null {
  if (!payout || payout.source !== 'backend' || !payout.backendPayoutId) return null;
  return {
    questId: quest.id,
    payoutId: payout.backendPayoutId,
    payoutKey: backendPayoutKey(quest.id, payout.backendPayoutId),
    idempotencyKey: backendPayoutIdempotencyKey(quest.id, payout.backendPayoutId),
  };
}

export function backendPayoutKey(questId: string, payoutId: string) {
  return `${questId}:${payoutId}`;
}

export function backendPayoutIdempotencyKey(questId: string, payoutId: string) {
  return `family-hub-quest-payout:${questId}:${payoutId}`;
}

export function applyBackendPayoutResultToQuest(quest: FamilyQuest, result: IssueBackendQuestPayoutResult): FamilyQuest {
  const now = result.paidAt;
  const markPerson = (person: FamilyQuestParticipant): FamilyQuestParticipant =>
    person.userId === result.familyMemberId
      ? {
          ...person,
          payoutStatus: 'paid',
          paidAt: person.paidAt ?? now,
          paidBy: person.paidBy ?? result.paidByFamilyMemberId,
        }
      : person;
  const nextPayouts = quest.payouts.map((payout) =>
    payout.backendPayoutId === result.payoutId || (payout.source === 'backend' && payout.userId === result.familyMemberId)
      ? {
          ...payout,
          source: 'backend' as const,
          backendPayoutId: result.payoutId,
          backendFamilyMemberId: result.familyMemberId,
          amount: result.amount,
          finalAmount: result.amount,
          status: 'paid' as const,
          paidAt: result.paidAt,
          issuedAt: result.paidAt,
          paidBy: result.paidByFamilyMemberId,
          paidByFamilyMemberId: result.paidByFamilyMemberId,
          payoutEventKey: result.payoutEventKey,
          idempotencyKey: result.idempotencyKey,
          accrualId: result.accrual?.id ?? payout.accrualId ?? null,
          accountingTransactionId: result.accountingTransaction?.id ?? payout.accountingTransactionId ?? null,
        }
      : payout
  );
  const allPaid = nextPayouts.length > 0 && nextPayouts.every((payout) => payout.status === 'paid');
  return {
    ...quest,
    status: allPaid ? 'paid' : quest.status,
    payouts: nextPayouts,
    participants: quest.participants.map(markPerson),
    helpers: (quest.helpers ?? []).map(markPerson),
    paidAt: allPaid ? quest.paidAt ?? now : quest.paidAt ?? null,
    paidBy: allPaid ? quest.paidBy ?? result.paidByFamilyMemberId : quest.paidBy ?? null,
    updatedAt: now,
  };
}
