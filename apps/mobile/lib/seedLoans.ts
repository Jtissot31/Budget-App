import { dataEvents } from '@/lib/events';
import { formatLoanDisplayTitle } from '@/lib/loanPresentation';
import { syncMortgageWealthAsset } from '@/lib/mortgageWealthSync';
import { getLoans, getSetting, setSetting, upsertLoan } from '@/lib/db';
import type { Loan } from '@/types';

/** Bump to inject or refresh demo loans when the user has none (or add missing seed ids). */
const LOANS_SEED_VERSION = '1';
const LOANS_SEED_KEY = 'loans_seed_version';

const CHECKING_ACCOUNT_ID = '1';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addMonths(dateKey: string, months: number): string {
  const base = new Date(`${dateKey}T12:00:00`);
  base.setMonth(base.getMonth() + months);
  return formatDateKey(base);
}

function addYears(dateKey: string, years: number): string {
  const base = new Date(`${dateKey}T12:00:00`);
  base.setFullYear(base.getFullYear() + years);
  return formatDateKey(base);
}

function yearsOffsetFromNow(now: Date, years: number, month: number, day: number): string {
  const base = new Date(now);
  base.setFullYear(base.getFullYear() + years);
  base.setMonth(month);
  base.setDate(day);
  base.setHours(12, 0, 0, 0);
  return formatDateKey(base);
}

/** Anchor next payment to dueDay in the current month (same pattern as recurring seed). */
function monthlyNextDate(now: Date, dueDay: number): string {
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.min(dueDay, daysInMonth);
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function buildDemoLoans(now: Date): Loan[] {
  const baseCreatedAt = now.getTime();
  const createdAtFor = (index: number) => new Date(baseCreatedAt - index * 60_000).toISOString();
  const autoStartDate = addMonths(formatDateKey(now), -18);
  const autoEndDate = addMonths(autoStartDate, 60);
  const mortgageStartDate = yearsOffsetFromNow(now, -3, 5, 1);
  const mortgageEndDate = addYears(mortgageStartDate, 25);
  const locStartDate = yearsOffsetFromNow(now, -2, 2, 15);

  const drafts: (Omit<Loan, 'name'> & { name?: string })[] = [
    {
      id: 'seed-loan-auto',
      type: 'personal_loan',
      reason: 'Auto',
      lender: 'Desjardins',
      principal: 28_000,
      balanceRemaining: 19_420,
      interestRate: 6.49,
      monthlyPayment: 389,
      startDate: autoStartDate,
      endDate: autoEndDate,
      durationAmount: 60,
      durationUnit: 'months',
      paymentFrequency: 'monthly',
      paymentAccountId: CHECKING_ACCOUNT_ID,
      nextPaymentDate: monthlyNextDate(now, 10),
      recurringPaymentId: 'seed-rp-auto-pret',
      icon: 'DirectionsCar',
      createdAt: createdAtFor(0),
    },
    {
      id: 'seed-loan-mortgage',
      type: 'mortgage',
      reason: 'Maison',
      lender: 'Desjardins',
      principal: 224_000,
      balanceRemaining: 208_750,
      interestRate: 5.25,
      rateType: 'fixed',
      rateTermYears: 5,
      renewalDate: yearsOffsetFromNow(now, 2, 5, 1),
      amortizationYears: 25,
      paymentDebitType: 'automatic',
      monthlyPayment: 1_335,
      startDate: mortgageStartDate,
      endDate: mortgageEndDate,
      durationAmount: 25,
      durationUnit: 'years',
      paymentFrequency: 'monthly',
      paymentAccountId: CHECKING_ACCOUNT_ID,
      nextPaymentDate: monthlyNextDate(now, 1),
      icon: 'Apartments1StoryGabledRoof',
      address: '123 rue Exemple, Montréal',
      downPayment: 56_000,
      purchasePrice: 280_000,
      currentPropertyValue: 320_000,
      wealthAssetId: 'wealth-condo-seed',
      createdAt: createdAtFor(1),
    },
    {
      id: 'seed-loan-loc',
      type: 'line_of_credit',
      reason: null,
      lender: 'Desjardins',
      principal: 25_000,
      balanceRemaining: 20_000,
      interestRate: 7.45,
      monthlyPayment: 0,
      startDate: locStartDate,
      endDate: locStartDate,
      durationAmount: 0,
      durationUnit: 'months',
      paymentFrequency: 'monthly',
      paymentAccountId: CHECKING_ACCOUNT_ID,
      nextPaymentDate: locStartDate,
      icon: 'CreditCard',
      createdAt: createdAtFor(2),
    },
  ];

  return drafts.map((draft) => {
    const { name: _ignored, ...loanFields } = draft;
    return {
      ...loanFields,
      name: formatLoanDisplayTitle(loanFields),
    };
  });
}

/**
 * Inserts demo loans (auto, hypothèque, marge de crédit) when the user has none.
 * Idempotent via version key — never clobbers user-created loans.
 */
export async function seedLoansIfMissing(): Promise<boolean> {
  const version = await getSetting(LOANS_SEED_KEY, '0');
  if (version === LOANS_SEED_VERSION) return false;

  const existing = await getLoans();
  const demoLoans = buildDemoLoans(new Date());
  const existingIds = new Set(existing.map((loan) => loan.id));
  let seeded = false;

  const loansToInsert =
    existing.length === 0
      ? demoLoans
      : demoLoans.filter((loan) => !existingIds.has(loan.id));

  for (const loan of loansToInsert) {
    await upsertLoan(loan);
    if (loan.type === 'mortgage') {
      await syncMortgageWealthAsset(loan);
    }
    seeded = true;
  }

  await setSetting(LOANS_SEED_KEY, LOANS_SEED_VERSION);
  if (seeded) {
    dataEvents.emit();
  }
  return seeded;
}
