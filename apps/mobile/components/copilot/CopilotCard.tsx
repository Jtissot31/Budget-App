/**
 * Copilote — short, actionable tips computed from the user's data.
 * - `CopilotWidget`: compact Accueil card (top 2, one line each) → opens the Copilote hub.
 * - `CopilotCard`: full card (Centre d'alertes).
 * - `CopilotInsightRow`: one tip, shared by both and by the hub page.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppIcon } from '@/components/icons/AppIcon';
import { ListCard, PressScale, RingGauge, withAlpha } from '@/components/kit';
import { jakartaMediumText, jakartaSemiboldText, typographyKit } from '@/constants/theme';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { getCategoriesForMonth, initializeCategories } from '@/lib/budgetCategories';
import { mapBudgetCategoriesToUi } from '@/lib/budgetCategoryModel';
import { startOfMonth } from '@/lib/budgetMonth';
import {
  buildCopilotInsights,
  copilotHealthScore,
  copilotHeadline,
  type CopilotInput,
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
import { readScreenCache, refreshScreenCache, writeScreenCache } from '@/lib/screenCache';
import { useAppTheme } from '@/lib/themeContext';

const UPCOMING_DAYS = 14;
export const WARN_TONE = '#E0B354';

export type CopilotData = { insights: CopilotInsight[]; input: CopilotInput };

export function useCopilotInsights(): CopilotInsight[] | null {
  return useCopilotData()?.insights ?? null;
}

const COPILOT_CACHE_KEY = 'copilot';

/** Boot preload — Accueil widget and Copilote hub open with their content already there. */
export function preloadCopilotData(): Promise<unknown> {
  return refreshScreenCache(COPILOT_CACHE_KEY, fetchCopilotData);
}

async function fetchCopilotData(): Promise<CopilotData> {
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

    const input: CopilotInput = {
      now,
      liquidCash,
      upcoming,
      categories: mapBudgetCategoriesToUi(monthCats),
      monthlyIncome: dashboard?.monthlyIncome ?? 0,
      monthlyExpenses: dashboard?.monthlyExpenses ?? 0,
      subscriptionsMonthly: subs.monthlyTotal,
      subscriptionsCount: subs.count,
      goals: goals.map((g) => ({
        id: g.id,
        name: g.name,
        saved: g.currentAmount ?? 0,
        target: g.targetAmount ?? 0,
        icon: g.icon ?? null,
      })),
    };
    return { insights: buildCopilotInsights(input), input };
}

/** Tips plus the numbers they were computed from (charts on the Copilote hub). */
export function useCopilotData(): CopilotData | null {
  // Last snapshot first (preloaded at boot) — then refresh quietly in the background.
  const [data, setData] = useState<CopilotData | null>(() => readScreenCache<CopilotData>(COPILOT_CACHE_KEY) ?? null);

  const load = useCallback(async () => {
    const next = await refreshScreenCache(COPILOT_CACHE_KEY, fetchCopilotData);
    writeScreenCache(COPILOT_CACHE_KEY, next);
    setData(next);
  }, []);

  useEffect(() => {
    void load();
    return dataEvents.subscribe(() => void load());
  }, [load]);
  useRefreshOnFocus(load, { minIntervalMs: 5_000 });

  return data;
}

export function toneColor(tone: CopilotTone, colors: { danger: string; accentGreen: string; textMuted: string }): string {
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

      {visible.map((insight, index) => (
        <CopilotInsightRow
          key={insight.id}
          insight={insight}
          isLast={index === visible.length - 1 && hidden <= 0 && !expanded}
          onPress={insight.route ? () => router.push(insight.route as never) : undefined}
        />
      ))}

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

/** One tip. `compact` = single line, no detail, not tappable (rows inside the Accueil widget). */
export function CopilotInsightRow({
  insight,
  isLast = false,
  compact = false,
  borderTop = true,
  onPress,
}: {
  insight: CopilotInsight;
  isLast?: boolean;
  compact?: boolean;
  borderTop?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useAppTheme();
  const tone = toneColor(insight.tone, colors);
  const body = (
    <View
      style={[
        styles.row,
        compact && styles.rowCompact,
        borderTop ? { borderTopColor: colors.containerBorder } : styles.noBorder,
        isLast && styles.rowLast,
      ]}
    >
      <View style={[compact ? styles.iconCompact : styles.icon, { backgroundColor: withAlpha(toHex(tone), 0.12) }]}>
        <AppIcon family="ionicons" name={insight.icon as never} size={compact ? 14 : 17} color={tone} />
      </View>
      <View style={styles.copy}>
        <Text
          style={[compact ? styles.titleCompact : styles.title, jakartaSemiboldText, { color: colors.text }]}
          numberOfLines={compact ? 1 : 2}
        >
          {insight.title}
        </Text>
        {!compact ? (
          <Text style={[styles.detail, jakartaMediumText, { color: colors.textMuted }]} numberOfLines={3}>
            {insight.detail}
          </Text>
        ) : null}
      </View>
      {!compact && onPress ? (
        <AppIcon family="ionicons" name="chevron-forward" size={16} color={colors.textMuted} />
      ) : null}
    </View>
  );
  if (compact || !onPress) return body;
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={`${insight.title}. ${insight.detail}`}
      scaleTo={0.985}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
    >
      {body}
    </PressScale>
  );
}

const WIDGET_ROWS = 2;

/**
 * Accueil: header + the 2 most important tips, one line each. The whole card opens the hub.
 * `gentle` softens the status for Accueil (« 2 points à regarder », amber — never red « urgent »).
 */
export function CopilotWidget({ gentle = false }: { gentle?: boolean }) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const insights = useCopilotInsights();
  const headline = useMemo(() => (insights ? copilotHeadline(insights) : null), [insights]);
  if (!insights || insights.length === 0 || !headline) return null;

  const top = insights.slice(0, WIDGET_ROWS);
  const more = insights.length - top.length;
  const toWatch = insights.filter((i) => i.tone === 'risk' || i.tone === 'warn').length;
  const status = gentle
    ? toWatch > 0
      ? { title: `${toWatch} point${toWatch > 1 ? 's' : ''} à regarder`, color: WARN_TONE }
      : { title: 'Tout roule', color: colors.accentGreen }
    : { title: headline.title, color: toneColor(headline.tone, colors) };
  const headTone = status.color;

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={`Copilote, ${status.title}. Ouvrir tous les conseils`}
      scaleTo={0.985}
      onPress={() => {
        tapHaptic();
        router.push('/copilot' as never);
      }}
    >
      <ListCard>
        <View style={styles.head}>
          {/* Health score ring — same score as the Copilote hub. */}
          <RingGauge
            progress={copilotHealthScore(insights) / 100}
            color={toWatch > 0 ? WARN_TONE : colors.accentGreen}
            size={44}
            stroke={4}
          >
            <Text style={[styles.scoreText, jakartaSemiboldText, { color: colors.text }]}>{copilotHealthScore(insights)}</Text>
          </RingGauge>
          {/* Title on its own line, status pill (full size) right under it — never squeezes « Copilote ». */}
          <View style={styles.headStack}>
            <Text style={[styles.headTitle, jakartaSemiboldText, { color: colors.text }]} numberOfLines={1}>
              Copilote
            </Text>
            <View style={[styles.status, styles.statusStacked, { backgroundColor: withAlpha(toHex(headTone), 0.14) }]}>
              <View style={[styles.statusDot, { backgroundColor: headTone }]} />
              <Text style={[styles.statusText, { color: headTone }]} numberOfLines={1}>
                {status.title}
              </Text>
            </View>
          </View>
          <AppIcon family="ionicons" name="chevron-forward" size={16} color={colors.textMuted} />
        </View>
        {/* Two tip tiles side by side — icon first, short title, no paragraphs. */}
        <View style={styles.tiles}>
          {top.map((insight) => {
            const shown = gentle && insight.tone === 'risk' ? { ...insight, tone: 'warn' as const } : insight;
            const tone = toneColor(shown.tone, colors);
            return (
              <View key={insight.id} style={[styles.tipTile, { backgroundColor: withAlpha(toHex(tone), 0.08) }]}>
                <View style={[styles.tipIcon, { backgroundColor: withAlpha(toHex(tone), 0.18) }]}>
                  <AppIcon family="ionicons" name={shown.icon as never} size={16} color={tone} />
                </View>
                <Text style={[styles.tipTitle, jakartaSemiboldText, { color: colors.text }]} numberOfLines={3}>
                  {shown.title}
                </Text>
              </View>
            );
          })}
        </View>
        {more > 0 ? (
          <View style={styles.moreRow}>
            <View style={[styles.moreChip, { backgroundColor: colors.surfaceElevated }]}>
              <Text style={[styles.moreChipText, jakartaSemiboldText, { color: colors.textMuted }]}>
                +{more} conseil{more > 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        ) : null}
      </ListCard>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12 },
  spark: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  headTitle: { fontSize: 15, letterSpacing: -0.2, flexGrow: 1, flexShrink: 1 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 11, borderRadius: 14, flexShrink: 0 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  headStack: { flex: 1, minWidth: 0, alignItems: 'flex-start', gap: 6 },
  scoreText: { fontSize: 13 },
  tiles: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 12 },
  tipTile: { flex: 1, minWidth: 0, borderRadius: 16, padding: 12, gap: 10 },
  tipIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tipTitle: { fontSize: 13, lineHeight: 17, letterSpacing: -0.1 },
  moreRow: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 12, marginTop: -4 },
  moreChip: { height: 26, paddingHorizontal: 10, borderRadius: 13, justifyContent: 'center' },
  moreChipText: { fontSize: 12 },
  statusStacked: { maxWidth: '100%' },
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
  rowCompact: { paddingVertical: 10, gap: 10 },
  noBorder: { borderTopWidth: 0 },
  iconCompact: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  titleCompact: { fontSize: 13.5, lineHeight: 18, letterSpacing: -0.1 },
  moreHint: {
    fontSize: 12.5,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
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
