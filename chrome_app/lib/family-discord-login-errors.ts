export function translateDiscordLoginError(message: string) {
  if (message === 'DISCORD_ACCOUNT_NOT_LINKED' || message.includes('not provisioned')) {
    return 'Ми впізнали твій Discord, але не знайшли тебе у списку Dragon House. Звернися до Хранителя Полум’я або Володарки, щоб завершити вступ.';
  }
  if (message === 'MEMBER_INACTIVE' || message.includes('inactive')) {
    return 'Цей профіль Dragon House зараз неактивний. Звернися до адміністрації сім’ї.';
  }
  if (message === 'OAUTH_DENIED' || message.includes('cancelled') || message.includes('denied')) {
    return 'Discord-вхід скасовано. Можеш спробувати ще раз, коли будеш готова.';
  }
  if (message === 'OAUTH_STATE_INVALID' || message.includes('invalid state')) {
    return 'Discord-вхід не вдалося підтвердити. Почни спробу ще раз із Family Hub.';
  }
  if (message === 'OAUTH_STATE_EXPIRED' || message.includes('expired')) {
    return 'Спроба входу застаріла. Почни Discord-вхід ще раз.';
  }
  if (message === 'LOGIN_COMPLETION_ALREADY_USED' || message.includes('already used')) {
    return 'Цей код входу вже використано. Почни Discord-вхід ще раз.';
  }
  if (message === 'LOGIN_COMPLETION_EXPIRED') {
    return 'Вікно входу застаріло. Почни Discord-вхід ще раз.';
  }
  if (message === 'OAUTH_CODE_EXCHANGE_FAILED' || message === 'DISCORD_IDENTITY_FAILED') {
    return 'Discord тимчасово не підтвердив профіль. Спробуй ще раз трохи пізніше.';
  }
  if (message.includes('Failed to fetch') || message.includes('backend')) {
    return 'Family Hub зараз не може підключитися до сервера. Перевір, що сервер запущений, і спробуй ще раз.';
  }
  return 'Не вдалося завершити Discord-вхід. Спробуй ще раз або звернися до адміністрації.';
}
