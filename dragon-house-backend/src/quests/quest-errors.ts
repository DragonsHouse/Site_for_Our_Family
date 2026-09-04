export type FamilyQuestErrorCode =
  | 'QUEST_NOT_FOUND'
  | 'QUEST_PERMISSION_DENIED'
  | 'QUEST_SERVICE_UNAVAILABLE'
  | 'QUEST_INVALID_TRANSITION'
  | 'QUEST_MEMBER_NOT_FOUND'
  | 'VALIDATION_ERROR';

export const QUEST_ERROR_MESSAGES: Record<FamilyQuestErrorCode, string> = {
  QUEST_NOT_FOUND: 'Quest not found.',
  QUEST_PERMISSION_DENIED: 'Permission denied.',
  QUEST_SERVICE_UNAVAILABLE: 'Quest API is unavailable.',
  QUEST_INVALID_TRANSITION: 'Quest status does not allow this action.',
  QUEST_MEMBER_NOT_FOUND: 'Family member not found.',
  VALIDATION_ERROR: 'Invalid quest request.',
};

export class FamilyQuestError extends Error {
  constructor(
    readonly code: FamilyQuestErrorCode,
    message: string,
    readonly httpStatus: number,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}
