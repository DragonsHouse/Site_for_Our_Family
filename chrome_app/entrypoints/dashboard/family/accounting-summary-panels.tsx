import type { Dispatch, SetStateAction } from 'react';
import type { BackendMonthlyAccountingSummary, BackendDiscordAccountingFeed } from '../../../lib/family-accounting-backend-client';
import { money, date, SummaryCard } from './accounting-display';

function discordFeedStatusLabel(feed: BackendDiscordAccountingFeed | null): string {
  if (!feed) return 'Discord-стрічка недоступна';
  if (feed.status === 'synced') return `Синхронізовано ${new Date(feed.lastSyncedAt).toLocaleTimeString('uk-UA')}`;
  if (feed.status === 'not_configured') return 'DISCORD_ACCOUNTING_CHANNEL_ID не налаштовано';
  if (feed.status === 'unavailable') return 'Discord-сервіс недоступний';
  return feed.error ?? 'Помилка Discord-стрічки';
}

function isImageAttachment(attachment: { contentType: string | null; filename: string }) {
  return attachment.contentType?.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/iu.test(attachment.filename);
}

export function MonthlyAccountingSummaryPanel({
  summary,
  month,
  year,
  onMonthChange,
  onYearChange,
  onReload
}: {
  summary: BackendMonthlyAccountingSummary | null;
  month: number;
  year: number;
  onMonthChange: Dispatch<SetStateAction<number>>;
  onYearChange: Dispatch<SetStateAction<number>>;
  onReload: () => void;
}) {
  const years = Array.from({ length: 7 }, (_, index) => new Date().getFullYear() - 3 + index);
  const months = [
    'Січень',
    'Лютий',
    'Березень',
    'Квітень',
    'Травень',
    'Червень',
    'Липень',
    'Серпень',
    'Вересень',
    'Жовтень',
    'Листопад',
    'Грудень'
  ];
  const discordGap = summary ? summary.quests.completedCount - summary.quests.withDiscordProjectionCount : 0;

  return (
    <section className="rounded-2xl border border-sky-400/20 bg-sky-500/10 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="font-semibold text-white">Бухгалтерія за місяць</h3>
          <p className="mt-1 text-xs text-sky-100/80">
            Місячний зріз бере гроші, завершені квести й Discord projection з офіційної бази. Discord-стрічка нижче лишається доказовим шаром, а не джерелом paid/approved.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={month} onChange={(event) => onMonthChange(Number(event.target.value))} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100" aria-label="Місяць бухгалтерії">
            {months.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
          </select>
          <select value={year} onChange={(event) => onYearChange(Number(event.target.value))} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100" aria-label="Рік бухгалтерії">
            {years.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <button type="button" onClick={onReload} className="rounded-xl border border-sky-300/30 px-3 py-2 text-sm text-sky-100">Оновити</button>
        </div>
      </div>

      {!summary ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
          Не вдалося завантажити місячну бухгалтерію. Перевір backend і права доступу.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-2 md:grid-cols-4">
            <SummaryCard label="Прибуток" value={money(summary.totals.income, summary.currency)} />
            <SummaryCard label="Витрати" value={money(summary.totals.expenses, summary.currency)} />
            <SummaryCard label="Чистий баланс" value={money(summary.totals.net, summary.currency)} />
            <SummaryCard label="Завершено квестів" value={String(summary.quests.completedCount)} />
          </div>
          <div className="grid gap-2 md:grid-cols-4">
            <SummaryCard label="Прибуток сім’ї з квестів" value={money(summary.totals.questFamilyIncome, summary.currency)} />
            <SummaryCard label="Нагороди учасникам" value={money(summary.totals.questMemberRewards, summary.currency)} />
            <SummaryCard label="Усього по квестах" value={money(summary.totals.questTotalRewards, summary.currency)} />
            <SummaryCard label="Discord projection" value={`${summary.quests.withDiscordProjectionCount}/${summary.quests.completedCount}`} />
          </div>
          {discordGap > 0 ? (
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
              Є reconciliation gap: {discordGap} завершених квестів за цей місяць не мають збереженої Discord projection у базі.
            </div>
          ) : null}

          <div className="grid gap-3 xl:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <h4 className="text-sm font-semibold text-white">TOP-3 по квестах</h4>
              <div className="mt-2 grid gap-2">
                {summary.quests.topMembers.map((member, index) => (
                  <div key={`${member.familyMemberId ?? member.displayName}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate text-slate-100">{index + 1}. {member.displayName}</span>
                    <span className="shrink-0 text-amber-100">{member.completedQuests} квестів · {money(member.earnedAmount, summary.currency)}</span>
                  </div>
                ))}
                {!summary.quests.topMembers.length ? <div className="rounded-lg border border-white/10 bg-black/25 p-3 text-sm text-slate-400">За цей місяць немає учасників у завершених квестах.</div> : null}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <h4 className="text-sm font-semibold text-white">Останні рухи грошей</h4>
              <div className="mt-2 grid max-h-72 gap-2 overflow-y-auto pr-1">
                {summary.transactions.slice(0, 12).map((transaction) => (
                  <div key={transaction.id} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-100">{transaction.reason}</span>
                      <span className={transaction.type === 'income' ? 'text-emerald-100' : 'text-amber-100'}>{money(transaction.amount, transaction.currency)}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {date(transaction.createdAt)} · {transaction.type} {transaction.memberName ? `· ${transaction.memberName}` : ''} {transaction.questTitle ? `· ${transaction.questTitle}` : ''}
                    </div>
                  </div>
                ))}
                {!summary.transactions.length ? <div className="rounded-lg border border-white/10 bg-black/25 p-3 text-sm text-slate-400">За цей місяць рухів грошей ще немає.</div> : null}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <h4 className="text-sm font-semibold text-white">Квести за місяць</h4>
            <div className="mt-2 grid max-h-80 gap-2 overflow-y-auto pr-1">
              {summary.quests.items.map((quest) => (
                <div key={quest.id} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <span className="font-medium text-white">{quest.title}</span>
                    <span className="text-amber-100">{money(quest.totalReward, summary.currency)}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {date(quest.completedAt)} · учасники {quest.participantCount} · помічники {quest.helperCount} · сім’ї {money(quest.familyReward, summary.currency)} · людям {money(quest.memberRewardPool, summary.currency)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {quest.discordMessageId ? 'Discord projection є' : 'Discord projection не знайдено'}
                  </div>
                </div>
              ))}
              {!summary.quests.items.length ? <div className="rounded-lg border border-white/10 bg-black/25 p-3 text-sm text-slate-400">За цей місяць завершених квестів ще немає.</div> : null}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function DiscordAccountingFeedPanel({ feed }: { feed: BackendDiscordAccountingFeed | null }) {
  const imageCount = feed?.items.reduce((total, item) => total + item.attachments.filter(isImageAttachment).length, 0) ?? 0;
  return (
    <section className="rounded-2xl border border-sky-400/20 bg-sky-500/10 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-white">Discord-стрічка обліку</h3>
          <p className="mt-1 text-xs text-sky-100/80">{discordFeedStatusLabel(feed)}</p>
        </div>
        <span className="rounded-full border border-sky-300/30 px-3 py-1 text-xs text-sky-100">
          {feed?.items.length ?? 0} messages / {imageCount} photos
        </span>
      </div>
      <div className="mt-3 grid gap-2">
        {feed?.items.slice(0, 5).map((item) => (
          <article key={item.externalId} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <span>
                <span className="block font-medium text-white">{item.authorName}</span>
                <span className="block text-xs text-slate-500">{new Date(item.createdAt).toLocaleString('uk-UA')}</span>
              </span>
              <span className="text-xs text-sky-100">{item.attachmentCount} files</span>
            </div>
            {item.content ? <p className="mt-2 whitespace-pre-wrap text-slate-300">{item.content}</p> : null}
            {item.attachments.length ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {item.attachments.map((attachment) => (
                  isImageAttachment(attachment) ? (
                    <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-white/10 bg-black/30">
                      <img src={attachment.proxyUrl ?? attachment.url} alt={attachment.filename} className="h-32 w-full object-cover" />
                      <span className="block truncate px-2 py-1 text-xs text-slate-300">{attachment.filename}</span>
                    </a>
                  ) : (
                    <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs text-slate-300">
                      {attachment.filename}
                    </a>
                  )
                ))}
              </div>
            ) : null}
          </article>
        ))}
        {feed && feed.items.length === 0 ? <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-400">Повідомлень Discord для обліку ще немає.</div> : null}
        {!feed ? <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-400">Discord-стрічка обліку не завантажилась.</div> : null}
      </div>
    </section>
  );
}
