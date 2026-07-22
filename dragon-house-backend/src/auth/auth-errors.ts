import type { FamilyAuthErrorCode } from '../types.js';

export class FamilyAuthError extends Error {
  constructor(
    readonly code: FamilyAuthErrorCode,
    message: string,
    readonly httpStatus = 401,
  ) {
    super(message);
    this.name = 'FamilyAuthError';
  }
}

export function authErrorMessage(code: FamilyAuthErrorCode): string {
  const messages: Record<FamilyAuthErrorCode, string> = {
    invalid_credentials: 'Невірний login/static ID або пароль.',
    account_disabled: 'Акаунт деактивований.',
    session_required: 'Потрібна авторизація Family Hub.',
    session_invalid: 'Сесія недійсна.',
    session_expired: 'Сесія застаріла.',
    password_change_required: 'Потрібно змінити тимчасовий пароль.',
    current_password_invalid: 'Поточний пароль неправильний.',
    password_too_weak: 'Новий пароль занадто слабкий.',
    login_rate_limited: 'Забагато спроб входу. Спробуйте трохи пізніше.',
    database_unavailable: 'Backend database недоступна.',
  };
  return messages[code];
}
