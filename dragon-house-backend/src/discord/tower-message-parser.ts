export type DiscordTowerMessageLike = {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  editedAt: string | null;
  content: string;
  embeds: Array<{
    title: string | null;
    description: string | null;
    fields: Array<{ name: string; value: string }>;
  }>;
};

export type ExternalTowerGuardSignal = {
  externalId: string;
  channelId: string;
  authorId: string;
  authorName: string;
  messageCreatedAt: string;
  messageEditedAt: string | null;
  towerNumber: number;
  towerCode: string;
  towerName: string;
  protectionDown: boolean;
  cooldownNeedsUpdate: boolean;
  cooldownAt: string | null;
  statusText: string;
  rawText: string;
};

export function parseDiscordTowerGuardMessage(message: DiscordTowerMessageLike): ExternalTowerGuardSignal | null {
  const text = collectMessageText(message);
  const towerNumber = parseTowerNumber(text);
  if (towerNumber === null) return null;
  const protectionDown = hasProtectionDown(text);
  const cooldownNeedsUpdate = hasCooldownUpdateHint(text);
  if (!protectionDown && !cooldownNeedsUpdate && !looksLikeTowerGuardCard(text) && !looksLikeTowerOnlyCard(text)) return null;

  const towerCode = `NO-${towerNumber}`;
  return {
    externalId: message.id,
    channelId: message.channelId,
    authorId: message.authorId,
    authorName: message.authorName,
    messageCreatedAt: message.createdAt,
    messageEditedAt: message.editedAt,
    towerNumber,
    towerCode,
    towerName: `Вишка №${towerNumber}`,
    protectionDown,
    cooldownNeedsUpdate,
    cooldownAt: parseCooldownTimestamp(text),
    statusText: summarizeStatus(text, protectionDown, cooldownNeedsUpdate),
    rawText: text,
  };
}

function collectMessageText(message: DiscordTowerMessageLike): string {
  return [
    message.content,
    ...message.embeds.flatMap((embed) => [
      embed.title,
      embed.description,
      ...embed.fields.flatMap((field) => [field.name, field.value]),
    ]),
  ].filter(Boolean).join('\n');
}

function parseTowerNumber(text: string): number | null {
  const match = text.match(/(?:\u0412\u0438\u0448\u043a\u0430|Vyshka|Vishka|Tower)\s*(?:No\.?|N[o0]?\.?|#|\u2116)?\s*(\d{1,4})/iu);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function hasProtectionDown(text: string): boolean {
  return /(\u0437\u0430\u0445\u0438\u0441\u0442\s+\u0432\u043f\u0430\u0432|protection\s+(?:is\s+)?down|shield\s+(?:is\s+)?down)/iu.test(text);
}

function hasCooldownUpdateHint(text: string): boolean {
  return /(\u043e\u043d\u043e\u0432\u0438\u0442\u0438\s+(?:cd|\u043a\u0434)|update\s+cd|update\s+cooldown|cooldown\s+update)/iu.test(text);
}

function looksLikeTowerGuardCard(text: string): boolean {
  return /(\u0432\u0438\u0448\u043a\u0430|tower)/iu.test(text) && /(cd|cooldown|\u0437\u0430\u0445\u0438\u0441\u0442|protection|shield)/iu.test(text);
}

function looksLikeTowerOnlyCard(text: string): boolean {
  return /(?:\u0412\u0438\u0448\u043a\u0430|Vyshka|Vishka|Tower)\s*(?:No\.?|N[o0]?\.?|#|\u2116)\s*\d{1,4}/iu.test(text);
}

function parseCooldownTimestamp(text: string): string | null {
  const match = text.match(/(?:кд|kd|cd|cooldown|відкат|перезарядка)[^\n\r<]{0,80}<t:(\d+):[a-z]>/iu);
  if (!match) return null;
  return new Date(Number(match[1]) * 1000).toISOString();
}

function summarizeStatus(text: string, protectionDown: boolean, cooldownNeedsUpdate: boolean): string {
  if (protectionDown && cooldownNeedsUpdate) return 'Захист впав. Потрібно оновити КД.';
  if (protectionDown) return 'Захист впав.';
  if (cooldownNeedsUpdate) return 'Потрібно оновити КД.';
  return text.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? 'Оновлення стану вишки.';
}
