import type { Loan, LoanDurationUnit, LoanPaymentFrequency } from '@/types';

export const MORTGAGE_CHART_CAPITAL = '#4ADE80';
export const MORTGAGE_CHART_INTEREST = '#8B949E';

export type AmortizationPeriod = {
  periodIndex: number;
  yearIndex: number;
  balance: number;
  principalPaid: number;
  interestPaid: number;
};

export type AnnualAmortizationSummary = {
  yearIndex: number;
  calendarYear: number;
  principalPaid: number;
  interestPaid: number;
};

export type PaymentSplit = {
  principal: number;
  interest: number;
  total: number;
};

export type MortgageAmortizationResult = {
  periods: AmortizationPeriod[];
  annualSummaries: AnnualAmortizationSummary[];
  paymentsPerYear: number;
  paymentAmount: number;
  periodicRate: number;
  startCalendarYear: number;
  amortizationYears: number;
  currentPaymentSplit: PaymentSplit | null;
  hasRate: boolean;
  hasPayment: boolean;
};

export type LoanAmortizationInput = Pick<
  Loan,
  | 'principal'
  | 'balanceRemaining'
  | 'interestRate'
  | 'paymentFrequency'
  | 'monthlyPayment'
  | 'startDate'
  | 'amortizationYears'
  | 'durationAmount'
  | 'durationUnit'
>;

/** @deprecated Use LoanAmortizationInput */
export type MortgageAmortizationInput = LoanAmortizationInput;

export function getPaymentsPerYear(frequency: LoanPaymentFrequency): number {
  if (frequency === 'weekly') return 52;
  if (frequency === 'biweekly') return 26;
  return 12;
}

export function durationAmountInYears(
  amount: number,
  unit: LoanDurationUnit = 'months',
): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return unit === 'years' ? amount : Math.max(1, Math.round(amount / 12));
}

export function resolveLoanAmortizationYears(loan: LoanAmortizationInput): number {
  const amortYears = loan.amortizationYears;
  if (amortYears != null && Number.isFinite(amortYears) && amortYears > 0) return amortYears;

  const durationAmount = loan.durationAmount;
  const durationUnit = loan.durationUnit ?? 'months';
  if (Number.isFinite(durationAmount) && durationAmount > 0) {
    return durationAmountInYears(durationAmount, durationUnit);
  }

  return 25;
}

/** @deprecated Use resolveLoanAmortizationYears */
export function resolveMortgageAmortizationYears(loan: LoanAmortizationInput): number {
  return resolveLoanAmortizationYears(loan);
}

function parseLoanDateKey(dateKey?: string | null): Date | null {
  const trimmed = dateKey?.trim();
  if (!trimmed) return null;
  const date = new Date(`${trimmed}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function computePeriodicRate(annualRatePercent: number, paymentsPerYear: number): number {
  if (!Number.isFinite(annualRatePercent) || annualRatePercent <= 0) return 0;
  return annualRatePercent / 100 / paymentsPerYear;
}

function computePeriodicPayment(
  principal: number,
  annualRatePercent: number,
  paymentsPerYear: number,
  totalPeriods: number,
): number {
  if (principal <= 0 || totalPeriods <= 0) return 0;
  const periodicRate = computePeriodicRate(annualRatePercent, paymentsPerYear);
  if (periodicRate <= 0) return principal / totalPeriods;
  const factor = Math.pow(1 + periodicRate, totalPeriods);
  return (principal * periodicRate * factor) / (factor - 1);
}

function resolvePaymentAmount(
  loan: LoanAmortizationInput,
  principal: number,
  paymentsPerYear: number,
  totalPeriods: number,
): { paymentAmount: number; hasPayment: boolean } {
  const entered = loan.monthlyPayment;
  if (Number.isFinite(entered) && entered > 0) {
    return { paymentAmount: entered, hasPayment: true };
  }
  if (loan.interestRate > 0 && principal > 0) {
    return {
      paymentAmount: computePeriodicPayment(principal, loan.interestRate, paymentsPerYear, totalPeriods),
      hasPayment: true,
    };
  }
  return { paymentAmount: 0, hasPayment: false };
}

function findCurrentPeriodIndex(periods: AmortizationPeriod[], balanceRemaining: number): number {
  if (periods.length === 0) return 0;
  const target = Math.max(balanceRemaining, 0);
  let bestIndex = 0;
  let bestDiff = Infinity;
  for (let index = 0; index < periods.length; index += 1) {
    const diff = Math.abs(periods[index].balance - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function buildAnnualSummaries(
  periods: AmortizationPeriod[],
  startCalendarYear: number,
): AnnualAmortizationSummary[] {
  const byYear = new Map<number, { principalPaid: number; interestPaid: number }>();
  for (const period of periods) {
    const bucket = byYear.get(period.yearIndex) ?? { principalPaid: 0, interestPaid: 0 };
    bucket.principalPaid += period.principalPaid;
    bucket.interestPaid += period.interestPaid;
    byYear.set(period.yearIndex, bucket);
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([yearIndex, totals]) => ({
      yearIndex,
      calendarYear: startCalendarYear + yearIndex,
      principalPaid: totals.principalPaid,
      interestPaid: totals.interestPaid,
    }));
}

/**
 * Standard amortization: periodic interest on remaining balance, payment split into
 * interest + principal until balance reaches zero.
 */
export function computeLoanAmortization(loan: LoanAmortizationInput): MortgageAmortizationResult | null {
  const principal = Math.max(Number(loan.principal) || 0, 0);
  if (principal <= 0) return null;

  const amortizationYears = resolveLoanAmortizationYears(loan);
  const paymentsPerYear = getPaymentsPerYear(loan.paymentFrequency);
  const totalPeriods = Math.max(Math.round(amortizationYears * paymentsPerYear), 1);
  const hasRate = Number.isFinite(loan.interestRate) && loan.interestRate > 0;
  const periodicRate = computePeriodicRate(loan.interestRate, paymentsPerYear);

  const { paymentAmount, hasPayment } = resolvePaymentAmount(
    loan,
    principal,
    paymentsPerYear,
    totalPeriods,
  );
  if (!hasPayment || paymentAmount <= 0) return null;

  const startDate = parseLoanDateKey(loan.startDate);
  const startCalendarYear = startDate?.getFullYear() ?? new Date().getFullYear();

  const periods: AmortizationPeriod[] = [];
  let balance = principal;

  for (let periodIndex = 0; periodIndex < totalPeriods && balance > 0.005; periodIndex += 1) {
    const interestPaid = balance * periodicRate;
    const principalPaid = Math.min(Math.max(paymentAmount - interestPaid, 0), balance);
    balance = Math.max(balance - principalPaid, 0);
    const yearIndex = Math.floor(periodIndex / paymentsPerYear);
    periods.push({
      periodIndex,
      yearIndex,
      balance,
      principalPaid,
      interestPaid,
    });
  }

  if (periods.length === 0) return null;

  const balanceRemaining = Math.max(Number(loan.balanceRemaining) || 0, 0);
  const currentPeriodIndex = findCurrentPeriodIndex(periods, balanceRemaining);
  const currentPeriod = periods[currentPeriodIndex];
  const currentPaymentSplit = currentPeriod
    ? {
        principal: currentPeriod.principalPaid,
        interest: currentPeriod.interestPaid,
        total: currentPeriod.principalPaid + currentPeriod.interestPaid,
      }
    : null;

  const annualSummaries = buildAnnualSummaries(periods, startCalendarYear);

  return {
    periods,
    annualSummaries,
    paymentsPerYear,
    paymentAmount,
    periodicRate,
    startCalendarYear,
    amortizationYears,
    currentPaymentSplit,
    hasRate,
    hasPayment,
  };
}

/** @deprecated Use computeLoanAmortization */
export function computeMortgageAmortization(loan: LoanAmortizationInput): MortgageAmortizationResult | null {
  return computeLoanAmortization(loan);
}
