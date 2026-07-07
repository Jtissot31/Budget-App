import { parseAccountIdFromNote } from '@/lib/accountTransactionFlow';
import type { AgendaBill, RecurringPayment, Transaction } from '@/types';

/** Transaction must fall on or after the due date (subscriptions may post slightly late). */
const MATCH_WINDOW_BEFORE_DAYS = 0;
const MATCH_WINDOW_AFTER_DAYS = 5;
const AMOUNT_TOLERANCE_RATIO = 0.15;
const AMOUNT_TOLERANCE_MIN = 0.5;

function normalizeText(value?: string | null) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function parseIsoDay(value?: string | null) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}

function dateKeyFromDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getLocalDayKey(value: string) {
  const dayOnly = /^(\d{4}-\d{2}-\d{2})$/.exec(value.trim());
  if (dayOnly) return dayOnly[1];

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return dateKeyFromDate(parsed);

  const isoDay = parseIsoDay(value.slice(0, 10));
  return isoDay ? dateKeyFromDate(isoDay) : null;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function amountsMatch(expected: number, actual: number) {
  const expectedAbs = Math.abs(expected);
  const actualAbs = Math.abs(actual);
  const tolerance = Math.max(AMOUNT_TOLERANCE_MIN, expectedAbs * AMOUNT_TOLERANCE_RATIO);
  return Math.abs(expectedAbs - actualAbs) <= tolerance;
}

function merchantNamesMatch(billName: string, transactionLabel: string) {
  const bill = normalizeText(billName);
  const label = normalizeText(transactionLabel);
  if (!bill || !label) return false;
  if (bill === label) return true;
  return label.includes(bill) || bill.includes(label);
}

function accountsMatch(billAccountId: string | undefined, transaction: Transaction) {
  if (!billAccountId?.trim()) return true;
  const txAccountId = parseAccountIdFromNote(transaction.note);
  if (!txAccountId) return true;
  return txAccountId.trim() === billAccountId.trim();
}

/**
 * True when an expense transaction matches a recurring bill occurrence:
 * same merchant label, amount within tolerance, due-date window, and account when known.
 */
export function hasMatchingRecurringPaymentTransaction(
  bill: AgendaBill,
  occurrenceDateKey: string,
  transactions: Transaction[],
  recurringPayment?: RecurringPayment | null,
): boolean {
  if ((bill.kind ?? 'payment') === 'income') return false;

  const center = parseIsoDay(occurrenceDateKey);
  if (!center) return false;

  const windowStart = addDays(center, -MATCH_WINDOW_BEFORE_DAYS);
  const windowEnd = addDays(center, MATCH_WINDOW_AFTER_DAYS);
  const accountId = recurringPayment?.accountId;

  return transactions.some((transaction) => {
    if (transaction.type !== 'expense' || transaction.amount <= 0) return false;
    if (!merchantNamesMatch(bill.name, transaction.label)) return false;
    if (!amountsMatch(bill.amount, transaction.amount)) return false;
    if (!accountsMatch(accountId, transaction)) return false;

    const key = getLocalDayKey(transaction.date);
    const txDay = key ? parseIsoDay(key) : null;
    if (!txDay) return false;
    return txDay >= windowStart && txDay <= windowEnd;
  });
}
