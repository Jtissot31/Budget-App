/**
 * Copilote hub — visual first: a health score ring, four mini-charts (cash cushion,
 * budget pace, savings rate, subscriptions), the closest goal, then every tip grouped
 * by priority. Calm palette: green when it's going well, amber otherwise — never red.
 */
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CopilotInsightRow, useCopilotData, WARN_TONE } from '@/components/copilot/CopilotCard';
import { FixedScreenHeader, fixedHeaderScreenStyle, fixedHeaderScrollStyle } from '@/components/FixedScreenHeader';
import { AppIcon } from '@/components/icons/AppIcon';
import { AnimatedBar, ListCard, PressScale, Reveal, RingGauge, SECTION_GAP, SectionLabel } from '@/components/kit';
import { usePopOnActive } from '@/components/kit/motion';
import { PageTransition } from '@/components/PageTransition';
import {
  FLOATING_NAV_CONTENT_PADDING,
  jakartaBoldText,
  jakartaMediumText,
  jakartaSemiboldText,
  PAGE_PADDING_HORIZONTAL,
  spacing,
} from '@/constants/theme';
import type { CopilotInsight } from '@/lib/copilotInsights';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

const GROUPS: { title: string; match: (insight: CopilotInsight) => boolean }[] = [
  { title: 'À regarder', match: (i) => i.tone === 'risk' || i.tone === 'warn' },
  { title: 'Bon à savoir', match: (i) => i.tone === 'info' },
  { title: 'Bien joué', match: (i) => i.tone === 'good' },
];

const CUSHION_DAYS = 14;
const money = formatDisplayMoneyAbsolute;

/** 0–100 from the tips: starts high, a little lower per point to watch, up with each win. */
function healthScore(insights: readonly CopilotInsight[]): number {
  let score = 86;
  for (const insight of insights) {
    if (insight.tone === 'risk') score -= 14;
    else if (insight.tone === 'warn') score -= 6;
    else if (insight.tone === 'good') score += 5;
  }
  return Math.max(30, Math.min(100, Math.round(score)));
}

function scoreCopy(score: number): { label: string; body: string } {
  if (score >= 80) return { label: 'Excellente forme', body: 'Tes finances tournent rond — continue comme ça.' };
  if (score >= 60) return { label: 'Bonne forme', body: 'Quelques ajustements et tu seras au top.' };
  return { label: 'On consolide', body: 'Un pas à la fois : commence par le premier point ci-dessous.' };
}

export default function CopilotScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const data = useCopilotData();
  const insights = data?.insights ?? null;
  const input = data?.input ?? null;

  const [shown, setShown] = useState(false);
  useEffect(() => setShown(true), []);
  const pop = usePopOnActive(shown && data != null, 1.08);

  const score = insights ? healthScore(insights) : 0;
  const scoreColor = score >= 60 ? colors.accentGreen : WARN_TONE;
  const copy = scoreCopy(score);

  const stats = useMemo(() => {
    if (!input) return null;
    const now = input.now;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthPct = now.getDate() / lastDay;
    const budgeted = input.categories.filter((c) => c.limit > 0);
    const limit = budgeted.reduce((s, c) => s + c.limit, 0);
    const spent = budgeted.reduce((s, c) => s + Math.max(0, c.spent), 0);
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + CUSHION_DAYS);
    const cutoffKey = cutoff.toISOString().slice(0, 10);
    const billsSoon = input.upcoming
      .filter((row) => row.dateKey <= cutoffKey)
      .reduce((s, row) => s + Math.abs(row.amount), 0);
    const savingsRate =
      input.monthlyIncome > 0 ? (input.monthlyIncome - input.monthlyExpenses) / input.monthlyIncome : null;
    const goal = [...input.goals]
      .filter((g) => g.target > 0 && g.saved < g.target)
      .sort((a, b) => b.saved / b.target - a.saved / a.target)[0] ?? null;
    return { monthPct, limit, spent, billsSoon, savingsRate, goal };
  }, [input]);

  const groups = useMemo(
    () =>
      GROUPS.map((group) => ({ title: group.title, items: (insights ?? []).filter(group.match) })).filter(
        (group) => group.items.length > 0,
      ),
    [insights],
  );

  const go = (href: Parameters<typeof router.push>[0]) => {
    tapHaptic();
    router.push(href);
  };

  const tileSurface = { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder };

  return (
    <PageTransition>
      <View style={[fixedHeaderScreenStyle, styles.screen, { backgroundColor: colors.background }]}>
        <FixedScreenHeader title="Copilote" onBack={() => router.back()} />
        <ScrollView
          style={fixedHeaderScrollStyle}
          contentContainerStyle={{
            paddingHorizontal: PAGE_PADDING_HORIZONTAL,
            paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING + spacing.xl,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* 1. Health score */}
          {insights ? (
            <Reveal style={[styles.hero, tileSurface]}>
              <View pointerEvents="none" style={[styles.heroGlow, { backgroundColor: scoreColor }]} />
              <Animated.View style={pop}>
                <RingGauge progress={score / 100} color={scoreColor} size={104} stroke={10}>
                  <Text style={[styles.scoreValue, { color: colors.text }]}>{score}</Text>
                  <Text style={[styles.scoreCaption, { color: colors.textMuted }]}>/ 100</Text>
                </RingGauge>
              </Animated.View>
              <View style={styles.heroCopy}>
                <View style={styles.heroTag}>
                  <AppIcon family="ionicons" name="sparkles" size={13} color={scoreColor} />
                  <Text style={[styles.heroTagText, { color: scoreColor }]}>Santé financière</Text>
                </View>
                <Text style={[styles.heroTitle, { color: colors.text }]}>{copy.label}</Text>
                <Text style={[styles.heroBody, { color: colors.textMuted }]}>{copy.body}</Text>
              </View>
            </Reveal>
          ) : null}

          {/* 2. Mini-charts */}
          {stats ? (
            <View style={styles.grid}>
              <Reveal index={1} style={styles.cell}>
                <PressScale accessibilityRole="button" onPress={() => go('/accounts')} scaleTo={0.96} style={[styles.tile, tileSurface]}>
                  <TileHead icon="shield-checkmark" title="Coussin" />
                  <Text style={[styles.tileValue, { color: colors.text }]} numberOfLines={1}>
                    {money(Math.max(0, input!.liquidCash))}
                  </Text>
                  <MiniBar label="Dispo" value={1} color={colors.accentGreen} />
                  <MiniBar
                    label={`Factures ${CUSHION_DAYS} j`}
                    value={input!.liquidCash > 0 ? stats.billsSoon / input!.liquidCash : stats.billsSoon > 0 ? 1 : 0}
                    color={input!.liquidCash >= stats.billsSoon ? colors.textSecondary : WARN_TONE}
                  />
                </PressScale>
              </Reveal>

              <Reveal index={2} style={styles.cell}>
                <PressScale accessibilityRole="button" onPress={() => go('/budgets')} scaleTo={0.96} style={[styles.tile, tileSurface]}>
                  <TileHead icon="speedometer" title="Rythme" />
                  <Text style={[styles.tileValue, { color: colors.text }]} numberOfLines={1}>
                    {stats.limit > 0 ? `${Math.round((stats.spent / stats.limit) * 100)} %` : '—'}
                  </Text>
                  <MiniBar
                    label="Budget utilisé"
                    value={stats.limit > 0 ? stats.spent / stats.limit : 0}
                    color={stats.limit > 0 && stats.spent / stats.limit > stats.monthPct + 0.05 ? WARN_TONE : colors.accentGreen}
                  />
                  <MiniBar label="Mois écoulé" value={stats.monthPct} color={colors.textMuted} />
                </PressScale>
              </Reveal>

              <Reveal index={3} style={styles.cell}>
                <PressScale accessibilityRole="button" onPress={() => go('/transactions-insights')} scaleTo={0.96} style={[styles.tile, tileSurface]}>
                  <TileHead icon="leaf" title="Épargne" />
                  <View style={styles.ringRow}>
                    <RingGauge
                      progress={Math.max(0, stats.savingsRate ?? 0)}
                      color={(stats.savingsRate ?? 0) > 0 ? colors.accentGreen : colors.textMuted}
                      size={58}
                      stroke={6}
                    >
                      <Text style={[styles.ringText, { color: colors.text }]}>
                        {stats.savingsRate == null ? '—' : `${Math.round(stats.savingsRate * 100)}%`}
                      </Text>
                    </RingGauge>
                    <Text style={[styles.tileCaption, styles.ringCaption, { color: colors.textMuted }]}>du revenu mis de côté ce mois</Text>
                  </View>
                </PressScale>
              </Reveal>

              <Reveal index={4} style={styles.cell}>
                <PressScale accessibilityRole="button" onPress={() => go('/subscriptions-insights')} scaleTo={0.96} style={[styles.tile, tileSurface]}>
                  <TileHead icon="repeat" title="Abonnements" />
                  <Text style={[styles.tileValue, { color: colors.text }]} numberOfLines={1}>
                    {money(input!.subscriptionsMonthly)}
                  </Text>
                  <Text style={[styles.tileCaption, { color: colors.textMuted }]}>
                    par mois · {input!.subscriptionsCount} actif{input!.subscriptionsCount > 1 ? 's' : ''}
                  </Text>
                  <Text style={[styles.tileCaption, { color: colors.textMuted }]}>
                    ≈ {money(input!.subscriptionsMonthly * 12)} / an
                  </Text>
                </PressScale>
              </Reveal>
            </View>
          ) : null}

          {/* 3. Closest goal */}
          {stats?.goal ? (
            <Reveal index={5} style={styles.section}>
              <PressScale
                accessibilityRole="button"
                onPress={() => go({ pathname: '/goal-detail', params: { goalId: stats.goal!.id } })}
                scaleTo={0.98}
                style={[styles.goal, tileSurface]}
              >
                <View style={styles.goalHead}>
                  <View style={[styles.goalIcon, { backgroundColor: `${colors.accentGreen}24` }]}>
                    <AppIcon family="ionicons" name="flag" size={16} color={colors.accentGreen} />
                  </View>
                  <View style={styles.goalCopy}>
                    <Text style={[styles.goalLabel, { color: colors.textMuted }]}>Objectif le plus proche</Text>
                    <Text style={[styles.goalName, { color: colors.text }]} numberOfLines={1}>
                      {stats.goal.name}
                    </Text>
                  </View>
                  <Text style={[styles.goalPct, { color: colors.accentGreen }]}>
                    {Math.round((stats.goal.saved / stats.goal.target) * 100)} %
                  </Text>
                </View>
                <AnimatedBar
                  progress={stats.goal.saved / stats.goal.target}
                  color={colors.accentGreen}
                  trackColor={colors.borderSubtle}
                  height={8}
                  delay={200}
                />
                <Text style={[styles.goalMeta, { color: colors.textMuted }]}>
                  {money(stats.goal.saved)} sur {money(stats.goal.target)} · encore {money(stats.goal.target - stats.goal.saved)}
                </Text>
              </PressScale>
            </Reveal>
          ) : null}

          {/* 4. Tips */}
          {insights && insights.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>Rien à signaler pour l’instant — bravo !</Text>
          ) : null}
          {groups.map((group, groupIndex) => (
            <Reveal key={group.title} index={groupIndex + 6} style={styles.section}>
              <SectionLabel title={group.title} />
              <ListCard>
                {group.items.map((insight, index) => (
                  <CopilotInsightRow
                    key={insight.id}
                    // Calm palette here too: « risk » reads as amber, not red.
                    insight={insight.tone === 'risk' ? { ...insight, tone: 'warn' } : insight}
                    borderTop={index > 0}
                    isLast={index === group.items.length - 1}
                    onPress={insight.route ? () => router.push(insight.route as never) : undefined}
                  />
                ))}
              </ListCard>
            </Reveal>
          ))}
        </ScrollView>
      </View>
    </PageTransition>
  );
}

function TileHead({ icon, title }: { icon: string; title: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.tileHead}>
      <AppIcon family="ionicons" name={icon} size={14} color={colors.textMuted} />
      <Text style={[styles.tileTitle, { color: colors.textMuted }]}>{title}</Text>
    </View>
  );
}

function MiniBar({ label, value, color }: { label: string; value: number; color: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.miniBar}>
      <Text style={[styles.miniLabel, { color: colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
      <AnimatedBar progress={Math.min(1, value)} color={color} trackColor={colors.borderSubtle} height={5} delay={150} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  section: { marginBottom: SECTION_GAP + spacing.sm },

  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  heroGlow: { position: 'absolute', top: -70, left: -50, width: 200, height: 200, borderRadius: 100, opacity: 0.1 },
  scoreValue: { ...jakartaBoldText, fontSize: 30, letterSpacing: -1, lineHeight: 34 },
  scoreCaption: { ...jakartaMediumText, fontSize: 11 },
  heroCopy: { flex: 1, minWidth: 0, gap: 4 },
  heroTag: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroTagText: { ...jakartaSemiboldText, fontSize: 12 },
  heroTitle: { ...jakartaBoldText, fontSize: 20, letterSpacing: -0.3 },
  heroBody: { ...jakartaMediumText, fontSize: 13, lineHeight: 18 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5, marginBottom: SECTION_GAP - 4 },
  cell: { width: '50%', paddingHorizontal: 5, paddingBottom: 10 },
  tile: { borderRadius: 20, borderWidth: 1, padding: 14, gap: 8, minHeight: 150 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileTitle: { ...jakartaSemiboldText, fontSize: 12.5 },
  tileValue: { ...jakartaBoldText, fontSize: 20, letterSpacing: -0.4 },
  tileCaption: { ...jakartaMediumText, fontSize: 12, lineHeight: 16 },
  miniBar: { gap: 4 },
  miniLabel: { ...jakartaMediumText, fontSize: 11 },
  ringRow: { alignItems: 'flex-start', gap: 8 },
  ringText: { ...jakartaBoldText, fontSize: 13 },
  ringCaption: { marginTop: 2 },

  goal: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 12 },
  goalHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  goalIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  goalCopy: { flex: 1, minWidth: 0, gap: 1 },
  goalLabel: { ...jakartaMediumText, fontSize: 12 },
  goalName: { ...jakartaSemiboldText, fontSize: 15 },
  goalPct: { ...jakartaBoldText, fontSize: 18 },
  goalMeta: { ...jakartaMediumText, fontSize: 12.5 },

  empty: { ...jakartaMediumText, fontSize: 14, textAlign: 'center', paddingVertical: spacing.xl },
});
