/**
 * Dépenses et épargne — month-to-date spend + dual-tone sparkline + vs prior month.
 * Shown prominently on the Transactions tab (moved from Accueil).
 */
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import { ProtoGlassCard } from '@/components/proto/ProtoGlassCard';
import { COLORS } from '@/constants/design-tokens';
import { moneyAmountTypography, typographyKit } from '@/constants/theme';
import { startOfMonth } from '@/lib/budgetMonth';
import {
  buildMonthSpendSummary,
  buildPriorMonthSpendSeriesAligned,
  monthSpendActiveIndex,
  monthSpendQueryLowerBound,
  previousCalendarMonth,
} from '@/lib/buildMonthSpendSeries';
import { ensureDbReady } from '@/lib/init';
import { getTransactionsSince } from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';

/** French footer: MTD spend vs same day-of-month in the previous calendar month. */
export function spendVsPreviousMonthFooter(currentTotal: number, priorAlignedTotal: number): string {
  const delta = currentTotal - priorAlignedTotal;
  if (Math.abs(delta) < 0.005) {
    return 'autant dépensé que le mois précédent';
  }
  const amount = formatDisplayMoneyAbsolute(Math.abs(delta));
  return delta > 0
    ? `${amount} dépensé de plus que le mois précédent`
    : `${amount} dépensé de moins que le mois précédent`;
}

const SPARK_H = 36;
const ENDPOINT_R = 2.5;

function monthLabelFr(): string {
  const raw = new Date().toLocaleDateString('fr-CA', { month: 'long' });
  return raw.charAt(0).toLowerCase() + raw.slice(1);
}

type DualToneSparklineProps = {
  data: number[];
  width: number;
  height: number;
  accentEndIndex: number;
  accentColor: string;
  mutedColor: string;
};

const DualToneSparkline = memo(function DualToneSparkline({
  data,
  width,
  height,
  accentEndIndex,
  accentColor,
  mutedColor,
}: DualToneSparklineProps) {
  const geometry = useMemo(() => {
    if (data.length < 2 || width <= 0) return null;

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

    return {
      accentPath: accentPts.length >= 2 ? toPath(accentPts) : '',
      mutedPath: mutedPts.length >= 2 ? toPath(mutedPts) : '',
      node: accentPts[accentPts.length - 1] ?? points[0],
    };
  }, [accentEndIndex, data, height, width]);

  if (!geometry) return <View style={{ height }} />;

  return (
    <Svg width={width} height={height}>
      {geometry.mutedPath ? (
        <Path
          d={geometry.mutedPath}
          stroke={mutedColor}
          strokeWidth={1.25}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {geometry.accentPath ? (
        <Path
          d={geometry.accentPath}
          stroke={accentColor}
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {geometry.node ? (
        <Circle cx={geometry.node.x} cy={geometry.node.y} r={ENDPOINT_R} fill={accentColor} />
      ) : null}
    </Svg>
  );
});

export function SpendAndSaveCard() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [spentMonth, setSpentMonth] = useState(0);
  const [spendVsPriorFooter, setSpendVsPriorFooter] = useState(
    'autant dépensé que le mois précédent',
  );
  const [spendSeries, setSpendSeries] = useState<number[]>([]);
  const [cardWidth, setCardWidth] = useState(0);

  const load = useCallback(async () => {
    await ensureDbReady();
    const month = startOfMonth(new Date());
    const priorMonth = previousCalendarMonth(month);
    const monthTx = await getTransactionsSince(monthSpendQueryLowerBound(priorMonth));

    const { series, total, activeIndex } = buildMonthSpendSummary(monthTx, month);
    const priorAligned = buildPriorMonthSpendSeriesAligned(monthTx, month, series.length);
    const priorAtSameDay = priorAligned[activeIndex] ?? 0;

    setSpentMonth(total);
    setSpendVsPriorFooter(spendVsPreviousMonthFooter(total, priorAtSameDay));
    setSpendSeries(series);
  }, []);

  useEffect(() => {
    void load();
    return dataEvents.subscribe(() => {
      void load();
    });
  }, [load]);

  useRefreshOnFocus(load, { minIntervalMs: 5_000 });

  const todayIdx = useMemo(() => monthSpendActiveIndex(startOfMonth(new Date())), []);
  const monthLabel = useMemo(() => monthLabelFr(), []);
  const spentLabel = formatDisplayMoneyAbsolute(spentMonth);

  const sparkBlue = COLORS.dark.blue;
  const sparkMuted = colors.borderStrong;

  const onCardLayout = useCallback((e: LayoutChangeEvent) => {
    const next = Math.floor(e.nativeEvent.layout.width);
    setCardWidth((prev) => (prev === next ? prev : next));
  }, []);

  const sparkW = Math.max(0, cardWidth - 28);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Dépenses et épargne, ${spentLabel} dépensé en ${monthLabel}, ${spendVsPriorFooter}, ouvrir les analyses`}
      onPress={() => {
        tapHaptic();
        router.push('/transactions-insights');
      }}
      onLayout={onCardLayout}
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
          {spentLabel}
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
        <Text style={[styles.footer, { color: colors.textMuted }]} numberOfLines={2}>
          {spendVsPriorFooter}
        </Text>
      </ProtoGlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardPress: {
    width: '100%',
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
