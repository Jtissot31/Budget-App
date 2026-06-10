import { normalizeSearch } from '@/lib/categoryInference';

import {
  isContactIncomeTx,
  isContactTransferTx,
  parseContactIdFromNote,
  resolveContactNameFromTransaction,
} from '@/lib/accountTransactionFlow';

import type { Contact, Transaction } from '@/types';

export type ContactDirectoryRow = {
  key: string;
  name: string;
  isEmployer?: boolean;
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
      upsertContactRow(map, contactName, tx.amount, tx.date);
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

export function findContactByName(contacts: Contact[], name: string): Contact | null {
  const normalized = normalizeSearch(name);
  if (!normalized) return null;
  return (
    contacts.find((contact) => (contact.normalizedName || normalizeSearch(contact.name)) === normalized) ??
    null
  );
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
