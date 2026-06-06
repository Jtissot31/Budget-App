import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { DashboardCard } from '@/components/DashboardCard';
import { DashboardProgressBar } from '@/components/DashboardProgressBar';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { dashboardPalette, interBoldText, interMediumText, percentStat, spacing, typography } from '@/constants/theme';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { singleLineAmountProps } from '@/lib/textLayout';
import { useAppTheme } from '@/lib/themeContext';
import type { DashboardSummary } from '@/types';

type BudgetInsightTone = 'safe' | 'warning' | 'danger';

function formatMoney(value: number) {
  return formatDisplayMoneyAbsolute(value);
}

function budgetUsageColor(usedPercent: number, isLight: boolean) {
  if (usedPercent >= 100) return isLight ? '#CF222E' : dashboardPalette.red;
  if (usedPercent >= 80) return isLight ? '#D97706' : dashboardPalette.warning;
  return isLight ? '#00A854' : dashboardPalette.green;
}

function projectMonthExpenses(spent: number, today = new Date()) {
  const day = Math.max(1, today.getDate());
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return (spent / day) * daysInMonth;
}

function getMonthlyBudgetInsight(
  summary: DashboardSummary | null,
  projectedExpenses: number,
): { message: string; tone: BudgetInsightTone } {
  const limit = summary?.monthlyBudgetLimit ?? 0;
  const spent = summary?.monthlyExpenses ?? 0;
  const isOverBudget = limit > 0 && spent > limit;

  if (limit <= 0) {
    return { message: 'Ajoute des limites par catégorie pour suivre ton budget.', tone: 'warning' };
  }
  if (isOverBudget) {
    return {
      message: 'Tu as dépassé ta limite mensuelle — ajuste tes dépenses ou tes catégories.',
      tone: 'danger',
    };
  }
  const progress = spent / limit;
  if (projectedExpenses > limit) {
    return {
      message: 'À ce rythme, risque de dépassement — ralentis les achats.',
      tone: 'warning',
    };
  }
  if (progress >= 0.82) {
    return { message: 'Peu de marge avant la fin du mois — sois vigilant.', tone: 'warning' };
  }
  return { message: 'Bon rythme, tu respectes bien ton budget.', tone: 'safe' };
}

function insightChipStyle(tone: BudgetInsightTone, isLight: boolean) {
  if (tone === 'danger') {
    return {
      backgroundColor: isLight ? 'rgba(207,34,46,0.08)' : 'rgba(255,85,85,0.1)',
      borderColor: isLight ? 'rgba(207,34,46,0.22)' : 'rgba(255,85,85,0.28)',
      sparkColor: isLight ? '#CF222E' : dashboardPalette.red,
      textColor: isLight ? 'rgba(15,23,42,0.82)' : 'rgba(255,255,255,0.78)',
    };
  }
  if (tone === 'warning') {
    return {
      backgroundColor: isLight ? 'rgba(217,119,6,0.08)' : 'rgba(230,160,0,0.1)',
      borderColor: isLight ? 'rgba(217,119,6,0.22)' : 'rgba(230,160,0,0.28)',
      sparkColor: isLight ? '#D97706' : dashboardPalette.warning,
      textColor: isLight ? 'rgba(15,23,42,0.82)' : 'rgba(255,255,255,0.78)',
    };
  }
  return {
    backgroundColor: isLight ? 'rgba(0,168,84,0.08)' : 'rgba(0,230,100,0.06)',
    borderColor: isLight ? 'rgba(0,168,84,0.2)' : 'rgba(0,230,100,0.15)',
    sparkColor: isLight ? '#00A854' : dashboardPalette.green,
    textColor: isLight ? 'rgba(15,23,42,0.82)' : 'rgba(255,255,255,0.75)',
  };
}

function MonthUsageRing({ pct, accentColor }: { pct: number; accentColor: string }) {
  const { colors, isLight } = useAppTheme();
  const r = 54;
  const cx = 64;
  const cy = 64;
  const circ = 2 * Math.PI * r;
  const capped = Math.min(Math.max(pct, 0), 100);
  const dash = (capped / 100) * circ;
  const gap = circ - dash;
  const track = isLight ? colors.border : dashboardPalette.iconBox;
  const gradientId = `monthRing-${accentColor.replace(/[^a-z0-9]/gi, '')}`;

  return (
    <Svg width={128} height={128} viewBox="0 0 128 128">
      <Circle cx={cx} cy={cy} r={r} fill="none" stroke={track} strokeWidth={10} />
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={accentColor}
        strokeWidth={10}
        strokeOpacity={0.14}
        strokeDasharray={`${dash + 4} ${gap - 4}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
      />
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={9}
        strokeDasharray={`${dash} ${gap}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
      />
      <Circle cx={cx} cy={cy} r={40} fill="none" stroke={colors.border} strokeWidth={1} opacity={0.85} />
      <Defs>
        <SvgLinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={accentColor} />
          <Stop offset="100%" stopColor={accentColor} stopOpacity={0.72} />
        </SvgLinearGradient>
      </Defs>
    </Svg>
  );
}

function StatRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  const { colors, isLight } = useAppTheme();
  const muted = isLight ? colors.textMuted : '#909090';

  return (
    <View style={styles.statRow}>
      <Text style={[styles.statLabel, { color: muted }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.statValue, { color: valueColor ?? colors.text }]} {...singleLineAmountProps}>
        {value}
      </Text>
    </View>
  );
}

type Props = {
  dashboard: DashboardSummary | null;
  activeCategoryCount: number;
};

export function BudgetMonthOverview({ dashboard, activeCategoryCount }: Props) {
  const { colors, isLight } = useAppTheme();
  const mutedTextColor = isLight ? colors.textMuted : '#909090';
  const limit = dashboard?.monthlyBudgetLimit ?? 0;
  const spent = dashboard?.monthlyExpenses ?? 0;
  const remaining = limit - spent;
  const usedPercent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
  const ringPct = limit > 0 ? Math.min(usedPercent, 100) : 0;
  const insight = useMemo(
    () => getMonthlyBudgetInsight(dashboard, projectMonthExpenses(spent)),
    [dashboard, spent],
  );
  const usageTint = budgetUsageColor(usedPercent, isLight);
  const chip = insightChipStyle(insight.tone, isLight);

  return (
    <DashboardCard style={styles.card} innerStyle={styles.cardInner} padding={spacing.lg}>
      {limit > 0 ? (
        <View style={styles.ringRow}>
          <View style={styles.ringWrap}>
            <MonthUsageRing pct={ringPct} accentColor={usageTint} />
            <View style={styles.ringCenter} pointerEvents="none">
              <Text style={[styles.ringPct, { color: usageTint }]} {...singleLineAmountProps}>
                {`${usedPercent}%`}
              </Text>
              <Text style={[styles.ringPctLabel, { color: mutedTextColor }]}>utilisé</Text>
            </View>
          </View>
          <View style={styles.ringCopy}>
            <DashboardSectionLabel numberOfLines={1}>Budget du mois</DashboardSectionLabel>
            <View style={styles.statList}>
              <StatRow label="Dépensé" value={formatMoney(spent)} />
              <StatRow label="Limite" value={formatMoney(limit)} />
              <StatRow
                label="Reste"
                value={formatMoney(Math.max(0, remaining))}
                valueColor={remaining < 0 ? (isLight ? '#CF222E' : dashboardPalette.red) : usageTint}
              />
            </View>
            <View style={styles.miniBarBlock}>
              <DashboardProgressBar pct={ringPct} color={usageTint} height={6} />
              <Text style={[styles.barHint, { color: mutedTextColor }]} numberOfLines={2}>
                {remaining >= 0
                  ? `Il te reste ${formatMoney(remaining)} avant la fin du mois.`
                  : `Dépassement de ${formatMoney(Math.abs(remaining))} ce mois-ci.`}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.emptyBlock}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Aucune limite définie</Text>
          <Text style={[styles.emptyHint, { color: mutedTextColor }]}>
            {activeCategoryCount > 0
              ? 'Ajoute une limite mensuelle à tes catégories pour suivre ta progression.'
              : 'Crée ta première catégorie pour commencer à budgétiser.'}
          </Text>
        </View>
      )}

      <View style={[styles.insightChip, { backgroundColor: chip.backgroundColor, borderColor: chip.borderColor }]}>
        <Text style={[styles.insightSpark, { color: chip.sparkColor }]}>✦</Text>
        <Text style={[styles.insightText, { color: chip.textColor }]}>{insight.message}</Text>
      </View>
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'stretch' },
  cardInner: { gap: spacing.lg },
  ringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minWidth: 0,
  },
  ringWrap: {
    width: 128,
    height: 128,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  ringPct: { ...percentStat, maxWidth: 72 },
  ringPctLabel: {
    ...interMediumText,
    fontSize: typography.micro,
    marginTop: 2,
  },
  ringCopy: { flex: 1, minWidth: 0, gap: spacing.sm },
  statList: { gap: spacing.xs, marginTop: spacing.xs },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  statLabel: {
    ...interMediumText,
    fontSize: typography.micro,
    fontWeight: '700',
  },
  statValue: {
    ...interBoldText,
    fontSize: typography.caption,
  },
  miniBarBlock: { gap: spacing.xs, marginTop: spacing.xs },
  barHint: {
    ...interMediumText,
    fontSize: typography.micro,
    lineHeight: typography.micro + 4,
  },
  emptyBlock: { gap: spacing.sm },
  emptyTitle: { ...interBoldText, fontSize: typography.body },
  emptyHint: { ...interMediumText, fontSize: typography.caption, lineHeight: 20 },
  insightChip: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  insightSpark: { fontSize: typography.body },
  insightText: {
    flex: 1,
    ...interMediumText,
    fontSize: typography.meta,
    lineHeight: typography.meta + 5,
  },
});
