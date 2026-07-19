import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import type { Transaction } from '@/types';

const ISO_DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function capitalizeFirst(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function parseIsoDayKey(dateKey: string): Date | null {
  const match = ISO_DAY_PATTERN.exec(dateKey.trim());
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

export function dateKeyFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function todayDayKey(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dateKeyFromDate(today);
}

export function formatListShortDate(dateKey: string): string {
  const date = parseIsoDayKey(dateKey);
  if (!date) return dateKey;
  const weekday = date
    .toLocaleDateString('fr-FR', { weekday: 'short' })
    .replace(/\.$/, '')
    .toLowerCase();
  const day = date.getDate();
  const month = date.toLocaleDateString('fr-FR', { month: 'short' }).replace(/\.$/, '');
  const dayLabel = day === 1 ? '1er' : String(day);
  return `${capitalizeFirst(weekday)}. ${dayLabel} ${month}`;
}

export type ListSectionHeader = {
  titleBold: string;
  titleSuffix: string;
};

/** Agenda-style day section header for transaction history groups. */
export function formatHistoryDaySectionHeader(dateKey: string, todayKey: string): ListSectionHeader {
  const date = parseIsoDayKey(dateKey);
  const today = parseIsoDayKey(todayKey);
  if (!date || !today) return { titleBold: dateKey, titleSuffix: '' };

  const shortDate = formatListShortDate(dateKey).toLowerCase();
  const yesterdayKey = dateKeyFromDate(addDays(today, -1));

  if (dateKey === todayKey) {
    return { titleBold: "AUJOURD'HUI", titleSuffix: ` · ${shortDate}` };
  }
  if (dateKey === yesterdayKey) {
    return { titleBold: 'HIER', titleSuffix: ` · ${shortDate}` };
  }

  return {
    titleBold: formatListShortDate(dateKey).toUpperCase(),
    titleSuffix: '',
  };
}

export function sumHistoryDayTotals(txs: Transaction[]) {
  let expenseTotal = 0;
  let incomeTotal = 0;
  txs.forEach((tx) => {
    if (tx.type === 'income') {
      incomeTotal += Math.abs(tx.amount);
    } else if (tx.type === 'expense') {
      expenseTotal += Math.abs(tx.amount);
    }
  });
  return { expenseTotal, incomeTotal };
}

export function formatListSectionTotal(expenseTotal: number, incomeTotal: number): string {
  const parts: string[] = [];
  if (expenseTotal > 0) parts.push(`−${formatDisplayMoneyAbsolute(expenseTotal)}`);
  if (incomeTotal > 0) parts.push(`+${formatDisplayMoneyAbsolute(incomeTotal)}`);
  return parts.join(' · ');
}
