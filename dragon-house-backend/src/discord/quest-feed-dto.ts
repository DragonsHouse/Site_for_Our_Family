import type { ExternalFamilyQuest } from '../types.js';

const RAW_MENTION = /<@!?\d+>|\b\d{17,20}\b/gu;
const HIDDEN_DISCORD_MEMBER = 'Учасник Discord';

export type PublicDiscordQuestFeedItem = {
  externalId: string;
  title: string;
  status: string;
  participants: string[];
  helpers: string[];
  startsAt: string | null;
  completedAt: string | null;
  messageCreatedAt: string | null;
  organizer: { displayName: string } | null;
  source: 'discord_embed';
  sourceQuestId: string | null;
  templateKey: string | null;
};

/**
 * Quest managers see the parsed feed except the raw Discord payload. Everyone else sees only
 * public announcement fields: no money, payout state, Discord IDs, admin-log entries or raw text.
 */
export function toDiscordQuestFeedItems(quests: ExternalFamilyQuest[], options: { privileged: boolean }): Array<ExternalFamilyQuest | PublicDiscordQuestFeedItem> {
  if (options.privileged) {
    return quests.map((quest) => {
      const copy = { ...quest };
      delete copy.raw;
      return copy;
    });
  }
  return quests.filter((quest) => quest.source === 'discord_embed').map(toPublicQuest);
}

function toPublicQuest(quest: ExternalFamilyQuest): PublicDiscordQuestFeedItem {
  return {
    externalId: quest.externalId,
    title: maskMentions(quest.title),
    status: quest.status,
    participants: quest.participants.map(maskMentions),
    helpers: quest.helpers.map(maskMentions),
    startsAt: quest.startsAt ?? null,
    completedAt: quest.completedAt ?? null,
    messageCreatedAt: quest.messageCreatedAt ?? null,
    organizer: quest.organizer ? { displayName: maskMentions(quest.organizer.displayName) } : null,
    source: 'discord_embed',
    sourceQuestId: quest.sourceQuestId ?? null,
    templateKey: quest.templateKey ?? null,
  };
}

function maskMentions(value: string): string {
  const masked = value.replace(RAW_MENTION, HIDDEN_DISCORD_MEMBER).trim();
  return masked || HIDDEN_DISCORD_MEMBER;
}
