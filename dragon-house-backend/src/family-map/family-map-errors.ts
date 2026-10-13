export type FamilyMapErrorCode =
  | 'FAMILY_MAP_SERVICE_UNAVAILABLE'
  | 'FAMILY_MAP_PERMISSION_DENIED'
  | 'FAMILY_MAP_VERSION_CONFLICT'
  | 'VALIDATION_ERROR';

export const FAMILY_MAP_ERROR_MESSAGES: Record<FamilyMapErrorCode, string> = {
  FAMILY_MAP_SERVICE_UNAVAILABLE: 'Карта сімʼї тимчасово недоступна.',
  FAMILY_MAP_PERMISSION_DENIED: 'Недостатньо прав для цієї дії з картою.',
  FAMILY_MAP_VERSION_CONFLICT: 'Карту вже змінили в іншому вікні. Оновіть дані й повторіть збереження.',
  VALIDATION_ERROR: 'Дані карти некоректні.',
};

export class FamilyMapError extends Error {
  constructor(
    readonly code: FamilyMapErrorCode,
    message: string,
    readonly httpStatus = 400,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}
