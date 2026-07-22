import { getSettings } from '../lib/storage';
import type { ParseResult } from '../lib/types';

type ContentRequest = { type: 'QUANT_PARSE_PAGE' };

function extractNumbers(text: string): number[] {
  const matches = text.match(/\d+/g) ?? [];
  return matches.map((value) => Number(value)).filter((value) => Number.isFinite(value));
}

async function parsePage(): Promise<ParseResult> {
  const settings = await getSettings();
  const bodyText = document.body?.innerText ?? '';
  const numbers = extractNumbers(bodyText);
  const keyword = settings.keyword.trim().toLowerCase();

  return {
    pageTitle: document.title,
    url: location.href,
    checkedAt: new Date().toISOString(),
    totalNumbersFound: numbers.length,
    maxNumberFound: numbers.length ? Math.max(...numbers) : null,
    hasKeyword: keyword.length > 0 ? bodyText.toLowerCase().includes(keyword) : false,
    keyword
  };
}

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    chrome.runtime.onMessage.addListener((message: ContentRequest, _sender, sendResponse) => {
      if (message?.type !== 'QUANT_PARSE_PAGE') {
        return false;
      }

      void parsePage()
        .then((result) => sendResponse(result))
        .catch((error) =>
          sendResponse({
            pageTitle: document.title,
            url: location.href,
            checkedAt: new Date().toISOString(),
            totalNumbersFound: 0,
            maxNumberFound: null,
            hasKeyword: false,
            keyword: `error:${error instanceof Error ? error.message : 'unknown'}`
          } satisfies ParseResult)
        );

      return true;
    });
  }
});
