import { StyleSheet, Text } from 'react-native';
import {
  PERIOD_DELTA_LABELS,
  type PortfolioChartCardPeriodData,
} from '@/components/PortfolioChartCard';
import { chartTokens, interMediumText, portfolioLight } from '@/constants/theme';
import { formatDisplayMoney } from '@/lib/formatDisplayMoney';
import { formatNumberDisplay } from '@/lib/formatNumber';
import { useAppTheme } from '@/lib/themeContext';

const DELTA_MINT = chartTokens.line;
const LIGHT_DELTA_MINT = portfolioLight.chartCurve;
const CHART_RED = chartTokens.negative;
const LIGHT_CHART_RED = '#CF222E';

export function HeroChartDelta({ periodData }: { periodData: PortfolioChartCardPeriodData | null }) {
  const { isLight } = useAppTheme();
  if (!periodData) return null;

  const { delta, deltaPercent, period } = periodData;
  const positive = delta >= 0;
  const sign = positive ? '+' : '-';
  const amountMain = formatDisplayMoney(Math.abs(delta)).main;
  const percentStr = formatNumberDisplay(Math.abs(deltaPercent), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const text = `${sign} ${amountMain} $ (${sign} ${percentStr} %) ${PERIOD_DELTA_LABELS[period]}`;
  const color = positive ? (isLight ? LIGHT_DELTA_MINT : DELTA_MINT) : isLight ? LIGHT_CHART_RED : CHART_RED;

  return (
    <Text style={[styles.heroDeltaText, { color }]} numberOfLines={1} adjustsFontSizeToFit>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  heroDeltaText: {
    ...interMediumText,
    fontSize: 13,
    marginTop: 8,
  },
});
