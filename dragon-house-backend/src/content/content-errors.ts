export type FamilyContentErrorCode =
  | 'CONTENT_PERMISSION_DENIED'
  | 'CONTENT_NOT_FOUND'
  | 'CONTENT_VERSION_CONFLICT'
  | 'VALIDATION_ERROR'
  | 'CONTENT_SERVICE_UNAVAILABLE';

export const FAMILY_CONTENT_ERROR_MESSAGES: Record<FamilyContentErrorCode, string> = {
  CONTENT_PERMISSION_DENIED: 'Недостатньо прав для редагування матеріалів Dragon House.',
  CONTENT_NOT_FOUND: 'Матеріал Dragon House не знайдено.',
  CONTENT_VERSION_CONFLICT: 'Матеріал уже змінили в іншому вікні. Онови дані перед збереженням.',
  VALIDATION_ERROR: 'Дані матеріалу некоректні.',
  CONTENT_SERVICE_UNAVAILABLE: 'Матеріали Dragon House тимчасово недоступні.',
};

export class FamilyContentError extends Error {
  constructor(
    readonly code: FamilyContentErrorCode,
    message: string,
    readonly httpStatus = 400,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'FamilyContentError';
  }
}
