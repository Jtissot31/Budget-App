/**
 * Copilote — short, actionable tips computed from the user's data.
 * Self-loading so it can sit on Accueil and at the top of Messages.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppIcon } from '@/components/icons/AppIcon';
import { ListCard, PressScale, withAlpha } from '@/components/kit';
import { jakartaMediumText, jakartaSemiboldText, typographyKit } from '@/constants/theme';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { getCategoriesForMonth, initializeCategories } from '@/lib/budgetCategories';
import { mapBudgetCategoriesToUi } from '@/lib/budgetCategoryModel';
import { startOfMonth } from '@/lib/budgetMonth';
import {
  buildCopilotInsights,
  copilotHeadline,
  type CopilotInsight,
  type CopilotTone,
} from '@/lib/copilotInsights';
import { getDashboard, getLoans, getRecurringPayments, getSavingsGoals, getSimulatedAccounts } from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { tapHaptic } from '@/lib/haptics';
import { ensureDbReady } from '@/lib/init';
import { buildRecurringBillsByDate } from '@/lib/protoAgendaBills';
import { buildLoanByRecurringPaymentId } from '@/lib/recurringPaymentPresentation';
import { analyzeSubscriptions } from '@/lib/subscriptionAnalysis';
import { useAppTheme } from '@/lib/themeContext';

const UPCOMING_DAYS = 14;
const WARN_TONE = '#E0B354';

export function useCopilotInsights(): CopilotInsight[] | null {
  const [insights, setInsights] = useState<CopilotInsight[] | null>(null);

  const load = useCallback(async () => {
    await ensureDbReady();
    await initializeCategories();
    const now = new Date();
    const [accounts, monthCats, dashboard, payments, loans, goals] = await Promise.all([
      getSimulatedAccounts(),
      getCategoriesForMonth(startOfMonth(now)),
      getDashboard(),
      getRecurringPayments(),
      getLoans(),
      getSavingsGoals(),
    ]);

    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + UPCOMING_DAYS);
    const byDate = buildRecurringBillsByDate(payments, start, end);
    const upcoming = Object.keys(byDate)
      .sort()
      .flatMap((dateKey) =>
        (byDate[dateKey] ?? [])
          .filter((bill) => (bill.kind ?? 'payment') !== 'income')
          .map((bill) => ({ dateKey, amount: bill.amount })),
      );

    const subs = analyzeSubscriptions(payments, new Set(buildLoanByRecurringPaymentId(loans).keys()));
    const liquidCash = accounts
      .filter((a) => !a.hidden && (a.kind === 'checking' || a.kind === 'savings' || a.kind === 'cash'))
      .reduce((sum, a) => sum + a.balance, 0);

    setInsights(
      buildCopilotInsights({
        now,
        liquidCash,
        upcoming,
        categories: mapBudgetCategoriesToUi(monthCats),
        monthlyIncome: dashboard?.monthlyIncome ?? 0,
        monthlyExpenses: dashboard?.monthlyExpenses ?? 0,
        subscriptionsMonthly: subs.monthlyTotal,
        subscriptionsCount: subs.count,
        goals: goals.map((g) => ({ id: g.id, name: g.name, saved: g.currentAmount ?? 0, target: g.targetAmount ?? 0 })),
      }),
    );
  }, []);

  useEffect(() => {
    void load();
    return dataEvents.subscribe(() => void load());
  }, [load]);
  useRefreshOnFocus(load, { minIntervalMs: 5_000 });

  return insights;
}

function toneColor(tone: CopilotTone, colors: { danger: string; accentGreen: string; textMuted: string }): string {
  if (tone === 'risk') return colors.danger;
  if (tone === 'warn') return WARN_TONE;
  if (tone === 'good') return colors.accentGreen;
  return colors.textMuted;
}

function toHex(color: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? color : '#8E8E9A';
}

type Props = {
  /** Rows shown before « Voir plus ». */
  limit?: number;
};

export function CopilotCard({ limit = 3 }: Props) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const insights = useCopilotInsights();
  const [expanded, setExpanded] = useState(false);

  const headline = useMemo(() => (insights ? copilotHeadline(insights) : null), [insights]);
  if (!insights || insights.length === 0 || !headline) return null;

  const visible = expanded ? insights : insights.slice(0, limit);
  const hidden = insights.length - visible.length;
  const headTone = toneColor(headline.tone, colors);

  return (
    <ListCard>
      <View style={styles.head}>
        <View style={[styles.spark, { backgroundColor: colors.surfaceElevated }]}>
          <AppIcon family="ionicons" name="sparkles" size={15} color={colors.text} />
        </View>
        <Text style={[styles.headTitle, jakartaSemiboldText, { color: colors.text }]}>Copilote</Text>
        <View style={[styles.status, { backgroundColor: withAlpha(toHex(headTone), 0.14) }]}>
          <View style={[styles.statusDot, { backgroundColor: headTone }]} />
          <Text style={[styles.statusText, { color: headTone }]}>
            {headline.title}
          </Text>
        </View>
      </View>

      {visible.map((insight, index) => {
        const tone = toneColor(insight.tone, colors);
        const isLast = index === visible.length - 1 && hidden <= 0 && !expanded;
        return (
          <PressScale
            key={insight.id}
            accessibilityRole="button"
            accessibilityLabel={`${insight.title}. ${insight.detail}`}
            scaleTo={0.985}
            disabled={!insight.route}
            onPress={() => {
              if (!insight.route) return;
              tapHaptic();
              router.push(insight.route as never);
            }}
          >
            <View
              style={[
                styles.row,
                { borderTopColor: colors.containerBorder },
                isLast && styles.rowLast,
              ]}
            >
              <View style={[styles.icon, { backgroundColor: withAlpha(toHex(tone), 0.12) }]}>
                <AppIcon family="ionicons" name={insight.icon as never} size={17} color={tone} />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.title, jakartaSemiboldText, { color: colors.text }]} numberOfLines={2}>
                  {insight.title}
                </Text>
                <Text style={[styles.detail, jakartaMediumText, { color: colors.textMuted }]} numberOfLines={3}>
                  {insight.detail}
                </Text>
              </View>
              {insight.route ? (
                <AppIcon family="ionicons" name="chevron-forward" size={16} color={colors.textMuted} />
              ) : null}
            </View>
          </PressScale>
        );
      })}

      {hidden > 0 || expanded ? (
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Afficher moins de conseils' : 'Afficher tous les conseils'}
          onPress={() => {
            tapHaptic();
            setExpanded((value) => !value);
          }}
        >
          <View style={[styles.more, { borderTopColor: colors.containerBorder }]}>
            <Text style={[styles.moreText, jakartaSemiboldText, { color: colors.text }]}>
              {expanded ? 'Voir moins' : `Voir ${hidden} conseil${hidden > 1 ? 's' : ''} de plus`}
            </Text>
            <AppIcon
              family="ionicons"
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={colors.textMuted}
            />
          </View>
        </PressScale>
      ) : null}
    </ListCard>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12 },
  spark: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  headTitle: { fontSize: 15, letterSpacing: -0.2, flexGrow: 1, flexShrink: 1 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 11, borderRadius: 14, flexShrink: 0 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { ...typographyKit.metaSemibold, fontSize: 12.5 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowLast: { paddingBottom: 14 },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  copy: { flexShrink: 1, flexGrow: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 14, lineHeight: 18, letterSpacing: -0.15 },
  detail: { fontSize: 12, lineHeight: 16 },
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  moreText: { fontSize: 13 },
});
