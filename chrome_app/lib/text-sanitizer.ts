const WINDOWS_1251_TABLE = [
  0x0402, 0x0403, 0x201a, 0x0453, 0x201e, 0x2026, 0x2020, 0x2021,
  0x20ac, 0x2030, 0x0409, 0x2039, 0x040a, 0x040c, 0x040b, 0x040f,
  0x0452, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x2122, 0x0459, 0x203a, 0x045a, 0x045c, 0x045b, 0x045f, 0x00a0,
  0x040e, 0x045e, 0x0408, 0x00a4, 0x0490, 0x00a6, 0x00a7, 0x0401,
  0x00a9, 0x0404, 0x00ab, 0x00ac, 0x00ad, 0x00ae, 0x0407, 0x00b0,
  0x00b1, 0x0406, 0x0456, 0x0491, 0x00b5, 0x00b6, 0x00b7, 0x0451,
  0x2116, 0x0454, 0x00bb, 0x0458, 0x0405, 0x0455, 0x0457
];

for (let code = 0x0410; code <= 0x044f; code += 1) {
  WINDOWS_1251_TABLE.push(code);
}

const WINDOWS_1251_CHARS = String.fromCodePoint(...WINDOWS_1251_TABLE);
const REPLACEMENT_CHARACTER = String.fromCodePoint(0xfffd);
const MOJIBAKE_PATTERN =
  /\u0420[\u0400-\u04ff\u00a0-\u00bf\u2010-\u2122]|\u0421[\u0400-\u04ff\u00a0-\u00bf\u2010-\u2122]|\u0432\u0402|\u0412\u00b7|\u0432\u201e\u2013|\u041a\u0458|\u0420\u00b0|\u0420\u00b5|\u0420\u0405|\u0421\u0453|[\u0423\u0404\u0407\u0490][\u0491\u0411\u0401\u0416\u0409]{1,}|[\u0411\u0401\u0416\u0409]{2,}|[\u0440\u0420][\u042d\u044d][\u0440\u0420]/g;

function mojibakeScore(value: string) {
  return value.match(MOJIBAKE_PATTERN)?.length ?? 0;
}

function encodeWindows1251(value: string): Uint8Array | null {
  const bytes: number[] = [];
  for (const char of value) {
    const code = char.codePointAt(0);
    if (code == null) continue;
    if (code < 128) {
      bytes.push(code);
      continue;
    }
    const index = WINDOWS_1251_CHARS.indexOf(char);
    if (index === -1) return null;
    bytes.push(0x80 + index);
  }
  return new Uint8Array(bytes);
}

export function repairMojibakeText(value: string): string {
  if (!MOJIBAKE_PATTERN.test(value)) {
    MOJIBAKE_PATTERN.lastIndex = 0;
    return value;
  }
  MOJIBAKE_PATTERN.lastIndex = 0;
  const bytes = encodeWindows1251(value);
  if (!bytes) return value;
  const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  if (decoded.includes(REPLACEMENT_CHARACTER)) return value;
  return mojibakeScore(decoded) < mojibakeScore(value) ? decoded : value;
}

export function sanitizeFamilyTextDeep<T>(value: T): T {
  if (typeof value === 'string') return repairMojibakeText(value) as T;
  if (Array.isArray(value)) return value.map((item) => sanitizeFamilyTextDeep(item)) as T;
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, sanitizeFamilyTextDeep(item)])
  ) as T;
}

export function hasMojibakeText(value: unknown): boolean {
  if (typeof value === 'string') {
    return repairMojibakeText(value) !== value;
  }
  if (Array.isArray(value)) return value.some((item) => hasMojibakeText(item));
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).some((item) => hasMojibakeText(item));
}

export function assertNoMojibakeSeed(seedName: string, value: unknown) {
  if (hasMojibakeText(value)) {
    console.warn(`${seedName} contains mojibake text. It will be sanitized before storage.`);
  }
}
