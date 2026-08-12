import { authenticatedFetch } from './family-backend-auth-client.ts';
import {
  parseBackendQuestDetailResponse,
  parseBackendQuestListResponse,
  parseBackendQuestTemplateListResponse
} from './family-quest-backend-response.ts';
import {
  FamilyQuestPayoutApiError,
  parseIssueBackendQuestPayoutResponse
} from './family-quest-payout-response.ts';
import type {
  BackendFamilyQuestDto,
  BackendFamilyQuestTemplateDto
} from './family-quest-backend-response.ts';
import type { IssueBackendQuestPayoutResult } from './family-quest-payout-response.ts';

export {
  FamilyQuestPayoutApiError,
  parseIssueBackendQuestPayoutResponse
} from './family-quest-payout-response.ts';
export type {
  BackendQuestPayoutFinanceRecord,
  FamilyQuestPayoutApiErrorCode,
  IssueBackendQuestPayoutResult
} from './family-quest-payout-response.ts';

export type IssueBackendQuestPayoutInput = {
  questId: string;
  payoutId: string;
  idempotencyKey: string;
  signal?: AbortSignal;
};

export type ListBackendFamilyQuestsInput = {
  status?: string | null;
  activeOnly?: boolean;
  signal?: AbortSignal;
};

export async function listBackendFamilyQuestTemplates(signal?: AbortSignal): Promise<{ items: BackendFamilyQuestTemplateDto[] }> {
  return parseBackendQuestTemplateListResponse(await authenticatedFetch('/api/family/quest-templates', { method: 'GET', signal }));
}

export async function listBackendFamilyQuests(input: ListBackendFamilyQuestsInput = {}): Promise<{ items: BackendFamilyQuestDto[] }> {
  const params = new URLSearchParams();
  if (input.status) params.set('status', input.status);
  if (input.activeOnly !== undefined) params.set('activeOnly', String(input.activeOnly));
  const query = params.size ? `?${params.toString()}` : '';
  return parseBackendQuestListResponse(await authenticatedFetch(`/api/family/quests${query}`, { method: 'GET', signal: input.signal }));
}

export async function getBackendFamilyQuest(questId: string, signal?: AbortSignal): Promise<BackendFamilyQuestDto> {
  return parseBackendQuestDetailResponse(await authenticatedFetch(`/api/family/quests/${encodeURIComponent(questId)}`, { method: 'GET', signal }));
}

export async function issueBackendQuestPayout(input: IssueBackendQuestPayoutInput): Promise<IssueBackendQuestPayoutResult> {
  const path = `/api/family/quests/${encodeURIComponent(input.questId)}/payouts/${encodeURIComponent(input.payoutId)}/issue`;
  let response: Response;
  try {
    response = await authenticatedFetch(path, {
      method: 'POST',
      body: JSON.stringify({ confirm: true, idempotencyKey: input.idempotencyKey }),
      signal: input.signal,
    });
  } catch (error) {
    if (error instanceof FamilyQuestPayoutApiError) throw error;
    throw new FamilyQuestPayoutApiError('BACKEND_UNAVAILABLE', 'Quest payout backend is unavailable', 0);
  }
  return parseIssueBackendQuestPayoutResponse(response);
}
