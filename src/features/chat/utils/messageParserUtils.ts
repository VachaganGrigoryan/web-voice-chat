export interface ParsedMessageText {
  raw: string;
  normalized: string;
  text: string;
  links: string[];
}

const ASCII_SMILE_MAP: Record<string, string> = {
  ':)': '🙂',
  ':D': '😃',
  ';)': '😉',
  ':(': '🙁',
  ':P': '😛',
  ':p': '😛',
  '<3': '❤️',
  ':O': '😮',
  ':o': '😮',
};

const URL_REGEX = /\bhttps?:\/\/[^\s<]+[^\s<.,:;"')\]]/gi;

function protectCodeSegments(text: string) {
  const segments: string[] = [];
  const protectedText = text.replace(/```[\s\S]*?```|`[^`\n]+`/g, (match) => {
    const token = `__CHAT_CODE_SEGMENT_${segments.length}__`;
    segments.push(match);
    return token;
  });

  return { protectedText, segments };
}

function restoreCodeSegments(text: string, segments: string[]) {
  return segments.reduce(
    (result, segment, index) => result.replace(`__CHAT_CODE_SEGMENT_${index}__`, segment),
    text
  );
}

export function normalizeMessageText(raw: string): string {
  return raw.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').trimEnd();
}

export function replaceAsciiSmiles(text: string): string {
  const { protectedText, segments } = protectCodeSegments(text);

  const replacedText = protectedText.replace(
    /(^|[\s([{])(:\)|:D|;\)|:\(|:P|:p|<3|:O|:o)(?=$|[\s)\]}!?,.;:])/g,
    (match, prefix: string, smile: string) => `${prefix}${ASCII_SMILE_MAP[smile] ?? smile}`
  );

  return restoreCodeSegments(replacedText, segments);
}

export function extractLinks(text: string): string[] {
  return Array.from(text.matchAll(URL_REGEX), (match) => match[0]);
}

export function parseMessageText(raw: string): ParsedMessageText {
  const normalized = normalizeMessageText(raw);
  const text = replaceAsciiSmiles(normalized);

  return {
    raw,
    normalized,
    text,
    links: extractLinks(normalized),
  };
}
