import { FamilyEventError } from '../family-events/family-event-errors.js';
import { FamilyQuestError } from '../quests/quest-errors.js';
import { TowerDefenseError } from '../tower-defense/tower-defense-errors.js';
import { DiscordIdentityError } from './identity-resolver.js';
import { DiscordOrchestrationError } from './orchestration-errors.js';

export function friendlyDiscordError(error: unknown): { code: string; content: string } {
  if (error instanceof DiscordOrchestrationError) {
    return { code: error.code, content: `🐉 ${error.message}` };
  }
  if (error instanceof DiscordIdentityError) {
    if (error.code === 'DISCORD_ACCOUNT_NOT_LINKED') {
      return {
        code: error.code,
        content: '🐉 Ваш Discord ще не привʼязаний до Dragon House Hub. Відкрийте Hub і привʼяжіть Discord account у профілі.',
      };
    }
    if (error.code === 'DISCORD_LINKED_MEMBER_INACTIVE') {
      return { code: error.code, content: '🐉 Ваш профіль у сімʼї зараз не активний. Напишіть Старшим драконам, якщо це помилка.' };
    }
    return { code: error.code, content: '🐉 Не вдалося знайти ваш профіль у Dragon House Hub.' };
  }
  if (error instanceof FamilyQuestError) {
    const messages: Record<string, string> = {
      QUEST_NOT_FOUND: '🐉 Квест не знайдено.',
      QUEST_PERMISSION_DENIED: '🐉 У вас немає прав для цієї дії з квестом.',
      QUEST_INVALID_TRANSITION: '🐉 Зараз квест не дозволяє цю дію.',
      QUEST_MEMBER_NOT_FOUND: '🐉 Учасника сімʼї не знайдено.',
    };
    return { code: error.code, content: messages[error.code] ?? '🐉 Не вдалося виконати дію з квестом.' };
  }
  if (error instanceof TowerDefenseError) {
    const messages: Record<string, string> = {
      DEFENSE_NOT_FOUND: '🐉 Вишку / захист не знайдено.',
      TOWER_DEFENSE_PERMISSION_DENIED: '🐉 У вас немає прав для цієї дії з вишкою.',
      INVALID_TRANSITION: '🐉 Зараз захист не дозволяє цю дію.',
      INVALID_ATTENDANCE_MEMBER: '🐉 Attendance можна ставити тільки для релевантних учасників.',
    };
    return { code: error.code, content: messages[error.code] ?? '🐉 Не вдалося виконати дію з вишкою.' };
  }
  if (error instanceof Error && error.message === 'DISCORD_CHANNEL_PERMISSION_MISSING') {
    return { code: 'DISCORD_CHANNEL_PERMISSION_MISSING', content: 'Bot lacks required permissions for this Discord channel.' };
  }
  if (error instanceof Error && error.message === 'DISCORD_CHANNEL_UNAVAILABLE') {
    return { code: 'DISCORD_CHANNEL_UNAVAILABLE', content: 'Discord channel is unavailable or deleted.' };
  }
  if (error instanceof FamilyEventError) {
    const messages: Record<string, string> = {
      FAMILY_EVENT_NOT_FOUND: '🐉 Подію не знайдено.',
      FAMILY_EVENT_PERMISSION_DENIED: '🐉 У вас немає прав для цієї дії з подією.',
      FAMILY_EVENT_INVALID_TRANSITION: '🐉 Зараз подія не дозволяє цю дію.',
      FAMILY_EVENT_INVALID_ATTENDANCE_MEMBER: '🐉 Attendance можна ставити тільки для релевантних учасників.',
    };
    return { code: error.code, content: messages[error.code] ?? '🐉 Не вдалося виконати дію з подією.' };
  }
  if (error instanceof Error && error.message === 'DISCORD_GUILD_NOT_ALLOWED') {
    return { code: 'DISCORD_GUILD_NOT_ALLOWED', content: '🐉 Ця Discord дія доступна тільки у Dragon House guild.' };
  }
  if (error instanceof Error && error.message === 'DISCORD_CHANNEL_NOT_ALLOWED') {
    return { code: 'DISCORD_CHANNEL_NOT_ALLOWED', content: '🐉 Цей Discord канал не дозволений для Dragon House orchestration.' };
  }
  return { code: 'DISCORD_ORCHESTRATION_ERROR', content: '🐉 Щось пішло не так. Спробуйте ще раз або напишіть Старшим драконам.' };
}
