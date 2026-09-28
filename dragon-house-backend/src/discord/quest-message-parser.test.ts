import { describe, expect, it } from 'vitest';
import { aggregateDiscordQuestAuditMessages, parseDiscordQuestMessage } from './quest-message-parser.js';

describe('parseDiscordQuestMessage', () => {
  it('extracts completed quest accounting data from Dragon embed text', () => {
    const quest = parseDiscordQuestMessage({
      id: 'message-1',
      channelId: 'quests',
      authorId: 'dragon-bot',
      authorName: 'Dragon',
      createdAt: '2026-09-13T05:28:00.000Z',
      editedAt: null,
      content: '',
      embeds: [{
        title: '💼 Лісові трофеї • 🏁 Завершено',
        description: [
          '🕒 неділя, 13 вересня 2026 р. 8:28 · 14 годин тому',
          '👤 Автор: @Boris_Dragons',
          '🏁 Завершено: неділя, 13 вересня 2026 р. 8:30 · 14 годин тому',
          '',
          '**Учасники (1/1)**',
          '@Boris_Dragons',
          '',
          '💰 Банк нагород: 600 000$ · виплачено 600 000$ · залишилось 0$',
          '🎁 Нагороди:',
          '✅ @Boris_Dragons 💵 600 000$ · Видано',
        ].join('\n'),
        fields: [],
      }],
    });

    expect(quest).toMatchObject({
      externalId: 'message-1',
      title: 'Лісові трофеї',
      status: 'completed',
      participants: ['Boris_Dragons'],
      totalReward: 600000,
      paidReward: 600000,
      remainingReward: 0,
      completedAt: '2026-09-13T08:30:00+03:00',
      organizer: { displayName: 'Boris_Dragons', discordUserId: null },
    });
    expect(quest?.participantDetails).toEqual([{
      displayName: 'Boris_Dragons',
      discordUserId: null,
      rewardAmount: 600000,
      rewardPercent: null,
      payoutStatus: 'paid',
    }]);
  });

  it('keeps reward percent when Dragon uses percentage payout text', () => {
    const quest = parseDiscordQuestMessage({
      id: 'message-2',
      channelId: 'quests',
      authorId: 'dragon-bot',
      authorName: 'Dragon',
      createdAt: '2026-09-08T10:03:00.000Z',
      editedAt: null,
      content: '',
      embeds: [{
        title: '🤝 Допомога громадянам • 🏁 Завершено',
        description: [
          '🕒 вівторок, 8 вересня 2026 р. 13:03 · 5 днів тому',
          '👤 Автор: @Dexter_Dragons(Keksik)',
          '🏁 Завершено: вівторок, 8 вересня 2026 р. 17:15 · 5 днів тому',
          '',
          '**Учасники (1/∞)**',
          '@Dexter_Dragons(Keksik)',
          '',
          '💰 Банк нагород: 700 000$ · виплачено 700 000$ · залишилось 0$',
          '🎁 Нагороди:',
          '✅ @Dexter_Dragons(Keksik) 💵 100% (700 000$) · Видано',
        ].join('\n'),
        fields: [],
      }],
    });

    expect(quest?.title).toBe('Допомога громадянам');
    expect(quest?.participantDetails?.[0]).toMatchObject({
      displayName: 'Dexter_Dragons(Keksik)',
      rewardAmount: 700000,
      rewardPercent: 100,
      payoutStatus: 'paid',
    });
  });
});

describe('aggregateDiscordQuestAuditMessages', () => {
  it('reconstructs accounting quest data from Dragon audit log events', () => {
    const items = aggregateDiscordQuestAuditMessages([
      audit('m1', '2026-09-13T05:28:46.183Z', '<t:1789277326:f> · <@564447599063466004> · **quest.create**\nСтворено квест **Лісові трофеї**\n  • questId: `01M2CKTG22DN7BY03Z8TK900NG`\n  • template: `forest-trophies`\n  • time: `<t:1789277323:f>`'),
      audit('m2', '2026-09-13T05:29:42.613Z', '<t:1789277382:f> · <@564447599063466004> · **quest.reward.add**\nНагорода <@564447599063466004>: 600000$\n  • questId: `01M2CKTG22DN7BY03Z8TK900NG`\n  • recipient: `564447599063466004`\n  • mode: `flat`'),
      audit('m3', '2026-09-13T05:30:01.394Z', '<t:1789277401:f> · <@564447599063466004> · **quest.deliver-all**\nПозначено 1 нагород як видані в квесті **Лісові трофеї**\n  • questId: `01M2CKTG22DN7BY03Z8TK900NG`\n  • count: `1`'),
      audit('m4', '2026-09-13T05:30:24.631Z', '<t:1789277424:f> · <@564447599063466004> · **quest.finish**\nЗавершено квест **Лісові трофеї**\n  • questId: `01M2CKTG22DN7BY03Z8TK900NG`\n  • participants: `1`\n  • rewards: `1`'),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      externalId: '01M2CKTG22DN7BY03Z8TK900NG',
      source: 'discord_audit_log',
      sourceQuestId: '01M2CKTG22DN7BY03Z8TK900NG',
      templateKey: 'forest-trophies',
      title: 'Лісові трофеї',
      status: 'completed',
      participants: ['<@564447599063466004>'],
      totalReward: 600000,
      paidReward: 600000,
      remainingReward: 0,
    });
  });
});

function audit(id: string, createdAt: string, content: string) {
  return {
    id,
    channelId: 'admin-log',
    authorId: 'dragon-bot',
    authorName: 'Dragon',
    createdAt,
    editedAt: null,
    content,
  };
}
