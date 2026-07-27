import { getSetting, setSetting } from '@/lib/db';

export const PAY_FREQUENCY_KEY = 'pay_frequency';
export const PAY_SECOND_LAST_DATE_KEY = 'pay_second_last_date';
export const PAY_LAST_DATE_KEY = 'pay_last_date';
export const PAY_AVERAGE_AMOUNT_KEY = 'pay_average_amount';

export type PayEstimationFrequency = 'weekly' | 'biweekly' | 'semi_monthly' | 'monthly';

export type PayEstimationSettings = {
  frequency: PayEstimationFrequency | null;
  secondLastDate: string | null;
  lastDate: string | null;
  averageAmount: number | null;
};

export const PAY_ESTIMATION_FREQUENCY_OPTIONS: Array<{ id: PayEstimationFrequency; label: string }> = [
  { id: 'weekly', label: 'Hebdomadaire' },
  { id: 'biweekly', label: 'Aux 2 semaines' },
  { id: 'semi_monthly', label: 'Bi-mensuel' },
  { id: 'monthly', label: 'Mensuel' },
];

const VALID_FREQUENCIES = new Set<PayEstimationFrequency>([
  'weekly',
  'biweekly',
  'semi_monthly',
  'monthly',
]);

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

function parseFrequency(raw: string): PayEstimationFrequency | null {
  return VALID_FREQUENCIES.has(raw as PayEstimationFrequency) ? (raw as PayEstimationFrequency) : null;
}

function parseAverageAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export async function getPayEstimationSettings(): Promise<PayEstimationSettings> {
  const [frequencyRaw, secondLastDate, lastDate, averageRaw] = await Promise.all([
    getSetting(PAY_FREQUENCY_KEY, ''),
    getSetting(PAY_SECOND_LAST_DATE_KEY, ''),
    getSetting(PAY_LAST_DATE_KEY, ''),
    getSetting(PAY_AVERAGE_AMOUNT_KEY, ''),
  ]);

  return {
    frequency: parseFrequency(frequencyRaw),
    secondLastDate: parseIsoDay(secondLastDate) ? secondLastDate.trim() : null,
    lastDate: parseIsoDay(lastDate) ? lastDate.trim() : null,
    averageAmount: parseAverageAmount(averageRaw),
  };
}

export async function setPayEstimationFrequency(frequency: PayEstimationFrequency): Promise<void> {
  await setSetting(PAY_FREQUENCY_KEY, frequency);
}

export async function setPaySecondLastDate(isoDate: string): Promise<void> {
  await setSetting(PAY_SECOND_LAST_DATE_KEY, isoDate.trim());
}

export async function setPayLastDate(isoDate: string): Promise<void> {
  await setSetting(PAY_LAST_DATE_KEY, isoDate.trim());
}

export async function setPayAverageAmount(amount: number | null): Promise<void> {
  await setSetting(PAY_AVERAGE_AMOUNT_KEY, amount != null && amount > 0 ? String(amount) : '');
}

export function payEstimationFrequencyLabel(frequency: PayEstimationFrequency): string {
  return PAY_ESTIMATION_FREQUENCY_OPTIONS.find((option) => option.id === frequency)?.label ?? frequency;
}

/**
 * Convert a per-paycheck average amount to a monthly equivalent.
 * Uses the same annualization factors as recurring-payment monthly math (52 / 26 / 12).
 */
export function toMonthlyAveragePayAmount(
  amount: number,
  frequency: PayEstimationFrequency | null,
): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (!frequency || frequency === 'monthly') return amount;
  if (frequency === 'weekly') return (amount * 52) / 12;
  if (frequency === 'biweekly') return (amount * 26) / 12;
  // semi_monthly — two paycheques per month
  return amount * 2;
}

export function isPayEstimationComplete(settings: PayEstimationSettings): boolean {
  const secondLast = settings.secondLastDate ? parseIsoDay(settings.secondLastDate) : null;
  const last = settings.lastDate ? parseIsoDay(settings.lastDate) : null;

  return Boolean(
    settings.frequency &&
      secondLast &&
      last &&
      last.getTime() > secondLast.getTime(),
  );
}

function toIsoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addMonthsClamped(date: Date, months: number): Date {
  const y = date.getFullYear();
  const m = date.getMonth() + months;
  const dim = new Date(y, m + 1, 0).getDate();
  const next = new Date(y, m, Math.min(date.getDate(), dim));
  next.setHours(0, 0, 0, 0);
  return next;
}

/**
 * Infer the payday before `lastIso` from frequency so agenda projection
 * (`isPayEstimationComplete`) works when onboarding only asks for the last payday.
 */
export function deriveSecondLastPayDate(
  lastIso: string,
  frequency: PayEstimationFrequency,
): string | null {
  const last = parseIsoDay(lastIso);
  if (!last) return null;

  let second: Date;
  if (frequency === 'weekly') {
    second = addDays(last, -7);
  } else if (frequency === 'biweekly') {
    second = addDays(last, -14);
  } else if (frequency === 'monthly') {
    second = addMonthsClamped(last, -1);
  } else {
    // semi_monthly — assume early (1) / late (~15) pair anchored on last payday
    const day = last.getDate();
    if (day >= 15) {
      second = new Date(last.getFullYear(), last.getMonth(), 1);
      second.setHours(0, 0, 0, 0);
    } else {
      second = new Date(last.getFullYear(), last.getMonth() - 1, 15);
      second.setHours(0, 0, 0, 0);
    }
  }

  if (second.getTime() >= last.getTime()) return null;
  return toIsoDay(second);
}

export type OnboardingPayEstimationInput = {
  frequency: PayEstimationFrequency;
  lastDate: string;
  averageAmount: number | null;
};

/** Persist frequency + last payday (+ derived second-last) for agenda / cashflow estimates. */
export async function applyOnboardingPayEstimation(
  input: OnboardingPayEstimationInput,
): Promise<boolean> {
  const last = parseIsoDay(input.lastDate);
  if (!last) return false;

  const secondLast = deriveSecondLastPayDate(input.lastDate, input.frequency);
  if (!secondLast) return false;

  await setPayEstimationFrequency(input.frequency);
  await setPaySecondLastDate(secondLast);
  await setPayLastDate(toIsoDay(last));
  await setPayAverageAmount(input.averageAmount);
  return true;
}
