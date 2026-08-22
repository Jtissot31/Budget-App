/**
 * Documents library — reçus (from transactions), contrats & talons de paie (local store).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { insertTransaction } from '@/lib/db';
import {
  normalizeMerchantKey,
  resolveCanonicalMerchantOriginalName,
} from '@/lib/merchantLogo';
import type { Transaction } from '@/types';

export type DocumentKind = 'receipt' | 'contract' | 'paystub';

export type LibraryDocument = {
  id: string;
  kind: Exclude<DocumentKind, 'receipt'>;
  title: string;
  /** ISO date string */
  date: string;
  note?: string | null;
  /** Optional local file / photo URI */
  uri?: string | null;
  /** Optional link back to a transaction */
  transactionId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReceiptLibraryItem = {
  id: string;
  kind: 'receipt';
  title: string;
  date: string;
  amount: number;
  transactionId: string;
  receiptUri?: string | null;
  receiptStatus?: Transaction['receiptStatus'];
  transaction: Transaction;
};

/** Merchant with ≥1 transaction that has a registered receipt (Documents → Reçus). */
export type ReceiptMerchantGroup = {
  id: string;
  kind: 'receipt_merchant';
  merchantKey: string;
  merchantLabel: string;
  receiptCount: number;
  latestDate: string;
  latestAmount: number;
  latestTransactionId: string;
  latestTransaction: Transaction;
};

/** True when the transaction has an attached / pending receipt on file. */
export function transactionHasRegisteredReceipt(
  tx: Pick<Transaction, 'receiptUri' | 'receiptStatus'>,
): boolean {
  return Boolean(tx.receiptUri?.trim() || tx.receiptStatus);
}

const STORAGE_KEY = '@budget_tracker/documents_library_v1';

function newId(): string {
  return `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function readStored(): Promise<LibraryDocument[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is LibraryDocument =>
        Boolean(
          item &&
            typeof item === 'object' &&
            typeof (item as LibraryDocument).id === 'string' &&
            ((item as LibraryDocument).kind === 'contract' ||
              (item as LibraryDocument).kind === 'paystub') &&
            typeof (item as LibraryDocument).title === 'string',
        ),
    );
  } catch {
    return [];
  }
}

async function writeStored(docs: LibraryDocument[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
}

export async function getLibraryDocuments(
  kind?: Exclude<DocumentKind, 'receipt'>,
): Promise<LibraryDocument[]> {
  const docs = await readStored();
  const filtered = kind ? docs.filter((d) => d.kind === kind) : docs;
  return filtered.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export async function addLibraryDocument(input: {
  kind: Exclude<DocumentKind, 'receipt'>;
  title: string;
  date?: string;
  note?: string | null;
  uri?: string | null;
  transactionId?: string | null;
}): Promise<LibraryDocument> {
  const now = new Date().toISOString();
  const title = input.title.trim() || (input.kind === 'contract' ? 'Contrat' : 'Talon de paie');
  const doc: LibraryDocument = {
    id: newId(),
    kind: input.kind,
    title,
    date: input.date?.trim() || now,
    note: input.note?.trim() || null,
    uri: input.uri?.trim() || null,
    transactionId: input.transactionId?.trim() || null,
    createdAt: now,
    updatedAt: now,
  };
  const docs = await readStored();
  docs.unshift(doc);
  await writeStored(docs);
  return doc;
}

export async function removeLibraryDocument(id: string): Promise<void> {
  const trimmed = id.trim();
  if (!trimmed) return;
  const docs = await readStored();
  await writeStored(docs.filter((d) => d.id !== trimmed));
}

/** Transactions that already have an attached / pending receipt. */
export function collectReceiptLibraryItems(
  transactions: readonly Transaction[],
): ReceiptLibraryItem[] {
  return transactions
    .filter((tx) => transactionHasRegisteredReceipt(tx))
    .map((tx) => ({
      id: `receipt_${tx.id}`,
      kind: 'receipt' as const,
      title: tx.label,
      date: tx.date,
      amount: tx.amount,
      transactionId: tx.id,
      receiptUri: tx.receiptUri,
      receiptStatus: tx.receiptStatus,
      transaction: tx,
    }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/**
 * Merchants that have at least one registered receipt.
 * Merchants with transactions but no receipt are omitted.
 */
export function collectReceiptMerchantGroups(
  transactions: readonly Transaction[],
): ReceiptMerchantGroup[] {
  const receiptItems = collectReceiptLibraryItems(transactions);
  const byKey = new Map<string, ReceiptLibraryItem[]>();

  for (const item of receiptItems) {
    const key = normalizeMerchantKey(item.title);
    if (!key) continue;
    const bucket = byKey.get(key);
    if (bucket) bucket.push(item);
    else byKey.set(key, [item]);
  }

  const groups: ReceiptMerchantGroup[] = [];
  for (const [merchantKey, items] of byKey) {
    const sorted = items
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const latest = sorted[0];
    if (!latest) continue;

    const merchantLabel = resolveCanonicalMerchantOriginalName(
      latest.title,
      sorted.map((item) => item.title),
    );

    groups.push({
      id: `receipt_merchant_${merchantKey}`,
      kind: 'receipt_merchant',
      merchantKey,
      merchantLabel,
      receiptCount: sorted.length,
      latestDate: latest.date,
      latestAmount: latest.amount,
      latestTransactionId: latest.transactionId,
      latestTransaction: latest.transaction,
    });
  }

  return groups.sort((a, b) =>
    a.latestDate < b.latestDate ? 1 : a.latestDate > b.latestDate ? -1 : 0,
  );
}

export function isPreviewableDocumentUri(uri?: string | null): boolean {
  return Boolean(uri && !uri.startsWith('scan://'));
}

/** Accent- and case-insensitive so « Recu » matches « Reçu ». */
function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase();
}

/** Documents library search — contract / paystub title and note. */
export function libraryDocumentMatchesSearch(doc: LibraryDocument, search: string): boolean {
  const query = normalizeSearchText(search);
  if (!query) return true;
  return (
    normalizeSearchText(doc.title).includes(query) ||
    normalizeSearchText(doc.note ?? '').includes(query)
  );
}

/** Documents library search — merchant name of a receipt group. */
export function receiptMerchantMatchesSearch(
  group: ReceiptMerchantGroup,
  search: string,
): boolean {
  const query = normalizeSearchText(search);
  if (!query) return true;
  return normalizeSearchText(group.merchantLabel).includes(query);
}

/** Attach (or replace) a receipt image on an existing transaction. */
export async function attachReceiptToTransaction(
  transaction: Transaction,
  receiptUri: string,
): Promise<void> {
  const uri = receiptUri.trim();
  if (!uri) return;
  await insertTransaction({
    id: transaction.id,
    label: transaction.label,
    amount: transaction.amount,
    type: transaction.type,
    date: transaction.date,
    categoryId: transaction.categoryId,
    transactionIcon: transaction.transactionIcon,
    receiptUri: uri,
    receiptStatus: 'attached',
    note: transaction.note,
    wealthAssetId: transaction.wealthAssetId,
    savingsGoalId: transaction.savingsGoalId,
    syncStatus: 'pending',
  });
}

/** Expenses eligible for attaching a receipt from the library (recent first). */
export function collectReceiptAttachCandidates(
  transactions: readonly Transaction[],
  limit = 60,
): Transaction[] {
  return transactions
    .filter((tx) => tx.type === 'expense')
    .slice()
    .sort((a, b) => {
      const aHas = transactionHasRegisteredReceipt(a);
      const bHas = transactionHasRegisteredReceipt(b);
      if (aHas !== bHas) return aHas ? 1 : -1;
      return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
    })
    .slice(0, limit);
}
