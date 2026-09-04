export type MemberActivityErrorCode =
  | 'MEMBER_ACTIVITY_PERMISSION_DENIED'
  | 'MEMBER_ACTIVITY_MEMBER_NOT_FOUND'
  | 'MEMBER_ACTIVITY_SERVICE_UNAVAILABLE'
  | 'VALIDATION_ERROR';

export const MEMBER_ACTIVITY_ERROR_MESSAGES: Record<MemberActivityErrorCode, string> = {
  MEMBER_ACTIVITY_PERMISSION_DENIED: 'You do not have permission to view this member profile activity.',
  MEMBER_ACTIVITY_MEMBER_NOT_FOUND: 'Family member was not found.',
  MEMBER_ACTIVITY_SERVICE_UNAVAILABLE: 'Member activity service is unavailable.',
  VALIDATION_ERROR: 'Request validation failed.',
};

export class MemberActivityError extends Error {
  constructor(
    readonly code: MemberActivityErrorCode,
    message: string,
    readonly httpStatus = 400,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'MemberActivityError';
  }
}
