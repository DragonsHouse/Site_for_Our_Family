import type { AppConfig } from '../config/env.js';

export const DRAGON_COMMAND_VERSION = '2026-08-13.discord-orchestration.v1';

type DiscordCommandChoice = {
  name: string;
  value: string;
};

type DiscordCommandOption = {
  type: number;
  name: string;
  description: string;
  required?: boolean;
  choices?: DiscordCommandChoice[];
  options?: DiscordCommandOption[];
};

export type DiscordApplicationCommandDefinition = {
  name: string;
  description: string;
  type: number;
  dm_permission: boolean;
  options: DiscordCommandOption[];
};

export function buildDragonCommandDefinitions(): DiscordApplicationCommandDefinition[] {
  return [
    {
      name: 'dragon',
      description: 'Dragon House Family Hub',
      type: 1,
      dm_permission: false,
      options: [
        subcommand('me', 'Показати ваш привʼязаний Dragon House профіль.'),
        subcommand('status', 'Показати безпечний статус Hub/Discord інтеграції.'),
        subcommand('quest', 'Дії з Family Quests через Dragon House Hub.', [
          stringOption('action', 'Що зробити з квестом.', questActions(), true),
          stringOption('quest_id', 'Hub quest ID для details/join/help/withdraw/complete/publish/sync.'),
        ]),
        subcommand('tower', 'Дії з Tower Defense через Dragon House Hub.', [
          stringOption('action', 'Що зробити із захистом вишки / стаком.', towerActions(), true),
          stringOption('defense_id', 'Hub Tower Defense ID для details/respond/manager actions/publish/sync.'),
        ]),
        subcommand('event', 'Дії з Family Events через Dragon House Hub.', [
          stringOption('action', 'Що зробити з подією.', eventActions(), true),
          stringOption('event_id', 'Hub Family Event ID для details/respond/manager actions/publish/sync.'),
        ]),
      ],
    },
  ];
}

export type DiscordCommandRegistrationConfig = {
  clientId: string | null;
  botToken: string | null;
  guildId: string | null;
};

export function commandRegistrationConfig(config: AppConfig): DiscordCommandRegistrationConfig {
  return {
    clientId: config.discord.clientId,
    botToken: config.discord.botToken,
    guildId: config.discord.guildId,
  };
}

export function validateDiscordCommandRegistrationConfig(config: DiscordCommandRegistrationConfig): string[] {
  const missing: string[] = [];
  if (!config.clientId) missing.push('DISCORD_CLIENT_ID');
  if (!config.botToken) missing.push('DISCORD_BOT_TOKEN');
  if (!config.guildId) missing.push('DISCORD_GUILD_ID');
  return missing;
}

export function safeDiscordRegistrationTarget(config: DiscordCommandRegistrationConfig): { applicationId: string; guildId: string } {
  return {
    applicationId: maskSnowflake(config.clientId),
    guildId: maskSnowflake(config.guildId),
  };
}

function subcommand(name: string, description: string, options: DiscordCommandOption[] = []): DiscordCommandOption {
  return { type: 1, name, description, options };
}

function stringOption(name: string, description: string, choices: DiscordCommandChoice[] = [], required = false): DiscordCommandOption {
  return { type: 3, name, description, required, choices };
}

function questActions(): DiscordCommandChoice[] {
  return [
    choice('Список активних', 'list'),
    choice('Деталі', 'details'),
    choice('Приєднатися', 'join'),
    choice('Допомагати', 'help'),
    choice('Вийти', 'withdraw'),
    choice('Завершити', 'complete'),
    choice('Опублікувати в Discord', 'publish'),
    choice('Оновити Discord', 'sync'),
  ];
}

function towerActions(): DiscordCommandChoice[] {
  return [
    choice('Список активних', 'list'),
    choice('Деталі', 'details'),
    choice('Йду', 'joining'),
    choice('Підтверджую', 'confirmed'),
    choice('Не можу', 'unavailable'),
    choice('Відкликати відповідь', 'withdraw'),
    choice('Почати', 'start'),
    choice('Завершити успішно', 'complete_defended'),
    choice('Завершити як втрачено', 'complete_lost'),
    choice('Скасувати', 'cancel'),
    choice('Опублікувати в Discord', 'publish'),
    choice('Оновити Discord', 'sync'),
  ];
}

function eventActions(): DiscordCommandChoice[] {
  return [
    choice('Список майбутніх', 'list'),
    choice('Деталі', 'details'),
    choice('Цікавить', 'interested'),
    choice('Йду', 'joining'),
    choice('Підтверджую', 'confirmed'),
    choice('Не можу', 'declined'),
    choice('Відкликати відповідь', 'withdraw'),
    choice('Почати', 'start'),
    choice('Завершити', 'complete'),
    choice('Скасувати', 'cancel'),
    choice('Опублікувати в Discord', 'publish'),
    choice('Оновити Discord', 'sync'),
  ];
}

function choice(name: string, value: string): DiscordCommandChoice {
  return { name, value };
}

function maskSnowflake(value: string | null): string {
  if (!value) return 'not_configured';
  if (value.length <= 6) return '***';
  return `${value.slice(0, 3)}...${value.slice(-3)}`;
}
