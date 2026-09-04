import { buildDragonCommandDefinitions, commandRegistrationConfig, safeDiscordRegistrationTarget, validateDiscordCommandRegistrationConfig } from './command-definitions.js';
import { loadConfig } from '../config/env.js';

const config = loadConfig();
const registrationConfig = commandRegistrationConfig(config);
const missing = validateDiscordCommandRegistrationConfig(registrationConfig);

if (missing.length > 0) {
  throw new Error(`Cannot register Discord commands. Missing: ${missing.join(', ')}`);
}

const target = safeDiscordRegistrationTarget(registrationConfig);
const commands = buildDragonCommandDefinitions();

const url = `https://discord.com/api/v10/applications/${registrationConfig.clientId}/guilds/${registrationConfig.guildId}/commands`;
const response = await fetch(url, {
  method: 'PUT',
  headers: {
    Authorization: `Bot ${registrationConfig.botToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(commands),
});

if (!response.ok) {
  const body = await response.text().catch(() => '');
  throw new Error(`Discord command registration failed: ${response.status} ${safeErrorBody(body)}`);
}

const registered = await response.json().catch(() => []);
const registeredNames = Array.isArray(registered)
  ? registered.map((item) => (typeof item?.name === 'string' ? item.name : null)).filter(Boolean)
  : commands.map((command) => command.name);

console.log(`Registered Discord guild commands: ${registeredNames.join(', ')}`);
console.log(`Target application=${target.applicationId} guild=${target.guildId}`);

function safeErrorBody(body: string): string {
  return body
    .replace(/Bot\s+[A-Za-z0-9._-]+/gu, 'Bot [redacted]')
    .replace(/[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{20,}/gu, '[redacted_discord_token]')
    .slice(0, 500);
}
