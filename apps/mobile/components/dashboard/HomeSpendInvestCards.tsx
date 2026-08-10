/**
 * Accueil — row of 2 equal insight cards: Dépenses et épargne | Placements.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { ProtoGlassCard } from '@/components/proto/ProtoGlassCard';
import { SparklineChart } from '@/components/chat/SparklineChart';
import { COLORS } from '@/constants/design-tokens';
import {
  MOCK_STOCK_HOLDINGS,
  formatStockDayChangePercent,
  mockStockPortfolioDayChangePercent,
  mockStockPortfolioTotalValue,
} from '@/constants/mockStockPortfolio';
import { moneyAmountTypography, typographyKit } from '@/constants/theme';
import { ensureDbReady } from '@/lib/init';
import { getDashboard, getTransactionsSince } from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { tapHaptic } from '@/lib/haptics';
import { generateIntradaySparkline } from '@/lib/intradayStockSparkline';
import { useAppTheme } from '@/lib/themeContext';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';

const SPARK_H = 36;
const ENDPOINT_R = 2.5;

function monthStartIso(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function monthLabelFr(): string {
  const raw = new Date().toLocaleDateString('fr-CA', { month: 'long' });
  return raw.charAt(0).toLowerCase() + raw.slice(1);
}

function daysInMonth(date = new Date()): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/** Cumulative daily expense totals for the current calendar month (length = days in month). */
function buildMonthSpendSeries(
  expenses: { date: string; amount: number; type: string }[],
  now = new Date(),
): number[] {
  const dim = daysInMonth(now);
  const daySpend = new Array<number>(dim).fill(0);
  const y = now.getFullYear();
  const m = now.getMonth();

  for (const tx of expenses) {
    if (tx.type !== 'expense') continue;
    const d = new Date(tx.date);
    if (d.getFullYear() !== y || d.getMonth() !== m) continue;
    const day = d.getDate();
    if (day >= 1 && day <= dim) daySpend[day - 1] += Math.abs(tx.amount);
  }

  const cumulative = new Array<number>(dim);
  let running = 0;
  for (let i = 0; i < dim; i += 1) {
    running += daySpend[i] ?? 0;
    cumulative[i] = running;
  }

  // Keep post-today points flat so the muted tail reads as remaining month, not invented spend.
  const todayIdx = Math.min(dim - 1, Math.max(0, now.getDate() - 1));
  const todayVal = cumulative[todayIdx] ?? 0;
  for (let i = todayIdx + 1; i < dim; i += 1) {
    cumulative[i] = todayVal;
  }
  return cumulative;
}

/** Value-weighted portfolio intraday mark-to-market series (downsampled). */
function buildPortfolioIntradaySeries(maxPoints = 28): number[] {
  const holdings = MOCK_STOCK_HOLDINGS;
  if (holdings.length === 0) return [];

  const perHolding = holdings.map((h) => ({
    shares: h.shares,
    series: generateIntradaySparkline(h),
  }));
  const len = Math.min(...perHolding.map((p) => p.series.length));
  if (len < 2) return [];

  const totals: number[] = [];
  for (let i = 0; i < len; i += 1) {
    let sum = 0;
    for (const row of perHolding) {
      sum += row.shares * (row.series[i] ?? 0);
    }
    totals.push(sum);
  }

  if (totals.length <= maxPoints) return totals;
  const out: number[] = [];
  const step = (totals.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i += 1) {
    out.push(totals[Math.round(i * step)] ?? 0);
  }
  return out;
}

type DualToneSparklineProps = {
  data: number[];
  width: number;
  height: number;
  accentEndIndex: number;
  accentColor: string;
  mutedColor: string;
};

function DualToneSparkline({
  data,
  width,
  height,
  accentEndIndex,
  accentColor,
  mutedColor,
}: DualToneSparklineProps) {
  if (data.length < 2 || width <= 0) return <View style={{ height }} />;

  const padX = 2;
  const padY = 4;
  const endInset = ENDPOINT_R + 0.5;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const innerW = width - padX * 2 - endInset;
  const innerH = height - padY * 2;

  const points = data.map((value, index) => {
    const x = padX + (index / (data.length - 1)) * innerW;
    const y = padY + innerH - ((value - min) / range) * innerH;
    return { x, y };
  });

  const clampIdx = Math.max(0, Math.min(points.length - 1, accentEndIndex));
  const accentPts = points.slice(0, clampIdx + 1);
  const mutedPts = points.slice(clampIdx);

  const toPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');

  const node = accentPts[accentPts.length - 1] ?? points[0];

  return (
    <Svg width={width} height={height}>
      {mutedPts.length >= 2 ? (
        <Path
          d={toPath(mutedPts)}
          stroke={mutedColor}
          strokeWidth={1.25}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {accentPts.length >= 2 ? (
        <Path
          d={toPath(accentPts)}
          stroke={accentColor}
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {node ? <Circle cx={node.x} cy={node.y} r={ENDPOINT_R} fill={accentColor} /> : null}
    </Svg>
  );
}

export function HomeSpendInvestCards() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [spentMonth, setSpentMonth] = useState(0);
  const [budgetLimit, setBudgetLimit] = useState(0);
  const [spendSeries, setSpendSeries] = useState<number[]>([]);
  const [cardWidth, setCardWidth] = useState(0);

  const load = useCallback(async () => {
    await ensureDbReady();
    const [dashboard, monthTx] = await Promise.all([
      getDashboard(),
      getTransactionsSince(monthStartIso()),
    ]);
    setSpentMonth(dashboard.monthlyExpenses ?? 0);
    setBudgetLimit(dashboard.monthlyBudgetLimit ?? 0);
    setSpendSeries(buildMonthSpendSeries(monthTx));
  }, []);

  useEffect(() => {
    void load();
    return dataEvents.subscribe(() => {
      void load();
    });
  }, [load]);

  useRefreshOnFocus(load);

  const remaining = budgetLimit - spentMonth;
  const todayIdx = Math.max(
    1,
    Math.min(Math.max(spendSeries.length - 1, 0), Math.max(0, new Date().getDate() - 1)),
  );

  const portfolioTotal = useMemo(() => mockStockPortfolioTotalValue(), []);
  const portfolioDayPct = useMemo(() => mockStockPortfolioDayChangePercent(), []);
  const portfolioSeries = useMemo(() => buildPortfolioIntradaySeries(28), []);
  const dayUp = portfolioDayPct >= 0;

  const sparkBlue = COLORS.dark.blue;
  const sparkMuted = colors.borderStrong;

  const onRowLayout = useCallback((e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    // Two equal cards + gap 10
    const next = Math.floor((w - 10) / 2);
    setCardWidth((prev) => (prev === next ? prev : next));
  }, []);

  const sparkW = Math.max(0, cardWidth - 28);

  return (
    <View style={styles.row} onLayout={onRowLayout}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dépenses et épargne"
        onPress={() => {
          tapHaptic();
          router.push('/budgets');
        }}
        style={({ pressed }) => [styles.cardPress, pressed && { opacity: 0.82 }]}
      >
        <ProtoGlassCard padding={14} style={styles.card}>
          <Text style={[styles.title, { color: colors.textMuted }]} numberOfLines={1}>
            Dépenses et épargne
          </Text>
          <Text
            style={[
              moneyAmountTypography({ tier: 'stat', fontSize: 22 }),
              { color: colors.text, letterSpacing: -0.5 },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {remaining >= 0
              ? formatDisplayMoneyAbsolute(remaining)
              : `−${formatDisplayMoneyAbsolute(Math.abs(remaining))}`}
          </Text>
          <View style={styles.sparkWrap}>
            {sparkW > 0 && spendSeries.length >= 2 ? (
              <DualToneSparkline
                data={spendSeries}
                width={sparkW}
                height={SPARK_H}
                accentEndIndex={todayIdx}
                accentColor={sparkBlue}
                mutedColor={sparkMuted}
              />
            ) : (
              <View style={{ height: SPARK_H }} />
            )}
          </View>
          <Text style={[styles.footer, { color: colors.textMuted }]} numberOfLines={1}>
            {formatDisplayMoneyAbsolute(spentMonth)} dépensé en {monthLabelFr()}
          </Text>
        </ProtoGlassCard>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Placements"
        onPress={() => {
          tapHaptic();
          router.push('/accounts');
        }}
        style={({ pressed }) => [styles.cardPress, pressed && { opacity: 0.82 }]}
      >
        <ProtoGlassCard padding={14} style={styles.card}>
          <Text style={[styles.title, { color: colors.textMuted }]} numberOfLines={1}>
            Placements
          </Text>
          <Text
            style={[
              moneyAmountTypography({ tier: 'stat', fontSize: 22 }),
              { color: colors.text, letterSpacing: -0.5 },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {formatDisplayMoneyAbsolute(portfolioTotal)}
          </Text>
          <View style={styles.sparkWrap}>
            {sparkW > 0 && portfolioSeries.length >= 2 ? (
              <SparklineChart
                data={portfolioSeries}
                width={sparkW}
                height={SPARK_H}
                positive={dayUp}
                showFill
                showEndpointDot
                strokeWidth={1.5}
              />
            ) : sparkW > 0 ? (
              <FilledFallbackSparkline
                width={sparkW}
                height={SPARK_H}
                color={dayUp ? colors.accentGreen : colors.danger}
              />
            ) : (
              <View style={{ height: SPARK_H }} />
            )}
          </View>
          <Text
            style={[
              styles.footer,
              { color: dayUp ? colors.accentGreen : colors.danger },
            ]}
            numberOfLines={1}
          >
            {`${formatStockDayChangePercent(portfolioDayPct)} aujourd'hui`}
          </Text>
        </ProtoGlassCard>
      </Pressable>
    </View>
  );
}

/** Flat green fill sparkline when intraday series is empty. */
function FilledFallbackSparkline({
  width,
  height,
  color,
}: {
  width: number;
  height: number;
  color: string;
}) {
  const midY = height * 0.55;
  const d = `M 2 ${midY} L ${width - 4} ${midY}`;
  const fill = `${d} L ${width - 4} ${height - 2} L 2 ${height - 2} Z`;
  const gid = 'home-invest-fallback-fill';
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.22} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={fill} fill={`url(#${gid})`} />
      <Path d={d} stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" />
      <Circle cx={width - 4} cy={midY} r={ENDPOINT_R} fill={color} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  cardPress: {
    flex: 1,
    minWidth: 0,
  },
  card: {
    gap: 8,
    minHeight: 148,
  },
  title: {
    ...typographyKit.metaMedium,
    fontSize: 12,
    letterSpacing: -0.1,
  },
  sparkWrap: {
    width: '100%',
    height: SPARK_H,
    marginTop: 2,
    marginBottom: 2,
  },
  footer: {
    ...typographyKit.metaMedium,
    fontSize: 11,
    letterSpacing: -0.1,
  },
});
