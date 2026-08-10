/**
 * Expand active recurring payments into date-keyed bills for a calendar range.
 * Shared by Proto Agenda (not tied to legacy AgendaView chrome).
 */
import type { AgendaBill, RecurringPayment } from '@/types';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function dateKeyFromParts(y: number, m0: number, d: number) {
  return `${y}-${pad(m0 + 1)}-${pad(d)}`;
}

export function dateKeyFromDate(date: Date) {
  return dateKeyFromParts(date.getFullYear(), date.getMonth(), date.getDate());
}

export function parseIsoDay(value?: string | null): Date | null {
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

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addMonthsClamped(date: Date, months: number) {
  const day = date.getDate();
  const next = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const dim = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, dim));
  next.setHours(0, 0, 0, 0);
  return next;
}

function occurrenceDateAt(firstDate: Date, frequency: RecurringPayment['frequency'], index: number) {
  if (frequency === 'weekly') return addDays(firstDate, index * 7);
  if (frequency === 'biweekly') return addDays(firstDate, index * 14);
  if (frequency === 'yearly') return addMonthsClamped(firstDate, index * 12);
  return addMonthsClamped(firstDate, index);
}

export function toProtoAgendaBill(payment: RecurringPayment): AgendaBill {
  return {
    name: payment.name,
    amount: payment.amount,
    account: payment.accountLabel,
    recurring: true,
    kind: payment.kind === 'income' ? 'income' : 'payment',
    sourceId: payment.id,
    icon: payment.icon,
    color: payment.color,
    logoUrl: payment.logoUrl ?? null,
    categoryName: payment.categoryName ?? null,
    categoryId: payment.categoryId ?? null,
  };
}

function hasSameBill(items: AgendaBill[], bill: AgendaBill) {
  return items.some((item) => {
    if (bill.sourceId && item.sourceId === bill.sourceId) return true;
    return (
      item.name === bill.name &&
      item.amount === bill.amount &&
      item.account === bill.account &&
      (item.kind ?? 'payment') === (bill.kind ?? 'payment')
    );
  });
}

/** Expand active recurring payments into YYYY-MM-DD → bills for [rangeStart, rangeEnd]. */
export function buildRecurringBillsByDate(
  payments: readonly RecurringPayment[],
  rangeStart: Date,
  rangeEnd: Date,
): Record<string, AgendaBill[]> {
  const billsByDate: Record<string, AgendaBill[]> = {};
  const start = new Date(rangeStart);
  start.setHours(0, 0, 0, 0);
  const end = new Date(rangeEnd);
  end.setHours(0, 0, 0, 0);

  for (const payment of payments) {
    if (!payment.active) continue;
    const firstDate = parseIsoDay(payment.nextDate);
    if (!firstDate) continue;

    const endDate = parseIsoDay(payment.endDate);
    const effectiveEnd = endDate && endDate < end ? endDate : end;
    if (effectiveEnd < start || firstDate > effectiveEnd) continue;

    let occurrenceIndex = 0;
    let occurrence = occurrenceDateAt(firstDate, payment.frequency, occurrenceIndex);
    while (occurrence <= effectiveEnd && occurrenceIndex < 1200) {
      if (occurrence >= start) {
        const key = dateKeyFromDate(occurrence);
        const bill = toProtoAgendaBill(payment);
        const existing = billsByDate[key] ?? [];
        if (!hasSameBill(existing, bill)) existing.push(bill);
        billsByDate[key] = existing;
      }
      occurrenceIndex += 1;
      occurrence = occurrenceDateAt(firstDate, payment.frequency, occurrenceIndex);
    }
  }

  return billsByDate;
}

export function sumMonthCashflow(billsByDate: Record<string, AgendaBill[]>) {
  let expenses = 0;
  let income = 0;
  for (const bills of Object.values(billsByDate)) {
    for (const bill of bills) {
      if ((bill.kind ?? 'payment') === 'income') income += Math.abs(bill.amount);
      else expenses += Math.abs(bill.amount);
    }
  }
  return { expenses, income };
}

export type ProtoDayMarkers = { hasExpense: boolean; hasIncome: boolean };

export function markersForDay(
  dateKey: string,
  billsByDate: Record<string, AgendaBill[]>,
): ProtoDayMarkers {
  const bills = billsByDate[dateKey] ?? [];
  let hasExpense = false;
  let hasIncome = false;
  for (const bill of bills) {
    if ((bill.kind ?? 'payment') === 'income') hasIncome = true;
    else hasExpense = true;
  }
  return { hasExpense, hasIncome };
}

export type ProtoTimelineEntry = {
  dateKey: string;
  day: number;
  monthShort: string;
  paid: boolean;
  bills: AgendaBill[];
};

export function buildMonthTimeline(
  billsByDate: Record<string, AgendaBill[]>,
  todayKey: string,
  year: number,
  month0: number,
): ProtoTimelineEntry[] {
  const keys = Object.keys(billsByDate).sort();
  const monthPrefix = `${year}-${pad(month0 + 1)}`;
  /** Compact FR labels so day + month fit in the 46px timeline marker. */
  const monthNames = [
    'janv',
    'févr',
    'mars',
    'avr',
    'mai',
    'juin',
    'juil',
    'août',
    'sept',
    'oct',
    'nov',
    'déc',
  ];

  return keys
    .filter((key) => key.startsWith(monthPrefix))
    .map((dateKey) => {
      const day = Number(dateKey.slice(8, 10));
      const paid = dateKey < todayKey;
      return {
        dateKey,
        day,
        monthShort: monthNames[month0] ?? 'mois',
        paid,
        bills: billsByDate[dateKey] ?? [],
      };
    })
    .filter((entry) => entry.bills.length > 0);
}
