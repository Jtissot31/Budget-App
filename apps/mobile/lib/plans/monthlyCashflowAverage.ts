import { getTransactionsSince } from '@/lib/db';
import type { Transaction } from '@/types';

export type MonthlyCashflowAverage = {
  monthlyIncome: number;
  monthlyExpenses: number;
  monthsUsed: number;
};

export function averageMonthlyCashflow(
  transactions: readonly Transaction[],
  now = new Date(),
  monthCount = 3,
): MonthlyCashflowAverage {
  const safeMonthCount = Math.max(1, Math.min(12, Math.round(monthCount)));
  const windowStart = new Date(
    now.getFullYear(),
    now.getMonth() - safeMonthCount + 1,
    1,
    0,
    0,
    0,
    0,
  );
  const windowEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  const totalsByMonth = new Map<string, { income: number; expenses: number }>();

  for (const transaction of transactions) {
    if (transaction.type !== 'income' && transaction.type !== 'expense') continue;
    const date = new Date(transaction.date);
    if (
      Number.isNaN(date.getTime()) ||
      date.getTime() < windowStart.getTime() ||
      date.getTime() >= windowEnd.getTime()
    ) {
      continue;
    }

    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const totals = totalsByMonth.get(key) ?? { income: 0, expenses: 0 };
    const amount = Number.isFinite(transaction.amount) ? Math.max(0, transaction.amount) : 0;
    if (transaction.type === 'income') totals.income += amount;
    else totals.expenses += amount;
    totalsByMonth.set(key, totals);
  }

  const monthsUsed = totalsByMonth.size;
  if (monthsUsed === 0) {
    return { monthlyIncome: 0, monthlyExpenses: 0, monthsUsed: 0 };
  }

  const totals = [...totalsByMonth.values()].reduce(
    (sum, month) => ({
      income: sum.income + month.income,
      expenses: sum.expenses + month.expenses,
    }),
    { income: 0, expenses: 0 },
  );

  return {
    monthlyIncome: totals.income / monthsUsed,
    monthlyExpenses: totals.expenses / monthsUsed,
    monthsUsed,
  };
}

export async function loadAverageMonthlyCashflow(monthCount = 3): Promise<MonthlyCashflowAverage> {
  const now = new Date();
  const safeMonthCount = Math.max(1, Math.min(12, Math.round(monthCount)));
  const windowStart = new Date(
    now.getFullYear(),
    now.getMonth() - safeMonthCount + 1,
    1,
    0,
    0,
    0,
    0,
  );
  const transactions = await getTransactionsSince(windowStart.toISOString());
  return averageMonthlyCashflow(transactions, now, safeMonthCount);
}
