import { saveBuyerSnapshot } from './db';
import type { AppSettings, BuyerWatchRule, QuantBuyerPageData } from './types';

export type BuyerIngestCallbacks = {
  notifyPercentAlert?: (args: {
    pageTitle: string;
    pageUrl: string;
    productName: string;
    percentValue: number;
  }) => Promise<void>;
  notifyRuleAlert?: (args: {
    rule: BuyerWatchRule;
    currentPrice: number | null;
    percentValue: number | null;
  }) => Promise<void>;
};

export function isBuyerRuleTriggered(
  rule: BuyerWatchRule,
  currentPrice: number | null,
  percentValue: number | null
): boolean {
  if (!rule.enabled) return false;

  const priceOk =
    rule.priceThreshold == null
      ? true
      : currentPrice != null &&
        (rule.condition === 'gte'
          ? currentPrice >= rule.priceThreshold
          : currentPrice <= rule.priceThreshold);

  const percentOk =
    rule.percentThreshold == null
      ? true
      : percentValue != null && percentValue >= rule.percentThreshold;

  return priceOk && percentOk;
}

export async function ingestBuyerPageData(args: {
  parsed: QuantBuyerPageData;
  settings: AppSettings;
  watchRules: BuyerWatchRule[];
  callbacks?: BuyerIngestCallbacks;
}): Promise<{ rowsStored: number }> {
  const { parsed, settings, watchRules, callbacks } = args;
  const mutedKeys = new Set(settings.buyerMutedNotificationKeys ?? []);

  await saveBuyerSnapshot(
    {
      pageUrl: parsed.pageUrl,
      pageTitle: parsed.pageTitle,
      fetchedAt: parsed.fetchedAt,
      lastUpdatedText: parsed.lastUpdatedText,
      nextUpdateText: parsed.nextUpdateText,
      sourceHash: parsed.sourceHash,
      rowCount: parsed.rows.length
    },
    parsed.rows.map((row) => ({
      ...row,
      pageUrl: parsed.pageUrl,
      fetchedAt: parsed.fetchedAt
    }))
  );

  const alertRow = parsed.rows.find(
    (row) =>
      !mutedKeys.has(`${parsed.pageUrl}::${row.productName}`) &&
      row.percentValue !== null &&
      row.percentValue >= settings.buyerAlertPercentMin &&
      settings.notificationEnabled
  );

  if (alertRow?.percentValue != null && callbacks?.notifyPercentAlert) {
    await callbacks.notifyPercentAlert({
      pageTitle: parsed.pageTitle,
      pageUrl: parsed.pageUrl,
      productName: alertRow.productName,
      percentValue: alertRow.percentValue
    });
  }

  const pageRules = watchRules.filter((rule) => rule.pageUrl === parsed.pageUrl);
  for (const rule of pageRules) {
    if (mutedKeys.has(`${parsed.pageUrl}::${rule.productName}`)) continue;
    const row = parsed.rows.find((r) => r.productName === rule.productName);
    if (!row) continue;
    if (!isBuyerRuleTriggered(rule, row.currentPrice, row.percentValue)) continue;
    if (!callbacks?.notifyRuleAlert) continue;
    await callbacks.notifyRuleAlert({
      rule,
      currentPrice: row.currentPrice,
      percentValue: row.percentValue
    });
  }

  return { rowsStored: parsed.rows.length };
}
