import {
  AI_WIDGET_TYPES,
  type AIWidgetData,
  type AIWidgetType,
  type MessageBlock,
} from '@/types/aiWidgets';
import {
  collapseExtraBlankLines,
  extractBalancedJsonObject,
  findBalancedJsonSpans,
  stripFencedCodeBlocks,
} from './jsonExtract';

const WIDGET_TYPE_SET = new Set<string>(AI_WIDGET_TYPES);
const WIDGET_TYPE_REGEX = new RegExp(
  `"type"\\s*:\\s*"(${AI_WIDGET_TYPES.join('|')})"`,
);

const ACTION_KEY_REGEX = /"action"\s*:/;

function isWidgetType(value: string): value is AIWidgetType {
  return WIDGET_TYPE_SET.has(value);
}

function parseWidgetJson(json: string): AIWidgetData | null {
  if (!WIDGET_TYPE_REGEX.test(json)) return null;

  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const type = parsed.type;
    if (typeof type !== 'string' || !isWidgetType(type)) return null;

    switch (type) {
      case 'progress_card':
        if (
          typeof parsed.label !== 'string' ||
          typeof parsed.value_label !== 'string' ||
          typeof parsed.percent !== 'number' ||
          typeof parsed.percent_label !== 'string'
        ) {
          return null;
        }
        return parsed as unknown as AIWidgetData;

      case 'debt_table':
        if (!Array.isArray(parsed.rows) || !parsed.total || typeof parsed.total !== 'object') {
          return null;
        }
        return parsed as unknown as AIWidgetData;

      case 'comparison_card':
        if (typeof parsed.label !== 'string' || !Array.isArray(parsed.items)) {
          return null;
        }
        return parsed as unknown as AIWidgetData;

      case 'alert_card':
        if (
          typeof parsed.severity !== 'string' ||
          typeof parsed.title !== 'string' ||
          typeof parsed.message !== 'string'
        ) {
          return null;
        }
        return parsed as unknown as AIWidgetData;

      case 'line_chart':
        if (
          typeof parsed.label !== 'string' ||
          !Array.isArray(parsed.data) ||
          parsed.data.length < 2 ||
          !parsed.data.every((point) => typeof point === 'number' && Number.isFinite(point))
        ) {
          return null;
        }
        return parsed as unknown as AIWidgetData;

      case 'bar_chart':
        if (
          typeof parsed.label !== 'string' ||
          !Array.isArray(parsed.items) ||
          parsed.items.length < 1 ||
          !parsed.items.every(
            (item) =>
              item &&
              typeof item === 'object' &&
              typeof (item as Record<string, unknown>).label === 'string' &&
              typeof (item as Record<string, unknown>).value === 'number' &&
              Number.isFinite((item as Record<string, unknown>).value as number),
          )
        ) {
          return null;
        }
        return parsed as unknown as AIWidgetData;

      case 'allocation_chart':
        if (
          typeof parsed.label !== 'string' ||
          !Array.isArray(parsed.segments) ||
          parsed.segments.length < 1 ||
          !parsed.segments.every(
            (segment) =>
              segment &&
              typeof segment === 'object' &&
              typeof (segment as Record<string, unknown>).label === 'string' &&
              typeof (segment as Record<string, unknown>).value === 'number' &&
              Number.isFinite((segment as Record<string, unknown>).value as number),
          )
        ) {
          return null;
        }
        return parsed as unknown as AIWidgetData;

      default:
        return null;
    }
  } catch {
    return null;
  }
}

export function findActionJsonBlocks(text: string): string[] {
  const blocks: string[] = [];
  let searchFrom = 0;

  while (searchFrom < text.length) {
    const braceStart = text.indexOf('{', searchFrom);
    if (braceStart === -1) break;

    const extracted = extractBalancedJsonObject(text, braceStart);
    if (!extracted) {
      searchFrom = braceStart + 1;
      continue;
    }

    const { json, end } = extracted;
    if (ACTION_KEY_REGEX.test(json)) {
      blocks.push(json);
    }
    searchFrom = end;
  }

  return blocks;
}

export function findWidgetJsonBlocks(text: string): string[] {
  const blocks: string[] = [];
  const seen = new Set<string>();

  for (const span of findBalancedJsonSpans(text)) {
    if (!WIDGET_TYPE_REGEX.test(span.json)) continue;
    if (seen.has(span.json)) continue;
    if (parseWidgetJson(span.json)) {
      seen.add(span.json);
      blocks.push(span.json);
    }
  }

  return blocks;
}

function stripSpan(text: string, start: number, end: number): string {
  return `${text.slice(0, start)}${text.slice(end)}`;
}

function cleanTextSegment(segment: string): string {
  let result = stripFencedCodeBlocks(segment);

  for (const block of findActionJsonBlocks(result)) {
    result = result.split(block).join('');
  }

  for (const block of findWidgetJsonBlocks(result)) {
    result = result.split(block).join('');
  }

  return collapseExtraBlankLines(result);
}

export function parseMessageBlocks(text: string): MessageBlock[] {
  const spans = findBalancedJsonSpans(text);
  const actionBlocks = new Set(findActionJsonBlocks(text));
  const blocks: MessageBlock[] = [];
  let cursor = 0;

  for (const span of spans) {
    if (actionBlocks.has(span.json)) continue;

    const widget = parseWidgetJson(span.json);
    if (!widget) continue;

    const cleanedBefore = cleanTextSegment(text.slice(cursor, span.start));
    if (cleanedBefore) {
      blocks.push({ type: 'text', content: cleanedBefore });
    }

    blocks.push(widget);
    cursor = span.end;
  }

  const tail = cleanTextSegment(text.slice(cursor));
  if (tail) {
    blocks.push({ type: 'text', content: tail });
  }

  if (blocks.length === 0) {
    const fallback = cleanTextSegment(text);
    if (fallback) {
      blocks.push({ type: 'text', content: fallback });
    }
  }

  return blocks;
}

export function messageBlocksToPlainText(blocks: MessageBlock[]): string {
  return blocks
    .filter((block): block is { type: 'text'; content: string } => block.type === 'text')
    .map((block) => block.content)
    .join('\n\n')
    .trim();
}

export function stripCodeFromAssistantText(text: string): string {
  let result = stripFencedCodeBlocks(text);

  for (const block of findActionJsonBlocks(result)) {
    result = result.split(block).join('');
  }

  for (const block of findWidgetJsonBlocks(result)) {
    result = result.split(block).join('');
  }

  return collapseExtraBlankLines(result);
}
