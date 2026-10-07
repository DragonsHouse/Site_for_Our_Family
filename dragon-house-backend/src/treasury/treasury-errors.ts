export type FamilyTreasuryErrorCode =
  | 'TREASURY_SERVICE_UNAVAILABLE'
  | 'TREASURY_PERMISSION_DENIED'
  | 'TREASURY_ENTRY_NOT_FOUND'
  | 'TREASURY_VERSION_CONFLICT'
  | 'VALIDATION_ERROR';

export const FAMILY_TREASURY_ERROR_MESSAGES: Record<FamilyTreasuryErrorCode, string> = {
  TREASURY_SERVICE_UNAVAILABLE: 'Скарбниця тимчасово недоступна.',
  TREASURY_PERMISSION_DENIED: 'Недостатньо прав для цієї дії.',
  TREASURY_ENTRY_NOT_FOUND: 'Запис Скарбниці не знайдено.',
  TREASURY_VERSION_CONFLICT: 'Дані вже були змінені в іншому вікні або іншим користувачем.',
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
