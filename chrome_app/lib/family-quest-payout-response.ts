export type BackendQuestPayoutFinanceRecord = {
  id: string;
};

export type IssueBackendQuestPayoutResult = {
  questId: string;
  payoutId: string;
  familyMemberId: string;
  amount: number;
  currency: string;
  payoutStatus: 'paid';
  paidAt: string;
  paidByFamilyMemberId: string;
  idempotencyKey: string | null;
  payoutEventKey: string;
  accrual: BackendQuestPayoutFinanceRecord | null;
  accountingTransaction: BackendQuestPayoutFinanceRecord | null;
  alreadyIssued: boolean;
};

export type FamilyQuestPayoutApiErrorCode =
  | 'QUEST_PAYOUT_UNAUTHORIZED'
  | 'QUEST_NOT_FOUND'
  | 'QUEST_PAYOUT_NOT_FOUND'
  | 'QUEST_PAYOUT_MISMATCH'
  | 'QUEST_PAYOUT_ALREADY_PAID'
  | 'QUEST_PAYOUT_IDEMPOTENCY_CONFLICT'
  | 'FINANCE_SERVICE_UNAVAILABLE'
  | 'BACKEND_UNAVAILABLE'
  | 'MALFORMED_RESPONSE'
  | 'UNKNOWN_ERROR';

export class FamilyQuestPayoutApiError extends Error {
  readonly code: FamilyQuestPayoutApiErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(
    code: FamilyQuestPayoutApiErrorCode,
    message: string,
    status: number,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'FamilyQuestPayoutApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function parseIssueBackendQuestPayoutResponse(response: Response): Promise<IssueBackendQuestPayoutResult> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const record = isRecord(body) ? body : {};
    throw new FamilyQuestPayoutApiError(
      toPayoutApiErrorCode(record.code),
      typeof record.message === 'string' ? record.message : `Quest payout request failed: ${response.status}`,
      response.status,
      isRecord(record.details) ? record.details : {},
    );
  }

  return assertIssueBackendQuestPayoutResult(body);
}

function assertIssueBackendQuestPayoutResult(body: unknown): IssueBackendQuestPayoutResult {
  if (!isRecord(body)) throw malformed();
  if (
    typeof body.questId !== 'string' ||
    typeof body.payoutId !== 'string' ||
    typeof body.familyMemberId !== 'string' ||
    typeof body.amount !== 'number' ||
    typeof body.currency !== 'string' ||
    body.payoutStatus !== 'paid' ||
    typeof body.paidAt !== 'string' ||
    typeof body.paidByFamilyMemberId !== 'string' ||
    !(typeof body.idempotencyKey === 'string' || body.idempotencyKey === null) ||
    typeof body.payoutEventKey !== 'string' ||
    typeof body.alreadyIssued !== 'boolean'
  ) {
    throw malformed();
  }

  return {
    questId: body.questId,
    payoutId: body.payoutId,
    familyMemberId: body.familyMemberId,
    amount: body.amount,
    currency: body.currency,
    payoutStatus: body.payoutStatus,
    paidAt: body.paidAt,
    paidByFamilyMemberId: body.paidByFamilyMemberId,
    idempotencyKey: body.idempotencyKey,
    payoutEventKey: body.payoutEventKey,
    accrual: optionalFinanceRecord(body.accrual),
    accountingTransaction: optionalFinanceRecord(body.accountingTransaction),
    alreadyIssued: body.alreadyIssued,
  };
}

function optionalFinanceRecord(value: unknown): BackendQuestPayoutFinanceRecord | null {
  if (value === null) return null;
  if (isRecord(value) && typeof value.id === 'string') return { id: value.id };
  throw malformed();
}

function toPayoutApiErrorCode(code: unknown): FamilyQuestPayoutApiErrorCode {
  if (
    code === 'QUEST_PAYOUT_UNAUTHORIZED' ||
    code === 'QUEST_NOT_FOUND' ||
    code === 'QUEST_PAYOUT_NOT_FOUND' ||
    code === 'QUEST_PAYOUT_MISMATCH' ||
    code === 'QUEST_PAYOUT_ALREADY_PAID' ||
    code === 'QUEST_PAYOUT_IDEMPOTENCY_CONFLICT' ||
    code === 'FINANCE_SERVICE_UNAVAILABLE'
  ) {
    return code;
  }
  if (code === 'QUEST_PAYOUT_PERMISSION_DENIED') return 'QUEST_PAYOUT_UNAUTHORIZED';
  return 'UNKNOWN_ERROR';
}

function malformed() {
  return new FamilyQuestPayoutApiError('MALFORMED_RESPONSE', 'Quest payout response was malformed', 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
