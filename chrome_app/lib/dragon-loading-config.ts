export const DRAGON_LOADING_MESSAGES = [
  "Запалюємо Вічне Полум’я...",
  'Відчиняємо ворота штабу...',
  'Пробуджуємо древніх драконів...',
  "Скликаємо членів сім’ї...",
  'Перевіряємо печатки клану...',
  "Синхронізуємо полум’я...",
  'Готуємо Залу Драконів...',
  'Оновлюємо літопис...',
  'Активуємо захист штабу...',
  "Встановлюємо зв’язок із Dragon House..."
];

export const DRAGON_LOADING_QUOTES = [
  "Полум’я пам’ятає кожного, хто присягнув сім’ї.",
  'Сила дракона не лише в крилах. Сила - у сім\'ї.',
  'Лише вірні проходять крізь ворота штабу.',
  "Вічне Полум’я ніколи не згасає.",
  'Кожен дракон залишає слід у хроніках.',
  'Давній вогонь знову запалено.',
  "Полум’я єднає. Честь веде. Сім’я понад усе."
];

export const DRAGON_LOADING_DURATION = {
  minMs: 2700,
  maxMs: 3600,
  messageIntervalMs: 760,
  flareMs: 520,
  fadeOutMs: 420
};

export const DRAGON_FIRE_AUDIO = {
  loopUrl: '/assets/dragon-house/audio/fireplace-loop.wav',
  preferenceKey: 'dragon_house_fire_loading_sound_enabled_v1',
  volume: 0.12,
  fadeStepMs: 90
};
