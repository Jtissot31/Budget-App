import { useMemo, useState } from 'react';
import { DetailPeriodSparkChart } from '@/components/DetailPeriodSparkChart';
import {
  buildLoanRepaymentSparkline,
  type LoanRepaymentChartPeriod,
} from '@/lib/buildLoanRepaymentSparkline';
import type { Loan, SimulatedAccount, Transaction } from '@/types';

type Props = {
  loan: Pick<Loan, 'id' | 'principal' | 'balanceRemaining'>;
  loanTitle: string;
  transactions?: readonly Transaction[];
  paymentAccount?: Pick<SimulatedAccount, 'id' | 'name'> | null;
  recurringPaymentName?: string | null;
};

/**
 * Loan repayment progress chart — shared DetailPeriodSparkChart shell
 * (delta pill, sparkline with payment dots, period chips).
 */
export function LoanProgressChart({
  loan,
  loanTitle,
  transactions = [],
  paymentAccount = null,
  recurringPaymentName = null,
}: Props) {
  const [chartPeriod, setChartPeriod] = useState<LoanRepaymentChartPeriod>('6M');

  const sparkline = useMemo(
    () =>
      buildLoanRepaymentSparkline({
        loan,
        transactions,
        paymentAccount,
        loanTitle,
        recurringPaymentName,
        period: chartPeriod,
      }),
    [chartPeriod, loan, loanTitle, paymentAccount, recurringPaymentName, transactions],
  );

  return (
    <DetailPeriodSparkChart
      sparkline={sparkline}
      period={chartPeriod}
      onPeriodChange={setChartPeriod}
      risingIsPositive
    />
  );
}
