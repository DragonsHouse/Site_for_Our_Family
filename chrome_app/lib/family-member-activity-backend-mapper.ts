import type { BackendMemberActivityItemDto, BackendMemberProfileReportDto } from './family-member-activity-backend-response.ts';

export type MemberActivityTimelineItem = {
  id: string;
  type: BackendMemberActivityItemDto['type'];
  sourceModule: BackendMemberActivityItemDto['sourceModule'];
  occurredAt: string;
  title: string;
  description: string;
  relatedLabel: string | null;
  xpDelta: number | null;
};

export type MemberProfileReportSummary = BackendMemberProfileReportDto;

export function mapBackendMemberActivityItem(item: BackendMemberActivityItemDto): MemberActivityTimelineItem {
  return {
    id: item.id,
    type: item.type,
    sourceModule: item.sourceModule,
    occurredAt: item.occurredAt,
    title: item.title,
    description: item.description,
    relatedLabel: relatedLabel(item.metadata),
    xpDelta: typeof item.xpDelta === 'number' ? item.xpDelta : null,
  };
}

export function mapBackendMemberProfileReport(report: BackendMemberProfileReportDto): MemberProfileReportSummary {
  return report;
}

function relatedLabel(metadata: Record<string, unknown>): string | null {
  if (typeof metadata.towerCode === 'string' && typeof metadata.towerName === 'string') return `${metadata.towerCode} · ${metadata.towerName}`;
  if (typeof metadata.questTitle === 'string') return metadata.questTitle;
  if (typeof metadata.eventTitle === 'string') return metadata.eventTitle;
  if (typeof metadata.achievementKey === 'string') return metadata.achievementKey;
  if (typeof metadata.rewardKey === 'string') return metadata.rewardKey;
  return null;
}
