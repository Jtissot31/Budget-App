/**
 * Budget category detail — the useful part: pace, 6-month trend, where the money
 * goes (top merchants) and the latest transactions. Monochrome; red only when over.
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { ListCard, ListRow, SectionLabel } from '@/components/kit';
import { ProtoTransactionRow } from '@/components/transactions/ProtoTransactionRow';
import { TransactionAvatar } from '@/components/TransactionAvatar';
import { spacing, transactionRowAmountTypography, typographyKit } from '@/constants/theme';
import { useSavingsGoals } from '@/hooks/useSavingsGoals';
import { getTransactions, sortTransactionsNewestFirst } from '@/lib/db';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { tapHaptic } from '@/lib/haptics';
import { openTransactionDetail } from '@/lib/openTransactionDetail';
import { useAppTheme } from '@/lib/themeContext';
import { buildMockMonthTransactions, mockPastMonthTotal } from '@/lib/budgetCategoryMockHistory';
import type { Transaction } from '@/types';

const TREND_MONTHS = 6;
const RECENT_LIMIT = 5;
const CHART_H = 120;

type Props = {
  categoryId: string;
  categoryName: string;
  displayMonth: Date;
  isCurrentMonth: boolean;
  limit: number;
  spent: number;
};

type MonthBucket = { key: string; label: string; total: number; txs: Transaction[] };

function monthOffset(base: Date, delta: number): Date {
  return new Date(base.getFullYear(), base.getMonth() + delta, 1);
}

function normalizeName(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function monthShort(date: Date): string {
  return date.toLocaleDateString('fr-CA', { month: 'short' }).replace('.', '');
}

export function BudgetCategoryInsights({
  categoryId,
  categoryName,
  displayMonth,
  isCurrentMonth,
  limit,
  spent,
}: Props) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const savingsGoals = useSavingsGoals();
  const [months, setMonths] = useState<MonthBucket[]>([]);
  const [usingMock, setUsingMock] = useState(false);
  const [chartWidth, setChartWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const starts = Array.from({ length: TREND_MONTHS }, (_, i) =>
      monthOffset(displayMonth, i - (TREND_MONTHS - 1)),
    );
    // Budget categories and transaction categories can use different ids (demo seeds,
    // renamed categories) — match by id OR by normalised category name.
    const nameKey = normalizeName(categoryName);
    void getTransactions().then((all) => {
      if (cancelled) return;
      const matching = all.filter(
        (tx) =>
          tx.type === 'expense' &&
          (tx.categoryId === categoryId || normalizeName(tx.categoryName ?? '') === nameKey),
      );
      const real = starts.map((start) => {
        const end = monthOffset(start, 1);
        const txs = matching.filter((tx) => {
          const d = new Date(tx.date);
          return d >= start && d < end;
        });
        return {
          key: String(start.getFullYear()) + '-' + String(start.getMonth()),
          label: monthShort(start),
          total: txs.reduce((sum, tx) => sum + Math.abs(tx.amount), 0),
          txs: sortTransactionsNewestFirst(txs),
        };
      });
      // No real history (mock budget categories / fresh install) → realistic demo data
      // so the detail view still shows what it can do.
      if (matching.length === 0 && (spent > 0 || limit > 0)) {
        const now = new Date();
        setUsingMock(true);
        setMonths(
          starts.map((start, i) => {
            const isCurrent = i === starts.length - 1;
            const total = isCurrent ? spent : mockPastMonthTotal(limit, i);
            const txs = buildMockMonthTransactions(categoryId, categoryName, start, total, now);
            return {
              key: String(start.getFullYear()) + '-' + String(start.getMonth()),
              label: monthShort(start),
              total,
              txs: sortTransactionsNewestFirst(txs),
            };
          }),
        );
        return;
      }
      setUsingMock(false);
      setMonths(real);
    });
    return () => {
      cancelled = true;
    };
  }, [categoryId, categoryName, displayMonth, limit, spent]);

  const current = months[months.length - 1];
  const currentTxs = useMemo(() => current?.txs ?? [], [current]);

  const pace = useMemo(() => {
    if (!isCurrentMonth) return null;
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const day = now.getDate();
    const projected = day > 0 ? (spent / day) * daysInMonth : spent;
    const daysLeft = daysInMonth - day + 1;
    const perDay = limit > spent && daysLeft > 0 ? (limit - spent) / daysLeft : 0;
    return { projected, perDay };
  }, [isCurrentMonth, limit, spent]);

  const average = useMemo(() => {
    const past = months.slice(0, -1).filter((m) => m.total > 0);
    if (past.length === 0) return null;
    return past.reduce((sum, m) => sum + m.total, 0) / past.length;
  }, [months]);

  const topMerchants = useMemo(() => {
    const byName = new Map<string, { label: string; total: number; count: number; sample: Transaction }>();
    for (const tx of currentTxs) {
      const label = tx.label.trim() || 'Sans nom';
      const key = label.toLowerCase();
      const entry = byName.get(key) ?? { label, total: 0, count: 0, sample: tx };
      entry.total += Math.abs(tx.amount);
      entry.count += 1;
      byName.set(key, entry);
    }
    return [...byName.values()].sort((a, b) => b.total - a.total).slice(0, 3);
  }, [currentTxs]);

  const avgTicket = currentTxs.length > 0 ? spent / currentTxs.length : 0;
  const projectedOver = pace != null && limit > 0 && pace.projected > limit;

  const stats: { label: string; value: string; color?: string }[] = [
    ...(pace
      ? [
          {
            label: 'Projection fin de mois',
            value: formatDisplayMoneyAbsolute(pace.projected),
            color: projectedOver ? colors.danger : undefined,
          },
          { label: 'Par jour restant', value: pace.perDay > 0 ? formatDisplayMoneyAbsolute(pace.perDay) : '—' },
        ]
      : []),
    { label: 'Achats', value: String(currentTxs.length) },
    { label: 'Ticket moyen', value: avgTicket > 0 ? formatDisplayMoneyAbsolute(avgTicket) : '—' },
  ];

  /* ── Trend chart geometry ── */
  const maxValue = Math.max(limit, ...months.map((m) => m.total), 1);
  const plotH = CHART_H - 22;
  const barGap = 10;
  const barW = chartWidth > 0 ? (chartWidth - barGap * (months.length - 1)) / Math.max(1, months.length) : 0;
  const limitY = plotH - (limit / maxValue) * plotH;

  return (
    <View style={styles.root}>
      <View>
        <SectionLabel title={isCurrentMonth ? 'Rythme' : 'Ce mois-là'} />
        <ListCard style={styles.statsGrid}>
          {stats.map((stat, index) => (
            <View
              key={stat.label}
              style={[
                styles.statCell,
                {
                  borderColor: colors.containerBorder,
                  borderRightWidth: index % 2 === 0 ? StyleSheet.hairlineWidth : 0,
                  borderBottomWidth: index < stats.length - 2 ? StyleSheet.hairlineWidth : 0,
                },
              ]}
            >
              <Text style={[styles.statLabel, { color: colors.textMuted }]} numberOfLines={1}>
                {stat.label}
              </Text>
              <Text
                style={[
                  transactionRowAmountTypography({ fontSize: 17, lineHeight: 22 }),
                  { color: stat.color ?? colors.text },
                ]}
                numberOfLines={1}
              >
                {stat.value}
              </Text>
            </View>
          ))}
        </ListCard>
        {projectedOver ? (
          <Text style={[styles.hint, { color: colors.danger }]}>
            À ce rythme, tu dépasseras de {formatDisplayMoneyAbsolute(pace!.projected - limit)}.
          </Text>
        ) : null}
      </View>

      {months.length > 0 ? (
        <View>
          <SectionLabel
            title="6 derniers mois"
            trailing={
              average != null ? (
                <Text style={[styles.trailingMeta, { color: colors.textMuted }]}>
                  Moyenne {formatDisplayMoneyAbsolute(average)}
                </Text>
              ) : undefined
            }
          />
          <ListCard padding={14}>
            <View
              style={{ height: CHART_H }}
              onLayout={(e) => {
                const w = Math.floor(e.nativeEvent.layout.width);
                setChartWidth((prev) => (prev === w ? prev : w));
              }}
            >
              {chartWidth > 0 ? (
                <Svg width={chartWidth} height={CHART_H}>
                  {months.map((m, i) => {
                    const h = Math.max(2, (m.total / maxValue) * plotH);
                    const x = i * (barW + barGap);
                    const isLast = i === months.length - 1;
                    const over = limit > 0 && m.total > limit;
                    const fill = over
                      ? colors.danger
                      : isLast
                        ? colors.text
                        : colors.borderStrong;
                    return (
                      <Rect key={m.key} x={x} y={plotH - h} width={barW} height={h} rx={5} fill={fill} />
                    );
                  })}
                  {limit > 0 ? (
                    <Line
                      x1={0}
                      x2={chartWidth}
                      y1={limitY}
                      y2={limitY}
                      stroke={colors.textMuted}
                      strokeWidth={1}
                      strokeDasharray="4 4"
                    />
                  ) : null}
                  {months.map((m, i) => (
                    <SvgText
                      key={`l-${m.key}`}
                      x={i * (barW + barGap) + barW / 2}
                      y={CHART_H - 4}
                      fontSize={11}
                      fill={i === months.length - 1 ? colors.text : colors.textMuted}
                      textAnchor="middle"
                    >
                      {m.label}
                    </SvgText>
                  ))}
                </Svg>
              ) : null}
            </View>
            {limit > 0 ? (
              <Text style={[styles.chartLegend, { color: colors.textMuted }]}>
                Pointillés : limite de {formatDisplayMoneyAbsolute(limit)}
              </Text>
            ) : null}
          </ListCard>
        </View>
      ) : null}

      {topMerchants.length > 0 ? (
        <View>
          <SectionLabel title="Où va l’argent" />
          <ListCard>
            {topMerchants.map((merchant, index) => (
              <ListRow
                key={merchant.label}
                leading={<TransactionAvatar transaction={merchant.sample} size={40} />}
                title={merchant.label}
                subtitle={`${merchant.count} achat${merchant.count > 1 ? 's' : ''}`}
                value={formatDisplayMoneyAbsolute(merchant.total)}
                valueSub={spent > 0 ? `${Math.round((merchant.total / spent) * 100)} %` : undefined}
                progress={spent > 0 ? merchant.total / spent : 0}
                progressColor={colors.text}
                isLast={index === topMerchants.length - 1}
              />
            ))}
          </ListCard>
        </View>
      ) : null}

      <View>
        <SectionLabel
          title="Transactions"
          actionLabel={currentTxs.length > RECENT_LIMIT ? 'Voir tout' : undefined}
          onAction={() =>
            router.push({ pathname: '/budget-category-transactions', params: { id: categoryId, name: categoryName } })
          }
        />
        <ListCard>
          {currentTxs.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>Aucune transaction ce mois-ci</Text>
          ) : (
            currentTxs.slice(0, RECENT_LIMIT).map((tx, index, rows) => (
              <ProtoTransactionRow
                key={tx.id}
                transaction={tx}
                accounts={[]}
                savingsGoals={savingsGoals}
                isLast={index === rows.length - 1}
                onPressId={(id) => {
                  if (usingMock) return;
                  tapHaptic();
                  openTransactionDetail(id);
                }}
              />
            ))
          )}
        </ListCard>
        {currentTxs.length > RECENT_LIMIT ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              tapHaptic();
              router.push({ pathname: '/budget-category-transactions', params: { id: categoryId, name: categoryName } });
            }}
            style={({ pressed }) => [styles.more, pressed && { opacity: 0.7 }]}
          >
            <Text style={[styles.moreText, { color: colors.textMuted }]}>
              Voir les {currentTxs.length} transactions
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg + spacing.xs },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statCell: { width: '50%', paddingHorizontal: 14, paddingVertical: 12, gap: 4 },
  statLabel: { ...typographyKit.metaMedium, fontSize: 11.5 },
  hint: { ...typographyKit.metaMedium, fontSize: 12.5, marginTop: 8, paddingHorizontal: 2 },
  trailingMeta: { ...typographyKit.metaSemibold, fontSize: 11 },
  chartLegend: { ...typographyKit.metaMedium, fontSize: 11, marginTop: 8 },
  empty: { ...typographyKit.metaMedium, fontSize: 13, padding: 16 },
  more: { alignSelf: 'center', paddingVertical: 10 },
  moreText: { ...typographyKit.metaSemibold, fontSize: 12.5 },
});
