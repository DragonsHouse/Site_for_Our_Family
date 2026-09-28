export type FamilyTreasuryErrorCode =
  | 'TREASURY_SERVICE_UNAVAILABLE'
  | 'TREASURY_PERMISSION_DENIED'
  | 'TREASURY_ENTRY_NOT_FOUND'
  | 'VALIDATION_ERROR';

export const FAMILY_TREASURY_ERROR_MESSAGES: Record<FamilyTreasuryErrorCode, string> = {
  TREASURY_SERVICE_UNAVAILABLE: 'Скарбниця тимчасово недоступна.',
  TREASURY_PERMISSION_DENIED: 'Недостатньо прав для цієї дії.',
  TREASURY_ENTRY_NOT_FOUND: 'Запис Скарбниці не знайдено.',
  VALIDATION_ERROR: 'Дані запиту некоректні.',
};

export class FamilyTreasuryError extends Error {
  constructor(
    readonly code: FamilyTreasuryErrorCode,
    message: string,
    readonly httpStatus = 400,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}
