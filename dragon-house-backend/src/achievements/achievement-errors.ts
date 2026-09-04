export type AchievementErrorCode =
  | 'ACHIEVEMENT_PERMISSION_DENIED'
  | 'ACHIEVEMENT_MEMBER_NOT_FOUND'
  | 'ACHIEVEMENT_NOT_FOUND'
  | 'REWARD_NOT_FOUND'
  | 'REWARD_ALLOCATION_NOT_FOUND'
  | 'REWARD_GRANT_NOT_FOUND'
  | 'REWARD_TRANSITION_INVALID'
  | 'REWARD_AMOUNT_INVALID'
  | 'REWARD_FINANCE_HANDOFF_FAILED'
  | 'VALIDATION_ERROR'
  | 'ACHIEVEMENT_SERVICE_UNAVAILABLE';

export class AchievementError extends Error {
  constructor(
    readonly code: AchievementErrorCode,
    message: string,
    readonly httpStatus = 400,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export const ACHIEVEMENT_ERROR_MESSAGES: Record<AchievementErrorCode, string> = {
  ACHIEVEMENT_PERMISSION_DENIED: 'Permission denied.',
  ACHIEVEMENT_MEMBER_NOT_FOUND: 'Family member not found.',
  ACHIEVEMENT_NOT_FOUND: 'Achievement not found.',
  REWARD_NOT_FOUND: 'Reward not found.',
  REWARD_ALLOCATION_NOT_FOUND: 'Reward allocation not found.',
  REWARD_GRANT_NOT_FOUND: 'Reward grant not found.',
  REWARD_TRANSITION_INVALID: 'Reward status transition is not allowed.',
  REWARD_AMOUNT_INVALID: 'Reward amount is invalid.',
  REWARD_FINANCE_HANDOFF_FAILED: 'Reward finance handoff failed.',
  VALIDATION_ERROR: 'Invalid achievement or reward request.',
  ACHIEVEMENT_SERVICE_UNAVAILABLE: 'Achievement service is unavailable.',
};
