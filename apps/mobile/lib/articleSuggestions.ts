import { normalizeSearch } from '@/lib/categoryInference';

/** Common French grocery / household article names used when history is sparse. */
export const FRENCH_ARTICLE_PRESETS = [
  'Pain', 'Lait', 'Café', 'Eau', 'Légumes', 'Fruits', 'Viande', 'Fromage',
  'Beurre', 'Œufs', 'Pâtes', 'Riz', 'Sucre', 'Sel', 'Huile', 'Farine',
  'Yaourt', 'Jus', 'Savon', 'Shampoing', 'Lait biologique', 'Lait organique',
  'Pain complet', 'Poulet', 'Saumon', 'Bananes', 'Pommes', 'Tomates', 'Oignons',
  'Ail', 'Aspirateur', 'Ventilateur', 'Éponge', 'Détergent', 'Essuie-tout', 'Papier toilette',
  'Sacs poubelle', 'Ampoule', 'Piles', 'Balai', 'Serpillière', 'Lave-vaisselle',
  'Lessive', 'Adoucissant', 'Nettoyant', 'Champignons', 'Brocoli', 'Carottes',
  'Concombre', 'Avocat', 'Fraises', 'Raisins', 'Céréales', 'Granola',
];

const MIN_QUERY_CHARS = 2;
const DEFAULT_LIMIT = 8;

type ScoredSuggestion = { name: string; score: number };

function tokenize(value: string): string[] {
  const normalized = normalizeSearch(value);
  return normalized ? normalized.split(' ').filter(Boolean) : [];
}

function compact(value: string): string {
  return normalizeSearch(value).replace(/\s+/g, '');
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const saved = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      previous = saved;
    }
  }
  return row[b.length];
}

function isSubsequence(needle: string, haystack: string): boolean {
  if (needle.length < 3) return false;
  let needleIndex = 0;
  for (const char of haystack) {
    if (char === needle[needleIndex]) {
      needleIndex += 1;
      if (needleIndex === needle.length) return true;
    }
  }
  return false;
}

type TokenMatchKind = 'exact' | 'prefix' | 'contains' | 'subsequence' | 'fuzzy';

function scoreTokenMatch(queryToken: string, candidateToken: string): { score: number; kind: TokenMatchKind } | null {
  if (!queryToken || !candidateToken) return null;
  if (candidateToken === queryToken) return { score: 100, kind: 'exact' };
  if (candidateToken.startsWith(queryToken)) return { score: 85, kind: 'prefix' };
  if (queryToken.length >= 2 && candidateToken.includes(queryToken)) return { score: 70, kind: 'contains' };
  if (isSubsequence(queryToken, candidateToken)) return { score: 50, kind: 'subsequence' };

  // Fuzzy prefix only — sliding windows produce false positives (e.g. "ven" → "von" in "savon").
  if (queryToken.length >= 3) {
    const maxDistance = queryToken.length <= 4 ? 1 : 2;
    const prefixWindow = candidateToken.slice(0, queryToken.length + maxDistance);
    if (levenshtein(queryToken, prefixWindow) <= maxDistance) {
      return { score: 40, kind: 'fuzzy' };
    }
  }

  return null;
}

function scoreCandidate(
  query: string,
  queryTokens: string[],
  candidate: string,
  historyRank: Map<string, number>,
): number | null {
  const normalizedQuery = normalizeSearch(query);
  const normalizedCandidate = normalizeSearch(candidate);
  if (!normalizedQuery || !normalizedCandidate) return null;
  if (normalizedCandidate === normalizedQuery) return 10_000;

  let score = 0;

  if (normalizedCandidate.startsWith(normalizedQuery)) {
    score = 5_000;
  } else {
    const compactQuery = compact(query);
    const compactCandidate = compact(candidate);
    if (compactQuery.length >= 2 && compactCandidate.startsWith(compactQuery)) {
      score = 4_500;
    } else if (compactQuery.length >= 3 && compactCandidate.includes(compactQuery)) {
      score = 3_500;
    }
  }

  if (queryTokens.length === 0) return null;

  const candidateTokens = tokenize(candidate);
  let tokenScoreSum = 0;
  let sequentialBonus = 0;
  let lastMatchedIndex = -1;

  for (const queryToken of queryTokens) {
    let bestMatch: { score: number; index: number } | null = null;

    for (let index = 0; index < candidateTokens.length; index += 1) {
      const match = scoreTokenMatch(queryToken, candidateTokens[index]);
      if (!match) continue;
      if (!bestMatch || match.score > bestMatch.score) {
        bestMatch = { score: match.score, index };
      }
    }

    if (!bestMatch) return null;

    tokenScoreSum += bestMatch.score;
    if (bestMatch.index > lastMatchedIndex) {
      sequentialBonus += 12;
      lastMatchedIndex = bestMatch.index;
    }
  }

  if (score === 0) {
    score = 250 + tokenScoreSum + sequentialBonus;
  } else {
    score += tokenScoreSum + sequentialBonus;
  }
  score += historyRank.get(normalizedCandidate) ?? 0;

  return score;
}

/** Title-case display for suggestion chips and rows. */
export function formatArticleDisplayName(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

/** True when the name is ALL CAPS (category / merchant style), not a product label. */
function isShoutingCase(name: string): boolean {
  const letters = name.replace(/[^a-zA-ZÀ-ÿ]/g, '');
  return letters.length >= 3 && letters === letters.toUpperCase();
}

/**
 * Merges user article history and common grocery / household presets
 * into a deduplicated suggestion pool (history first).
 */
export function buildArticleSuggestionCatalog(history: string[]): string[] {
  const historyKeys = new Set(history.map((name) => normalizeSearch(name)));
  const seen = new Set<string>();
  const pool: string[] = [];

  const add = (name: string, fromHistory = false) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!fromHistory && isShoutingCase(trimmed)) return;
    const key = normalizeSearch(trimmed);
    if (!key || seen.has(key)) return;
    seen.add(key);
    pool.push(formatArticleDisplayName(trimmed));
  };

  for (const name of history) add(name, true);
  for (const name of FRENCH_ARTICLE_PRESETS) {
    if (historyKeys.has(normalizeSearch(name))) continue;
    add(name);
  }

  return pool;
}

/**
 * Search article names with multi-word token matching (prefix, contains, fuzzy).
 * Requires at least {@link MIN_QUERY_CHARS} characters in the query.
 */
export function searchArticleSuggestions(
  query: string,
  pool: string[],
  options?: { limit?: number; history?: string[] },
): string[] {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_CHARS) return [];

  const limit = options?.limit ?? DEFAULT_LIMIT;
  const history = options?.history ?? [];
  const historyRank = new Map(
    history.map((name, index) => [normalizeSearch(name), (history.length - index) * 50]),
  );

  const queryTokens = tokenize(trimmed);
  const scored: ScoredSuggestion[] = [];

  for (const candidate of pool) {
    const score = scoreCandidate(trimmed, queryTokens, candidate, historyRank);
    if (score === null) continue;
    scored.push({ name: candidate, score });
  }

  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'fr'));
  return scored.slice(0, limit).map((item) => formatArticleDisplayName(item.name));
}
