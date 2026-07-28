export type DiscordStaticIdParseResult =
  | { status: 'missing'; staticId: null; warning: null }
  | { status: 'valid'; staticId: string; warning: null }
  | { status: 'invalid'; staticId: null; warning: string };

const STATIC_ID_PATTERNS = [
  /\b(?:static\s*id|static-id|id)\s*[:#-]?\s*(\d{1,12})\b/iu,
  /(?:^|[\s[\](){}#|])#?(\d{1,12})(?=$|[\s[\](){}|])/u,
];

export function parseStaticIdFromDiscordNickname(value: string | null | undefined): DiscordStaticIdParseResult {
  const source = value?.trim();
  if (!source) return { status: 'missing', staticId: null, warning: null };

  for (const pattern of STATIC_ID_PATTERNS) {
    const match = source.match(pattern);
    if (match?.[1]) return { status: 'valid', staticId: normalizeStaticId(match[1]), warning: null };
  }

  if (/\b(?:static\s*id|static-id|id)\s*[:#-]?\s*\D+/iu.test(source)) {
    return {
      status: 'invalid',
      staticId: null,
      warning: 'Discord nickname appears to contain a malformed Static ID.',
    };
  }

  return { status: 'missing', staticId: null, warning: null };
}

function normalizeStaticId(value: string) {
  return value.replace(/^0+(?=\d)/u, '');
}
