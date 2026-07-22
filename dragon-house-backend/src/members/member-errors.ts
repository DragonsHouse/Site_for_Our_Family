export type FamilyMemberErrorCode =
  | 'MEMBER_NOT_FOUND'
  | 'MEMBER_ALREADY_EXISTS'
  | 'MEMBER_STATIC_ID_CONFLICT'
  | 'MEMBER_NICKNAME_CONFLICT'
  | 'MEMBER_VERSION_CONFLICT'
  | 'MEMBER_LAST_OWNER'
  | 'MEMBER_CANNOT_EDIT_FIELD'
  | 'MEMBER_PERMISSION_DENIED'
  | 'MEMBER_INACTIVE'
  | 'VALIDATION_ERROR';

export class FamilyMemberError extends Error {
  constructor(
    readonly code: FamilyMemberErrorCode,
    message: string,
    readonly httpStatus = 400,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'FamilyMemberError';
  }
}

export const MEMBER_ERROR_MESSAGES: Record<FamilyMemberErrorCode, string> = {
  MEMBER_NOT_FOUND: 'Учасника не знайдено.',
  MEMBER_ALREADY_EXISTS: 'Такий учасник уже існує.',
  MEMBER_STATIC_ID_CONFLICT: 'Static ID уже використовується іншим учасником.',
  MEMBER_NICKNAME_CONFLICT: 'Nickname уже використовується іншим учасником.',
  MEMBER_VERSION_CONFLICT: 'Дані учасника вже були змінені іншим користувачем.',
  MEMBER_LAST_OWNER: 'Не можна змінити або видалити останнього активного owner.',
  MEMBER_CANNOT_EDIT_FIELD: 'Це поле не можна змінити для цього користувача.',
  MEMBER_PERMISSION_DENIED: 'Недостатньо прав для цієї дії.',
  MEMBER_INACTIVE: 'Учасник неактивний.',
  VALIDATION_ERROR: 'Некоректні дані запиту.',
};
