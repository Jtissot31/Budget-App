import { normalizeSearch } from '@/lib/categoryInference';

import {
  isContactIncomeTx,
  isContactTransferTx,
  parseAccountIdFromNote,
  parseContactIdFromNote,
  parseRaisonFromNote,
  resolveContactNameFromTransaction,
} from '@/lib/accountTransactionFlow';

import type { Contact, Transaction } from '@/types';

export type ContactDirectoryRow = {
  key: string;
  name: string;
  isEmployer?: boolean;
  photoUri?: string | null;
  count: number;
  total: number;
  lastTransfer: string | null;
};

function upsertContactRow(
  map: Map<string, ContactDirectoryRow>,
  name: string,
  amount: number,
  date: string,
  isEmployer = false,
) {
  const trimmed = name.trim();
  if (!trimmed) return;

  const key = normalizeSearch(trimmed);
  const cur = map.get(key) ?? {
    key,
    name: trimmed,
    isEmployer,
    count: 0,
    total: 0,
    lastTransfer: null,
  };
  if (isEmployer) cur.isEmployer = true;
  cur.count += 1;
  cur.total += amount;
  if (!cur.lastTransfer || date > cur.lastTransfer) {
    cur.lastTransfer = date;
  }
  map.set(key, cur);
}

export function buildContactDirectoryRows(
  transactions: Transaction[],
  savedContacts: Contact[] = [],
): ContactDirectoryRow[] {
  const map = new Map<string, ContactDirectoryRow>();

  for (const contact of savedContacts) {
    const key = contact.normalizedName || normalizeSearch(contact.name);
    if (!key) continue;
    map.set(key, {
      key,
      name: contact.name.trim(),
      isEmployer: contact.isEmployer === true,
      photoUri: contact.photoUri?.trim() || null,
      count: 0,
      total: 0,
      lastTransfer: null,
    });
  }

  for (const tx of transactions) {
    if (isContactTransferTx(tx)) {
      const contactName = resolveContactNameFromTransaction(tx);
      if (!contactName) continue;
      upsertContactRow(map, contactName, tx.amount, tx.date);
      continue;
    }

    if (isContactIncomeTx(tx)) {
      const contactName = resolveContactNameFromTransaction(tx);
      if (!contactName) continue;
      upsertContactRow(map, contactName, tx.amount, tx.date, true);
    }
  }

  return [...map.values()].sort(
    (a, b) => b.total - a.total || b.count - a.count || a.name.localeCompare(b.name, 'fr'),
  );
}

export function getContactTransactions(transactions: Transaction[], contactKey: string): Transaction[] {
  const normalizedKey = normalizeSearch(contactKey);

  return transactions.filter((tx) => {
    if (!isContactTransferTx(tx) && !isContactIncomeTx(tx)) return false;
    const contactName = resolveContactNameFromTransaction(tx);
    return contactName ? normalizeSearch(contactName) === normalizedKey : false;
  });
}

/** Most recent non-empty income reason recorded for a contact/employer. */
export function getLastIncomeReasonForContact(
  transactions: Transaction[],
  contactName: string,
): string | null {
  const incomeTxs = getContactTransactions(transactions, contactName)
    .filter(isContactIncomeTx)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  for (const tx of incomeTxs) {
    const reason = parseRaisonFromNote(tx.note);
    if (reason?.trim()) return reason.trim();
  }

  return null;
}

/** Most recent deposit account used for income from a contact/employer. */
export function getLastIncomeAccountForContact(
  transactions: Transaction[],
  contactName: string,
): string | null {
  const incomeTxs = getContactTransactions(transactions, contactName)
    .filter(isContactIncomeTx)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  for (const tx of incomeTxs) {
    const accountId = parseAccountIdFromNote(tx.note);
    if (accountId?.trim()) return accountId.trim();
  }

  return null;
}

export function findContactByName(contacts: Contact[], name: string): Contact | null {
  const normalized = normalizeSearch(name);
  if (!normalized) return null;
  return (
    contacts.find((contact) => (contact.normalizedName || normalizeSearch(contact.name)) === normalized) ??
    null
  );
}

const FUZZY_MAX_DISTANCE_RATIO = 0.34;
const MIN_FUZZY_QUERY_LENGTH = 2;

function compactNormalized(input: string): string {
  return normalizeSearch(input).replace(/\s+/g, '');
}

/** Accent-insensitive edit distance for typo-tolerant contact matching. */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = new Array<number>(cols);
  for (let j = 0; j < cols; j += 1) matrix[j] = j;

  for (let i = 1; i < rows; i += 1) {
    let prev = i;
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const next = Math.min(matrix[j] + 1, prev + 1, matrix[j - 1] + cost);
      matrix[j - 1] = prev;
      prev = next;
    }
    matrix[cols - 1] = prev;
  }

  return matrix[cols - 1] ?? 0;
}

/** Higher score = better match. Null = no match. */
export function fuzzyContactMatchScore(query: string, candidate: string): number | null {
  const needle = normalizeSearch(query);
  const haystack = normalizeSearch(candidate);
  if (!needle || !haystack) return null;

  if (haystack === needle) return 100;
  if (haystack.startsWith(needle)) return 90 + Math.min(needle.length, 9);
  if (haystack.includes(needle)) return 80 + Math.min(needle.length, 9);

  const compactNeedle = compactNormalized(query);
  const compactHaystack = compactNormalized(candidate);
  if (!compactNeedle || !compactHaystack) return null;

  if (compactHaystack === compactNeedle) return 95;
  if (compactHaystack.startsWith(compactNeedle)) return 88;
  if (compactHaystack.includes(compactNeedle)) return 78;

  if (compactNeedle.length < MIN_FUZZY_QUERY_LENGTH) return null;

  const maxDistance = Math.max(1, Math.floor(compactNeedle.length * FUZZY_MAX_DISTANCE_RATIO));
  const distance = levenshteinDistance(compactNeedle, compactHaystack);
  if (distance <= maxDistance) return 70 - distance;

  const needleTokens = needle.split(' ').filter(Boolean);
  const haystackTokens = haystack.split(' ').filter(Boolean);
  if (needleTokens.length > 1 && haystackTokens.length > 0) {
    let tokenScore = 0;
    let matchedTokens = 0;
    for (const token of needleTokens) {
      if (token.length < MIN_FUZZY_QUERY_LENGTH) continue;
      let best = -1;
      for (const haystackToken of haystackTokens) {
        const score = fuzzyContactMatchScore(token, haystackToken);
        if (score !== null) best = Math.max(best, score);
      }
      if (best >= 0) {
        tokenScore += best;
        matchedTokens += 1;
      }
    }
    if (matchedTokens > 0) {
      const average = tokenScore / matchedTokens;
      if (average >= 65) return Math.min(76, average);
    }
  }

  return null;
}

type ContactCandidate = {
  key: string;
  name: string;
  isEmployer: boolean;
  sortWeight: number;
};

function collectContactCandidates(
  contacts: Contact[],
  directoryRows: ContactDirectoryRow[],
): ContactCandidate[] {
  const map = new Map<string, ContactCandidate>();

  const upsert = (name: string, isEmployer: boolean, sortWeight: number) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const key = normalizeSearch(trimmed);
    if (!key) return;

    const existing = map.get(key);
    if (existing) {
      existing.isEmployer = existing.isEmployer || isEmployer;
      existing.sortWeight = Math.max(existing.sortWeight, sortWeight);
      return;
    }

    map.set(key, { key, name: trimmed, isEmployer, sortWeight });
  };

  for (const contact of contacts) {
    upsert(contact.name, contact.isEmployer === true, contact.isEmployer ? 100 : 10);
  }

  for (const row of directoryRows) {
    const weight = row.count * 10 + row.total;
    upsert(row.name, row.isEmployer === true, weight);
  }

  return [...map.values()];
}

function rankContactCandidatesByQuery(candidates: ContactCandidate[], query: string) {
  return candidates
    .map((candidate) => ({
      name: candidate.name,
      score: fuzzyContactMatchScore(query, candidate.name) ?? -1,
      isEmployer: candidate.isEmployer,
      sortWeight: candidate.sortWeight,
    }))
    .filter((item) => item.score >= 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.isEmployer) - Number(a.isEmployer) ||
        b.sortWeight - a.sortWeight ||
        a.name.localeCompare(b.name, 'fr'),
    );
}

/** Past income sources and flagged contacts, for empty-field employer chips. */
export function getIncomeEmployerSuggestions(
  contacts: Contact[],
  directoryRows: ContactDirectoryRow[] = [],
  limit = 8,
): string[] {
  return collectContactCandidates(contacts, directoryRows)
    .filter((candidate) => candidate.isEmployer)
    .sort(
      (a, b) =>
        b.sortWeight - a.sortWeight || a.name.localeCompare(b.name, 'fr'),
    )
    .slice(0, limit)
    .map((candidate) => candidate.name);
}

/**
 * Income source autocomplete: employers while the query still matches one;
 * otherwise fuzzy-match other contacts.
 */
export function searchIncomeSourceSuggestions(
  contacts: Contact[],
  query: string,
  directoryRows: ContactDirectoryRow[] = [],
  limit = 5,
): string[] {
  const trimmed = query.trim();
  if (!trimmed) return getIncomeEmployerSuggestions(contacts, directoryRows, limit);

  const ranked = rankContactCandidatesByQuery(collectContactCandidates(contacts, directoryRows), trimmed);
  const employerMatches = ranked.filter((item) => item.isEmployer);
  if (employerMatches.length > 0) {
    return employerMatches.slice(0, limit).map((item) => item.name);
  }

  return ranked.slice(0, limit).map((item) => item.name);
}

export function isRegisteredEmployerName(
  contacts: Contact[],
  name: string,
  directoryRows: ContactDirectoryRow[] = [],
): boolean {
  const needle = normalizeSearch(name);
  if (!needle) return false;

  return collectContactCandidates(contacts, directoryRows).some(
    (candidate) => candidate.key === needle && candidate.isEmployer,
  );
}

export function resemblesExistingContact(
  contacts: Contact[],
  name: string,
  directoryRows: ContactDirectoryRow[] = [],
): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;

  const needle = normalizeSearch(trimmed);
  if (!needle) return false;

  for (const candidate of collectContactCandidates(contacts, directoryRows)) {
    if (candidate.key === needle) return true;
    if (fuzzyContactMatchScore(trimmed, candidate.name) !== null) return true;
  }

  return false;
}

export function searchContactSuggestions(
  contacts: Contact[],
  query: string,
  limit = 5,
  directoryRows: ContactDirectoryRow[] = [],
  options?: { employersFirst?: boolean },
): string[] {
  const needle = normalizeSearch(query);
  const employersFirst = options?.employersFirst === true;
  const seen = new Set<string>();
  const results: string[] = [];

  const consider = (name: string, normalizedKey?: string, isEmployer = false) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const normalized = normalizedKey || normalizeSearch(trimmed);
    if (!normalized || seen.has(normalized)) return;
    if (needle && normalized !== needle && !normalized.startsWith(needle) && !normalized.includes(needle)) {
      return;
    }

    seen.add(normalized);
    results.push(trimmed);
    if (isEmployer) {
      // Keep employer ordering stable by re-sorting later when needed.
    }
  };

  if (employersFirst) {
    for (const contact of contacts) {
      if (!contact.isEmployer) continue;
      consider(contact.name, contact.normalizedName || normalizeSearch(contact.name), true);
    }
    for (const row of directoryRows) {
      if (!row.isEmployer) continue;
      consider(row.name, row.key, true);
    }
  }

  for (const row of directoryRows) {
    consider(row.name, row.key, row.isEmployer === true);
  }

  for (const contact of contacts) {
    consider(contact.name, contact.normalizedName || normalizeSearch(contact.name), contact.isEmployer === true);
  }

  if (employersFirst && !needle) {
    const employerNames = new Set(
      contacts.filter((contact) => contact.isEmployer).map((contact) => contact.name.trim()),
    );
    return [
      ...results.filter((name) => employerNames.has(name)),
      ...results.filter((name) => !employerNames.has(name)),
    ].slice(0, limit);
  }

  return results.slice(0, limit);
}

export function resolveContactIdForName(contacts: Contact[], name: string): string | null {
  return findContactByName(contacts, name)?.id ?? null;
}

/** Known employers and past income sources, for quick selection on income entry. */
export function getEmployerQuickSelect(
  contacts: Contact[],
  directoryRows: ContactDirectoryRow[] = [],
  limit = 8,
): string[] {
  return getIncomeEmployerSuggestions(contacts, directoryRows, limit);
}

export function resolveContactIdFromTransaction(
  tx: Pick<Transaction, 'note'>,
  contacts: Contact[] = [],
): string | null {
  const explicitId = parseContactIdFromNote(tx.note);
  if (explicitId) return explicitId;
  const contactName = resolveContactNameFromTransaction(tx);
  if (!contactName) return null;
  return resolveContactIdForName(contacts, contactName);
}

export function buildContactPhotoUriByKey(contacts: readonly Contact[]): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const contact of contacts) {
    const photoUri = contact.photoUri?.trim();
    if (!photoUri) continue;
    const key = contact.normalizedName || normalizeSearch(contact.name);
    if (key) map.set(key, photoUri);
  }
  return map;
}

export function resolveContactPhotoUriForTransaction(
  tx: Pick<Transaction, 'label' | 'note' | 'type'>,
  photoByKey: ReadonlyMap<string, string>,
): string | null {
  if (!isContactTransferTx(tx) && !isContactIncomeTx(tx)) return null;
  const contactName = resolveContactNameFromTransaction(tx);
  if (!contactName) return null;
  const key = normalizeSearch(contactName);
  return key ? (photoByKey.get(key) ?? null) : null;
}
