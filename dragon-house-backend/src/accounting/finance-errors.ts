export type FinanceErrorCode =
  | 'FINANCE_SERVICE_UNAVAILABLE'
  | 'QUEST_NOT_FOUND'
  | 'QUEST_PAYOUT_NOT_FOUND'
  | 'QUEST_PAYOUT_MISMATCH'
  | 'QUEST_PAYOUT_PERMISSION_DENIED'
  | 'QUEST_PAYOUT_TARGET_REQUIRED'
  | 'QUEST_PAYOUT_MEMBER_INVALID'
  | 'QUEST_PAYOUT_AMOUNT_INVALID'
  | 'QUEST_PAYOUT_NOT_PAYABLE'
  | 'QUEST_PAYOUT_ALREADY_PAID'
  | 'QUEST_PAYOUT_IDEMPOTENCY_CONFLICT'
  | 'VALIDATION_ERROR';

export const FINANCE_ERROR_MESSAGES: Record<FinanceErrorCode, string> = {
  FINANCE_SERVICE_UNAVAILABLE: 'Finance service is unavailable.',
  QUEST_NOT_FOUND: 'Quest not found.',
  QUEST_PAYOUT_NOT_FOUND: 'Quest payout not found.',
  QUEST_PAYOUT_MISMATCH: 'Quest payout does not belong to this quest.',
  QUEST_PAYOUT_PERMISSION_DENIED: 'You do not have permission to issue quest payouts.',
  QUEST_PAYOUT_TARGET_REQUIRED: 'Quest payout must target a family member.',
  QUEST_PAYOUT_MEMBER_INVALID: 'Quest payout target member is not active.',
  QUEST_PAYOUT_AMOUNT_INVALID: 'Quest payout amount must be greater than zero.',
  QUEST_PAYOUT_NOT_PAYABLE: 'Quest payout is not payable.',
  QUEST_PAYOUT_ALREADY_PAID: 'Quest payout was already paid.',
  QUEST_PAYOUT_IDEMPOTENCY_CONFLICT: 'Idempotency key was already used for a different payout request.',
  VALIDATION_ERROR: 'Request validation failed.',
};

export class FinanceError extends Error {
  constructor(
    readonly code: FinanceErrorCode,
    message = FINANCE_ERROR_MESSAGES[code],
    readonly httpStatus = 409,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'FinanceError';
  }
}
