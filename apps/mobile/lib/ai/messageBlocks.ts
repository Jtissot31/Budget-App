import type { ChatAction } from '@/lib/ai/types';
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
const STRUCTURED_JSON_LEAD_REGEX = /^\{\s*"(?:type|action)"\s*:/;
const INCOMPLETE_FENCE_TAIL_REGEX = /```[\w-]*\s*\n?[\s\S]*$/;

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

function looksLikeStructuredJsonFragment(fragment: string): boolean {
  const trimmed = fragment.trimStart();
  if (!trimmed.startsWith('{')) return false;
  return (
    STRUCTURED_JSON_LEAD_REGEX.test(trimmed) ||
    WIDGET_TYPE_REGEX.test(trimmed) ||
    ACTION_KEY_REGEX.test(trimmed)
  );
}

/**
 * Hide trailing JSON/widget/action blocks that are still streaming or truncated.
 * Safe to call on every token — only strips unbalanced structured tails.
 */
export function stripIncompleteStructuredJson(text: string): string {
  let result = text.replace(INCOMPLETE_FENCE_TAIL_REGEX, '');

  let changed = true;
  while (changed) {
    changed = false;

    for (let index = result.length - 1; index >= 0; index -= 1) {
      if (result[index] !== '{') continue;

      const extracted = extractBalancedJsonObject(result, index);
      if (extracted) continue;

      const tail = result.slice(index);
      if (!looksLikeStructuredJsonFragment(tail)) continue;

      result = result.slice(0, index);
      changed = true;
      break;
    }
  }

  return result;
}

/** Remove balanced widget/action JSON spans from prose — including invalid widget payloads. */
function stripStructuredJsonFromProse(text: string): string {
  let result = stripFencedCodeBlocks(text);

  for (const block of findActionJsonBlocks(result)) {
    result = result.split(block).join('');
  }

  const spans = [...findBalancedJsonSpans(result)].sort((a, b) => b.start - a.start);
  for (const span of spans) {
    if (WIDGET_TYPE_REGEX.test(span.json)) {
      result = stripSpan(result, span.start, span.end);
    }
  }

  return stripIncompleteStructuredJson(result);
}

/**
 * Strip markdown the ChatBubble does not render, so users never see raw ### / ** etc.
 * Keeps plain bullet lines (- / •). Safe to call repeatedly (incl. while streaming).
 */
export function stripMarkdownForChatDisplay(text: string): string {
  if (!text) return text;

  let result = text.replace(/\r\n/g, '\n');

  // Incomplete or complete fenced blocks (streaming-safe)
  result = result.replace(/```[\w-]*\s*\n?[\s\S]*?```/g, '');
  result = result.replace(/```[\w-]*\s*\n?/g, '');

  // ATX headers: ### Title → Title (space optional)
  result = result.replace(/^\s{0,3}#{1,6}[ \t]*/gm, '');

  // Bold / strong — no /s flag (Hermes-safe)
  result = result.replace(/\*\*([^*]+)\*\*/g, '$1');
  result = result.replace(/__([^_]+)__/g, '$1');

  // Italic *phrase* only (do not strip single _ — breaks FR / snake_case)
  result = result.replace(/(^|[^\w*])\*([^*\n]+)\*(?!\*)/g, '$1$2');

  // Inline code, strikethrough, markdown links
  result = result.replace(/`([^`\n]+)`/g, '$1');
  result = result.replace(/~~([^~]+)~~/g, '$1');
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');

  // Horizontal rules
  result = result.replace(/^\s*([-*_]){3,}\s*$/gm, '');

  // Orphan markers that still leak as raw symbols (keep single # for « priorité #1 »)
  result = result.replace(/#{2,6}/g, '');
  result = result.replace(/\*\*/g, '');
  result = result.replace(/__/g, '');

  return collapseExtraBlankLines(result);
}

function cleanTextSegment(segment: string): string {
  return stripMarkdownForChatDisplay(collapseExtraBlankLines(stripStructuredJsonFromProse(segment)));
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

function normalizeComparableText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s$]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(value: string): Set<string> {
  return new Set(
    normalizeComparableText(value)
      .split(' ')
      .filter((token) => token.length > 2),
  );
}

function tokenOverlapRatio(a: string, b: string): number {
  const tokensA = tokenSet(a);
  const tokensB = tokenSet(b);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let shared = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) shared += 1;
  }

  return shared / Math.min(tokensA.size, tokensB.size);
}

/** True when visible prose repeats an action card confirmation CTA. */
export function isProseDuplicateOfActionConfirmation(prose: string, confirmation: string): boolean {
  const normalizedProse = normalizeComparableText(prose);
  const normalizedConfirmation = normalizeComparableText(confirmation);
  if (!normalizedProse || !normalizedConfirmation) return false;
  if (normalizedProse === normalizedConfirmation) return true;

  const shorter =
    normalizedProse.length <= normalizedConfirmation.length ? normalizedProse : normalizedConfirmation;
  const longer =
    normalizedProse.length <= normalizedConfirmation.length ? normalizedConfirmation : normalizedProse;

  if (shorter.length >= 12 && longer.includes(shorter)) return true;
  if (tokenOverlapRatio(prose, confirmation) >= 0.72) return true;

  return false;
}

/**
 * When action cards carry the CTA, drop prose that repeats the same question.
 * Keeps short non-duplicative context (e.g. one intro sentence).
 */
export function suppressDuplicateActionProse(
  blocks: MessageBlock[],
  actions: ChatAction[],
): MessageBlock[] {
  if (!actions.length) return blocks;

  const confirmations = actions.map((action) => action.confirmation).filter(Boolean);
  if (!confirmations.length) return blocks;

  const filtered: MessageBlock[] = [];

  for (const block of blocks) {
    if (block.type !== 'text') {
      filtered.push(block);
      continue;
    }

    const trimmed = block.content.trim();
    if (!trimmed) continue;

    const duplicateConfirmation = confirmations.some((confirmation) =>
      isProseDuplicateOfActionConfirmation(trimmed, confirmation),
    );
    if (duplicateConfirmation) continue;

    const sentences = trimmed.split(/(?<=[.!?…])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
    if (sentences.length <= 1) {
      filtered.push(block);
      continue;
    }

    const nonDuplicateSentences = sentences.filter(
      (sentence) =>
        !confirmations.some((confirmation) => isProseDuplicateOfActionConfirmation(sentence, confirmation)),
    );

    if (!nonDuplicateSentences.length) continue;
    if (nonDuplicateSentences.length === sentences.length) {
      filtered.push(block);
      continue;
    }

    filtered.push({ type: 'text', content: nonDuplicateSentences.join(' ') });
  }

  return filtered;
}

export function stripCodeFromAssistantText(text: string): string {
  return stripMarkdownForChatDisplay(collapseExtraBlankLines(stripStructuredJsonFromProse(text)));
}

/** Streaming-safe display: parsed widgets + prose with all JSON stripped (incl. partial). */
export function buildStreamingAssistantDisplay(partial: string): {
  text: string;
  blocks?: MessageBlock[];
} {
  const blocks = parseMessageBlocks(partial);
  const text = messageBlocksToPlainText(blocks) || stripCodeFromAssistantText(partial);
  const displayBlocks = blocks.filter(
    (block) => block.type !== 'text' || block.content.trim().length > 0,
  );

  return {
    text,
    blocks: displayBlocks.length > 0 ? displayBlocks : undefined,
  };
}
