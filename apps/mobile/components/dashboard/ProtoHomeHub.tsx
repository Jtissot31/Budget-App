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
import { PageTransition } from '@/components/PageTransition';
import { HomeSpendInvestCards } from '@/components/dashboard/HomeSpendInvestCards';
import { ProtoGlassCard } from '@/components/proto/ProtoGlassCard';
import { ProtoSectionHeader } from '@/components/proto/ProtoSectionHeader';
import { SparklineChart } from '@/components/chat/SparklineChart';
import { TransactionRow } from '@/components/TransactionRow';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  FLOATING_NAV_CONTENT_PADDING,
  moneyAmountTypography,
  PAGE_PADDING_HORIZONTAL,
  PAGE_TITLE_STYLE,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { useAlertCenter } from '@/hooks/useAlertCenter';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { alertDetailRouteParams, type AlertCenterItem } from '@/lib/alerts';
import { alertListShortReason } from '@/lib/alertPresentation';
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
import { formatDisplayMoneyAbsolute, formatSignedDisplayMoney } from '@/lib/formatDisplayMoney';
import { openTransactionDetail } from '@/lib/openTransactionDetail';
import { tapHaptic } from '@/lib/haptics';
import { syncWithServer } from '@/lib/sync';
import { useAppTheme } from '@/lib/themeContext';
import { getUserDisplayName } from '@/lib/userDisplay';
import type { RecurringPayment, SimulatedAccount, Transaction } from '@/types';

type ChartPeriod = '1M' | '3M' | '6M' | '1A' | '5A';

const CHART_PERIODS: ChartPeriod[] = ['1M', '3M', '6M', '1A', '5A'];

const PERIOD_DAY_COUNT: Record<ChartPeriod, number> = {
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1A': 365,
  '5A': 365 * 5,
};

function greetingLine() {
  const h = new Date().getHours();
  if (h < 5) return 'Bonsoir';
  if (h < 12) return 'Bon matin';
  if (h < 18) return 'Bonjour';
  return 'Bonsoir';
}

function monthEyebrow() {
  const raw = new Date().toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function sparklineSinceIso(dayCount: number): string {
  const since = new Date();
  since.setDate(since.getDate() - (dayCount + 1));
  since.setHours(0, 0, 0, 0);
  return since.toISOString();
}

function alertAccent(item: AlertCenterItem): { iconBg: string; iconColor: string; icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap } {
  if (item.severity === 'danger') {
    return { iconBg: 'rgba(248,113,113,0.12)', iconColor: '#F87171', icon: 'card-outline' };
  }
  if (item.severity === 'warning') {
    return { iconBg: 'rgba(251,191,36,0.12)', iconColor: '#FBBF24', icon: 'flash-outline' };
  }
  return { iconBg: 'rgba(96,165,250,0.12)', iconColor: '#60A5FA', icon: 'information-circle-outline' };
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

export function ProtoHomeHub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isLight, setMode } = useAppTheme();
  const [displayName, setDisplayName] = useState('Sophie');
  const [accounts, setAccounts] = useState<SimulatedAccount[]>([]);
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);
  const [incomeTransactions, setIncomeTransactions] = useState<Transaction[]>([]);
  const [sparklineTx, setSparklineTx] = useState<Transaction[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('6M');
  const [chartWidth, setChartWidth] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

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
    const [name, nextAccounts, payments, income, sparkTx, allTx] = await Promise.all([
      getUserDisplayName(),
      getSimulatedAccounts(),
      getRecurringPayments(),
      getRecentIncomeTransactions(),
      getTransactionsSince(sparklineSinceIso(dayCount)),
      getTransactions(),
    ]);
    if (name?.trim()) setDisplayName(name.trim().split(/\s+/)[0] ?? name.trim());
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

  useRefreshOnFocus(load);

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
  const previewAlerts = alertCenterItems.slice(0, 3);

  const onChartLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.width);
    setChartWidth((prev) => (prev === next ? prev : next));
  }, []);

  const toggleTheme = useCallback(() => {
    tapHaptic();
    void setMode(isLight ? 'dark' : 'light');
  }, [isLight, setMode]);

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View
          pointerEvents="box-none"
          style={[styles.topChrome, { paddingTop: insets.top + 8 }]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isLight ? 'Passer en mode sombre' : 'Passer en mode clair'}
            onPress={toggleTheme}
            style={({ pressed }) => [
              styles.themePill,
              { backgroundColor: colors.surfaceElevated },
              pressed && { opacity: 0.82 },
            ]}
          >
            <AppIcon
              family="ionicons"
              name={isLight ? 'moon-outline' : 'sunny-outline'}
              size={12}
              color={isLight ? colors.textSecondary : '#FBBF24'}
            />
            <Text style={[styles.themePillLabel, { color: colors.textSecondary }]}>
              {isLight ? 'Dark' : 'Light'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ouvrir les réglages"
            onPress={() => {
              tapHaptic();
              router.push('/settings');
            }}
            style={({ pressed }) => [
              styles.avatarBtn,
              { backgroundColor: colors.surfaceElevated },
              pressed && { opacity: 0.82 },
            ]}
          >
            <AppIcon family="ionicons" name="person-outline" size={14} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.screen}
          contentContainerStyle={{
            paddingTop: insets.top + SCREEN_TOP_GUTTER + 36,
            paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING,
            paddingHorizontal: PAGE_PADDING_HORIZONTAL,
            gap: 18,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          <View style={styles.greetingBlock}>
            <Text style={[styles.monthLabel, { color: colors.textMuted }]}>{monthEyebrow()}</Text>
            <Text style={[styles.greeting, { color: colors.text }]}>
              {greetingLine()}, {displayName} 👋
            </Text>
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
                  {formatSignedDisplayMoney(delta.amount, { leadingPlusWhenPositive: true })} ·{' '}
                  {heroPositive ? '+' : '−'}
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
              {CHART_PERIODS.map((period) => {
                const active = period === chartPeriod;
                return (
                  <Pressable
                    key={period}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      tapHaptic();
                      setChartPeriod(period);
                    }}
                    style={[
                      styles.periodChip,
                      active && { backgroundColor: colors.surfaceElevated },
                    ]}
                  >
                    <Text
                      style={[
                        styles.periodLabel,
                        { color: active ? colors.text : colors.textMuted },
                      ]}
                    >
                      {period}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <HomeSpendInvestCards />

          <View>
            <ProtoSectionHeader
              title="Notifications & alertes"
              actionLabel="Tout voir"
              onAction={() => router.push('/alert-center')}
            />
            <View style={styles.alertStack}>
              {previewAlerts.length === 0 ? (
                <ProtoGlassCard padding={14}>
                  <Text style={[styles.emptyCopy, { color: colors.textMuted }]}>
                    Aucune alerte pour le moment
                  </Text>
                </ProtoGlassCard>
              ) : (
                previewAlerts.map((item) => {
                  const accent = alertAccent(item);
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
                      <ProtoGlassCard style={styles.alertCard} padding={0}>
                        <View style={styles.alertInner}>
                          <View style={[styles.alertIcon, { backgroundColor: accent.iconBg }]}>
                            <AppIcon family="ionicons" name={accent.icon} size={14} color={accent.iconColor} />
                          </View>
                          <View style={styles.alertCopy}>
                            <Text style={[styles.alertTitle, { color: colors.text }]} numberOfLines={1}>
                              {item.title}
                            </Text>
                            <Text
                              style={[styles.alertMeta, { color: colors.textMuted }]}
                              numberOfLines={1}
                            >
                              {alertListShortReason(item)}
                            </Text>
                          </View>
                          {item.montant != null ? (
                            <Text
                              style={[
                                moneyAmountTypography({ tier: 'row', fontSize: 13 }),
                                { color: colors.text, letterSpacing: -0.2, flexShrink: 0, maxWidth: '34%' },
                              ]}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.75}
                            >
                              {formatDisplayMoneyAbsolute(Math.abs(item.montant))}
                            </Text>
                          ) : null}
                        </View>
                      </ProtoGlassCard>
                    </Pressable>
                  );
                })
              )}
            </View>
          </View>

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
        </ScrollView>
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topChrome: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  themePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  themePillLabel: {
    ...typographyKit.metaSemibold,
    fontSize: 11,
  },
  avatarBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingBlock: {
    paddingTop: spacing.md,
    marginBottom: 64,
  },
  monthLabel: {
    ...typographyKit.metaMedium,
    fontSize: 12,
    marginBottom: 5,
  },
  greeting: {
    ...PAGE_TITLE_STYLE,
    fontSize: 24,
    letterSpacing: -0.35,
    lineHeight: 28,
  },
  heroBlock: {
    alignItems: 'center',
    gap: 8,
    width: '100%',
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
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 1,
    marginTop: 6,
  },
  periodChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
  },
  periodLabel: {
    ...typographyKit.metaSemibold,
    fontSize: 11,
  },
  alertStack: { gap: 8 },
  alertCard: { borderRadius: 16 },
  alertInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  alertIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertCopy: { flex: 1, minWidth: 0, gap: 2 },
  alertTitle: {
    ...typographyKit.rowTitle,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.1,
  },
  alertMeta: {
    ...typographyKit.micro,
    fontSize: 10,
    lineHeight: 13,
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
