import { stripMarkdownForChatDisplay } from '@/lib/ai/messageBlocks';
import { getCatalogEntry } from './planCatalogData';
import type { PlanSubtype } from './Plan';

const PROMPT_LEAKAGE_PATTERN =
  /(?:no bullet|bullet points?|markdown|pas de listes|conc(?:r|è)tes?, en fran(?:c|ç)ais|ton rassurant|Tu es Fyn|conseiller financier|avoid repeating|recent local|local memory|do not repeat|don't repeat|ne pas r[eé]p[eé]ter mot pour mot|m[eé]moire locale)/i;

const INVESTMENT_SUBTYPES = new Set([
  'reer',
  'celi',
  'reee',
  'celiapp',
  'rattrapage_cotisation',
  'optimisation_reer_celi',
]);

export const DEBT_REPAYMENT_PLAN_SUBTYPES = new Set<PlanSubtype>([
  'avalanche',
  'snowball',
  'bombe_nucleaire',
  'consolidation',
  'dette_individuelle',
  'marge_credit',
]);

/** Card teaser — ~2 lines at meta size (non-debt). */
const CARD_REASON_MAX_CHARS = 130;

/** Debt strategy cards — ~1–2 lines; full comparison lives in the detail screen. */
const DEBT_CARD_REASON_MAX_CHARS = 110;

function cardReasonMaxChars(subtype?: PlanSubtype): number {
  if (subtype && DEBT_REPAYMENT_PLAN_SUBTYPES.has(subtype)) {
    return DEBT_CARD_REASON_MAX_CHARS;
  }
  return CARD_REASON_MAX_CHARS;
}

/** Short catalog blurb for debt cards; generic description elsewhere. */
function cardFallbackForSubtype(subtype: PlanSubtype | undefined, description: string): string {
  if (subtype && DEBT_REPAYMENT_PLAN_SUBTYPES.has(subtype)) {
    const catalog = getCatalogEntry(subtype);
    if (catalog?.description) return catalog.description;
  }
  return description;
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function truncateAtWordBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > maxChars * 0.55) {
    return `${slice.slice(0, lastSpace).trim()}…`;
  }
  return `${slice.trim()}…`;
}

function looksLikeBrokenReason(text: string): boolean {
  if (!text || text.length < 18) return true;
  if (PROMPT_LEAKAGE_PATTERN.test(text)) return true;
  if (/[\*#_`]{2,}/.test(text)) return true;
  if (/^[\*\s,;:.\-–—]+/.test(text)) return true;
  if (/,\s*(etc\.?|no bullet|markdown)\b/i.test(text)) return true;
  if (/\ba détecté\s*\.?\s*$/i.test(text)) return true;
  if (/t'aider à souff/i.test(text)) return true;
  if (/qui pourraient t'aider/i.test(text)) return true;
  return false;
}

/** Strip markdown / prompt leftovers; fall back to heuristic copy when Gemini output is unusable. */
export function sanitizePlanSuggestionReason(
  raw: string,
  fallback: string,
  subtype?: PlanSubtype,
): string {
  const maxChars = cardReasonMaxChars(subtype);
  const heuristic = truncateAtWordBoundary(
    collapseWhitespace(cardFallbackForSubtype(subtype, fallback)),
    maxChars,
  );
  if (!raw?.trim()) return heuristic;

  let text = collapseWhitespace(stripMarkdownForChatDisplay(raw));
  text = text.replace(/^["'«»]+|["'«»]+$/g, '').trim();
  text = text.replace(/\s*[-•*]\s+/g, ' ').trim();

  if (looksLikeBrokenReason(text)) return heuristic;
  return truncateAtWordBoundary(text, maxChars);
}

/** Safe card teaser — debt strategies stay brief; detail screen holds the full story. */
export function formatPlanSuggestionReasonForCard(
  reason: string,
  fallback: string,
  subtype?: PlanSubtype,
): string {
  return sanitizePlanSuggestionReason(reason, fallback, subtype);
}

/** Full personalized reason for plan template detail — sanitized, not truncated. */
export function resolvePlanSuggestionDetailReason(
  reason: string,
  fallback: string,
  subtype?: PlanSubtype,
): string {
  const heuristic = collapseWhitespace(cardFallbackForSubtype(subtype, fallback));
  if (!reason?.trim()) return heuristic;

  let text = collapseWhitespace(stripMarkdownForChatDisplay(reason));
  text = text.replace(/^["'«»]+|["'«»]+$/g, '').trim();
  text = text.replace(/\s*[-•*]\s+/g, ' ').trim();

  if (looksLikeBrokenReason(text)) return heuristic;
  return text;
}

export function isInvestmentPlanSubtype(subtype: string): boolean {
  return INVESTMENT_SUBTYPES.has(subtype);
}

export function isDebtRepaymentPlanSubtype(subtype: string): subtype is PlanSubtype {
  return DEBT_REPAYMENT_PLAN_SUBTYPES.has(subtype as PlanSubtype);
}
