import type { QuantBuyerNavLink, QuantBuyerPageData, QuantBuyerRow } from './types';

function stripTags(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#36;/g, '$')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractNumber(input: string): number | null {
  const normalized = stripTags(input).replace(/\s/g, '').replace(',', '.');
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

function simpleHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

export function parseBuyerNavLinks(html: string, pageUrl: string): QuantBuyerNavLink[] {
  const links: QuantBuyerNavLink[] = [];
  const regex =
    /<a\s+class="btn[^"]*?(btn-primary|btn-outline-primary)[^"]*"\s+href="([^"]*\/server\/(\d+)\/buyer\/(\d+)\/)"[^>]*>\s*([\s\S]*?)\s*<\/a>/gi;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = regex.exec(html))) {
    const [, buttonClass, href, serverIdRaw, buyerIdRaw, innerHtml] = match;
    const url = new URL(href, pageUrl).toString();
    links.push({
      url,
      title: stripTags(innerHtml),
      serverId: Number(serverIdRaw),
      buyerId: Number(buyerIdRaw),
      isActive: buttonClass.includes('btn-primary') && !buttonClass.includes('outline'),
      sortOrder: index
    });
    index += 1;
  }

  return links;
}

function extractMainBuyerTableHtml(html: string): string | null {
  const formIndex = html.indexOf('<form method="post">');
  if (formIndex < 0) return null;

  const scopedHtml = html.slice(formIndex);
  const tableMatch = scopedHtml.match(
    /<table[^>]*class="[^"]*table-sm[^"]*table-hover[^"]*align-middle[^"]*"[^>]*>[\s\S]*?<\/table>/i
  );

  return tableMatch?.[0] ?? null;
}

function parseRowsFromTable(tableHtml: string): QuantBuyerRow[] {
  const tbodyMatch = tableHtml.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return [];

  const tbody = tbodyMatch[1];
  const rows: QuantBuyerRow[] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  let rowIndex = 0;

  while ((rowMatch = rowRegex.exec(tbody))) {
    const rowHtml = rowMatch[1];
    const productMatch = rowHtml.match(/<th[^>]*>([\s\S]*?)<\/th>/i);
    const tdMatches = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];

    if (!productMatch || tdMatches.length < 4) {
      continue;
    }

    const productName = stripTags(productMatch[1]).replace(/^\d+\s*/g, '').trim();
    if (!productName) {
      continue;
    }

    rows.push({
      rowIndex,
      productName,
      minPrice: extractNumber(tdMatches[0][1]),
      maxPrice: extractNumber(tdMatches[1][1]),
      currentPrice: extractNumber(tdMatches[2][1]),
      percentValue: extractNumber(tdMatches[3][1])
    });
    rowIndex += 1;
  }

  return rows;
}

function extractInfoValue(html: string, label: string): string | null {
  const safeLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`${safeLabel}[\\s\\S]*?<strong>([\\s\\S]*?)<\\/strong>`, 'i');
  const match = html.match(regex);
  return match ? stripTags(match[1]) : null;
}

function extractPageTitle(html: string): string {
  const cardMatch = html.match(/<div class="card-body">[\s\S]*?<h4>([\s\S]*?)<\/h4>/i);
  return stripTags(cardMatch?.[1] ?? '') || 'Buyer page';
}

export function parseQuantBuyerPage(html: string, pageUrl: string): QuantBuyerPageData {
  const rowsTableHtml = extractMainBuyerTableHtml(html);
  const rows = rowsTableHtml ? parseRowsFromTable(rowsTableHtml) : [];
  const navLinks = parseBuyerNavLinks(html, pageUrl);

  const pageTitle = extractPageTitle(html);
  const lastUpdatedText = extractInfoValue(html, 'Останнє оновлення цін:');
  const nextUpdateText = extractInfoValue(html, 'Наступне оновлення цін:');

  const hashSource = rows
    .map((row) =>
      [
        row.rowIndex,
        row.productName,
        row.minPrice,
        row.maxPrice,
        row.currentPrice,
        row.percentValue
      ].join('|')
    )
    .join('\n');

  return {
    pageTitle,
    pageUrl,
    fetchedAt: new Date().toISOString(),
    lastUpdatedText,
    nextUpdateText,
    navLinks,
    rows,
    sourceHash: simpleHash(hashSource || `${pageTitle}|${pageUrl}`)
  };
}
