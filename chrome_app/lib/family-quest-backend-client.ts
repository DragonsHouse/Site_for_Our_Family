import { authenticatedFetch } from './family-backend-auth-client.ts';
import {
  parseBackendQuestDetailResponse,
  parseBackendQuestListResponse,
  parseBackendQuestTemplateResponse,
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

export type BackendQuestTemplateWriteInput = {
  templateKey?: string;
  title: string;
  category: string;
  description?: string | null;
  steps?: string[];
  recommendedTeamSize?: number;
  totalReward?: number;
  memberRewardPool?: number;
  familyReward?: number;
  rewardMode?: string;
  requiredItems?: string | null;
  imageAssetId?: string | null;
  isActive?: boolean;
  cooldownHours?: number;
};

export type BackendQuestWriteInput = {
  templateId?: string | null;
  title: string;
  description?: string | null;
  category: string;
  status?: string;
  startsAt?: string | null;
  scheduledAt?: string | null;
  totalReward?: number;
  memberRewardPool?: number;
  familyReward?: number;
  rewardMode?: string;
  requiredItems?: string | null;
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

export async function createBackendFamilyQuestTemplate(input: BackendQuestTemplateWriteInput): Promise<BackendFamilyQuestTemplateDto> {
  return parseBackendQuestTemplateResponse(await authenticatedFetch('/api/family/quest-templates', {
    method: 'POST',
    body: JSON.stringify(input),
  }));
}

export async function updateBackendFamilyQuestTemplate(templateId: string, input: Partial<BackendQuestTemplateWriteInput>): Promise<BackendFamilyQuestTemplateDto> {
  return parseBackendQuestTemplateResponse(await authenticatedFetch(`/api/family/quest-templates/${encodeURIComponent(templateId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }));
}

export async function archiveBackendFamilyQuestTemplate(templateId: string): Promise<BackendFamilyQuestTemplateDto> {
  return parseBackendQuestTemplateResponse(await authenticatedFetch(`/api/family/quest-templates/${encodeURIComponent(templateId)}`, {
    method: 'DELETE',
  }));
}

export async function createBackendFamilyQuest(input: BackendQuestWriteInput): Promise<BackendFamilyQuestDto> {
  return parseBackendQuestDetailResponse(await authenticatedFetch('/api/family/quests', {
    method: 'POST',
    body: JSON.stringify(input),
  }));
}

export async function updateBackendFamilyQuest(questId: string, input: Partial<BackendQuestWriteInput>): Promise<BackendFamilyQuestDto> {
  return parseBackendQuestDetailResponse(await authenticatedFetch(`/api/family/quests/${encodeURIComponent(questId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }));
}

export async function joinBackendFamilyQuest(questId: string, role: 'participant' | 'helper' = 'participant'): Promise<void> {
  await authenticatedFetch(`/api/family/quests/${encodeURIComponent(questId)}/join`, {
    method: 'POST',
    body: JSON.stringify({ role }),
  });
}

export async function withdrawBackendFamilyQuest(questId: string): Promise<void> {
  await authenticatedFetch(`/api/family/quests/${encodeURIComponent(questId)}/withdraw`, { method: 'POST' });
}

export async function completeBackendFamilyQuest(questId: string, comment?: string | null): Promise<BackendFamilyQuestDto> {
  return parseBackendQuestDetailResponse(await authenticatedFetch(`/api/family/quests/${encodeURIComponent(questId)}/complete`, {
    method: 'POST',
    body: JSON.stringify({ comment: comment ?? null }),
  }));
}

export async function createBackendFamilyQuestReport(questId: string, comment?: string | null): Promise<BackendFamilyQuestDto> {
  return parseBackendQuestDetailResponse(await authenticatedFetch(`/api/family/quests/${encodeURIComponent(questId)}/report`, {
    method: 'POST',
    body: JSON.stringify({ comment: comment ?? null }),
  }));
}

export async function transferBackendFamilyQuestReportToAccounting(questId: string): Promise<BackendFamilyQuestDto> {
  return parseBackendQuestDetailResponse(await authenticatedFetch(`/api/family/quests/${encodeURIComponent(questId)}/report/transfer-to-accounting`, {
    method: 'POST',
  }));
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
