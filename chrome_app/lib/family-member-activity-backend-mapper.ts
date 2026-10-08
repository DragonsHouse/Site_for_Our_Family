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
    title: localizeActivityTitle(item.title, item.type),
    description: localizeActivityDescription(item.description, item.type),
    relatedLabel: relatedLabel(item.metadata),
    xpDelta: typeof item.xpDelta === 'number' ? item.xpDelta : null,
  };
}

function localizeActivityTitle(title: string, type: BackendMemberActivityItemDto['type']): string {
  const byType: Partial<Record<BackendMemberActivityItemDto['type'], string>> = {
    tower_defense_commanded: 'Командування обороною',
    tower_defense_attended: 'Участь в обороні',
    tower_defense_defended: 'Захист вишки',
    quest_completed: 'Сімейний квест виконано',
    quest_best_participant: 'Кращий учасник квесту',
    achievement_earned: 'Відзнаку відкрито',
    reward_earned: 'Нагороду нараховано',
  };
  return byType[type] ?? title;
}

function localizeActivityDescription(description: string, type: BackendMemberActivityItemDto['type']): string {
  const byType: Partial<Record<BackendMemberActivityItemDto['type'], string>> = {
    tower_defense_commanded: 'Учасник командував обороною вишки.',
    tower_defense_attended: 'Участь в обороні підтверджено.',
    tower_defense_defended: 'Захист вишки зафіксовано.',
    quest_completed: 'Участь у сімейному квесті підтверджено.',
    quest_best_participant: 'Учасника відзначено як кращого в квесті.',
    achievement_earned: 'Відзнаку додано до профілю.',
    reward_earned: 'Нагороду додано до профілю.',
  };
  return byType[type] ?? description;
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
