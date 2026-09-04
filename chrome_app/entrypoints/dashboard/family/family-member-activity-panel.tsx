import { useEffect, useRef, useState } from 'react';
import {
  getBackendMemberProfileReport,
  listBackendMemberActivity
} from '../../../lib/family-member-activity-backend-client';
import { listBackendMemberRewards } from '../../../lib/family-achievements-backend-client';
import type { BackendMemberRewardGrantDto } from '../../../lib/family-achievements-backend-response';
import { formatRewardValue, getRewardSourceLabel, getRewardStatusLabel } from '../../../lib/family-rewards-display';
import {
  mapBackendMemberActivityItem,
  mapBackendMemberProfileReport,
  type MemberActivityTimelineItem,
  type MemberProfileReportSummary
} from '../../../lib/family-member-activity-backend-mapper';

type PanelState =
  | { status: 'loading'; activity: MemberActivityTimelineItem[]; report: MemberProfileReportSummary | null; rewards: BackendMemberRewardGrantDto[] }
  | { status: 'ready'; activity: MemberActivityTimelineItem[]; report: MemberProfileReportSummary; rewards: BackendMemberRewardGrantDto[] }
  | { status: 'error'; message: string; activity: MemberActivityTimelineItem[]; report: MemberProfileReportSummary | null; rewards: BackendMemberRewardGrantDto[] };

const ACTIVITY_SOURCE_LABELS: Record<string, string> = {
  tower_defense: 'Tower Defense',
  family_quests: 'Family Quests',
  family_events: 'Family Events',
  achievements: 'Achievements',
  rewards: 'Rewards',
  accounting: 'Accounting',
};

const ACTIVITY_ICON_LABELS: Record<string, string> = {
  tower_defense_responded: 'Reply',
  tower_defense_confirmed: 'Confirm',
  tower_defense_attended: 'Attend',
  tower_defense_late: 'Late',
  tower_defense_commanded: 'Lead',
  tower_defense_defended: 'Defend',
  tower_defense_lost: 'Lost',
  quest_joined: 'Join',
  quest_helped: 'Help',
  quest_completed: 'Done',
  quest_best_participant: 'Best',
  quest_reward_earned: 'Earned',
  quest_paid: 'Paid',
  achievement_earned: 'Seal',
  reward_earned: 'Earned',
  reward_approved: 'Approved',
  reward_received: 'Reward',
};

function formatActivityDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}

function money(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
}

function ReportSummary({ report }: { report: MemberProfileReportSummary }) {
  const stats = [
    ['Quests joined', report.quests.questsParticipated],
    ['Quests helped', report.quests.questsHelped],
    ['Quests completed', report.quests.questsCompleted],
    ['Best participant', report.quests.bestParticipantCount],
    ['Defenses attended', report.towerDefense.defensesAttended],
    ['Defenses commanded', report.towerDefense.defensesCommanded],
    ['Towers defended', report.towerDefense.towersDefended],
    ['Towers lost', report.towerDefense.towersLost],
    ['Achievements', report.achievements?.achievementsTotal ?? 0],
    ['Rewards earned', report.rewards?.rewardsEarned ?? 0],
    ['Rewards approved', report.rewards?.rewardsApproved ?? 0],
    ['Rewards issued', report.rewards?.rewardsIssued ?? 0],
    ['Money rewards', report.rewards?.rewardMoneyEarned ?? 0],
    ['Leaderboard score', report.leaderboard?.score ?? 0],
  ];
  return (
    <section className="dh-panel rounded-2xl p-5">
      <h2 className="text-lg font-semibold text-white">Profile Report</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-black/25 p-3">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</div>
            <div className="mt-1 text-lg font-semibold text-white">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Present', report.towerDefense.attendancePresent],
          ['Late', report.towerDefense.attendanceLate],
          ['Absent', report.towerDefense.attendanceAbsent],
          ['Excused', report.towerDefense.attendanceExcused],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
            <span className="text-slate-400">{label}</span>
            <strong className="ml-2 text-slate-100">{value}</strong>
          </div>
        ))}
      </div>
      {report.xp.available ? <p className="mt-4 text-sm text-slate-300">XP earned: {report.xp.totalEarned}</p> : null}
      {report.finance ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">Accrued {money(report.finance.accruedTotal, report.finance.currency)}</div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">Unpaid {money(report.finance.unpaidTotal, report.finance.currency)}</div>
          <div className="rounded-xl border border-slate-600 bg-black/20 p-3 text-sm text-slate-100">Paid {money(report.finance.paidTotal, report.finance.currency)}</div>
        </div>
      ) : null}
    </section>
  );
}

function MemberRewardHistory({ rewards }: { rewards: BackendMemberRewardGrantDto[] }) {
  return (
    <section className="dh-panel rounded-2xl p-5" data-member-rewards-source="backend">
      <h2 className="text-lg font-semibold text-white">Reward History</h2>
      {!rewards.length ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">No rewards yet.</div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {rewards.map((grant) => (
            <article key={grant.id} className="rounded-xl border border-white/10 bg-black/25 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-md border border-amber-500/30 px-2 py-1 text-amber-100">{grant.reward.rewardType}</span>
                <span className="text-slate-500">{getRewardSourceLabel(grant.sourceModule)}</span>
              </div>
              <h3 className="mt-2 break-words text-sm font-semibold text-white">{grant.reward.name}</h3>
              <p className="mt-1 text-sm text-slate-300">{formatRewardValue(grant)} · {getRewardStatusLabel(grant)}</p>
              <time dateTime={grant.grantedAt} className="mt-2 block text-xs text-slate-500">{formatActivityDate(grant.grantedAt)}</time>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ActivityTimeline({ items }: { items: MemberActivityTimelineItem[] }) {
  return (
    <section className="dh-panel rounded-2xl p-5">
      <h2 className="text-lg font-semibold text-white">Activity Timeline</h2>
      {items.length === 0 ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">No activity yet.</div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-xl border border-white/10 bg-black/25 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-md border border-amber-500/30 px-2 py-1 text-amber-100">{ACTIVITY_ICON_LABELS[item.type] ?? 'Activity'}</span>
                    <span className="text-slate-500">{ACTIVITY_SOURCE_LABELS[item.sourceModule] ?? item.sourceModule}</span>
                    {item.relatedLabel ? <span className="text-slate-500">{item.relatedLabel}</span> : null}
                  </div>
                  <h3 className="mt-2 break-words text-sm font-semibold text-white">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-300">{item.description}</p>
                </div>
                <time dateTime={item.occurredAt} className="shrink-0 text-xs text-slate-500">{formatActivityDate(item.occurredAt)}</time>
              </div>
              {item.xpDelta ? <div className="mt-3 text-xs font-semibold text-emerald-200">+{item.xpDelta} XP</div> : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function LoadingPanel() {
  return (
    <section className="dh-panel rounded-2xl p-5" aria-hidden="true">
      <div className="h-5 w-40 rounded bg-white/10" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-20 rounded-xl bg-white/5" />)}
      </div>
    </section>
  );
}

export function FamilyMemberActivityPanel({ memberId }: { memberId: string }) {
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [state, setState] = useState<PanelState>({ status: 'loading', activity: [], report: null, rewards: [] });
  const requestAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    requestAbortRef.current?.abort();
    const controller = new AbortController();
    requestAbortRef.current = controller;
    setState((current) => ({ status: 'loading', activity: current.activity, report: current.report, rewards: current.rewards }));
    Promise.all([
      listBackendMemberActivity(memberId, { limit: 25, signal: controller.signal }),
      getBackendMemberProfileReport(memberId, controller.signal),
      listBackendMemberRewards(memberId, controller.signal),
    ])
      .then(([activity, report, rewards]) => {
        if (controller.signal.aborted) return;
        setState({
          status: 'ready',
          activity: activity.items.map(mapBackendMemberActivityItem),
          report: mapBackendMemberProfileReport(report),
          rewards: rewards.items,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState((current) => ({
          status: 'error',
          message: error instanceof Error ? error.message : 'Unable to load member activity.',
          activity: current.activity,
          report: current.report,
          rewards: current.rewards,
        }));
      });
    return () => {
      if (requestAbortRef.current === controller) requestAbortRef.current = null;
      controller.abort();
    };
  }, [memberId, refreshNonce]);

  if (state.status === 'loading' && !state.report) return <LoadingPanel />;
  if (state.status === 'error') {
    return (
      <section className="dh-panel rounded-2xl border border-rose-500/30 p-5 text-rose-100" role="alert">
        <h2 className="text-lg font-semibold">Unable to load activity</h2>
        <p className="mt-2 text-sm">{state.message}</p>
        <button type="button" onClick={() => setRefreshNonce((current) => current + 1)} className="mt-4 rounded-xl border border-rose-400/40 px-4 py-2 text-sm font-semibold hover:bg-rose-500/10 focus:outline-none focus:ring focus:ring-rose-400/30">
          Retry
        </button>
      </section>
    );
  }
  if (!state.report) return null;
  return (
    <div className="space-y-4" data-member-activity-source="backend" data-family-member-id={memberId}>
      <ReportSummary report={state.report} />
      <MemberRewardHistory rewards={state.rewards} />
      <ActivityTimeline items={state.activity} />
    </div>
  );
}
