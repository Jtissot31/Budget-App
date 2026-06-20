const FENCED_CODE_BLOCK_REGEX = /```[\w-]*\s*\n?([\s\S]*?)```/g;

export type JsonSpan = { json: string; start: number; end: number };

export function extractBalancedJsonObject(
  text: string,
  start: number,
): { json: string; end: number } | null {
  if (text[start] !== '{') return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        return { json: text.slice(start, i + 1), end: i + 1 };
      }
    }
  }

  return null;
}

function expandFenceWrappedJson(text: string): JsonSpan[] {
  const spans: JsonSpan[] = [];
  let match: RegExpExecArray | null;

  FENCED_CODE_BLOCK_REGEX.lastIndex = 0;
  while ((match = FENCED_CODE_BLOCK_REGEX.exec(text)) !== null) {
    const inner = match[1]?.trim();
    if (!inner?.startsWith('{')) continue;

    const extracted = extractBalancedJsonObject(inner, 0);
    if (!extracted) continue;

    spans.push({
      json: extracted.json,
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return spans;
}

export function findBalancedJsonSpans(text: string): JsonSpan[] {
  const byStart = new Map<number, JsonSpan>();

  let searchFrom = 0;
  while (searchFrom < text.length) {
    const braceStart = text.indexOf('{', searchFrom);
    if (braceStart === -1) break;

    const extracted = extractBalancedJsonObject(text, braceStart);
    if (!extracted) {
      searchFrom = braceStart + 1;
      continue;
    }

    byStart.set(braceStart, { json: extracted.json, start: braceStart, end: extracted.end });
    searchFrom = extracted.end;
  }

  for (const span of expandFenceWrappedJson(text)) {
    const existing = byStart.get(span.start);
    if (!existing || span.end - span.start > existing.end - existing.start) {
      byStart.set(span.start, span);
    }
  }

  return [...byStart.values()].sort((a, b) => a.start - b.start);
}

export function stripFencedCodeBlocks(text: string): string {
  return text.replace(FENCED_CODE_BLOCK_REGEX, '');
}

export function collapseExtraBlankLines(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n').trim();
}
