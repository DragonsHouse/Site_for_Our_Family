# Quant RP Helper (Browser Extension)

## Dragon House auth persistence

Family Hub login is still handled by the backend `/api/auth/login`, `/api/auth/me`, `/api/auth/change-password`, and `/api/auth/logout` endpoints. The extension never stores raw passwords.

- Normal login stores the bearer session token in `chrome.storage.session`.
- `Remember me` stores the bearer session token in `chrome.storage.local` so the browser can restore the session after restart.
- Startup restore always calls `/api/auth/me`; invalid or expired sessions clear local auth state and return to the login page.
- The fireplace loading sound stores only a non-sensitive mute preference in `localStorage`.

Розширення для браузера (WXT + React + TypeScript) для `QuantFun / Quant RP`:
- парсинг сторінок скупників
- розклад івентів
- фонове оновлення даних
- сповіщення за правилами
- dashboard / popup / options

## Що вже реалізовано

### Dashboard
- Вкладки `Скупники` та `Івенти`
- Блок `Фонова служба` (стан `chrome.alarms`, прогрес, countdown, помилки)
- Збереження UI-станів:
  - `Сховати/Показати` для `Фонова служба`
  - `Показати/Сховати розклад` для івентів (по кожному івенту)

### Скупники
- Парсинг buyer-сторінок QuantFun (9 категорій)
- Автозбір підгруп із `Seed URL`
- Таблиця товарів:
  - `Товар`, `Мін. ціна`, `Макс. ціна`, `Поточна ціна`, `%`
- Локальний розрахунок `%` (`Поточна / Макс * 100`) з fallback на значення із сайту
- Фільтри:
  - пошук
  - `% від / до`
  - тільки обране
  - тільки `Металошукач` (лише для `Скупник мотлоху`)
- Сортування по кліку на заголовки таблиці
- Дії в рядку:
  - калькулятор кількості (`+ / - / ручний ввід`)
  - mute сповіщень для товару
  - обране
  - правило відстеження/сповіщення
- Підсумок: `вкладка / всього`
- Налаштування таблиці (`⚙`):
  - які колонки показувати
  - які товари показувати
  - окремо для кожної категорії
- Налаштування верхнього блоку `Скупники` (`⚙`):
  - які категорії показувати
  - drag-and-drop порядок
  - вкладка за замовчуванням
  - які інфо-чіпи показувати

### Івенти
- Парсинг сторінки івентів QuantFun
- Локальний розрахунок:
  - активного слоту
  - наступного слоту
  - countdown (оновлення щосекунди)
- Попередження за `2/5/10/15 хв` до початку
- Drag-and-drop порядок івентів (із збереженням)
- Гармошка `Показати/Сховати розклад`
- Підсвітка слотів (`active / next / past / future`)

### Popup
- Кліки по `Quant RP Helper`, `Скупники`, `Івенти` відкривають `dashboard`
- Керовані секції popup (через `Options`)
- Фільтр для popup-блоку `Скупники`:
  - категорії
  - товари
  - пошук
  - фільтр товарів по вибраній категорії

### Options (налаштування)
- Велика сторінка налаштувань
- Автозбереження (без кнопки `Зберегти`)
- Підказки `?`
- Налаштування:
  - фоновий polling
  - сповіщення
  - popup (які блоки показувати)
  - popup-фільтри для скупників
  - `Seed URL` (стартова сторінка, з якої збираються інші buyer-посилання)

## Фонова логіка (важливо)

У `Manifest V3` немає постійної hidden background page.

Правильна модель, яку використовує це розширення:
- `background service worker`
- `chrome.alarms` для періодичних задач
- `IndexedDB` для збереження стану та даних

Фон виконує:
- polling скупників
- автооновлення розкладу івентів
- перевірку правил сповіщень
- запис у БД

## Дані та зберігання

- `IndexedDB`:
  - buyer pages / snapshots / rows
  - event schedules
  - правила сповіщень
  - службовий стан scheduler/background
- `chrome.storage.sync`:
  - основні налаштування extension
- `localStorage`:
  - UI layout/states dashboard (порядок, показ/приховування, розгорнуті блоки тощо)

## Джерела парсингу (QuantFun)

- Головний сайт: `https://quantfun.com.ua/`
- Івенти: `https://quantfun.com.ua/useful-information/events/`
- Скупники (server 1):
  - `https://quantfun.com.ua/server/1/buyer/8/`
  - `https://quantfun.com.ua/server/1/buyer/5/`
  - `https://quantfun.com.ua/server/1/buyer/6/`
  - `https://quantfun.com.ua/server/1/buyer/1/`
  - `https://quantfun.com.ua/server/1/buyer/3/`
  - `https://quantfun.com.ua/server/1/buyer/7/`
  - `https://quantfun.com.ua/server/1/buyer/2/`
  - `https://quantfun.com.ua/server/1/buyer/9/`
  - `https://quantfun.com.ua/server/1/buyer/4/`

## Технології

- `WXT`
- `Manifest V3` (Chromium)
- `React` + `TypeScript`
- `Tailwind CSS`
- `IndexedDB`
- `chrome.alarms`, `chrome.notifications`, `chrome.storage`

## Запуск (розробка)

```bash
npm install
npm run dev
```

## Збірка

### Базова

```bash
npm run build
```

### Окремо по браузерах

```bash
npm run build:chrome
npm run build:edge
npm run build:opera
npm run build:brave
npm run build:firefox
```

### Збірка всіх Chromium + Firefox

```bash
npm run build:chromium-all
npm run build:all
```

## Архіви (zip)

```bash
npm run zip:chrome
npm run zip:edge
npm run zip:opera
npm run zip:brave
npm run zip:firefox

npm run zip:chromium-all
npm run zip:all
```

## Output-папки збірок

- `.output/chrome-mv3/`
- `.output/edge-mv3/`
- `.output/opera-mv3/`
- `.output/brave-mv3/`
- `.output/firefox-mv2/`

Примітка: для Firefox `WXT` зараз збирає `firefox-mv2` (це нормально для сумісності).

## Як підключити в Chrome/Edge/Brave/Opera

1. Виконати `npm run build:chrome` (або потрібний `build:*`)
2. Відкрити сторінку розширень браузера (`chrome://extensions` / `edge://extensions` ...)
3. Увімкнути `Developer mode`
4. Натиснути `Load unpacked`
5. Вибрати відповідну папку з `.output/...`

## Структура проєкту

```text
entrypoints/
  background.ts              # service worker (alarms, polling, notifications)
  content.ts                 # content script (базовий)
  popup/                     # popup UI
  options/                   # сторінка налаштувань
  dashboard/                 # основний UI (Скупники / Івенти / Фонова служба)

lib/
  db.ts                      # IndexedDB
  storage.ts                 # chrome.storage.sync
  types.ts                   # типи та налаштування
  constants.ts               # константи/URL
  quantfun-buyer-parser.ts   # парсер скупників
  quantfun-events-parser.ts  # парсер івентів
  events-time.ts             # логіка часу для івентів
  buyer-ingest.ts            # ingest pipeline для buyer-даних
  buyer-socket-transport.ts  # socket-ready skeleton
  transport-types.ts         # типи транспорту
  i18n.ts                    # базова локалізація

public/icon/
  16.png / 48.png / 128.png  # іконки розширення
  logo6.png                  # вихідний логотип
```

## Підготовка під сокети (майбутнє)

Уже закладено базу:
- `ingest pipeline` для buyer-даних (спільний шлях для polling/socket)
- `socket transport` skeleton
- checkpoint/state для відновлення

Це дозволить додати реальний сокет-потік без повного переписування фонового коду.

## Нотатки

- Для toolbar Chrome використовується спрощена іконка (`Q`) у `16x16`, щоб вона краще читалась.
- Якщо десь знову з’являться кракозябри, перевіряти кодування файлів (`UTF-8`) та старі рядки в `i18n` / UI-компонентах.
- Поточні задачі та план розвитку дивись у `TODO.md`.
