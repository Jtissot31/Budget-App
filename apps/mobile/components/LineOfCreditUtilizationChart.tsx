import { useMemo, useState } from 'react';
import { DetailPeriodSparkChart } from '@/components/DetailPeriodSparkChart';
import type { LineOfCreditBalanceHistoryResult } from '@/lib/buildLineOfCreditBalanceHistory';
import {
  buildLineOfCreditUtilizationSparkline,
  type LocUtilizationChartPeriod,
} from '@/lib/buildLineOfCreditUtilizationSparkline';

type Props = {
  currentUsed: number;
  balanceHistory?: LineOfCreditBalanceHistoryResult | null;
};

/**
 * Credit-margin utilization-over-time chart — shared DetailPeriodSparkChart shell
 * (delta pill + spark + period chips). Rising used balance paints red.
 */
export function LineOfCreditUtilizationChart({
  currentUsed,
  balanceHistory = null,
}: Props) {
  const [chartPeriod, setChartPeriod] = useState<LocUtilizationChartPeriod>('6M');

  const sparkline = useMemo(
    () =>
      buildLineOfCreditUtilizationSparkline({
        balanceHistory,
        currentUsed,
        period: chartPeriod,
      }),
    [balanceHistory, chartPeriod, currentUsed],
  );

  return (
    <DetailPeriodSparkChart
      sparkline={sparkline}
      period={chartPeriod}
      onPeriodChange={setChartPeriod}
      risingIsPositive={false}
    />
  );
}
