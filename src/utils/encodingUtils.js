// Unicode / UTF-8 encoding and mojibake restoration utility for BNXmail frontend

const win1252RevMap = new Map([
  [0x20AC, 0x80], // €
  [0x201A, 0x82], // ‚
  [0x0192, 0x83], // ƒ
  [0x201E, 0x84], // „
  [0x2026, 0x85], // …
  [0x2020, 0x86], // †
  [0x2021, 0x87], // ‡
  [0x02C6, 0x88], // ˆ
  [0x2030, 0x89], // ‰
  [0x0160, 0x8A], // Š
  [0x2039, 0x8B], // ‹
  [0x0152, 0x8C], // Œ
  [0x017D, 0x8E], // Ž
  [0x2018, 0x91], // ‘
  [0x2019, 0x92], // ’
  [0x201C, 0x93], // “
  [0x201D, 0x94], // ”
  [0x2022, 0x95], // •
  [0x2013, 0x96], // –
  [0x2014, 0x97], // —
  [0x02DC, 0x98], // ˜
  [0x2122, 0x99], // ™
  [0x0161, 0x9A], // š
  [0x203A, 0x9B], // ›
  [0x0153, 0x9C], // œ
  [0x017E, 0x9E], // ž
  [0x0178, 0x9F], // Ÿ
]);

function charToByte(code) {
  if (code < 0x80) return code;
  if (win1252RevMap.has(code)) return win1252RevMap.get(code);
  if (code <= 0xFF) return code;
  return -1;
}

function tryDecodeMojibakeSequence(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const b = charToByte(str.charCodeAt(i));
    if (b === -1) return null;
    bytes.push(b);
  }
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    return decoder.decode(new Uint8Array(bytes));
  } catch (e) {
    return null;
  }
}

/**
 * Accurately detects and restores UTF-8 strings that were misinterpreted as Latin-1 or Windows-1252 (Mojibake).
 * If the string is already clean UTF-8 or regular text (including Tamil, Hindi, English, etc.),
 * it safely leaves it unmodified without corrupting or applying repeated transformations.
 *
 * @param {string} text
 * @returns {string}
 */
export function fixUtf8Encoding(text) {
  if (!text || typeof text !== 'string') return text;

  // If no typical UTF-8 lead byte in Latin-1/Windows-1252 (0xC2 - 0xF4), no mojibake possible
  if (!/[\u00C2-\u00F4]/.test(text)) {
    return text;
  }

  // Regex matching sequences of UTF-8 multibyte sequences decoded as Windows-1252 / ISO-8859-1
  const mojibakeRegex = /([\u00C2-\u00F4][\u0080-\u00BF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026\u2122\u20AC\u0160\u0161\u0152\u0153\u0178\u017D\u017E\u02C6\u02DC\u2030\u2039\u203A\u2020\u2021\u0192\u201A\u201E\u009D\u009C]+)/g;

  return text.replace(mojibakeRegex, (match) => {
    const dec = tryDecodeMojibakeSequence(match);
    return dec !== null ? dec : match;
  });
}

/**
 * Safely decodes text for display in Casbox lists and headers:
 * - Fixes UTF-8 mojibake
 * - Decodes common HTML entities (&mdash;, &#39;, &quot;, etc.) without unsafe DOM manipulation
 * - Preserves existing plain text and Unicode characters without change
 *
 * @param {string} text
 * @returns {string}
 */
export function decodeDisplayContent(text) {
  if (!text || typeof text !== 'string') return '';
  let clean = fixUtf8Encoding(text);
  if (clean.includes('&')) {
    clean = clean
      .replace(/&amp;/gi, '&')
      .replace(/&mdash;/gi, '—')
      .replace(/&ndash;/gi, '–')
      .replace(/&quot;/gi, '"')
      .replace(/&#0*39;|&apos;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&#(\d+);/g, (_, dec) => {
        try {
          return String.fromCodePoint(parseInt(dec, 10));
        } catch (e) {
          return _;
        }
      })
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
        try {
          return String.fromCodePoint(parseInt(hex, 16));
        } catch (e) {
          return _;
        }
      });
  }
  return clean;
}
