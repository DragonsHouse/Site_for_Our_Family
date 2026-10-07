import type { ExternalFamilyQuest } from '../types.js';

type DiscordQuestMessageLike = {
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

type ParsedRewardLine = {
  displayName: string;
  discordUserId: string | null;
  amount: number;
  rewardPercent: number | null;
  status: 'paid' | 'pending' | 'unpaid';
};

type DiscordQuestAuditMessageLike = {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  editedAt: string | null;
  content: string;
};

type QuestAuditEvent = {
  messageId: string;
  channelId: string;
  authorId: string;
  createdAt: string;
  action: string;
  questId: string;
  title: string | null;
  actorDiscordUserId: string | null;
  userDiscordId: string | null;
  recipientDiscordUserId: string | null;
  rewardAmount: number | null;
  rewardPercent: number | null;
  rewardDelivered: boolean | null;
  templateKey: string | null;
  questTime: string | null;
};

export function parseDiscordQuestMessage(message: DiscordQuestMessageLike): ExternalFamilyQuest | null {
  const embed = message.embeds.find((item) => looksLikeQuestEmbed(item.title, item.description, item.fields));
  if (!embed) return null;

  const titleParts = splitTitle(embed.title ?? message.content);
  const text = [embed.description, ...embed.fields.flatMap((field) => [field.name, field.value]), message.content].filter(Boolean).join('\n');
  const participants = parseSectionMentions(text, 'Учасники');
  const helpers = parseSectionMentions(text, 'Помічники');
  const rewardLines = parseRewardLines(text);
  const bank = parseBank(text);
  const completedAt = parseDateAfterLabel(text, 'Завершено');
  const startsAt = parseDateAfterClock(text);
  const authorMention = parseAuthor(text);
  const warnings: string[] = [];

  if (!titleParts.title) warnings.push('Quest title was not found.');
  if (!participants.length) warnings.push('Quest participants were not found.');
  if (bank.totalReward === null && rewardLines.length) warnings.push('Reward bank was not found; using reward lines only.');

  return {
    externalId: message.id,
    channelId: message.channelId,
    authorId: message.authorId,
    authorName: message.authorName,
    messageCreatedAt: message.createdAt,
    messageEditedAt: message.editedAt,
    title: titleParts.title,
    status: titleParts.status,
    participants: participants.map((participant) => participant.displayName),
    helpers: helpers.map((helper) => helper.displayName),
    participantDetails: participants.map((participant) => {
      const reward = rewardLines.find((line) => sameDisplayName(line.displayName, participant.displayName));
      return {
        ...participant,
        rewardAmount: reward?.amount ?? null,
        rewardPercent: reward?.rewardPercent ?? null,
        payoutStatus: reward?.status ?? null,
      };
    }),
    helperDetails: helpers,
    totalReward: bank.totalReward,
    paidReward: bank.paidReward,
    remainingReward: bank.remainingReward,
    rewardLines,
    startsAt,
    completedAt,
    organizer: authorMention,
    source: 'discord_embed',
    warnings,
    raw: {
      title: embed.title,
      description: embed.description,
      fields: embed.fields,
      content: message.content,
    },
  };
}

export function aggregateDiscordQuestAuditMessages(messages: DiscordQuestAuditMessageLike[]): ExternalFamilyQuest[] {
  const events = messages
    .map(parseDiscordQuestAuditMessage)
    .filter((event): event is QuestAuditEvent => Boolean(event))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const byQuest = new Map<string, QuestAuditEvent[]>();
  for (const event of events) byQuest.set(event.questId, [...(byQuest.get(event.questId) ?? []), event]);

  return [...byQuest.entries()].map(([questId, questEvents]): ExternalFamilyQuest => {
    const create = questEvents.find((event) => event.action === 'quest.create');
    const finish = [...questEvents].reverse().find((event) => event.action === 'quest.finish');
    const deliveredAll = questEvents.some((event) => event.action === 'quest.deliver-all');
    const deliveredRewardUsers = new Set(
      questEvents
        .filter((event) => event.action === 'quest.reward.delivered' && event.rewardDelivered && event.recipientDiscordUserId)
        .map((event) => event.recipientDiscordUserId as string),
    );
    const participants = activeUsers(questEvents, 'participant');
    const helpers = activeUsers(questEvents, 'helper');
    const rewardLines = questEvents
      .filter((event) => event.action === 'quest.reward.add' && event.recipientDiscordUserId && event.rewardAmount !== null)
      .map((event): ParsedRewardLine => ({
        displayName: mentionDisplayName(event.recipientDiscordUserId as string),
        discordUserId: event.recipientDiscordUserId,
        amount: event.rewardAmount as number,
        rewardPercent: event.rewardPercent,
        status: deliveredAll || deliveredRewardUsers.has(event.recipientDiscordUserId as string) ? 'paid' : 'pending',
      }));
    const participantDetails = mergeQuestPeople(participants, rewardLines);
    const rewardTotal = rewardLines.reduce((sum, reward) => sum + reward.amount, 0);
    const paidReward = rewardLines.filter((reward) => reward.status === 'paid').reduce((sum, reward) => sum + reward.amount, 0);
    return {
      externalId: questId,
      channelId: questEvents[0]?.channelId,
      authorId: create?.actorDiscordUserId ?? questEvents[0]?.actorDiscordUserId ?? questEvents[0]?.authorId,
      authorName: create?.actorDiscordUserId ? mentionDisplayName(create.actorDiscordUserId) : 'Dragon audit log',
      messageCreatedAt: create?.createdAt ?? questEvents[0]?.createdAt,
      messageEditedAt: null,
      title: finish?.title ?? create?.title ?? 'Discord quest',
      status: finish ? 'completed' : 'unknown',
      participants: participantDetails.map((participant) => participant.displayName),
      helpers: helpers.map((helper) => helper.displayName),
      participantDetails,
      helperDetails: helpers,
      totalReward: rewardTotal || null,
      paidReward: rewardTotal ? paidReward : null,
      remainingReward: rewardTotal ? rewardTotal - paidReward : null,
      rewardLines,
      startsAt: create?.questTime ?? null,
      completedAt: finish?.createdAt ?? null,
      organizer: create?.actorDiscordUserId ? { displayName: mentionDisplayName(create.actorDiscordUserId), discordUserId: create.actorDiscordUserId } : null,
      source: 'discord_audit_log',
      sourceQuestId: questId,
      templateKey: create?.templateKey ?? null,
      sourceMessageIds: questEvents.map((event) => event.messageId),
      warnings: rewardLines.length ? [] : ['Quest audit log does not contain reward.add events.'],
      raw: { events: questEvents },
    };
  }).sort((left, right) => (right.completedAt ?? right.messageCreatedAt ?? '').localeCompare(left.completedAt ?? left.messageCreatedAt ?? ''));
}

function parseDiscordQuestAuditMessage(message: DiscordQuestAuditMessageLike): QuestAuditEvent | null {
  const action = message.content.match(/\*\*(quest\.[a-z.-]+)\*\*/)?.[1] ?? null;
  if (!action) return null;
  const questId = fieldValue(message.content, 'questId');
  if (!questId) return null;
  return {
    messageId: message.id,
    channelId: message.channelId,
    authorId: message.authorId,
    createdAt: parseDiscordTimestamp(message.content) ?? message.createdAt,
    action,
    questId,
    title: parseQuestTitle(message.content),
    actorDiscordUserId: message.content.match(/<@!?(\d+)>/)?.[1] ?? null,
    userDiscordId: fieldValue(message.content, 'user'),
    recipientDiscordUserId: fieldValue(message.content, 'recipient') ?? message.content.match(/Нагорода\s+<@!?(\d+)>/)?.[1] ?? null,
    rewardAmount: parseRewardAmount(message.content),
    rewardPercent: parsePercent(message.content),
    rewardDelivered: action === 'quest.reward.delivered' ? fieldValue(message.content, 'delivered') === 'true' : null,
    templateKey: fieldValue(message.content, 'template'),
    questTime: parseDiscordTimestamp(fieldValue(message.content, 'time') ?? ''),
  };
}

function looksLikeQuestEmbed(title: string | null, description: string | null, fields: Array<{ name: string; value: string }>): boolean {
  const haystack = [title, description, ...fields.flatMap((field) => [field.name, field.value])].filter(Boolean).join('\n');
  return /Учасники|Банк нагород|Нагороди|Завершено/i.test(haystack);
}

function splitTitle(value: string): { title: string; status: string } {
  const cleaned = stripMarkdown(value).replace(/\s+/g, ' ').trim();
  const parts = cleaned.split(/\s+[•-]\s+/);
  const title = stripLeadingEmoji(parts[0] ?? '').trim();
  const rawStatus = parts.slice(1).join(' - ').trim();
  return {
    title,
    status: /завершено/i.test(rawStatus) ? 'completed' : rawStatus || 'unknown',
  };
}

function parseSectionMentions(text: string, label: string): Array<{ displayName: string; discordUserId: string | null }> {
  const section = sectionAfterLabel(text, label);
  if (!section) return [];
  return parseMentions(section);
}

function parseMentions(value: string): Array<{ displayName: string; discordUserId: string | null }> {
  const mentions = [...value.matchAll(/<@!?(\d+)>|@([^\s\n\r]+)/g)];
  const seen = new Set<string>();
  return mentions
    .map((match) => ({
      displayName: normalizeDisplayName(match[2] ?? match[0]),
      discordUserId: match[1] ?? null,
    }))
    .filter((item) => {
      const key = item.discordUserId ?? item.displayName.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return Boolean(item.displayName);
    });
}

function parseRewardLines(text: string): ParsedRewardLine[] {
  const rewardsSection = sectionAfterLabel(text, 'Нагороди') ?? text;
  const lines = rewardsSection.split(/\r?\n/);
  const rewards: ParsedRewardLine[] = [];
  for (const line of lines) {
    if (!/@|<@!?\d+>/.test(line)) continue;
    const mention = parseMentions(line)[0];
    if (!mention) continue;
    const amount = parseMoney(line);
    if (amount === null) continue;
    rewards.push({
      displayName: mention.displayName,
      discordUserId: mention.discordUserId,
      amount,
      rewardPercent: parsePercent(line),
      status: parseRewardPayoutStatus(line),
    });
  }
  return rewards;
}

function parseRewardPayoutStatus(value: string): ParsedRewardLine['status'] {
  if (/(?:не|РЅРµ)\s*(?:видано|виплачено|РІРёРґР°РЅРѕ|РІРёРїР»Р°С‡РµРЅРѕ)|unpaid|not\s+paid/i.test(value)) return 'unpaid';
  if (/(?:^|[\s·.,;:])(?:видано|виплачено|РІРёРґР°РЅРѕ|РІРёРїР»Р°С‡РµРЅРѕ|paid)(?:$|[\s·.,;:])/i.test(value)) return 'paid';
  return 'pending';
}

function parseBank(text: string): { totalReward: number | null; paidReward: number | null; remainingReward: number | null } {
  const line = text.split(/\r?\n/).find((item) => /Банк нагород/i.test(item)) ?? '';
  const amounts = [...line.matchAll(/([\d\s.,]+)\s*\$/g)].map((match) => toNumber(match[1]));
  return {
    totalReward: amounts[0] ?? null,
    paidReward: amounts[1] ?? null,
    remainingReward: amounts[2] ?? null,
  };
}

function activeUsers(events: QuestAuditEvent[], role: 'participant' | 'helper'): Array<{ displayName: string; discordUserId: string | null }> {
  const users = new Set<string>();
  const removedUsers = new Set<string>();
  for (const event of events) {
    if (!event.userDiscordId) continue;
    if (event.action === `quest.${role}.add`) {
      users.add(event.userDiscordId);
      removedUsers.delete(event.userDiscordId);
    }
    if (event.action === `quest.${role}.remove`) {
      users.delete(event.userDiscordId);
      removedUsers.add(event.userDiscordId);
    }
  }
  if (role === 'participant') {
    for (const event of events) {
      if (event.action === 'quest.reward.add' && event.recipientDiscordUserId && !removedUsers.has(event.recipientDiscordUserId)) {
        users.add(event.recipientDiscordUserId);
      }
    }
  }
  return [...users].map((discordUserId) => ({ displayName: mentionDisplayName(discordUserId), discordUserId }));
}

function mergeQuestPeople(
  participants: Array<{ displayName: string; discordUserId: string | null }>,
  rewards: ParsedRewardLine[],
): Array<{
  displayName: string;
  discordUserId: string | null;
  rewardAmount: number | null;
  rewardPercent: number | null;
  payoutStatus: 'paid' | 'pending' | 'unpaid' | null;
}> {
  const byDiscordId = new Map(rewards.filter((reward) => reward.discordUserId).map((reward) => [reward.discordUserId as string, reward]));
  const people = participants.length
    ? participants
    : rewards.map((reward) => ({ displayName: reward.displayName, discordUserId: reward.discordUserId }));
  return people.map((participant) => {
    const reward = participant.discordUserId ? byDiscordId.get(participant.discordUserId) : rewards.find((item) => sameDisplayName(item.displayName, participant.displayName));
    return {
      displayName: participant.displayName,
      discordUserId: participant.discordUserId,
      rewardAmount: reward?.amount ?? null,
      rewardPercent: reward?.rewardPercent ?? null,
      payoutStatus: reward?.status ?? null,
    };
  });
}

function parseAuthor(text: string): { displayName: string; discordUserId: string | null } | null {
  const line = text.split(/\r?\n/).find((item) => /Автор/i.test(item));
  return line ? parseMentions(line)[0] ?? null : null;
}

function parseDateAfterClock(text: string): string | null {
  const line = text.split(/\r?\n/).find((item) => /🕒|год\./i.test(item));
  return line ? parseUkrainianDateTime(line) : null;
}

function parseDateAfterLabel(text: string, label: string): string | null {
  const line = text.split(/\r?\n/).find((item) => new RegExp(label, 'i').test(item));
  return line ? parseUkrainianDateTime(line) : null;
}

function parseUkrainianDateTime(value: string): string | null {
  const match = value.match(/(\d{1,2})\s+([а-яіїєґ]+)\s+(\d{4})\s*р?\.?(?:\s*(?:о|р\.)?\s*(\d{1,2})[:.](\d{2}))?/i);
  if (!match) return null;
  const month = ukrainianMonths[match[2].toLowerCase()];
  if (!month) return null;
  return zonedLocalDateTimeToIso(
    Number(match[3]),
    Number(month),
    Number(match[1]),
    Number(match[4] ?? '00'),
    Number(match[5] ?? '00'),
    'Europe/Kyiv',
  );
}

function zonedLocalDateTimeToIso(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): string | null {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const firstOffset = timeZoneOffsetMinutes(new Date(utcGuess), timeZone);
  const firstPass = new Date(utcGuess - firstOffset * 60_000);
  const offset = timeZoneOffsetMinutes(firstPass, timeZone);
  const instant = new Date(utcGuess - offset * 60_000);
  const wall = formatZonedParts(instant, timeZone);
  if (wall.year !== year || wall.month !== month || wall.day !== day || wall.hour !== hour || wall.minute !== minute) return null;
  const sign = offset >= 0 ? '+' : '-';
  const absolute = Math.abs(offset);
  const offsetText = `${sign}${String(Math.trunc(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00${offsetText}`;
}

function timeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = formatZonedParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((asUtc - date.getTime()) / 60_000);
}

function formatZonedParts(date: Date, timeZone: string): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function sectionAfterLabel(text: string, label: string): string | null {
  const lines = text.split(/\r?\n/);
  const index = lines.findIndex((line) => new RegExp(label, 'i').test(line));
  if (index < 0) return null;
  const section: string[] = [];
  for (const line of lines.slice(index + 1)) {
    if (/^(Банк нагород|Нагороди|Учасники|Помічники|Автор|Завершено|🕒|👤|🏁)/i.test(stripMarkdown(line).trim())) break;
    section.push(line);
  }
  return section.join('\n');
}

function parseMoney(value: string): number | null {
  const match = value.match(/([\d\s.,]+)\s*\$/);
  return match ? toNumber(match[1]) : null;
}

function parsePercent(value: string): number | null {
  const match = value.match(/([\d\s.,]+)\s*%/);
  return match ? toNumber(match[1]) : null;
}

function parseRewardAmount(value: string): number | null {
  const parenthesized = value.match(/\(([\d\s.,]+)\s*\$\)/);
  if (parenthesized) return toNumber(parenthesized[1]);
  return parseMoney(value);
}

function parseQuestTitle(value: string): string | null {
  return value.match(/квест(?:у|і)?\s+\*\*([^*]+)\*\*/i)?.[1]?.trim() ?? null;
}

function fieldValue(value: string, field: string): string | null {
  return value.match(new RegExp(`•\\s*${escapeRegExp(field)}:\\s*\`([^\`]+)\``, 'i'))?.[1] ?? null;
}

function parseDiscordTimestamp(value: string): string | null {
  const match = value.match(/<t:(\d+):[a-z]>/i);
  if (!match) return null;
  return new Date(Number(match[1]) * 1000).toISOString();
}

function mentionDisplayName(discordUserId: string): string {
  return `<@${discordUserId}>`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toNumber(value: string): number {
  return Number(value.replace(/\s/g, '').replace(',', '.'));
}

function normalizeDisplayName(value: string): string {
  return value.replace(/^@/, '').replace(/[,:;]+$/g, '').trim();
}

function sameDisplayName(left: string, right: string): boolean {
  return normalizeDisplayName(left).toLowerCase() === normalizeDisplayName(right).toLowerCase();
}

function stripMarkdown(value: string): string {
  return value.replace(/[*_`~]/g, '');
}

function stripLeadingEmoji(value: string): string {
  return value.replace(/^[^\p{L}\p{N}]+/u, '');
}

const ukrainianMonths: Record<string, string> = {
  січня: '01',
  лютого: '02',
  березня: '03',
  квітня: '04',
  травня: '05',
  червня: '06',
  липня: '07',
  серпня: '08',
  вересня: '09',
  жовтня: '10',
  листопада: '11',
  грудня: '12',
};
