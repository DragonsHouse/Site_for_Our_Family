export type ParseResult = {
  pageTitle: string;
  url: string;
  checkedAt: string;
  totalNumbersFound: number;
  maxNumberFound: number | null;
  hasKeyword: boolean;
  keyword: string;
};

export type AppSettings = {
  keyword: string;
  minNumbersFound: number;
  notificationEnabled: boolean;
  pollingEnabled: boolean;
  pollIntervalMinutes: number;
  buyerSeedUrl: string;
  buyerAlertPercentMin: number;
  buyerMutedNotificationKeys: string[];
  popupSections: PopupSectionsConfig;
  popupBuyerTopSort: 'percent' | 'price';
  popupBuyerTopCount: number;
  popupBuyerShowTrackedList: boolean;
  popupBuyerAllowedPageUrls: string[];
  popupBuyerAllowedProductKeys: string[];
  dashboardShowBackgroundService: boolean;
};

export type PopupSectionsConfig = {
  quickActions: boolean;
  buyerSummary: boolean;
  eventsSummary: boolean;
  pollingStatus: boolean;
  manualPageScan: boolean;
  manualScanResult: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  keyword: 'quant',
  minNumbersFound: 3,
  notificationEnabled: true,
  pollingEnabled: true,
  pollIntervalMinutes: 5,
  buyerSeedUrl: 'https://quantfun.com.ua/server/1/buyer/8/',
  buyerAlertPercentMin: 95,
  buyerMutedNotificationKeys: [],
  popupBuyerTopSort: 'percent',
  popupBuyerTopCount: 5,
  popupBuyerShowTrackedList: true,
  popupBuyerAllowedPageUrls: [],
  popupBuyerAllowedProductKeys: [],
  dashboardShowBackgroundService: true,
  popupSections: {
    quickActions: true,
    buyerSummary: true,
    eventsSummary: true,
    pollingStatus: true,
    manualPageScan: true,
    manualScanResult: true
  }
};

export type QuantBuyerNavLink = {
  url: string;
  title: string;
  serverId: number | null;
  buyerId: number | null;
  isActive: boolean;
  sortOrder: number;
};

export type QuantBuyerRow = {
  rowIndex: number;
  productName: string;
  minPrice: number | null;
  maxPrice: number | null;
  currentPrice: number | null;
  percentValue: number | null;
};

export type QuantBuyerPageData = {
  pageTitle: string;
  pageUrl: string;
  fetchedAt: string;
  lastUpdatedText: string | null;
  nextUpdateText: string | null;
  navLinks: QuantBuyerNavLink[];
  rows: QuantBuyerRow[];
  sourceHash: string;
};

export type BuyerPageRecord = {
  url: string;
  title: string;
  serverId: number | null;
  buyerId: number | null;
  sortOrder: number;
  enabled: boolean;
  discoveredAt: string;
  updatedAt: string;
};

export type BuyerSnapshotRecord = {
  id?: number;
  pageUrl: string;
  pageTitle: string;
  fetchedAt: string;
  lastUpdatedText: string | null;
  nextUpdateText: string | null;
  sourceHash: string;
  rowCount: number;
};

export type BuyerRowRecord = QuantBuyerRow & {
  id?: number;
  snapshotId: number;
  pageUrl: string;
  fetchedAt: string;
};

export type PollState = {
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  running: boolean;
  pagesDiscovered: number;
  pagesProcessed: number;
  rowsStored: number;
  buyerTotalPages: number;
  buyerBatchSize: number;
  buyerCursor: number;
  cyclesCompleted: number;
  consecutiveFailures: number;
  nextEligibleRunAt: string | null;
  lastTrigger: 'alarm' | 'manual' | 'startup' | 'install' | 'unknown';
};

export type BuyerWatchCondition = 'gte' | 'lte';

export type BuyerWatchRule = {
  ruleKey: string;
  pageUrl: string;
  pageTitle: string;
  productName: string;
  enabled: boolean;
  condition: BuyerWatchCondition;
  priceThreshold: number | null;
  percentThreshold: number | null;
  createdAt: string;
  updatedAt: string;
};

export type BuyerPageLatestData = {
  page: BuyerPageRecord;
  snapshot: BuyerSnapshotRecord | null;
  rows: BuyerRowRecord[];
};

export type EventSlotStatusOnSite = 'started' | 'not-started' | 'unknown';

export type EventTimeSlot = {
  label: string;
  startMinutes: number;
  endMinutes: number | null;
  isRange: boolean;
  siteStatus: EventSlotStatusOnSite;
};

export type EventScheduleRecord = {
  eventKey: string;
  eventName: string;
  note: string | null;
  slots: EventTimeSlot[];
  sourceUrl: string;
  fetchedAt: string;
};

export type EventNotificationStyle = 'standard' | 'important' | 'compact';

export type EventWatchRule = {
  eventKey: string;
  eventName: string;
  enabled: boolean;
  leadMinutes: 2 | 5 | 10 | 15;
  notificationStyle: EventNotificationStyle;
  createdAt: string;
  updatedAt: string;
};

export type TransportCheckpoint = {
  transportKey: string;
  lastSequence: string | null;
  lastEventAt: string | null;
  updatedAt: string;
  meta?: Record<string, string | number | boolean | null>;
};

export type MapUserPoint = {
  id?: number;
  x: number; // map coordinate in maxZoom space
  y: number; // map coordinate in maxZoom space
  title: string;
  icon: string;
  iconUrl: string | null;
  customIconDataUrl: string | null;
  detailImageDataUrl?: string | null;
  zoneId?: string | null;
  filterLabel: string | null;
  color: string;
  note: string | null;
  sourceMarkerId?: string | null;
  hidden?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MapZone = {
  id: string;
  name: string;
  color: string;
  opacity?: number | null;
  points: Array<{ x: number; y: number }>;
  imageDataUrl?: string | null;
  imageX?: number | null;
  imageY?: number | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  imageRotation?: number | null;
  imageOpacity?: number | null;
  cropTop?: number | null;
  cropRight?: number | null;
  cropBottom?: number | null;
  cropLeft?: number | null;
  createdAt: string;
  updatedAt: string;
};
