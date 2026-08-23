/**
 * Budget Proto Accueil — valeur nette, alertes, transactions récentes.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/icons/AppIcon';
import { HomeAlertGlyph } from '@/components/alerts/HomeAlertGlyph';
import { PageTransition } from '@/components/PageTransition';
import { PremiumSwitch } from '@/components/PremiumSwitch';
import { ProtoGlassCard } from '@/components/proto/ProtoGlassCard';
import {
  ProtoShortcutRow,
  SHORTCUT_TILE_GAP,
  type ProtoShortcutItem,
} from '@/components/proto/ProtoShortcutRow';
import { ProtoSectionHeader } from '@/components/proto/ProtoSectionHeader';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { SparklineChart } from '@/components/chat/SparklineChart';
import { TransactionRow } from '@/components/TransactionRow';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import { onyxContainerPressedStyle } from '@/constants/planFinanceKit';
import {
  FLOATING_NAV_CONTENT_PADDING,
  moneyAmountTypography,
  PAGE_PADDING_HORIZONTAL,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { useAlertCenter } from '@/hooks/useAlertCenter';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { alertDetailRouteParams, formatAlertClockTime } from '@/lib/alerts';
import {
  alertHomeActionLine,
  alertHomePrimaryTitle,
  homeAlertPreviewAccent,
  homeAlertPreviewSurface,
} from '@/lib/alertPresentation';
import {
  buildNetWorthDailySeries,
  buildNetWorthTrendFromTransactions,
  buildNetWorthWeeklySeriesForPeriod,
} from '@/lib/buildNetWorthTrendSeries';
import { ensureDbReady } from '@/lib/init';
import {
  getRecentIncomeTransactions,
  getRecurringPayments,
  getSimulatedAccounts,
  getTransactions,
  getTransactionsSince,
} from '@/lib/db';
import { dataEvents } from '@/lib/events';
import {
  COMPACT_DELTA_K_THRESHOLD,
  formatDisplayMoneyAbsolute,
  formatSignedDisplayMoney,
} from '@/lib/formatDisplayMoney';
import { openTransactionDetail } from '@/lib/openTransactionDetail';
import { tapHaptic } from '@/lib/haptics';
import { syncWithServer } from '@/lib/sync';
import { useAppTheme } from '@/lib/themeContext';
import type { RecurringPayment, SimulatedAccount, Transaction } from '@/types';

type ChartPeriod = '1M' | '3M' | '6M' | '1A' | '5A';

const PERIOD_TABS: { id: ChartPeriod; label: string }[] = [
  { id: '1M', label: '1M' },
  { id: '3M', label: '3M' },
  { id: '6M', label: '6M' },
  { id: '1A', label: '1A' },
  { id: '5A', label: '5A' },
];

const PERIOD_DAY_COUNT: Record<ChartPeriod, number> = {
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1A': 365,
  '5A': 365 * 5,
};

function sparklineSinceIso(dayCount: number): string {
  const since = new Date();
  since.setDate(since.getDate() - (dayCount + 1));
  since.setHours(0, 0, 0, 0);
  return since.toISOString();
}

function downsampleSeries(values: number[], maxPoints: number): number[] {
  if (values.length <= maxPoints) return values;
  const out: number[] = [];
  const step = (values.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i += 1) {
    out.push(values[Math.round(i * step)] ?? 0);
  }
  return out;
}

/** Accueil: keep recent-tx data loaded; set true to show the Récentes block again. */
const SHOW_RECENTES = false;

/** Accueil NOTIFICATIONS & ALERTES — two cards, then an in-place expand for the rest. */
const HOME_ALERT_PREVIEW_LIMIT = 2;

export function ProtoHomeHub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isLight, setMode } = useAppTheme();
  const [accounts, setAccounts] = useState<SimulatedAccount[]>([]);
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);
  const [incomeTransactions, setIncomeTransactions] = useState<Transaction[]>([]);
  const [sparklineTx, setSparklineTx] = useState<Transaction[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('6M');
  const [chartWidth, setChartWidth] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [homeAlertsExpanded, setHomeAlertsExpanded] = useState(false);

  const {
    items: alertCenterItems,
  } = useAlertCenter({
    recurringPayments,
    simulatedAccounts: accounts,
    incomeTransactions,
  });

  const load = useCallback(async () => {
    await ensureDbReady();
    const dayCount = PERIOD_DAY_COUNT[chartPeriod];
    const [nextAccounts, payments, income, sparkTx, allTx] = await Promise.all([
      getSimulatedAccounts(),
      getRecurringPayments(),
      getRecentIncomeTransactions(),
      getTransactionsSince(sparklineSinceIso(dayCount)),
      getTransactions(),
    ]);
    setAccounts(nextAccounts);
    setRecurringPayments(payments);
    setIncomeTransactions(income);
    setSparklineTx(sparkTx);
    const sorted = [...allTx].sort((a, b) => b.date.localeCompare(a.date));
    setRecentTransactions(sorted.slice(0, 5));
  }, [chartPeriod]);

  useEffect(() => {
    void load();
    return dataEvents.subscribe(() => {
      void load();
    });
  }, [load]);

  useRefreshOnFocus(load, { minIntervalMs: 5_000 });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await syncWithServer().catch(() => undefined);
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const totalNetWorth = useMemo(
    () => accounts.filter((a) => !a.hidden).reduce((sum, a) => sum + a.balance, 0),
    [accounts],
  );

  const visibleAccounts = useMemo(
    () => accounts.filter((a) => !a.hidden),
    [accounts],
  );

  const sparklineValues = useMemo(() => {
    if (chartPeriod === '1M') {
      const daily = buildNetWorthDailySeries(
        'accounts_only',
        totalNetWorth,
        visibleAccounts,
        0,
        sparklineTx,
        new Date(),
        30,
      ).map((point) => point.value);
      return downsampleSeries(daily, 24);
    }
    if (chartPeriod === '3M' || chartPeriod === '6M') {
      return buildNetWorthWeeklySeriesForPeriod(
        'accounts_only',
        totalNetWorth,
        visibleAccounts,
        0,
        sparklineTx,
        chartPeriod === '3M' ? 3 : 6,
      ).map((point) => point.value);
    }
    const months = chartPeriod === '5A' ? 60 : 12;
    return buildNetWorthTrendFromTransactions(
      'accounts_only',
      totalNetWorth,
      visibleAccounts,
      0,
      sparklineTx,
      new Date(),
      months,
      0,
    ).map((point) => point.value);
  }, [chartPeriod, sparklineTx, totalNetWorth, visibleAccounts]);

  const delta = useMemo(() => {
    if (sparklineValues.length < 2) return { amount: 0, pct: 0 };
    const first = sparklineValues[0] ?? 0;
    const last = sparklineValues[sparklineValues.length - 1] ?? 0;
    const amount = last - first;
    const pct = first !== 0 ? (amount / Math.abs(first)) * 100 : 0;
    return { amount, pct };
  }, [sparklineValues]);

  const heroPositive = delta.amount >= 0;
  const displayHero = totalNetWorth;
  const remainingAlertCount = Math.max(0, alertCenterItems.length - HOME_ALERT_PREVIEW_LIMIT);
  const moreAlertsCollapsedLabel =
    remainingAlertCount === 1
      ? 'Voir l’autre alerte'
      : `Voir les ${remainingAlertCount} autres alertes`;
  const previewAlerts =
    homeAlertsExpanded || remainingAlertCount === 0
      ? alertCenterItems
      : alertCenterItems.slice(0, HOME_ALERT_PREVIEW_LIMIT);

  const onChartLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.width);
    setChartWidth((prev) => (prev === next ? prev : next));
  }, []);

  const onThemeSwitch = useCallback(
    (light: boolean) => {
      tapHaptic();
      void setMode(light ? 'light' : 'dark');
    },
    [setMode],
  );

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <ScrollView
          style={styles.screen}
          contentContainerStyle={{
            paddingTop: insets.top + SCREEN_TOP_GUTTER,
            paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING,
            paddingHorizontal: PAGE_PADDING_HORIZONTAL,
            gap: 18,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          <View style={styles.topChrome}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ouvrir les réglages"
              onPress={() => {
                tapHaptic();
                router.push('/settings');
              }}
              style={({ pressed }) => [
                styles.profileBtn,
                { backgroundColor: colors.containerBackground },
                pressed && onyxContainerPressedStyle(),
              ]}
            >
              <AppIcon family="ionicons" name="person-outline" size={22} color={colors.text} />
            </Pressable>
            <View style={styles.themeSwitchRow}>
              <PremiumSwitch
                value={isLight}
                onValueChange={onThemeSwitch}
                trackOnColor={
                  isLight ? 'rgba(0, 0, 0, 0.32)' : 'rgba(255, 255, 255, 0.28)'
                }
                leftIcon={
                  <AppIcon
                    family="ionicons"
                    name="sunny-outline"
                    size={16}
                    strokeWidth={3}
                    color={isLight ? '#C2410C' : colors.warning}
                  />
                }
                rightIcon={
                  <AppIcon
                    family="ionicons"
                    name="moon-outline"
                    size={16}
                    strokeWidth={3}
                    color={isLight ? colors.textMuted : colors.purple}
                  />
                }
                accessibilityLabel={
                  isLight ? 'Thème clair activé. Passer en mode sombre' : 'Thème sombre activé. Passer en mode clair'
                }
              />
            </View>
          </View>

          <View style={styles.heroBlock}>
            <Text style={[styles.heroEyebrow, { color: colors.textMuted }]}>Valeur nette</Text>
            <Text
              style={[
                moneyAmountTypography({ tier: 'hero', fontSize: 36 }),
                { color: colors.text, textAlign: 'center', letterSpacing: -1 },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
            >
              {formatDisplayMoneyAbsolute(displayHero)}
            </Text>
            <View style={styles.deltaWrap}>
              <View style={[styles.deltaPill, { backgroundColor: colors.surfaceElevated }]}>
                <AppIcon
                  family="ionicons"
                  name={heroPositive ? 'arrow-up-outline' : 'arrow-down-outline'}
                  size={11}
                  color={heroPositive ? colors.accentGreen : colors.danger}
                />
                <Text
                  style={[
                    styles.deltaText,
                    { color: heroPositive ? colors.accentGreen : colors.danger },
                  ]}
                >
                  {formatSignedDisplayMoney(delta.amount, {
                    leadingPlusWhenPositive: true,
                    compactKThreshold: COMPACT_DELTA_K_THRESHOLD,
                  })}{' '}
                  · {heroPositive ? '+' : '−'}
                  {Math.abs(delta.pct).toFixed(1)}%
                </Text>
              </View>
            </View>

            <View style={styles.chartWrap} onLayout={onChartLayout}>
              {chartWidth > 0 && sparklineValues.length >= 2 ? (
                <SparklineChart
                  data={sparklineValues}
                  width={chartWidth}
                  height={96}
                  positive={heroPositive}
                  showFill
                  showEndpointDot
                  strokeWidth={2}
                />
              ) : (
                <View style={{ height: 96 }} />
              )}
            </View>

            <View style={styles.periodRow}>
              <SegmentedTabs
                tabs={PERIOD_TABS}
                active={chartPeriod}
                onChange={(id) => {
                  tapHaptic();
                  setChartPeriod(id);
                }}
                size="section"
                variant="bare"
                showDivider={false}
              />
            </View>
          </View>

          <View>
            <ProtoSectionHeader
              title="Notifications & alertes"
              actionLabel="Tout voir"
              onAction={() => router.push('/alert-center')}
            />
            <View style={styles.alertStack}>
              {previewAlerts.length === 0 ? (
                <ProtoGlassCard style={homeAlertPreviewSurface(colors, isLight)} padding={14}>
                  <Text style={[styles.emptyCopy, { color: colors.textMuted }]}>
                    Aucune alerte pour le moment
                  </Text>
                </ProtoGlassCard>
              ) : (
                previewAlerts.map((item) => {
                  const accent = homeAlertPreviewAccent(item, colors, isLight);
                  const surface = homeAlertPreviewSurface(colors, isLight);
                  const reason = alertHomePrimaryTitle(item);
                  const action = alertHomeActionLine(item);
                  const clock = formatAlertClockTime(item.timestamp);
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      onPress={() => {
                        tapHaptic();
                        router.push({
                          pathname: '/alert-detail',
                          params: alertDetailRouteParams(item),
                        });
                      }}
                      style={({ pressed }) => [pressed && { opacity: 0.85 }]}
                    >
                      <ProtoGlassCard style={[styles.alertCard, surface]} padding={0}>
                        <View style={styles.alertInner}>
                          <View style={[styles.alertIcon, { backgroundColor: accent.iconBg }]}>
                            <HomeAlertGlyph icon={accent.icon} color={accent.iconColor} size={16} />
                          </View>
                          <View style={styles.alertCopy}>
                            <View style={styles.alertTitleRow}>
                              <Text
                                style={[styles.alertTitle, { color: colors.text }]}
                                numberOfLines={2}
                              >
                                {reason}
                              </Text>
                              {clock ? (
                                <Text
                                  style={[styles.alertTime, { color: colors.textMuted }]}
                                  numberOfLines={1}
                                >
                                  {clock}
                                </Text>
                              ) : null}
                            </View>
                            <Text
                              style={[styles.alertMeta, { color: colors.textSecondary }]}
                              numberOfLines={1}
                            >
                              {action}
                            </Text>
                          </View>
                        </View>
                      </ProtoGlassCard>
                    </Pressable>
                  );
                })
              )}
              {remainingAlertCount > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    homeAlertsExpanded
                      ? 'Réduire la liste des alertes'
                      : moreAlertsCollapsedLabel
                  }
                  onPress={() => {
                    tapHaptic();
                    setHomeAlertsExpanded((open) => !open);
                  }}
                  style={({ pressed }) => [pressed && { opacity: 0.85 }]}
                >
                  <ProtoGlassCard
                    style={[styles.alertMoreCard, homeAlertPreviewSurface(colors, isLight)]}
                    padding={0}
                  >
                    <View style={styles.alertMoreInner}>
                      <Text style={[styles.alertMoreLabel, { color: colors.textMuted }]}>
                        {homeAlertsExpanded ? 'Réduire' : moreAlertsCollapsedLabel}
                      </Text>
                      <AppIcon
                        family="ionicons"
                        name={homeAlertsExpanded ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={colors.textMuted}
                      />
                    </View>
                  </ProtoGlassCard>
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={styles.shortcutGrid}>
            <ProtoShortcutRow
              items={
                [
                  {
                    key: 'ai-chat',
                    label: 'AI Chat',
                    subtitle: 'Conseiller Fyn',
                    icon: 'chatbubble-ellipses-outline',
                    accessibilityLabel: 'Ouvrir AI Chat avec Fyn',
                    onPress: () => router.push('/ai-chat'),
                  },
                  {
                    key: 'strategies',
                    label: 'Stratégies',
                    subtitle: 'Finances',
                    icon: 'compass-outline',
                    accessibilityLabel: 'Explorer les stratégies financières',
                    onPress: () => router.push('/plans/explore'),
                  },
                ] as const satisfies readonly [ProtoShortcutItem, ProtoShortcutItem]
              }
            />
            <ProtoShortcutRow
              items={
                [
                  {
                    key: 'wealth',
                    label: 'Patrimoine',
                    subtitle: 'Explorer',
                    icon: 'trending-up-outline',
                    accessibilityLabel: 'Ouvrir le patrimoine',
                    onPress: () => router.push('/patrimoine'),
                  },
                  {
                    key: 'insights',
                    label: 'Analyse',
                    subtitle: 'Dépenses',
                    icon: 'stats-chart-outline',
                    accessibilityLabel: 'Ouvrir l’analyse des dépenses',
                    onPress: () => router.push('/transactions-insights'),
                  },
                ] as const satisfies readonly [ProtoShortcutItem, ProtoShortcutItem]
              }
            />
          </View>

          {SHOW_RECENTES ? (
            <View>
              <ProtoSectionHeader
                title="Récentes"
                actionLabel="Tout voir"
                onAction={() => router.push('/transactions')}
              />
              <ProtoGlassCard>
                {recentTransactions.length === 0 ? (
                  <Text style={[styles.emptyCopy, { color: colors.textMuted, padding: 16 }]}>
                    Aucune transaction récente
                  </Text>
                ) : (
                  recentTransactions.map((tx, index) => (
                    <View key={tx.id}>
                      {index > 0 ? (
                        <View style={[styles.rowDivider, { backgroundColor: colors.borderSubtle }]} />
                      ) : null}
                      <TransactionRow
                        transaction={tx}
                        accounts={accounts}
                        embedded
                        onPressId={openTransactionDetail}
                      />
                    </View>
                  ))
                )}
              </ProtoGlassCard>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topChrome: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  themeSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBlock: {
    alignItems: 'center',
    gap: 8,
    width: '100%',
    marginTop: spacing.sm,
  },
  heroEyebrow: {
    ...typographyKit.metaMedium,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  deltaWrap: { marginTop: 2, maxWidth: '100%' },
  deltaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    maxWidth: '100%',
  },
  deltaText: {
    ...typographyKit.metaSemibold,
    fontSize: 10,
    flexShrink: 1,
  },
  chartWrap: {
    width: '100%',
    minHeight: 96,
    marginTop: 4,
  },
  periodRow: {
    width: '100%',
    marginTop: 14,
  },
  shortcutGrid: { gap: SHORTCUT_TILE_GAP },
  alertStack: { gap: 8 },
  alertCard: { borderRadius: 16 },
  alertMoreCard: { borderRadius: 16 },
  alertMoreInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  alertMoreLabel: {
    ...typographyKit.metaSemibold,
    fontSize: 13,
  },
  alertInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  alertCopy: { flex: 1, minWidth: 0, gap: 2 },
  alertTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  alertTitle: {
    ...typographyKit.rowTitle,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.15,
    flex: 1,
    minWidth: 0,
  },
  alertTime: {
    ...typographyKit.micro,
    fontSize: 11,
    lineHeight: 14,
    flexShrink: 0,
    marginTop: 2,
  },
  alertMeta: {
    ...typographyKit.micro,
    fontSize: 11,
    lineHeight: 14,
  },
  emptyCopy: {
    ...typographyKit.metaMedium,
    fontSize: 13,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
});
