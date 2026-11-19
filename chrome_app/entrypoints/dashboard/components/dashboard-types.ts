import type { BuyerWatchRule, EventScheduleRecord, EventWatchRule } from '../../../lib/types';

export type TFn = (key: string, vars?: Record<string, string | number>) => string;

export type BuyerRuleEditorState = {
  pageUrl: string;
  pageTitle: string;
  productName: string;
  currentPrice: number | null;
  percentValue: number | null;
  rule: BuyerWatchRule | null;
};

export type EventRuleEditorState = {
  event: EventScheduleRecord;
  rule: EventWatchRule | null;
};

export type EventSlotVisualState = 'active' | 'next' | 'past' | 'future';
