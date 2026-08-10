/**
 * Month occurrence expansion for Budget Proto Agenda (no AgendaView dependency).
 */
import type { AgendaBill, RecurringPayment } from '@/types';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function protoAgendaDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function protoAgendaTodayKey(now = new Date()) {
  const t = new Date(now);
  t.setHours(0, 0, 0, 0);
  return protoAgendaDateKey(t);
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

function toBill(payment: RecurringPayment): AgendaBill {
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

function sameBill(a: AgendaBill, b: AgendaBill) {
  if (a.sourceId && b.sourceId && a.sourceId === b.sourceId) return true;
  return (
    a.name === b.name &&
    a.amount === b.amount &&
    a.account === b.account &&
    (a.kind ?? 'payment') === (b.kind ?? 'payment')
  );
}

/** Expand active recurring payments into dated bills for [rangeStart, rangeEnd]. */
export function buildProtoAgendaBillsByDate(
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

    let index = 0;
    let occurrence = occurrenceDateAt(firstDate, payment.frequency, index);
    while (occurrence <= effectiveEnd && index < 1200) {
      if (occurrence >= start) {
        const key = protoAgendaDateKey(occurrence);
        const bill = toBill(payment);
        const existing = billsByDate[key] ?? [];
        if (!existing.some((item) => sameBill(item, bill))) {
          existing.push(bill);
          billsByDate[key] = existing;
        }
      }
      index += 1;
      occurrence = occurrenceDateAt(firstDate, payment.frequency, index);
    }
  }

  return billsByDate;
}

export function monthBounds(year: number, monthIndex: number) {
  const start = new Date(year, monthIndex, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(year, monthIndex + 1, 0);
  end.setHours(0, 0, 0, 0);
  return { start, end };
}

export function sumProtoAgendaMonthTotals(billsByDate: Record<string, AgendaBill[]>) {
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

export type ProtoAgendaTimelineItem = {
  dateKey: string;
  day: number;
  monthShort: string;
  bill: AgendaBill;
  paid: boolean;
  daysUntil: number;
  urgencyLabel: string | null;
  urgencyTone: 'danger' | 'warning' | 'muted' | null;
};

export function flattenProtoAgendaTimeline(
  billsByDate: Record<string, AgendaBill[]>,
  todayKey: string,
): ProtoAgendaTimelineItem[] {
  const keys = Object.keys(billsByDate).sort();
  const items: ProtoAgendaTimelineItem[] = [];

  for (const dateKey of keys) {
    const bills = billsByDate[dateKey] ?? [];
    const date = new Date(`${dateKey}T12:00:00`);
    const day = date.getDate();
    const monthShort = date.toLocaleDateString('fr-CA', { month: 'short' }).replace(/\.$/, '');
    const daysUntil = Math.max(
      0,
      Math.ceil(
        (new Date(`${dateKey}T00:00:00`).getTime() -
          new Date(`${todayKey}T00:00:00`).getTime()) /
          86_400_000,
      ),
    );

    for (const bill of bills) {
      const isIncome = (bill.kind ?? 'payment') === 'income';
      const paid = dateKey < todayKey || (dateKey === todayKey && isIncome);
      let urgencyLabel: string | null = null;
      let urgencyTone: ProtoAgendaTimelineItem['urgencyTone'] = null;
      if (!paid && dateKey >= todayKey && !isIncome) {
        urgencyLabel = daysUntil <= 0 ? "aujourd'hui" : `dans ${daysUntil}j`;
        urgencyTone = daysUntil <= 3 ? 'danger' : daysUntil <= 10 ? 'warning' : 'muted';
      }
      items.push({
        dateKey,
        day,
        monthShort,
        bill,
        paid,
        daysUntil,
        urgencyLabel,
        urgencyTone,
      });
    }
  }

  return items;
}
