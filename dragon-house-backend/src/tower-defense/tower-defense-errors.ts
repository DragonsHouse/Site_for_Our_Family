export type TowerDefenseErrorCode =
  | 'TOWER_DEFENSE_SERVICE_UNAVAILABLE'
  | 'TOWER_DEFENSE_PERMISSION_DENIED'
  | 'TOWER_NOT_FOUND'
  | 'TOWER_INACTIVE'
  | 'DEFENSE_NOT_FOUND'
  | 'MEMBER_NOT_FOUND'
  | 'INVALID_GUARD_COUNTS'
  | 'INVALID_TIME_RANGE'
  | 'INVALID_TRANSITION'
  | 'INVALID_ATTENDANCE_MEMBER'
  | 'DUPLICATE_RESPONSE'
  | 'VALIDATION_ERROR';

export const TOWER_DEFENSE_ERROR_MESSAGES: Record<TowerDefenseErrorCode, string> = {
  TOWER_DEFENSE_SERVICE_UNAVAILABLE: 'Tower Defense service is unavailable.',
  TOWER_DEFENSE_PERMISSION_DENIED: 'Permission denied.',
  TOWER_NOT_FOUND: 'Tower not found.',
  TOWER_INACTIVE: 'Tower is inactive.',
  DEFENSE_NOT_FOUND: 'Tower defense not found.',
  MEMBER_NOT_FOUND: 'Family member not found.',
  INVALID_GUARD_COUNTS: 'Guard counts must satisfy minimum <= recommended <= maximum.',
  INVALID_TIME_RANGE: 'Defense time range is invalid.',
  INVALID_TRANSITION: 'Defense status transition is not allowed.',
  INVALID_ATTENDANCE_MEMBER: 'Attendance member must have an active response for this defense.',
  DUPLICATE_RESPONSE: 'Member already has a response for this defense.',
  VALIDATION_ERROR: 'Validation error.',
};

export class TowerDefenseError extends Error {
  constructor(
    readonly code: TowerDefenseErrorCode,
    message: string,
    readonly httpStatus = 400,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'TowerDefenseError';
  }
}
