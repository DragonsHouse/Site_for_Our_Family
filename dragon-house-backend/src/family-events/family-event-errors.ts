export type FamilyEventErrorCode =
  | 'FAMILY_EVENT_SERVICE_UNAVAILABLE'
  | 'FAMILY_EVENT_NOT_FOUND'
  | 'FAMILY_EVENT_MEMBER_NOT_FOUND'
  | 'FAMILY_EVENT_PERMISSION_DENIED'
  | 'FAMILY_EVENT_INVALID_TIME_RANGE'
  | 'FAMILY_EVENT_INVALID_TRANSITION'
  | 'FAMILY_EVENT_INVALID_ATTENDANCE_MEMBER'
  | 'VALIDATION_ERROR';

export const FAMILY_EVENT_ERROR_MESSAGES: Record<FamilyEventErrorCode, string> = {
  FAMILY_EVENT_SERVICE_UNAVAILABLE: 'Family event service is unavailable.',
  FAMILY_EVENT_NOT_FOUND: 'Family event not found.',
  FAMILY_EVENT_MEMBER_NOT_FOUND: 'Family member not found.',
  FAMILY_EVENT_PERMISSION_DENIED: 'Permission denied.',
  FAMILY_EVENT_INVALID_TIME_RANGE: 'Invalid event time range.',
  FAMILY_EVENT_INVALID_TRANSITION: 'Invalid event status transition.',
  FAMILY_EVENT_INVALID_ATTENDANCE_MEMBER: 'Attendance member must have an active event response.',
  VALIDATION_ERROR: 'Invalid request.',
};

export class FamilyEventError extends Error {
  constructor(
    readonly code: FamilyEventErrorCode,
    message: string,
    readonly httpStatus = 400,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}
