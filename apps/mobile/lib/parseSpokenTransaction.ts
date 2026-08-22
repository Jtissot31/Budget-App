/**
 * Dictée vocale → brouillon de transaction (français québécois).
 *
 * Ex. « je viens de mettre 50$ de gas chez Petro-Canada avec ma carte Visa Desjardins »
 *   → expense / 50 / Petro-Canada / cat-gas / compte « Visa Desjardins »
 *
 * Les comptes, catégories et marchands viennent de l'app (jamais inventés) : un champ
 * non reconnu reste `null` et l'utilisateur le complète dans le formulaire.
 *
 * Test : npx --yes tsx --tsconfig tsconfig.json lib/parseSpokenTransaction.test.ts
 */

import { inferCategoryId } from './categoryInference';
import type { AccountKind, Category, SimulatedAccount } from '@/types';

export type SpokenTransactionType = 'expense' | 'income';

export type SpokenTransactionField = 'amount' | 'merchant' | 'category' | 'account';

export type SpokenTransactionContext = {
  accounts?: readonly SimulatedAccount[];
  categories?: readonly Category[];
  /** Libellés marchands connus (catalogue + historique) pour la reconnaissance. */
  merchants?: readonly string[];
};

export type ParsedSpokenTransaction = {
  transcript: string;
  type: SpokenTransactionType;
  amount: number | null;
  merchant: string | null;
  categoryId: string | null;
  accountId: string | null;
  /** Libellé du compte reconnu — pour le récapitulatif de confirmation. */
  accountLabel: string | null;
  /** Champs non reconnus, à compléter à la main. */
  missing: SpokenTransactionField[];
};

const EMPTY_RESULT: Omit<ParsedSpokenTransaction, 'transcript'> = {
  type: 'expense',
  amount: null,
  merchant: null,
  categoryId: null,
  accountId: null,
  accountLabel: null,
  missing: ['amount', 'merchant', 'category', 'account'],
};

function stripDiacritics(input: string): string {
  return input.normalize('NFD').replace(/\p{M}/gu, '');
}

/** Minuscules sans accents, apostrophes → espace (« j'ai » → « j ai »). Ponctuation conservée. */
function toAsciiLower(input: string): string {
  return stripDiacritics(input.toLowerCase()).replace(/[’'`´]/g, ' ');
}

/** Forme mot-à-mot : seulement lettres/chiffres séparés par une espace simple. */
function normalizeWords(input: string): string {
  return toAsciiLower(input)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Forme compacte (aucun séparateur) — rattrape « McDonald's » vs « McDonalds ». */
function compact(input: string): string {
  return normalizeWords(input).replace(/ /g, '');
}

function containsPhrase(haystackWords: string, phraseWords: string): boolean {
  if (!phraseWords) return false;
  return ` ${haystackWords} `.includes(` ${phraseWords} `);
}

// ---------------------------------------------------------------------------
// Montant
// ---------------------------------------------------------------------------

function toNumber(whole: string, cents?: string): number {
  const dollars = Number(whole.replace(/[ \u00A0]/g, ''));
  if (!Number.isFinite(dollars)) return Number.NaN;
  if (!cents) return dollars;
  const fraction = Number(cents.length === 1 ? `${cents}0` : cents);
  return dollars + (Number.isFinite(fraction) ? fraction / 100 : 0);
}

const CURRENCY_WORD = String.raw`(?:\$|dollars?|piastres?)`;
const DIGITS = String.raw`\d{1,3}(?:[ \u00A0]\d{3})*|\d+`;

/** « 50 dollars et 25 cents » / « 50$ et 25 sous ». */
const AMOUNT_WITH_CENTS_RE = new RegExp(
  String.raw`(${DIGITS})\s*${CURRENCY_WORD}\s*(?:et\s+)?(\d{1,2})\s*(?:cents?|sous)`,
);
/** « 50,25 $ » / « 50$ » / « 50 dollars ». */
const AMOUNT_SUFFIXED_RE = new RegExp(String.raw`(${DIGITS})(?:[.,](\d{1,2}))?\s*${CURRENCY_WORD}`);
/** « $50 » / « $ 50,25 ». */
const AMOUNT_PREFIXED_RE = new RegExp(String.raw`\$\s*(${DIGITS})(?:[.,](\d{1,2}))?`);

const FR_SMALL_NUMBERS: Record<string, number> = {
  zero: 0,
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
  treize: 13,
  quatorze: 14,
  quinze: 15,
  seize: 16,
};

const FR_TENS: Record<string, number> = {
  vingt: 20,
  vingts: 20,
  trente: 30,
  quarante: 40,
  cinquante: 50,
  soixante: 60,
};

/** Additionne une suite de mots-nombres français (0–9999), avec « quatre-vingt(-dix) ». */
function frenchWordsToNumber(words: string[]): number | null {
  let total = 0;
  let current = 0;
  let matched = false;

  for (const word of words) {
    if (word === 'et') continue;

    if (word === 'cent' || word === 'cents') {
      current = (current || 1) * 100;
      matched = true;
      continue;
    }
    if (word === 'mille' || word === 'milles') {
      total += (current || 1) * 1000;
      current = 0;
      matched = true;
      continue;
    }

    const tens = FR_TENS[word];
    if (tens !== undefined) {
      // « quatre-vingt » = 80 (et non 4 + 20).
      current = word.startsWith('vingt') && current === 4 ? 80 : current + tens;
      matched = true;
      continue;
    }

    const small = FR_SMALL_NUMBERS[word];
    if (small !== undefined) {
      current += small;
      matched = true;
      continue;
    }

    return null;
  }

  return matched ? total + current : null;
}

/** Remonte les mots-nombres qui précèdent « dollars » / « piastres ». */
function extractWordAmount(words: string[]): number | null {
  const currencyIndex = words.findIndex((word) =>
    ['dollar', 'dollars', 'piastre', 'piastres'].includes(word),
  );
  if (currencyIndex <= 0) return null;

  const numberWords: string[] = [];
  for (let index = currencyIndex - 1; index >= 0; index -= 1) {
    const word = words[index];
    const isNumberWord =
      word === 'et' ||
      word === 'cent' ||
      word === 'cents' ||
      word === 'mille' ||
      word === 'milles' ||
      FR_TENS[word] !== undefined ||
      FR_SMALL_NUMBERS[word] !== undefined;
    if (!isNumberWord) break;
    numberWords.unshift(word);
  }
  // « et » isolé n'est pas un nombre.
  while (numberWords[0] === 'et') numberWords.shift();
  if (numberWords.length === 0) return null;

  const dollars = frenchWordsToNumber(numberWords);
  if (dollars === null) return null;

  // Partie centimes : « … dollars et vingt-cinq cents ».
  const centsWords: string[] = [];
  for (let index = currencyIndex + 1; index < words.length; index += 1) {
    const word = words[index];
    if (word === 'cent' || word === 'cents') {
      // « cent » ici ferme la partie centimes seulement s'il suit des mots-nombres.
      if (centsWords.length === 0) break;
      const cents = frenchWordsToNumber(centsWords);
      return cents === null ? dollars : dollars + cents / 100;
    }
    const isNumberWord = word === 'et' || FR_TENS[word] !== undefined || FR_SMALL_NUMBERS[word] !== undefined;
    if (!isNumberWord) break;
    centsWords.push(word);
  }

  return dollars;
}

/** Nombres nus (« 50 de gas ») quand aucune devise n'est prononcée. */
const BARE_NUMBER_RE = /(?<![\w.,])(\d{1,3}(?:[ \u00A0]\d{3})*|\d+)(?:[.,](\d{1,2}))?(?![\w.,])/g;
/** Un nombre qui suit ces mots désigne une carte/compte, pas un montant. */
const ACCOUNT_NUMBER_CUE_RE = /(?:carte|compte|numero|no|termine|terminant|terminee|finissant|fini)\s*(?:par|en|:)?\s*$/;

function extractBareAmount(text: string): number | null {
  const candidates: number[] = [];
  for (const match of text.matchAll(BARE_NUMBER_RE)) {
    const before = text.slice(0, match.index ?? 0);
    if (ACCOUNT_NUMBER_CUE_RE.test(before)) continue;
    const value = toNumber(match[1], match[2]);
    if (!Number.isFinite(value) || value <= 0) continue;
    candidates.push(value);
  }
  return candidates.length === 1 ? candidates[0] : null;
}

function extractAmount(spendText: string, spendWords: string[]): number | null {
  const withCents = spendText.match(AMOUNT_WITH_CENTS_RE);
  if (withCents) {
    const value = toNumber(withCents[1], withCents[2]);
    if (Number.isFinite(value) && value > 0) return value;
  }

  for (const regex of [AMOUNT_SUFFIXED_RE, AMOUNT_PREFIXED_RE]) {
    const match = spendText.match(regex);
    if (!match) continue;
    const value = toNumber(match[1], match[2]);
    if (Number.isFinite(value) && value > 0) return value;
  }

  const wordAmount = extractWordAmount(spendWords);
  if (wordAmount !== null && wordAmount > 0) return wordAmount;

  return extractBareAmount(spendText);
}

// ---------------------------------------------------------------------------
// Type (dépense / revenu)
// ---------------------------------------------------------------------------

/**
 * Seul un tour de phrase « argent reçu » bascule en revenu ; tout le reste est une
 * dépense. Les motifs restent des expressions complètes : « un reçu de 50$ » (le
 * papier) ne doit pas être confondu avec « j'ai reçu 50$ ».
 */
const INCOME_PATTERNS: RegExp[] = [
  /\bj ai (?:recu|encaisse|touche)\b/,
  /\bon m a (?:paye|verse|donne|rembourse|envoye)\b/,
  /\bje me suis fait (?:payer|rembourser)\b/,
  // Passif = argent entrant (« j'ai été payé par »), à l'inverse de « j'ai payé par Interac ».
  /\bete (?:paye|payee|rembourse|remboursee|verse|versee)\b/,
  /\b(?:ma paie|mon salaire|salaire|paie de|depot de|virement recu|remboursement recu)\b/,
  /\b(?:recu|verse|rembourse|encaisse)\s+par\b/,
];

function detectType(words: string): SpokenTransactionType {
  return INCOME_PATTERNS.some((pattern) => pattern.test(words)) ? 'income' : 'expense';
}

// ---------------------------------------------------------------------------
// Compte / carte
// ---------------------------------------------------------------------------

const ACCOUNT_CUE_WORDS = [
  'carte',
  'compte',
  'visa',
  'mastercard',
  'amex',
  'interac',
  'comptant',
  'cash',
  'debit',
];

const ACCOUNT_CLAUSE_CONNECTORS = ['avec', 'sur', 'par', 'depuis', 'via', 'dans'];

const ACCOUNT_KIND_HINTS: { kind: AccountKind; patterns: RegExp[] }[] = [
  { kind: 'credit', patterns: [/\bcredit\b/, /\bvisa\b/, /\bmastercard\b/, /\bamex\b/, /\bamerican express\b/] },
  { kind: 'cash', patterns: [/\bcomptant\b/, /\bcash\b/, /\bargent comptant\b/, /\bliquide\b/] },
  { kind: 'savings', patterns: [/\bepargne\b/] },
  { kind: 'checking', patterns: [/\bcheque\b/, /\bcheques\b/, /\bdebit\b/, /\bcourant\b/] },
];

/**
 * Isole la portion « avec ma carte Visa Desjardins » : elle ne doit polluer ni le
 * marchand ni la catégorie (« Desjardins » n'est pas le commerce visité).
 */
function splitAccountClause(words: string): { spend: string; account: string } {
  const tokens = words.split(' ');
  const cueIndex = tokens.findIndex((token) => ACCOUNT_CUE_WORDS.includes(token));
  if (cueIndex < 0) return { spend: words, account: '' };

  let start = cueIndex;
  for (let index = cueIndex - 1; index >= 0 && cueIndex - index <= 3; index -= 1) {
    if (ACCOUNT_CLAUSE_CONNECTORS.includes(tokens[index])) {
      start = index;
      break;
    }
  }

  return {
    spend: tokens.slice(0, start).join(' ').trim(),
    account: tokens.slice(start).join(' ').trim(),
  };
}

function detectAccountKind(accountWords: string): AccountKind | null {
  for (const { kind, patterns } of ACCOUNT_KIND_HINTS) {
    if (patterns.some((pattern) => pattern.test(accountWords))) return kind;
  }
  return null;
}

const ACCOUNT_NAME_STOP_WORDS = new Set([
  'carte',
  'compte',
  'de',
  'du',
  'des',
  'la',
  'le',
  'les',
  'ma',
  'mon',
  'mes',
  'et',
]);

/** Identifiants du sélecteur manuel (`MANUAL_ENTRY_ACCOUNTS`) quand aucun compte n'est enregistré. */
const MANUAL_ACCOUNT_ID_BY_KIND: Partial<Record<AccountKind, string>> = {
  checking: 'checking',
  credit: 'credit',
  savings: 'savings',
};

const ACCOUNT_MATCH_MIN_SCORE = 5;

function resolveAccount(
  accountWords: string,
  accounts: readonly SimulatedAccount[],
): { accountId: string | null; accountLabel: string | null } {
  if (!accountWords) return { accountId: null, accountLabel: null };

  const kindHint = detectAccountKind(accountWords);
  const digits: string[] = accountWords.match(/\b\d{4}\b/g) ?? [];

  let best: { account: SimulatedAccount; score: number } | null = null;

  for (const account of accounts) {
    if (account.hidden) continue;
    let score = 0;

    const name = normalizeWords(account.name);
    if (name && containsPhrase(accountWords, name)) {
      score += 10;
    } else {
      for (const token of new Set(name.split(' '))) {
        if (token.length < 3 || ACCOUNT_NAME_STOP_WORDS.has(token)) continue;
        if (containsPhrase(accountWords, token)) score += 4;
      }
    }

    const institution = normalizeWords(account.institution ?? '');
    if (institution && containsPhrase(accountWords, institution)) score += 5;

    if (account.last4 && digits.includes(account.last4)) score += 8;
    if (kindHint && account.kind === kindHint) score += 3;

    if (score > (best?.score ?? 0)) best = { account, score };
  }

  if (best && best.score >= ACCOUNT_MATCH_MIN_SCORE) {
    return { accountId: best.account.id, accountLabel: best.account.name };
  }

  // Aucun compte enregistré : retomber sur le sélecteur manuel du formulaire.
  if (accounts.length === 0 && kindHint) {
    const manualId = MANUAL_ACCOUNT_ID_BY_KIND[kindHint];
    if (manualId) return { accountId: manualId, accountLabel: null };
  }

  return { accountId: null, accountLabel: null };
}

// ---------------------------------------------------------------------------
// Marchand
// ---------------------------------------------------------------------------

/** Par ordre de fiabilité : « chez X » désigne un commerce, « à X » beaucoup moins. */
const MERCHANT_PREPOSITIONS = ['chez', 'au', 'aux', 'dans', 'a'];

/** Articles sautés entre la préposition et le nom (« à la pharmacie »). */
const MERCHANT_ARTICLES = new Set(['la', 'le', 'les', 'l', 'de', 'du', 'des', 'd']);

const MERCHANT_STOP_WORDS = new Set([
  'avec',
  'sur',
  'pour',
  'par',
  'et',
  'puis',
  'en',
  'de',
  'du',
  'des',
  'la',
  'le',
  'les',
  'ma',
  'mon',
  'mes',
  'ce',
  'cet',
  'cette',
  'hier',
  'aujourd',
  'hui',
  'matin',
  'soir',
  'midi',
  'tantot',
  'je',
  'j',
  'ai',
  'ca',
  'il',
  'elle',
  'on',
]);

/** Le catalogue l'emporte : rend le libellé canonique (« Petro-Canada »). */
function matchKnownMerchant(spendWords: string, merchants: readonly string[]): string | null {
  const spendCompact = compact(spendWords);
  let best: { label: string; weight: number } | null = null;

  for (const merchant of merchants) {
    const normalized = normalizeWords(merchant);
    if (normalized.length < 2) continue;

    let matches = containsPhrase(spendWords, normalized);
    if (!matches) {
      const merchantCompact = compact(merchant);
      matches = merchantCompact.length >= 6 && spendCompact.includes(merchantCompact);
    }
    if (!matches) continue;

    // Le libellé le plus long gagne (« Super C » plutôt que « C »).
    const weight = normalized.length;
    if (weight > (best?.weight ?? 0)) best = { label: merchant.trim(), weight };
  }

  return best?.label ?? null;
}

function titleCase(words: string): string {
  return words
    .split(' ')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/** Repli : « chez <mots> » pour un commerce absent du catalogue. */
function extractMerchantAfterPreposition(spendWords: string): string | null {
  const tokens = spendWords.split(' ').filter(Boolean);

  for (const preposition of MERCHANT_PREPOSITIONS) {
    const start = tokens.indexOf(preposition);
    if (start < 0) continue;

    let index = start + 1;
    while (index < tokens.length && MERCHANT_ARTICLES.has(tokens[index])) index += 1;

    const captured: string[] = [];
    for (; index < tokens.length && captured.length < 4; index += 1) {
      const token = tokens[index];
      if (MERCHANT_STOP_WORDS.has(token)) break;
      if (/^\d+$/.test(token)) break;
      captured.push(token);
    }

    if (captured.length > 0) return titleCase(captured.join(' '));
  }

  return null;
}

// ---------------------------------------------------------------------------
// Entrée publique
// ---------------------------------------------------------------------------

export function parseSpokenTransaction(
  transcript: string,
  context: SpokenTransactionContext = {},
): ParsedSpokenTransaction {
  const trimmed = transcript.trim();
  if (!trimmed) return { transcript: '', ...EMPTY_RESULT };

  const asciiText = toAsciiLower(trimmed);
  const allWords = normalizeWords(trimmed);

  const { spend: spendWords, account: accountWords } = splitAccountClause(allWords);
  // Texte « dépense » avec la ponctuation/le `$` conservés, tronqué avant la clause compte.
  const spendText = accountWords ? asciiText.slice(0, findSpendCutoff(asciiText, spendWords)) : asciiText;

  const type = detectType(allWords);
  const amount = extractAmount(spendText, spendWords.split(' ').filter(Boolean));

  const merchant =
    matchKnownMerchant(spendWords, context.merchants ?? []) ??
    extractMerchantAfterPreposition(spendWords);

  const categories = context.categories ?? [];
  const categoryId =
    type === 'income' || categories.length === 0
      ? null
      : inferCategoryId([merchant ?? '', spendWords].join(' ').trim(), [...categories], null);

  const { accountId, accountLabel } = resolveAccount(accountWords, context.accounts ?? []);

  const missing: SpokenTransactionField[] = [];
  if (amount === null) missing.push('amount');
  if (!merchant) missing.push('merchant');
  if (type === 'expense' && !categoryId) missing.push('category');
  if (!accountId) missing.push('account');

  return { transcript: trimmed, type, amount, merchant, categoryId, accountId, accountLabel, missing };
}

/**
 * Position, dans le texte d'origine, où s'arrête la partie « dépense ».
 * On compte les mots car `asciiText` garde la ponctuation que `spendWords` a perdue.
 */
function findSpendCutoff(asciiText: string, spendWords: string): number {
  const wordCount = spendWords ? spendWords.split(' ').length : 0;
  if (wordCount === 0) return 0;

  const wordPattern = /[\p{L}\p{N}]+/gu;
  let seen = 0;
  for (const match of asciiText.matchAll(wordPattern)) {
    seen += 1;
    if (seen !== wordCount) continue;
    const cutoff = (match.index ?? 0) + match[0].length;
    // Garder un « $ » collé au dernier mot (« … 45 $ avec ma carte »).
    const trailingCurrency = asciiText.slice(cutoff).match(/^\s*\$/);
    return cutoff + (trailingCurrency?.[0].length ?? 0);
  }
  return asciiText.length;
}
