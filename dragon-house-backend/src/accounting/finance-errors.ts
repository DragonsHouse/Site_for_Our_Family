export type FinanceErrorCode =
  | 'FINANCE_SERVICE_UNAVAILABLE'
  | 'ACCOUNTING_PERMISSION_DENIED'
  | 'ACCOUNTING_MEMBER_NOT_FOUND'
  | 'ACCOUNTING_PERIOD_NOT_FOUND'
  | 'ACCOUNTING_PERIOD_CLOSED'
  | 'ACCOUNTING_PERIOD_INVALID'
  | 'ACCOUNTING_CONFIGURATION_INCOMPLETE'
  | 'ACCOUNTING_RULE_NOT_FOUND'
  | 'ACCOUNTING_ACCRUAL_NOT_FOUND'
  | 'ACCOUNTING_ACCRUAL_NOT_PAYABLE'
  | 'ACCOUNTING_PAYOUT_BATCH_NOT_FOUND'
  | 'ACCOUNTING_PAYOUT_BATCH_INVALID'
  | 'ACCOUNTING_PAYOUT_ITEM_NOT_FOUND'
  | 'ACCOUNTING_PAYOUT_ALREADY_PAID'
  | 'ACCOUNTING_PAYMENT_PROOF_REQUIRED'
  | 'ACCOUNTING_PAYMENT_PROOF_INVALID'
  | 'ACCOUNTING_PAYMENT_PROOF_NOT_FOUND'
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
  ACCOUNTING_PERMISSION_DENIED: 'You do not have permission to manage accounting.',
  ACCOUNTING_MEMBER_NOT_FOUND: 'Family member not found.',
  ACCOUNTING_PERIOD_NOT_FOUND: 'Payroll period not found.',
  ACCOUNTING_PERIOD_CLOSED: 'Payroll period is closed for changes.',
  ACCOUNTING_PERIOD_INVALID: 'Payroll period is invalid.',
  ACCOUNTING_CONFIGURATION_INCOMPLETE: 'Payroll configuration is incomplete.',
  ACCOUNTING_RULE_NOT_FOUND: 'Salary rule not found.',
  ACCOUNTING_ACCRUAL_NOT_FOUND: 'Accrual not found.',
  ACCOUNTING_ACCRUAL_NOT_PAYABLE: 'Accrual is not payable.',
  ACCOUNTING_PAYOUT_BATCH_NOT_FOUND: 'Payout batch not found.',
  ACCOUNTING_PAYOUT_BATCH_INVALID: 'Payout batch is not in a valid state for this action.',
  ACCOUNTING_PAYOUT_ITEM_NOT_FOUND: 'Payout batch item not found.',
  ACCOUNTING_PAYOUT_ALREADY_PAID: 'Payout item was already paid.',
  ACCOUNTING_PAYMENT_PROOF_REQUIRED: 'Payment proof screenshot is required.',
  ACCOUNTING_PAYMENT_PROOF_INVALID: 'Payment proof screenshot is invalid.',
  ACCOUNTING_PAYMENT_PROOF_NOT_FOUND: 'Payment proof screenshot was not found.',
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
